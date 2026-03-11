import { ParsedImportResult, NormalizedRow, Exchange } from "./types";
import { basicValidate, normalizeSymbol, parseCSV, rowFingerprint, toTs } from "./shared";

function get(cols: string[], headers: string[], keys: string[]): string {
  const idx = headers.findIndex(h => keys.some(k => h.toLowerCase() === k.toLowerCase()));
  return idx >= 0 ? (cols[idx] ?? "") : "";
}

function parseRows(text: string, exchange: Exchange, map: (c: string[], h: string[], i: number) => NormalizedRow): ParsedImportResult {
  const { headers, rows } = parseCSV(text);
  const out = rows.map((c, i) => {
    const r = map(c, headers, i + 1);
    r.fingerprint = rowFingerprint(r);
    r.invalidReason = basicValidate(r) || r.invalidReason;
    return r;
  });
  return { exchange, confidence: 1, rows: out, headers };
}

export const adapters: Record<string, (text: string) => ParsedImportResult> = {
  binance: (text) => parseRows(text, "binance", (c, h, i) => {
    const pair = get(c, h, ["Pair", "Market"]);
    const sideRaw = get(c, h, ["Side", "Type"]).toLowerCase();
    return {
      rowIndex: i, exchange: "binance", txType: "trade", timestamp: toTs(get(c, h, ["Date(UTC)"])),
      symbol: normalizeSymbol(pair), side: sideRaw === "buy" ? "buy" : "sell", qty: Number(get(c,h,["Executed","Amount"])) || 0,
      unitPrice: Number(get(c,h,["Price"])) || 0, fee: Number(get(c,h,["Fee"])) || 0, feeCurrency: get(c,h,["Fee Coin"]), sourcePair: pair,
      status: "completed",
    };
  }),
  bybit: (text) => parseRows(text, "bybit", (c, h, i) => {
    const pair = get(c, h, ["Symbol"]); const sideRaw = get(c,h,["Side"]).toLowerCase();
    return { rowIndex:i, exchange:"bybit", txType:"trade", timestamp:toTs(get(c,h,["TradeTime","Trading Time"])), symbol:normalizeSymbol(pair),
      side: sideRaw==="buy"?"buy":"sell", qty:Number(get(c,h,["ExecQty","Filled"]))||0, unitPrice:Number(get(c,h,["TradePrice","Avg. Filled Price"]))||0,
      fee:Number(get(c,h,["ExecFee","Fee"]))||0, feeCurrency:get(c,h,["FeeAsset","Fee Asset"]), sourcePair:pair, status:"completed" };
  }),
  okx: (text) => parseRows(text, "okx", (c,h,i)=>{
    const pair = get(c,h,["Instrument ID","instrument id"]); const sideRaw=get(c,h,["Side","side"]).toLowerCase();
    return { rowIndex:i, exchange:"okx", txType:"trade", timestamp:toTs(get(c,h,["Fill time","fill time"])), symbol:normalizeSymbol(pair),
      side: sideRaw==="buy"?"buy":"sell", qty:Number(get(c,h,["Fill size","fill size"]))||0, unitPrice:Number(get(c,h,["Fill price","fill price"]))||0,
      fee:Number(get(c,h,["Fee","fee"]))||0, feeCurrency:get(c,h,["Fee currency","fee currency"]), sourcePair:pair, status:"completed" };
  }),
  gate: (text) => parseRows(text, "gate", (c,h,i)=>{
    const pair=get(c,h,["pair","Pair"]); const sideRaw=get(c,h,["Side","side"]).toLowerCase();
    return { rowIndex:i, exchange:"gate", txType:"trade", timestamp:toTs(get(c,h,["Time","time"])), symbol:normalizeSymbol(pair),
      side: sideRaw==="buy"?"buy":"sell", qty:Number(get(c,h,["Amount","amount"]))||0, unitPrice:Number(get(c,h,["Order Price","Price","order price"]))||0,
      fee:Number(get(c,h,["Fee","fee"]))||0, feeCurrency:get(c,h,["Fee Coin","fee coin"]), sourcePair:pair, status:"completed" };
  }),
  mexc: (text) => parseRows(text, "mexc", (c,h,i)=>{
    const pair=get(c,h,["Pair"]); const sideRaw=get(c,h,["Side"]).toLowerCase();
    return { rowIndex:i, exchange:"mexc", txType:"trade", timestamp:toTs(get(c,h,["Date"])), symbol:normalizeSymbol(pair),
      side: sideRaw==="buy"?"buy":"sell", qty:Number(get(c,h,["Amount"]))||0, unitPrice:Number(get(c,h,["Price"]))||0, fee:Number(get(c,h,["Fee"]))||0,
      feeCurrency:get(c,h,["Fee Coin"]), sourcePair:pair, status:"completed" };
  }),
  kucoin: (text) => parseRows(text, "kucoin", (c,h,i)=>{
    const pair=get(c,h,["symbol"]); const sideRaw=get(c,h,["side"]).toLowerCase();
    return { rowIndex:i, exchange:"kucoin", txType:"trade", timestamp:toTs(get(c,h,["tradeCreatedAt"])), symbol:normalizeSymbol(pair),
      side: sideRaw==="buy"?"buy":"sell", qty:Number(get(c,h,["amount"]))||0, unitPrice:Number(get(c,h,["dealPrice"]))||0,
      fee:Number(get(c,h,["fee"]))||0, feeCurrency:get(c,h,["feeCurrency"]), sourcePair:pair, status:"completed" };
  }),
};
