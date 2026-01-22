"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Phone, 
  RefreshCw,
  ArrowRight,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Lead } from "@/lib/types-outbound";
import type { Call } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// KPI Card Component (with trend)
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        {Icon && <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
        {trend && trendValue && (
          <div className={cn(
            "flex items-center text-sm font-medium",
            trend === "up" && "text-green-600 dark:text-green-400",
            trend === "down" && "text-orange-600 dark:text-orange-400",
            trend === "neutral" && "text-gray-500 dark:text-gray-400"
          )}>
            {trend === "up" && <ArrowUpRight className="w-4 h-4 mr-1" />}
            {trend === "down" && <ArrowDownRight className="w-4 h-4 mr-1" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function OutboundDashboard() {
  const router = useRouter();
  const params = useParams();
  const tenant = params?.tenant as string;
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
  
  // Recent Activity
  const [recentCalls, setRecentCalls] = useState<Call[]>([]);
  
  // AI Performance
  const [callCompletion, setCallCompletion] = useState<number>(0);
  const [appointmentConversion, setAppointmentConversion] = useState<number>(0);
  const [customerSatisfaction, setCustomerSatisfaction] = useState<number>(0);

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
          
          // Recent Calls (last 10, sorted by created_at desc)
          const recent = [...calls]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10);
          setRecentCalls(recent);
          
          // AI Performance Metrics
          // Call Completion: % of calls that completed (not failed/cancelled)
          const completedCalls = calls.filter(c => {
            const status = c.metadata?.status || c.type;
            return status !== 'cancellation' && status !== 'cancel' && status !== 'failed';
          }).length;
          const completionRate = calls.length > 0
            ? Math.round((completedCalls / calls.length) * 100 * 10) / 10 // Round to 1 decimal
            : 0;
          setCallCompletion(completionRate);
          
          // Appointment Conversion: % of calls that resulted in appointments
          const appointmentCalls = calls.filter(c => 
            c.type === 'appointment' || c.metadata?.appointmentBooked
          ).length;
          const appointmentRate = calls.length > 0
            ? Math.round((appointmentCalls / calls.length) * 100)
            : 0;
          setAppointmentConversion(appointmentRate);
          
          // Customer Satisfaction: Average evaluation score as percentage
          const callsWithScore = calls.filter(c => c.evaluation_score !== null);
          const avgScore = callsWithScore.length > 0
            ? callsWithScore.reduce((sum, c) => sum + (c.evaluation_score || 0), 0) / callsWithScore.length
            : 0;
          const satisfactionRate = Math.round((avgScore / 10) * 100);
          setCustomerSatisfaction(satisfactionRate);
        } else {
          // No calls data, reset all to 0
          setMonthlyCalls(0);
          setDailyCalls(0);
          setAvgDuration(0);
          setConversionRate(0);
          setCallDistribution({ appointment: 0, information: 0, followup: 0, cancellation: 0 });
          setWeeklyActivity([]);
          setRecentCalls([]);
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
        setRecentCalls([]);
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
      setRecentCalls([]);
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

  const basePath = tenant ? `/${tenant}` : '/dashboard/outbound';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ""}! Here's your AI assistant summary.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Refresh Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="border-gray-200 dark:border-gray-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Call Distribution Donut Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Call Distribution</h3>
          <div className="flex items-center justify-center">
            {/* Simple Donut Chart */}
            <div className="relative w-48 h-48">
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
            <div className="ml-8 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Appointment</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-purple-600 dark:bg-purple-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Information</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-600 dark:text-orange-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Follow-up</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-600 dark:text-red-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cancellation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Activity Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Weekly Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-600 dark:bg-blue-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Calls</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-600 dark:bg-green-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Appointments</span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 h-36">
              {weeklyActivity.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex-1 flex items-end justify-center gap-1 w-full">
                    {/* Calls bar */}
                    <div
                      className="bg-blue-600 dark:bg-blue-400 rounded-t w-full"
                      style={{ height: `${(item.calls / maxWeeklyValue) * 100}%`, minHeight: item.calls > 0 ? '4px' : '0' }}
                    />
                    {/* Appointments bar */}
                    <div
                      className="bg-green-600 dark:bg-green-400 rounded-t w-full"
                      style={{ height: `${(item.appointments / maxWeeklyValue) * 100}%`, minHeight: item.appointments > 0 ? '4px' : '0' }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & AI Performance Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push(`${basePath}/calls`)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              View all
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentCalls.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activity</p>
              </div>
            ) : (
              recentCalls.map((call) => {
                const timeAgo = (() => {
                  const now = new Date();
                  const callTime = new Date(call.created_at);
                  const diffMs = now.getTime() - callTime.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  if (diffMins < 1) return "Just now";
                  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                  const diffHours = Math.floor(diffMins / 60);
                  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                  const diffDays = Math.floor(diffHours / 24);
                  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                })();

                return (
                  <div 
                    key={call.id} 
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`${basePath}/calls`)}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white">Inquiry call</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{timeAgo}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* AI Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">AI Performance</h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Call Completion</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{callCompletion}%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Appointment Conversion</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{appointmentConversion}%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Customer Satisfaction</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{customerSatisfaction}%</span>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                Your AI is performing above average compared to similar businesses.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
