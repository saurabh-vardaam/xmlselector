// --- Types ---
export interface SelectionSummaryItem {
  name: string;
  length: number;
  color: string;
  unit?: string;
  pitch?: number;
}

export interface Point {
  id: string;
  x: number;
  y: number;
  z?: number;
}

export interface Line {
  id: string;
  point1Id: string;
  point2Id: string;
  type: string;
}

export interface Face {
  id: string;
  label?: string;
  lineIds: string[];
  vertexPoints: { x: number; y: number }[];
  vertexPoints3D: { x: number; y: number; z: number }[];
  orderedPointIds: string[];
  centroid: { x: number; y: number };
  area?: number;
  pitch?: number;
}

export interface ReportData {
  pointsMap: Map<string, Point>;
  linesMap: Map<string, Line>;
  facesMap: Map<string, Face>;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  summaryMap: Map<string, number>;
  total2DLengths: Map<string, number>;
  lineToFacesMap: Map<string, string[]>;
}

interface LineTypeStyle {
  name: string;
  color: string;
}

// --- Constants ---
export const LINE_TYPE_MAP: Record<string, LineTypeStyle> = {
  EAVE: { name: 'Eave', color: '#007BFF' },
  RAKE: { name: 'Rake', color: '#28A745' },
  RIDGE: { name: 'Ridge', color: '#DC3545' },
  VALLEY: { name: 'Valley', color: '#FFC107' },
  FLASHING: { name: 'Flashing', color: '#6F42C1' },
  STEPFLASH: { name: 'Step Flashing', color: '#FD7E14' },
  PARAPET: { name: 'Parapet', color: '#17A2B8' },
  HIP: { name: 'Hip', color: '#E83E8C' },
  OTHER: { name: 'Other', color: '#6C757D' },
};
export const SUMMARY_KEY_MAP: Record<string, string> = {
  RAKE: 'TotalRakesLength',
  STEPFLASH: 'TotalStepFlashingLength',
  FLASHING: 'TotalFlashingLength',
  HIP: 'TotalHipsLength',
  RIDGE: 'TotalRidgesLength',
  VALLEY: 'TotalValleysLength',
};
export const DEFAULT_LINE_STYLE: LineTypeStyle = { name: 'Other', color: '#6C757D' };
export const VIEW_COLORS = {
  selected: '#add8e6', // Light Sky Blue
  hoverAdd: '#28a745', // Green
  hoverRemove: '#dc3545', // Red
  unselected: '#808080', // Gray
  dimmed: '#D3D3D3', // Light Gray
};

// --- XML Parsing Functions ---
export function parseEagleViewXML(xmlString: string): ReportData | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      console.error(
        'Error parsing XML:',
        xmlDoc.getElementsByTagName('parsererror')[0].textContent
      );
      return null;
    }

    const pointsMap = new Map<string, Point>();
    xmlDoc.querySelectorAll('ROOF > POINTS > POINT').forEach(pNode => {
      const id = pNode.getAttribute('id');
      const dataStr = pNode.getAttribute('data');
      if (id && dataStr) {
        const coords = dataStr.split(',').map(Number);
        if (coords.length >= 2 && !coords.some(isNaN)) {
          pointsMap.set(id, { id, x: coords[0], y: coords[1], z: coords[2] });
        }
      }
    });

    const linesMap = new Map<string, Line>();
    xmlDoc.querySelectorAll('ROOF > LINES > LINE').forEach(lNode => {
      const id = lNode.getAttribute('id');
      const type = lNode.getAttribute('type')?.toUpperCase() || 'OTHER';
      const pathStr = lNode.getAttribute('path');
      if (id && pathStr) {
        const pointIds = pathStr.split(',');
        if (pointIds.length === 2) {
          linesMap.set(id, {
            id,
            type,
            point1Id: pointIds[0],
            point2Id: pointIds[1],
          });
        }
      }
    });

    const facesMap = new Map<string, Face>();
    const lineToFacesMap = new Map<string, string[]>();
    xmlDoc.querySelectorAll('ROOF > FACES > FACE').forEach(fNode => {
      const id = fNode.getAttribute('id');
      const designator = fNode.getAttribute('designator') || undefined;
      const polygonNode = fNode.querySelector('POLYGON');
      if (id && polygonNode) {
        const pathStr = polygonNode.getAttribute('path');
        const lineIds = pathStr ? pathStr.split(',') : [];
        const pitchStr = polygonNode.getAttribute('pitch');
        const pitch = pitchStr ? parseFloat(pitchStr) : undefined;
        const areaStr =
          polygonNode.getAttribute('unroundedsize') ||
          polygonNode.getAttribute('size');
        const area = areaStr ? parseFloat(areaStr) : undefined;

        lineIds.forEach(lineId => {
          if (!lineToFacesMap.has(lineId)) {
            lineToFacesMap.set(lineId, []);
          }
          lineToFacesMap.get(lineId)!.push(id);
        });

        facesMap.set(id, {
          id,
          label: designator,
          lineIds,
          pitch,
          area,
          vertexPoints: [],
          vertexPoints3D: [],
          orderedPointIds: [],
          centroid: { x: 0, y: 0 },
        });
      }
    });

    const summaryMap = new Map<string, number>();
    xmlDoc
      .querySelectorAll('EAGLEVIEW_EXPORT > OVERALL_SUMMARY > ATTRIBUTE')
      .forEach(attrNode => {
        const name = attrNode.getAttribute('name');
        const valueStr = attrNode.getAttribute('value');
        if (name && valueStr) {
          const value = parseFloat(valueStr);
          if (!isNaN(value)) {
            summaryMap.set(name, value);
          }
        }
      });

    const total2DLengths = new Map<string, number>();
    linesMap.forEach(line => {
      const p1 = pointsMap.get(line.point1Id);
      const p2 = pointsMap.get(line.point2Id);
      if (p1 && p2) {
        const length = calculateDistance(p1, p2);
        total2DLengths.set(
          line.type,
          (total2DLengths.get(line.type) || 0) + length
        );
      }
    });

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    pointsMap.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    const boundingBox =
      pointsMap.size > 0 && isFinite(minX) ? { minX, minY, maxX, maxY } : null;

    facesMap.forEach(face => {
      const orderedPointIds: string[] = [];
      const edges = face.lineIds
        .map(lineId => {
          const line = linesMap.get(lineId);
          return line
            ? ([line.point1Id, line.point2Id] as [string, string])
            : null;
        })
        .filter(path => path !== null) as [string, string][];

      if (edges.length > 0) {
        orderedPointIds.push(edges[0][0]);
        let currentPointId = edges[0][1];
        orderedPointIds.push(currentPointId);
        const usedEdgeIndices = new Set<number>([0]);
        while (
          usedEdgeIndices.size < edges.length &&
          orderedPointIds.length <= edges.length
        ) {
          let foundNextEdge = false;
          for (let i = 0; i < edges.length; i++) {
            if (usedEdgeIndices.has(i)) continue;
            const nextEdge = edges[i];
            if (pointsMap.has(nextEdge[0]) && pointsMap.has(nextEdge[1])) {
              if (nextEdge[0] === currentPointId) {
                currentPointId = nextEdge[1];
                orderedPointIds.push(currentPointId);
                usedEdgeIndices.add(i);
                foundNextEdge = true;
                break;
              } else if (nextEdge[1] === currentPointId) {
                currentPointId = nextEdge[0];
                orderedPointIds.push(currentPointId);
                usedEdgeIndices.add(i);
                foundNextEdge = true;
                break;
              }
            }
          }
          if (!foundNextEdge) break;
        }
        if (
          orderedPointIds.length - 1 !== edges.length &&
          orderedPointIds[0] !== orderedPointIds[orderedPointIds.length - 1]
        ) {
          console.warn(
            `Face ${
              face.id
            } has a potential vertex ordering issue. Vertices found: ${
              orderedPointIds.length - 1
            }, Edges: ${edges.length}`
          );
        }
        if (
          orderedPointIds.length > 1 &&
          orderedPointIds[0] === orderedPointIds[orderedPointIds.length - 1]
        ) {
          orderedPointIds.pop();
        }
      }
      face.orderedPointIds = orderedPointIds;
      face.vertexPoints = orderedPointIds
        .map(pid => {
          const p = pointsMap.get(pid);
          return p ? { x: p.x, y: p.y } : null;
        })
        .filter(p => p !== null) as { x: number; y: number }[];

      face.vertexPoints3D = orderedPointIds
        .map(pid => {
          const p = pointsMap.get(pid);
          return p ? { x: p.x, y: p.y, z: p.z || 0 } : null;
        })
        .filter(p => p !== null) as { x: number; y: number; z: number }[];

      if (face.area === undefined) {
        face.area = calculatePolygonArea(face.vertexPoints);
      }
      if (face.vertexPoints.length > 0) {
        let sumX = 0,
          sumY = 0;
        face.vertexPoints.forEach(v => {
          sumX += v.x;
          sumY += v.y;
        });
        face.centroid = {
          x: sumX / face.vertexPoints.length,
          y: sumY / face.vertexPoints.length,
        };
      }
    });
    
    console.log(`Parsed ${pointsMap.size} points, ${linesMap.size} lines, ${facesMap.size} faces`);
    console.log("Bounding box calculated:", boundingBox);
    
    return {
      pointsMap,
      linesMap,
      facesMap,
      boundingBox,
      summaryMap,
      total2DLengths,
      lineToFacesMap,
    };
  } catch (error) {
    console.error('Failed to parse XML:', error);
    return null;
  }
}

// --- Helper Functions ---
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(128, 128, 128, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function calculatePolygonArea(vertices: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

export function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function calculateSelectionSummary(
  selectedFaces: Set<string>,
  reportData: ReportData
): SelectionSummaryItem[] {
  if (!selectedFaces || selectedFaces.size === 0 || !reportData) {
    return [];
  }

  const { summaryMap, total2DLengths, lineToFacesMap, facesMap } = reportData;
  const lengthTotals: { [key: string]: number } = {};
  const processedLines = new Set<string>();
  let totalArea = 0;
  let totalPitch: number | undefined = undefined;

  selectedFaces.forEach(faceId => {
    const face = reportData.facesMap.get(faceId);
    if (!face) return;

    if (face.area) {
      totalArea += face.area;
    }
    if (face.pitch) {
      totalPitch = face.pitch;
    }

    face.lineIds.forEach(lineId => {
      if (processedLines.has(lineId)) return;
      processedLines.add(lineId);

      const line = reportData.linesMap.get(lineId);
      if (!line) return;

      const p1 = reportData.pointsMap.get(line.point1Id);
      const p2 = reportData.pointsMap.get(line.point2Id);
      if (!p1 || !p2) return;

      const twoDLength = calculateDistance(p1, p2);
      let trueLength = 0;

      switch (line.type) {
        case 'RAKE':
        case 'FLASHING':
        case 'STEPFLASH':
          const summaryKey = SUMMARY_KEY_MAP[line.type];
          const total2D = total2DLengths.get(line.type);
          const total3D = summaryKey ? summaryMap.get(summaryKey) : undefined;

          if (total2D && total2D > 0 && total3D) {
            const ratio = twoDLength / total2D;
            trueLength = total3D * ratio;
          } else {
            trueLength = twoDLength; // Fallback
          }
          break;

        case 'EAVE':
        case 'PARAPET':
          trueLength = twoDLength;
          break;

        case 'HIP':
        case 'VALLEY':
        case 'RIDGE':
        default:
          const adjacentFaceIds = lineToFacesMap.get(line.id) || [];
          const pitches = adjacentFaceIds
            .map(id => facesMap.get(id)?.pitch)
            .filter((p): p is number => p !== undefined && p > 0);

          let effectivePitch = 0;
          if (pitches.length > 0) {
            effectivePitch =
              pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
          } else {
            effectivePitch = face.pitch || 0;
          }

          if (effectivePitch > 0) {
            const pitchMultiplier =
              Math.sqrt(effectivePitch * effectivePitch + 12 * 12) / 12;
            trueLength = twoDLength * pitchMultiplier;
          } else {
            trueLength = twoDLength; // Fallback if no pitch
          }
          break;
      }
      lengthTotals[line.type] = (lengthTotals[line.type] || 0) + trueLength;
    });
  });

  const summaryResult = Object.entries(lengthTotals)
    .map(([type, length]) => {
      const style = LINE_TYPE_MAP[type] || DEFAULT_LINE_STYLE;
      return {
        name: style.name,
        length: parseFloat(length.toFixed(2)),
        color: style.color,
        unit: 'ft',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (totalArea > 0) {
    summaryResult.push({
      name: 'Total Area',
      length: parseFloat(totalArea.toFixed(2)),
      color: '#808080', // Gray color for area
      unit: 'sq ft',
    });
  }

  if (totalPitch !== undefined) {
    summaryResult.push({
      name: 'Pitch',
      length: totalPitch,
      color: '#A9A9A9',
      unit: '/ 12',
    });
  }

  return summaryResult;
}

export interface FaceSummary {
  faceId: string;
  faceLabel?: string;
  area?: number;
  pitch?: number;
  lineSummary: SelectionSummaryItem[];
}

export function calculateFaceSummary(
  faceId: string,
  reportData: ReportData
): FaceSummary | null {
  if (!reportData) {
    return null;
  }

  const face = reportData.facesMap.get(faceId);
  if (!face) {
    return null;
  }

  const lineSummary = calculateSelectionSummary(new Set([faceId]), reportData);

  return {
    faceId: face.id,
    faceLabel: face.label,
    area: face.area,
    pitch: face.pitch,
    lineSummary: lineSummary.filter(item => item.name !== 'Total Area' && item.name !== 'Pitch'), 
  };
}


