"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { getLeads, createLead, updateLead, deleteLead } from "@/lib/supabase-outbound";
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
  ChevronDown
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
  const { isLoading: tenantLoading } = useTenant();
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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      const data = await getLeads({
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        search: searchQuery || undefined,
      });
      setLeads(data);
    } catch (error) {
      console.error("Error loading leads:", error);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    loadLeads().then(() => setIsLoading(false));
  }, [loadLeads]);

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
    await loadLeads();
    setIsRefreshing(false);
  };

  const handleAddLead = async () => {
    setIsSaving(true);
    try {
      await createLead(formData as Omit<Lead, "id" | "user_id" | "created_at" | "updated_at">);
      setShowAddDialog(false);
      resetForm();
      await loadLeads();
    } catch (error) {
      console.error("Error creating lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditLead = async () => {
    if (!selectedLead) return;
    setIsSaving(true);
    try {
      await updateLead(selectedLead.id, formData);
      setShowEditDialog(false);
      setSelectedLead(null);
      resetForm();
      await loadLeads();
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
      await deleteLead(selectedLead.id);
      setShowDeleteDialog(false);
      setSelectedLead(null);
      await loadLeads();
    } catch (error) {
      console.error("Error deleting lead:", error);
    } finally {
      setIsSaving(false);
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

  if (tenantLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
                  <h3 className="font-semibold text-gray-900 dark:text-white">{lead.full_name}</h3>
                  <p className="text-sm text-gray-500">{lead.interest || "Belirtilmemiş"}</p>
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
    </div>
  );
}

// Add missing Users icon import
import { Users } from "lucide-react";
