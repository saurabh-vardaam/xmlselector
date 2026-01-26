import { useState, useEffect, useRef } from "react";
import CustomEagleViewSelector from "./Components/CustomEagleViewSelector";
import {
  calculateSelectionSummary,
  parseEagleViewXML,
} from "./Components/eagleViewUtils";
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
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleSelectionChange = (summary: SelectionSummaryItem[], currentSelection: FaceSelectionItem[]) => {
    const selectionData = {
      selectedFaces: currentSelection.map((item) => {
        const faceId = item.faceId;
        const face = reportData?.facesMap.get(faceId);
        const faceSummary = reportData
          ? calculateSelectionSummary(new Set([faceId]), reportData)
          : [];
        return {
          faceSummary: faceSummary,
          faceId: faceId,
          faceLabel: item.faceLabel || face?.label,
          pitch: face?.pitch,
          area: face?.area,
        };
      }),
      totalArea: currentSelection.reduce((total, item) => {
        const face = reportData?.facesMap.get(item.faceId);
        return total + (face?.area || 0);
      }, 0),
      lineSummary: summary,
      timestamp: new Date().toISOString(),
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
    if (
      reportData &&
      reportData.facesMap.size > 0 &&
      !hasInitializedSelection.current
    ) {
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
            pitch: face?.pitch,
            area: face?.area,
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


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/xml" && !file.name.endsWith(".xml")) {
      setError("Please select a valid XML file");
      return;
    }

    setFileName(file.name);
    setError("");

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setXmlContent(content);
    };
    reader.onerror = () => {
      setError("Error reading file");
    };
    reader.readAsText(file);
  };

  const handleClearFile = () => {
    setXmlContent(null);
    setFileName("");
    setError("");
    setReportData(null);
    setXmlUISelection(new Set());
    setIsAllSelected(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  return (
    <div className="min-h-screen bg-gray-100">

      <div className="mb-4">
        <label
          htmlFor="xml-file"
          className="block mb-2 text-sm font-medium text-gray-700"
        >
          Upload EagleView XML File
        </label>
        <div className="flex items-center space-x-4">
          <input
            ref={fileInputRef}
            id="xml-file"
            type="file"
            accept=".xml,text/xml"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {xmlContent && (
            <button
              onClick={handleClearFile}
              className="px-4 py-2 text-sm font-medium text-red-700 transition-colors bg-red-100 rounded-md hover:bg-red-200"
            >
              Clear File
            </button>
          )}
        </div>
      </div>

      {fileName && (
        <div className="mb-2 text-sm text-gray-600">
          <span className="font-medium">Loaded file:</span> {fileName}
        </div>
      )}
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
