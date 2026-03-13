import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Search, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMarketQuotes } from "@/hooks/use-market-quotes";
import type { MarketQuoteSnapshot } from "@/lib/api/brokers";
import { MARKET_CATALOG, MARKET_SECTIONS, getCatalogBySymbols, type MarketCatalogEntry } from "@/lib/market-data";

interface DashboardTabProps {
  holdings: Array<Record<string, unknown>>;
  totalValue: number;
  investedValue: number;
  totalPnl: number;
  pnlPercentage: number;
  isPnlPositive: boolean;
}

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

function asString(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function getQuoteChangePercent(quote: MarketQuoteSnapshot | undefined): number {
  if (!quote?.close || quote.close <= 0) {
    return 0;
  }
  return ((quote.ltp - quote.close) / quote.close) * 100;
}

function getQuoteChangeValue(quote: MarketQuoteSnapshot | undefined): number {
  if (!quote?.close) {
    return 0;
  }
  return quote.ltp - quote.close;
}

function formatStreamStatusLabel(
  streamStatus: "idle" | "connecting" | "live" | "error",
  lastTickAt: number | null,
): string {
  if (streamStatus === "live" && lastTickAt) {
    return `WebSocket live · last tick ${new Date(lastTickAt).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  }

  if (streamStatus === "connecting") {
    return "Opening live market stream";
  }

  if (streamStatus === "error") {
    return "Live stream unavailable";
  }

  return "Live stream idle";
}

function findHolding(symbol: string, holdings: Array<Record<string, unknown>>): Record<string, unknown> | undefined {
  return holdings.find((holding) => asString(holding.symbol).toUpperCase() === symbol.toUpperCase());
}

export function DashboardTab({
  holdings,
  totalValue,
  investedValue,
  totalPnl,
  pnlPercentage,
  isPnlPositive,
}: DashboardTabProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const marketSymbols = useMemo(
    () => Array.from(new Set(MARKET_SECTIONS.flatMap((section) => [...section.symbols]))),
    [],
  );
  const {
    quotes,
    isLoading,
    error,
    streamStatus,
    streamError,
    lastTickAt,
  } = useMarketQuotes(marketSymbols, {
    enabled: true,
    refreshMs: 120000,
    streamEnabled: true,
  });

  const connectedSymbols = useMemo(
    () =>
      new Set(
        holdings
          .map((holding) => asString(holding.symbol).toUpperCase())
          .filter((symbol) => symbol !== "-"),
      ),
    [holdings],
  );

  const filteredStocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return MARKET_CATALOG.filter((stock) =>
      `${stock.symbol} ${stock.companyName} ${stock.sector}`.toLowerCase().includes(query),
    ).slice(0, 6);
  }, [search]);

  const featuredStocks = useMemo(
    () => getCatalogBySymbols(MARKET_SECTIONS[0]?.symbols ? [...MARKET_SECTIONS[0].symbols] : []).slice(0, 3),
    [],
  );

  const goToStock = (stock: MarketCatalogEntry) => {
    navigate(`/dashboard/stock/${stock.symbol}`, {
      state: {
        stock,
        holding: findHolding(stock.symbol, holdings),
      },
    });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.18)] ring-0">
          <CardHeader className="gap-3 border-b border-[#2B4E44]/70 pb-5">
            <Badge variant="outline" className="border-[#416133] bg-[#C4E456]/10 text-[#C4E456]">
              Live Market
            </Badge>
            <CardTitle className="text-3xl font-semibold tracking-tight">
              Track live quotes across the market universe you care about.
            </CardTitle>
            <CardDescription className="max-w-2xl text-[#FFFFFFB3]">
              This screen now uses broker-backed quote data for displayed prices, session changes, and day ranges.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FFFFFF80]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search stocks, sectors, or symbols"
                className="h-11 border-[#2B4E44] bg-[#0B201F] pl-10 text-[#F6F9F2] placeholder:text-[#FFFFFF66]"
              />
            </div>

            {search.trim() ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredStocks.length > 0 ? (
                  filteredStocks.map((stock) => {
                    const quote = quotes.get(stock.symbol);
                    const changePercent = getQuoteChangePercent(quote);

                    return (
                      <button
                        key={stock.symbol}
                        type="button"
                        onClick={() => goToStock(stock)}
                        className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/80 p-4 text-left transition-colors hover:border-[#416133] hover:bg-[#14302c]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#F6F9F2]">{stock.symbol}</p>
                            <p className="mt-1 text-xs text-[#FFFFFF99]">{stock.companyName}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={changePercent >= 0 ? "border-[#416133] text-[#C4E456]" : "border-[#6b2c3f] text-[#EB316F]"}
                          >
                            {quote ? formatPercent(changePercent) : "Pending"}
                          </Badge>
                        </div>
                        <p className="mt-4 text-lg font-semibold text-[#F6F9F2]">
                          {quote ? formatCurrency(quote.ltp) : "Live pending"}
                        </p>
                        <p className="mt-2 text-xs text-[#FFFFFF80]">{stock.exchange} · {stock.sector}</p>
                      </button>
                    );
                  })
                ) : (
                  <Card className="border border-dashed border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0 md:col-span-2 xl:col-span-3">
                    <CardContent className="px-6 py-8 text-sm text-[#FFFFFFB3]">
                      No market matches found for that search yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {featuredStocks.map((stock) => (
                  <button
                    key={stock.symbol}
                    type="button"
                    onClick={() => goToStock(stock)}
                    className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/80 p-4 text-left transition-colors hover:border-[#416133] hover:bg-[#14302c]"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
                        {stock.exchange}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-[#FFFFFF66]" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-[#F6F9F2]">{stock.companyName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">{stock.symbol}</p>
                    <p className="mt-4 text-sm text-[#FFFFFFB3]">
                      {quotes.get(stock.symbol) ? formatCurrency(quotes.get(stock.symbol)!.ltp) : "Live pending"} · {stock.sector}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
            <CardHeader className="border-b border-[#2B4E44]/70">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-[#C4E456]" />
                Market Feed Status
              </CardTitle>
              <CardDescription className="text-[#FFFFFF99]">
                Quote coverage, websocket state, and fallback refresh health for this live market view.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                  <p className="text-sm font-medium text-[#F6F9F2]">Universe size</p>
                  <p className="mt-3 text-xl font-semibold text-[#F6F9F2]">{marketSymbols.length}</p>
                  <p className="mt-1 text-xs text-[#FFFFFF80]">Tracked symbols in the market screen</p>
                </div>
                <div className="rounded-xl border border-[#2B4E44] bg-[#0B201F]/75 p-4">
                  <p className="text-sm font-medium text-[#F6F9F2]">Market stream</p>
                  <p className="mt-3 text-xl font-semibold text-[#F6F9F2]">
                    {streamStatus === "live" ? "Live" : streamStatus === "connecting" ? "Connecting" : streamStatus === "error" ? "Fallback" : "Idle"}
                  </p>
                  <p className="mt-1 text-xs text-[#FFFFFF80]">
                    {formatStreamStatusLabel(streamStatus, lastTickAt)}
                  </p>
                </div>
              </div>

              <Separator className="bg-[#2B4E44]" />

              <div className="space-y-2 text-sm text-[#FFFFFFB3]">
                <p>
                  Displayed market numbers now start from a broker quote snapshot and then update through the live websocket stream.
                </p>
                <p>
                  {streamError
                    ? `WebSocket warning: ${streamError}`
                    : error
                      ? `Quote API warning: ${error}`
                      : isLoading
                        ? "Refreshing the fallback quote snapshot in the background."
                        : "If the stream drops, the market screen keeps a slower quote refresh instead of inventing prices."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] shadow-[0_20px_48px_rgba(0,0,0,0.16)] ring-0">
            <CardHeader className="border-b border-[#2B4E44]/70">
              <CardTitle className="text-base">Portfolio Context</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Live value</p>
                <p className="mt-2 text-lg font-semibold text-[#F6F9F2]">{formatCurrency(totalValue)}</p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Net return</p>
                <p className={`mt-2 text-lg font-semibold ${isPnlPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                  {formatCurrency(totalPnl)}
                </p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Invested</p>
                <p className="mt-2 text-lg font-semibold text-[#F6F9F2]">{formatCurrency(investedValue)}</p>
              </div>
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Overall return</p>
                <p className={`mt-2 text-lg font-semibold ${isPnlPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                  {formatPercent(pnlPercentage)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {MARKET_SECTIONS.map((section) => {
        const stocks = getCatalogBySymbols([...section.symbols]);

        return (
          <Card key={section.id} className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                  <CardDescription className="mt-1 text-[#FFFFFF99]">{section.subtitle}</CardDescription>
                </div>
                <Badge variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
                  {stocks.length} tracked
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="border-[#2B4E44] hover:bg-transparent">
                    <TableHead className="px-4 text-[#FFFFFF80]">Stock</TableHead>
                    <TableHead className="px-4 text-[#FFFFFF80]">Price</TableHead>
                    <TableHead className="px-4 text-[#FFFFFF80]">Day change</TableHead>
                    <TableHead className="px-4 text-[#FFFFFF80]">Day range</TableHead>
                    <TableHead className="px-4 text-right text-[#FFFFFF80]">Exchange</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocks.map((stock) => {
                    const quote = quotes.get(stock.symbol);
                    const changePercent = getQuoteChangePercent(quote);
                    const changeValue = getQuoteChangeValue(quote);
                    const isPositive = changePercent >= 0;

                    return (
                      <TableRow
                        key={stock.symbol}
                        className="cursor-pointer border-[#2B4E44] hover:bg-[#102825]"
                        onClick={() => goToStock(stock)}
                      >
                        <TableCell className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#F6F9F2]">{stock.symbol}</span>
                              {connectedSymbols.has(stock.symbol) && (
                                <Badge variant="outline" className="border-[#416133] text-[#C4E456]">
                                  In portfolio
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-[#FFFFFF80]">{stock.companyName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[#F6F9F2]">
                          {quote ? formatCurrency(quote.ltp) : "Live pending"}
                        </TableCell>
                        <TableCell className={`px-4 py-4 ${isPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                          <span className="inline-flex items-center gap-1 text-sm font-medium">
                            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {quote ? `${formatCurrency(changeValue)} · ${formatPercent(changePercent)}` : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[#FFFFFFB3]">
                          {quote?.low !== undefined && quote?.low !== null && quote?.high !== undefined && quote?.high !== null
                            ? `${formatCurrency(quote.low)} - ${formatCurrency(quote.high)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-[#FFFFFFB3]">{stock.exchange}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button
          variant="outline"
          className="border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] hover:bg-[#102825]"
          onClick={() => {
            if (featuredStocks[0]) {
              goToStock(featuredStocks[0]);
            }
          }}
        >
          Open live stock view
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
