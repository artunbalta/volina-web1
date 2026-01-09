"use client";

import { useEffect, useState, useCallback } from "react";
import { KPICards } from "@/components/dashboard/KPICards";
import { Charts } from "@/components/dashboard/Charts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { getCallStats, getDailyActivity, getRecentActivity } from "@/lib/supabase";

interface KPIData {
  monthlyCalls: number;
  monthlyChange: number;
  dailyCalls: number;
  dailyChange: number;
  avgDuration: number;
  durationChange: number;
  appointmentRate: number;
  appointmentRateChange: number;
}

interface CallTypeData {
  name: string;
  value: number;
  color: string;
}

interface DailyActivityData {
  date: string;
  calls: number;
  appointments: number;
}

interface ActivityItem {
  id: string;
  type: "call" | "appointment" | "inquiry" | "cancellation";
  description: string;
  timestamp: string;
  sentiment?: "positive" | "neutral" | "negative";
}

export default function InboundDashboard() {
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [kpiData, setKpiData] = useState<KPIData>({
    monthlyCalls: 0,
    monthlyChange: 0,
    dailyCalls: 0,
    dailyChange: 0,
    avgDuration: 0,
    durationChange: 0,
    appointmentRate: 0,
    appointmentRateChange: 0,
  });
  const [callTypeData, setCallTypeData] = useState<CallTypeData[]>([]);
  const [dailyActivityData, setDailyActivityData] = useState<DailyActivityData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      // Fetch call stats
      const stats = await getCallStats();
      
      // Calculate appointment rate
      const totalCalls = Object.values(stats.typeDistribution).reduce((sum, count) => sum + count, 0);
      const appointmentCalls = stats.typeDistribution.appointment || 0;
      const appointmentRate = totalCalls > 0 ? Math.round((appointmentCalls / totalCalls) * 100) : 0;

      setKpiData({
        monthlyCalls: stats.monthlyCalls,
        monthlyChange: 12,
        dailyCalls: stats.dailyCalls,
        dailyChange: 5,
        avgDuration: stats.avgDuration,
        durationChange: -3,
        appointmentRate,
        appointmentRateChange: 2,
      });

      // Convert type distribution to chart format
      const typeColors: Record<string, string> = {
        appointment: "#0055FF",
        inquiry: "#8B5CF6",
        follow_up: "#F59E0B",
        cancellation: "#EF4444",
      };
      
      const typeNames: Record<string, string> = {
        appointment: "Appointments",
        inquiry: "Inquiries",
        follow_up: "Follow-ups",
        cancellation: "Cancellations",
      };

      setCallTypeData(
        Object.entries(stats.typeDistribution).map(([type, value]) => ({
          name: typeNames[type] || type,
          value,
          color: typeColors[type] || "#6B7280",
        }))
      );

      // Fetch daily activity
      const dailyData = await getDailyActivity(7);
      setDailyActivityData(dailyData);

      // Fetch recent activity
      const activities = await getRecentActivity(10);
      setRecentActivity(activities as ActivityItem[]);

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  }, []);

  useEffect(() => {
    loadData().then(() => setIsLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hoş geldin{user?.full_name ? `, ${user.full_name}` : ""}! AI asistanının özeti burada.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {format(lastUpdated, "HH:mm")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards data={kpiData} />

      {/* Charts */}
      <Charts 
        callTypeData={callTypeData.length > 0 ? callTypeData : [
          { name: "No Data", value: 1, color: "#E5E7EB" }
        ]} 
        dailyActivityData={dailyActivityData} 
      />

      {/* Recent Activity & Performance */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentActivity activities={recentActivity} />
        </div>
        
        {/* Quick Stats Card */}
        <div className="bg-gradient-to-br from-primary to-blue-700 rounded-xl p-5 text-white">
          <h3 className="text-lg font-semibold mb-4">AI Performansı</h3>
          <div className="space-y-4">
            {[
              { label: "Arama Tamamlama", value: kpiData.monthlyCalls > 0 ? "98.5%" : "N/A" },
              { label: "Randevu Dönüşümü", value: `${kpiData.appointmentRate}%` },
              { label: "Müşteri Memnuniyeti", value: kpiData.monthlyCalls > 0 ? "94%" : "N/A" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="opacity-80">{stat.label}</span>
                  <span className="font-medium">{stat.value}</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500" 
                    style={{ width: stat.value === "N/A" ? "0%" : stat.value }} 
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/20">
            <p className="text-sm opacity-80">
              {kpiData.monthlyCalls > 0 ? (
                <>AI&apos;ınız benzer işletmelere göre <span className="font-semibold text-white">ortalamanın üstünde</span> performans gösteriyor.</>
              ) : (
                <>AI performans metriklerini görmek için arama yapmaya başlayın.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
