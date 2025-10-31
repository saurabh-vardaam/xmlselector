import React, {
  useMemo,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import { Canvas } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Line as DreiLine } from '@react-three/drei';
import * as THREE from 'three';
import {
  calculateSelectionSummary,
  VIEW_COLORS,
  LINE_TYPE_MAP,
  DEFAULT_LINE_STYLE,
} from './eagleViewUtils';
import type { ReportData, Face } from './eagleViewUtils';
import FaceTooltip from './FaceTooltip';

interface ThreeDViewerProps {
  reportData: ReportData;
  selectedFaces: Set<string>;
  onFaceClick: (faceId: string) => void;
  highlightedLineType: string | null;
}

export interface ThreeDViewerControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

// --- Triangulation for a single face ---
function createFaceGeometry(
  vertices: { x: number; y: number; z: number }[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (vertices.length < 3) return geometry;

  const threeVertices = vertices.map(v => new THREE.Vector3(v.x, v.y, v.z));

  const indices: number[] = [];
  // Simple fan triangulation, assuming convex or simple polygons
  for (let i = 1; i < vertices.length - 1; i++) {
    indices.push(0, i, i + 1);
  }

  geometry.setFromPoints(threeVertices);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// --- A single face mesh component ---
const FaceMesh: React.FC<{
  face: Face;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (isHovering: boolean, event: ThreeEvent<PointerEvent> | null) => void;
}> = ({ face, isSelected, isHovered, onClick, onHover }) => {
  const geometry = useMemo(() => {
    return createFaceGeometry(face.vertexPoints3D);
  }, [face.vertexPoints3D]);

  // Cleanup effect for the geometry to prevent memory leaks
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  let color = isSelected ? VIEW_COLORS.selected : VIEW_COLORS.unselected;
  if (isHovered) {
    color = isSelected ? VIEW_COLORS.hoverRemove : VIEW_COLORS.hoverAdd;
  }

  return (
    <mesh
      geometry={geometry}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={e => {
        e.stopPropagation();
        onHover(true, e);
      }}
      onPointerOut={e => {
        e.stopPropagation();
        onHover(false, null);
      }}
    >
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        transparent={true}
        opacity={0.7}
      />
    </mesh>
  );
};

// --- Main 3D Viewer Component ---
const ThreeDViewer = forwardRef<ThreeDViewerControls, ThreeDViewerProps>(
  ({ reportData, selectedFaces, onFaceClick, highlightedLineType }, ref) => {
    const { facesMap, pointsMap, linesMap, lineToFacesMap } = reportData;
    const controlsRef = useRef<any>(null);

    const [hoveredFaceId, setHoveredFaceId] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [devicePixelRatio, setDevicePixelRatio] = useState(
      typeof window !== 'undefined' ? window.devicePixelRatio : 1
    );

    // Update device pixel ratio on resize/zoom
    useEffect(() => {
      let lastDPR = devicePixelRatio;
      
      const updateDPR = () => {
        const newDPR = window.devicePixelRatio;
        if (newDPR !== lastDPR) {
          lastDPR = newDPR;
          setDevicePixelRatio(newDPR);
        }
      };
      
      // Handle window resize (fires on zoom in most browsers)
      window.addEventListener('resize', updateDPR);
      
      // Use visualViewport API if available for better zoom detection
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateDPR);
      }
      
      // Fallback: Check DPR periodically for zoom changes that don't fire resize
      const intervalId = setInterval(updateDPR, 100);
      
      return () => {
        window.removeEventListener('resize', updateDPR);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', updateDPR);
        }
        clearInterval(intervalId);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (controlsRef.current) {
          controlsRef.current.dollyOut(1.25);
          controlsRef.current.update();
        }
      },
      zoomOut: () => {
        if (controlsRef.current) {
          controlsRef.current.dollyIn(1.25);
          controlsRef.current.update();
        }
      },
      reset: () => {
        if (controlsRef.current) {
          controlsRef.current.object.position.copy(cameraPosition);
          controlsRef.current.target.copy(worldCenter);
          controlsRef.current.update();
        }
      },
    }));

    const tooltipData = useMemo(() => {
      if (!hoveredFaceId || !reportData) return [];
      const face = reportData.facesMap.get(hoveredFaceId);
      if (!face) return [];

      return [{
        faceId: face.id,
        faceLabel: face.label || `Face ID: ${face.id}`,
        lines: calculateSelectionSummary(new Set([face.id]), reportData),
      }];
    }, [hoveredFaceId, reportData]);

    const { worldCenter, modelSize } = useMemo(() => {
      const box = new THREE.Box3();
      pointsMap.forEach(p => {
        box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z || 0));
      });
      const modelCenter = new THREE.Vector3();
      box.getCenter(modelCenter);
      const modelSize = new THREE.Vector3();
      box.getSize(modelSize);

      // After group rotation={[-Math.PI / 2, 0, 0]}, model(x,y,z) -> world(x,z,-y)
      const worldCenter = new THREE.Vector3(
        modelCenter.x,
        modelCenter.z,
        -modelCenter.y
      );

      return { worldCenter, modelSize };
    }, [pointsMap]);

    const cameraPosition = useMemo(() => {
      const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
      const fov = 50;
      const cameraDist = maxDim / (2 * Math.tan((fov * Math.PI) / 360));

      // Position the camera "above" the roof (positive Y in world space)
      // and pull it back a bit further for a good overview.
      return new THREE.Vector3(
        worldCenter.x,
        worldCenter.y + cameraDist * 2.5,
        worldCenter.z
      );
    }, [worldCenter, modelSize]);

    const lineMeshes = useMemo(() => {
      return Array.from(linesMap.values()).map(line => {
        const p1 = pointsMap.get(line.point1Id);
        const p2 = pointsMap.get(line.point2Id);
        if (!p1 || !p2) return null;

        const associatedFaceIds = lineToFacesMap.get(line.id) || [];
        const isSelectedLine = associatedFaceIds.some(faceId =>
          selectedFaces.has(faceId)
        );
        const isHighlighted =
          line.type.toUpperCase() === highlightedLineType?.toUpperCase();
        const style =
          LINE_TYPE_MAP[line.type.toUpperCase()] || DEFAULT_LINE_STYLE;

        let lineWidth, dashed;
        if (isSelectedLine) {
          lineWidth = 3;
          dashed = false;
        } else {
          lineWidth = isHighlighted ? 4 : 3;
          dashed = !isHighlighted;
        }

        const lineColor =
          highlightedLineType && !isHighlighted
            ? VIEW_COLORS.unselected
            : style.color;

        return (
          <DreiLine
            key={line.id}
            points={[
              new THREE.Vector3(p1.x, p1.y, p1.z || 0),
              new THREE.Vector3(p2.x, p2.y, p2.z || 0),
            ]}
            color={lineColor}
            lineWidth={lineWidth}
            dashed={dashed}
            dashScale={10}
            gapSize={6}
          />
        );
      });
    }, [
      linesMap,
      pointsMap,
      lineToFacesMap,
      selectedFaces,
      highlightedLineType,
    ]);

    return (
      <>
        <Canvas 
          camera={{ position: cameraPosition.toArray(), fov: 50 }}
          dpr={Math.max(1, devicePixelRatio)}
        >
          <ambientLight intensity={0.7} />
          <pointLight
            position={[
              worldCenter.x,
              worldCenter.y + modelSize.z * 2,
              worldCenter.z,
            ]}
            intensity={0.8}
          />
          <directionalLight
            position={[
              worldCenter.x - modelSize.x,
              worldCenter.y + modelSize.z,
              worldCenter.z,
            ]}
            intensity={0.5}
          />

          <group rotation={[-Math.PI / 2, 0, 0]}>
            {Array.from(facesMap.values()).map(face => (
              <FaceMesh
                key={face.id}
                face={face}
                isSelected={selectedFaces.has(face.id)}
                isHovered={hoveredFaceId === face.id}
                onClick={() => onFaceClick(face.id)}
                onHover={(isHovering, event) => {
                  if (isHovering && event) {
                    setHoveredFaceId(face.id);
                    setTooltipPosition({ x: event.clientX, y: event.clientY });
                  } else {
                    setHoveredFaceId(null);
                    setTooltipPosition(null);
                  }
                }}
              />
            ))}
            {lineMeshes}
          </group>

          <OrbitControls ref={controlsRef} target={worldCenter} />
        </Canvas>
        {hoveredFaceId && tooltipData.length > 0 && tooltipPosition && (
          <FaceTooltip
            data={tooltipData}
            position={tooltipPosition}
            selectedFaces={selectedFaces}
          />
        )}
      </>
    );
  }
);

export default ThreeDViewer; 