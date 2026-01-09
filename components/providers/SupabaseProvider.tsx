"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import type { User, Session, AuthError } from "@supabase/supabase-js";

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
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn("Auth initialization timeout, setting isLoading to false");
            setIsLoading(false);
          }
        }, 5000); // 5 second timeout

        // Get initial session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }
        
        if (mounted) {
          setSession(initialSession);
          
          if (initialSession?.user) {
            await fetchProfile(initialSession.user);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        if (mounted) {
          clearTimeout(timeoutId);
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
        } else if (event === "USER_UPDATED" && currentSession?.user) {
          await fetchProfile(currentSession.user);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      await fetchProfile(data.user);
    }
    
    setIsLoading(false);
    return { error };
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsLoading(false);
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
