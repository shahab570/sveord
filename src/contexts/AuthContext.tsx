import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  isApproved: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    console.log('👤 Fetching profile for:', userId);
    try {
      // Create a timeout promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000);
      });

      // Race the fetch against the timeout
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      console.log('👤 Profile fetch result:', { data, error });

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  useEffect(() => {
    console.log('🔐 AuthContext: Setting up auth listener');

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('🔐 Initial session check:', session ? 'exists' : 'null');

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Get redirect URI from environment variables with fallbacks
    // Priority: VITE_REDIRECT_URI > VITE_APP_URL/auth > window.location.origin/auth
    const getRedirectUri = () => {
      // Debug logging
      console.log('=== OAuth Redirect Debug ===');
      console.log('VITE_REDIRECT_URI:', import.meta.env.VITE_REDIRECT_URI);
      console.log('VITE_APP_URL:', import.meta.env.VITE_APP_URL);
      console.log('window.location.origin:', window.location.origin);

      // If explicit redirect URI is set, use it
      if (import.meta.env.VITE_REDIRECT_URI) {
        console.log('✓ Using VITE_REDIRECT_URI');
        return import.meta.env.VITE_REDIRECT_URI;
      }

      // If app URL is set, construct redirect URI from it
      if (import.meta.env.VITE_APP_URL) {
        console.log('✓ Using VITE_APP_URL');
        return `${import.meta.env.VITE_APP_URL}/auth`;
      }

      // Default to current origin for local development
      console.log('✓ Using window.location.origin (fallback)');
      return `${window.location.origin}/auth`;
    };

    const redirectUri = getRedirectUri();
    console.log('Final redirect URI:', redirectUri);
    console.log('=========================');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isApproved: profile?.is_approved === true, // Default to false if no profile
      loading,
      signInWithGoogle,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
