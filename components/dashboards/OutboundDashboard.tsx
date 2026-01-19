"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Users, 
  Phone, 
  CalendarCheck, 
  TrendingUp, 
  RefreshCw,
  UserPlus,
  ArrowRight,
  Play,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Lead } from "@/lib/types-outbound";
import type { Call } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Stats {
  total: number;
  newLeads: number;
  contacted: number;
  interested: number;
  appointmentSet: number;
  converted: number;
  unreachable: number;
  conversionRate: number;
}

// Clean Stat Card
function StatCard({ 
  label, 
  value, 
  change,
  changeType = "neutral"
}: { 
  label: string; 
  value: string | number;
  change?: string;
  changeType?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        {change && (
          <div className={cn(
            "flex items-center text-sm font-medium",
            changeType === "up" && "text-green-600 dark:text-green-400",
            changeType === "down" && "text-red-600 dark:text-red-400",
            changeType === "neutral" && "text-gray-500 dark:text-gray-400"
          )}>
            {changeType === "up" && <ArrowUpRight className="w-4 h-4" />}
            {changeType === "down" && <ArrowDownRight className="w-4 h-4" />}
            {change}
          </div>
        )}
      </div>
    </div>
  );
}

// Score Badge
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  
  const getColor = (s: number) => {
    if (s >= 8) return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    if (s >= 5) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400";
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  };
  
  return (
    <span className={cn("px-2 py-1 rounded-md text-sm font-medium", getColor(score))}>
      {score}/10
    </span>
  );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const getStyle = (s: string) => {
    switch (s) {
      case "new": return "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
      case "contacted": return "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400";
      case "interested": return "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400";
      case "appointment_set": return "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
      default: return "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
    }
  };
  
  const getLabel = (s: string) => {
    switch (s) {
      case "new": return "New";
      case "contacted": return "Contacted";
      case "interested": return "Interested";
      case "appointment_set": return "Appointment";
      default: return s;
    }
  };
  
  return (
    <span className={cn("px-2 py-1 rounded-md text-xs font-medium", getStyle(status))}>
      {getLabel(status)}
    </span>
  );
}

export default function OutboundDashboard() {
  const router = useRouter();
  const params = useParams();
  const tenant = params?.tenant as string;
  const { user } = useAuth();
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Trend data
  const [weeklyLeads, setWeeklyLeads] = useState<{ date: string; count: number }[]>([]);
  const [weeklyCalls, setWeeklyCalls] = useState<{ date: string; count: number }[]>([]);
  const [conversionTrend, setConversionTrend] = useState<{ date: string; rate: number }[]>([]);
  
  // AI Performance
  const [avgCallDuration, setAvgCallDuration] = useState<number>(0);
  const [successRate, setSuccessRate] = useState<number>(0);
  const [sentimentDistribution, setSentimentDistribution] = useState<{ positive: number; neutral: number; negative: number }>({ positive: 0, neutral: 0, negative: 0 });
  
  // Goal Progress
  const [monthlyGoal, setMonthlyGoal] = useState<number>(100); // Default 100 leads/calls
  const [currentMonthProgress, setCurrentMonthProgress] = useState<{ leads: number; calls: number }>({ leads: 0, calls: 0 });

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    
    try {
      // Fetch from VAPI analytics and dashboard APIs
      const [leadsResponse, callsResponse, vapiAnalyticsResponse] = await Promise.all([
        fetch(`/api/dashboard/leads?limit=500&user_id=${user.id}`),
        fetch(`/api/dashboard/calls?days=30&limit=500&user_id=${user.id}`),
        fetch(`/api/vapi/analytics?days=30&limit=500`),
      ]);

      if (leadsResponse.ok) {
        const data = await leadsResponse.json();
        if (data.success) {
          setStats(data.stats);
          const activeLeads = (data.data || [])
            .filter((l: Lead) => ['new', 'contacted', 'interested'].includes(l.status))
            .slice(0, 5);
          setLeads(activeLeads);
          
          // Get upcoming appointments (appointment_set status)
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(23, 59, 59, 999);
          
          const appointments = (data.data || [])
            .filter((l: Lead) => l.status === 'appointment_set' && l.last_contact_date)
            .filter((l: Lead) => {
              if (!l.last_contact_date) return false;
              const contactDate = new Date(l.last_contact_date);
              return contactDate >= now && contactDate <= tomorrow;
            })
            .slice(0, 5);
          setUpcomingAppointments(appointments);
          
          // Calculate weekly leads trend (last 7 days)
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const recentLeads = (data.data || []).filter((l: Lead) => 
            new Date(l.created_at) >= weekAgo
          );
          
          const weeklyLeadsMap: Record<string, number> = {};
          for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = format(date, 'MMM d');
            weeklyLeadsMap[dateStr] = 0;
          }
          
          recentLeads.forEach((lead: Lead) => {
            const dateStr = format(new Date(lead.created_at), 'MMM d');
            if (weeklyLeadsMap[dateStr] !== undefined) {
              weeklyLeadsMap[dateStr]++;
            }
          });
          
          setWeeklyLeads(Object.entries(weeklyLeadsMap).reverse().map(([date, count]) => ({ date, count })));
          
          // Calculate monthly progress
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthlyLeads = (data.data || []).filter((l: Lead) => 
            new Date(l.created_at) >= startOfMonth
          ).length;
          setCurrentMonthProgress(prev => ({ ...prev, leads: monthlyLeads }));
        }
      }

      if (callsResponse.ok) {
        const callsData = await callsResponse.json();
        if (callsData.success && callsData.data) {
          const transformedCalls: Call[] = callsData.data.map((call: {
            id: string;
            vapi_call_id: string;
            recording_url: string | null;
            transcript: string | null;
            summary: string | null;
            sentiment: string | null;
            duration: number | null;
            type: string;
            caller_phone: string | null;
            caller_name: string | null;
            evaluation_summary: string | null;
            evaluation_score: number | null;
            created_at: string;
            updated_at: string;
          }) => ({
            id: call.id,
            user_id: "",
            vapi_call_id: call.vapi_call_id,
            appointment_id: null,
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
            metadata: {},
            created_at: call.created_at,
            updated_at: call.updated_at,
          }));
          setCalls(transformedCalls.slice(0, 5));
          
          // Calculate AI Performance metrics
          const callsWithDuration = transformedCalls.filter(c => c.duration && c.duration > 0);
          const avgDuration = callsWithDuration.length > 0
            ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length)
            : 0;
          setAvgCallDuration(avgDuration);
          
          // Success rate (evaluation_score >= 7)
          const successfulCalls = transformedCalls.filter(c => 
            c.evaluation_score !== null && c.evaluation_score >= 7
          ).length;
          const successRate = transformedCalls.length > 0
            ? Math.round((successfulCalls / transformedCalls.length) * 100)
            : 0;
          setSuccessRate(successRate);
          
          // Sentiment distribution
          const sentimentCounts = transformedCalls.reduce((acc, c) => {
            const sentiment = c.sentiment || 'neutral';
            if (sentiment === 'positive') acc.positive++;
            else if (sentiment === 'negative') acc.negative++;
            else acc.neutral++;
            return acc;
          }, { positive: 0, neutral: 0, negative: 0 });
          setSentimentDistribution(sentimentCounts);
          
          // Calculate weekly calls trend (last 7 days)
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const recentCalls = transformedCalls.filter(c => 
            new Date(c.created_at) >= weekAgo
          );
          
          const weeklyCallsMap: Record<string, number> = {};
          for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = format(date, 'MMM d');
            weeklyCallsMap[dateStr] = 0;
          }
          
          recentCalls.forEach((call: Call) => {
            const dateStr = format(new Date(call.created_at), 'MMM d');
            if (weeklyCallsMap[dateStr] !== undefined) {
              weeklyCallsMap[dateStr]++;
            }
          });
          
          setWeeklyCalls(Object.entries(weeklyCallsMap).reverse().map(([date, count]) => ({ date, count })));
          
          // Calculate monthly progress for calls
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          const monthlyCalls = transformedCalls.filter(c => 
            new Date(c.created_at) >= startOfMonth
          ).length;
          setCurrentMonthProgress(prev => ({ ...prev, calls: monthlyCalls }));
          
          // Calculate conversion trend (weekly conversion rates)
          const conversionTrendData: { date: string; rate: number }[] = [];
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = format(date, 'MMM d');
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            
            const dayCalls = transformedCalls.filter(c => {
              const callDate = new Date(c.created_at);
              return callDate >= dayStart && callDate <= dayEnd;
            });
            
            const successfulDayCalls = dayCalls.filter(c => 
              c.evaluation_score !== null && c.evaluation_score >= 7
            ).length;
            
            const rate = dayCalls.length > 0 ? Math.round((successfulDayCalls / dayCalls.length) * 100) : 0;
            conversionTrendData.push({ date: dateStr, rate });
          }
          setConversionTrend(conversionTrendData);
        }
      }

      // Fetch VAPI analytics for real data
      if (vapiAnalyticsResponse.ok) {
        const vapiData = await vapiAnalyticsResponse.json();
        if (vapiData.success && vapiData.kpi) {
          // Use VAPI data for monthly goal progress
          const monthlyCallsFromVapi = vapiData.kpi.monthlyCalls || 0;
          setCurrentMonthProgress(prev => ({ ...prev, calls: monthlyCallsFromVapi }));
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="border-gray-200 dark:border-gray-700"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid - Total Leads */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          label="Total Leads" 
          value={stats?.total || 0}
        />
        <StatCard 
          label="New Leads" 
          value={stats?.newLeads || 0}
        />
        <StatCard 
          label="Contacted" 
          value={stats?.contacted || 0}
        />
        <StatCard 
          label="Appointments" 
          value={stats?.appointmentSet || 0}
        />
        <StatCard 
          label="Conversion Rate" 
          value={`${stats?.conversionRate || 0}%`}
        />
      </div>

      {/* Monthly Goal Progress - En üstte, tek başına, gradient bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Monthly Goal Progress</h3>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {currentMonthProgress.calls} / {monthlyGoal}
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div 
            className="h-3 rounded-full transition-all bg-gradient-to-r from-blue-500 to-purple-600"
            style={{ width: `${Math.min((currentMonthProgress.calls / monthlyGoal) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Trend Charts - Separated into 3 clear cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Leads Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Leads Trend</h3>
          <div className="space-y-3">
            {weeklyLeads.map((item, idx) => {
              const maxCount = Math.max(...weeklyLeads.map(w => w.count), 1);
              const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{item.date}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all" 
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Calls Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Calls Trend</h3>
          <div className="space-y-3">
            {weeklyCalls.map((item, idx) => {
              const maxCount = Math.max(...weeklyCalls.map(w => w.count), 1);
              const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{item.date}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full transition-all" 
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Conversion Rate Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Conversion Rate</h3>
          <div className="space-y-3">
            {conversionTrend.map((item, idx) => {
              const maxRate = Math.max(...conversionTrend.map(c => c.rate), 100);
              const width = maxRate > 0 ? (item.rate / maxRate) * 100 : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{item.date}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.rate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all" 
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Agent Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Agent Performance</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Average Call Duration</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {Math.floor(avgCallDuration / 60)}:{(avgCallDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{successRate}%</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Sentiment Distribution</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Positive</span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{sentimentDistribution.positive}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Neutral</span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{sentimentDistribution.neutral}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Negative</span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{sentimentDistribution.negative}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarCheck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Upcoming Appointments</h2>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push(`${basePath}/leads?status=appointment_set`)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {upcomingAppointments.map((lead) => (
              <div 
                key={lead.id} 
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                onClick={() => router.push(`${basePath}/leads?id=${lead.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <CalendarCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{lead.full_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {lead.last_contact_date 
                          ? format(new Date(lead.last_contact_date), "MMM d, yyyy 'at' HH:mm")
                          : lead.phone || lead.email || "—"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Recent Calls</h2>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push(`${basePath}/calls`)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {calls.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Phone className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">No calls yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {calls.map((call) => (
                <div 
                  key={call.id} 
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`${basePath}/calls`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {call.caller_name || call.caller_phone || "Unknown"}
                        </p>
                        <ScoreBadge score={call.evaluation_score} />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {call.summary || "No summary available"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {format(new Date(call.created_at), "MMM d")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : "—"}
                        </p>
                      </div>
                      {call.recording_url && (
                        <a 
                          href={call.recording_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Leads */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Active Leads</h2>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push(`${basePath}/leads`)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {leads.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">No leads yet</p>
              <Button 
                onClick={() => router.push(`${basePath}/leads`)} 
                size="sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {leads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`${basePath}/leads?id=${lead.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {lead.full_name?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{lead.full_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{lead.phone || lead.email || "—"}</p>
                      </div>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
