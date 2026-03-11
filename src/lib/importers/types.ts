export type Exchange = "binance" | "bybit" | "okx" | "gate" | "mexc" | "kucoin" | "unknown";

export type NormalizedSide = "buy" | "sell" | "transfer_in" | "transfer_out" | "reward";

export type ImportPreviewStatus = "new" | "duplicate" | "conflict" | "invalid";

export interface NormalizedRow {
  rowIndex: number;
  exchange: Exchange;
  txType: "trade" | "deposit" | "withdrawal" | "reward" | "fee";
  timestamp: number;
  symbol: string;
  side: NormalizedSide;
  qty: number;
  unitPrice: number;
  fee: number;
  feeCurrency?: string;
  sourcePair?: string;
  note?: string;
  fingerprint?: string;
  externalId?: string;
  status: "completed" | "pending" | "failed";
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  warning?: string;
  invalidReason?: string;
}

export interface ParsedImportResult {
  exchange: Exchange;
  confidence: number;
  rows: NormalizedRow[];
  headers: string[];
}

export interface ImportPreviewRow {
  row: NormalizedRow;
  status: ImportPreviewStatus;
  reason?: string;
  matchedTxId?: string;
}

export interface ExistingImportRow {
  txId?: string;
  fingerprint: string;
  symbol: string;
  timestampSec: number;
  qty: number;
  unitPrice: number;
}

export interface ImportAuditRecord {
  id: string;
  fileName: string;
  fileHash?: string;
  exchange: Exchange;
  importedAt: number;
  stats: {
    parsed: number;
    accepted: number;
    duplicates: number;
    conflicts: number;
    invalid: number;
  };
  perSymbolBreakdown?: Record<string, number>;
  canRollback?: boolean;
}
