import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShellSkeleton } from "@/components/loading/page-skeletons";
import { TooltipProvider } from "@/components/ui/tooltip";

const ConnectBrokerPage = lazy(() => import("@/pages/broker/ConnectBrokerPage"));

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<AppShellSkeleton />}>
          <Routes>
            <Route path="/*" element={<ConnectBrokerPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
}
