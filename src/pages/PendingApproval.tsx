import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert, LogOut } from "lucide-react";

export default function PendingApproval() {
    const { signOut, user, isApproved } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isApproved) {
            navigate("/dashboard", { replace: true });
        }
    }, [isApproved, navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="max-w-md w-full space-y-8 text-center">
                <div className="flex justify-center">
                    <div className="p-4 bg-amber-500/10 rounded-full">
                        <ShieldAlert className="h-16 w-16 text-amber-500" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold text-foreground">Account Pending Approval</h1>
                    <p className="text-muted-foreground text-lg">
                        Thanks for signing up, <span className="font-semibold text-foreground">{user?.email}</span>!
                    </p>
                    <p className="text-muted-foreground">
                        Access to SveOrd is currently restricted. Your account needs to be manually approved by an administrator before you can access the word lists and dashboard.
                    </p>
                    <p className="text-sm text-muted-foreground/80">
                        Please contact the administrator if you believe this is a mistake.
                    </p>
                </div>

                <div className="pt-8">
                    <Button variant="outline" onClick={signOut} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </div>
        </div>
    );
}
