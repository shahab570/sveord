import { Suspense } from "react";
import { lazyRetry } from "@/utils/lazyRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PopulationProvider } from "@/contexts/PopulationContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { BookOpen } from "lucide-react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";

// Lazy load pages with automatic retry
const Auth = lazyRetry(() => import("./pages/Auth"), "Auth");
const PendingApproval = lazyRetry(() => import("./pages/PendingApproval"), "PendingApproval");
const AdminDashboard = lazyRetry(() => import("./pages/AdminDashboard"), "AdminDashboard");
const Dashboard = lazyRetry(() => import("./pages/Dashboard"), "Dashboard");
const KellyList = lazyRetry(() => import("./pages/KellyList"), "KellyList");
const FrequencyList = lazyRetry(() => import("./pages/FrequencyList"), "FrequencyList");
const SidorList = lazyRetry(() => import("./pages/SidorList"), "SidorList");
const SearchPage = lazyRetry(() => import("./pages/SearchPage"), "SearchPage");
const Practice = lazyRetry(() => import("./pages/Practice"), "Practice");
const FTList = lazyRetry(() => import("./pages/FTList"), "FTList");
const Settings = lazyRetry(() => import("./pages/Settings"), "Settings");
const NotFound = lazyRetry(() => import("./pages/NotFound"), "NotFound");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Prevent heavy reloading on tab switch
      retry: 1,
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
                  <Route path="/pending-approval" element={<PendingApproval />} />

                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/kelly" element={<KellyList />} />
                    <Route path="/frequency" element={<FrequencyList />} />
                    <Route path="/sidor" element={<SidorList />} />
                    <Route path="/ft" element={<FTList />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/practice" element={<Practice />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  {/* Admin Routes */}
                  <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                  </Route>

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
