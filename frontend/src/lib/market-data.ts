export interface MarketInsight {
  title: string;
  description: string;
}

export interface StockCatalyst {
  label: string;
  detail: string;
}

export interface MarketStock {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  price: number;
  changePercent: number;
  changeValue: number;
  marketCapLabel: string;
  peRatio: number;
  aiScore: number;
  sentiment: "Bullish" | "Neutral" | "Cautious";
  riskLevel: "Low" | "Medium" | "High";
  dayRange: [number, number];
  support: number;
  resistance: number;
  volumeLabel: string;
  theme: string;
  thesis: string;
  insights: MarketInsight[];
  catalysts: StockCatalyst[];
  history: {
    "1D": number[];
    "1W": number[];
    "1M": number[];
    "1Y": number[];
  };
}

export interface MarketIndexSnapshot {
  label: string;
  value: number;
  changePercent: number;
  breadth: string;
}

function buildHistory(anchor: number, points: number, drift: number, swing: number): number[] {
  return Array.from({ length: points }, (_, index) => {
    const progress = index / Math.max(points - 1, 1);
    const wave = Math.sin(progress * Math.PI * 2.2) * swing;
    const trend = drift * progress;
    return Number((anchor * (1 + trend + wave)).toFixed(2));
  });
}

function createStock(
  base: Omit<MarketStock, "history"> & {
    drift: { "1D": number; "1W": number; "1M": number; "1Y": number };
    swing: { "1D": number; "1W": number; "1M": number; "1Y": number };
  },
): MarketStock {
  return {
    ...base,
    history: {
      "1D": buildHistory(base.price * 0.985, 24, base.drift["1D"], base.swing["1D"]),
      "1W": buildHistory(base.price * 0.96, 28, base.drift["1W"], base.swing["1W"]),
      "1M": buildHistory(base.price * 0.91, 30, base.drift["1M"], base.swing["1M"]),
      "1Y": buildHistory(base.price * 0.76, 36, base.drift["1Y"], base.swing["1Y"]),
    },
  };
}

export const MARKET_STOCKS: MarketStock[] = [
  createStock({
    symbol: "RELIANCE",
    companyName: "Reliance Industries",
    exchange: "NSE",
    sector: "Energy",
    price: 2962.1,
    changePercent: 1.38,
    changeValue: 40.35,
    marketCapLabel: "₹20.1L Cr",
    peRatio: 28.4,
    aiScore: 84,
    sentiment: "Bullish",
    riskLevel: "Medium",
    dayRange: [2921.4, 2978.6],
    support: 2894,
    resistance: 3015,
    volumeLabel: "1.2x 20D avg",
    theme: "Refining margin recovery",
    thesis: "AI signals show improving cash-flow resilience and stronger energy-to-retail diversification.",
    insights: [
      { title: "AI takeaway", description: "Margin stability is improving faster than peer averages." },
      { title: "What to watch", description: "Retail and telecom updates remain the main narrative drivers this quarter." },
    ],
    catalysts: [
      { label: "Earnings quality", detail: "Street focus remains on cash generation rather than top-line expansion." },
      { label: "Sector setup", detail: "Energy complex remains constructive with moderate input-cost pressure." },
    ],
    drift: { "1D": 0.015, "1W": 0.024, "1M": 0.06, "1Y": 0.21 },
    swing: { "1D": 0.006, "1W": 0.012, "1M": 0.03, "1Y": 0.08 },
  }),
  createStock({
    symbol: "TCS",
    companyName: "Tata Consultancy Services",
    exchange: "NSE",
    sector: "IT Services",
    price: 4018.25,
    changePercent: 0.72,
    changeValue: 28.55,
    marketCapLabel: "₹14.5L Cr",
    peRatio: 31.1,
    aiScore: 79,
    sentiment: "Bullish",
    riskLevel: "Low",
    dayRange: [3986.2, 4039.7],
    support: 3940,
    resistance: 4075,
    volumeLabel: "0.9x 20D avg",
    theme: "Large-cap IT stability",
    thesis: "Defensive quality and operating consistency keep TCS attractive during risk-off market phases.",
    insights: [
      { title: "AI takeaway", description: "Revenue visibility remains steadier than most large-cap peers." },
      { title: "What to watch", description: "Commentary on enterprise demand and margin protection will drive sentiment." },
    ],
    catalysts: [
      { label: "Deal pipeline", detail: "Investors are looking for signs of stronger conversion in BFSI demand." },
      { label: "Margin discipline", detail: "Stable hiring intensity is supporting operating leverage." },
    ],
    drift: { "1D": 0.008, "1W": 0.019, "1M": 0.041, "1Y": 0.16 },
    swing: { "1D": 0.004, "1W": 0.009, "1M": 0.02, "1Y": 0.06 },
  }),
  createStock({
    symbol: "HDFCBANK",
    companyName: "HDFC Bank",
    exchange: "NSE",
    sector: "Private Bank",
    price: 1678.8,
    changePercent: 0.94,
    changeValue: 15.55,
    marketCapLabel: "₹12.8L Cr",
    peRatio: 19.5,
    aiScore: 81,
    sentiment: "Bullish",
    riskLevel: "Low",
    dayRange: [1659.1, 1684.2],
    support: 1648,
    resistance: 1702,
    volumeLabel: "1.1x 20D avg",
    theme: "Deposit franchise strength",
    thesis: "Credit growth remains healthy while AI scoring shows improving balance between growth and funding costs.",
    insights: [
      { title: "AI takeaway", description: "Funding-cost pressure appears to be easing versus the prior quarter." },
      { title: "What to watch", description: "Retail loan mix and CASA traction remain central to the narrative." },
    ],
    catalysts: [
      { label: "Credit quality", detail: "Asset quality remains supportive for premium valuation retention." },
      { label: "Banking breadth", detail: "Strong index weight means it often shapes sector sentiment." },
    ],
    drift: { "1D": 0.01, "1W": 0.018, "1M": 0.046, "1Y": 0.14 },
    swing: { "1D": 0.004, "1W": 0.009, "1M": 0.018, "1Y": 0.05 },
  }),
  createStock({
    symbol: "INFY",
    companyName: "Infosys",
    exchange: "NSE",
    sector: "IT Services",
    price: 1568.9,
    changePercent: -0.42,
    changeValue: -6.6,
    marketCapLabel: "₹6.5L Cr",
    peRatio: 27.2,
    aiScore: 68,
    sentiment: "Neutral",
    riskLevel: "Medium",
    dayRange: [1559.2, 1581.4],
    support: 1542,
    resistance: 1598,
    volumeLabel: "0.8x 20D avg",
    theme: "AI consulting demand",
    thesis: "Growth remains selective, but AI implementation demand continues to support strategic deal flow.",
    insights: [
      { title: "AI takeaway", description: "Momentum is positive long term, though near-term earnings revision risk remains." },
      { title: "What to watch", description: "Client discretionary spending trends will be more important than headline guidance." },
    ],
    catalysts: [
      { label: "Enterprise AI", detail: "Execution in generative AI programs can improve mix quality." },
      { label: "FX sensitivity", detail: "Currency moves remain relevant for margin dispersion." },
    ],
    drift: { "1D": -0.002, "1W": 0.006, "1M": 0.022, "1Y": 0.11 },
    swing: { "1D": 0.005, "1W": 0.011, "1M": 0.025, "1Y": 0.07 },
  }),
  createStock({
    symbol: "ICICIBANK",
    companyName: "ICICI Bank",
    exchange: "NSE",
    sector: "Private Bank",
    price: 1219.2,
    changePercent: 1.12,
    changeValue: 13.5,
    marketCapLabel: "₹8.6L Cr",
    peRatio: 18.9,
    aiScore: 86,
    sentiment: "Bullish",
    riskLevel: "Low",
    dayRange: [1203.6, 1222.4],
    support: 1194,
    resistance: 1240,
    volumeLabel: "1.3x 20D avg",
    theme: "Credit momentum",
    thesis: "Strong retail franchise and healthy profitability make this one of the cleaner banking trend setups.",
    insights: [
      { title: "AI takeaway", description: "Relative strength versus banking peers remains one of the strongest in the screen." },
      { title: "What to watch", description: "Loan growth quality matters more than raw growth headline numbers here." },
    ],
    catalysts: [
      { label: "Profitability", detail: "ROA durability remains the core reason for strong AI ranking." },
      { label: "Sector rotation", detail: "Private financials continue attracting institutional flows." },
    ],
    drift: { "1D": 0.011, "1W": 0.023, "1M": 0.055, "1Y": 0.22 },
    swing: { "1D": 0.005, "1W": 0.01, "1M": 0.022, "1Y": 0.07 },
  }),
  createStock({
    symbol: "SBIN",
    companyName: "State Bank of India",
    exchange: "NSE",
    sector: "Public Bank",
    price: 806.6,
    changePercent: 0.56,
    changeValue: 4.5,
    marketCapLabel: "₹7.2L Cr",
    peRatio: 10.6,
    aiScore: 73,
    sentiment: "Bullish",
    riskLevel: "Medium",
    dayRange: [799.2, 810.8],
    support: 790,
    resistance: 824,
    volumeLabel: "1.0x 20D avg",
    theme: "Value-heavy bank leader",
    thesis: "Public-bank momentum remains intact as valuations still leave room for upside if credit quality holds.",
    insights: [
      { title: "AI takeaway", description: "Value and breadth metrics still favor the stock despite recent consolidation." },
      { title: "What to watch", description: "Treasury sensitivity and PSU sentiment can add volatility." },
    ],
    catalysts: [
      { label: "Valuation support", detail: "Discounted multiple offers some downside cushion in broad market weakness." },
      { label: "Macro link", detail: "Rate expectations continue to shape public bank narrative." },
    ],
    drift: { "1D": 0.006, "1W": 0.013, "1M": 0.035, "1Y": 0.18 },
    swing: { "1D": 0.005, "1W": 0.011, "1M": 0.025, "1Y": 0.08 },
  }),
  createStock({
    symbol: "LT",
    companyName: "Larsen & Toubro",
    exchange: "NSE",
    sector: "Capital Goods",
    price: 3688.8,
    changePercent: 0.88,
    changeValue: 32.15,
    marketCapLabel: "₹5.1L Cr",
    peRatio: 33.3,
    aiScore: 77,
    sentiment: "Bullish",
    riskLevel: "Medium",
    dayRange: [3641.3, 3699.4],
    support: 3605,
    resistance: 3744,
    volumeLabel: "1.1x 20D avg",
    theme: "Infrastructure order momentum",
    thesis: "Order-book visibility and capex strength keep medium-term momentum constructive.",
    insights: [
      { title: "AI takeaway", description: "Capex-led sectors continue screening well in the current macro regime." },
      { title: "What to watch", description: "Execution cadence matters more than order inflow headlines from here." },
    ],
    catalysts: [
      { label: "Order book", detail: "Infrastructure spend remains a durable structural tailwind." },
      { label: "Sector breadth", detail: "Capital goods strength often confirms broader domestic growth optimism." },
    ],
    drift: { "1D": 0.007, "1W": 0.015, "1M": 0.04, "1Y": 0.19 },
    swing: { "1D": 0.005, "1W": 0.011, "1M": 0.024, "1Y": 0.07 },
  }),
  createStock({
    symbol: "BHARTIARTL",
    companyName: "Bharti Airtel",
    exchange: "NSE",
    sector: "Telecom",
    price: 1711.9,
    changePercent: 1.24,
    changeValue: 21.05,
    marketCapLabel: "₹9.7L Cr",
    peRatio: 46.2,
    aiScore: 82,
    sentiment: "Bullish",
    riskLevel: "Medium",
    dayRange: [1688.4, 1718.6],
    support: 1675,
    resistance: 1736,
    volumeLabel: "1.4x 20D avg",
    theme: "ARPU expansion",
    thesis: "Tariff optimism and operating leverage continue to support higher conviction in telecom quality names.",
    insights: [
      { title: "AI takeaway", description: "High-quality trend persistence remains stronger than broad market median." },
      { title: "What to watch", description: "Tariff commentary and competitive intensity remain the two key swing factors." },
    ],
    catalysts: [
      { label: "Tariff cycle", detail: "Even incremental pricing optimism supports earnings re-rating." },
      { label: "Quality premium", detail: "Market continues rewarding cash-flow durability in telecom." },
    ],
    drift: { "1D": 0.012, "1W": 0.02, "1M": 0.05, "1Y": 0.24 },
    swing: { "1D": 0.006, "1W": 0.012, "1M": 0.02, "1Y": 0.06 },
  }),
  createStock({
    symbol: "M&M",
    companyName: "Mahindra & Mahindra",
    exchange: "NSE",
    sector: "Auto",
    price: 3015.4,
    changePercent: 2.08,
    changeValue: 61.5,
    marketCapLabel: "₹3.8L Cr",
    peRatio: 25.7,
    aiScore: 88,
    sentiment: "Bullish",
    riskLevel: "Medium",
    dayRange: [2951.2, 3028.7],
    support: 2920,
    resistance: 3060,
    volumeLabel: "1.7x 20D avg",
    theme: "SUV cycle leadership",
    thesis: "M&M remains a standout analytics candidate thanks to strong relative strength and category leadership.",
    insights: [
      { title: "AI takeaway", description: "Momentum breadth and earnings-quality factors both rank in the top tier." },
      { title: "What to watch", description: "Execution on new launches can sustain leadership for longer than consensus expects." },
    ],
    catalysts: [
      { label: "Demand strength", detail: "SUV demand resilience continues to support premium multiples." },
      { label: "Industrial optionality", detail: "Broader cyclical participation adds to the narrative depth." },
    ],
    drift: { "1D": 0.018, "1W": 0.032, "1M": 0.072, "1Y": 0.31 },
    swing: { "1D": 0.007, "1W": 0.014, "1M": 0.028, "1Y": 0.09 },
  }),
  createStock({
    symbol: "SUNPHARMA",
    companyName: "Sun Pharmaceutical",
    exchange: "NSE",
    sector: "Pharma",
    price: 1724.6,
    changePercent: 0.33,
    changeValue: 5.65,
    marketCapLabel: "₹4.1L Cr",
    peRatio: 36.5,
    aiScore: 71,
    sentiment: "Neutral",
    riskLevel: "Low",
    dayRange: [1713.2, 1730.5],
    support: 1698,
    resistance: 1754,
    volumeLabel: "0.95x 20D avg",
    theme: "Defensive healthcare strength",
    thesis: "Pharma remains useful as a lower-beta analytics basket when market leadership broadens unevenly.",
    insights: [
      { title: "AI takeaway", description: "Defensive factor exposure remains attractive during headline-heavy weeks." },
      { title: "What to watch", description: "Product mix quality and US commentary still matter for sustained rerating." },
    ],
    catalysts: [
      { label: "Defensive rotation", detail: "Pharma often benefits when cyclicals consolidate." },
      { label: "Consistency", detail: "Earnings stability keeps downside drawdowns relatively contained." },
    ],
    drift: { "1D": 0.004, "1W": 0.009, "1M": 0.025, "1Y": 0.12 },
    swing: { "1D": 0.003, "1W": 0.008, "1M": 0.016, "1Y": 0.05 },
  }),
  createStock({
    symbol: "AXISBANK",
    companyName: "Axis Bank",
    exchange: "NSE",
    sector: "Private Bank",
    price: 1088.95,
    changePercent: -0.61,
    changeValue: -6.7,
    marketCapLabel: "₹3.4L Cr",
    peRatio: 14.8,
    aiScore: 64,
    sentiment: "Cautious",
    riskLevel: "Medium",
    dayRange: [1081.4, 1098.6],
    support: 1068,
    resistance: 1112,
    volumeLabel: "1.05x 20D avg",
    theme: "Mean-reversion candidate",
    thesis: "Momentum is softer than private-bank leaders, but factor screens still flag recovery potential.",
    insights: [
      { title: "AI takeaway", description: "Quality is solid, but price leadership has cooled versus top peers." },
      { title: "What to watch", description: "A sustained reclaim of resistance could improve the AI setup materially." },
    ],
    catalysts: [
      { label: "Relative strength", detail: "Needs to improve versus ICICI and HDFC Bank to regain leadership status." },
      { label: "Valuation", detail: "Cheaper than sector leaders, which supports a watchlist role." },
    ],
    drift: { "1D": -0.005, "1W": 0.004, "1M": 0.015, "1Y": 0.09 },
    swing: { "1D": 0.006, "1W": 0.013, "1M": 0.024, "1Y": 0.07 },
  }),
];

export const MARKET_INDICES: MarketIndexSnapshot[] = [
  { label: "Nifty50", value: 22453.8, changePercent: 0.68, breadth: "31 gainers" },
  { label: "Sensex", value: 73962.4, changePercent: 0.61, breadth: "Financials lead" },
  { label: "BankNifty", value: 48215.1, changePercent: 0.92, breadth: "Private banks strong" },
];

export const MARKET_SECTIONS = [
  { id: "popular", title: "Popular Stocks", subtitle: "High-interest names with strong search and relative-strength activity.", symbols: ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK"] },
  { id: "nifty50", title: "Nifty50", subtitle: "Large-cap leaders shaping the broad market tone right now.", symbols: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"] },
  { id: "sensex", title: "Sensex", subtitle: "Index heavyweights with the largest near-term dashboard impact.", symbols: ["RELIANCE", "TCS", "LT", "BHARTIARTL"] },
  { id: "banknifty", title: "BankNifty", subtitle: "Banking names worth tracking for sector breadth and liquidity leadership.", symbols: ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK"] },
  { id: "spotlight", title: "Notable Stocks", subtitle: "Context-rich ideas the AI layer is surfacing for deeper review.", symbols: ["M&M", "SUNPHARMA", "BHARTIARTL"] },
] as const;

export const DEFAULT_WATCHLIST_SYMBOLS = ["RELIANCE", "M&M", "ICICIBANK"];

export function getMarketStock(symbol: string): MarketStock | undefined {
  return MARKET_STOCKS.find((stock) => stock.symbol.toUpperCase() === symbol.toUpperCase());
}

export function getStocksBySymbols(symbols: string[]): MarketStock[] {
  return symbols
    .map((symbol) => getMarketStock(symbol))
    .filter((stock): stock is MarketStock => Boolean(stock));
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
