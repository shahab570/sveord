import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen } from "lucide-react";

export const AdminRoute = () => {
    const { user, isAdmin, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="animate-pulse">
                    <BookOpen className="h-12 w-12 text-primary" />
                </div>
            </div>
        );
    }

    // If not logged in, redirect to auth
    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    // If logged in but not admin, redirect to dashboard or not-found
    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    // If admin, render child routes
    return <Outlet />;
};
