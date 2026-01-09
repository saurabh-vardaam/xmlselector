import { useState, useEffect, useRef } from "react";
import CustomEagleViewSelector from "./Components/CustomEagleViewSelector";
import { calculateSelectionSummary, parseEagleViewXML } from "./Components/eagleViewUtils";
import type {
  ReportData,
  SelectionSummaryItem,
} from "./Components/eagleViewUtils";

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        flutterChannel?: {
          postMessage: (message: any) => void;
        };
      };
    };
  }
}

interface FaceSelectionItem {
  faceId: string;
  faceLabel?: string;
  [key: string]: any;
}
import "./App.css";

function App() {
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [xmlUISelection, setXmlUISelection] = useState<FaceSelectionItem[]>([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [error, setError] = useState<string>("");
  const hasInitializedSelection = useRef<boolean>(false);
  const sendDataToFlutter = (data: any) => {
    if (
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.flutterChannel
    ) {
      window.webkit.messageHandlers.flutterChannel.postMessage({
        type: "react_data",
        data: data,
        timestamp: Date.now(),
      });
      console.log("📤 Data sent to Flutter:", data);
    } else {
      console.log("⚠️ Not running in Flutter WebView, data not sent:", data);
    }
  };

  useEffect(() => {
    (window as any).reactApp = {
      receiveData: (data: any) => {
        console.log("📥 Received data from Flutter:", data);
        if (data.xmlContent) {
          setXmlContent(data.xmlContent);
          setError("");
        }
      },
    };

    return () => {
      delete (window as any).reactApp;
    };
  }, []);

  const handleSelectionChange = (summary: SelectionSummaryItem[]) => {
    const selectionData = {
      key:'saurabh & nikesh doing',
      selectedFaces: xmlUISelection.map(item => {
        const faceId = item.faceId;
        const face = reportData?.facesMap.get(faceId);
        const faceSummary = reportData
          ? calculateSelectionSummary(new Set([faceId]), reportData)
          : [];
        return { 
          faceSummary: faceSummary, 
          faceId: faceId, 
          faceLabel: item.faceLabel || face?.label,
          pitch: face?.pitch 
        }
      }),
      totalArea: xmlUISelection.reduce((total, item) => {
        const face = reportData?.facesMap.get(item.faceId);
        return total + (face?.area || 0);
      }, 0),
      lineSummary: summary,
      timestamp: new Date().toISOString()
    };
    sendDataToFlutter(selectionData);
  };

  useEffect(() => {
    if (xmlContent) {
      const parsedData = parseEagleViewXML(xmlContent);
      if (parsedData) {
        setReportData(parsedData);
        setError("");
        console.log("XML parsed successfully:", {
          points: parsedData.pointsMap.size,
          lines: parsedData.linesMap.size,
          faces: parsedData.facesMap.size,
          boundingBox: parsedData.boundingBox,
        });
      } else {
        setError("Failed to parse XML file. Please check the file format.");
        setReportData(null);
        console.error("XML parsing failed");
      }
    } else {
      setReportData(null);
    }
  }, [xmlContent]);


  useEffect(() => {
    if (reportData && reportData.facesMap.size > 0 && !hasInitializedSelection.current) {
      hasInitializedSelection.current = true;
      const allFaceIds = Array.from(reportData.facesMap.keys()).map(faceId => {
        const face = reportData.facesMap.get(faceId);
        return { 
          faceId: faceId,
          faceLabel: face?.label 
        };
      });
      setXmlUISelection(allFaceIds);
      setIsAllSelected(true);

      const allFaceIdsSet = new Set(reportData.facesMap.keys());
      const summary = calculateSelectionSummary(allFaceIdsSet, reportData);

      const selectionData = {
        selectedFaces: allFaceIds.map(item => {
          const faceId = item.faceId;
          const face = reportData.facesMap.get(faceId);
          const faceSummary = calculateSelectionSummary(new Set([faceId]), reportData);
          return {
            faceSummary: faceSummary,
            faceId: faceId,
            faceLabel: item.faceLabel || face?.label,
            pitch: face?.pitch
          };
        }),
        totalArea: allFaceIds.reduce((total, item) => {
          const face = reportData.facesMap.get(item.faceId);
          return total + (face?.area || 0);
        }, 0),
        lineSummary: summary,
        timestamp: new Date().toISOString()
      };
      sendDataToFlutter(selectionData);
    }

    if (!reportData) {
      hasInitializedSelection.current = false;
    }
  }, [reportData]);

  return (
    <div className="min-h-screen bg-gray-100">
      {xmlContent ? (
        <CustomEagleViewSelector
          xmlContent={xmlContent}
          onSelectionChange={handleSelectionChange}
          xmlUISelection={xmlUISelection}
          setXmlUISelection={setXmlUISelection}
          reportData={reportData}
          setReportData={setReportData}
          isAllSelected={isAllSelected}
          setIsAllSelected={setIsAllSelected}
          error={error}
        />
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="p-12 text-center bg-white rounded-lg shadow-lg">
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No XML file selected
            </h3>
            <p className="text-gray-500">
              Please Select XML file to select faces in 2D or 3D view
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
