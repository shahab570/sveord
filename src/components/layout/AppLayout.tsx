import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { BookOpen } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();

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
      <main className="flex-1 md:ml-64 min-h-screen p-4 md:p-8 safe-top mb-16 md:mb-0">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
