import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  isApproved: boolean;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
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

      if (error || !data) {
        // Silently fail or just set null, avoiding console spam for timeouts
        if (error && error.message !== 'Profile fetch timeout' && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }

        // If profile is missing (PGRST116) or just not found, but we have a user, try to create one.
        // This handles cases where Admin deleted the profile but Auth user exists.
        if (userId && (!data || (error && error.code === 'PGRST116'))) {
          console.log("Profile missing, attempting to recreate...");
          // We need current user metadata to fill names/email
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            const newProfile = {
              id: userId,
              email: user.email,
              first_name: user.user_metadata?.first_name || '',
              last_name: user.user_metadata?.last_name || '',
              is_approved: user.email === 'mjsahab570@gmail.com' // Auto-approve admin
            };

            const { data: insertedProfile, error: insertError } = await supabase
              .from('profiles')
              .insert([newProfile])
              .select()
              .single();

            if (!insertError && insertedProfile) {
              console.log("Profile recreated successfully");
              setProfile(insertedProfile);
              return;
            } else {
              console.error("Failed to recreate profile:", insertError);
            }
          }
        }
      } else {
        setProfile(data);
      }
    } catch (error: any) {
      // Ignore timeouts in console to keep it clean
      if (error.message !== 'Profile fetch timeout') {
        console.error('Error in fetchProfile:', error);
      }
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

    // THEN get initial session - REMOVED to avoid race condition with onAuthStateChange
    // onAuthStateChange fires INITIAL_SESSION immediately on mount, so this was causing double-fetches
    // and potentially premature 'loading=false' states if one promise resolved faster with missing data.

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

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // We want to ensure specific meta data if needed, but for now default is fine
      }
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isApproved: (profile?.is_approved === true) || (user?.email === 'mjsahab570@gmail.com'),
      isAdmin: user?.email === 'mjsahab570@gmail.com',
      // If user exists but profile is missing (and not admin), treat as loading to avoid flash of pending
      loading: loading || (!!user && !profile && user.email !== 'mjsahab570@gmail.com'),
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
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
