import React from "react";

export const HistoryPanel: React.FC<{ history: any[] }> = ({ history }) => (
  <div>
    <h4>Import History</h4>
    <table>
      <thead><tr><th>File</th><th>Exchange</th><th>Imported At</th><th>Parsed</th><th>Accepted</th><th>Rejected</th></tr></thead>
      <tbody>
        {history.map((h) => (
          <tr key={h.id}><td>{h.fileName}</td><td>{h.exchange}</td><td>{new Date(h.importedAt).toLocaleString()}</td><td>{h.stats.parsed}</td><td>{h.stats.accepted}</td><td>{h.stats.rejected}</td></tr>
        ))}
      </tbody>
    </table>
  </div>
);
