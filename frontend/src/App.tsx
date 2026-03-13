import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

const ConnectBrokerPage = lazy(() => import("@/pages/broker/ConnectBrokerPage"));

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<AppShellFallback />}>
          <Routes>
            <Route path="/*" element={<ConnectBrokerPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
}

function AppShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B201F] px-6 text-[#F6F9F2]">
      <div className="w-full max-w-md rounded-2xl border border-[#2B4E44] bg-[#102825] p-6">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[#FFFFFF1A]" />
        <div className="mt-6 space-y-3">
          <div className="h-12 animate-pulse rounded-xl bg-[#FFFFFF12]" />
          <div className="h-12 animate-pulse rounded-xl bg-[#FFFFFF12]" />
          <div className="h-12 animate-pulse rounded-xl bg-[#FFFFFF12]" />
        </div>
      </div>
    </div>
  );
}
