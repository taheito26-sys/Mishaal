import React from "react";
import { UploadPanel } from "./UploadPanel";
import { PreviewPanel } from "./PreviewPanel";
import { HistoryPanel } from "./HistoryPanel";

export const CSVImportPanel: React.FC<{
  state: any;
  onUpload: (f: File) => void;
  onCommit: (mode: "skip"|"replace") => void;
}> = ({ state, onUpload, onCommit }) => (
  <div>
    <UploadPanel onFile={onUpload} detectedExchange={state.detectedExchange} confidence={state.confidence} />
    {state.preview?.length ? <PreviewPanel preview={state.preview} onCommit={onCommit} /> : null}
    <HistoryPanel history={state.history || []} />
  </div>
);
