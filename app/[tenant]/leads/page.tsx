"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { updateLead } from "@/lib/supabase-outbound";
import type { Lead, LeadStatus, LeadLanguage, LeadPriority } from "@/lib/types-outbound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  RefreshCw, 
  Phone,
  Mail,
  MessageSquare,
  Instagram,
  Filter,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Users,
  Loader2,
  UserPlus,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusConfig: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new: { label: "Yeni", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  contacted: { label: "İletişime Geçildi", color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  interested: { label: "İlgileniyor", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  appointment_set: { label: "Randevu Alındı", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  converted: { label: "Dönüşüm", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  unreachable: { label: "Ulaşılamadı", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  lost: { label: "Kayıp", color: "text-gray-700 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-700" },
};

const priorityConfig: Record<LeadPriority, { label: string; color: string; bg: string; icon: string }> = {
  high: { label: "Yüksek", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", icon: "🔥" },
  medium: { label: "Orta", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", icon: "⭐" },
  low: { label: "Düşük", color: "text-gray-700 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-700", icon: "💤" },
};

export default function LeadsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenant = params?.tenant as string;
  useTenant();
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | "all">("all");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<Partial<Lead>[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Lead>>({
    full_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    instagram: "",
    language: "tr",
    source: "",
    interest: "",
    notes: "",
    status: "new",
    priority: "medium",
  });

  const loadLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "100");

      const response = await fetch(`/api/dashboard/leads?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          let filteredData = result.data;
          if (statusFilter !== "all") {
            filteredData = filteredData.filter((l: Lead) => l.status === statusFilter);
          }
          if (priorityFilter !== "all") {
            filteredData = filteredData.filter((l: Lead) => l.priority === priorityFilter);
          }
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredData = filteredData.filter((l: Lead) => 
              l.full_name?.toLowerCase().includes(query) ||
              l.phone?.toLowerCase().includes(query) ||
              l.email?.toLowerCase().includes(query)
            );
          }
          setLeads(filteredData);
        }
      }
    } catch (error) {
      console.error("Error loading leads:", error);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    loadLeads().then(() => setIsLoading(false));
    
    if (user?.id && !sessionStorage.getItem('leads_synced')) {
      sessionStorage.setItem('leads_synced', 'true');
      fetch(`/api/vapi/sync?days=14&userId=${user.id}`, { method: "POST" }).catch(() => {});
      fetch(`/api/vapi/sync-leads?userId=${user.id}`, { method: "POST" }).catch(() => {});
    }
  }, [loadLeads, user?.id]);

  useEffect(() => {
    const leadId = searchParams.get("id");
    if (leadId && leads.length > 0) {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setFormData(lead);
        setShowEditDialog(true);
      }
    }
  }, [searchParams, leads]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeads();
    setIsRefreshing(false);
    
    if (user?.id) {
      fetch(`/api/vapi/sync?days=14&userId=${user.id}`, { method: "POST" }).catch(() => {});
      fetch(`/api/vapi/sync-leads?userId=${user.id}`, { method: "POST" }).catch(() => {});
    }
  };

  const handleAddLead = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      
      if (result.success) {
        setShowAddDialog(false);
        resetForm();
        await loadLeads();
      } else {
        alert("Lead eklenemedi: " + (result.error || "Bilinmeyen hata"));
      }
    } catch (error) {
      alert("Lead eklenemedi");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditLead = async () => {
    if (!selectedLead) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedLead.id, ...formData }),
      });
      const result = await response.json();
      
      if (result.success) {
        setShowEditDialog(false);
        setSelectedLead(null);
        resetForm();
        await loadLeads();
      }
    } catch (error) {
      console.error("Error updating lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/dashboard/leads?id=${selectedLead.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        setShowDeleteDialog(false);
        setSelectedLead(null);
        await loadLeads();
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCallLead = async (lead: Lead) => {
    if (!lead.phone) {
      alert("Bu lead'in telefon numarası yok");
      return;
    }
    
    setCallingLeadId(lead.id);
    try {
      const response = await fetch("/api/outreach/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          channel: "call",
          direct_call: true,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Arama başlatıldı: ${lead.full_name}`);
        await updateLead(lead.id, { status: "contacted", last_contact_date: new Date().toISOString() });
        await loadLeads();
      } else {
        alert(`Arama başarısız: ${data.message || data.error}`);
      }
    } catch (error) {
      alert("Arama hatası oluştu");
    } finally {
      setCallingLeadId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      whatsapp: "",
      instagram: "",
      language: "tr",
      source: "",
      interest: "",
      notes: "",
      status: "new",
      priority: "medium",
    });
  };

  // CSV Functions (keeping existing logic)
  const parseCSV = (text: string): Partial<Lead>[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    const header = lines[0]!.split(/[,;]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const columnMap: Record<string, keyof Lead> = {
      'ad soyad': 'full_name', 'full_name': 'full_name', 'isim': 'full_name', 'name': 'full_name',
      'email': 'email', 'e-posta': 'email', 'telefon': 'phone', 'phone': 'phone', 'tel': 'phone',
      'whatsapp': 'whatsapp', 'wa': 'whatsapp', 'instagram': 'instagram', 'ig': 'instagram',
      'dil': 'language', 'language': 'language', 'kaynak': 'source', 'source': 'source',
      'ilgi': 'interest', 'interest': 'interest', 'ilgi alanı': 'interest',
      'notlar': 'notes', 'notes': 'notes', 'not': 'notes',
    };
    const validSources = ['web_form', 'instagram', 'referral', 'facebook', 'google_ads', 'other'];
    const sourceMapping: Record<string, string> = {
      'website': 'web_form', 'web': 'web_form', 'form': 'web_form', 'site': 'web_form',
      'instagram': 'instagram', 'ig': 'instagram', 'insta': 'instagram',
      'referral': 'referral', 'referans': 'referral', 'tavsiye': 'referral',
      'facebook': 'facebook', 'fb': 'facebook', 'google': 'google_ads', 'google_ads': 'google_ads',
      'ads': 'google_ads', 'other': 'other', 'diğer': 'other', 'diger': 'other',
    };
    const leads: Partial<Lead>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(/[,;]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const lead: Partial<Lead> = {};
      header.forEach((col, index) => {
        const mappedKey = columnMap[col];
        if (mappedKey && values[index]) {
          if (mappedKey === 'language') {
            const langValue = values[index]!.toLowerCase();
            (lead as Record<string, string>)[mappedKey] = (langValue === 'en' || langValue === 'english' || langValue === 'ingilizce') ? 'en' : 'tr';
          } else if (mappedKey === 'source') {
            const sourceValue = values[index]!.toLowerCase().trim();
            const mappedSource = sourceMapping[sourceValue];
            (lead as Record<string, string>)[mappedKey] = mappedSource || (validSources.includes(sourceValue) ? sourceValue : 'other');
          } else {
            (lead as Record<string, string>)[mappedKey] = values[index]!;
          }
        }
      });
      if (lead.full_name) leads.push(lead);
    }
    return leads;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");
    setUploadResult(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setCsvError("Geçerli lead bulunamadı.");
          setCsvData([]);
        } else {
          setCsvData(parsed);
          setShowCsvDialog(true);
        }
      } catch {
        setCsvError("CSV dosyası okunamadı.");
        setCsvData([]);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCsvUpload = async () => {
    if (csvData.length === 0) return;
    setIsUploading(true);
    let successCount = 0, failedCount = 0;
    const errors: string[] = [];
    for (const lead of csvData) {
      try {
        const response = await fetch("/api/dashboard/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead),
        });
        const result = await response.json();
        if (result.success) successCount++;
        else { failedCount++; errors.push(`${lead.full_name}: ${result.error || "Hata"}`); }
      } catch { failedCount++; errors.push(`${lead.full_name}: Bağlantı hatası`); }
    }
    setUploadResult({ success: successCount, failed: failedCount, errors });
    if (successCount > 0) await loadLeads();
    setIsUploading(false);
  };

  const closeCsvDialog = () => {
    setShowCsvDialog(false);
    setCsvData([]);
    setCsvFileName("");
    setCsvError("");
    setUploadResult(null);
  };

  const openEditDialog = (lead: Lead) => { setSelectedLead(lead); setFormData(lead); setShowEditDialog(true); };
  const openDeleteDialog = (lead: Lead) => { setSelectedLead(lead); setShowDeleteDialog(true); };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return lead.full_name.toLowerCase().includes(query) || lead.email?.toLowerCase().includes(query) || lead.phone?.toLowerCase().includes(query);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">Lead'ler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtNHY2aDR2LTJ6TTI2IDI0aC0ydjJoMnYtMnptMCAyaC0ydjJoMnYtMnptMTAgMTBoLTJ2Mmgydi0yem0wIDBoMnYtMmgtMnYyem0tMTAgMGgtMnYyaDJ2LTJ6bTAgMGgydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Users className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold">Müşteri Adayları</h1>
              </div>
              <p className="text-emerald-100 text-lg">
                {leads.length} lead yönetiliyor
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileSelect} className="hidden" />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                CSV Yükle
              </Button>
              <Button 
                onClick={() => { resetForm(); setShowAddDialog(true); }}
                className="bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Lead
              </Button>
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
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-cyan-400/20 rounded-full blur-2xl" />
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">Filtreler</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Ara</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="İsim, email veya telefon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-12 rounded-xl border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Durum</label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as LeadStatus | "all")}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Tüm Durumlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  {Object.entries(statusConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Öncelik</label>
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as LeadPriority | "all")}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Tüm Öncelikler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Öncelikler</SelectItem>
                  {Object.entries(priorityConfig).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>{icon} {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900 dark:text-white">{filteredLeads.length}</span> lead gösteriliyor
        </p>
      </div>

      {/* Leads Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className="group border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardContent className="p-0">
              {/* Header */}
              <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg">
                      {lead.full_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{lead.full_name || "İsimsiz"}</h3>
                      <p className="text-sm text-gray-500">{lead.treatment_interest || lead.interest || "—"}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                        <Edit className="w-4 h-4 mr-2" /> Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openDeleteDialog(lead)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" /> Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("px-3 py-1 text-xs rounded-full font-semibold", statusConfig[lead.status]?.bg, statusConfig[lead.status]?.color)}>
                    {statusConfig[lead.status]?.label || lead.status}
                  </span>
                  <span className={cn("px-3 py-1 text-xs rounded-full font-semibold", priorityConfig[lead.priority]?.bg, priorityConfig[lead.priority]?.color)}>
                    {priorityConfig[lead.priority]?.icon} {priorityConfig[lead.priority]?.label}
                  </span>
                  <span className="text-sm">{lead.language === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="p-5 space-y-2">
                {lead.phone && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{lead.phone}</span>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                {lead.whatsapp && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <MessageSquare className="w-4 h-4 text-green-500" />
                    <span>{lead.whatsapp}</span>
                  </div>
                )}
                {lead.instagram && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    <span>@{lead.instagram}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-5 pt-0 space-y-3">
                {lead.phone && (
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                    onClick={(e) => { e.stopPropagation(); handleCallLead(lead); }}
                    disabled={callingLeadId === lead.id}
                  >
                    {callingLeadId === lead.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Phone className="w-4 h-4 mr-2" />
                    )}
                    {callingLeadId === lead.id ? "Aranıyor..." : "Ara"}
                  </Button>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span>Kaynak: {lead.source || "—"}</span>
                  <span>{format(new Date(lead.created_at), "d MMM yyyy", { locale: tr })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredLeads.length === 0 && (
          <div className="col-span-full text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
              <Users className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lead bulunamadı</h3>
            <p className="text-gray-500 mb-6">İlk lead'inizi ekleyerek başlayın</p>
            <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              İlk Lead'i Ekle
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) { setShowAddDialog(false); setShowEditDialog(false); setSelectedLead(null); resetForm(); }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              {showEditDialog ? "Lead Düzenle" : "Yeni Lead Ekle"}
            </DialogTitle>
            <DialogDescription>
              {showEditDialog ? "Lead bilgilerini güncelleyin." : "Yeni bir müşteri adayı ekleyin."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad Soyad *</Label>
                <Input value={formData.full_name || ""} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="John Doe" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+90 555 123 4567" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={formData.whatsapp || ""} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="+90 555 123 4567" className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={formData.instagram || ""} onChange={(e) => setFormData({ ...formData, instagram: e.target.value })} placeholder="username" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Dil</Label>
                <Select value={formData.language || "tr"} onValueChange={(value) => setFormData({ ...formData, language: value as LeadLanguage })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kaynak</Label>
                <Input value={formData.source || ""} onChange={(e) => setFormData({ ...formData, source: e.target.value })} placeholder="Website, Instagram..." className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>İlgi Alanı</Label>
                <Input value={formData.interest || ""} onChange={(e) => setFormData({ ...formData, interest: e.target.value })} placeholder="Diş tedavisi..." className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select value={formData.status || "new"} onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Öncelik</Label>
                <Select value={formData.priority || "medium"} onValueChange={(value) => setFormData({ ...formData, priority: value as LeadPriority })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([key, { label, icon }]) => (<SelectItem key={key} value={key}>{icon} {label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notlar</Label>
              <Textarea value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Ek notlar..." rows={3} className="rounded-xl" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setShowEditDialog(false); setSelectedLead(null); resetForm(); }} className="rounded-xl">İptal</Button>
            <Button onClick={showEditDialog ? handleEditLead : handleAddLead} disabled={isSaving || !formData.full_name} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {showEditDialog ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Lead Sil</DialogTitle>
            <DialogDescription>
              &quot;{selectedLead?.full_name}&quot; adlı lead&apos;i silmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="rounded-xl">İptal</Button>
            <Button variant="destructive" onClick={handleDeleteLead} disabled={isSaving} className="rounded-xl">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Dialog */}
      <Dialog open={showCsvDialog} onOpenChange={(open) => !open && closeCsvDialog()}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              CSV'den Lead Yükle
            </DialogTitle>
            <DialogDescription>
              <span className="text-emerald-600 font-medium">{csvFileName}</span> dosyasından {csvData.length} lead bulundu.
            </DialogDescription>
          </DialogHeader>
          {!uploadResult ? (
            <>
              <div className="max-h-[300px] overflow-auto border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Ad Soyad</th>
                      <th className="px-3 py-2 text-left font-medium">Telefon</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 10).map((lead, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                        <td className="px-3 py-2 font-medium">{lead.full_name}</td>
                        <td className="px-3 py-2 text-gray-600">{lead.phone || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{lead.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 10 && <div className="px-3 py-2 text-center text-sm text-gray-500 bg-gray-50">... ve {csvData.length - 10} lead daha</div>}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              {uploadResult.success > 0 ? (
                <>
                  <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Yükleme Tamamlandı!</h3>
                  <p className="text-gray-600"><span className="font-bold text-emerald-600">{uploadResult.success}</span> lead eklendi.</p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Yükleme Başarısız</h3>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {!uploadResult ? (
              <>
                <Button variant="outline" onClick={closeCsvDialog} className="rounded-xl">İptal</Button>
                <Button onClick={handleCsvUpload} disabled={isUploading} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {csvData.length} Lead Yükle
                </Button>
              </>
            ) : (
              <Button onClick={closeCsvDialog} className="rounded-xl">Kapat</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
