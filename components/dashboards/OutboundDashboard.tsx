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
  ArrowDownRight
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [leadsResponse, callsResponse] = await Promise.all([
        fetch("/api/dashboard/leads?limit=100"),
        fetch("/api/dashboard/calls?days=30&limit=10"),
      ]);

      if (leadsResponse.ok) {
        const data = await leadsResponse.json();
        if (data.success) {
          setStats(data.stats);
          const activeLeads = (data.data || [])
            .filter((l: Lead) => ['new', 'contacted', 'interested'].includes(l.status))
            .slice(0, 5);
          setLeads(activeLeads);
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
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

      {/* Stats Grid */}
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
