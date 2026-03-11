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
    <UploadPanel
      onFile={onUpload}
      detectedExchange={state.detectedExchange}
      confidence={state.confidence}
      onClearAllImported={() => state.clearAllImported?.()}
    />
    {state.preview?.length ? (
      <PreviewPanel
        preview={state.preview}
        onCommit={onCommit}
        onEdit={(key, field, value) => state.updatePreviewRow?.(key, { [field]: field === "qty" || field === "unitPrice" ? Number(value) : value })}
      />
    ) : null}
    <HistoryPanel history={state.history || []} onRollback={(id) => state.rollback?.(id)} onRefresh={() => state.refreshHistory?.()} />
    {state.lastAction ? <div>{state.lastAction}</div> : null}
  </div>
);
