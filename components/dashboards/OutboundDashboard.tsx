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
  Clock,
  Plus,
  Play,
  FileText,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Lead } from "@/lib/types-outbound";
import type { Call } from "@/lib/types";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
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

// Stat Card Component
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  gradient,
  iconColor 
}: { 
  icon: typeof Phone; 
  label: string; 
  value: string | number;
  gradient: string;
  iconColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-[1px]`}>
      <div className="relative h-full rounded-2xl bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${iconColor}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl`} />
      </div>
    </div>
  );
}

// Score Ring Component
function ScoreRing({ score, size = 56 }: { score: number | null; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 10) * circumference : 0;
  
  const getScoreColor = (s: number | null) => {
    if (s === null) return { stroke: "#9ca3af", text: "text-gray-400" };
    if (s >= 8) return { stroke: "#10b981", text: "text-emerald-500" };
    if (s >= 5) return { stroke: "#f59e0b", text: "text-amber-500" };
    return { stroke: "#ef4444", text: "text-red-500" };
  };
  
  const colors = getScoreColor(score);
  
  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold ${colors.text}`}>
          {score ?? "—"}
        </span>
      </div>
    </div>
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
            .slice(0, 10);
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
          setCalls(transformedCalls);
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
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtNHY2aDR2LTJ6TTI2IDI0aC0ydjJoMnYtMnptMCAyaC0ydjJoMnYtMnptMTAgMTBoLTJ2Mmgydi0yem0wIDBoMnYtMmgtMnYyem0tMTAgMGgtMnYyaDJ2LTJ6bTAgMGgydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
              </div>
              <p className="text-purple-100 text-lg">
                Hoş geldin{user?.full_name ? `, ${user.full_name}` : ""}! İşte bugünün özeti.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-purple-200 bg-white/10 px-3 py-1.5 rounded-full">
                {format(new Date(), "d MMMM yyyy, HH:mm", { locale: tr })}
              </span>
              <Button 
                variant="outline" 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                Yenile
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-violet-400/20 rounded-full blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          icon={Users} 
          label="Toplam Lead" 
          value={stats?.total || 0}
          gradient="from-blue-500 to-cyan-500"
          iconColor="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
        />
        <StatCard 
          icon={UserPlus} 
          label="Yeni Lead" 
          value={stats?.newLeads || 0}
          gradient="from-emerald-500 to-green-500"
          iconColor="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard 
          icon={Phone} 
          label="İletişime Geçildi" 
          value={stats?.contacted || 0}
          gradient="from-purple-500 to-pink-500"
          iconColor="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400"
        />
        <StatCard 
          icon={CalendarCheck} 
          label="Randevu" 
          value={stats?.appointmentSet || 0}
          gradient="from-orange-500 to-amber-500"
          iconColor="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
        />
        <StatCard 
          icon={TrendingUp} 
          label="Dönüşüm Oranı" 
          value={`%${stats?.conversionRate || 0}`}
          gradient="from-teal-500 to-emerald-500"
          iconColor="bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400"
        />
      </div>

      {/* Recent Calls Section */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-violet-100 dark:border-violet-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-xl">
                <Phone className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Son Aramalar</h2>
                <p className="text-sm text-gray-500">{calls.length} arama gösteriliyor</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push(`${basePath}/calls`)}
              className="border-violet-200 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-400"
            >
              Tümünü Gör
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
        <CardContent className="p-6">
          {calls.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center">
                <Phone className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Henüz arama yok</h3>
              <p className="text-gray-500 text-sm">Aramalar Vapi'den otomatik senkronize edilir</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => (
                <div 
                  key={call.id} 
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                  onClick={() => router.push(`${basePath}/calls`)}
                >
                  <ScoreRing score={call.evaluation_score} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                        {call.caller_name || call.caller_phone || "Bilinmeyen Arayan"}
                      </h4>
                      <span className={cn(
                        "px-2 py-0.5 text-xs rounded-full font-medium",
                        call.type === "appointment" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        call.type === "inquiry" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                      )}>
                        {call.type === "appointment" ? "Randevu" : call.type === "inquiry" ? "Bilgi" : "Takip"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                      {call.summary || "Özet bekleniyor..."}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {format(new Date(call.created_at), "d MMM", { locale: tr })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : "—"}
                    </p>
                  </div>
                  
                  {call.recording_url && (
                    <a 
                      href={call.recording_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-xl bg-violet-100 text-violet-600 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-400 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leads Section */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-100 dark:border-emerald-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Aranacak Lead'ler</h2>
                <p className="text-sm text-gray-500">{leads.length} aktif lead</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push(`${basePath}/leads`)}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400"
            >
              Tümünü Gör
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
        <CardContent className="p-6">
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                <Users className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Henüz lead yok</h3>
              <p className="text-gray-500 text-sm mb-4">İlk lead'inizi ekleyerek başlayın</p>
              <Button onClick={() => router.push(`${basePath}/leads`)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Lead Ekle
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {leads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="group flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                  onClick={() => router.push(`${basePath}/leads?id=${lead.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                        {lead.full_name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{lead.full_name}</p>
                      <p className="text-sm text-gray-500">{lead.phone || lead.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 text-xs rounded-full font-medium",
                      lead.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      lead.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {lead.priority === 'high' ? '🔥 Yüksek' : lead.priority === 'medium' ? '⭐ Orta' : 'Düşük'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
