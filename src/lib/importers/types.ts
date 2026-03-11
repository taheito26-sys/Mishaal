export type Exchange = "binance" | "bybit" | "okx" | "gate" | "mexc" | "kucoin" | "unknown";

export type NormalizedSide = "buy" | "sell" | "transfer_in" | "transfer_out" | "reward";

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
