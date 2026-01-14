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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  X,
  ChevronDown,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "Yeni", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  contacted: { label: "İletişime Geçildi", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  interested: { label: "İlgileniyor", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  appointment_set: { label: "Randevu Alındı", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  converted: { label: "Dönüşüm", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  unreachable: { label: "Ulaşılamadı", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  lost: { label: "Kayıp", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400" },
};

const priorityConfig: Record<LeadPriority, { label: string; color: string }> = {
  high: { label: "Yüksek", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "Orta", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "Düşük", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400" },
};

export default function LeadsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenant = params?.tenant as string;
  useTenant(); // Ensure tenant context is available
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | "all">("all");

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // CSV upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<Partial<Lead>[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);

  // Form state
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
      // Use API endpoint (admin access, bypasses RLS)
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "100");

      const response = await fetch(`/api/dashboard/leads?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Apply client-side filters
          let filteredData = result.data;
          if (statusFilter !== "all") {
            filteredData = filteredData.filter((l: any) => l.status === statusFilter);
          }
          if (priorityFilter !== "all") {
            filteredData = filteredData.filter((l: any) => l.priority === priorityFilter);
          }
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredData = filteredData.filter((l: any) => 
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
    // Load leads immediately (fast)
    loadLeads().then(() => setIsLoading(false));
    
    // Background sync (non-blocking, once per session)
    if (user?.id && !sessionStorage.getItem('leads_synced')) {
      sessionStorage.setItem('leads_synced', 'true');
      fetch(`/api/vapi/sync?days=14&userId=${user.id}`, { method: "POST" }).catch(() => {});
      fetch(`/api/vapi/sync-leads?userId=${user.id}`, { method: "POST" }).catch(() => {});
    }
  }, [loadLeads, user?.id]);

  // Check for lead ID in URL params
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
    // Load leads first (fast), then sync in background
    await loadLeads();
    setIsRefreshing(false);
    
    // Background sync (non-blocking)
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
        console.error("Error creating lead:", result.error);
        alert("Lead eklenemedi: " + (result.error || "Bilinmeyen hata"));
      }
    } catch (error) {
      console.error("Error creating lead:", error);
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
      } else {
        console.error("Error updating lead:", result.error);
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
      } else {
        console.error("Error deleting lead:", result.error);
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Direct VAPI call from leads
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
          direct_call: true, // Flag for direct call without outreach record
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Arama başlatıldı: ${lead.full_name}`);
        // Update lead status
        await updateLead(lead.id, { status: "contacted", last_contact_date: new Date().toISOString() });
        await loadLeads();
      } else {
        alert(`Arama başarısız: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error("Error calling lead:", error);
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

  // CSV Functions
  const parseCSV = (text: string): Partial<Lead>[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse header
    const header = lines[0]!.split(/[,;]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    // Column mapping
    const columnMap: Record<string, keyof Lead> = {
      'ad soyad': 'full_name',
      'full_name': 'full_name',
      'isim': 'full_name',
      'name': 'full_name',
      'email': 'email',
      'e-posta': 'email',
      'telefon': 'phone',
      'phone': 'phone',
      'tel': 'phone',
      'whatsapp': 'whatsapp',
      'wa': 'whatsapp',
      'instagram': 'instagram',
      'ig': 'instagram',
      'dil': 'language',
      'language': 'language',
      'kaynak': 'source',
      'source': 'source',
      'ilgi': 'interest',
      'interest': 'interest',
      'ilgi alanı': 'interest',
      'notlar': 'notes',
      'notes': 'notes',
      'not': 'notes',
    };

    // Valid source values (from database constraint)
    const validSources = ['web_form', 'instagram', 'referral', 'facebook', 'google_ads', 'other'];
    const sourceMapping: Record<string, string> = {
      'website': 'web_form',
      'web': 'web_form',
      'form': 'web_form',
      'site': 'web_form',
      'instagram': 'instagram',
      'ig': 'instagram',
      'insta': 'instagram',
      'referral': 'referral',
      'referans': 'referral',
      'tavsiye': 'referral',
      'facebook': 'facebook',
      'fb': 'facebook',
      'google': 'google_ads',
      'google_ads': 'google_ads',
      'ads': 'google_ads',
      'other': 'other',
      'diğer': 'other',
      'diger': 'other',
    };

    const leads: Partial<Lead>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(/[,;]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const lead: Partial<Lead> = {};
      
      header.forEach((col, index) => {
        const mappedKey = columnMap[col];
        if (mappedKey && values[index]) {
          // Handle language field
          if (mappedKey === 'language') {
            const langValue = values[index]!.toLowerCase();
            (lead as Record<string, string>)[mappedKey] = (langValue === 'en' || langValue === 'english' || langValue === 'ingilizce') ? 'en' : 'tr';
          } 
          // Handle source field - map to valid values
          else if (mappedKey === 'source') {
            const sourceValue = values[index]!.toLowerCase().trim();
            const mappedSource = sourceMapping[sourceValue];
            if (mappedSource) {
              (lead as Record<string, string>)[mappedKey] = mappedSource;
            } else if (validSources.includes(sourceValue)) {
              (lead as Record<string, string>)[mappedKey] = sourceValue;
            } else {
              // Default to 'other' for unrecognized sources
              (lead as Record<string, string>)[mappedKey] = 'other';
            }
          }
          else {
            (lead as Record<string, string>)[mappedKey] = values[index]!;
          }
        }
      });
      
      // Only add if has full_name
      if (lead.full_name) {
        leads.push(lead);
      }
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
          setCsvError("Geçerli lead bulunamadı. 'full_name' veya 'Ad Soyad' sütunu zorunludur.");
          setCsvData([]);
        } else {
          setCsvData(parsed);
          setShowCsvDialog(true);
        }
      } catch (err) {
        setCsvError("CSV dosyası okunamadı. Lütfen dosya formatını kontrol edin.");
        setCsvData([]);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCsvUpload = async () => {
    if (csvData.length === 0) return;
    
    setIsUploading(true);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      for (const lead of csvData) {
        try {
          const response = await fetch("/api/dashboard/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lead),
          });
          const result = await response.json();
          
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
            errors.push(`${lead.full_name}: ${result.error || "Bilinmeyen hata"}`);
          }
        } catch {
          failedCount++;
          errors.push(`${lead.full_name}: Bağlantı hatası`);
        }
      }
      
      setUploadResult({ success: successCount, failed: failedCount, errors });
      
      if (successCount > 0) {
        await loadLeads();
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      setUploadResult({ success: 0, failed: csvData.length, errors: ["Beklenmeyen bir hata oluştu"] });
    } finally {
      setIsUploading(false);
    }
  };

  const closeCsvDialog = () => {
    setShowCsvDialog(false);
    setCsvData([]);
    setCsvFileName("");
    setCsvError("");
    setUploadResult(null);
  };

  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData(lead);
    setShowEditDialog(true);
  };

  const openDeleteDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setShowDeleteDialog(true);
  };

  const filteredLeads = leads.filter(lead => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        lead.full_name.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Don't block on loading - show UI immediately

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Müşteri Adayları</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {leads.length} lead yönetiliyor
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            CSV Yükle
          </Button>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Lead
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="İsim, email veya telefon ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as LeadStatus | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.entries(statusConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as LeadPriority | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Öncelik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Öncelikler</SelectItem>
                {Object.entries(priorityConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{lead.full_name || "İsimsiz"}</h3>
                  <p className="text-sm text-gray-500">{lead.treatment_interest || lead.interest || "İlgi alanı belirtilmemiş"}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                      <Edit className="w-4 h-4 mr-2" /> Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => openDeleteDialog(lead)}
                      className="text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{lead.phone}</span>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                {lead.whatsapp && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MessageSquare className="w-4 h-4 text-green-500" />
                    <span>{lead.whatsapp}</span>
                  </div>
                )}
                {lead.instagram && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    <span>@{lead.instagram}</span>
                  </div>
                )}
              </div>

              {/* Status & Priority */}
              <div className="flex items-center gap-2 mb-4">
                <span className={cn("px-2 py-1 text-xs rounded-full font-medium", statusConfig[lead.status]?.color)}>
                  {statusConfig[lead.status]?.label || lead.status}
                </span>
                <span className={cn("px-2 py-1 text-xs rounded-full font-medium", priorityConfig[lead.priority]?.color)}>
                  {priorityConfig[lead.priority]?.label || lead.priority}
                </span>
                <span className="text-xs text-gray-500">
                  {lead.language === 'tr' ? '🇹🇷' : '🇬🇧'}
                </span>
              </div>

              {/* Call Button */}
              {lead.phone && (
                <div className="mb-3">
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={(e) => { e.stopPropagation(); handleCallLead(lead); }}
                    disabled={callingLeadId === lead.id}
                  >
                    {callingLeadId === lead.id ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Phone className="w-4 h-4 mr-2" />
                    )}
                    {callingLeadId === lead.id ? "Aranıyor..." : "Ara"}
                  </Button>
                </div>
              )}

              {/* Meta info */}
              <div className="text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-700 pt-3">
                <div className="flex justify-between">
                  <span>Kaynak: {lead.source || "-"}</span>
                  <span>{format(new Date(lead.created_at), "d MMM", { locale: tr })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredLeads.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Henüz lead bulunamadı</p>
            <Button className="mt-4" onClick={() => { resetForm(); setShowAddDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              İlk Lead&apos;i Ekle
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setShowEditDialog(false);
          setSelectedLead(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? "Lead Düzenle" : "Yeni Lead Ekle"}</DialogTitle>
            <DialogDescription>
              {showEditDialog ? "Lead bilgilerini güncelleyin." : "Yeni bir müşteri adayı ekleyin."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad Soyad *</Label>
                <Input
                  value={formData.full_name || ""}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+90 555 123 4567"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={formData.whatsapp || ""}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="+90 555 123 4567"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={formData.instagram || ""}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div className="space-y-2">
                <Label>Dil</Label>
                <Select
                  value={formData.language || "tr"}
                  onValueChange={(value) => setFormData({ ...formData, language: value as LeadLanguage })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <Input
                  value={formData.source || ""}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Website, Instagram, Referral..."
                />
              </div>
              <div className="space-y-2">
                <Label>İlgi Alanı</Label>
                <Input
                  value={formData.interest || ""}
                  onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                  placeholder="Diş tedavisi, Saç ekimi..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={formData.status || "new"}
                  onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Öncelik</Label>
                <Select
                  value={formData.priority || "medium"}
                  onValueChange={(value) => setFormData({ ...formData, priority: value as LeadPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notlar</Label>
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ek notlar..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              setShowEditDialog(false);
              setSelectedLead(null);
              resetForm();
            }}>
              İptal
            </Button>
            <Button 
              onClick={showEditDialog ? handleEditLead : handleAddLead} 
              disabled={isSaving || !formData.full_name}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              {showEditDialog ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead Sil</DialogTitle>
            <DialogDescription>
              &quot;{selectedLead?.full_name}&quot; adlı lead&apos;i silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteLead} disabled={isSaving}>
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Upload Dialog */}
      <Dialog open={showCsvDialog} onOpenChange={(open) => !open && closeCsvDialog()}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              CSV Dosyasından Lead Yükle
            </DialogTitle>
            <DialogDescription>
              {csvFileName && <span className="text-primary font-medium">{csvFileName}</span>} dosyasından {csvData.length} lead bulundu.
            </DialogDescription>
          </DialogHeader>

          {!uploadResult ? (
            <>
              {/* Preview Table */}
              <div className="max-h-[400px] overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Ad Soyad</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Telefon</th>
                      <th className="px-3 py-2 text-left font-medium">Dil</th>
                      <th className="px-3 py-2 text-left font-medium">Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 10).map((lead, index) => (
                      <tr key={index} className="border-t dark:border-gray-700">
                        <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                        <td className="px-3 py-2 font-medium">{lead.full_name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{lead.email || "-"}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{lead.phone || "-"}</td>
                        <td className="px-3 py-2">{lead.language === 'en' ? '🇬🇧' : '🇹🇷'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{lead.source || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 10 && (
                  <div className="px-3 py-2 text-center text-sm text-gray-500 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    ... ve {csvData.length - 10} lead daha
                  </div>
                )}
              </div>

              {/* Format Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">📝 Desteklenen Sütunlar:</p>
                <p className="text-blue-600 dark:text-blue-300">
                  Ad Soyad*, Email, Telefon, WhatsApp, Instagram, Dil (tr/en), Kaynak, İlgi Alanı, Notlar
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">* Zorunlu alan</p>
              </div>
            </>
          ) : (
            /* Upload Result */
            <div className="py-6">
              {uploadResult.success > 0 ? (
                <div className="text-center">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Yükleme Tamamlandı!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-bold text-green-600">{uploadResult.success}</span> lead başarıyla eklendi.
                    {uploadResult.failed > 0 && (
                      <span className="text-red-500"> ({uploadResult.failed} başarısız)</span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Yükleme Başarısız
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    Lead&apos;ler eklenirken bir hata oluştu.
                  </p>
                  {uploadResult.errors.length > 0 && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                      {uploadResult.errors.map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!uploadResult ? (
              <>
                <Button variant="outline" onClick={closeCsvDialog}>
                  İptal
                </Button>
                <Button onClick={handleCsvUpload} disabled={isUploading || csvData.length === 0}>
                  {isUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {csvData.length} Lead Yükle
                </Button>
              </>
            ) : (
              <Button onClick={closeCsvDialog}>
                Kapat
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add missing Users icon import
import { Users } from "lucide-react";
