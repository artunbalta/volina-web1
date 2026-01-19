"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
// Campaigns now loaded via API route
import type { Campaign, OutreachChannel } from "@/lib/types-outbound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Target, 
  Plus, 
  RefreshCw, 
  Calendar,
  Phone,
  MessageSquare,
  Mail,
  Instagram,
  Edit,
  Trash2,
  Play,
  Pause,
  Clock,
  ArrowRight,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Users
} from "lucide-react";
import { format, addDays } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const channelConfig: Record<OutreachChannel, { label: string; icon: typeof Phone; color: string }> = {
  call: { label: "Arama", icon: Phone, color: "bg-blue-100 text-blue-600" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "bg-green-100 text-green-600" },
  email: { label: "Email", icon: Mail, color: "bg-purple-100 text-purple-600" },
  instagram_dm: { label: "Instagram", icon: Instagram, color: "bg-pink-100 text-pink-600" },
  sms: { label: "SMS", icon: Phone, color: "bg-orange-100 text-orange-600" },
};

interface CampaignStep {
  day: number;
  channel: OutreachChannel;
  description: string;
}

interface RunResult {
  success: boolean;
  message?: string;
  summary?: {
    total_leads: number;
    total_outreach_created: number;
    todays_scheduled: number;
    campaign_name: string;
  };
  error?: string;
}

export default function CampaignsPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  useTenant(); // Ensure tenant context is available
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_days: 90,
    is_active: true,
    steps: [
      { day: 0, channel: "whatsapp" as OutreachChannel, description: "Hoş geldiniz mesajı" },
      { day: 3, channel: "call" as OutreachChannel, description: "Tanışma araması" },
      { day: 7, channel: "email" as OutreachChannel, description: "Bilgi maili" },
      { day: 14, channel: "whatsapp" as OutreachChannel, description: "Takip mesajı" },
      { day: 30, channel: "call" as OutreachChannel, description: "İlgi kontrolü" },
    ] as CampaignStep[],
  });

  const loadCampaigns = useCallback(async () => {
    try {
      // Use server-side API route
      const response = await fetch("/api/dashboard/campaigns");
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCampaigns(result.data || []);
          return;
        }
      }
      setCampaigns([]);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    loadCampaigns().then(() => setIsLoading(false));
  }, [loadCampaigns]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCampaigns();
    setIsRefreshing(false);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          duration_days: formData.duration_days,
          is_active: formData.is_active,
          steps: formData.steps,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create campaign");
      }
      
      setShowCreateDialog(false);
      resetForm();
      await loadCampaigns();
    } catch (error) {
      console.error("Error creating campaign:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    try {
      const response = await fetch("/api/dashboard/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: campaign.id,
          is_active: !campaign.is_active,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update campaign");
      }
      
      await loadCampaigns();
    } catch (error) {
      console.error("Error updating campaign:", error);
    }
  };

  const openRunDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setRunResult(null);
    setShowRunDialog(true);
  };

  const handleRunCampaign = async () => {
    if (!selectedCampaign || !user) return;
    
    setIsRunning(true);
    setRunResult(null);

    try {
      const response = await fetch("/api/campaigns/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: selectedCampaign.id,
          user_id: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRunResult({
          success: true,
          message: data.message,
          summary: data.summary,
        });
        await loadCampaigns();
      } else {
        setRunResult({
          success: false,
          error: data.error || "Kampanya başlatılamadı",
        });
      }
    } catch (error) {
      console.error("Error running campaign:", error);
      setRunResult({
        success: false,
        error: "Bir hata oluştu. Lütfen tekrar deneyin.",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const closeRunDialog = () => {
    setShowRunDialog(false);
    setSelectedCampaign(null);
    setRunResult(null);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      duration_days: 90,
      is_active: true,
      steps: [
        { day: 0, channel: "whatsapp", description: "Hoş geldiniz mesajı" },
        { day: 3, channel: "call", description: "Tanışma araması" },
        { day: 7, channel: "email", description: "Bilgi maili" },
        { day: 14, channel: "whatsapp", description: "Takip mesajı" },
        { day: 30, channel: "call", description: "İlgi kontrolü" },
      ],
    });
  };

  const addStep = () => {
    const lastStep = formData.steps[formData.steps.length - 1];
    const lastDay = formData.steps.length > 0 && lastStep ? lastStep.day : 0;
    setFormData({
      ...formData,
      steps: [...formData.steps, { day: lastDay + 7, channel: "call" as const, description: "" }],
    });
  };

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index),
    });
  };

  const updateStep = (index: number, field: keyof CampaignStep, value: string | number) => {
    const newSteps = [...formData.steps];
    const currentStep = newSteps[index];
    if (currentStep) {
      newSteps[index] = { ...currentStep, [field]: value };
      setFormData({ ...formData, steps: newSteps });
    }
  };

  // Don't block on loading - show UI immediately

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kampanyalar</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Otomatik takip kampanyalarını yönetin
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Kampanya
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Campaigns Grid */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">Henüz kampanya yok</p>
              <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                İlk Kampanyayı Oluştur
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <CardDescription className="mt-1">{campaign.description || "Açıklama yok"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRunDialog(campaign)}
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Kampanyayı Başlat"
                    >
                      <Rocket className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(campaign)}
                      className={cn(
                        "h-8 w-8 p-0",
                        campaign.is_active ? "text-green-600" : "text-gray-400"
                      )}
                      title={campaign.is_active ? "Duraklat" : "Aktifleştir"}
                    >
                      {campaign.is_active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Campaign Timeline */}
                <div className="space-y-3 mb-4">
                  {campaign.schedule?.slice(0, 4).map((step, index) => {
                    const config = channelConfig[step.channel as OutreachChannel];
                    const Icon = config?.icon || Phone;
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded", config?.color || "bg-gray-100")}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="flex-1 text-sm">
                          <span className="text-gray-500">Gün {step.day}:</span>{" "}
                          <span className="text-gray-900 dark:text-white">{step.description || config?.label}</span>
                        </div>
                      </div>
                    );
                  })}
                  {campaign.schedule && campaign.schedule.length > 4 && (
                    <p className="text-xs text-gray-500 pl-9">+{campaign.schedule.length - 4} adım daha</p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between pt-3 border-t dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>{campaign.duration_days} gün</span>
                  </div>
                  <span className={cn(
                    "px-2 py-1 text-xs rounded-full font-medium",
                    campaign.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                  )}>
                    {campaign.is_active ? "Aktif" : "Pasif"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Kampanya</DialogTitle>
            <DialogDescription>
              Lead&apos;lere otomatik takip yapacak bir kampanya oluşturun.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kampanya Adı *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Yeni Lead Takibi"
                />
              </div>
              <div className="space-y-2">
                <Label>Süre (gün)</Label>
                <Input
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 90 })}
                  placeholder="90"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Kampanya açıklaması..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Kampanyayı aktif olarak başlat</Label>
            </div>

            {/* Campaign Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Kampanya Adımları</Label>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adım Ekle
                </Button>
              </div>

              <div className="space-y-3">
                {formData.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <Input
                        type="number"
                        value={step.day}
                        onChange={(e) => updateStep(index, "day", parseInt(e.target.value) || 0)}
                        className="w-16 h-8"
                      />
                      <span className="text-sm text-gray-500">gün</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <Select
                      value={step.channel}
                      onValueChange={(value) => updateStep(index, "channel", value)}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(channelConfig).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={step.description}
                      onChange={(e) => updateStep(index, "description", e.target.value)}
                      placeholder="Adım açıklaması"
                      className="flex-1 h-8"
                    />
                    {formData.steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(index)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Kampanya Özeti</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {formData.steps.length} adım, {formData.duration_days} gün sürecek.
                İlk iletişim Gün {formData.steps[0]?.day ?? 0}&apos;da {formData.steps[0]?.channel ? channelConfig[formData.steps[0].channel]?.label || "" : ""} ile yapılacak.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>İptal</Button>
            <Button onClick={handleCreate} disabled={isSaving || !formData.name || formData.steps.length === 0}>
              {isSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Campaign Dialog */}
      <Dialog open={showRunDialog} onOpenChange={(open) => !open && closeRunDialog()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-blue-600" />
              Kampanyayı Başlat
            </DialogTitle>
            <DialogDescription>
              {selectedCampaign?.name} kampanyasını başlatmak üzeresiniz.
            </DialogDescription>
          </DialogHeader>

          {!runResult ? (
            <div className="py-4 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-2 font-medium">
                  Bu işlem şunları yapacak:
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Tüm uygun lead&apos;lere kampanya atanacak
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Kampanya adımlarına göre aramalar planlanacak
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Bugünkü aramalar &quot;Aramalar&quot; sayfasında görünecek
                  </li>
                </ul>
              </div>

              {selectedCampaign?.schedule && (
                <div className="border dark:border-gray-700 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">Kampanya Adımları:</p>
                  <div className="space-y-1">
                    {selectedCampaign.schedule.slice(0, 5).map((step: { day: number; channel: string; description?: string }, index: number) => {
                      const config = channelConfig[step.channel as OutreachChannel];
                      return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 w-12">Gün {step.day}</span>
                          <span className={cn("px-2 py-0.5 rounded text-xs", config?.color)}>
                            {config?.label || step.channel}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 truncate">
                            {step.description}
                          </span>
                        </div>
                      );
                    })}
                    {selectedCampaign.schedule.length > 5 && (
                      <p className="text-xs text-gray-500 mt-1">
                        +{selectedCampaign.schedule.length - 5} adım daha
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6">
              {runResult.success ? (
                <div className="text-center">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Kampanya Başlatıldı!
                  </h3>
                  {runResult.summary && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4 text-left">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Lead Sayısı:</span>
                          <span className="ml-2 font-semibold">{runResult.summary.total_leads}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Planlanan İletişim:</span>
                          <span className="ml-2 font-semibold">{runResult.summary.total_outreach_created}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Bugün Planlanmış:</span>
                          <span className="ml-2 font-semibold text-blue-600">{runResult.summary.todays_scheduled} arama/mesaj</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-4">
                    Planlanan aramalar &quot;Aramalar&quot; sayfasında görüntülenebilir.
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Başlatılamadı
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {runResult.error}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!runResult ? (
              <>
                <Button variant="outline" onClick={closeRunDialog}>
                  İptal
                </Button>
                <Button onClick={handleRunCampaign} disabled={isRunning}>
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Başlatılıyor...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Kampanyayı Başlat
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={closeRunDialog}>
                Kapat
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
