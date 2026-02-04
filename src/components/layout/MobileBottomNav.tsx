import { Link, useLocation } from "react-router-dom";
import {
    BarChart3,
    Search,
    Settings,
    Hash,
    GraduationCap,
    BookMarked,
    BrainCircuit,
    Shield,
    Book,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/dictionary", label: "Dictionary", icon: Book },
    { href: "/practice", label: "SRS", icon: BrainCircuit },
    { href: "/search", label: "Search", icon: Search },
];

export function MobileBottomNav() {
    const location = useLocation();
    const { isAdmin } = useAuth();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border safe-bottom md:hidden">
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"
                                }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}

                {isAdmin && (
                    <Link
                        to="/admin"
                        className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${location.pathname === "/admin" ? "text-primary" : "text-muted-foreground"}`}
                    >
                        <Shield className="h-5 w-5" />
                        <span className="text-[10px] font-medium">Admin</span>
                    </Link>
                )}
            </div>
        </nav>
    );
}
