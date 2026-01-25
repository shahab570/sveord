import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PopulationProvider } from "@/contexts/PopulationContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { BookOpen } from "lucide-react";

// Lazy load pages
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const KellyList = lazy(() => import("./pages/KellyList"));
const FrequencyList = lazy(() => import("./pages/FrequencyList"));
const SidorList = lazy(() => import("./pages/SidorList"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const Practice = lazy(() => import("./pages/Practice"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: true,
    },
  },
});

const LoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background safe-top safe-bottom">
    <div className="animate-pulse">
      <BookOpen className="h-12 w-12 text-primary" />
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SyncProvider>
            <PopulationProvider>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/kelly" element={<KellyList />} />
                  <Route path="/frequency" element={<FrequencyList />} />
                  <Route path="/sidor" element={<SidorList />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PopulationProvider>
          </SyncProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
