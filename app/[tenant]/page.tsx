"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { RefreshCw } from "lucide-react";

// Import dashboard components
import InboundDashboard from "@/components/dashboards/InboundDashboard";
import OutboundDashboard from "@/components/dashboards/OutboundDashboard";

export default function TenantDashboardPage() {
  const { tenant, tenantProfile, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  
  const dashboardType = tenantProfile?.dashboard_type || user?.dashboard_type || 'inbound';

  if (tenantLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (dashboardType === 'outbound') {
    return <OutboundDashboard />;
  }

  return <InboundDashboard />;
}
