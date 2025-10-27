import React, { useState, useRef, useEffect } from 'react';
import type { SelectionSummaryItem } from './eagleViewUtils';

const FaceTooltip: React.FC<{
    data: { faceId: string; faceLabel: string; lines: SelectionSummaryItem[] }[];
    position: { x: number; y: number };
    selectedFaces: Set<string>;
  }> = ({ data, position, selectedFaces }) => {
    if (!data.length) return null;
  
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    const tooltipRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      if (tooltipRef.current) {
        const rect = tooltipRef.current.getBoundingClientRect();
        const newPos = { x: position.x, y: position.y };
  
        if (newPos.x + rect.width > window.innerWidth) {
          newPos.x = window.innerWidth - rect.width - 10;
        }
        if (newPos.y + rect.height > window.innerHeight) {
          newPos.y = position.y - rect.height - 10;
        }
        setAdjustedPosition(newPos);
      }
    }, [position, data]);
  
    return (
      <div
        ref={tooltipRef}
        className="fixed bg-white text-gray-800 p-3 rounded-md shadow-xl z-50 pointer-events-none text-sm transition-opacity duration-200 border border-gray-200"
        style={{
          top: `${adjustedPosition.y + 20}px`,
          left: `${adjustedPosition.x}px`,
        }}
      >
        {data.map((faceData, index) => (
          <div
            key={faceData.faceId}
            className={index > 0 ? 'mt-3 pt-3  border-gray-200' : ''}
          >
            <h4
              className={`font-bold mb-2 pb-1 rounded-md py-1 px-2 ${
                selectedFaces.has(faceData.faceId)
                  ? 'bg-green-100 text-green-800'
                  : ''
              }`}
            >
              {faceData.faceLabel}
            </h4>
            <ul className="space-y-1">
              {faceData.lines.map(item => (
                <li key={item.name} className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full mr-2"
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <span>{item.name}:</span>
                  </div>
                  <span className="font-mono ml-4">
                    {`${item.length.toFixed(2)} ${item.unit || 'ft'}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  export default FaceTooltip; 