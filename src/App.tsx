import { useState, useRef, useEffect } from "react";
import CustomEagleViewSelector from "./Components/CustomEagleViewSelector";
import { parseEagleViewXML } from "./Components/eagleViewUtils";
import type { ReportData, SelectionSummaryItem } from "./Components/eagleViewUtils";
import "./App.css";

function App() {
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [xmlUISelection, setXmlUISelection] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [error, setError] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to send data to Flutter
  const sendToFlutter = (data: any) => {
    if (window.flutter_inappwebview) {
      window.flutter_inappwebview.callHandler('onSelectionChange', data);
    } else if (window.flutter_webview) {
      window.flutter_webview.postMessage(JSON.stringify(data));
    }
  };

  const handleSelectionChange = (summary: SelectionSummaryItem[]) => {
    console.log("Selection changed:", summary);
    
    // Send data to Flutter
    const selectionData = {
      selectedFaces: Array.from(xmlUISelection),
      totalArea: Array.from(xmlUISelection).reduce((total, faceId) => {
        const face = reportData?.facesMap.get(faceId);
        return total + (face?.area || 0);
      }, 0),
      lineSummary: summary,
      timestamp: new Date().toISOString()
    };
    
    sendToFlutter(selectionData);
  };

  // Parse XML content when it changes
  useEffect(() => {
    if (xmlContent) {
      console.log("Parsing XML content:", xmlContent.substring(0, 200) + "...");
      const parsedData = parseEagleViewXML(xmlContent); 
      if (parsedData) {
        setReportData(parsedData);
        setError("");
        console.log("XML parsed successfully:", {
          points: parsedData.pointsMap.size,
          lines: parsedData.linesMap.size,
          faces: parsedData.facesMap.size,
          boundingBox: parsedData.boundingBox
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/xml" && !file.name.endsWith('.xml')) {
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
    <div className="min-h-screen p-4 bg-gray-100">
      <div className="max-w-6xl mx-auto">
        <h1 className="mb-6 text-3xl font-bold text-center text-gray-800">
          EagleView XML Selector
        </h1>
        
        {/* File Upload Section */}
        <div className="p-6 mb-6 bg-white rounded-lg shadow-lg">
          <div className="mb-4">
            <label htmlFor="xml-file" className="block mb-2 text-sm font-medium text-gray-700">
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
          
          {error && (
            <div className="p-3 text-sm text-red-600 rounded-md bg-red-50">
              {error}
            </div>
          )}
        </div>

        {/* EagleView Selector */}
        {xmlContent ? (
          <div className="p-6 bg-white rounded-lg shadow-lg">
            {!reportData && !error && (
              <div className="py-8 text-center">
                <div className="w-8 h-8 mx-auto mb-4 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-600">Parsing XML data...</p>
              </div>
            )}
            {reportData && (
              <div className="p-3 mb-4 border border-green-200 rounded-md bg-green-50">
                <p className="text-sm text-green-800">
                  ✓ XML parsed successfully! Found {reportData.facesMap.size} faces, {reportData.linesMap.size} lines, and {reportData.pointsMap.size} points.
                </p>
              </div>
            )}
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
          </div>
        ) : (
          <div className="p-12 text-center bg-white rounded-lg shadow-lg">
            <div className="mb-4 text-gray-400">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">No XML file loaded</h3>
            <p className="text-gray-500">Please upload an EagleView XML file to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
