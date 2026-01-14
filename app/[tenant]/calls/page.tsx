"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { updateOutreach } from "@/lib/supabase-outbound";
import type { Call } from "@/lib/types";
import type { Outreach, OutreachResult } from "@/lib/types-outbound";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Phone, 
  PhoneCall,
  Clock, 
  RefreshCw, 
  Search,
  CheckCircle,
  Calendar,
  User,
  Play,
  MessageSquare,
  Mail,
  Instagram,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText
} from "lucide-react";

const channelConfig: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  call: { label: "Arama", icon: Phone, color: "bg-blue-100 text-blue-600" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "bg-green-100 text-green-600" },
  email: { label: "Email", icon: Mail, color: "bg-purple-100 text-purple-600" },
  instagram_dm: { label: "Instagram", icon: Instagram, color: "bg-pink-100 text-pink-600" },
  sms: { label: "SMS", icon: Phone, color: "bg-orange-100 text-orange-600" },
};
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const resultConfig: Record<OutreachResult, { label: string; color: string }> = {
  answered_interested: { label: "✅ Ulaşıldı - İlgili", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  answered_not_interested: { label: "❌ Ulaşıldı - İlgisiz", color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  answered_appointment_set: { label: "📅 Randevu Alındı", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  answered_callback_requested: { label: "📞 Geri Arama İstendi", color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30" },
  no_answer: { label: "📵 Cevap Yok", color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30" },
  busy: { label: "🔴 Meşgul", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  voicemail: { label: "📧 Sesli Mesaj", color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30" },
  wrong_number: { label: "⛔ Yanlış Numara", color: "text-gray-600 bg-gray-100 dark:bg-gray-700" },
  message_sent: { label: "📤 Mesaj Gönderildi", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  message_delivered: { label: "✅ Mesaj İletildi", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  message_read: { label: "👁 Mesaj Okundu", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  message_replied: { label: "💬 Mesaj Yanıtlandı", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
};

export default function CallsPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const { tenantProfile } = useTenant();
  const { user } = useAuth();
  
  const dashboardType = tenantProfile?.dashboard_type || user?.dashboard_type || 'outbound';

  const [calls, setCalls] = useState<Call[]>([]);
  const [outreachCalls, setOutreachCalls] = useState<Outreach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filters for call evaluations
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Outreach | null>(null);
  const [callResult, setCallResult] = useState<OutreachResult | "">("");
  const [callNotes, setCallNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [executingCallId, setExecutingCallId] = useState<string | null>(null);

  const loadCalls = useCallback(async () => {
    try {
      // Load calls from server-side API (bypasses browser Supabase issues)
      const callsResponse = await fetch("/api/dashboard/calls?days=30&limit=100");
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

  // NOTE: Auto-setup removed to prevent data reset on sign out/sign in
  // Users should use the Settings page to seed mock data manually

  useEffect(() => {
    loadCalls().then(() => setIsLoading(false));
  }, [loadCalls]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCalls();
    setIsRefreshing(false);
  };

  const openResultDialog = (call: Outreach) => {
    setSelectedCall(call);
    setCallResult(call.result || "");
    setCallNotes(call.notes || "");
    setShowResultDialog(true);
  };

  const handleSaveResult = async () => {
    if (!selectedCall || !callResult) return;
    setIsSaving(true);
    try {
      await updateOutreach(selectedCall.id, {
        result: callResult as OutreachResult,
        notes: callNotes,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      setShowResultDialog(false);
      setSelectedCall(null);
      setCallResult("");
      setCallNotes("");
      await loadCalls();
    } catch (error) {
      console.error("Error saving result:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Execute call via VAPI
  const handleExecuteCall = async (call: Outreach) => {
    if (!user) return;
    setExecutingCallId(call.id);
    
    try {
      const response = await fetch("/api/outreach/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreach_id: call.id,
          user_id: user?.id || "",
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Call initiated - refresh the list
        await loadCalls();
      } else {
        // Show error - VAPI not configured
        console.log("Call not executed:", data.message);
        // Open result dialog for manual entry
        openResultDialog(call);
      }
    } catch (error) {
      console.error("Error executing call:", error);
      openResultDialog(call);
    } finally {
      setExecutingCallId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Don't block on tenant loading - show UI immediately with data loading indicator

  // Outbound Dashboard - Call Queue View
  if (dashboardType === 'outbound') {
    // All calls (show all, not just evaluated ones)
    const allEvaluatedCalls = calls;
    
    // Apply filters
    const filteredCalls = allEvaluatedCalls.filter(call => {
      // Score filter
      if (scoreFilter !== "all") {
        const score = call.evaluation_score || 0;
        if (scoreFilter === "high" && score < 8) return false;
        if (scoreFilter === "medium" && (score < 5 || score >= 8)) return false;
        if (scoreFilter === "low" && score >= 5) return false;
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
      
      return true;
    });

    // Calculate stats
    const highInterestCalls = allEvaluatedCalls.filter(c => (c.evaluation_score || 0) >= 8);
    const avgScore = allEvaluatedCalls.length > 0 
      ? (allEvaluatedCalls.reduce((sum, c) => sum + (c.evaluation_score || 0), 0) / allEvaluatedCalls.filter(c => c.evaluation_score).length).toFixed(1)
      : "0";

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Arama Değerlendirmeleri</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              AI asistan aramaları ve müşteri ilgi puanları
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <PhoneCall className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Toplam Arama</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{allEvaluatedCalls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Yüksek İlgi (8+)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{highInterestCalls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                  <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ort. Puan</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Randevu</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {allEvaluatedCalls.filter(c => c.type === 'appointment').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium mb-2 block">Puan Filtresi</Label>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Puan seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="high">Yüksek İlgi (8-10)</SelectItem>
                    <SelectItem value="medium">Orta İlgi (5-7)</SelectItem>
                    <SelectItem value="low">Düşük İlgi (0-4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-sm font-medium mb-2 block">Tarih Filtresi</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tarih seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="today">Bugün</SelectItem>
                    <SelectItem value="week">Son 7 Gün</SelectItem>
                    <SelectItem value="month">Son 30 Gün</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-sm font-medium mb-2 block">Ara</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="İsim veya telefon..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call Evaluations List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Aramalar
            </CardTitle>
            <CardDescription>
              {filteredCalls.length} / {allEvaluatedCalls.length} arama gösteriliyor
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCalls.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Phone className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">
                  {allEvaluatedCalls.length === 0 ? "Henüz değerlendirilmiş arama yok" : "Filtrelere uygun arama bulunamadı"}
                </p>
                <p className="text-sm mt-2">
                  {allEvaluatedCalls.length === 0 ? "AI asistan aramaları burada görünecek" : "Filtreleri değiştirmeyi deneyin"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCalls
                  .filter(call => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      call.caller_name?.toLowerCase().includes(query) ||
                      call.caller_phone?.toLowerCase().includes(query)
                    );
                  })
                  .map((call) => {
                  const score = call.evaluation_score;
                  const scoreColor = score === null ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                    score >= 8 ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" :
                    score >= 5 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400" :
                    "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400";
                  
                  return (
                    <div key={call.id} className="flex border dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                      {/* Score Column */}
                      <div className={cn("w-20 flex flex-col items-center justify-center p-4", scoreColor)}>
                        <span className="text-3xl font-bold">{score ?? "-"}</span>
                        <span className="text-xs font-medium opacity-75">/10</span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                              {call.caller_name || "Bilinmeyen Arayan"}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {call.caller_phone || "Numara yok"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {format(new Date(call.created_at), "d MMM yyyy", { locale: tr })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(call.created_at), "HH:mm", { locale: tr })} - {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : "-"}
                            </p>
                          </div>
                        </div>
                        
                        {/* Summary */}
                        {call.summary && (
                          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <FileText className="w-4 h-4 inline mr-2 text-gray-400" />
                              <span className="font-medium">Özet:</span> {call.summary}
                            </p>
                          </div>
                        )}

                        {/* Transcript */}
                        {call.transcript && (
                          <details className="mb-3">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary">
                              📝 Transkripti Görüntüle
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-60 overflow-y-auto">
                              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                {call.transcript}
                              </p>
                            </div>
                          </details>
                        )}
                        
                        {/* Evaluation */}
                        {call.evaluation_summary && (
                          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <Star className="w-4 h-4 inline mr-2" />
                              <span className="font-medium">Değerlendirme:</span> {call.evaluation_summary}
                            </p>
                          </div>
                        )}
                        
                        {/* Tags */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "px-3 py-1 text-xs rounded-full font-medium",
                            call.type === "appointment" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            call.type === "inquiry" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            call.type === "cancellation" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                          )}>
                            {call.type === "appointment" ? "Randevu" :
                             call.type === "inquiry" ? "Bilgi Talebi" :
                             call.type === "cancellation" ? "İptal" :
                             "Takip"}
                          </span>
                          <span className={cn(
                            "px-3 py-1 text-xs rounded-full font-medium",
                            call.sentiment === "positive" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            call.sentiment === "negative" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          )}>
                            {call.sentiment === "positive" ? "Olumlu" :
                             call.sentiment === "negative" ? "Olumsuz" :
                             "Nötr"}
                          </span>
                          {call.recording_url && (
                            <a 
                              href={call.recording_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-xs rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 transition-colors flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" />
                              Kaydı Dinle
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result Dialog - Keep for manual entry */}
        <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Arama Sonucu</DialogTitle>
              <DialogDescription>
                {selectedCall?.lead?.full_name} ile yapılan arama sonucunu girin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Sonuç *</Label>
                <Select value={callResult} onValueChange={(value) => setCallResult(value as OutreachResult)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sonuç seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(resultConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notlar</Label>
                <Textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Arama hakkında notlar..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResultDialog(false)}>
                İptal
              </Button>
              <Button onClick={handleSaveResult} disabled={isSaving || !callResult}>
                {isSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Score color helper
  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-gray-100 text-gray-600";
    if (score >= 8) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 5) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  };

  const getScoreIcon = (score: number | null) => {
    if (score === null) return Minus;
    if (score >= 8) return TrendingUp;
    if (score >= 5) return Minus;
    return TrendingDown;
  };

  // Filter calls
  const filteredCalls = calls.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.caller_phone?.toLowerCase().includes(query) ||
      call.caller_name?.toLowerCase().includes(query) ||
      call.summary?.toLowerCase().includes(query)
    );
  });

  // Inbound Dashboard - Call Cards View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aramalar</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {calls.length} arama kaydı • Müşteri değerlendirmeleri
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <PhoneCall className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{calls.length}</p>
                <p className="text-xs text-gray-500">Toplam</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{calls.filter(c => (c.evaluation_score || 0) >= 8).length}</p>
                <p className="text-xs text-gray-500">Yüksek İlgi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {calls.length > 0 
                    ? (calls.reduce((sum, c) => sum + (c.evaluation_score || 0), 0) / calls.filter(c => c.evaluation_score).length || 0).toFixed(1)
                    : "0"}
                </p>
                <p className="text-xs text-gray-500">Ort. Puan</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{calls.filter(c => c.type === 'appointment').length}</p>
                <p className="text-xs text-gray-500">Randevu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="İsim, telefon veya özet ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Call Cards */}
      <div className="space-y-4">
        {filteredCalls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Henüz arama kaydı yok</p>
              <p className="text-sm text-gray-400 mt-1">Aramalar otomatik olarak VAPI&apos;den senkronize edilir</p>
            </CardContent>
          </Card>
        ) : (
          filteredCalls.map((call) => {
            const ScoreIcon = getScoreIcon(call.evaluation_score);
            return (
              <Card key={call.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Score Column */}
                    <div className={cn(
                      "w-20 flex flex-col items-center justify-center p-4",
                      getScoreColor(call.evaluation_score)
                    )}>
                      <span className="text-3xl font-bold">{call.evaluation_score ?? "-"}</span>
                      <span className="text-xs font-medium">/10</span>
                      <ScoreIcon className="w-4 h-4 mt-1" />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {call.caller_name || "Bilinmeyen Arayan"}
                            </h3>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {call.caller_phone || "Numara yok"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-900 dark:text-white">
                            {format(new Date(call.created_at), "d MMM yyyy", { locale: tr })}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(call.created_at), "HH:mm", { locale: tr })} • {call.duration ? formatDuration(call.duration) : "-"}
                          </p>
                        </div>
                      </div>

                      {/* Call Summary */}
                      {call.summary && (
                        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                            <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                            {call.summary}
                          </p>
                        </div>
                      )}

                      {/* Evaluation Summary */}
                      {call.evaluation_summary && (
                        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                            <Star className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="font-medium">Değerlendirme:</span> {call.evaluation_summary}
                          </p>
                        </div>
                      )}

                      {/* Tags Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "px-2 py-1 text-xs rounded-full font-medium",
                          call.type === "appointment" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          call.type === "inquiry" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          call.type === "cancellation" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                        )}>
                          {call.type === "appointment" ? "Randevu" :
                           call.type === "inquiry" ? "Bilgi Talebi" :
                           call.type === "cancellation" ? "İptal" :
                           call.type === "follow_up" ? "Takip" : call.type}
                        </span>
                        <span className={cn(
                          "px-2 py-1 text-xs rounded-full font-medium",
                          call.sentiment === "positive" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          call.sentiment === "negative" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {call.sentiment === "positive" ? "😊 Olumlu" :
                           call.sentiment === "negative" ? "😞 Olumsuz" :
                           "😐 Nötr"}
                        </span>
                        {call.recording_url && (
                          <a 
                            href={call.recording_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 transition-colors flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Kayıt
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
