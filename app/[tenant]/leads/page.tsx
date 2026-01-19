"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Lead, LeadStatus, LeadPriority } from "@/lib/types-outbound";
import { Button } from "@/components/ui/button";
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
  Filter,
  Upload,
  Users,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  contacted: { label: "Contacted", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
  interested: { label: "Interested", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  appointment_set: { label: "Appointment", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  converted: { label: "Converted", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
  unreachable: { label: "Unreachable", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  lost: { label: "Lost", color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
};

const priorityConfig: Record<LeadPriority, { label: string; color: string }> = {
  high: { label: "High", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  medium: { label: "Medium", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  low: { label: "Low", color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
};

export default function LeadsPage() {
  const router = useRouter();
  const params = useParams();
  const tenant = params?.tenant as string;
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<Partial<Lead>[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [callSuccess, setCallSuccess] = useState<{ show: boolean; leadName?: string }>({ show: false });

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    status: "new" as LeadStatus,
    priority: "medium" as LeadPriority,
    notes: "",
    language: "tr" as "tr" | "en",
  });

  const loadLeads = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/dashboard/leads?limit=500&user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLeads(data.data || []);
        }
      }
    } catch (error) {
      console.error("Error loading leads:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeads();
    setIsRefreshing(false);
  };

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery || 
      lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      status: "new",
      priority: "medium",
      notes: "",
      language: "tr",
    });
  };

  // Handle add lead
  const handleAddLead = async () => {
    if (!formData.full_name || !user?.id) {
      console.error("Missing required fields: full_name or user.id");
      return;
    }
    setIsSaving(true);

    try {
      const response = await fetch("/api/dashboard/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          user_id: user.id,
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        await loadLeads();
        setShowAddDialog(false);
        resetForm();
      } else {
        console.error("Error adding lead:", result.error || "Unknown error");
        alert(result.error || "Failed to add lead");
      }
    } catch (error) {
      console.error("Error adding lead:", error);
      alert("Failed to add lead. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle edit lead
  const handleEditLead = async () => {
    if (!selectedLead) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/dashboard/leads?id=${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadLeads();
        setShowEditDialog(false);
        setSelectedLead(null);
        resetForm();
      }
    } catch (error) {
      console.error("Error updating lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete lead
  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/dashboard/leads?id=${selectedLead.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadLeads();
        setShowDeleteDialog(false);
        setSelectedLead(null);
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle bulk delete leads
  const handleBulkDeleteLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    setIsSaving(true);

    try {
      const ids = Array.from(selectedLeadIds);
      const response = await fetch("/api/dashboard/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (response.ok) {
        await loadLeads();
        setShowBulkDeleteDialog(false);
        setSelectedLeadIds(new Set());
      }
    } catch (error) {
      console.error("Error deleting leads:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(lead => lead.id)));
    }
  };

  // Toggle single lead selection
  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeadIds);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  // Open edit dialog
  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      full_name: lead.full_name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      status: lead.status,
      priority: lead.priority,
      notes: lead.notes || "",
      language: lead.language || "tr",
    });
    setShowEditDialog(true);
  };

  // Handle CSV upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) return;
      
      const headerLine = lines[0];
      if (!headerLine) return;
      const headers = headerLine.split(",").map(h => h.trim().toLowerCase());
      
      const parsed: Partial<Lead>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const values = line.split(",").map(v => v.trim());
        const lead: Partial<Lead> = {
          status: "new",
          priority: "medium",
          language: "tr",
        };
        
        headers.forEach((header, index) => {
          const value = values[index];
          if (header.includes("name") || header.includes("isim") || header.includes("ad")) {
            lead.full_name = value;
          } else if (header.includes("phone") || header.includes("telefon") || header.includes("tel")) {
            lead.phone = value;
          } else if (header.includes("email") || header.includes("e-posta") || header.includes("mail")) {
            lead.email = value;
          } else if (header.includes("note") || header.includes("not")) {
            lead.notes = value;
          }
        });
        
        if (lead.full_name || lead.phone || lead.email) {
          parsed.push(lead);
        }
      }
      
      setCsvData(parsed);
      setShowCsvDialog(true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Confirm CSV upload
  const handleCsvUpload = async () => {
    if (csvData.length === 0 || !user?.id) {
      console.error("No CSV data or user.id missing");
      return;
    }
    setIsUploading(true);

    try {
      // Add user_id to each lead in CSV data
      const leadsWithUserId = csvData.map(lead => ({
        ...lead,
        user_id: user.id,
      }));
      
      const response = await fetch("/api/dashboard/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: leadsWithUserId }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        await loadLeads();
        setShowCsvDialog(false);
        setCsvData([]);
        setCsvFileName("");
        alert(`Successfully imported ${result.count || leadsWithUserId.length} leads`);
      } else {
        console.error("Error uploading CSV:", result.error || "Unknown error");
        alert(result.error || "Failed to import leads");
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      alert("Failed to import leads. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Call lead
  const handleCallLead = async (lead: Lead) => {
    if (!lead.phone) return;
    
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
      
      if (response.ok && data.success) {
        await loadLeads();
        // Show success notification
        setCallSuccess({ show: true, leadName: lead.full_name || lead.phone });
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setCallSuccess({ show: false });
        }, 5000);
      } else {
        console.error("Call failed:", data.message || "Unknown error");
      }
    } catch (error) {
      console.error("Error calling lead:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Success Notification */}
      {callSuccess.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-green-200 dark:border-green-800 p-4 flex items-center gap-3 min-w-[320px]">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">Call Initiated</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Successfully started call to {callSuccess.leadName}
              </p>
            </div>
            <button
              onClick={() => setCallSuccess({ show: false })}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your customer leads</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            className="border-gray-200 dark:border-gray-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-gray-200 dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}>
          <SelectTrigger className="w-40 border-gray-200 dark:border-gray-700 dark:bg-gray-800">
            <Filter className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedLeadIds.size > 0 && (
          <Button 
            variant="destructive" 
            onClick={() => setShowBulkDeleteDialog(true)}
            disabled={isSaving}
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedLeadIds.size})
          </Button>
        )}
        
        <Button 
          variant="outline" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="border-gray-200 dark:border-gray-700"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Customer</div>
            <div className="w-32">Phone</div>
            <div className="w-24">Status</div>
            <div className="w-24">Priority</div>
            <div className="w-24 text-right">Created</div>
            <div className="w-24"></div>
          </div>
        </div>
        
        {/* Table Body */}
        {filteredLeads.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No leads found</p>
            <Button 
              onClick={() => { resetForm(); setShowAddDialog(true); }}
              className="mt-4"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredLeads.map((lead, index) => (
              <div 
                key={lead.id}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => toggleLeadSelection(lead.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {lead.full_name?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{lead.full_name || "—"}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{lead.email || "—"}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-32 text-sm text-gray-600 dark:text-gray-300">
                    {lead.phone || "—"}
                  </div>
                  
                  <div className="w-24">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium",
                      statusConfig[lead.status].color
                    )}>
                      {statusConfig[lead.status].label}
                    </span>
                  </div>
                  
                  <div className="w-24">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium",
                      priorityConfig[lead.priority].color
                    )}>
                      {priorityConfig[lead.priority].label}
                    </span>
                  </div>
                  
                  <div className="w-24 text-sm text-gray-500 dark:text-gray-400 text-right">
                    {format(new Date(lead.created_at), "MMM d")}
                  </div>
                  
                  <div className="w-24 flex items-center justify-end gap-2">
                    {lead.phone && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCallLead(lead)}
                        className="h-8 w-8 p-0"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => { setSelectedLead(lead); setShowDeleteDialog(true); }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? "Edit Lead" : "Add New Lead"}</DialogTitle>
            <DialogDescription>
              {showEditDialog ? "Update lead information" : "Enter lead details"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+90 5XX XXX XX XX"
              />
            </div>
            
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as LeadPriority })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
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
              Cancel
            </Button>
            <Button 
              onClick={showEditDialog ? handleEditLead : handleAddLead}
              disabled={isSaving || !formData.full_name}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {showEditDialog ? "Save Changes" : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedLead?.full_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLead} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Selected Leads</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedLeadIds.size} lead(s)? This action cannot be undone and will permanently remove them from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteLeads} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete {selectedLeadIds.size} Lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Preview Dialog */}
      <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Leads</DialogTitle>
            <DialogDescription>
              {csvFileName} - {csvData.length} leads found
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Phone</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {csvData.slice(0, 10).map((lead, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{lead.full_name || "—"}</td>
                    <td className="px-3 py-2">{lead.phone || "—"}</td>
                    <td className="px-3 py-2">{lead.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.length > 10 && (
              <p className="text-center text-sm text-gray-500 py-2">
                ...and {csvData.length - 10} more
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCsvDialog(false); setCsvData([]); }}>
              Cancel
            </Button>
            <Button onClick={handleCsvUpload} disabled={isUploading}>
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import {csvData.length} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
