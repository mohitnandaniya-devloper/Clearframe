import { Suspense, lazy, useEffect, useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ClearframeBrand } from "@/components/brand/clearframe-brand";

import {
  connectBroker,
  disconnectBroker,
  fetchConnectedBrokerView,
  fetchBrokers,
  type BrokerApiResponse,
  type ConnectBrokerCredentials,
} from "@/lib/api/brokers";
const BrokerLoginForm = lazy(() =>
  import("./BrokerLoginForm").then((module) => ({ default: module.BrokerLoginForm })),
);
const PortfolioDashboard = lazy(() =>
  import("./PortfolioDashboard").then((module) => ({ default: module.PortfolioDashboard })),
);

const CONNECTED_VIEW_RETRY_DELAYS_MS = [0, 800, 1600, 2400];

export default function ConnectBrokerPage() {
  const [selectedBroker, setSelectedBroker] = useState<string | null>("angel_one");
  const [step, setStep] = useState<"selection" | "login" | "response">("selection");
  const [brokers, setBrokers] = useState<Awaited<ReturnType<typeof fetchBrokers>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingExistingConnection, setIsCheckingExistingConnection] = useState(false);
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionResponse, setConnectionResponse] = useState<BrokerApiResponse | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBrokers = async () => {
      setIsLoading(true);
      try {
        const availableBrokers = await fetchBrokers();
        if (!cancelled) {
          setBrokers(availableBrokers);
        }
      } catch (error) {
        if (!cancelled) {
          setConnectionError(
            error instanceof Error ? error.message : "Unable to load broker list",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadBrokers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedBroker || step !== "selection") {
      return;
    }

    const broker = brokers.find((item) => item.id === selectedBroker);
    if (!broker?.enabled) {
      return;
    }

    let cancelled = false;

    const loadExistingConnection = async () => {
      setIsCheckingExistingConnection(true);
      try {
        const connectedView = await resolveConnectedBrokerView(selectedBroker);
        if (cancelled || !connectedView) {
          return;
        }
        setConnectionResponse(connectedView);
        setConnectionError(null);
        setStep("response");
      } catch {
        if (!cancelled) {
          setConnectionError(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingExistingConnection(false);
        }
      }
    };

    void loadExistingConnection();

    return () => {
      cancelled = true;
    };
  }, [brokers, selectedBroker, step]);

  const handleConnect = () => {
    if (!selectedBroker) return;
    const broker = brokers.find((item) => item.id === selectedBroker);
    if (!broker?.enabled) return;
    setConnectionError(null);
    setStep("login");
  };

  const handleLoginSubmit = (credentials: ConnectBrokerCredentials) => {
    if (!selectedBroker) return;

    void (async () => {
      setIsConnecting(true);
      try {
        const response = await connectBroker(selectedBroker, credentials);
        const shouldLoadConnectedView =
          response.connection_state === "connected" || response.reason_code === "already_connected";

        setConnectionResponse(response);
        setConnectionError(null);
        setStep("response");

        if (shouldLoadConnectedView) {
          const connectedView = await resolveConnectedBrokerView(selectedBroker);
          setConnectionResponse(connectedView ?? response);
        }
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : "Connection failed");
        setConnectionResponse(null);
        setStep("response");
      } finally {
        setIsConnecting(false);
      }
    })();
  };

  const handleDisconnect = () => {
    if (!selectedBroker) return;

    void (async () => {
      setIsDisconnecting(true);
      try {
        await disconnectBroker(selectedBroker);
        setConnectionResponse(null);
        setConnectionError(null);
        setStep("selection");
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : "Disconnect failed");
      } finally {
        setIsDisconnecting(false);
      }
    })();
  };

  const handleRefreshDashboard = async () => {
    if (!selectedBroker) return;

    setIsRefreshingDashboard(true);
    try {
      const connectedView = await resolveConnectedBrokerView(selectedBroker);
      if (!connectedView) {
        setConnectionResponse(null);
        setConnectionError("Broker session is no longer active.");
        setStep("selection");
        return;
      }

      setConnectionResponse(connectedView);
      setConnectionError(null);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Unable to refresh broker data");
    } finally {
      setIsRefreshingDashboard(false);
    }
  };

  const isConnectedDashboard = step === "response" && selectedBroker && connectionResponse?.connection_state === "connected";

  if (isConnectedDashboard) {
    return (
      <Suspense fallback={<DashboardLoadingState />}>
        <PortfolioDashboard
          brokerName={brokers.find(b => b.id === selectedBroker)?.name || "Broker"}
          response={connectionResponse!}
          onDisconnect={handleDisconnect}
          onRefresh={handleRefreshDashboard}
          isDisconnecting={isDisconnecting}
          isRefreshing={isRefreshingDashboard}
          errorMessage={connectionError}
        />
      </Suspense>
    );
  }

  // Animation variants for Framer Motion
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0B201F] text-[#F6F9F2] font-sans m-0 p-0 overflow-x-hidden">
      <header className="w-full flex items-center justify-between px-6 py-4 lg:px-12 shrink-0 border-b border-[#2B4E44]">
        <ClearframeBrand titleClassName="text-xl font-bold tracking-tight text-[#F6F9F2]" />
      </header>

      {/* Main Content - Force it to take up the remaining viewport height strictly centering content */}
      <main className="flex-1 w-full flex flex-col items-center justify-center px-4 md:px-6 py-8 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">

          {step === "login" && selectedBroker ? (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <Suspense fallback={<LoginLoadingState />}>
                <BrokerLoginForm
                  brokerName={brokers.find(b => b.id === selectedBroker)?.name || "Broker"}
                  onBack={() => setStep("selection")}
                  onSubmit={handleLoginSubmit}
                  isConnecting={isConnecting}
                />
              </Suspense>
              </motion.div>
          ) : step === "response" && selectedBroker ? (
            <motion.div
              key="response-page"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="w-full flex justify-center"
            >
              {connectionResponse ? (
                <div className="w-full max-w-[640px] rounded-2xl border border-[#EB316F]/40 bg-[#EB316F]/10 p-6 text-[#F6F9F2]">
                  <h3 className="text-[24px] font-medium mb-2 text-[#EB316F]">Connection Failed</h3>
                  <p className="text-base text-[#FFFFFFB3]">{connectionResponse.message || "We couldn't connect to your broker. Please check your details and try again."}</p>
                  <div className="mt-6 flex gap-4">
                    <Button
                      onClick={() => setStep("login")}
                      className="bg-[#C4E456] hover:bg-[#C4E456]/90 text-[#0B201F] font-medium"
                    >
                      Try Again
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setConnectionResponse(null);
                        setConnectionError(null);
                        setStep("selection");
                      }}
                      className="border-[#2B4E44] text-[#F6F9F2] hover:bg-[#FFFFFF]/5 hover:text-[#F6F9F2]"
                    >
                      Choose Another Broker
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-[640px] rounded-2xl border border-[#EB316F]/40 bg-[#EB316F]/10 p-6 text-[#F6F9F2]">
                  <h3 className="text-[24px] font-medium mb-2 text-[#EB316F]">Connection Failed</h3>
                  <p className="text-base text-[#FFFFFFB3]">{connectionError ?? "We didn't receive a valid response from the broker."}</p>
                  <div className="mt-6">
                    <Button
                      onClick={() => setStep("login")}
                      className="bg-[#C4E456] hover:bg-[#C4E456]/90 text-[#0B201F] font-medium"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="selection-grid"
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              variants={containerVariants}
              className="w-full flex flex-col items-center"
            >
              {/* Typography Section */}
              <motion.div variants={itemVariants} className="text-center mb-10 w-full">
                <h2 className="text-[40px] lg:text-[56px] font-semibold mb-4 text-[#F6F9F2] tracking-tight leading-tight">
                  Connect Your Broker
                </h2>
                <p className="text-[#FFFFFFB3] text-[16px] lg:text-[18px] max-w-md mx-auto px-4 font-normal leading-relaxed">
                  Choose your broker to securely link your account and sync your portfolio.
                </p>
              </motion.div>

              {/* Broker Grid */}
              <div className="w-full max-w-3xl">
                {isLoading ? (
                  <motion.div variants={itemVariants} className="flex justify-center items-center py-12">
                    <p className="text-muted-foreground animate-pulse text-[#FFFFFFB3]">
                      Loading available brokers...
                    </p>
                  </motion.div>
                ) : (
                  <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full">
                    {brokers.map((broker) => {
                      const isSelected = selectedBroker === broker.id;
                      return (
                        <motion.div key={broker.id} variants={itemVariants}>
                          <Card
                            onClick={() => broker.enabled && setSelectedBroker(broker.id)}
                            className={`group relative border transition-all duration-300 cursor-pointer overflow-hidden ${isSelected
                                ? "border-[#C4E456] shadow-[0_8px_30px_rgb(196,228,86,0.15)] bg-[#2B4E44] scale-[1.02] z-10"
                                : broker.enabled
                                  ? "border-[#2B4E44] shadow-sm hover:border-[#416133] hover:shadow-md hover:bg-[#2B4E44]/50 bg-[#0B201F]"
                                  : "border-[#2B4E44] bg-[#0B201F]/70 opacity-60 cursor-not-allowed"
                              }`}
                            style={{ borderRadius: "16px" }}
                          >
                            <CardContent className="p-5 md:p-6 flex flex-col items-center text-center">
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute top-3 right-3 text-[#C4E456]"
                                >
                                  <CheckCircle2 className="w-5 h-5 fill-[#C4E456] text-[#0B201F]" />
                                </motion.div>
                              )}
                              <div className="size-12 md:size-14 mb-4 rounded-full bg-[#F6F9F2] flex items-center justify-center shadow-inner border border-[#E6ECD6]">
                                <img
                                  alt={`${broker.name} Logo`}
                                  className="w-7 h-7 md:w-9 md:h-9 object-contain rounded-full"
                                  src={broker.logoSrc}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = `<span class="font-bold text-xl text-[#0B201F]">${broker.name.charAt(0)}</span>`;
                                  }}
                                />
                              </div>
                              <h3 className="text-base md:text-lg font-medium mb-1 text-[#F6F9F2] leading-tight">{broker.name}</h3>
                              <p className="text-xs text-[#FFFFFFB3]">{broker.tagline}</p>
                              {!broker.enabled && <p className="mt-2 text-[11px] text-[#FFFFFFB3]">Coming Soon</p>}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>

              {/* Action Button Segment */}
              <motion.div variants={itemVariants} className="w-full max-w-sm mt-10 min-h-[100px]">
                <div
                  className={`w-full transition-all duration-500 ease-in-out ${selectedBroker && !isLoading ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
                    }`}
                >
                  <Button
                    size="lg"
                    onClick={handleConnect}
                    disabled={isCheckingExistingConnection || !brokers.find((item) => item.id === selectedBroker)?.enabled}
                    className="w-full h-14 md:h-16 text-[16px] font-medium shadow-[0_8px_30px_rgb(196,228,86,0.2)] flex items-center justify-center gap-2 group rounded-xl bg-[#C4E456] hover:bg-[#C4E456]/90 text-[#0B201F]"
                    style={{ borderRadius: "16px" }}
                  >
                    <span>
                      {isCheckingExistingConnection ? "Connecting securely..." : `Connect ${brokers.find((b) => b.id === selectedBroker)?.name}`}
                    </span>
                    {!isCheckingExistingConnection && <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />}
                  </Button>
                  <p className="text-center text-xs text-[#FFFFFFB3] mt-4 px-2">
                    By connecting, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center border-t border-[#2B4E44] mt-auto shrink-0 bg-[#0B201F]">
        <p className="text-[13px] text-[#FFFFFFB3]">© 2026 Clear Frame Inc. All investments carry risk.</p>
      </footer>
    </div>
  );
}

function LoginLoadingState() {
  return (
    <div className="mx-auto w-full max-w-[640px] rounded-3xl border border-[#2B4E44] bg-[#102825] p-8">
      <div className="h-4 w-28 animate-pulse rounded-full bg-[#FFFFFF1A]" />
      <div className="mt-6 space-y-4">
        <div className="h-12 animate-pulse rounded-2xl bg-[#FFFFFF12]" />
        <div className="h-12 animate-pulse rounded-2xl bg-[#FFFFFF12]" />
        <div className="h-12 animate-pulse rounded-2xl bg-[#FFFFFF12]" />
      </div>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="flex min-h-screen bg-[#0B201F] text-[#F6F9F2]">
      <div className="hidden w-72 border-r border-[#2B4E44] bg-[#0B201F] md:block" />
      <div className="flex-1 p-8">
        <div className="h-12 w-64 animate-pulse rounded-2xl bg-[#FFFFFF12]" />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-[#2B4E44] bg-[#102825]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

async function resolveConnectedBrokerView(brokerId: string): Promise<BrokerApiResponse | null> {
  for (const delayMs of CONNECTED_VIEW_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    const connectedView = await fetchConnectedBrokerView(brokerId);
    if (connectedView) {
      return connectedView;
    }
  }

  return null;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}
