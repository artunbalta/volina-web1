"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, session } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // Session exists but user profile hasn't loaded yet — wait, don't redirect
    if (session && !user) return;

    const timer = setTimeout(() => {
      if (!session && !user) {
        // No session at all — go to login
        router.push("/login");
        return;
      }
      if (user && user.role !== "admin") {
        // Not admin — redirect to their tenant
        router.push(user.slug ? `/${user.slug}` : "/login");
        return;
      }
      if (user && user.role === "admin") {
        setChecked(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isLoading, session, user, router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
    </div>
  );
}
