export interface MarketCatalogEntry {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
}

export const MARKET_CATALOG: MarketCatalogEntry[] = [
  { symbol: "RELIANCE", companyName: "Reliance Industries", exchange: "NSE", sector: "Energy" },
  { symbol: "TCS", companyName: "Tata Consultancy Services", exchange: "NSE", sector: "IT Services" },
  { symbol: "HDFCBANK", companyName: "HDFC Bank", exchange: "NSE", sector: "Private Bank" },
  { symbol: "INFY", companyName: "Infosys", exchange: "NSE", sector: "IT Services" },
  { symbol: "ICICIBANK", companyName: "ICICI Bank", exchange: "NSE", sector: "Private Bank" },
  { symbol: "SBIN", companyName: "State Bank of India", exchange: "NSE", sector: "Public Bank" },
  { symbol: "LT", companyName: "Larsen & Toubro", exchange: "NSE", sector: "Capital Goods" },
  { symbol: "BHARTIARTL", companyName: "Bharti Airtel", exchange: "NSE", sector: "Telecom" },
  { symbol: "M&M", companyName: "Mahindra & Mahindra", exchange: "NSE", sector: "Auto" },
  { symbol: "SUNPHARMA", companyName: "Sun Pharmaceutical", exchange: "NSE", sector: "Pharma" },
  { symbol: "AXISBANK", companyName: "Axis Bank", exchange: "NSE", sector: "Private Bank" },
];

export const MARKET_SECTIONS = [
  {
    id: "popular",
    title: "Popular Stocks",
    subtitle: "Liquid names with high retail and institutional attention.",
    symbols: ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK"],
  },
  {
    id: "nifty50",
    title: "Nifty50 Leaders",
    subtitle: "Large-cap names commonly used to read the broad market tone.",
    symbols: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"],
  },
  {
    id: "banking",
    title: "Banking Focus",
    subtitle: "Core banking names worth tracking for sector breadth and liquidity.",
    symbols: ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK"],
  },
  {
    id: "cyclicals",
    title: "Domestic Cyclicals",
    subtitle: "Capital goods, auto, and telecom names with strong market participation.",
    symbols: ["LT", "M&M", "BHARTIARTL"],
  },
  {
    id: "defensive",
    title: "Defensive Mix",
    subtitle: "Stocks traders often compare when leadership broadens unevenly.",
    symbols: ["SUNPHARMA", "TCS", "HDFCBANK"],
  },
] as const;

export const DEFAULT_WATCHLIST_SYMBOLS = ["RELIANCE", "M&M", "ICICIBANK"];

export function getMarketCatalogEntry(symbol: string): MarketCatalogEntry | undefined {
  return MARKET_CATALOG.find((stock) => stock.symbol.toUpperCase() === symbol.toUpperCase());
}

export function getCatalogBySymbols(symbols: string[]): MarketCatalogEntry[] {
  return symbols
    .map((symbol) => getMarketCatalogEntry(symbol))
    .filter((stock): stock is MarketCatalogEntry => Boolean(stock));
}

const WATCHLIST_STORAGE_KEY = "clearframe.market.watchlist";
const WATCHLIST_EVENT_NAME = "clearframe:watchlist-updated";

export function getStoredWatchlistSymbols(): string[] {
  if (typeof window === "undefined") {
    return DEFAULT_WATCHLIST_SYMBOLS;
  }

  const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_WATCHLIST_SYMBOLS;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_WATCHLIST_SYMBOLS;
    }
    return parsed
      .map((value) => String(value).toUpperCase())
      .filter((value, index, all) => value && all.indexOf(value) === index);
  } catch {
    return DEFAULT_WATCHLIST_SYMBOLS;
  }
}

export function saveWatchlistSymbols(symbols: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextSymbols = symbols
    .map((value) => value.toUpperCase())
    .filter((value, index, all) => value && all.indexOf(value) === index);
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(nextSymbols));
  window.dispatchEvent(new CustomEvent(WATCHLIST_EVENT_NAME, { detail: nextSymbols }));
}

export function subscribeToWatchlistChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => listener();
  window.addEventListener(WATCHLIST_EVENT_NAME, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(WATCHLIST_EVENT_NAME, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
