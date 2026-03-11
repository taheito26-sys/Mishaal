import React from "react";
import { ImportPreviewRow } from "../../lib/importers/types";

export const PreviewPanel: React.FC<{
  preview: ImportPreviewRow[];
  onCommit: (mode: "skip"|"replace") => void;
  onEdit: (key: string, field: string, value: string) => void;
}> = ({ preview, onCommit, onEdit }) => (
  <div>
    <h4>Preview</h4>
    <table>
      <thead><tr><th>Status</th><th>Date</th><th>Type</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Reason</th></tr></thead>
      <tbody>
        {preview.map((p, i) => {
          const key = p.row.externalId || p.row.fingerprint || `${i}`;
          const editable = p.status === "conflict" || p.status === "invalid";
          return (
            <tr key={key}>
              <td>{p.status}</td>
              <td>{new Date(p.row.timestamp).toLocaleString()}</td>
              <td>{p.row.txType}</td>
              <td>{editable ? <input value={p.row.symbol} onChange={(e) => onEdit(key, "symbol", e.target.value)} /> : p.row.symbol}</td>
              <td>{editable ? <input value={p.row.side} onChange={(e) => onEdit(key, "side", e.target.value)} /> : p.row.side}</td>
              <td>{editable ? <input value={String(p.row.qty)} onChange={(e) => onEdit(key, "qty", e.target.value)} /> : p.row.qty}</td>
              <td>{editable ? <input value={String(p.row.unitPrice)} onChange={(e) => onEdit(key, "unitPrice", e.target.value)} /> : p.row.unitPrice}</td>
              <td>{p.reason || ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <button type="button" onClick={() => onCommit("skip")}>Commit (skip conflicts)</button>
    <button type="button" onClick={() => onCommit("replace")}>Commit (replace conflicts)</button>
  </div>
);
