import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import {
  BarChart3,
  Settings,
  LogOut,
  Hash,
  GraduationCap,
  BookMarked,
  BrainCircuit,
  Shield,
  Sparkles,
  Bookmark,
  Book,
  Cloud,
  Wifi,
  WifiOff,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/dictionary", label: "Dictionary", icon: Book },
  { href: "/practice", label: "Practice", icon: BrainCircuit },
  { href: "/reserved-study", label: "Study Later Queue", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();
  const { isSyncing, lastSyncTime, queueStatus, clearFailedOperations, retryFailedOperations } = useSync();

  const formatLastSync = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border hidden md:block safe-top">
      <div className="flex h-full flex-col">
        {/* Logo - Text only */}
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <span className="text-xl font-bold text-sidebar-foreground">
              SveOrd
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`nav-link ${isActive ? "nav-link-active" : ""}`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className={`nav-link ${location.pathname === "/admin" ? "nav-link-active" : ""}`}
            >
              <Shield className="h-5 w-5" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Sync Status */}
        <div className="px-4 py-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            {isSyncing || queueStatus.processing ? (
              <>
                <Cloud className="h-3 w-3 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3" />
                <span>Last sync: {formatLastSync(lastSyncTime)}</span>
              </>
            )}
          </div>

          {/* Queue Status */}
          {(queueStatus.pending > 0 || queueStatus.failed > 0) && (
            <div className="space-y-1">
              {queueStatus.pending > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-600">{queueStatus.pending} pending</span>
                </div>
              )}

              {queueStatus.failed > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-red-600 text-xs">{queueStatus.failed} failed</span>
                  <button
                    onClick={retryFailedOperations}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Retry
                  </button>
                  <button
                    onClick={clearFailedOperations}
                    className="text-xs text-gray-600 hover:text-gray-800 underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={() => signOut()}
            className="nav-link w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
