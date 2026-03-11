import { ParsedImportResult, NormalizedRow, Exchange } from "./types";
import { basicValidate, externalId, guessTxType, normalizeSymbol, parseCSV, rowFingerprint, sideFromTxTypeOrRaw, toTs } from "./shared";

function get(cols: string[], headers: string[], keys: string[]): string {
  const idx = headers.findIndex(h => keys.some(k => h.toLowerCase() === k.toLowerCase()));
  return idx >= 0 ? (cols[idx] ?? "") : "";
}

function parseRows(text: string, exchange: Exchange, map: (c: string[], h: string[], i: number) => NormalizedRow): ParsedImportResult {
  const { headers, rows } = parseCSV(text);
  const out = rows.map((c, i) => {
    const r = map(c, headers, i + 1);
    r.fingerprint = rowFingerprint(r);
    r.externalId = externalId(r);
    r.invalidReason = basicValidate(r) || r.invalidReason;
    return r;
  });
  return { exchange, confidence: 1, rows: out, headers };
}

function mapGeneric(
  exchange: Exchange,
  c: string[],
  h: string[],
  i: number,
  keys: {
    pair: string[];
    side: string[];
    type?: string[];
    time: string[];
    qty: string[];
    price: string[];
    fee: string[];
    feeCoin: string[];
  },
): NormalizedRow {
  const pair = get(c, h, keys.pair);
  const rawSide = get(c, h, keys.side);
  const txType = guessTxType(get(c, h, keys.type || []) || rawSide);
  const side = sideFromTxTypeOrRaw(txType, rawSide);
  return {
    rowIndex: i,
    exchange,
    txType,
    timestamp: toTs(get(c, h, keys.time)),
    symbol: normalizeSymbol(pair),
    side,
    qty: Number(get(c, h, keys.qty)) || 0,
    unitPrice: Number(get(c, h, keys.price)) || 0,
    fee: Number(get(c, h, keys.fee)) || 0,
    feeCurrency: get(c, h, keys.feeCoin),
    sourcePair: pair,
    status: "completed",
  };
}

export const adapters: Record<string, (text: string) => ParsedImportResult> = {
  binance: (text) => parseRows(text, "binance", (c, h, i) => mapGeneric("binance", c, h, i, {
    pair: ["Pair", "Market", "Symbol"],
    side: ["Side"],
    type: ["Type"],
    time: ["Date(UTC)", "Time"],
    qty: ["Executed", "Amount", "Qty"],
    price: ["Price"],
    fee: ["Fee"],
    feeCoin: ["Fee Coin", "Fee Asset"],
  })),
  bybit: (text) => parseRows(text, "bybit", (c, h, i) => mapGeneric("bybit", c, h, i, {
    pair: ["Symbol"], side: ["Side"], type: ["Type", "Exec Type"], time: ["TradeTime", "Trading Time"],
    qty: ["ExecQty", "Filled", "Amount"], price: ["TradePrice", "Avg. Filled Price", "Price"], fee: ["ExecFee", "Fee"], feeCoin: ["FeeAsset", "Fee Asset"],
  })),
  okx: (text) => parseRows(text, "okx", (c, h, i) => mapGeneric("okx", c, h, i, {
    pair: ["Instrument ID", "instrument id", "instId"], side: ["Side", "side"], type: ["Type", "type"], time: ["Fill time", "fill time", "Time"],
    qty: ["Fill size", "fill size", "size"], price: ["Fill price", "fill price", "price"], fee: ["Fee", "fee"], feeCoin: ["Fee currency", "fee currency", "ccy"],
  })),
  gate: (text) => parseRows(text, "gate", (c, h, i) => mapGeneric("gate", c, h, i, {
    pair: ["pair", "Pair"], side: ["Side", "side", "Type"], type: ["Type", "Action"], time: ["Time", "time"],
    qty: ["Amount", "amount"], price: ["Order Price", "Price", "order price"], fee: ["Fee", "fee"], feeCoin: ["Fee Coin", "fee coin"],
  })),
  mexc: (text) => parseRows(text, "mexc", (c, h, i) => mapGeneric("mexc", c, h, i, {
    pair: ["Pair", "Symbol"], side: ["Side"], type: ["Type"], time: ["Date", "Time"], qty: ["Amount", "Qty"],
    price: ["Price"], fee: ["Fee"], feeCoin: ["Fee Coin", "Fee Asset"],
  })),
  kucoin: (text) => parseRows(text, "kucoin", (c, h, i) => mapGeneric("kucoin", c, h, i, {
    pair: ["symbol", "Symbol"], side: ["side", "Side"], type: ["type", "Type"], time: ["tradeCreatedAt", "createdAt", "Time"],
    qty: ["amount", "Amount"], price: ["dealPrice", "Price"], fee: ["fee", "Fee"], feeCoin: ["feeCurrency", "Fee Currency"],
  })),
};
