import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  BrainCircuit,
  CircleAlert,
  Gauge,
  LineChart,
  Radar,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getMarketSocketUrl, subscribeToMarketSymbols, unsubscribeFromMarketSymbols } from "@/lib/api/brokers";
import {
  getMarketStock,
  getStoredWatchlistSymbols,
  saveWatchlistSymbols,
  subscribeToWatchlistChanges,
  type MarketStock,
} from "@/lib/market-data";

export interface StockDetailHolding {
  symbol: string;
  company_name?: string;
  exchange?: string;
  quantity: number;
  average_price: number;
  last_traded_price: number;
  invested_value: number;
  current_value: number;
  pnl: number;
  _ltpHistory?: number[];
}

type Timeframe = "1D" | "1W" | "1M" | "1Y";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function asNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildChartData(history: number[], timeframe: Timeframe): Array<{ label: string; price: number }> {
  return history.map((price, index) => ({
    label:
      timeframe === "1D"
        ? `${String(9 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "15" : "45"}`
        : timeframe === "1W"
          ? `D${index + 1}`
          : timeframe === "1M"
            ? `W${index + 1}`
            : `M${index + 1}`,
    price,
  }));
}

function getHoldingPnlPercent(holding: StockDetailHolding | undefined): number {
  if (!holding || holding.invested_value <= 0) {
    return 0;
  }
  return (holding.pnl / holding.invested_value) * 100;
}

function toggleWatchlist(symbol: string): string[] {
  const current = getStoredWatchlistSymbols();
  const isTracked = current.includes(symbol);
  const next = isTracked ? current.filter((item) => item !== symbol) : [...current, symbol];
  saveWatchlistSymbols(next);
  return next;
}

export default function StockDetailPage() {
  const { symbol } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = (location.state ?? {}) as { stock?: MarketStock; holding?: StockDetailHolding };

  const fallbackStock = symbol ? getMarketStock(symbol) : undefined;
  const stock = locationState.stock ?? fallbackStock;
  const holding = locationState.holding;
  const resolvedSymbol = stock?.symbol ?? symbol ?? "";
  const baseLatestPrice = stock?.price ?? holding?.last_traded_price ?? 0;
  const baseLiveHistory = stock?.history["1D"] ?? null;

  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [liveState, setLiveState] = useState<{
    symbol: string;
    latestPrice: number;
    liveHistory: number[] | null;
  }>(() => ({
    symbol: resolvedSymbol,
    latestPrice: baseLatestPrice,
    liveHistory: baseLiveHistory,
  }));
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(() => getStoredWatchlistSymbols());
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => subscribeToWatchlistChanges(() => setWatchlistSymbols(getStoredWatchlistSymbols())), []);

  useEffect(() => {
    if (!symbol || !stock) {
      return;
    }

    let closed = false;

    const connect = async () => {
      try {
        await subscribeToMarketSymbols([symbol]);
        const socketUrl = await getMarketSocketUrl();
        if (closed) {
          return;
        }

        const socket = new WebSocket(socketUrl);
        socketRef.current = socket;

        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({ action: "subscribe", symbols: [symbol], mode: "LTP" }));
        });

        socket.addEventListener("message", (event) => {
          try {
            const tick = JSON.parse(event.data as string) as { symbol: string; ltp: number };
            if (tick.symbol.toUpperCase() !== symbol.toUpperCase()) {
              return;
            }

            setLiveState((current) => ({
              symbol: resolvedSymbol,
              latestPrice: tick.ltp,
              liveHistory: [...(current.liveHistory ?? stock.history["1D"]), tick.ltp].slice(-24),
            }));
          } catch {
            // Ignore malformed websocket events for now.
          }
        });
      } catch {
        // Fall back to seeded data if streaming is unavailable for this symbol.
      }
    };

    void connect();

    return () => {
      closed = true;
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: "unsubscribe", symbols: [symbol], mode: "LTP" }));
      }
      socket?.close();
      socketRef.current = null;
      void unsubscribeFromMarketSymbols([symbol]);
    };
  }, [resolvedSymbol, stock, symbol]);

  if (!symbol || !stock) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
          <CardContent className="px-8 py-8 text-center">
            <p className="text-lg font-medium">Stock details are unavailable.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 border-[#2B4E44] bg-[#102825] text-[#F6F9F2] hover:bg-[#14302c]"
              onClick={() => navigate(-1)}
            >
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestPrice =
    liveState.symbol === resolvedSymbol ? liveState.latestPrice : baseLatestPrice;
  const liveHistory =
    liveState.symbol === resolvedSymbol ? liveState.liveHistory : baseLiveHistory;
  const activeHistory = timeframe === "1D" ? liveHistory ?? stock.history["1D"] : stock.history[timeframe];
  const chartData = buildChartData(activeHistory, timeframe);
  const referencePrice = activeHistory[0] ?? latestPrice;
  const priceChange = latestPrice - referencePrice;
  const priceChangePercent = referencePrice > 0 ? (priceChange / referencePrice) * 100 : 0;
  const isPositive = priceChange >= 0;
  const isTracked = watchlistSymbols.includes(stock.symbol);
  const holdingPnlPercent = getHoldingPnlPercent(holding);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            className="-ml-3 w-fit text-[#FFFFFFB3] hover:bg-[#102825] hover:text-[#F6F9F2]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#416133] bg-[#C4E456]/10 text-[#C4E456]">
              AI score {stock.aiScore}
            </Badge>
            <Badge variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
              {stock.sentiment}
            </Badge>
            <Badge variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
              {stock.exchange}
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F6F9F2]">{stock.companyName}</h1>
            <p className="mt-1 text-sm uppercase tracking-[0.24em] text-[#FFFFFF80]">{stock.symbol} · {stock.sector}</p>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-[#FFFFFFB3]">{stock.thesis}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-[#2B4E44] bg-[#0B201F] p-5 xl:min-w-[320px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#FFFFFF80]">Current price</p>
              <p className="mt-2 text-3xl font-semibold text-[#F6F9F2]">{formatCurrency(latestPrice)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-[#2B4E44] bg-[#102825] text-[#F6F9F2] hover:bg-[#14302c]"
              onClick={() => setWatchlistSymbols(toggleWatchlist(stock.symbol))}
            >
              <Bookmark className={`h-4 w-4 ${isTracked ? "fill-[#C4E456] text-[#C4E456]" : "text-[#FFFFFFB3]"}`} />
              {isTracked ? "Tracked" : "Add to watchlist"}
            </Button>
          </div>
          <div className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${isPositive ? "bg-[#C4E456]/10 text-[#C4E456]" : "bg-[#EB316F]/10 text-[#EB316F]"}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatCurrency(priceChange)} · {formatPercent(priceChangePercent)}
          </div>
          <Separator className="bg-[#2B4E44]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#FFFFFF80]">Support</p>
              <p className="mt-1 text-base font-medium text-[#F6F9F2]">{formatCurrency(stock.support)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#FFFFFF80]">Resistance</p>
              <p className="mt-1 text-base font-medium text-[#F6F9F2]">{formatCurrency(stock.resistance)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LineChart className="h-5 w-5 text-[#C4E456]" />
                  Price context
                </CardTitle>
                <CardDescription className="mt-1 text-[#FFFFFF99]">
                  Compare live motion with the seeded research history for broader context.
                </CardDescription>
              </div>
              <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as Timeframe)}>
                <TabsList className="border border-[#2B4E44] bg-[#102825]">
                  {(["1D", "1W", "1M", "1Y"] as Timeframe[]).map((value) => (
                    <TabsTrigger key={value} value={value} className="data-active:bg-[#C4E456] data-active:text-[#0B201F]">
                      {value}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="h-[360px]">
              <ChartContainer
                config={{
                  price: {
                    label: "Price",
                    color: isPositive ? "#C4E456" : "#EB316F",
                  },
                }}
                className="h-full w-full"
              >
                <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="detail-price-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isPositive ? "#C4E456" : "#EB316F"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={isPositive ? "#C4E456" : "#EB316F"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#FFFFFF80", fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#FFFFFF80", fontSize: 11 }}
                    tickFormatter={(value) => `₹${formatNumber(asNumber(value))}`}
                    width={84}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(asNumber(value))} />}
                    cursor={{ stroke: isPositive ? "#C4E456" : "#EB316F", strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={isPositive ? "#C4E456" : "#EB316F"}
                    fill="url(#detail-price-fill)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="h-4 w-4 text-[#C4E456]" />
                AI insight stack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stock.insights.map((insight) => (
                <div key={insight.title} className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                  <p className="text-sm font-medium text-[#F6F9F2]">{insight.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#FFFFFFB3]">{insight.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-[#C4E456]" />
                Market stats
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Market cap</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">{stock.marketCapLabel}</p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">P/E ratio</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">{formatNumber(stock.peRatio)}</p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Day range</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">
                  {formatCurrency(stock.dayRange[0])} - {formatCurrency(stock.dayRange[1])}
                </p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Volume signal</p>
                <p className="mt-2 text-base font-medium text-[#F6F9F2]">{stock.volumeLabel}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="border border-[#2B4E44] bg-[#102825]">
          <TabsTrigger value="overview" className="data-active:bg-[#C4E456] data-active:text-[#0B201F]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="catalysts" className="data-active:bg-[#C4E456] data-active:text-[#0B201F]">
            Catalysts
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="data-active:bg-[#C4E456] data-active:text-[#0B201F]">
            Portfolio link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Radar className="h-4 w-4 text-[#C4E456]" />
                  Setup quality
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#FFFFFFB3]">
                <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                  Relative-strength screens rank this setup in the {stock.aiScore >= 80 ? "top tier" : stock.aiScore >= 70 ? "upper middle" : "watchlist"} bucket.
                </div>
                <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                  Sentiment is currently <span className="font-medium text-[#F6F9F2]">{stock.sentiment}</span> with a {stock.riskLevel.toLowerCase()} risk profile.
                </div>
              </CardContent>
            </Card>

            <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-[#C4E456]" />
                  Trend cues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#FFFFFFB3]">
                <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                  Price is {latestPrice >= stock.support ? "holding above" : "testing below"} the primary support zone near {formatCurrency(stock.support)}.
                </div>
                <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                  The next upside decision area remains around {formatCurrency(stock.resistance)}, where follow-through quality matters most.
                </div>
              </CardContent>
            </Card>

            <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CircleAlert className="h-4 w-4 text-[#C4E456]" />
                  Risk framing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#FFFFFFB3]">
                <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                  Risk level is <span className="font-medium text-[#F6F9F2]">{stock.riskLevel}</span>, so position sizing and thesis clarity matter more than short-term price noise.
                </div>
                <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                  This page is intentionally research-only: use it to compare conviction, not to place orders.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="catalysts" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {stock.catalysts.map((catalyst) => (
              <Card key={catalyst.label} className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
                <CardHeader>
                  <CardTitle className="text-base">{catalyst.label}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-[#FFFFFFB3]">
                  {catalyst.detail}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4">
          <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader>
              <CardTitle className="text-base">Connected portfolio context</CardTitle>
              <CardDescription className="text-[#FFFFFF99]">
                Helpful when this stock is already in your broker-linked holdings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {holding ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Quantity</p>
                    <p className="mt-2 text-lg font-medium text-[#F6F9F2]">{formatNumber(holding.quantity)}</p>
                  </div>
                  <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Average price</p>
                    <p className="mt-2 text-lg font-medium text-[#F6F9F2]">{formatCurrency(holding.average_price)}</p>
                  </div>
                  <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Unrealized P&L</p>
                    <p className={`mt-2 text-lg font-medium ${holding.pnl >= 0 ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                      {formatCurrency(holding.pnl)} · {formatPercent(holdingPnlPercent)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#2B4E44] bg-[#102825] px-6 py-8 text-sm text-[#FFFFFFB3]">
                  This stock is not currently present in the connected portfolio snapshot. You can still keep it on the watchlist for future AI comparison.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
