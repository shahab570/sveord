import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen } from "lucide-react";

export const ProtectedRoute = () => {
    const { user, isApproved, loading } = useAuth();

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

    // If logged in but not approved, redirect to pending approval page
    if (!isApproved) {
        return <Navigate to="/pending-approval" replace />;
    }

    // If logged in and approved, render child routes
    return <Outlet />;
};
