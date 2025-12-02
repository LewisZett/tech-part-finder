import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CategoryProvider } from "@/contexts/CategoryContext";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Browse from "./pages/Browse";
import MyListings from "./pages/MyListings";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import MyRequests from "./pages/MyRequests";
import Orders from "./pages/Orders";
import Reviews from "./pages/Reviews";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CategoryProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/my-listings" element={<MyListings />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/my-requests" element={<MyRequests />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CategoryProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
