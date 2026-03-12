import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BrainCircuit, Search, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

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
import { MARKET_INDICES, MARKET_SECTIONS, MARKET_STOCKS, getStocksBySymbols, type MarketStock } from "@/lib/market-data";

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

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function asString(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function sparklinePoints(values: number[]): string {
  const width = 100;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function findHolding(symbol: string, holdings: Array<Record<string, unknown>>): Record<string, unknown> | undefined {
  return holdings.find((holding) => asString(holding.symbol).toUpperCase() === symbol.toUpperCase());
}

export function DashboardTab({
  holdings,
  totalValue,
  totalPnl,
  pnlPercentage,
  isPnlPositive,
}: DashboardTabProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

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

    return MARKET_STOCKS.filter((stock) =>
      `${stock.symbol} ${stock.companyName} ${stock.sector}`.toLowerCase().includes(query),
    ).slice(0, 6);
  }, [search]);

  const topIdeas = useMemo(
    () => [...MARKET_STOCKS].sort((left, right) => right.aiScore - left.aiScore).slice(0, 3),
    [],
  );

  const goToStock = (stock: MarketStock) => {
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
        <Card className="border border-[#2B4E44] bg-[#102825] text-[#F6F9F2] ring-0">
          <CardHeader className="gap-3 pb-0">
            <Badge variant="outline" className="border-[#416133] bg-[#C4E456]/10 text-[#C4E456]">
              Market Intelligence
            </Badge>
            <CardTitle className="text-3xl font-semibold tracking-tight">
              Track the market, then drill into AI-backed stock context.
            </CardTitle>
            <CardDescription className="max-w-2xl text-[#FFFFFFB3]">
              This view now surfaces market leaders, index tone, and research-ready stocks instead of only the symbols you already hold.
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
                  filteredStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      type="button"
                      onClick={() => goToStock(stock)}
                      className="rounded-xl border border-[#2B4E44] bg-[#0B201F] p-4 text-left transition-colors hover:border-[#416133] hover:bg-[#14302c]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#F6F9F2]">{stock.symbol}</p>
                          <p className="mt-1 text-xs text-[#FFFFFF99]">{stock.companyName}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={stock.changePercent >= 0 ? "border-[#416133] text-[#C4E456]" : "border-[#6b2c3f] text-[#EB316F]"}
                        >
                          {formatPercent(stock.changePercent)}
                        </Badge>
                      </div>
                      <p className="mt-4 text-lg font-semibold text-[#F6F9F2]">{formatCurrency(stock.price)}</p>
                      <p className="mt-2 text-xs text-[#FFFFFF80]">{stock.theme}</p>
                    </button>
                  ))
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
                {topIdeas.map((stock) => (
                  <button
                    key={stock.symbol}
                    type="button"
                    onClick={() => goToStock(stock)}
                    className="rounded-xl border border-[#2B4E44] bg-[#0B201F] p-4 text-left transition-colors hover:border-[#416133] hover:bg-[#14302c]"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-[#2B4E44] text-[#FFFFFFB3]">
                        AI score {stock.aiScore}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-[#FFFFFF66]" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-[#F6F9F2]">{stock.companyName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">{stock.symbol}</p>
                    <p className="mt-4 text-sm text-[#FFFFFFB3]">{stock.thesis}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-[#C4E456]" />
                Daily Market Brief
              </CardTitle>
              <CardDescription className="text-[#FFFFFF99]">
                AI-generated pulse based on breadth, leadership, and your linked portfolio context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {MARKET_INDICES.map((index) => (
                  <div key={index.label} className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#F6F9F2]">{index.label}</p>
                      <Badge
                        variant="outline"
                        className={index.changePercent >= 0 ? "border-[#416133] text-[#C4E456]" : "border-[#6b2c3f] text-[#EB316F]"}
                      >
                        {formatPercent(index.changePercent)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xl font-semibold text-[#F6F9F2]">{formatCompactNumber(index.value)}</p>
                    <p className="mt-1 text-xs text-[#FFFFFF80]">{index.breadth}</p>
                  </div>
                ))}
              </div>

              <Separator className="bg-[#2B4E44]" />

              <div className="space-y-2 text-sm text-[#FFFFFFB3]">
                <p>
                  Leadership is concentrated in private banks, telecom, and select cyclicals, with AI ranking
                  {` `}
                  <span className="font-medium text-[#F6F9F2]">{topIdeas[0]?.symbol}</span>
                  {` `}
                  as the strongest analytics candidate today.
                </p>
                <p>
                  Your connected portfolio is currently {isPnlPositive ? "outperforming" : "lagging"} with
                  {` `}
                  <span className={isPnlPositive ? "text-[#C4E456]" : "text-[#EB316F]"}>{formatPercent(pnlPercentage)}</span>
                  {` `}
                  overall returns.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] ring-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="h-4 w-4 text-[#C4E456]" />
                Portfolio Context
              </CardTitle>
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
              <div className="rounded-xl border border-[#2B4E44] bg-[#102825] p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF80]">Market overlap</p>
                <p className="mt-2 text-sm text-[#FFFFFFB3]">
                  {connectedSymbols.size > 0
                    ? `${connectedSymbols.size} connected holdings are also present in the market screens below.`
                    : "Connect a broker to compare your portfolio against the market screens below."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {MARKET_SECTIONS.map((section) => {
        const stocks = getStocksBySymbols([...section.symbols]);

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
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2B4E44] hover:bg-transparent">
                    <TableHead className="px-4 text-[#FFFFFF80]">Stock</TableHead>
                    <TableHead className="px-4 text-[#FFFFFF80]">Price</TableHead>
                    <TableHead className="px-4 text-[#FFFFFF80]">Change</TableHead>
                    <TableHead className="px-4 text-[#FFFFFF80]">AI score</TableHead>
                    <TableHead className="px-4 text-[#FFFFFF80]">Theme</TableHead>
                    <TableHead className="px-4 text-right text-[#FFFFFF80]">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocks.map((stock) => {
                    const isPositive = stock.changePercent >= 0;
                    const points = sparklinePoints(stock.history["1D"]);

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
                        <TableCell className="px-4 py-4 text-[#F6F9F2]">{formatCurrency(stock.price)}</TableCell>
                        <TableCell className={`px-4 py-4 ${isPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                          <span className="inline-flex items-center gap-1 text-sm font-medium">
                            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {formatPercent(stock.changePercent)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-[#F6F9F2]">{stock.aiScore}/100</TableCell>
                        <TableCell className="px-4 py-4 text-[#FFFFFFB3]">{stock.theme}</TableCell>
                        <TableCell className="px-4 py-4">
                          <div className="ml-auto flex justify-end">
                            <svg viewBox="0 0 100 36" className="h-9 w-28">
                              <polyline
                                fill="none"
                                points={points}
                                stroke={isPositive ? "#C4E456" : "#EB316F"}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button
          variant="outline"
          className="border-[#2B4E44] bg-[#0B201F] text-[#F6F9F2] hover:bg-[#102825]"
          onClick={() => goToStock(topIdeas[0])}
        >
          Open top AI-ranked stock
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
