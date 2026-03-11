import React from "react";

export const PreviewPanel: React.FC<{ preview: any[]; onCommit: (mode: "skip"|"replace") => void }> = ({ preview, onCommit }) => (
  <div>
    <table>
      <thead><tr><th>Status</th><th>Date</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Reason</th></tr></thead>
      <tbody>
        {preview.map((p, i) => (
          <tr key={`${p.row?.fingerprint || i}`}>
            <td>{p.status}</td>
            <td>{new Date(p.row.timestamp).toLocaleString()}</td>
            <td>{p.row.symbol}</td>
            <td>{p.row.side}</td>
            <td>{p.row.qty}</td>
            <td>{p.row.unitPrice}</td>
            <td>{p.reason || ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <button type="button" onClick={() => onCommit("skip")}>Commit (skip conflicts)</button>
    <button type="button" onClick={() => onCommit("replace")}>Commit (replace conflicts)</button>
  </div>
);
