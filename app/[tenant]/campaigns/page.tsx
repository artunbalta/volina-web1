"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Target, 
  Plus, 
  RefreshCw, 
  Phone,
  Clock,
  Play,
  Pause,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TimeSlot {
  id: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  callsPerSlot: number;
}

interface AutoCallCampaign {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  time_slots: TimeSlot[];
  timezone: string;
  created_at: string;
  updated_at: string;
  // Stats
  total_leads_called?: number;
  leads_remaining?: number;
  last_call_at?: string;
}

// Helper to format time
const formatTime = (hour: number, minute: number) => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

// Calculate slot duration in minutes
const getSlotDuration = (slot: TimeSlot) => {
  const startMinutes = slot.startHour * 60 + slot.startMinute;
  const endMinutes = slot.endHour * 60 + slot.endMinute;
  return endMinutes - startMinutes;
};

// Calculate call interval in seconds
const getCallInterval = (slot: TimeSlot) => {
  const durationMinutes = getSlotDuration(slot);
  if (slot.callsPerSlot <= 0) return 0;
  const intervalMinutes = durationMinutes / slot.callsPerSlot;
  return Math.round(intervalMinutes * 60);
};

export default function CampaignsPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  useTenant();
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<AutoCallCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newLeadCount, setNewLeadCount] = useState(0);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<AutoCallCampaign | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Active campaign runner state
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignProgress, setCampaignProgress] = useState({ current: 0, total: 0, currentName: "" });
  const campaignRunnerRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    timezone: "Europe/Istanbul",
    time_slots: [
      { id: "1", startHour: 12, startMinute: 0, endHour: 13, endMinute: 0, callsPerSlot: 100 },
      { id: "2", startHour: 19, startMinute: 0, endHour: 22, endMinute: 0, callsPerSlot: 100 },
    ] as TimeSlot[],
  });

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/auto-call?userId=${user.id}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCampaigns(result.data || []);
        }
      }
    } catch (error) {
      console.error("Error loading campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load new lead count
  const loadNewLeadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/dashboard/leads?userId=${user.id}&status=new&countOnly=true`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setNewLeadCount(result.count || 0);
        }
      }
    } catch (error) {
      console.error("Error loading lead count:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadCampaigns();
      loadNewLeadCount();
    } else {
      setIsLoading(false);
    }
  }, [user?.id, loadCampaigns, loadNewLeadCount]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadCampaigns(), loadNewLeadCount()]);
    setIsRefreshing(false);
  };

  // Create campaign
  const handleCreate = async () => {
    if (!user?.id || !formData.name) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/campaigns/auto-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          ...formData,
        }),
      });

      if (response.ok) {
        setShowCreateDialog(false);
        resetForm();
        await loadCampaigns();
      } else {
        const error = await response.json();
        alert(error.message || "Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle campaign active state
  const handleToggleActive = async (campaign: AutoCallCampaign) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/campaigns/auto-call`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: campaign.id,
          user_id: user.id,
          is_active: !campaign.is_active,
        }),
      });

      if (response.ok) {
        await loadCampaigns();
      }
    } catch (error) {
      console.error("Error updating campaign:", error);
    }
  };

  // Delete campaign
  const handleDelete = async () => {
    if (!selectedCampaign || !user?.id) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/campaigns/auto-call?id=${selectedCampaign.id}&userId=${user.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setShowDeleteDialog(false);
        setSelectedCampaign(null);
        await loadCampaigns();
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Start campaign execution
  const startCampaign = async (campaign: AutoCallCampaign) => {
    if (!user?.id || activeCampaignId) return;
    
    setActiveCampaignId(campaign.id);
    
    try {
      // Get "new" leads to call
      const response = await fetch(`/api/dashboard/leads?userId=${user.id}&status=new&idsOnly=true`);
      if (!response.ok) {
        throw new Error("Failed to get leads");
      }
      
      const result = await response.json();
      const leadIds = result.data || [];
      
      if (leadIds.length === 0) {
        alert("No new leads to call!");
        setActiveCampaignId(null);
        return;
      }

      // Calculate call interval based on current time slot
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Find active time slot
      let activeSlot = campaign.time_slots.find(slot => {
        const currentTime = currentHour * 60 + currentMinute;
        const slotStart = slot.startHour * 60 + slot.startMinute;
        const slotEnd = slot.endHour * 60 + slot.endMinute;
        return currentTime >= slotStart && currentTime < slotEnd;
      });

      // If not in a time slot, use the first slot's interval
      if (!activeSlot && campaign.time_slots.length > 0) {
        activeSlot = campaign.time_slots[0];
      }

      const intervalSeconds = activeSlot ? getCallInterval(activeSlot) : 60;
      const totalCalls = Math.min(leadIds.length, activeSlot?.callsPerSlot || leadIds.length);
      
      setCampaignProgress({ current: 0, total: totalCalls, currentName: "" });

      // Start calling leads
      for (let i = 0; i < totalCalls; i++) {
        const leadId = leadIds[i];
        
        // Get lead name for display
        const leadResponse = await fetch(`/api/dashboard/leads?userId=${user.id}&id=${leadId}`);
        let leadName = "Unknown";
        if (leadResponse.ok) {
          const leadData = await leadResponse.json();
          if (leadData.success && leadData.data) {
            leadName = leadData.data.full_name || leadData.data.phone || "Unknown";
          }
        }
        
        setCampaignProgress({ current: i + 1, total: totalCalls, currentName: leadName });

        // Make the call
        try {
          const callResponse = await fetch("/api/outreach/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: leadId,
              channel: "call",
              direct_call: true,
            }),
          });

          const callData = await callResponse.json();
          
          if (callResponse.ok && callData.success) {
            console.log(`Call ${i + 1}/${totalCalls} initiated to ${leadName}`);
          } else {
            console.error(`Call ${i + 1} failed:`, callData.message);
          }
        } catch (error) {
          console.error(`Error calling lead ${leadName}:`, error);
        }

        // Wait for interval (except for last call)
        if (i < totalCalls - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
        }
      }

      // Campaign completed
      alert(`Campaign completed! Called ${totalCalls} leads.`);
      await loadNewLeadCount();
      
    } catch (error) {
      console.error("Campaign execution error:", error);
      alert("Campaign execution failed. Please try again.");
    } finally {
      setActiveCampaignId(null);
      setCampaignProgress({ current: 0, total: 0, currentName: "" });
    }
  };

  // Stop campaign
  const stopCampaign = () => {
    if (campaignRunnerRef.current) {
      clearTimeout(campaignRunnerRef.current);
      campaignRunnerRef.current = null;
    }
    setActiveCampaignId(null);
    setCampaignProgress({ current: 0, total: 0, currentName: "" });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_active: true,
      timezone: "Europe/Istanbul",
      time_slots: [
        { id: "1", startHour: 12, startMinute: 0, endHour: 13, endMinute: 0, callsPerSlot: 100 },
        { id: "2", startHour: 19, startMinute: 0, endHour: 22, endMinute: 0, callsPerSlot: 100 },
      ],
    });
  };

  // Add time slot
  const addTimeSlot = () => {
    setFormData({
      ...formData,
      time_slots: [
        ...formData.time_slots,
        { 
          id: Date.now().toString(), 
          startHour: 10, 
          startMinute: 0, 
          endHour: 11, 
          endMinute: 0, 
          callsPerSlot: 50 
        },
      ],
    });
  };

  // Remove time slot
  const removeTimeSlot = (id: string) => {
    setFormData({
      ...formData,
      time_slots: formData.time_slots.filter(slot => slot.id !== id),
    });
  };

  // Update time slot
  const updateTimeSlot = (id: string, field: keyof TimeSlot, value: number) => {
    setFormData({
      ...formData,
      time_slots: formData.time_slots.map(slot => 
        slot.id === id ? { ...slot, [field]: value } : slot
      ),
    });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auto Call Campaigns</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Automate calls to new leads based on time slots
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">New Leads</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{newLeadCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Campaigns</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {campaigns.filter(c => c.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Timezone</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">Turkey (UTC+3)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">No campaigns yet</p>
              <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {campaign.description || "No description"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {activeCampaignId === campaign.id ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={stopCampaign}
                        className="h-8"
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => startCampaign(campaign)}
                        disabled={activeCampaignId !== null || newLeadCount === 0}
                        className="h-8 bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(campaign)}
                      className={cn(
                        "h-8 w-8 p-0",
                        campaign.is_active ? "text-green-600" : "text-gray-400"
                      )}
                      title={campaign.is_active ? "Deactivate" : "Activate"}
                    >
                      {campaign.is_active ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedCampaign(campaign); setShowDeleteDialog(true); }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Time Slots */}
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Slots:</p>
                  {campaign.time_slots.map((slot, index) => {
                    const duration = getSlotDuration(slot);
                    const interval = getCallInterval(slot);
                    return (
                      <div key={index} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-mono">
                          {formatTime(slot.startHour, slot.startMinute)} - {formatTime(slot.endHour, slot.endMinute)}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {slot.callsPerSlot} calls
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className="text-green-600 dark:text-green-400">
                          ~{interval}s interval
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Status */}
                <div className="flex items-center justify-between pt-3 border-t dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>Created {format(new Date(campaign.created_at), "MMM d, yyyy")}</span>
                  </div>
                  <span className={cn(
                    "px-2 py-1 text-xs rounded-full font-medium",
                    campaign.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                  )}>
                    {campaign.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign Progress Indicator */}
      {activeCampaignId && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-blue-200 dark:border-blue-800 p-4 min-w-[320px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">
                  Campaign Running: {campaignProgress.current}/{campaignProgress.total}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  Calling: {campaignProgress.currentName}
                </p>
              </div>
            </div>
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${campaignProgress.total > 0 ? (campaignProgress.current / campaignProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Auto Call Campaign</DialogTitle>
            <DialogDescription>
              Set up automated calling for new leads based on time slots.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Daily Lead Outreach"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Start campaign as active</Label>
              </div>
            </div>

            {/* Time Slots */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Time Slots (Turkey Time)</Label>
                <Button variant="outline" size="sm" onClick={addTimeSlot}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Slot
                </Button>
              </div>

              <div className="space-y-3">
                {formData.time_slots.map((slot, index) => {
                  const duration = getSlotDuration(slot);
                  const interval = slot.callsPerSlot > 0 ? Math.round((duration / slot.callsPerSlot) * 60) : 0;
                  
                  return (
                    <div key={slot.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Slot {index + 1}
                        </span>
                        {formData.time_slots.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTimeSlot(slot.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Start Time</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              value={slot.startHour}
                              onChange={(e) => updateTimeSlot(slot.id, 'startHour', parseInt(e.target.value) || 0)}
                              className="w-16 h-8"
                            />
                            <span className="self-center">:</span>
                            <Input
                              type="number"
                              min={0}
                              max={59}
                              value={slot.startMinute}
                              onChange={(e) => updateTimeSlot(slot.id, 'startMinute', parseInt(e.target.value) || 0)}
                              className="w-16 h-8"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End Time</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              value={slot.endHour}
                              onChange={(e) => updateTimeSlot(slot.id, 'endHour', parseInt(e.target.value) || 0)}
                              className="w-16 h-8"
                            />
                            <span className="self-center">:</span>
                            <Input
                              type="number"
                              min={0}
                              max={59}
                              value={slot.endMinute}
                              onChange={(e) => updateTimeSlot(slot.id, 'endMinute', parseInt(e.target.value) || 0)}
                              className="w-16 h-8"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Calls per day in this slot</Label>
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          value={slot.callsPerSlot}
                          onChange={(e) => updateTimeSlot(slot.id, 'callsPerSlot', parseInt(e.target.value) || 1)}
                          className="w-full h-8"
                        />
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        Duration: {duration} min | Interval: ~{interval} seconds between calls
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Campaign Summary</p>
              <p className="text-sm text-green-700 dark:text-green-400">
                {formData.time_slots.length} time slot(s) configured.
                Total daily calls: {formData.time_slots.reduce((sum, slot) => sum + slot.callsPerSlot, 0)}.
                {newLeadCount > 0 && ` You have ${newLeadCount} new leads waiting to be called.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !formData.name || formData.time_slots.length === 0}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedCampaign?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
