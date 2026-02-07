"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Lead, LeadStatus, LeadPriority } from "@/lib/types-outbound";
import * as XLSX from "xlsx";
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
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Tag,
  AlertTriangle,
  Clock,
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
  const { user, isLoading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Start as false, will be set to true when loading
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); // Debounced search query
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [sortBy, setSortBy] = useState<"created_at" | "priority" | "last_contact_date" | "status">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkCallDialog, setShowBulkCallDialog] = useState(false);
  const [showLeadDetailDialog, setShowLeadDetailDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkCalling, setIsBulkCalling] = useState(false);
  const [bulkCallProgress, setBulkCallProgress] = useState({ current: 0, total: 0, currentName: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<Partial<Lead>[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [callSuccess, setCallSuccess] = useState<{ show: boolean; leadName?: string; count?: number }>({ show: false });
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<LeadStatus>("contacted");
  const [duplicateWarnings, setDuplicateWarnings] = useState<{ phone: string; count: number; names: string[] }[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    status: "new" as LeadStatus,
    priority: "medium" as LeadPriority,
    notes: "",
    language: "tr" as "tr" | "en",
  });

  // Debounce search query - wait 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load leads function - use useCallback to prevent infinite loops
  const loadLeads = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        userId: user.id,
        page: currentPage.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      
      const response = await fetch(`/api/dashboard/leads?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Server handles priority sorting correctly (high -> medium -> low)
          setLeads(data.data || []);
          if (data.pagination) {
            setTotalPages(data.pagination.totalPages || 1);
            setTotalLeads(data.pagination.total || 0);
            // Only update currentPage if it's different (to avoid loops)
            if (data.pagination.page && data.pagination.page !== currentPage) {
              setCurrentPage(data.pagination.page);
            }
          }
        } else {
          console.error("Failed to load leads:", data.error);
          setLeads([]);
        }
      } else {
        console.error("Failed to load leads:", response.statusText);
        setLeads([]);
      }
    } catch (error) {
      console.error("Error loading leads:", error);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentPage, statusFilter, debouncedSearch, sortBy, sortOrder]);

  // Separate effect for initial load and auth changes
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      setIsLoading(true); // Show loading while auth is loading
      return;
    }
    
    // Auth is loaded, now check user
    if (user?.id) {
      // User exists, load leads
      loadLeads();
    } else {
      // User not found after auth loaded - could be not authenticated
      console.log("User not found after auth loaded");
      setIsLoading(false);
      setLeads([]); // Clear leads if no user
      setTotalLeads(0);
      setTotalPages(1);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]); // Only depend on user and auth loading

  // Separate effect for page, filter, search, and sort changes
  useEffect(() => {
    if (user?.id && !authLoading) {
      loadLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, debouncedSearch, sortBy, sortOrder]); // Reload when any of these change

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeads();
    setIsRefreshing(false);
  };

  // Filter leads (client-side filtering is now minimal since server handles it)
  const filteredLeads = leads;

  // When search, status filter, or sort changes, reset to page 1
  useEffect(() => {
    if (user?.id && !authLoading && currentPage !== 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, sortBy, sortOrder]);

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
    console.log("handleAddLead called", { fullName: formData.full_name, userId: user?.id, authLoading });
    
    if (!formData.full_name) {
      alert("Please enter a full name for the lead.");
      return;
    }
    
    if (authLoading) {
      alert("Please wait for authentication to complete. Try again in a moment.");
      return;
    }
    
    if (!user?.id) {
      console.error("User not loaded yet", { user, authLoading });
      alert("Please wait for authentication to complete. Try again in a moment.");
      return;
    }
    
    setIsSaving(true);

    try {
      // Format phone number: ensure it starts with +
      let phoneNumber = formData.phone.trim();
      if (phoneNumber && !phoneNumber.startsWith("+")) {
        phoneNumber = "+" + phoneNumber.replace(/^\+/, ""); // Remove any existing + and add new one
      }
      
      const response = await fetch(`/api/dashboard/leads?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, phone: phoneNumber, user_id: user.id }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        await loadLeads();
        setShowAddDialog(false);
        resetForm();
      } else {
        console.error("Error adding lead:", result.error || "Unknown error");
        alert(result.error || "Failed to add lead. Please try again.");
      }
    } catch (error) {
      console.error("Error adding lead:", error);
      alert("An error occurred while adding the lead. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle edit lead
  const handleEditLead = async () => {
    if (!selectedLead || !user?.id) return;
    setIsSaving(true);

    try {
      // Format phone number: ensure it starts with +
      let phoneNumber = formData.phone.trim();
      if (phoneNumber && !phoneNumber.startsWith("+")) {
        phoneNumber = "+" + phoneNumber.replace(/^\+/, ""); // Remove any existing + and add new one
      }
      
      const response = await fetch(`/api/dashboard/leads?id=${selectedLead.id}&userId=${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, phone: phoneNumber }),
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
    if (!selectedLead || !user?.id) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/dashboard/leads?id=${selectedLead.id}&userId=${user.id}`, {
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
    if (selectedLeadIds.size === 0 || !user?.id) return;
    setIsSaving(true);

    try {
      const ids = Array.from(selectedLeadIds);
      console.log(`Deleting ${ids.length} leads:`, ids);
      
      const response = await fetch(`/api/dashboard/leads?userId=${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      const data = await response.json();
      console.log("Delete response:", data);

      if (response.ok && data.success) {
        console.log(`Successfully deleted ${ids.length} leads`);
        await loadLeads();
        setShowBulkDeleteDialog(false);
        setSelectedLeadIds(new Set());
      } else {
        // Handle API error response
        const errorMessage = data.error || `Failed to delete leads (${response.status})`;
        console.error("Delete failed:", errorMessage, data);
        alert(errorMessage);
      }
    } catch (error) {
      console.error("Error deleting leads:", error);
      alert("An error occurred while deleting leads. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle bulk call leads - calls selected leads one by one with 3 second delay
  const handleBulkCallLeads = async () => {
    if (selectedLeadIds.size === 0 || !user?.id) return;
    
    setIsBulkCalling(true);
    setShowBulkCallDialog(false);
    
    const ids = Array.from(selectedLeadIds);
    const totalLeadsToCall = ids.length;
    let successCount = 0;
    
    setBulkCallProgress({ current: 0, total: totalLeadsToCall, currentName: "" });

    try {
      // Get lead details for all selected IDs
      const leadsToCall = leads.filter(lead => ids.includes(lead.id) && lead.phone);
      
      if (leadsToCall.length === 0) {
        alert("No leads with phone numbers found in selection.");
        setIsBulkCalling(false);
        return;
      }

      for (let i = 0; i < leadsToCall.length; i++) {
        const lead = leadsToCall[i];
        if (!lead) continue;
        
        setBulkCallProgress({ 
          current: i + 1, 
          total: leadsToCall.length, 
          currentName: lead.full_name || lead.phone || "Unknown" 
        });

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
            successCount++;
            console.log(`Successfully initiated call ${i + 1}/${leadsToCall.length} to ${lead.full_name}`);
          } else {
            console.error(`Call ${i + 1} failed:`, data.message || "Unknown error");
          }
        } catch (error) {
          console.error(`Error calling lead ${lead.full_name}:`, error);
        }

        // Wait 3 seconds between calls (except for the last one)
        if (i < leadsToCall.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Show success notification
      setCallSuccess({ 
        show: true, 
        leadName: `${successCount} leads`, 
        count: successCount 
      });
      setTimeout(() => {
        setCallSuccess({ show: false });
      }, 5000);

      // Refresh leads and clear selection
      await loadLeads();
      setSelectedLeadIds(new Set());
      
    } catch (error) {
      console.error("Error in bulk call:", error);
      alert("An error occurred during bulk calling. Some calls may have been made.");
    } finally {
      setIsBulkCalling(false);
      setBulkCallProgress({ current: 0, total: 0, currentName: "" });
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async () => {
    if (selectedLeadIds.size === 0 || !user?.id) return;
    setIsSaving(true);
    try {
      const ids = Array.from(selectedLeadIds);
      let successCount = 0;
      // Update in batches of 20
      for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20);
        const promises = batch.map((id) =>
          fetch(`/api/dashboard/leads?id=${id}&userId=${user!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: bulkStatusValue }),
          })
        );
        const results = await Promise.all(promises);
        successCount += results.filter((r) => r.ok).length;
      }
      await loadLeads();
      setShowBulkStatusDialog(false);
      setSelectedLeadIds(new Set());
      alert(`Successfully updated ${successCount} lead(s) to "${statusConfig[bulkStatusValue].label}"`);
    } catch (error) {
      console.error("Error bulk updating status:", error);
      alert("An error occurred while updating leads.");
    } finally {
      setIsSaving(false);
    }
  };

  // Export leads to CSV
  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const headers = ["Name", "Phone", "Email", "Status", "Priority", "Contact Attempts", "Last Contact", "Notes", "Created"];
    const rows = leads.map((lead) => [
      lead.full_name || "",
      lead.phone || "",
      lead.email || "",
      statusConfig[lead.status]?.label || lead.status,
      priorityConfig[lead.priority]?.label || lead.priority,
      (lead.contact_attempts || 0).toString(),
      lead.last_contact_date ? format(new Date(lead.last_contact_date), "yyyy-MM-dd HH:mm") : "",
      (lead.notes || "").replace(/\n/g, " "),
      format(new Date(lead.created_at), "yyyy-MM-dd"),
    ]);
    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check for duplicate phone numbers
  const checkDuplicates = useCallback(() => {
    const phoneMap = new Map<string, { count: number; names: string[] }>();
    for (const lead of leads) {
      if (!lead.phone) continue;
      const normalized = lead.phone.replace(/\s/g, "");
      const existing = phoneMap.get(normalized);
      if (existing) {
        existing.count++;
        existing.names.push(lead.full_name || "Unknown");
      } else {
        phoneMap.set(normalized, { count: 1, names: [lead.full_name || "Unknown"] });
      }
    }
    const dupes = Array.from(phoneMap.entries())
      .filter(([, v]) => v.count > 1)
      .map(([phone, v]) => ({ phone, count: v.count, names: v.names }));
    setDuplicateWarnings(dupes);
  }, [leads]);

  useEffect(() => {
    checkDuplicates();
  }, [checkDuplicates]);

  // Toggle select all - fetches ALL lead IDs from API, not just current page
  const toggleSelectAll = async () => {
    if (!user?.id) return;
    
    // If all are already selected (approximate check), deselect all
    if (selectedLeadIds.size > 0 && selectedLeadIds.size >= totalLeads && totalLeads > 0) {
      setSelectedLeadIds(new Set());
      return;
    }
    
    // Otherwise, fetch ALL lead IDs from API
    try {
      const queryParams = new URLSearchParams({
        userId: user.id,
        idsOnly: "true", // Request only IDs, not full data
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      
      const response = await fetch(`/api/dashboard/leads?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // When idsOnly=true, API returns array of string IDs directly
          const allIds = Array.isArray(data.data) ? data.data : [];
          setSelectedLeadIds(new Set(allIds));
        }
      }
    } catch (error) {
      console.error("Error fetching all lead IDs:", error);
      // Fallback: select only current page leads
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

  // Helper function to get priority from Excel row color
  const getPriorityFromColor = (worksheet: XLSX.WorkSheet, rowIndex: number): LeadPriority => {
    // Excel row numbers are 1-indexed, and we skip header (row 1), so rowIndex + 2
    const excelRowNum = rowIndex + 2;
    
    // Check first few cells of the row for background color
    // Usually columns A, B, C, D have the same background color for the entire row
    const cellsToCheck = ['A', 'B', 'C', 'D', 'E'];
    
    for (const col of cellsToCheck) {
      const cellAddress = `${col}${excelRowNum}`;
      const cell = worksheet[cellAddress];
      
      if (!cell || !cell.s) continue;
      
      // Check fill color - can be in different locations
      let rgbHex = '';
      
      // Try cell.s.fill.fgColor.rgb (most common)
      if (cell.s.fill && cell.s.fill.fgColor && cell.s.fill.fgColor.rgb) {
        rgbHex = cell.s.fill.fgColor.rgb.toString().toUpperCase();
      }
      // Try cell.s.fill.bgColor.rgb (sometimes used)
      else if (cell.s.fill && cell.s.fill.bgColor && cell.s.fill.bgColor.rgb) {
        rgbHex = cell.s.fill.bgColor.rgb.toString().toUpperCase();
      }
      // Try cell.s.fgColor.rgb (alternative location)
      else if (cell.s.fgColor && cell.s.fgColor.rgb) {
        rgbHex = cell.s.fgColor.rgb.toString().toUpperCase();
      }
      
      if (!rgbHex) continue;
      
      // Remove alpha channel if present (first 2 chars if 8 digits)
      if (rgbHex.length === 8) {
        rgbHex = rgbHex.substring(2);
      }
      
      // Convert hex to RGB
      if (rgbHex.length === 6) {
        const r = parseInt(rgbHex.substring(0, 2), 16);
        const g = parseInt(rgbHex.substring(2, 4), 16);
        const b = parseInt(rgbHex.substring(4, 6), 16);
        
        // Debug log for first few rows
        if (rowIndex < 10) {
          console.log(`Row ${excelRowNum}, Cell ${cellAddress}: RGB(${r}, ${g}, ${b}), Hex: #${rgbHex}`);
        }
        
        // Green (High priority): RGB(198, 239, 206) = #C6EFCE
        // Check if it's close to green - more lenient matching
        // Green has high G value, medium R and B
        const greenMatch = g > 220 && r < 220 && b < 220 && (g - r) > 20 && (g - b) > 20;
        if (greenMatch) {
          console.log(`Row ${excelRowNum}: Detected GREEN (High priority) - RGB(${r}, ${g}, ${b})`);
          return 'high';
        }
        
        // Red/Pink (Low priority): RGB(255, 199, 206) = #FFC7CE
        // Check if it's close to red/pink - high R value, medium G and B
        const redMatch = r > 240 && g < 220 && b < 220 && (r - g) > 30 && (r - b) > 30;
        if (redMatch) {
          console.log(`Row ${excelRowNum}: Detected RED/PINK (Low priority) - RGB(${r}, ${g}, ${b})`);
          return 'low';
        }
        
        // Also check exact hex matches
        if (rgbHex === 'C6EFCE' || rgbHex === 'FFC6EFCE') {
          console.log(`Row ${excelRowNum}: Exact GREEN match (High priority)`);
          return 'high';
        }
        if (rgbHex === 'FFC7CE' || rgbHex === 'FFFFC7CE') {
          console.log(`Row ${excelRowNum}: Exact RED/PINK match (Low priority)`);
          return 'low';
        }
      }
    }
    
    // Default to medium if color not recognized
    return 'medium';
  };

  // Parse Excel/CSV file
  const parseFileData = (data: any[][], headers: string[], worksheet?: XLSX.WorkSheet): Partial<Lead>[] => {
    const parsed: Partial<Lead>[] = [];
    
    // Map Turkish column names to fields
    const columnMap: Record<string, string> = {
      "data düşen tarih": "date_dropped",
      "data aranan tarih": "date_called",
      "ad soyad": "full_name",
      "adı soyadı": "full_name",
      "isim soyisim": "full_name",
      "telefon no": "phone",
      "telefon": "phone",
      "telefon numarası": "phone",
      "bilgi almak istediği konu": "treatment_interest",
      "konu": "treatment_interest",
      "1. arama": "call_1_date",
      "2. arama": "call_2_date",
      "3. arama": "call_3_date",
      "4. arama": "call_4_date",
      "görüşme sonrası durum": "post_call_status",
      "durum": "post_call_status",
      "email": "email",
      "e-posta": "email",
      "e mail": "email",
    };
    
    // Normalize headers
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Get priority from Excel row color if worksheet is provided
      let priority: LeadPriority = "medium";
      if (worksheet) {
        priority = getPriorityFromColor(worksheet, i);
      }
      
      const lead: Partial<Lead> & { form_data?: Record<string, unknown> } = {
        status: "new",
        priority: priority,
        language: "tr",
        form_data: {},
      };
      
      normalizedHeaders.forEach((header, index) => {
        const value = row[index]?.toString().trim() || "";
        if (!value || value === "x" || value.toLowerCase() === "x") return;
        
        const mappedField = columnMap[header];
        
        if (mappedField === "full_name") {
          lead.full_name = value;
        } else if (mappedField === "phone") {
          // Remove all spaces first
          let cleanedPhone = value.replace(/\s+/g, "");
          // Add + prefix if it doesn't start with it and is not empty
          if (cleanedPhone && !cleanedPhone.startsWith("+")) {
            cleanedPhone = "+" + cleanedPhone;
          }
          lead.phone = cleanedPhone;
        } else if (mappedField === "email") {
          lead.email = value;
        } else if (mappedField === "treatment_interest") {
          lead.treatment_interest = value;
          if (!lead.notes) lead.notes = value;
        } else if (mappedField === "post_call_status") {
          if (!lead.notes) {
            lead.notes = value;
          } else {
            lead.notes = `${lead.notes}\n${value}`;
          }
        } else if (mappedField && lead.form_data) {
          // Store other fields in form_data
          lead.form_data[mappedField] = value;
        }
      });
      
      // Combine notes if both treatment_interest and post_call_status exist
      if (lead.treatment_interest && lead.notes && lead.notes !== lead.treatment_interest) {
        lead.notes = `${lead.treatment_interest}\n\nGörüşme Sonrası Durum: ${lead.notes}`;
      } else if (lead.treatment_interest && !lead.notes) {
        lead.notes = lead.treatment_interest;
      }
      
      if (lead.full_name || lead.phone || lead.email) {
        parsed.push(lead);
      }
    }
    
    return parsed;
  };

  // Handle CSV/XLSX upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Handle Excel file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          if (!data) return;
          
          // Read with cellStyles enabled to get background colors
          const workbook = XLSX.read(data, { type: 'binary', cellStyles: true });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            alert("Excel dosyasında sheet bulunamadı.");
            return;
          }
          const worksheet = workbook.Sheets[firstSheetName];
          if (!worksheet) {
            alert("Excel sheet'i okunamadı.");
            return;
          }
          
          // Convert to JSON array
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          
          if (jsonData.length < 2 || !jsonData[0]) {
            alert("Excel dosyası boş veya yeterli veri yok.");
            return;
          }
          
          const headers = jsonData[0].map(h => h?.toString() || "");
          const rows = jsonData.slice(1);
          
          // Pass worksheet to parseFileData for color detection
          const parsed = parseFileData(rows, headers, worksheet);
          setCsvData(parsed);
          setShowCsvDialog(true);
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          alert("Excel dosyası okunamadı. Lütfen dosya formatını kontrol edin.");
        }
      };
      reader.readAsBinaryString(file);
    } else {
      // Handle CSV file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
          const lines = text.split("\n").filter(line => line.trim());
          if (lines.length < 2) {
            alert("CSV dosyası boş veya yeterli veri yok.");
            return;
          }
          
          const headerLine = lines[0];
          if (!headerLine) return;
          
          // Handle CSV with quoted fields and commas
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = "";
        } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };
          
          const headers = parseCSVLine(headerLine);
          
          const rows: any[][] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            rows.push(parseCSVLine(line));
          }
          
          // CSV files don't have color information, so pass undefined for worksheet
          const parsed = parseFileData(rows, headers, undefined);
          setCsvData(parsed);
          setShowCsvDialog(true);
        } catch (error) {
          console.error("Error parsing CSV file:", error);
          alert("CSV dosyası okunamadı. Lütfen dosya formatını kontrol edin.");
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Confirm CSV upload
  const handleCsvUpload = async () => {
    console.log("handleCsvUpload called", { csvDataLength: csvData.length, userId: user?.id, authLoading });
    
    if (csvData.length === 0) {
      alert("No leads to import. Please check your CSV file.");
      return;
    }
    
    if (authLoading) {
      alert("Please wait for authentication to complete. Try again in a moment.");
      return;
    }
    
    if (!user?.id) {
      console.error("User not loaded yet", { user, authLoading });
      alert("Please wait for authentication to complete. Try again in a moment.");
      return;
    }
    
    setIsUploading(true);

      try {
      const leadsWithUserId = csvData.map(lead => ({ ...lead, user_id: user.id }));
      const response = await fetch(`/api/dashboard/leads?userId=${user.id}`, {
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
        alert(`Successfully added ${result.count || leadsWithUserId.length} lead(s)!`);
      } else {
        console.error("Error uploading CSV:", result.error || "Unknown error");
        alert(result.error || "Failed to upload leads. Please try again.");
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      alert("An error occurred while uploading leads. Please try again.");
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

  // Show loading if auth is loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
    );
  }
  
  // Show loading if we're actively loading leads (but only if we have a user)
  if (isLoading && user?.id) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Manage your customer leads</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          {duplicateWarnings.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDuplicateWarning(true)}
              className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex-shrink-0"
            >
              <AlertTriangle className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">{duplicateWarnings.length} Duplicate{duplicateWarnings.length > 1 ? "s" : ""}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={leads.length === 0}
            className="border-gray-200 dark:border-gray-700 flex-shrink-0"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
            className="border-gray-200 dark:border-gray-700 flex-1 sm:flex-none"
            size="sm"
              >
                <Upload className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Import</span>
              </Button>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="flex-1 sm:flex-none" size="sm">
                <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Lead</span>
              </Button>
            </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* First Row: Search and Main Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-200 dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}>
              <SelectTrigger className="w-32 sm:w-40 border-gray-200 dark:border-gray-700 dark:bg-gray-800">
                <Filter className="w-4 h-4 mr-1 sm:mr-2 text-gray-400 dark:text-gray-500" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          
            {/* Sort Options */}
            <Select
              value={`${sortBy}|${sortOrder}`}
              onValueChange={(v) => {
                const [field, order] = v.split("|") as [string, string];
                setSortBy(field as typeof sortBy);
                setSortOrder(order as "asc" | "desc");
              }}
            >
              <SelectTrigger className="w-36 sm:w-44 border-gray-200 dark:border-gray-700 dark:bg-gray-800">
                <ArrowUpDown className="w-4 h-4 mr-1 text-gray-400" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at|desc">Newest First</SelectItem>
                <SelectItem value="created_at|asc">Oldest First</SelectItem>
                <SelectItem value="priority|desc">Priority: High→Low</SelectItem>
                <SelectItem value="priority|asc">Priority: Low→High</SelectItem>
                <SelectItem value="last_contact_date|desc">Last Activity</SelectItem>
                <SelectItem value="status|asc">Status Priority</SelectItem>
              </SelectContent>
            </Select>
          
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="border-gray-200 dark:border-gray-700"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Second Row: Quick Filters and Selection */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Quick:</span>
            <Button 
              variant={statusFilter === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === "new" ? "all" : "new")}
              className={cn(
                "border-gray-200 dark:border-gray-700 text-xs sm:text-sm",
                statusFilter === "new" && "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              New
            </Button>
            <Button 
              variant={statusFilter === "contacted" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === "contacted" ? "all" : "contacted")}
              className={cn(
                "border-gray-200 dark:border-gray-700 text-xs sm:text-sm",
                statusFilter === "contacted" && "bg-purple-600 hover:bg-purple-700 text-white"
              )}
            >
              Contacted
            </Button>
          </div>

          <div className="flex-1" />

          {/* Selection Controls */}
          <div className="flex items-center gap-2">
            {filteredLeads.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleSelectAll}
                className="border-gray-200 dark:border-gray-700 text-xs sm:text-sm"
                disabled={isLoading || !user?.id}
              >
                {selectedLeadIds.size > 0 && selectedLeadIds.size >= totalLeads && totalLeads > 0 ? (
                  <>
                    <X className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Deselect ({totalLeads})</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Select All ({totalLeads})</span>
                  </>
                )}
              </Button>
            )}
            {selectedLeadIds.size > 0 && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowBulkStatusDialog(true)}
                  disabled={isSaving}
                  className="border-gray-200 dark:border-gray-700 text-xs sm:text-sm"
                >
                  <Tag className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Status ({selectedLeadIds.size})</span>
                  <span className="sm:hidden">{selectedLeadIds.size}</span>
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => setShowBulkCallDialog(true)}
                  disabled={isSaving || isBulkCalling}
                  className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
                >
                  <Phone className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Call ({selectedLeadIds.size})</span>
                  <span className="sm:hidden">{selectedLeadIds.size}</span>
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={isSaving}
                  className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm"
                >
                  <Trash2 className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Delete ({selectedLeadIds.size})</span>
                  <span className="sm:hidden">{selectedLeadIds.size}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header - Hidden on mobile */}
        <div className="hidden sm:block px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Customer</div>
            <div className="w-32">Phone</div>
            <div className="w-24">Status</div>
            <div className="w-16 text-center">Calls</div>
            <div className="w-24">Priority</div>
            <div className="w-32">Last Contact</div>
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
                className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedLead(lead);
                  setShowLeadDetailDialog(true);
                }}
              >
                {/* Mobile Layout */}
                <div className="sm:hidden">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => toggleLeadSelection(lead.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{lead.full_name || "—"}</p>
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium",
                            statusConfig[lead.status].color
                          )}>
                            {statusConfig[lead.status].label}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium",
                            priorityConfig[lead.priority].color
                          )}>
                            {priorityConfig[lead.priority].label}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{lead.phone || "No phone"}</p>
                      {(lead.last_contact_date || (lead.contact_attempts && lead.contact_attempts > 0)) && (
                        <div className="flex items-center gap-2 mt-1">
                          {lead.contact_attempts > 0 && (
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                              {lead.contact_attempts}x called
                            </span>
                          )}
                          {lead.last_contact_date && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(lead.last_contact_date), "MMM d, HH:mm")}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {format(new Date(lead.created_at), "MMM d, yyyy")}
                        </span>
                        <div className="flex items-center gap-1">
                          {lead.phone && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); handleCallLead(lead); }}
                              className="h-7 w-7 p-0"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(lead); }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); setShowDeleteDialog(true); }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center gap-4">
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

                  <div className="w-16 text-center">
                    {lead.contact_attempts > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        {lead.contact_attempts}x
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </div>
                  
                  <div className="w-24">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium",
                      priorityConfig[lead.priority].color
                    )}>
                      {priorityConfig[lead.priority].label}
                    </span>
                  </div>
                  
                  <div className="w-32 text-xs text-gray-500 dark:text-gray-400">
                    {lead.last_contact_date ? (
                      <div>
                        <div>{format(new Date(lead.last_contact_date), "MMM d, yyyy")}</div>
                        <div className="text-gray-400 dark:text-gray-500">{format(new Date(lead.last_contact_date), "HH:mm")}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </div>
                  
                  <div className="w-24 flex items-center justify-end gap-2">
                    {lead.phone && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleCallLead(lead); }}
                        className="h-8 w-8 p-0"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(lead); }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                      </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); setShowDeleteDialog(true); }}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 order-2 sm:order-1">
            {((currentPage - 1) * 100) + 1}-{Math.min(currentPage * 100, totalLeads)} of {totalLeads}
              </div>

          <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                  <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || isLoading}
              className="border-gray-200 dark:border-gray-700 h-8 px-2 sm:px-3"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
                  </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (currentPage <= 2) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = currentPage - 1 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={isLoading}
                    className={cn(
                      "min-w-[32px] sm:min-w-[40px] h-8 px-2",
                      currentPage === pageNum
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}
                </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="border-gray-200 dark:border-gray-700 h-8 px-2 sm:px-3"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
      </div>
      )}

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
              <Label>Phone (E.164 format)</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+33768163591, +12125551234, +903129114094"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                International format: +[country code][number] (e.g., +33 for France, +1 for US/Canada)
              </p>
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
              disabled={isSaving || !formData.full_name || !user?.id || authLoading}
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

      {/* Bulk Call Confirmation Dialog */}
      <Dialog open={showBulkCallDialog} onOpenChange={setShowBulkCallDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-600" />
              Call Selected Leads
            </DialogTitle>
            <DialogDescription>
              You are about to call {selectedLeadIds.size} lead(s). Calls will be made one by one with a 3 second delay between each call.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Note:</strong> This will initiate actual phone calls to the selected leads. 
                Make sure your assistant is properly configured and you have enough credits.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkCallDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkCallLeads} 
              disabled={isSaving || isBulkCalling}
              className="bg-green-600 hover:bg-green-700"
            >
              {isBulkCalling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start Calling ({selectedLeadIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Call Progress Indicator */}
      {isBulkCalling && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-blue-200 dark:border-blue-800 p-4 min-w-[320px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">
                  Calling {bulkCallProgress.current}/{bulkCallProgress.total}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  Currently calling: {bulkCallProgress.currentName}
                </p>
              </div>
            </div>
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(bulkCallProgress.current / bulkCallProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

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
                    </tr>
                  </thead>
              <tbody className="divide-y divide-gray-100">
                {csvData.slice(0, 10).map((lead, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{lead.full_name || "—"}</td>
                    <td className="px-3 py-2">{lead.phone || "—"}</td>
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
            <Button onClick={handleCsvUpload} disabled={isUploading || !user?.id || csvData.length === 0 || authLoading}>
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import {csvData.length} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              Update Status
            </DialogTitle>
            <DialogDescription>
              Change status for {selectedLeadIds.size} selected lead(s).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>New Status</Label>
              <Select value={bulkStatusValue} onValueChange={(v) => setBulkStatusValue(v as LeadStatus)}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkStatusDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkStatusUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update {selectedLeadIds.size} Lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Phone Warning Dialog */}
      <Dialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Duplicate Phone Numbers
            </DialogTitle>
            <DialogDescription>
              The following phone numbers appear more than once in your leads.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-64 overflow-y-auto space-y-3">
            {duplicateWarnings.map((dup, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">{dup.phone} ({dup.count}x)</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  {dup.names.join(", ")}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateWarning(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={showLeadDetailDialog} onOpenChange={setShowLeadDetailDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              {selectedLead?.full_name || "Lead Information"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-6 py-4">
              {/* Primary Info - İsim ve Telefon (İlk Başta) */}
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {selectedLead.full_name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedLead.full_name || "—"}
                      </h3>
                      <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                        {selectedLead.phone || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500 dark:text-gray-400">Status</Label>
                  <div className="mt-1">
                    <span className={cn("px-2 py-1 rounded-md text-xs font-medium", statusConfig[selectedLead.status].color)}>
                      {statusConfig[selectedLead.status].label}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-500 dark:text-gray-400">Priority</Label>
                  <div className="mt-1">
                    <span className={cn("px-2 py-1 rounded-md text-xs font-medium", priorityConfig[selectedLead.priority].color)}>
                      {priorityConfig[selectedLead.priority].label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Imported Data from CSV/XLSX - Tüm Detaylar */}
              {selectedLead.form_data && Object.keys(selectedLead.form_data).length > 0 && (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">İmport Edilen Detaylar</h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {(() => {
                      const dateDropped = selectedLead.form_data.date_dropped;
                      return dateDropped && typeof dateDropped === 'string' && dateDropped.trim() !== '' ? (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Düşen Tarih</Label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{dateDropped}</p>
                        </div>
                      ) : null;
                    })()}
                    
                    {(() => {
                      const dateCalled = selectedLead.form_data.date_called;
                      return dateCalled && typeof dateCalled === 'string' && dateCalled.trim() !== '' ? (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Aranan Tarih</Label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">{dateCalled}</p>
                        </div>
                      ) : null;
                    })()}
                    
                    <div className="grid grid-cols-2 gap-4">
                      {(() => {
                        const call1 = selectedLead.form_data.call_1_date;
                        return call1 && typeof call1 === 'string' && call1.trim() !== '' && call1.toLowerCase() !== 'x' ? (
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">1. Arama</Label>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{call1}</p>
                          </div>
                        ) : null;
                      })()}
                      
                      {(() => {
                        const call2 = selectedLead.form_data.call_2_date;
                        return call2 && typeof call2 === 'string' && call2.trim() !== '' && call2.toLowerCase() !== 'x' ? (
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">2. Arama</Label>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{call2}</p>
                          </div>
                        ) : null;
                      })()}
                      
                      {(() => {
                        const call3 = selectedLead.form_data.call_3_date;
                        return call3 && typeof call3 === 'string' && call3.trim() !== '' && call3.toLowerCase() !== 'x' ? (
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">3. Arama</Label>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{call3}</p>
                          </div>
                        ) : null;
                      })()}
                      
                      {(() => {
                        const call4 = selectedLead.form_data.call_4_date;
                        return call4 && typeof call4 === 'string' && call4.trim() !== '' && call4.toLowerCase() !== 'x' ? (
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">4. Arama</Label>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{call4}</p>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    
                    {(() => {
                      const postCallStatus = selectedLead.form_data.post_call_status;
                      return postCallStatus && typeof postCallStatus === 'string' && postCallStatus.trim() !== '' ? (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Görüşme Sonrası Durum</Label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-line">{postCallStatus}</p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Treatment Interest / Bilgi Almak İstediği Konu */}
              {(selectedLead.treatment_interest || (selectedLead.form_data && typeof selectedLead.form_data.treatment_interest === 'string')) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bilgi Almak İstediği Konu</Label>
                  <p className="mt-2 text-gray-900 dark:text-white whitespace-pre-line">
                    {selectedLead.treatment_interest || (selectedLead.form_data?.treatment_interest as string) || "—"}
                  </p>
            </div>
          )}

              {/* Notes / Görüşme Sonrası Durum */}
              {selectedLead.notes && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {selectedLead.form_data?.post_call_status ? "Görüşme Sonrası Durum" : "Notes"}
                  </Label>
                  <p className="mt-2 text-gray-900 dark:text-white whitespace-pre-line">{selectedLead.notes}</p>
                </div>
              )}

              {/* Contact Dates */}
              <div className="grid grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                {selectedLead.first_contact_date && (
                  <div>
                    <Label className="text-sm text-gray-500 dark:text-gray-400">First Contact Date</Label>
                    <p className="mt-1 text-gray-900 dark:text-white">
                      {format(new Date(selectedLead.first_contact_date), "MMM d, yyyy")}
                    </p>
                  </div>
                )}
                {selectedLead.last_contact_date && (
                  <div>
                    <Label className="text-sm text-gray-500 dark:text-gray-400">Last Contact Date</Label>
                    <p className="mt-1 text-gray-900 dark:text-white">
                      {format(new Date(selectedLead.last_contact_date), "MMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => openEditDialog(selectedLead)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {selectedLead.phone && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowLeadDetailDialog(false);
                      handleCallLead(selectedLead);
                    }}
                    className="flex-1"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
