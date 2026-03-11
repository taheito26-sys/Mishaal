import React from "react";

export const UploadPanel: React.FC<{ onFile: (file: File) => void; detectedExchange: string | null; confidence: number }> = ({ onFile, detectedExchange, confidence }) => (
  <div>
    <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    <div>Detected: {detectedExchange || "-"} ({confidence.toFixed(2)})</div>
  </div>
);
