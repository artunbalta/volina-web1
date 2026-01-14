"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// Generate slug from email
function generateSlugFromEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const domain = email.substring(atIndex + 1).split('.')[0];
  const username = email.substring(0, atIndex);
  
  // For business emails, use domain (e.g., info@smileandholiday.com → smileandholiday)
  // For personal emails (gmail, hotmail, etc.), use username
  const personalDomains = ['gmail', 'hotmail', 'yahoo', 'outlook', 'icloud', 'mail', 'protonmail'];
  
  if (personalDomains.includes(domain?.toLowerCase() || '')) {
    return username.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  
  return (domain || username).toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);

  // Fetch user profile from profiles table
  const fetchProfile = useCallback(async (authUser: User) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        // If profile doesn't exist, create a basic one from auth user
        const email = authUser.email || "";
        const generatedSlug = generateSlugFromEmail(email);
        setUser({
          id: authUser.id,
          email: email,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
          avatar_url: authUser.user_metadata?.avatar_url || null,
          role: "user",
          slug: generatedSlug,
          created_at: authUser.created_at,
          updated_at: authUser.updated_at || authUser.created_at,
        });
        return;
      }

      // Cast to Profile type
      const profile = data as Profile;
      
      // If profile exists but has no slug, generate one
      if (profile && !profile.slug && authUser.email) {
        const generatedSlug = generateSlugFromEmail(authUser.email);
        // Update the profile with the generated slug
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ slug: generatedSlug } as never)
          .eq("id", authUser.id);
        
        if (!updateError) {
          profile.slug = generatedSlug;
        }
      }

      setUser(profile);
    } catch (error) {
      console.error("Error in fetchProfile:", error);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initRef.current) return;
    initRef.current = true;

    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session - this is the critical auth check
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        // Set session immediately
        setSession(initialSession);
        
        if (initialSession?.user) {
          // Fetch profile but don't block
          fetchProfile(initialSession.user);
        } else {
          setUser(null);
        }
        
        setIsLoading(false);
      } catch (error) {
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        
        setSession(currentSession);
        
        if (event === "SIGNED_IN" && currentSession?.user) {
          await fetchProfile(currentSession.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
        } else if (event === "USER_UPDATED" && currentSession?.user) {
          await fetchProfile(currentSession.user);
        } else if (event === "TOKEN_REFRESHED" && currentSession?.user) {
          // Session token was refreshed, profile should still be valid
          if (!user) {
            await fetchProfile(currentSession.user);
          }
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, isLoading, user]);

  // Handle visibility change - refresh session when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && session) {
        // Tab became visible, check if session is still valid
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error || !currentSession) {
          // Session expired, clear state
          setUser(null);
          setSession(null);
        } else if (currentSession.user && !user) {
          // Session valid but user not loaded
          await fetchProfile(currentSession.user);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, user, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Auth timeout - Supabase is not responding')), 15000);
      });
      
      const authPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      const { data, error } = await Promise.race([authPromise, timeoutPromise]);

      if (!error && data.user) {
        setSession(data.session);
        fetchProfile(data.user).then(() => setIsLoading(false));
        return { error: null };
      }
      
      setIsLoading(false);
      return { error };
    } catch (err: any) {
      setIsLoading(false);
      return { error: { message: err?.message || 'Network error - please check your connection' } as any };
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear session from state
      setUser(null);
      setSession(null);
      
      // Clear localStorage (Supabase stores session there)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
        const storageKey = `sb-${projectRef}-auth-token`;
        localStorage.removeItem(storageKey);
      }
      
      // Clear any other auth-related storage
      sessionStorage.clear();
      
      // Try server-side signout (non-blocking)
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      
      // Force redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error("Error signing out:", error);
      // Force redirect even on error
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session && !!user,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within a SupabaseProvider");
  }
  
  return context;
}
