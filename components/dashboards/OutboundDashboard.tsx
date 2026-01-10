"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Users, 
  Phone, 
  CalendarCheck, 
  TrendingUp, 
  RefreshCw,
  MessageSquare,
  UserPlus,
  Clock,
  Target,
  PhoneCall,
  Cloud,
  Bot,
  PlayCircle,
  Plus,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createLead } from "@/lib/supabase-outbound";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { OutboundStats, Lead } from "@/lib/types-outbound";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const PAGE_VERSION = "1.0.0";

// Simple chart component for funnel
function FunnelChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.name} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
            <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
          </div>
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            <div 
              className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
              style={{ 
                width: `${Math.max((item.value / maxValue) * 100, 5)}%`,
                backgroundColor: item.color 
              }}
            >
              {item.value > 0 && data[0] && data[0].value > 0 && (
                <span className="text-white text-xs font-medium">
                  {Math.round((item.value / data[0].value) * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// VAPI call type
interface VapiCall {
  id: string;
  caller_phone: string | null;
  summary: string | null;
  duration: number | null;
  type: string;
  sentiment: string | null;
  created_at: string;
  recording_url: string | null;
}

interface VapiKPI {
  totalCalls: number;
  monthlyCalls: number;
  dailyCalls: number;
  avgDuration: number;
  appointmentRate: number;
}

export default function OutboundDashboard() {
  const router = useRouter();
  const params = useParams();
  const tenant = params?.tenant as string;
  const { user } = useAuth();
  
  const [stats, setStats] = useState<OutboundStats | null>(null);
  const [todaysLeads, setTodaysLeads] = useState<Lead[]>([]);
  const [channelPerformance, setChannelPerformance] = useState<{ channel: string; attempts: number; successes: number; rate: number }[]>([]);
  const [vapiCalls, setVapiCalls] = useState<VapiCall[]>([]);
  const [vapiKPI, setVapiKPI] = useState<VapiKPI | null>(null);
  const [vapiConnected, setVapiConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Start with false - show UI immediately
  
  // Add lead dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    notes: "",
    priority: "medium" as "high" | "medium" | "low",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reset form
  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      notes: "",
      priority: "medium",
    });
  };

  // Handle add single lead
  const handleAddLead = async () => {
    if (!formData.full_name) return;
    
    setIsSaving(true);
    try {
      await createLead({
        full_name: formData.full_name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        notes: formData.notes || undefined,
        priority: formData.priority,
        status: "new",
        language: "tr",
        source: "manual",
        next_contact_date: new Date().toISOString(),
      });
      
      setShowAddDialog(false);
      resetForm();
      // Reload leads
      const leadsResponse = await fetch("/api/dashboard/leads?limit=200");
      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();
        if (leadsData.success && leadsData.data) {
          const priorityLeads = leadsData.data
            .filter((l: { status: string }) => ['new', 'contacted', 'interested'].includes(l.status))
            .slice(0, 10);
          setTodaysLeads(priorityLeads);
        }
      }
    } catch (error) {
      console.error("Error adding lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle CSV import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header if present
      const startIndex = lines[0]?.toLowerCase().includes('name') || lines[0]?.toLowerCase().includes('isim') ? 1 : 0;
      
      let success = 0;
      let failed = 0;

      for (let i = startIndex; i < lines.length; i++) {
        const currentLine = lines[i];
        if (!currentLine) continue;
        const line = currentLine.trim();
        if (!line) continue;

        // Parse CSV line (handle quoted values)
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        
        if (values.length === 0) continue;

        // Assume format: name, phone, email, notes (flexible)
        const [name, phone, email, notes] = values;

        if (!name) {
          failed++;
          continue;
        }

        try {
          await createLead({
            full_name: name,
            phone: phone || undefined,
            email: email || undefined,
            notes: notes || undefined,
            priority: "medium",
            status: "new",
            language: "tr",
            source: "csv_import",
            next_contact_date: new Date().toISOString(),
          });
          success++;
        } catch {
          failed++;
        }
      }

      setImportResult({ success, failed });
      
      // Reload leads
      const leadsResponse = await fetch("/api/dashboard/leads?limit=200");
      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();
        if (leadsData.success && leadsData.data) {
          const priorityLeads = leadsData.data
            .filter((l: { status: string }) => ['new', 'contacted', 'interested'].includes(l.status))
            .slice(0, 10);
          setTodaysLeads(priorityLeads);
          setStats(prev => prev ? { ...prev, total_leads: leadsData.stats.total, new_leads: leadsData.stats.newLeads } : prev);
        }
      }
    } catch (error) {
      console.error("Error importing CSV:", error);
      setImportResult({ success: 0, failed: 1 });
    } finally {
      setIsSaving(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      // Load ALL data from server-side API routes (bypasses browser Supabase issues)
      const [callsResponse, leadsResponse] = await Promise.all([
        fetch("/api/dashboard/calls?days=30&limit=50"),
        fetch("/api/dashboard/leads?limit=200"),
      ]);

      if (callsResponse.ok) {
        const callsData = await callsResponse.json();
        if (callsData.success) {
          setVapiKPI({
            totalCalls: callsData.kpi.totalCalls,
            monthlyCalls: callsData.kpi.monthlyCalls,
            dailyCalls: callsData.kpi.dailyCalls,
            avgDuration: callsData.kpi.avgDuration,
            appointmentRate: callsData.kpi.appointmentRate,
          });
          setVapiConnected(true);
          if (callsData.data?.length > 0) {
            setVapiCalls(callsData.data);
          }
        }
      }

      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();
        if (leadsData.success) {
          // Update stats from API
          if (leadsData.stats) {
            setStats({
              total_leads: leadsData.stats.total || 0,
              new_leads: leadsData.stats.newLeads || 0,
              contacted_leads: leadsData.stats.contacted || 0,
              interested_leads: leadsData.stats.interested || 0,
              appointments_set: leadsData.stats.appointmentSet || 0,
              converted_leads: leadsData.stats.converted || 0,
              unreachable_leads: leadsData.stats.unreachable || 0,
              conversion_rate: leadsData.stats.conversionRate || 0,
              todays_calls: 0,
              completed_calls_today: 0,
            });
          }
          
          // Set today's leads from API
          if (leadsData.data) {
            const priorityLeads = leadsData.data
              .filter((l: { status: string }) => ['new', 'contacted', 'interested'].includes(l.status))
              .slice(0, 10);
            setTodaysLeads(priorityLeads);
          }
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const funnelData = [
    { name: "Toplam Lead", value: stats?.total_leads || 0, color: "#6366F1" },
    { name: "İletişime Geçildi", value: stats?.contacted_leads || 0, color: "#8B5CF6" },
    { name: "İlgileniyor", value: stats?.interested_leads || 0, color: "#A855F7" },
    { name: "Randevu Alındı", value: stats?.appointments_set || 0, color: "#D946EF" },
    { name: "Dönüşüm", value: stats?.converted_leads || 0, color: "#EC4899" },
  ];

  const channelNames: Record<string, string> = {
    call: "Telefon",
    whatsapp: "WhatsApp",
    email: "Email",
    sms: "SMS",
    instagram_dm: "Instagram DM",
  };

  const basePath = tenant ? `/${tenant}` : '/dashboard/outbound';

  return (
    <div className="space-y-6">
      {/* Version Badge */}
      <div className="flex justify-end">
        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
          v{PAGE_VERSION}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 -mt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Outbound Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hoş geldin{user?.full_name ? `, ${user.full_name}` : ""}! İşte satış performansın.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {format(new Date(), "HH:mm", { locale: tr })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* KPI Cards - Use VAPI data if outbound data is empty */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                {vapiConnected && !stats?.total_leads ? (
                  <PhoneCall className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                ) : (
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {vapiConnected && !stats?.total_leads ? "Toplam Arama" : "Toplam Lead"}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vapiConnected && !stats?.total_leads ? (vapiKPI?.totalCalls || 0) : (stats?.total_leads || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                {vapiConnected && !stats?.new_leads ? (
                  <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                <UserPlus className="w-6 h-6 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {vapiConnected && !stats?.new_leads ? "Bu Ay" : "Yeni Lead"}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vapiConnected && !stats?.new_leads ? (vapiKPI?.monthlyCalls || 0) : (stats?.new_leads || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <CalendarCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Randevu</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.appointments_set || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {vapiConnected ? "Ort. Süre" : "Ulaşılamayan"}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vapiConnected ? (
                    vapiKPI?.avgDuration ? `${Math.floor(vapiKPI.avgDuration / 60)}:${(vapiKPI.avgDuration % 60).toString().padStart(2, '0')}` : '0:00'
                  ) : (stats?.unreachable_leads || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {vapiConnected ? "Randevu %" : "Dönüşüm"}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  %{vapiConnected ? (vapiKPI?.appointmentRate || 0) : (stats?.conversion_rate || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Actions & Funnel - Show different content based on data availability */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Calls Card - Use VAPI data if no outbound data */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-primary" />
              {vapiConnected && !stats?.todays_calls ? "AI Arama Özeti" : "Bugünkü Aramalar"}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push(`${basePath}/calls`)}>
              Tümünü Gör
            </Button>
          </CardHeader>
          <CardContent>
            {vapiConnected && !stats?.todays_calls ? (
              // VAPI data view
              <div className="flex items-center justify-between mb-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-green-600">{vapiKPI?.dailyCalls || 0}</p>
                  <p className="text-sm text-gray-500">Bugün</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-blue-600">{vapiKPI?.monthlyCalls || 0}</p>
                  <p className="text-sm text-gray-500">Bu Ay</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-purple-600">{vapiKPI?.totalCalls || 0}</p>
                  <p className="text-sm text-gray-500">Toplam</p>
                </div>
              </div>
            ) : (
              // Outbound data view
            <div className="flex items-center justify-between mb-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{stats?.completed_calls_today || 0}</p>
                <p className="text-sm text-gray-500">Tamamlanan</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-orange-500">{(stats?.todays_calls || 0) - (stats?.completed_calls_today || 0)}</p>
                <p className="text-sm text-gray-500">Bekleyen</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-400">{stats?.todays_calls || 0}</p>
                <p className="text-sm text-gray-500">Toplam</p>
              </div>
            </div>
            )}
            
            {/* Progress bar - show success rate for VAPI, daily progress for outbound */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {vapiConnected && !stats?.todays_calls ? "Başarı Oranı" : "Günlük İlerleme"}
                </span>
                <span className="font-medium">
                  {vapiConnected && !stats?.todays_calls 
                    ? `${vapiKPI?.appointmentRate || 0}%`
                    : `${stats?.todays_calls ? Math.round(((stats.completed_calls_today || 0) / stats.todays_calls) * 100) : 0}%`
                  }
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-500"
                  style={{ 
                    width: vapiConnected && !stats?.todays_calls 
                      ? `${vapiKPI?.appointmentRate || 0}%`
                      : `${stats?.todays_calls ? ((stats.completed_calls_today || 0) / stats.todays_calls) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Funnel or Call Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {vapiConnected && !stats?.total_leads ? "Arama Türleri" : "Satış Hunisi"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vapiConnected && !stats?.total_leads ? (
              // VAPI call type distribution
              <FunnelChart data={[
                { name: "Toplam Arama", value: vapiKPI?.totalCalls || 0, color: "#6366F1" },
                { name: "Bu Ay", value: vapiKPI?.monthlyCalls || 0, color: "#8B5CF6" },
                { name: "Bugün", value: vapiKPI?.dailyCalls || 0, color: "#A855F7" },
                { name: "Randevu", value: Math.round((vapiKPI?.totalCalls || 0) * (vapiKPI?.appointmentRate || 0) / 100), color: "#D946EF" },
              ]} />
            ) : (
            <FunnelChart data={funnelData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* VAPI AI Calls Section - Recent calls list */}
      {vapiConnected && vapiCalls.length > 0 && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-green-600" />
                Son AI Aramaları
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                  <Cloud className="w-3 h-3" />
                  VAPI Live
                </span>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => router.push(`${basePath}/calls`)}>
                Tümünü Gör
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {vapiCalls.slice(0, 5).map((call) => (
                <div 
                  key={call.id} 
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      call.sentiment === 'positive' ? 'bg-green-100 text-green-600' :
                      call.sentiment === 'negative' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {call.caller_phone || 'Bilinmeyen'}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {call.summary || `${call.type} arama`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '-'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: tr })}
                    </span>
                    {call.recording_url && (
                      <a 
                        href={call.recording_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channel Performance & Leads to Contact */}
      <div className="grid lg:grid-cols-2 gap-6">
          {/* Channel Performance - Only show if has data */}
          {channelPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Kanal Performansı
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="space-y-4">
                {channelPerformance.map((channel) => (
                  <div key={channel.channel} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {channel.channel === 'call' && <Phone className="w-5 h-5 text-blue-500" />}
                      {channel.channel === 'whatsapp' && <MessageSquare className="w-5 h-5 text-green-500" />}
                      {channel.channel === 'email' && <MessageSquare className="w-5 h-5 text-purple-500" />}
                      {channel.channel === 'instagram_dm' && <MessageSquare className="w-5 h-5 text-pink-500" />}
                      {channel.channel === 'sms' && <MessageSquare className="w-5 h-5 text-orange-500" />}
                      <span className="font-medium">{channelNames[channel.channel] || channel.channel}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{channel.attempts} deneme</span>
                      <span className="font-medium text-green-600">%{channel.rate}</span>
                    </div>
                  </div>
                ))}
              </div>
          </CardContent>
        </Card>
          )}

          {/* Leads to Contact Today - Always show with add options */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Bugün Aranacaklar
            </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ekle
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                  <Upload className="w-4 h-4 mr-1" />
                  CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={() => router.push(`${basePath}/leads`)}>
              Tümünü Gör
            </Button>
              </div>
          </CardHeader>
          <CardContent>
            {todaysLeads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="mb-3">Henüz aranacak lead yok</p>
                  <div className="flex justify-center gap-2">
                    <Button size="sm" onClick={() => setShowAddDialog(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Lead Ekle
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
                      <Upload className="w-4 h-4 mr-1" />
                      CSV Yükle
                    </Button>
                  </div>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysLeads.slice(0, 5).map((lead) => (
                  <div 
                    key={lead.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => router.push(`${basePath}/leads?id=${lead.id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{lead.full_name}</p>
                      <p className="text-sm text-gray-500">{lead.phone || lead.whatsapp}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        lead.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {lead.priority === 'high' ? 'Yüksek' : lead.priority === 'medium' ? 'Orta' : 'Düşük'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {lead.language === 'tr' ? '🇹🇷' : '🇬🇧'}
                      </span>
                    </div>
                  </div>
                ))}
                {todaysLeads.length > 5 && (
                  <p className="text-sm text-center text-gray-500">
                    +{todaysLeads.length - 5} daha
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Lead Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Yeni Lead Ekle</DialogTitle>
            <DialogDescription>
              Bugün aranacak yeni bir kişi ekleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Ad Soyad *</Label>
              <Input
                id="name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ahmet Yılmaz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0555 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ahmet@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Öncelik</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as "high" | "medium" | "low" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Yüksek</SelectItem>
                  <SelectItem value="medium">Orta</SelectItem>
                  <SelectItem value="low">Düşük</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ek bilgiler..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              İptal
            </Button>
            <Button onClick={handleAddLead} disabled={isSaving || !formData.full_name}>
              {isSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { setShowImportDialog(open); setImportResult(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>CSV Dosyasından İçe Aktar</DialogTitle>
            <DialogDescription>
              Lead listesi içeren bir CSV dosyası yükleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                CSV formatı: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">isim, telefon, email, notlar</code>
              </p>
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleCSVImport}
                disabled={isSaving}
                className="max-w-xs mx-auto"
              />
            </div>
            
            {isSaving && (
              <div className="flex items-center justify-center gap-2 mt-4 text-primary">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>İçe aktarılıyor...</span>
              </div>
            )}
            
            {importResult && (
              <div className={`mt-4 p-3 rounded-lg ${importResult.failed > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                <p className="text-sm">
                  <span className="font-medium text-green-600">{importResult.success}</span> lead başarıyla eklendi
                  {importResult.failed > 0 && (
                    <>, <span className="font-medium text-red-600">{importResult.failed}</span> başarısız</>
                  )}
                </p>
              </div>
            )}

            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-2">Örnek CSV:</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400">
{`isim,telefon,email,notlar
Ahmet Yılmaz,05551234567,ahmet@email.com,Diş tedavisi
Ayşe Demir,05559876543,ayse@email.com,Saç ekimi`}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportResult(null); }}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
