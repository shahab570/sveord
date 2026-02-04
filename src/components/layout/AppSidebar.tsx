import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/dictionary", label: "Dictionary", icon: Book },
  { href: "/practice", label: "Practice", icon: BrainCircuit },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();

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
