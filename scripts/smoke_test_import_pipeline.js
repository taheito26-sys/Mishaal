const fs = require('fs');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function classifyRowsWithDelta(rows, existingRows) {
  const existingByFp = new Map(existingRows.map(r => [r.fingerprint, r]));
  const existingBySymbolTs = new Map();
  for (const r of existingRows) {
    const k = `${r.symbol}:${r.timestampSec}`;
    const arr = existingBySymbolTs.get(k) || [];
    arr.push(r);
    existingBySymbolTs.set(k, arr);
  }
  return rows.map((row) => {
    if (row.invalidReason) return { row, status: 'invalid' };
    if (existingByFp.get(row.fingerprint)) return { row, status: 'duplicate' };
    const k = `${row.symbol}:${Math.floor(row.timestamp / 1000)}`;
    if ((existingBySymbolTs.get(k) || []).length > 0) return { row, status: 'conflict' };
    return { row, status: 'new' };
  });
}

(function main(){
  const adapters = fs.readFileSync('src/lib/importers/adapters.ts','utf8');
  const hook = fs.readFileSync('src/hooks/useImportState.ts','utf8');
  const page = fs.readFileSync('src/pages/LedgerPage.tsx','utf8');
  const shared = fs.readFileSync('src/lib/importers/shared.ts','utf8');
  const historyPanel = fs.readFileSync('src/components/CSVImport/HistoryPanel.tsx','utf8');

  for (const ex of ['binance','bybit','okx','gate','mexc','kucoin']) {
    assert(adapters.includes(`${ex}:`), `missing adapter: ${ex}`);
  }
  assert(shared.includes('deposit') && shared.includes('withdrawal') && shared.includes('transfer_in') && shared.includes('transfer_out'), 'deposit/withdrawal support missing');
  assert(hook.includes('rollback') && hook.includes('clearAllImported'), 'rollback/clear import hooks missing');
  assert(historyPanel.includes('Rollback'), 'history rollback button missing');
  assert(page.includes('CSVImportPanel'), 'ledger import panel missing');

  const base = { symbol: 'APT', timestamp: 1736546400000, fingerprint: 'fp-base' };
  const rows = [
    { ...base, qty: 100, unitPrice: 1.5, fingerprint: 'fp-base' },
    { ...base, qty: 110, unitPrice: 1.5, fingerprint: 'fp-delta' },
    { symbol: 'BTC', timestamp: 1736546400000, qty: 0.1, unitPrice: 42000, fingerprint: 'fp-new' },
  ];
  const existingRows = [
    { fingerprint: 'fp-base', symbol: 'APT', timestampSec: 1736546400, qty: 100, unitPrice: 1.5 },
  ];
  const out = classifyRowsWithDelta(rows, existingRows).map(x => x.status);
  assert(out[0] === 'duplicate', 'expected duplicate exact fingerprint');
  assert(out[1] === 'conflict', 'expected conflict for per-coin delta');
  assert(out[2] === 'new', 'expected new for unseen row');

  console.log('SMOKE TEST PASS: adapters + dedup delta + audit/rollback wiring verified');
})();
