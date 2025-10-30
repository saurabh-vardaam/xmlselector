import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import ThreeDViewer from "./ThreeDViewer";
import type { ThreeDViewerControls } from "./ThreeDViewer";
import {
  calculateSelectionSummary,
  // calculateDistance,
  LINE_TYPE_MAP,
  DEFAULT_LINE_STYLE,
  VIEW_COLORS,
  hexToRgba,
} from "./eagleViewUtils";
import type { ReportData, Face, SelectionSummaryItem } from "./eagleViewUtils";
import MinusIcon from "../Icons/LatisZoomOutIcon";
import PlusIcon from "../Icons/LatisZoomInIcon";
import RefreshIcon from "../Icons/LatisRefreshIcon";
import CloseIcon from "../Icons/LatisCloseIcon";
import FaceTooltip from "./FaceTooltip";
import LatisCheckIcon from "../Icons/LatisCheckIcon";

// --- Types ---
interface DisambiguationChoice {
  id: string;
  label?: string;
}

interface FaceSelectionItem {
  faceId: string;
  [key: string]: any; // This will allow spreading faceSummary properties
}

// --- Constants ---
const CLICK_THRESHOLD = 5; // Pixels to differentiate click from pan

// --- Helper Functions ---
function isPointInPolygon(
  point: { x: number; y: number },
  vertices: { x: number; y: number }[]
): boolean {
  if (vertices.length < 3) return false;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x,
      yi = vertices[i].y;
    const xj = vertices[j].x,
      yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Helper functions for working with the new FaceSelectionItem structure
function getSelectedFaceIds(selection: FaceSelectionItem[]): Set<string> {
  return new Set(selection.map((item) => item.faceId));
}

function addFaceToSelection(
  selection: FaceSelectionItem[],
  faceId: string,
  reportData: ReportData
): FaceSelectionItem[] {
  const existingIndex = selection.findIndex((item) => item.faceId === faceId);
  if (existingIndex >= 0) {
    return selection; // Face already selected
  }

  const faceSummary = calculateSelectionSummary(new Set([faceId]), reportData);
  // Create object with faceId and spread faceSummary properties
  const faceSelectionItem: FaceSelectionItem = { faceId };
  faceSummary.forEach((item) => {
    faceSelectionItem[`${item.name}_length`] = item.length;
    faceSelectionItem[`${item.name}_color`] = item.color;
  });

  return [...selection, faceSelectionItem];
}

function removeFaceFromSelection(
  selection: FaceSelectionItem[],
  faceId: string
): FaceSelectionItem[] {
  return selection.filter((item) => item.faceId !== faceId);
}

// function updateFaceSummary(
//   selection: FaceSelectionItem[],
//   faceId: string,
//   reportData: ReportData
// ): FaceSelectionItem[] {
//   return selection.map((item) =>
//     item.faceId === faceId
//       ? {
//           ...item,
//           faceSummary: calculateSelectionSummary(new Set([faceId]), reportData),
//         }
//       : item
//   );
// }

// --- Face Disambiguation Popup ---
interface FaceDisambiguationPopupProps {
  choices: DisambiguationChoice[];
  position: { x: number; y: number };
  onSelect: (faceId: string) => void;
  onClose: () => void;
  selectedFaces: FaceSelectionItem[];
}

const FaceDisambiguationPopup: React.FC<FaceDisambiguationPopupProps> = ({
  choices,
  position,
  onSelect,
  onClose,
  selectedFaces,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [onClose]);

  // Adjust position if popup goes off-screen
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  useEffect(() => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      let newX = position.x;
      let newY = position.y;
      if (position.x + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 10;
      }
      if (position.y + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 10;
      }
      newX = Math.max(10, newX);
      newY = Math.max(10, newY);
      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [position, choices]);

  if (!choices.length) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-50 p-3 text-sm bg-white border border-gray-300 rounded-md shadow-lg"
      style={{
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="disambiguation-title"
    >
      <h3
        id="disambiguation-title"
        className="mb-2 font-semibold text-gray-700"
      >
        Select a face:
      </h3>
      <ul className="space-y-1">
        {choices.map((choice) => (
          <li key={choice.id}>
            <button
              onClick={() => onSelect(choice.id)}
              className={`w-full text-left px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                selectedFaces.some((face) => face.faceId === choice.id)
                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                  : "text-sky-700 hover:bg-sky-100"
              }`}
            >
              {choice.label || `Face ID: ${choice.id}`}
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={onClose}
        className="mt-2 text-xs text-gray-500 hover:text-gray-700 focus:outline-none"
      >
        Cancel
      </button>
    </div>
  );
};

// --- React Component: EagleViewSelector ---
interface EagleViewSelectorProps {
  xmlContent: string | null;
  onSelectionChange: (
    summary: SelectionSummaryItem[],
    currentSelection?: FaceSelectionItem[]
  ) => void;
  onFaceSelectionChange?: (faces: Set<string>) => void;
  error: string;
  isAllSelected: boolean;
  setIsAllSelected: Dispatch<SetStateAction<boolean>>;
  xmlUISelection: FaceSelectionItem[];
  setXmlUISelection: Dispatch<SetStateAction<FaceSelectionItem[]>>;
  setReportData: Dispatch<SetStateAction<ReportData | null>>;
  reportData: ReportData | null;
}

const CustomEagleViewSelector: React.FC<EagleViewSelectorProps> = ({
  xmlContent,
  onSelectionChange,
  xmlUISelection,
  setXmlUISelection,
  reportData,
  setReportData,
  isAllSelected,
  setIsAllSelected,
  error,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const threeDViewerRef = useRef<ThreeDViewerControls>(null);
  const transformRef = useRef<{
    scale: number;
    offsetX: number;
    offsetY: number;
  }>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const [revision, setRevision] = useState(0);
  const requestRedraw = () => setRevision((r) => r + 1);

  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  useEffect(() => {
    if (viewMode === "2D") {
      const timer = setTimeout(() => requestRedraw(), 0);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  const isPanningRef = useRef(false);
  const panStartCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartTransform = useRef<{ offsetX: number; offsetY: number }>({
    offsetX: 0,
    offsetY: 0,
  });

  const [disambiguationChoices, setDisambiguationChoices] = useState<
    DisambiguationChoice[]
  >([]);
  const [disambiguationPosition, setDisambiguationPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [hoveredFaceIds, setHoveredFaceIds] = useState<string[]>([]);
  const hoveredFaceIdsRef = useRef<string[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [highlightedLineType, _setHighlightedLineType] = useState<string | null>(
    null
  );

  const tooltipData = useMemo(() => {
    if (viewMode === "3D" || !hoveredFaceIds.length || !reportData) return [];
    return hoveredFaceIds
      .map((faceId) => {
        const face = reportData.facesMap.get(faceId);
        return {
          faceId: faceId,
          faceLabel: face?.label || `Face ID: ${faceId}`,
          lines: calculateSelectionSummary(new Set([faceId]), reportData),
        };
      })
      .filter((faceData) => faceData.lines.length > 0);
  }, [hoveredFaceIds, reportData, viewMode]);

  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setCanvasSize({
          width: Math.max(1, width),
          height: Math.max(1, height),
        });
      }
    });
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, []);

  const calculateBaseTransform = useCallback(
    (
      currentReportData: ReportData | null,
      currentCanvasWidth: number,
      currentCanvasHeight: number
    ): { scale: number; offsetX: number; offsetY: number } => {
      // console.log("Calculating transform:", {
      //     hasReportData: !!currentReportData,
      //     hasBoundingBox: !!currentReportData?.boundingBox,
      //     canvasWidth: currentCanvasWidth,
      //     canvasHeight: currentCanvasHeight,
      //     boundingBox: currentReportData?.boundingBox
      // });

      if (
        !currentReportData ||
        !currentReportData.boundingBox ||
        currentCanvasWidth <= 0 ||
        currentCanvasHeight <= 0
      ) {
        const fallbackTransform = {
          scale: 1,
          offsetX: currentCanvasWidth / 2,
          offsetY: currentCanvasHeight / 2,
        };
        // console.log("Using fallback transform:", fallbackTransform);
        return fallbackTransform;
      }
      const { minX, minY, maxX, maxY } = currentReportData.boundingBox;
      const dataWidth = maxX - minX;
      const dataHeight = maxY - minY;
      const padding = 50;
      const effectiveCanvasWidth = Math.max(
        1,
        currentCanvasWidth - 2 * padding
      );
      const effectiveCanvasHeight = Math.max(
        1,
        currentCanvasHeight - 2 * padding
      );

      let newScale: number;
      if (dataWidth === 0 && dataHeight === 0) newScale = 50;
      else if (dataWidth === 0)
        newScale = dataHeight > 0 ? effectiveCanvasHeight / dataHeight : 50;
      else if (dataHeight === 0)
        newScale = dataWidth > 0 ? effectiveCanvasWidth / dataWidth : 50;
      else
        newScale = Math.min(
          effectiveCanvasWidth / dataWidth,
          effectiveCanvasHeight / dataHeight
        );

      newScale *= 0.9; // Margin
      if (newScale <= 0 || !isFinite(newScale) || isNaN(newScale)) newScale = 1;

      const newOffsetX =
        padding +
        (effectiveCanvasWidth - dataWidth * newScale) / 2 -
        minX * newScale;
      const newOffsetY =
        padding +
        (effectiveCanvasHeight - dataHeight * newScale) / 2 +
        maxY * newScale;
      return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
    },
    []
  );

  useEffect(() => {
    if (reportData && canvasSize.width > 0 && canvasSize.height > 0) {
      transformRef.current = calculateBaseTransform(
        reportData,
        canvasSize.width,
        canvasSize.height
      );
    } else if (!reportData) {
      // Clear canvas if no data
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (!xmlContent) {
      setReportData(null);
    }
  }, [reportData, canvasSize, calculateBaseTransform, xmlContent]);

  // Drawing Logic
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    // console.log("Drawing scene:", {
    //     hasCanvas: !!canvas,
    //     hasReportData: !!reportData,
    //     pointsCount: reportData?.pointsMap.size || 0,
    //     facesCount: reportData?.facesMap.size || 0,
    //     linesCount: reportData?.linesMap.size || 0
    // });

    if (!canvas || !reportData || !reportData.pointsMap.size) {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const transform = transformRef.current;
    const hoveredIds = hoveredFaceIdsRef.current;

    // Ensure canvas attributes match state for drawing buffer size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // console.log("Canvas size:", { width: canvas.width, height: canvas.height });
    // console.log("Transform:", transform);
    // console.log("Drawing faces:", reportData.facesMap.size);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let faceIndex = 0;
    reportData.facesMap.forEach((face) => {
      if (face.vertexPoints.length < 2) {
        // console.log(`Face ${face.id} has insufficient vertex points:`, face.vertexPoints.length);
        return;
      }

      if (faceIndex < 3) {
        // Log first 3 faces for debugging
        // console.log(`Drawing face ${face.id}:`, {
        //     vertexPoints: face.vertexPoints,
        //     transform: transform,
        //     scaledPoints: face.vertexPoints.map(p => ({
        //         x: p.x * transform.scale + transform.offsetX,
        //         y: -p.y * transform.scale + transform.offsetY
        //     }))
        // });
      }

      ctx.beginPath();
      const startPoint = face.vertexPoints[0];
      ctx.moveTo(
        startPoint.x * transform.scale + transform.offsetX,
        -startPoint.y * transform.scale + transform.offsetY
      );
      for (let i = 1; i < face.vertexPoints.length; i++) {
        const p = face.vertexPoints[i];
        ctx.lineTo(
          p.x * transform.scale + transform.offsetX,
          -p.y * transform.scale + transform.offsetY
        );
      }
      ctx.closePath();

      const isSelected = xmlUISelection.some((item) => item.faceId === face.id);
      const isHovered = hoveredIds.includes(face.id);

      // Measurement Mode
      if (isSelected && isHovered) {
        // Hovering over a selected face: signify removal
        ctx.fillStyle = hexToRgba(VIEW_COLORS.hoverRemove, 0.6);
        ctx.strokeStyle = VIEW_COLORS.hoverRemove;
        ctx.lineWidth = 2;
      } else if (isSelected) {
        ctx.fillStyle = hexToRgba(VIEW_COLORS.selected, 0.6);
        ctx.strokeStyle = hexToRgba(VIEW_COLORS.selected, 0.9);
        ctx.lineWidth = 2;
      } else if (isHovered) {
        // Hovering over an unselected face: signify addition
        ctx.fillStyle = hexToRgba(VIEW_COLORS.hoverAdd, 0.6);
        ctx.strokeStyle = VIEW_COLORS.hoverAdd;
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = hexToRgba(VIEW_COLORS.unselected, 0.3);
        ctx.strokeStyle = hexToRgba(VIEW_COLORS.unselected, 0.5);
        ctx.lineWidth = 0.5;
      }
      ctx.fill();
      if (ctx.lineWidth > 0) ctx.stroke();
      faceIndex++;
    });

    reportData.linesMap.forEach((line) => {
      const p1 = reportData.pointsMap.get(line.point1Id);
      const p2 = reportData.pointsMap.get(line.point2Id);
      if (!p1 || !p2) return;

      const associatedFaceIds = reportData.lineToFacesMap.get(line.id) || [];
      const isSelectedLine = associatedFaceIds.some((faceId) =>
        xmlUISelection.some((item) => item.faceId === faceId)
      );

      const style =
        LINE_TYPE_MAP[line.type.toUpperCase()] || DEFAULT_LINE_STYLE;
      ctx.strokeStyle = style.color;

      ctx.globalAlpha = 1;
      if (
        highlightedLineType &&
        line.type.toUpperCase() !== highlightedLineType
      ) {
        ctx.globalAlpha = 0.3;
      }

      ctx.lineDashOffset = 0;

      if (isSelectedLine) {
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
      } else {
        const isHighlighted = line.type.toUpperCase() === highlightedLineType;
        ctx.lineWidth = isHighlighted ? 4 : 1.5;
        ctx.setLineDash(isHighlighted ? [] : [10, 6]);
      }

      ctx.beginPath();
      ctx.moveTo(
        p1.x * transform.scale + transform.offsetX,
        -p1.y * transform.scale + transform.offsetY
      );
      ctx.lineTo(
        p2.x * transform.scale + transform.offsetX,
        -p2.y * transform.scale + transform.offsetY
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    ctx.setLineDash([]); // Reset for label drawing
    ctx.lineDashOffset = 0; // Also reset offset
    ctx.fillStyle = "#333333";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelThresholdScale = Math.min(canvas.width, canvas.height) / 1000;
    reportData.facesMap.forEach((face) => {
      if (face.label && face.vertexPoints.length > 0 && face.centroid) {
        if (transform.scale > labelThresholdScale * 0.5) {
          // Adjusted threshold
          ctx.fillText(
            face.label,
            face.centroid.x * transform.scale + transform.offsetX,
            -face.centroid.y * transform.scale + transform.offsetY
          );
        }
      }
    });
  }, [reportData, canvasSize, xmlUISelection, highlightedLineType]);

  // Animation Loop
  useEffect(() => {
    drawScene();
  }, [revision, drawScene]);

  // --- Interaction Handlers ---
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasRef.current || disambiguationChoices.length > 0) return; // Don't pan if popup is open
      isPanningRef.current = true;
      const rect = canvasRef.current.getBoundingClientRect();
      panStartCoords.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      panStartTransform.current = {
        offsetX: transformRef.current.offsetX,
        offsetY: transformRef.current.offsetY,
      };
      (event.currentTarget as HTMLDivElement).style.cursor = "grabbing";
    },
    [disambiguationChoices.length]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasRef.current) return;
      const transform = transformRef.current;

      if (isPanningRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentMouseX = event.clientX - rect.left;
        const currentMouseY = event.clientY - rect.top;
        const dx = currentMouseX - panStartCoords.current.x;
        const dy = currentMouseY - panStartCoords.current.y;
        transformRef.current = {
          ...transform,
          offsetX: panStartTransform.current.offsetX + dx,
          offsetY: panStartTransform.current.offsetY + dy,
        };
        requestRedraw();
        setHoveredFaceIds([]); // Disable hover when panning
        hoveredFaceIdsRef.current = [];
      } else if (reportData && disambiguationChoices.length === 0) {
        // Hover logic
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const dataX = (mouseX - transform.offsetX) / transform.scale;
        const dataY = (mouseY - transform.offsetY) / -transform.scale;

        const candidates: Face[] = [];
        reportData.facesMap.forEach((face) => {
          if (
            face.vertexPoints.length >= 3 &&
            isPointInPolygon({ x: dataX, y: dataY }, face.vertexPoints)
          ) {
            candidates.push(face);
          }
        });

        if (candidates.length > 0) {
          candidates.sort((a, b) => (a.area || 0) - (b.area || 0));
          const newHoveredIds = candidates.map((f) => f.id);
          setHoveredFaceIds(newHoveredIds);
          hoveredFaceIdsRef.current = newHoveredIds;
          requestRedraw();
          setTooltipPosition({ x: event.clientX, y: event.clientY });
        } else {
          setHoveredFaceIds([]);
          hoveredFaceIdsRef.current = [];
          requestRedraw();
        }
      }
    },
    [reportData, disambiguationChoices.length]
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasRef.current || !reportData) {
        isPanningRef.current = false;
        (event.currentTarget as HTMLDivElement).style.cursor = "grab";
        return;
      }
      const transform = transformRef.current;

      const rect = canvasRef.current.getBoundingClientRect();
      const finalMouseX = event.clientX - rect.left;
      const finalMouseY = event.clientY - rect.top;
      const dx = Math.abs(finalMouseX - panStartCoords.current.x);
      const dy = Math.abs(finalMouseY - panStartCoords.current.y);

      const wasClick = dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD;

      if (isPanningRef.current && wasClick && !disambiguationChoices.length) {
        // Process as click
        if (transform.scale === 0) return;
        const dataX = (finalMouseX - transform.offsetX) / transform.scale;
        const dataY = (finalMouseY - transform.offsetY) / -transform.scale;

        const candidates: Face[] = [];
        reportData.facesMap.forEach((face) => {
          if (
            face.vertexPoints.length >= 3 &&
            isPointInPolygon({ x: dataX, y: dataY }, face.vertexPoints)
          ) {
            candidates.push(face);
          }
        });

        if (candidates.length === 1) {
          const clickedFaceId = candidates[0].id;
          const isCurrentlySelected = xmlUISelection.some(
            (item) => item.faceId === clickedFaceId
          );
          let newSelection: FaceSelectionItem[];

          if (isCurrentlySelected) {
            newSelection = removeFaceFromSelection(
              xmlUISelection,
              clickedFaceId
            );
          } else {
            newSelection = addFaceToSelection(
              xmlUISelection,
              clickedFaceId,
              reportData
            );
          }

          setXmlUISelection(newSelection);
          const selectedFaceIds = getSelectedFaceIds(newSelection);
          onSelectionChange(
            calculateSelectionSummary(selectedFaceIds, reportData),
            newSelection
          );
          setIsAllSelected(
            reportData.facesMap.size > 0 &&
              selectedFaceIds.size === reportData.facesMap.size
          );
          requestRedraw();
          setDisambiguationChoices([]);
        } else if (candidates.length > 1) {
          // Sort by area (smallest first) or label if needed
          candidates.sort((a, b) => (a.area || 0) - (b.area || 0));
          setDisambiguationChoices(
            candidates.map((f) => ({ id: f.id, label: f.label }))
          );
          setDisambiguationPosition({ x: event.clientX, y: event.clientY });
          setHoveredFaceIds([]); // Clear hover when disambiguation opens
        } else {
          setDisambiguationChoices([]); // No face clicked
        }
      }

      isPanningRef.current = false;
      (event.currentTarget as HTMLDivElement).style.cursor = "grab";
    },
    [
      reportData,
      disambiguationChoices.length,
      onSelectionChange,
      xmlUISelection,
      requestRedraw,
    ]
  );

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        (event.currentTarget as HTMLDivElement).style.cursor = "grab";
      }
      setHoveredFaceIds([]);
      hoveredFaceIdsRef.current = [];
      requestRedraw();
    },
    []
  );

  // --- Zoom Handlers ---
  const zoomAtPoint = useCallback(
    (factor: number, centerX: number, centerY: number) => {
      if (!reportData) return;
      const { scale, offsetX, offsetY } = transformRef.current;

      const dataXAtCenter = (centerX - offsetX) / scale;
      const dataYAtCenter = (centerY - offsetY) / scale;

      const newScale = Math.max(0.01, Math.min(scale * factor, 100));

      const newOffsetX = centerX - dataXAtCenter * newScale;
      const newOffsetY = centerY - dataYAtCenter * newScale;

      transformRef.current = {
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      };
      requestRedraw();
    },
    [reportData]
  );

  const handleZoom = useCallback(
    (factor: number) => {
      if (viewMode === "3D") {
        if (factor > 1) {
          threeDViewerRef.current?.zoomIn();
        } else {
          threeDViewerRef.current?.zoomOut();
        }
        return;
      }

      if (!canvasRef.current || !reportData) return;
      const currentCanvasWidth = canvasSize.width;
      const currentCanvasHeight = canvasSize.height;
      const centerX = currentCanvasWidth / 2;
      const centerY = currentCanvasHeight / 2;
      zoomAtPoint(factor, centerX, centerY);
    },
    [reportData, canvasSize, zoomAtPoint, viewMode]
  );

  const handleResetZoom = useCallback(() => {
    if (viewMode === "3D") {
      threeDViewerRef.current?.reset();
      return;
    }

    if (reportData) {
      transformRef.current = calculateBaseTransform(
        reportData,
        canvasSize.width,
        canvasSize.height
      );
      requestRedraw();
    }
  }, [reportData, canvasSize, calculateBaseTransform, viewMode, requestRedraw]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!reportData || !canvasWrapperRef.current) return;
      event.preventDefault();
      const rect = canvasWrapperRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      if (event.ctrlKey) {
        // Zooming (Ctrl + Wheel or Pinch gesture)
        const zoomAmount = event.deltaY * -0.005;
        const zoomFactor = Math.exp(zoomAmount); // Smoother zoom
        zoomAtPoint(zoomFactor, mouseX, mouseY);
      } else {
        // Panning (Wheel or Trackpad scroll)
        transformRef.current = {
          ...transformRef.current,
          offsetX: transformRef.current.offsetX - event.deltaX,
          offsetY: transformRef.current.offsetY - event.deltaY,
        };
        requestRedraw();
      }
    },
    [reportData, zoomAtPoint]
  );

  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        wrapper.removeEventListener("wheel", handleWheel);
      };
    }
  }, [handleWheel]);

  const handleSelectAll = useCallback(() => {
    if (!reportData || reportData.facesMap.size === 0) return;
    const allFaceIds = new Set(reportData.facesMap.keys());
    const isCurrentlyAllSelected = xmlUISelection.length === allFaceIds.size;

    let newSelection: FaceSelectionItem[];
    if (isCurrentlyAllSelected) {
      newSelection = [];
    } else {
      newSelection = Array.from(allFaceIds).map((faceId) => {
        const faceSummary = calculateSelectionSummary(
          new Set([faceId]),
          reportData
        );
        const faceSelectionItem: FaceSelectionItem = { faceId };
        faceSummary.forEach((item) => {
          faceSelectionItem[`${item.name}_length`] = item.length;
          faceSelectionItem[`${item.name}_color`] = item.color;
        });
        return faceSelectionItem;
      });
    }

    setXmlUISelection(newSelection);
    setIsAllSelected(!isCurrentlyAllSelected);

    const selectedFaceIds = getSelectedFaceIds(newSelection);
    onSelectionChange(
      calculateSelectionSummary(selectedFaceIds, reportData),
      newSelection
    );
    requestRedraw();
  }, [reportData, onSelectionChange, xmlUISelection, requestRedraw]);

  const handleDisambiguationSelect = (faceId: string) => {
    if (!reportData) return;
    const isCurrentlySelected = xmlUISelection.some(
      (item) => item.faceId === faceId
    );
    let newSelection: FaceSelectionItem[];

    if (isCurrentlySelected) {
      newSelection = removeFaceFromSelection(xmlUISelection, faceId);
    } else {
      newSelection = addFaceToSelection(xmlUISelection, faceId, reportData);
    }

    const selectedFaceIds = getSelectedFaceIds(newSelection);
    console.log(calculateSelectionSummary(selectedFaceIds, reportData));
    setXmlUISelection(newSelection);
    onSelectionChange(
      calculateSelectionSummary(selectedFaceIds, reportData),
      newSelection
    );
    setIsAllSelected(
      reportData.facesMap.size > 0 &&
        selectedFaceIds.size === reportData.facesMap.size
    );
    requestRedraw();
    setDisambiguationChoices([]);
    setDisambiguationPosition(null);
  };

  // const handleLegendClick = useCallback(
  //   (type: string) => {
  //     setHighlightedLineType((prev) => (prev === type ? null : type));
  //     requestRedraw();
  //   },
  //   [requestRedraw]
  // );

  // const handleLegendDoubleClick = useCallback(
  //   (type: string) => {
  //     if (!reportData) return;

  //     const faceIdsToSelect = new Set<string>();
  //     const { linesMap, lineToFacesMap } = reportData;

  //     linesMap.forEach((line) => {
  //       if (line.type === type) {
  //         const associatedFaces = lineToFacesMap.get(line.id);
  //         if (associatedFaces) {
  //           associatedFaces.forEach((faceId) => {
  //             faceIdsToSelect.add(faceId);
  //           });
  //         }
  //       }
  //     });

  //     if (faceIdsToSelect.size > 0) {
  //       let newSelection = [...xmlUISelection];
  //       faceIdsToSelect.forEach((faceId) => {
  //         if (!newSelection.some((item) => item.faceId === faceId)) {
  //           newSelection = addFaceToSelection(newSelection, faceId, reportData);
  //         }
  //       });

  //       setXmlUISelection(newSelection);

  //       const selectedFaceIds = getSelectedFaceIds(newSelection);
  //       onSelectionChange(
  //         calculateSelectionSummary(selectedFaceIds, reportData),
  //         newSelection
  //       );
  //       setIsAllSelected(
  //         reportData.facesMap.size > 0 &&
  //           selectedFaceIds.size === reportData.facesMap.size
  //       );
  //       requestRedraw();
  //     }
  //   },
  //   [reportData, onSelectionChange, xmlUISelection, requestRedraw]
  // );

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {error && (
        <div
          className="p-3 mb-4 text-red-700 bg-red-100 border border-red-400 rounded"
          role="alert"
        >
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      <div
        ref={canvasWrapperRef}
        className="relative w-full overflow-hidden border border-gray-300 shadow-inner grow bg-gray-50"
        style={{ cursor: isPanningRef.current ? "grabbing" : "grab" }}
        onMouseDown={viewMode === "2D" ? handleMouseDown : undefined}
        onMouseMove={viewMode === "2D" ? handleMouseMove : undefined}
        onMouseUp={viewMode === "2D" ? handleMouseUp : undefined}
        onMouseLeave={viewMode === "2D" ? handleMouseLeave : undefined}
        role="application"
        aria-label="Interactive roof diagram"
      >
        <div className="absolute z-10 top-2 right-2">
          <div className="flex p-1 space-x-1 bg-white rounded-md shadow">
            <button
              type="button"
              onClick={() => setViewMode("2D")}
              className={`px-3 py-1 text-sm font-semibold rounded ${
                viewMode === "2D"
                  ? "bg-sky-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3D")}
              className={`px-3 py-1 text-sm font-semibold rounded ${
                viewMode === "3D"
                  ? "bg-sky-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              disabled={!reportData}
            >
              3D
            </button>
          </div>
        </div>

        <div className="absolute z-10 bottom-4 right-4">
          <div className="flex flex-col p-1 space-y-1 bg-white rounded-md shadow">
            <button
              type="button"
              onClick={() => handleZoom(1.25)}
              aria-label="Zoom In"
              className="p-2 text-gray-700 rounded-full hover:bg-gray-200"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(0.8)}
              aria-label="Zoom Out"
              className="p-2 text-gray-700 rounded-full hover:bg-gray-200"
            >
              <MinusIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              aria-label="Reset Zoom"
              className="p-2 text-gray-700 rounded-full hover:bg-gray-200"
            >
              <RefreshIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={
                !reportData || reportData.facesMap.size === 0
                  ? undefined
                  : handleSelectAll
              }
              className={`p-2 rounded-full text-gray-700 hover:bg-gray-200 ${
                !reportData || reportData.facesMap.size === 0
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
              aria-label={isAllSelected ? "Deselect All" : "Select All"}
            >
              {isAllSelected ? (
                <CloseIcon className="w-5 h-5" />
              ) : (
                <LatisCheckIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {viewMode === "2D" ? (
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
            aria-hidden="true"
          />
        ) : (
          reportData && (
            <ThreeDViewer
              ref={threeDViewerRef}
              reportData={reportData}
              selectedFaces={getSelectedFaceIds(xmlUISelection)}
              onFaceClick={handleDisambiguationSelect}
              highlightedLineType={highlightedLineType}
            />
          )
        )}
      </div>
      {/* <div className="flex flex-wrap justify-center items-center gap-1.5 mb-3  pt-3 mt-4">
        <span className="mr-2 text-sm font-semibold">Legend:</span>
        {Object.entries(LINE_TYPE_MAP).map(([type, { name, color }]) => {
          const totalLength = reportData?.total2DLengths.get(type) || 0;
          const isSelected = highlightedLineType === type;

          let selectedLength = 0;
          if (reportData && xmlUISelection.length > 0) {
            reportData.linesMap.forEach((line) => {
              if (line.type === type) {
                const associatedFaceIds =
                  reportData.lineToFacesMap.get(line.id) || [];
                const isLineSelected = associatedFaceIds.some((faceId) =>
                  xmlUISelection.some((item) => item.faceId === faceId)
                );
                if (isLineSelected) {
                  const p1 = reportData.pointsMap.get(line.point1Id);
                  const p2 = reportData.pointsMap.get(line.point2Id);
                  if (p1 && p2) {
                    selectedLength += calculateDistance(p1, p2);
                  }
                }
              }
            });
          }

          return (
            <button
              key={type}
              type="button"
              onClick={() => handleLegendClick(type)}
              onDoubleClick={() => handleLegendDoubleClick(type)}
              className={`px-3 py-1.5 text-xs rounded-full border-2 transition-all duration-150 ${
                isSelected ? "ring-2 ring-offset-1 ring-black" : ""
              }`}
              style={{
                backgroundColor: `${color}40`,
                borderColor: color,
              }}
            >
              <div className="flex flex-col items-center">
                <span className="font-medium">{name}</span>
                {totalLength > 0 && (
                  <div className="text-xs opacity-75">
                    <div>Total: {totalLength.toFixed(1)} ft</div>
                    {xmlUISelection.length > 0 && selectedLength > 0 && (
                      <div className="font-semibold text-green-600">
                        Selected: {selectedLength.toFixed(1)} ft
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {xmlUISelection.length > 0 && reportData && (
          <div className="px-3 py-1.5 text-xs rounded-full border-2 bg-blue-50 border-blue-300">
            <div className="flex flex-col items-center">
              <span className="font-medium text-blue-700">Selected Area</span>
              <span className="font-mono text-xs text-blue-600">
                {xmlUISelection
                  .reduce((total, item) => {
                    const face = reportData.facesMap.get(item.faceId);
                    return total + (face?.area || 0);
                  }, 0)
                  .toFixed(1)}{" "}
                sq ft
              </span>
            </div>
          </div>
        )}
      </div> */}

      {disambiguationChoices.length > 0 && disambiguationPosition && (
        <FaceDisambiguationPopup
          choices={disambiguationChoices}
          position={disambiguationPosition}
          onSelect={handleDisambiguationSelect}
          onClose={() => {
            setDisambiguationChoices([]);
            setDisambiguationPosition(null);
          }}
          selectedFaces={xmlUISelection}
        />
      )}
      {hoveredFaceIds.length > 0 &&
        tooltipData.length > 0 &&
        tooltipPosition &&
        disambiguationChoices.length === 0 && (
          <FaceTooltip
            data={tooltipData}
            position={tooltipPosition}
            selectedFaces={getSelectedFaceIds(xmlUISelection)}
          />
        )}
    </div>
  );
};

export default CustomEagleViewSelector;
