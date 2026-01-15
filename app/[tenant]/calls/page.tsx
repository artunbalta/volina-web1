"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Call } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  PhoneCall,
  RefreshCw, 
  Search,
  Calendar,
  User,
  Play,
  Star,
  TrendingUp,
  FileText,
  Sparkles,
  Loader2,
  Clock,
  Headphones,
  Filter,
  ChevronDown,
  Volume2,
  Award,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Circular Score Component
function ScoreRing({ score, size = 80 }: { score: number | null; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 10) * circumference : 0;
  
  const getScoreColor = (s: number | null) => {
    if (s === null) return { stroke: "#9ca3af", bg: "from-gray-500/20 to-gray-600/20", text: "text-gray-400" };
    if (s >= 8) return { stroke: "#10b981", bg: "from-emerald-500/20 to-green-500/20", text: "text-emerald-500" };
    if (s >= 5) return { stroke: "#f59e0b", bg: "from-amber-500/20 to-yellow-500/20", text: "text-amber-500" };
    return { stroke: "#ef4444", bg: "from-red-500/20 to-rose-500/20", text: "text-red-500" };
  };
  
  const colors = getScoreColor(score);
  
  return (
    <div className={`relative flex items-center justify-center bg-gradient-to-br ${colors.bg} rounded-2xl p-3`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${colors.text}`}>
          {score ?? "—"}
        </span>
        <span className="text-[10px] text-gray-500 font-medium">/10</span>
      </div>
    </div>
  );
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
        {/* Decorative element */}
        <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl`} />
      </div>
    </div>
  );
}

export default function CallsPage() {
  const params = useParams();
  const { tenantProfile } = useTenant();
  const { user } = useAuth();
  
  const dashboardType = tenantProfile?.dashboard_type || user?.dashboard_type || 'outbound';

  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [evaluatingCallId, setEvaluatingCallId] = useState<string | null>(null);
  const [isEvaluatingAll, setIsEvaluatingAll] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  const loadCalls = useCallback(async () => {
    try {
      const callsResponse = await fetch(`/api/dashboard/calls?days=30&limit=100`);
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
      console.error("Error loading calls:", error);
    }
  }, []);

  useEffect(() => {
    loadCalls().then(() => setIsLoading(false));
  }, [loadCalls]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCalls();
    setIsRefreshing(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEvaluateCall = async (callId: string) => {
    setEvaluatingCallId(callId);
    try {
      const response = await fetch("/api/calls/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });

      const data = await response.json();
      
      if (data.success) {
        await loadCalls();
      } else {
        console.error("Evaluation failed:", data.error);
        alert(data.error || "Değerlendirme başarısız oldu");
      }
    } catch (error) {
      console.error("Error evaluating call:", error);
      alert("Değerlendirme sırasında bir hata oluştu");
    } finally {
      setEvaluatingCallId(null);
    }
  };

  const handleEvaluateAllCalls = async () => {
    const unevaluatedCalls = calls.filter(c => c.evaluation_score === null && (c.transcript || c.summary));
    
    if (unevaluatedCalls.length === 0) {
      alert("Değerlendirilecek arama bulunamadı");
      return;
    }

    if (!confirm(`${unevaluatedCalls.length} arama değerlendirilecek. Devam etmek istiyor musunuz?`)) {
      return;
    }

    setIsEvaluatingAll(true);
    try {
      const response = await fetch("/api/calls/evaluate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callIds: unevaluatedCalls.map(c => c.id) }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`${data.results.evaluated} arama değerlendirildi, ${data.results.skipped} atlandı, ${data.results.failed} başarısız`);
        await loadCalls();
      } else {
        console.error("Batch evaluation failed:", data.error);
        alert(data.error || "Toplu değerlendirme başarısız oldu");
      }
    } catch (error) {
      console.error("Error evaluating calls:", error);
      alert("Değerlendirme sırasında bir hata oluştu");
    } finally {
      setIsEvaluatingAll(false);
    }
  };

  // Apply filters
  const filteredCalls = calls.filter(call => {
    // Score filter
    if (scoreFilter !== "all") {
      const score = call.evaluation_score || 0;
      if (scoreFilter === "high" && score < 8) return false;
      if (scoreFilter === "medium" && (score < 5 || score >= 8)) return false;
      if (scoreFilter === "low" && score >= 5) return false;
      if (scoreFilter === "unevaluated" && call.evaluation_score !== null) return false;
    }
    
    // Date filter
    if (dateFilter !== "all") {
      const callDate = new Date(call.created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      if (dateFilter === "today" && callDate < today) return false;
      if (dateFilter === "week" && callDate < weekAgo) return false;
      if (dateFilter === "month" && callDate < monthAgo) return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        call.caller_name?.toLowerCase().includes(query) ||
        call.caller_phone?.toLowerCase().includes(query) ||
        call.summary?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Calculate stats
  const highInterestCalls = calls.filter(c => (c.evaluation_score || 0) >= 8);
  const evaluatedCalls = calls.filter(c => c.evaluation_score !== null);
  const avgScore = evaluatedCalls.length > 0 
    ? (evaluatedCalls.reduce((sum, c) => sum + (c.evaluation_score || 0), 0) / evaluatedCalls.length).toFixed(1)
    : "—";
  const unevaluatedCount = calls.filter(c => c.evaluation_score === null && (c.transcript || c.summary)).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">Aramalar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtNHY2aDR2LTJ6TTI2IDI0aC0ydjJoMnYtMnptMCAyaC0ydjJoMnYtMnptMTAgMTBoLTJ2Mmgydi0yem0wIDBoMnYtMmgtMnYyem0tMTAgMGgtMnYyaDJ2LTJ6bTAgMGgydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Headphones className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold">Arama Analizi</h1>
              </div>
              <p className="text-purple-100 text-lg">
                AI destekli arama değerlendirmeleri ve müşteri içgörüleri
              </p>
            </div>
            <div className="flex items-center gap-3">
              {unevaluatedCount > 0 && (
                <Button 
                  onClick={handleEvaluateAllCalls} 
                  disabled={isEvaluatingAll}
                  className="bg-white text-purple-700 hover:bg-purple-50 font-semibold shadow-lg shadow-purple-900/20"
                >
                  {isEvaluatingAll ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {isEvaluatingAll ? "Değerlendiriliyor..." : `${unevaluatedCount} Arama Değerlendir`}
                </Button>
              )}
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
        {/* Decorative circles */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={PhoneCall} 
          label="Toplam Arama" 
          value={calls.length}
          gradient="from-blue-500 to-cyan-500"
          iconColor="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
        />
        <StatCard 
          icon={TrendingUp} 
          label="Yüksek İlgi" 
          value={highInterestCalls.length}
          gradient="from-emerald-500 to-green-500"
          iconColor="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard 
          icon={Award} 
          label="Ortalama Puan" 
          value={avgScore}
          gradient="from-amber-500 to-yellow-500"
          iconColor="bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"
        />
        <StatCard 
          icon={Calendar} 
          label="Randevu Alındı" 
          value={calls.filter(c => c.type === 'appointment').length}
          gradient="from-purple-500 to-pink-500"
          iconColor="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Filters Section */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">Filtreler</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Puan</label>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger className="h-11 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500">
                  <SelectValue placeholder="Tüm puanlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Puanlar</SelectItem>
                  <SelectItem value="high">🌟 Yüksek (8-10)</SelectItem>
                  <SelectItem value="medium">⭐ Orta (5-7)</SelectItem>
                  <SelectItem value="low">💫 Düşük (0-4)</SelectItem>
                  <SelectItem value="unevaluated">⏳ Değerlendirilmemiş</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tarih</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-11 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500">
                  <SelectValue placeholder="Tüm tarihler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Tarihler</SelectItem>
                  <SelectItem value="today">Bugün</SelectItem>
                  <SelectItem value="week">Son 7 Gün</SelectItem>
                  <SelectItem value="month">Son 30 Gün</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Ara</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="İsim, telefon veya özet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-12 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">{filteredCalls.length}</span> arama gösteriliyor
          {filteredCalls.length !== calls.length && (
            <span> (toplam {calls.length})</span>
          )}
        </p>
      </div>

      {/* Call Cards */}
      <div className="space-y-4">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center">
              <Phone className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {calls.length === 0 ? "Henüz arama yok" : "Arama bulunamadı"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {calls.length === 0 
                ? "Aramalar Vapi'den otomatik olarak senkronize edilir" 
                : "Farklı filtreler deneyebilirsiniz"
              }
            </p>
          </div>
        ) : (
          filteredCalls.map((call, index) => {
            const isExpanded = expandedCallId === call.id;
            
            return (
              <div 
                key={call.id} 
                className="group relative"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Card className={cn(
                  "overflow-hidden transition-all duration-300 border-0 shadow-lg hover:shadow-xl",
                  "bg-white dark:bg-gray-900",
                  isExpanded && "ring-2 ring-purple-500 shadow-purple-200/50 dark:shadow-purple-900/20"
                )}>
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row">
                      {/* Score Section */}
                      <div className="flex items-center gap-4 p-5 lg:p-6 lg:border-r border-b lg:border-b-0 border-gray-100 dark:border-gray-800">
                        <ScoreRing score={call.evaluation_score} />
                      </div>
                      
                      {/* Main Content */}
                      <div className="flex-1 p-5 lg:p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                              <User className="w-6 h-6 text-gray-500" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                {call.caller_name || "Bilinmeyen Arayan"}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5" />
                                  {call.caller_phone || "Numara yok"}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {call.duration ? formatDuration(call.duration) : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {format(new Date(call.created_at), "d MMMM", { locale: tr })}
                            </p>
                            <p className="text-sm text-gray-500">
                              {format(new Date(call.created_at), "HH:mm", { locale: tr })}
                            </p>
                          </div>
                        </div>

                        {/* Summary */}
                        {call.summary && (
                          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <div className="flex items-start gap-3">
                              <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {call.summary}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Evaluation */}
                        {call.evaluation_summary && (
                          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-100 dark:border-purple-800/50">
                            <div className="flex items-start gap-3">
                              <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
                                  AI Değerlendirmesi
                                </p>
                                <p className="text-sm text-purple-900 dark:text-purple-100 leading-relaxed">
                                  {call.evaluation_summary}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Transcript (Expandable) */}
                        {call.transcript && (
                          <div className="mb-4">
                            <button
                              onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                            >
                              <ChevronDown className={cn(
                                "w-4 h-4 transition-transform duration-200",
                                isExpanded && "rotate-180"
                              )} />
                              Transkripti {isExpanded ? "Gizle" : "Görüntüle"}
                            </button>
                            {isExpanded && (
                              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl max-h-64 overflow-y-auto">
                                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                  {call.transcript}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tags & Actions */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Type Badge */}
                            <span className={cn(
                              "px-3 py-1.5 text-xs font-semibold rounded-full",
                              call.type === "appointment" 
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" 
                                : call.type === "inquiry" 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400" 
                                : call.type === "cancellation" 
                                ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400" 
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            )}>
                              {call.type === "appointment" ? "📅 Randevu" :
                               call.type === "inquiry" ? "❓ Bilgi Talebi" :
                               call.type === "cancellation" ? "❌ İptal" :
                               "📞 Takip"}
                            </span>
                            
                            {/* Sentiment Badge */}
                            <span className={cn(
                              "px-3 py-1.5 text-xs font-semibold rounded-full",
                              call.sentiment === "positive" 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" 
                                : call.sentiment === "negative" 
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400" 
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                            )}>
                              {call.sentiment === "positive" ? "😊 Olumlu" :
                               call.sentiment === "negative" ? "😞 Olumsuz" :
                               "😐 Nötr"}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            {call.recording_url && (
                              <a 
                                href={call.recording_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-400 dark:hover:bg-violet-900/70 transition-colors"
                              >
                                <Volume2 className="w-4 h-4" />
                                Dinle
                              </a>
                            )}
                            {(call.transcript || call.summary) && (
                              <button
                                onClick={() => handleEvaluateCall(call.id)}
                                disabled={evaluatingCallId === call.id}
                                className={cn(
                                  "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all",
                                  evaluatingCallId === call.id
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : call.evaluation_score !== null
                                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                                    : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/25"
                                )}
                              >
                                {evaluatingCallId === call.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                                {evaluatingCallId === call.id 
                                  ? "Değerlendiriliyor..." 
                                  : call.evaluation_score !== null 
                                  ? "Yeniden Değerlendir" 
                                  : "AI Değerlendir"
                                }
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
