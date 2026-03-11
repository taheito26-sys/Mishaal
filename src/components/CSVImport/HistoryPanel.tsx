import React from "react";
import { ImportAuditRecord } from "../../lib/importers/types";

export const HistoryPanel: React.FC<{ history: ImportAuditRecord[]; onRollback: (id: string) => void; onRefresh: () => void }> = ({ history, onRollback, onRefresh }) => (
  <div>
    <h4>Import History</h4>
    <button type="button" onClick={onRefresh}>Refresh History</button>
    <table>
      <thead><tr><th>File</th><th>Exchange</th><th>Imported At</th><th>Parsed</th><th>Accepted</th><th>Dup</th><th>Conflict</th><th>Invalid</th><th>Rollback</th></tr></thead>
      <tbody>
        {history.map((h) => (
          <tr key={h.id}>
            <td>{h.fileName}</td><td>{h.exchange}</td><td>{new Date(h.importedAt).toLocaleString()}</td>
            <td>{h.stats.parsed}</td><td>{h.stats.accepted}</td><td>{h.stats.duplicates}</td><td>{h.stats.conflicts}</td><td>{h.stats.invalid}</td>
            <td>{h.canRollback === false ? "N/A" : <button type="button" onClick={() => onRollback(h.id)}>Rollback</button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
