"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Phone, 
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Call } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// KPI Card Component (with trend) - Mobile Responsive
function KPICard({ 
  label, 
  value, 
  trend,
  trendValue,
  icon: Icon
}: { 
  label: string; 
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 dark:text-gray-500" />}
        {trend && trendValue && (
          <div className={cn(
            "flex items-center text-xs sm:text-sm font-medium",
            trend === "up" && "text-green-600 dark:text-green-400",
            trend === "down" && "text-orange-600 dark:text-orange-400",
            trend === "neutral" && "text-gray-500 dark:text-gray-400"
          )}>
            {trend === "up" && <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5" />}
            {trend === "down" && <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mb-0.5 sm:mb-1">{label}</p>
      <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function OutboundDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // KPI Data
  const [monthlyCalls, setMonthlyCalls] = useState<number>(0);
  const [monthlyCallsTrend, setMonthlyCallsTrend] = useState<{ value: number; type: "up" | "down" }>({ value: 0, type: "up" });
  const [dailyCalls, setDailyCalls] = useState<number>(0);
  const [dailyCallsTrend, setDailyCallsTrend] = useState<{ value: number; type: "up" | "down" }>({ value: 0, type: "up" });
  const [avgDuration, setAvgDuration] = useState<number>(0);
  const [avgDurationTrend, setAvgDurationTrend] = useState<{ value: number; type: "up" | "down" }>({ value: 0, type: "up" });
  const [conversionRate, setConversionRate] = useState<number>(0);
  const [conversionRateTrend, setConversionRateTrend] = useState<{ value: number; type: "up" | "down" }>({ value: 0, type: "up" });
  
  // Call Distribution (Donut chart data)
  const [callDistribution, setCallDistribution] = useState<{
    appointment: number;
    information: number;
    followup: number;
    cancellation: number;
  }>({
    appointment: 0,
    information: 0,
    followup: 0,
    cancellation: 0
  });
  
  // Weekly Activity (Bar chart data)
  const [weeklyActivity, setWeeklyActivity] = useState<{
    date: string;
    calls: number;
    appointments: number;
  }[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch calls and leads in parallel
      const [callsResponse, leadsResponse] = await Promise.all([
        fetch(`/api/dashboard/calls?days=365&userId=${user.id}`),
        fetch(`/api/dashboard/leads?userId=${user.id}&page=1`)
      ]);
      
      if (callsResponse.ok) {
        const callsData = await callsResponse.json();
        if (callsData.success && callsData.data) {
          const calls: Call[] = callsData.data.map((call: any) => ({
            id: call.id,
            user_id: call.user_id || "",
            vapi_call_id: call.vapi_call_id,
            appointment_id: call.appointment_id || null,
            recording_url: call.recording_url,
            transcript: call.transcript,
            summary: call.summary,
            sentiment: call.sentiment as Call["sentiment"],
            duration: call.duration,
            type: call.type as Call["type"],
            caller_phone: call.caller_phone,
            caller_name: call.caller_name,
            evaluation_summary: call.evaluation_summary,
            evaluation_score: call.evaluation_score,
            metadata: call.metadata || {},
            created_at: call.created_at,
            updated_at: call.updated_at,
          }));
          
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          const yesterday = new Date(startOfDay);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          const twoDaysAgo = new Date(yesterday);
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
          twoDaysAgo.setHours(0, 0, 0, 0);
          
          // Monthly Calls & Trend
          const monthlyCallsCount = calls.filter(c => new Date(c.created_at) >= startOfMonth).length;
          const lastMonthCalls = calls.filter(c => {
            const callDate = new Date(c.created_at);
            return callDate >= lastMonthStart && callDate <= lastMonthEnd;
          }).length;
          const monthlyChange = lastMonthCalls > 0 
            ? Math.round(((monthlyCallsCount - lastMonthCalls) / lastMonthCalls) * 100)
            : 0;
          setMonthlyCalls(monthlyCallsCount);
          setMonthlyCallsTrend({ 
            value: Math.abs(monthlyChange), 
            type: monthlyChange >= 0 ? "up" : "down" 
          });
          
          // Daily Calls & Trend
          const dailyCallsCount = calls.filter(c => new Date(c.created_at) >= startOfDay).length;
          const yesterdayCalls = calls.filter(c => {
            const callDate = new Date(c.created_at);
            return callDate >= yesterday && callDate < startOfDay;
          }).length;
          const dailyChange = yesterdayCalls > 0
            ? Math.round(((dailyCallsCount - yesterdayCalls) / yesterdayCalls) * 100)
            : (dailyCallsCount > 0 ? 100 : 0);
          setDailyCalls(dailyCallsCount);
          setDailyCallsTrend({ 
            value: Math.abs(dailyChange), 
            type: dailyChange >= 0 ? "up" : "down" 
          });
          
          // Avg Duration & Trend
          const callsWithDuration = calls.filter(c => c.duration && c.duration > 0);
          const avgDurationSeconds = callsWithDuration.length > 0
            ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length)
            : 0;
          setAvgDuration(avgDurationSeconds);
          
          // Calculate average duration for last month vs this month
          const thisMonthCallsWithDuration = calls.filter(c => {
            const callDate = new Date(c.created_at);
            return callDate >= startOfMonth && c.duration && c.duration > 0;
          });
          const lastMonthCallsWithDuration = calls.filter(c => {
            const callDate = new Date(c.created_at);
            return callDate >= lastMonthStart && callDate <= lastMonthEnd && c.duration && c.duration > 0;
          });
          
          const thisMonthAvg = thisMonthCallsWithDuration.length > 0
            ? thisMonthCallsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / thisMonthCallsWithDuration.length
            : 0;
          const lastMonthAvg = lastMonthCallsWithDuration.length > 0
            ? lastMonthCallsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / lastMonthCallsWithDuration.length
            : 0;
          
          const durationChange = lastMonthAvg > 0
            ? Math.round(((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100)
            : 0;
          setAvgDurationTrend({ 
            value: Math.abs(durationChange), 
            type: durationChange >= 0 ? "up" : "down" 
          });
          
          // Conversion Rate & Trend
          const successfulCalls = calls.filter(c => 
            c.evaluation_score !== null && c.evaluation_score >= 7
          ).length;
          const conversionRateValue = calls.length > 0
            ? Math.round((successfulCalls / calls.length) * 100)
            : 0;
          setConversionRate(conversionRateValue);
          
          // Calculate conversion rate trend (this month vs last month)
          const thisMonthTotal = calls.filter(c => new Date(c.created_at) >= startOfMonth).length;
          const thisMonthSuccessful = calls.filter(c => {
            const callDate = new Date(c.created_at);
            return callDate >= startOfMonth && c.evaluation_score !== null && c.evaluation_score >= 7;
          }).length;
          const lastMonthTotal = calls.filter(c => {
            const callDate = new Date(c.created_at);
            return callDate >= lastMonthStart && callDate <= lastMonthEnd;
          }).length;
          const lastMonthSuccessful = calls.filter(c => {
            const callDate = new Date(c.created_at);
            return callDate >= lastMonthStart && callDate <= lastMonthEnd && c.evaluation_score !== null && c.evaluation_score >= 7;
          }).length;
          
          const thisMonthRate = thisMonthTotal > 0 ? (thisMonthSuccessful / thisMonthTotal) * 100 : 0;
          const lastMonthRate = lastMonthTotal > 0 ? (lastMonthSuccessful / lastMonthTotal) * 100 : 0;
          const rateChange = lastMonthRate > 0
            ? Math.round(((thisMonthRate - lastMonthRate) / lastMonthRate) * 100)
            : (thisMonthRate > 0 ? 100 : 0);
          setConversionRateTrend({ 
            value: Math.abs(rateChange), 
            type: rateChange >= 0 ? "up" : "down" 
          });
          
          // Call Distribution
          const distribution = {
            appointment: calls.filter(c => c.type === 'appointment' || c.metadata?.appointmentBooked).length,
            information: calls.filter(c => c.type === 'inquiry' || (!c.type && !c.metadata?.appointmentBooked)).length,
            followup: calls.filter(c => c.type === 'follow_up').length,
            cancellation: calls.filter(c => c.type === 'cancellation').length,
          };
          setCallDistribution(distribution);
          
          // Weekly Activity (last 7 days)
          const weeklyData: { date: string; calls: number; appointments: number }[] = [];
          for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            
            const dayCalls = calls.filter(c => {
              const callDate = new Date(c.created_at);
              return callDate >= dayStart && callDate <= dayEnd;
            });
            
            const dayAppointments = dayCalls.filter(c => 
              c.type === 'appointment' || c.metadata?.appointmentBooked
            ).length;
            
            weeklyData.push({
              date: format(date, 'EEE').toUpperCase(),
              calls: dayCalls.length,
              appointments: dayAppointments
            });
          }
          setWeeklyActivity(weeklyData);
        } else {
          // No calls data, reset all to 0
          setMonthlyCalls(0);
          setDailyCalls(0);
          setAvgDuration(0);
          setConversionRate(0);
          setCallDistribution({ appointment: 0, information: 0, followup: 0, cancellation: 0 });
          setWeeklyActivity([]);
        }
      } else {
        console.error("Failed to load calls:", callsResponse.statusText);
        // Reset on error
        setMonthlyCalls(0);
        setDailyCalls(0);
        setAvgDuration(0);
        setConversionRate(0);
        setCallDistribution({ appointment: 0, information: 0, followup: 0, cancellation: 0 });
        setWeeklyActivity([]);
      }
      
      // Handle leads response (if needed for future features)
      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();
        // Leads data can be used for future features
      }
    } catch (error) {
      console.error("Error loading data:", error);
      // Reset on error
      setMonthlyCalls(0);
      setDailyCalls(0);
      setAvgDuration(0);
      setConversionRate(0);
      setCallDistribution({ appointment: 0, information: 0, followup: 0, cancellation: 0 });
      setWeeklyActivity([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    
    if (user?.id) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [user?.id, authLoading, loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Calculate call distribution percentages for donut chart
  const totalDistribution = callDistribution.appointment + callDistribution.information + 
    callDistribution.followup + callDistribution.cancellation;
  const distributionPercentages = {
    appointment: totalDistribution > 0 ? (callDistribution.appointment / totalDistribution) * 100 : 0,
    information: totalDistribution > 0 ? (callDistribution.information / totalDistribution) * 100 : 0,
    followup: totalDistribution > 0 ? (callDistribution.followup / totalDistribution) * 100 : 0,
    cancellation: totalDistribution > 0 ? (callDistribution.cancellation / totalDistribution) * 100 : 0,
  };

  // Calculate max for weekly activity chart
  const maxWeeklyValue = Math.max(
    ...weeklyActivity.map(w => Math.max(w.calls, w.appointments)),
    1
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ""}! Here's your AI summary.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Refresh Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="border-gray-200 dark:border-gray-700 w-full sm:w-auto"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <KPICard
          label="Monthly Calls"
          value={monthlyCalls}
          trend={monthlyCallsTrend.type}
          trendValue={`${monthlyCallsTrend.value}%`}
          icon={Phone}
        />
        <KPICard
          label="Daily Calls"
          value={dailyCalls}
          trend={dailyCallsTrend.type}
          trendValue={`${dailyCallsTrend.value}%`}
        />
        <KPICard
          label="Avg Duration"
          value={`${Math.floor(avgDuration / 60)}:${(avgDuration % 60).toString().padStart(2, '0')}`}
          trend={avgDurationTrend.type}
          trendValue={`${avgDurationTrend.value}%`}
        />
        <KPICard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          trend={conversionRateTrend.type}
          trendValue={`${conversionRateTrend.value}%`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Call Distribution Donut Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Call Distribution</h3>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0">
            {/* Simple Donut Chart */}
            <div className="relative w-32 h-32 sm:w-48 sm:h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-gray-200 dark:text-gray-700"
                />
                {/* Segments */}
                {distributionPercentages.appointment > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    strokeDasharray={`${2 * Math.PI * 40 * (distributionPercentages.appointment / 100)} ${2 * Math.PI * 40}`}
                    className="text-blue-600 dark:text-blue-400"
                    strokeDashoffset="0"
                  />
                )}
                {distributionPercentages.information > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    strokeDasharray={`${2 * Math.PI * 40 * (distributionPercentages.information / 100)} ${2 * Math.PI * 40}`}
                    className="text-purple-600 dark:text-purple-400"
                    strokeDashoffset={`-${2 * Math.PI * 40 * (distributionPercentages.appointment / 100)}`}
                  />
                )}
                {distributionPercentages.followup > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    strokeDasharray={`${2 * Math.PI * 40 * (distributionPercentages.followup / 100)} ${2 * Math.PI * 40}`}
                    className="text-orange-600 dark:text-orange-400"
                    strokeDashoffset={`-${2 * Math.PI * 40 * ((distributionPercentages.appointment + distributionPercentages.information) / 100)}`}
                  />
                )}
                {distributionPercentages.cancellation > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    strokeDasharray={`${2 * Math.PI * 40 * (distributionPercentages.cancellation / 100)} ${2 * Math.PI * 40}`}
                    className="text-red-600 dark:text-red-400"
                    strokeDashoffset={`-${2 * Math.PI * 40 * ((distributionPercentages.appointment + distributionPercentages.information + distributionPercentages.followup) / 100)}`}
                  />
                )}
              </svg>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-3 sm:ml-8">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-600 dark:bg-blue-400" />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Appointment</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-purple-600 dark:bg-purple-400" />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Information</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-600 dark:bg-orange-400" />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Follow-up</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-600 dark:bg-red-400" />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Cancellation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Activity Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Weekly Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-blue-600 dark:bg-blue-400" />
                <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Calls</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-600 dark:bg-green-400" />
                <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Appointments</span>
              </div>
            </div>
            <div className="flex items-end justify-around">
              {weeklyActivity.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  {/* Bar container with fixed height */}
                  <div className="flex items-end justify-center gap-0.5 sm:gap-1 h-20 sm:h-32 w-6 sm:w-10">
                    {/* Calls bar */}
                    <div
                      className="bg-blue-600 dark:bg-blue-400 rounded-t w-2 sm:w-3 transition-all duration-300 cursor-pointer hover:bg-blue-700 dark:hover:bg-blue-300 relative group"
                      style={{ 
                        height: maxWeeklyValue > 0 ? `${Math.max((item.calls / maxWeeklyValue) * 100, item.calls > 0 ? 8 : 0)}%` : '0%'
                      }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {item.calls} calls
                      </div>
                    </div>
                    {/* Appointments bar */}
                    <div
                      className="bg-green-600 dark:bg-green-400 rounded-t w-2 sm:w-3 transition-all duration-300 cursor-pointer hover:bg-green-700 dark:hover:bg-green-300 relative group"
                      style={{ 
                        height: maxWeeklyValue > 0 ? `${Math.max((item.appointments / maxWeeklyValue) * 100, item.appointments > 0 ? 8 : 0)}%` : '0%'
                      }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {item.appointments} appts
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium text-center">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
