import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { BookOpen } from "lucide-react";
import { AlertTriangle } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const missingSupabaseConfig =
    !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background safe-top safe-bottom">
        <div className="animate-pulse">
          <BookOpen className="h-12 w-12 text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <AppSidebar />
      <main className="flex-1 md:ml-64 min-h-screen p-4 md:p-8 safe-top mb-16 md:mb-0 pb-safe-bottom space-y-4">
        {missingSupabaseConfig && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-medium">Supabase config missing</p>
              <p className="text-sm">
                Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env to enable cloud sync.
              </p>
            </div>
          </div>
        )}
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
