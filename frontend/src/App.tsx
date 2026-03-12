import { BrowserRouter, Routes, Route } from "react-router-dom";
import ConnectBrokerPage from "@/pages/broker/ConnectBrokerPage";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<ConnectBrokerPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}