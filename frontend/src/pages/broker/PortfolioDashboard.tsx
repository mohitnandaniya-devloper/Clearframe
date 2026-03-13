import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { motion, type Variants } from "framer-motion";
import {
  ChartCandlestick,
  BriefcaseBusiness,
  Bot,
  GraduationCap,
  LineChart,
  Settings,
  LogOut,
  RefreshCw,
  Bell,
  Bookmark,
} from "lucide-react";
import {
  getMarketSocketUrl,
  type BrokerApiResponse,
  type MarketTickMessage,
  subscribeToMarketSymbols,
  unsubscribeFromMarketSymbols,
} from "@/lib/api/brokers";
import type { DashboardChatbotHolding } from "@/components/chatbot/floating-dashboard-chatbot";
import { Routes, Route } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ClearframeBrand } from "@/components/brand/clearframe-brand";

const DashboardTab = lazy(() =>
  import("./DashboardTab").then((module) => ({ default: module.DashboardTab })),
);
const StockDetailPage = lazy(() => import("./StockDetailPage"));
const WatchlistTab = lazy(() =>
  import("./WatchlistTab").then((module) => ({ default: module.WatchlistTab })),
);
const FloatingDashboardChatbot = lazy(() =>
  import("@/components/chatbot/floating-dashboard-chatbot").then((module) => ({
    default: module.FloatingDashboardChatbot,
  })),
);

interface PortfolioDashboardProps {
  brokerName: string;
  response: BrokerApiResponse;
  onDisconnect: () => void;
  onRefresh: () => Promise<void> | void;
  isDisconnecting?: boolean;
  isRefreshing?: boolean;
  errorMessage?: string | null;
}

const NAVIGATION_ITEMS: Array<{
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
    { id: "market", label: "Market", icon: ChartCandlestick },
    { id: "watchlist", label: "Watchlist", icon: Bookmark },
    { id: "portfolio", label: "Portfolio", icon: BriefcaseBusiness },
    { id: "assistant", label: "Assistant", icon: Bot },
    { id: "analysis", label: "Analysis", icon: LineChart },
    { id: "learning", label: "Learning", icon: GraduationCap },
    { id: "settings", label: "Settings", icon: Settings },
  ];

type TrendInterval = "3M" | "30D" | "7D";

interface PortfolioTrendPoint {
  date: string;
  value: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function PortfolioDashboard({
  brokerName,
  response,
  onDisconnect,
  onRefresh,
  isDisconnecting,
  isRefreshing,
  errorMessage,
}: PortfolioDashboardProps) {
  const [trendInterval, setTrendInterval] = useState<TrendInterval>("3M");
  const [activeNavItem, setActiveNavItem] = useState<string>("market");
  const [liveResponse, setLiveResponse] = useState<BrokerApiResponse>(response);
  const [shouldLoadChatbot, setShouldLoadChatbot] = useState(false);
  const hasTriggeredInitialRefresh = useRef(false);
  const streamSymbols = useMemo(() => {
    const data = asRecord(response.data);
    return asRecords(data?.holdings)
      .map((holding) => stringValue(holding.symbol))
      .filter((symbol) => symbol !== "-");
  }, [response.data]);
  const streamSymbolsKey = streamSymbols.join(",");

  useEffect(() => {
    setLiveResponse(response);
  }, [response]);

  useEffect(() => {
    if (hasTriggeredInitialRefresh.current || response.connection_state !== "connected") {
      return;
    }

    hasTriggeredInitialRefresh.current = true;
    void onRefresh();
  }, [onRefresh, response.connection_state]);

  useEffect(() => {
    if (liveResponse.connection_state !== "connected" || streamSymbols.length === 0) {
      return;
    }

    let socket: WebSocket | null = null;
    let closed = false;

    const connect = async () => {
      try {
        await subscribeToMarketSymbols(streamSymbols);
        const socketUrl = await getMarketSocketUrl();
        if (closed) {
          return;
        }

        socket = new WebSocket(socketUrl);
        socket.addEventListener("open", () => {
          socket?.send(
            JSON.stringify({ action: "subscribe", symbols: streamSymbols, mode: "LTP" }),
          );
        });

        socket.addEventListener("message", (event) => {
          const tick = JSON.parse(event.data) as MarketTickMessage;
          setLiveResponse((current) => applyMarketTick(current, tick));
        });
      } catch (error) {
        console.error("Market stream connection failed", error);
      }
    };

    void connect();

    return () => {
      closed = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ action: "unsubscribe", symbols: streamSymbols, mode: "LTP" }),
        );
      }
      socket?.close();
      void unsubscribeFromMarketSymbols(streamSymbols);
    };
  }, [liveResponse.connection_state, streamSymbols, streamSymbolsKey]);

  useEffect(() => {
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => setShouldLoadChatbot(true), { timeout: 1200 });
    } else {
      timeoutId = globalThis.setTimeout(() => setShouldLoadChatbot(true), 350);
    }

    return () => {
      if (idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const profile = resolveProfile(liveResponse.data);
  const portfolioSummary = asRecord(liveResponse.data?.portfolio_summary);
  const holdings = asRecords(liveResponse.data?.holdings);
  const activeHoldings = useMemo(() => holdings.filter(holdingHasPosition), [holdings]);
  const portfolioFetchState = stringValue(liveResponse.data?.portfolio_fetch_state);
  const portfolioError = stringOrNull(liveResponse.data?.portfolio_error);
  const profileError = stringOrNull(liveResponse.data?.profile_error);

  const holdingsCurrentValue = activeHoldings.reduce((sum, holding) => {
    return sum + holdingCurrentValue(holding);
  }, 0);
  const holdingsInvestedValue = activeHoldings.reduce((sum, holding) => {
    return sum + holdingInvestedValue(holding);
  }, 0);
  const holdingsPnl = activeHoldings.reduce((sum, holding) => {
    return sum + holdingPnlValue(holding);
  }, 0);

  const totalValue = numericOrFallback(portfolioSummary?.current_value, holdingsCurrentValue);
  const investedValue = numericOrFallback(portfolioSummary?.invested_value, holdingsInvestedValue);
  const totalPnl = numericOrFallback(portfolioSummary?.total_pnl, holdingsPnl);
  const hasActiveHoldings = activeHoldings.length > 0;
  const trendData = buildPortfolioTrendData({
    holdings: activeHoldings,
    investedValue,
    totalValue,
    interval: trendInterval,
  });

  const holdingsCount = hasActiveHoldings
    ? portfolioSummary?.holdings_count
      ? toNumber(portfolioSummary.holdings_count)
      : activeHoldings.length
    : 0;

  const pnlPercentage = investedValue > 0 ? (totalPnl / investedValue) * 100 : 0;
  const isPnlPositive = totalPnl >= 0;
  const connectionSuccess = liveResponse.connection_state === "connected";
  const isRateLimited = portfolioFetchState === "rate_limited";
  const hasSyncIssue =
    connectionSuccess &&
    (!liveResponse.success ||
      liveResponse.reason_code === "connected_partial" ||
      Boolean(errorMessage) ||
      Boolean(profileError) ||
      Boolean(portfolioError) ||
      portfolioFetchState === "failed" ||
      isRateLimited);

  const connectionStatusLabel = connectionSuccess
    ? hasSyncIssue
      ? isRateLimited
        ? "Connected / Rate Limited"
        : "Connected / Sync issue"
      : "Connected"
    : liveResponse.connection_state;
  const activeNavLabel =
    NAVIGATION_ITEMS.find((item) => item.id === activeNavItem)?.label ?? "Market";
  const accountName = profile ? stringValue(profile.display_name) : brokerName;
  const chatbotHoldings = useMemo<DashboardChatbotHolding[]>(
    () =>
      activeHoldings
        .map((holding) => ({
          symbol: stringValue(holding.symbol),
          quantity: toNumber(holding.quantity),
          pnl: holdingPnlValue(holding),
        }))
        .sort((left, right) => Math.abs(right.pnl) - Math.abs(left.pnl))
        .slice(0, 5),
    [activeHoldings],
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#0B201F] text-[#FFFFFFB3] font-sans selection:bg-[#C4E456] selection:text-[#0B201F]">
        <Sidebar
          variant="sidebar"
          collapsible="offcanvas"
          className="bg-[#0B201F] border-r border-[#2B4E44]"
        >
          <div className="h-16 px-6 border-b border-[#2B4E44] flex items-center gap-3 shrink-0">
            <ClearframeBrand />
          </div>

          <SidebarContent className="bg-[#0B201F] px-2 py-4 flex-1 overflow-y-auto">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {NAVIGATION_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNavItem === item.id;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          className={`h-11 px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${isActive
                            ? "bg-[#C4E456]/10 text-[#C4E456] font-medium hover:bg-[#C4E456]/20 hover:text-[#C4E456]"
                            : "text-[#FFFFFFB3] hover:bg-[#FFFFFF]/5 hover:text-[#F6F9F2]"
                            }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveNavItem(item.id)}
                            aria-current={isActive ? "page" : undefined}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <Icon className="w-5 h-5" />
                            <span>{item.label}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-[#2B4E44] px-6 py-5">
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor] ${connectionSuccess ? "bg-[#C4E456]" : "bg-[#EB316F]"
                  }`}
              />
              <p className="text-sm font-medium text-[#F6F9F2]">{brokerName}</p>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#0B201F]">
          <header className="h-16 shrink-0 border-b border-[#2B4E44] px-8 flex items-center justify-between bg-[#0B201F]/80 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-[#FFFFFFB3] hover:text-[#F6F9F2] -ml-2" />
              <Routes>
                <Route path="/dashboard/stock/:symbol" element={
                  <button 
                    onClick={() => window.history.back()} 
                    className="flex items-center gap-1.5 text-[#FFFFFFB3] hover:text-[#C4E456] transition-colors font-semibold uppercase tracking-wider text-sm border-l border-[#2B4E44] pl-4 ml-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15h-6v4l-7-7 7-7v4h6v6z"/></svg>
                    Back
                  </button>
                } />
              </Routes>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification bell dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Notifications"
                    className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#2B4E44] bg-[#0B201F] text-[#FFFFFFB3] transition-colors hover:border-[#416133] hover:text-[#F6F9F2]"
                  >
                    <Bell className="h-4 w-4" />
                    {hasSyncIssue && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#C4E456] shadow-[0_0_6px_#C4E456]" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72 rounded-xl border border-[#2B4E44] bg-[#102825] p-2 text-[#F6F9F2] shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
                >
                  <DropdownMenuLabel className="px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-[#FFFFFF80]">
                    Notifications
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#2B4E44]" />
                  {!hasSyncIssue ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <Bell className="h-6 w-6 text-[#FFFFFF30]" />
                      <p className="text-sm font-medium text-[#FFFFFFB3]">No notifications</p>
                      <p className="text-xs text-[#FFFFFF40]">You're all caught up!</p>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {isRateLimited && (
                        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2.5">
                          <p className="text-xs font-semibold text-yellow-400">Rate Limited</p>
                          <p className="mt-0.5 text-xs text-[#FFFFFFB3]">Angel One API rate limit reached. Data may be delayed.</p>
                        </div>
                      )}
                      {portfolioError && (
                        <div className="rounded-lg bg-[#EB316F]/10 border border-[#EB316F]/20 px-3 py-2.5">
                          <p className="text-xs font-semibold text-[#EB316F]">Portfolio Sync Failed</p>
                          <p className="mt-0.5 text-xs text-[#FFFFFFB3]">{portfolioError}</p>
                        </div>
                      )}
                      {profileError && (
                        <div className="rounded-lg bg-[#EB316F]/10 border border-[#EB316F]/20 px-3 py-2.5">
                          <p className="text-xs font-semibold text-[#EB316F]">Profile Sync Failed</p>
                          <p className="mt-0.5 text-xs text-[#FFFFFFB3]">{profileError}</p>
                        </div>
                      )}
                      {errorMessage && (
                        <div className="rounded-lg bg-[#EB316F]/10 border border-[#EB316F]/20 px-3 py-2.5">
                          <p className="text-xs font-semibold text-[#EB316F]">Connection Error</p>
                          <p className="mt-0.5 text-xs text-[#FFFFFFB3]">{errorMessage}</p>
                        </div>
                      )}
                      {liveResponse.reason_code === "connected_partial" && !portfolioError && !profileError && !errorMessage && !isRateLimited && (
                        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2.5">
                          <p className="text-xs font-semibold text-yellow-400">Partial Connection</p>
                          <p className="mt-0.5 text-xs text-[#FFFFFFB3]">Some data may be unavailable. Try refreshing.</p>
                        </div>
                      )}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open account menu"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2B4E44] bg-[#0B201F] text-xs font-bold uppercase text-[#F6F9F2] transition-colors hover:border-[#416133] hover:text-[#C4E456]"
                  >
                    {initials(profile?.display_name)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-xl border border-[#2B4E44] bg-[#102825] p-2 text-[#F6F9F2] shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
                >
                  <DropdownMenuLabel className="px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-[#FFFFFF80]">
                    Account
                  </DropdownMenuLabel>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-[#F6F9F2]">{stringValue(profile?.display_name)}</p>
                    <p className="mt-1 text-xs text-[#FFFFFFB3]">
                      Client Code: <span className="text-[#C4E456]">{stringValue(profile?.client_code)}</span>
                    </p>
                    <p className={`mt-3 text-xs font-medium ${connectionSuccess ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                      {brokerName} : {connectionStatusLabel}
                    </p>
                  </div>
                  <DropdownMenuSeparator className="bg-[#2B4E44]" />
                  <DropdownMenuItem
                    onSelect={() => onDisconnect()}
                    disabled={isDisconnecting}
                    variant="destructive"
                    className="rounded-lg px-3 py-2 text-sm"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {isDisconnecting ? "Disconnecting..." : "Disconnect Broker"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <section className="flex-1 overflow-y-auto p-8">
            {activeNavItem === "portfolio" ? (
              <div className="space-y-8">
                {(errorMessage || profileError || portfolioError || portfolioFetchState === "failed") && (
                  <div className="rounded-xl border border-[#EB316F]/30 bg-[#EB316F]/10 px-4 py-3 text-sm text-[#F6F9F2]">
                    <p className="font-semibold text-[#EB316F]">Sync Error</p>
                    <p className="mt-1 text-[#FFFFFFB3]">
                      {errorMessage ?? profileError ?? portfolioError ?? "Failed to fetch portfolio data"}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[#F6F9F2]">Your Portfolio</h1>
                    <button
                      onClick={() => void onRefresh()}
                      disabled={isRefreshing}
                      className="bg-[#C4E456] hover:bg-[#C4E456]/90 text-[#0B201F] px-4 py-2 rounded-lg font-semibold text-sm transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      {isRefreshing ? "Syncing..." : "Refresh"}
                    </button>
                  </div>

                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                  >
                    <motion.div
                      variants={itemVariants}
                      className="bg-[#FFFFFF]/5 border border-[#2B4E44] p-6 rounded-xl hover:border-[#416133] transition-colors"
                    >
                      <p className="text-[#FFFFFFB3] text-xs uppercase tracking-widest mb-2">Current Value</p>
                      <h2 className="text-2xl font-bold text-[#F6F9F2]">{formatCurrency(totalValue)}</h2>
                      <div className="mt-4 flex items-center gap-1 text-[#C4E456] text-sm font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path
                            clipRule="evenodd"
                            d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                            fillRule="evenodd"
                          />
                        </svg>
                        Live value
                      </div>
                    </motion.div>

                    <motion.div
                      variants={itemVariants}
                      className="bg-[#FFFFFF]/5 border border-[#2B4E44] p-6 rounded-xl hover:border-[#416133] transition-colors"
                    >
                      <p className="text-[#FFFFFFB3] text-xs uppercase tracking-widest mb-2">Total Invested</p>
                      <h2 className="text-2xl font-bold text-[#F6F9F2]">{formatCurrency(investedValue)}</h2>
                      <p className="mt-4 text-[#FFFFFFB3] text-sm">Amount invested</p>
                    </motion.div>

                    <motion.div
                      variants={itemVariants}
                      className="bg-[#FFFFFF]/5 border border-[#2B4E44] p-6 rounded-xl hover:border-[#416133] transition-colors"
                    >
                      <p className="text-[#FFFFFFB3] text-xs uppercase tracking-widest mb-2">Total Returns</p>
                      <h2 className={`text-2xl font-bold ${isPnlPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                        {isPnlPositive ? "+" : ""}
                        {formatCurrency(totalPnl)}
                      </h2>
                      <div
                        className={`mt-4 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${isPnlPositive ? "bg-[#C4E456]/20 text-[#C4E456]" : "bg-[#EB316F]/20 text-[#EB316F]"
                          }`}
                      >
                        {isPnlPositive ? "+" : ""}
                        {formatPercent(pnlPercentage)}
                      </div>
                    </motion.div>

                    <motion.div
                      variants={itemVariants}
                      className="bg-[#FFFFFF]/5 border border-[#2B4E44] p-6 rounded-xl hover:border-[#416133] transition-colors"
                    >
                      <p className="text-[#FFFFFFB3] text-xs uppercase tracking-widest mb-2">Total Assets</p>
                      <h2 className="text-2xl font-bold text-[#F6F9F2]">{formatNumber(holdingsCount)}</h2>
                      <p className="mt-4 text-[#FFFFFFB3] text-sm">Number of investments</p>
                    </motion.div>
                  </motion.div>
                </div>

                <div className="bg-[#FFFFFF]/5 border border-[#2B4E44] rounded-xl p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-semibold text-[#F6F9F2]">Portfolio Performance</h3>
                      <p className="mt-1 text-xs text-[#FFFFFF80]">Derived from current portfolio value and PnL snapshot</p>
                    </div>
                    <div className="flex bg-[#0009] p-1 rounded-lg border border-[#2B4E44]">
                      {(["3M", "30D", "7D"] as TrendInterval[]).map((interval) => (
                        <button
                          key={interval}
                          type="button"
                          onClick={() => setTrendInterval(interval)}
                          className={`px-4 py-1 text-xs font-medium rounded-md transition-colors ${trendInterval === interval
                            ? "bg-[#2B4E44] text-[#F6F9F2] shadow-sm"
                            : "text-[#FFFFFFB3] hover:text-[#F6F9F2]"
                            }`}
                        >
                          {interval === "3M" ? "Last 3 months" : interval === "30D" ? "Last 30 days" : "Last 7 days"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full h-48 relative">
                    {!hasActiveHoldings ? (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#2B4E44] bg-[#0009] px-6 text-center">
                        <div>
                          <p className="text-sm font-medium text-[#F6F9F2]">No portfolio performance data</p>
                          <p className="mt-2 text-xs text-[#FFFFFFB3]">
                            This account has no active holdings yet, so the performance chart is hidden.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <HoldingsTrendChart data={trendData} interval={trendInterval} />
                    )}
                  </div>
                </div>

                <div className="bg-[#FFFFFF]/5 border border-[#2B4E44] rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#2B4E44] flex items-center justify-between bg-[#FFFFFF]/5">
                    <h3 className="font-semibold text-[#F6F9F2]">Your Holdings</h3>
                    <div className="flex items-center gap-2 text-[#FFFFFFB3] text-sm">{activeHoldings.length} assets tracked</div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                      <colgroup>
                        <col style={{ width: "18%" }} />
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "16%" }} />
                        <col style={{ width: "16%" }} />
                        <col style={{ width: "17%" }} />
                      </colgroup>
                      <thead>
                        <tr className="text-[11px] uppercase tracking-widest text-[#FFFFFFB3] border-b border-[#2B4E44] bg-[#0009]">
                          <th className="px-6 py-4 font-bold truncate">Symbol</th>
                          <th className="px-6 py-4 font-bold">Qty</th>
                          <th className="px-6 py-4 font-bold">Avg Price</th>
                          <th className="px-6 py-4 font-bold">LTP</th>
                          <th className="px-6 py-4 font-bold">Invested</th>
                          <th className="px-6 py-4 font-bold">Current</th>
                          <th className="px-6 py-4 font-bold text-right">PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2B4E44]/50 text-sm">
                        {activeHoldings.length > 0 ? (
                          activeHoldings.map((holding, index) => {
                            const holdingQty = toNumber(holding.quantity);
                            const avgPrice = toNumber(holding.average_price);
                            const ltp = toNumber(holding.last_traded_price);
                            const invVal = holdingInvestedValue(holding) || holdingQty * avgPrice;
                            const curVal = holdingCurrentValue(holding) || holdingQty * ltp;
                            const pnl = holdingPnlValue(holding) || curVal - invVal;
                            const percentChange = invVal > 0 ? (pnl / invVal) * 100 : 0;
                            const isPos = pnl >= 0;

                            return (
                              <tr key={`${stringValue(holding.symbol)}-${index}`} className="hover:bg-[#FFFFFF]/5 transition-colors">
                                <td className="px-6 py-4 font-semibold text-[#F6F9F2] truncate">{stringValue(holding.symbol)}</td>
                                <td className="px-6 py-4 tabular-nums whitespace-nowrap">{formatNumber(holdingQty)}</td>
                                <td className="px-6 py-4 font-mono tabular-nums whitespace-nowrap text-[#FFFFFFB3]">{formatCurrency(avgPrice)}</td>
                                <td className="px-6 py-4 font-mono tabular-nums whitespace-nowrap text-[#F6F9F2]">{formatCurrency(ltp)}</td>
                                <td className="px-6 py-4 font-mono tabular-nums whitespace-nowrap text-[#FFFFFFB3]">{formatCurrency(invVal)}</td>
                                <td className="px-6 py-4 font-mono tabular-nums whitespace-nowrap text-[#F6F9F2]">{formatCurrency(curVal)}</td>
                                <td className="px-6 py-4 text-right align-top">
                                  <span className={`font-bold font-mono tabular-nums whitespace-nowrap ${isPos ? "text-[#8CFCBA]" : "text-[#EB316F]"}`}>
                                    {isPos ? "+" : ""}{formatCurrency(pnl)}
                                  </span>
                                  <span className="text-[10px] block tabular-nums text-[#FFFFFFB3] mt-0.5">
                                    {isPos ? "+" : ""}{formatPercent(percentChange)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-sm text-[#FFFFFFB3]">
                              No assets found in this account.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-[#0009] text-sm font-bold border-t border-[#2B4E44]">
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-right text-[#FFFFFFB3] uppercase tracking-widest text-xs whitespace-nowrap">
                            Total Value
                          </td>
                          <td className="px-6 py-4 font-mono tabular-nums whitespace-nowrap text-[#F6F9F2]">{formatCurrency(investedValue)}</td>
                          <td className="px-6 py-4 font-mono tabular-nums whitespace-nowrap text-[#F6F9F2]">{formatCurrency(totalValue)}</td>
                          <td className={`px-6 py-4 text-right font-bold font-mono tabular-nums whitespace-nowrap ${isPnlPositive ? "text-[#C4E456]" : "text-[#EB316F]"}`}>
                            {isPnlPositive ? "+" : ""}{formatCurrency(totalPnl)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeNavItem === "market" ? (
              <Suspense fallback={<ContentLoadingState />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <DashboardTab
                        holdings={holdings}
                        totalValue={totalValue}
                        investedValue={investedValue}
                        totalPnl={totalPnl}
                        pnlPercentage={pnlPercentage}
                        isPnlPositive={isPnlPositive}
                      />
                    }
                  />
                  <Route path="/dashboard/stock/:symbol" element={<StockDetailPage />} />
                </Routes>
              </Suspense>
            ) : activeNavItem === "assistant" ? (
              <FeaturePlaceholder
                activeNavLabel={activeNavLabel}
                title="AI copilot for market research"
                description="Use this space for stock explainers, thesis comparisons, and portfolio-aware market questions grounded in your connected broker data."
              />
            ) : activeNavItem === "analysis" ? (
              <FeaturePlaceholder
                activeNavLabel={activeNavLabel}
                title="Deep-dive analytics workspace"
                description="This tab is ready for sector exposure, factor leadership, P&L attribution, and stock-level insight breakdowns."
              />
            ) : activeNavItem === "learning" ? (
              <FeaturePlaceholder
                activeNavLabel={activeNavLabel}
                title="Learning hub for smarter analysis"
                description="Use this area for guided lessons, market explainers, and bite-sized education tied to current stocks and sectors."
              />
            ) : activeNavItem === "watchlist" ? (
              <Suspense fallback={<ContentLoadingState />}>
                <WatchlistTab />
              </Suspense>
            ) : (
              <FeaturePlaceholder
                activeNavLabel={activeNavLabel}
                title="No data on this tab"
                description="This tab is intentionally empty."
              />
            )}
          </section>
        </main>

        {shouldLoadChatbot ? (
          <Suspense fallback={null}>
            <FloatingDashboardChatbot
              accountName={accountName}
              holdings={chatbotHoldings}
              totalValue={totalValue}
              investedValue={investedValue}
              totalPnl={totalPnl}
              pnlPercentage={pnlPercentage}
              connectionLabel={connectionStatusLabel}
            />
          </Suspense>
        ) : null}
      </div>
    </SidebarProvider>
  );
}

function HoldingsTrendChart({
  data,
  interval,
}: {
  data: PortfolioTrendPoint[];
  interval: TrendInterval;
}) {
  const { areaPath, linePath, points, maxValue, minValue } = useMemo(
    () => buildTrendChartGeometry(data),
    [data],
  );

  const lastPoint = points.at(-1);

  return (
    <div className="h-full w-full rounded-xl border border-[#2B4E44] bg-[#081514]/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.2em] text-[#FFFFFF66]">
          {interval === "3M" ? "Last 3 Months" : interval === "30D" ? "Last 30 Days" : "Last 7 Days"}
        </div>
        <div className="text-right">
          <div className="text-[11px] text-[#FFFFFF66]">Range</div>
          <div className="text-sm font-medium text-[#F6F9F2]">
            {formatCurrency(minValue)} to {formatCurrency(maxValue)}
          </div>
        </div>
      </div>

      <div className="relative h-[160px] w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="portfolioTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8CFCBA" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8CFCBA" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d="M0 84 H100" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
          <path d="M0 56 H100" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
          <path d="M0 28 H100" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4" />

          <path d={areaPath} fill="url(#portfolioTrendFill)" />
          <path
            d={linePath}
            fill="none"
            stroke="#8CFCBA"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {lastPoint ? (
            <circle cx={lastPoint.x} cy={lastPoint.y} r="2.6" fill="#8CFCBA" />
          ) : null}
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-[#FFFFFF66]">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data.at(-1)?.date}</span>
      </div>
    </div>
  );
}

function ContentLoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="h-56 animate-pulse rounded-2xl border border-[#2B4E44] bg-[#102825]" />
      <div className="h-56 animate-pulse rounded-2xl border border-[#2B4E44] bg-[#102825]" />
    </div>
  );
}

function FeaturePlaceholder({
  activeNavLabel,
  title,
  description,
}: {
  activeNavLabel: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-full items-center justify-center">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-3xl rounded-[28px] border border-[#2B4E44] bg-[#FFFFFF]/5 p-8 md:p-12"
      >
        <motion.div variants={itemVariants} className="mx-auto max-w-xl text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8CFCBA]">{activeNavLabel}</p>
          <h1 className="mt-4 text-3xl font-bold text-[#F6F9F2] md:text-4xl">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-[#FFFFFFB3]">{description}</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

function resolveProfile(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  if (value.profile && typeof value.profile === "object" && !Array.isArray(value.profile)) {
    return value.profile as Record<string, unknown>;
  }
  if (value.display_name || value.client_code) return value;
  return null;
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function numericOrFallback(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? fallback : numeric;
}

function holdingInvestedValue(holding: Record<string, unknown>): number {
  const quantity = toNumber(holding.quantity);
  const averagePrice = toNumber(holding.average_price);
  return numericOrFallback(holding.invested_value, quantity * averagePrice);
}

function holdingCurrentValue(holding: Record<string, unknown>): number {
  const quantity = toNumber(holding.quantity);
  const lastTradedPrice = toNumber(holding.last_traded_price);
  return numericOrFallback(holding.current_value, quantity * lastTradedPrice);
}

function holdingPnlValue(holding: Record<string, unknown>): number {
  const investedValue = holdingInvestedValue(holding);
  const currentValue = holdingCurrentValue(holding);
  return numericOrFallback(holding.pnl, currentValue - investedValue);
}

function holdingHasPosition(holding: Record<string, unknown>): boolean {
  return (
    toNumber(holding.quantity) > 0 ||
    holdingInvestedValue(holding) > 0 ||
    holdingCurrentValue(holding) > 0
  );
}

function applyMarketTick(
  response: BrokerApiResponse,
  tick: MarketTickMessage,
): BrokerApiResponse {
  const data = asRecord(response.data);
  if (!data) {
    return response;
  }

  const holdings = asRecords(data.holdings).map((holding) => {
    if (stringValue(holding.symbol).toUpperCase() !== tick.symbol.toUpperCase()) {
      return holding;
    }

    const quantity = toNumber(holding.quantity);
    const averagePrice = toNumber(holding.average_price);
    const currentValue = quantity * tick.ltp;
    const investedValue = quantity * averagePrice;

    // Append LTP to history for sparklines (cap at 60 points)
    const prevHistory = Array.isArray(holding._ltpHistory) ? (holding._ltpHistory as number[]) : [];
    const _ltpHistory = [...prevHistory, tick.ltp].slice(-60);

    return {
      ...holding,
      last_traded_price: tick.ltp,
      current_value: currentValue,
      invested_value: investedValue,
      pnl: currentValue - investedValue,
      _ltpHistory,
    };
  });

  const portfolioSummary = holdings.reduce<{
    current_value: number;
    invested_value: number;
    total_pnl: number;
    holdings_count: number;
  }>(
    (summary, holding) => {
      summary.current_value += holdingCurrentValue(holding);
      summary.invested_value += holdingInvestedValue(holding);
      summary.total_pnl += holdingPnlValue(holding);
      return summary;
    },
    {
      current_value: 0,
      invested_value: 0,
      total_pnl: 0,
      holdings_count: holdings.length,
    },
  );

  return {
    ...response,
    data: {
      ...data,
      holdings,
      portfolio_summary: portfolioSummary,
    },
  };
}

function buildTrendChartGeometry(data: PortfolioTrendPoint[]) {
  if (data.length === 0) {
    return {
      areaPath: "M0 100 L100 100 Z",
      linePath: "M0 100",
      points: [] as Array<{ x: number; y: number }>,
      maxValue: 0,
      minValue: 0,
    };
  }

  const values = data.map((point) => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;
  const points = data.map((point, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 88 - ((point.value - minValue) / range) * 64;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L100 100 L0 100 Z`;

  return { areaPath, linePath, points, maxValue, minValue };
}

function buildPortfolioTrendData({
  holdings,
  investedValue,
  totalValue,
  interval,
}: {
  holdings: Record<string, unknown>[];
  investedValue: number;
  totalValue: number;
  interval: TrendInterval;
}): PortfolioTrendPoint[] {
  const pointCount = interval === "7D" ? 7 : 6;
  const labels = buildTrendLabels(interval, pointCount);
  const startValue = investedValue > 0 ? investedValue : totalValue;
  const endValue = totalValue > 0 ? totalValue : investedValue;
  const safeEndValue = endValue > 0 ? endValue : 0;
  const change = safeEndValue - startValue;
  const volatility = deriveVolatilityFactor(holdings, safeEndValue || startValue || 1);
  const intervalAmplitude = interval === "7D" ? 0.45 : interval === "30D" ? 0.7 : 1;

  return labels.map((label, index) => {
    const progress = pointCount <= 1 ? 1 : index / (pointCount - 1);
    const seasonalSwing = Math.sin(progress * Math.PI * (interval === "7D" ? 1.4 : interval === "30D" ? 2.2 : 2.8));
    const secondarySwing = Math.cos(progress * Math.PI * (interval === "7D" ? 2.4 : interval === "30D" ? 3.2 : 4.4));
    const swing = (seasonalSwing * 0.65 + secondarySwing * 0.35) * volatility * intervalAmplitude;
    const interpolated = startValue + change * progress + swing;
    const clamped = Math.max(interpolated, 0);
    const value = index === 0 ? Math.max(startValue, 0) : index === pointCount - 1 ? Math.max(safeEndValue, 0) : clamped;

    return { date: label, value: roundCurrencyValue(value) };
  });
}

function buildTrendLabels(interval: TrendInterval, pointCount: number): string[] {
  const now = new Date();
  const stepDays = interval === "7D" ? 1 : interval === "30D" ? 6 : 18;

  return Array.from({ length: pointCount }, (_, index) => {
    const offset = (pointCount - index - 1) * stepDays;
    const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);

    if (interval === "7D") {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function deriveVolatilityFactor(holdings: Record<string, unknown>[], referenceValue: number): number {
  if (holdings.length === 0 || referenceValue <= 0) {
    return 0;
  }

  const totalAbsolutePnl = holdings.reduce((sum, holding) => sum + Math.abs(holdingPnlValue(holding)), 0);
  const normalized = totalAbsolutePnl / referenceValue;
  return Math.min(Math.max(normalized * 0.18, referenceValue * 0.0025), referenceValue * 0.12);
}

function roundCurrencyValue(value: number): number {
  return Math.round(value * 100) / 100;
}



function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function initials(value: unknown): string {
  const text = stringValue(value);
  if (text === "-") return "U";
  return text.slice(0, 2).toUpperCase();
}
