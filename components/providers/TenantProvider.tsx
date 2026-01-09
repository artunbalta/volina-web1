"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "./SupabaseProvider";
import type { Profile } from "@/lib/types";

interface TenantContextType {
  tenant: string | null;
  tenantProfile: Profile | null;
  isOwner: boolean;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [tenantProfile, setTenantProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const tenant = params?.tenant as string | undefined;
  
  // Check if current user owns this tenant
  const isOwner = user?.slug === tenant;
  
  useEffect(() => {
    if (!authLoading) {
      // If user is authenticated but accessing wrong tenant, redirect
      if (isAuthenticated && user && tenant && user.slug !== tenant) {
        // Redirect to their own tenant
        router.push(`/${user.slug}`);
        return;
      }
      
      // If not authenticated, redirect to login
      if (!isAuthenticated && !authLoading) {
        router.push("/login");
        return;
      }
      
      // Set tenant profile as the current user (they can only access their own tenant)
      if (user && isOwner) {
        setTenantProfile(user);
      }
      
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user, tenant, router, isOwner]);

  return (
    <TenantContext.Provider
      value={{
        tenant: tenant || null,
        tenantProfile,
        isOwner,
        isLoading: isLoading || authLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  
  return context;
}
