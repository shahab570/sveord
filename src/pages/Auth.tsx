import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import sveordLogo from "@/assets/sveord-logo.png";

export default function Auth() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">
          <img src={sveordLogo} alt="SveOrd" className="h-16 w-auto object-contain" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <img 
              src={sveordLogo} 
              alt="SveOrd" 
              className="h-12 w-auto object-contain"
            />
            <span className="text-2xl font-bold text-primary-foreground">
              SveOrd
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Master Swedish vocabulary with confidence
          </h1>
          <p className="text-lg text-primary-foreground/80">
            Learn systematically with the Kelly List and Frequency-based approach. Track your progress, import your word lists, and achieve fluency.
          </p>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Sparkles className="h-5 w-5" />
              <span>Kelly A1-C2 Levels</span>
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Sparkles className="h-5 w-5" />
              <span>Frequency Ranking</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-primary-foreground/60">
          © 2024 SveOrd - Swedish Vocabulary Trainer
        </p>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-secondary">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <img 
              src={sveordLogo} 
              alt="SveOrd" 
              className="h-12 w-auto object-contain"
            />
            <span className="text-2xl font-bold text-foreground">SveOrd</span>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Welcome to SveOrd
            </h2>
            <p className="mt-2 text-muted-foreground">
              Sign in with Google to start your Swedish vocabulary journey
            </p>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            className="w-full h-12 text-base font-medium"
            disabled={submitting}
          >
            {submitting ? (
              "Redirecting to Google..."
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
