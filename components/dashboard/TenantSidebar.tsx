"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Phone,
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  Users,
  MessageSquare,
  BarChart3,
  Bot,
  Target,
  Menu,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/ThemeProvider";

export function TenantSidebar() {
  const pathname = usePathname();
  const { tenant, tenantProfile } = useTenant();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Don't block - show sidebar even if still loading, just use fallback values
  const effectiveTenant = tenant || "dashboard";

  const dashboardType = tenantProfile?.dashboard_type || user?.dashboard_type || 'outbound';
  const companyName = tenantProfile?.company_name || tenantProfile?.full_name || effectiveTenant;

  // Navigation items based on dashboard type
  const inboundNavItems = [
    { href: `/${effectiveTenant}`, icon: LayoutDashboard, label: "Dashboard" },
    { href: `/${effectiveTenant}/calls`, icon: Phone, label: "Arama Kayıtları" },
    { href: `/${effectiveTenant}/calendar`, icon: Calendar, label: "Takvim" },
    { href: `/${effectiveTenant}/settings`, icon: Settings, label: "Ayarlar" },
  ];

  const outboundNavItems = [
    { href: `/${effectiveTenant}`, icon: LayoutDashboard, label: "Dashboard" },
    { href: `/${effectiveTenant}/leads`, icon: Users, label: "Müşteri Adayları" },
    { href: `/${effectiveTenant}/calls`, icon: Phone, label: "Aramalar" },
    { href: `/${effectiveTenant}/messages`, icon: MessageSquare, label: "Mesajlar" },
    { href: `/${effectiveTenant}/campaigns`, icon: Target, label: "Kampanyalar" },
    { href: `/${effectiveTenant}/analytics`, icon: BarChart3, label: "Analitik" },
    { href: `/${effectiveTenant}/ai-settings`, icon: Bot, label: "AI Ayarları" },
    { href: `/${effectiveTenant}/settings`, icon: Settings, label: "Ayarlar" },
  ];

  const navItems = dashboardType === 'outbound' ? outboundNavItems : inboundNavItems;

  const handleLogout = async () => {
    await signOut();
  };

  const isActive = (href: string) => {
    if (href === `/${effectiveTenant}`) {
      return pathname === `/${effectiveTenant}`;
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md"
      >
        <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {!collapsed && (
            <Link href={`/${effectiveTenant}`} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {companyName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-bold text-gray-900 dark:text-white truncate max-w-[140px]">
                {companyName}
              </span>
            </Link>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">
                {companyName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-500 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  active
                    ? "bg-primary text-white shadow-md"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", collapsed && "mx-auto")} />
                {!collapsed && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
              collapsed && "justify-center"
            )}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
            {!collapsed && (
              <span className="font-medium">
                {theme === "dark" ? "Açık Tema" : "Koyu Tema"}
              </span>
            )}
          </button>

          {/* User info */}
          {!collapsed && user && (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.full_name || user.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </p>
            </div>
          )}

          {/* Logout button */}
          <Button
            onClick={handleLogout}
            variant="ghost"
            className={cn(
              "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="ml-3">Çıkış Yap</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
