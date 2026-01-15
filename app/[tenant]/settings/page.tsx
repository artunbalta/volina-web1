"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Settings, 
  User, 
  Building, 
  Link,
  RefreshCw, 
  Save,
  Key,
  Bell,
  Shield,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
  Cog
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const { tenantProfile } = useTenant();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string; stats?: Record<string, number> } | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
    slug: "",
    vapi_org_id: "",
  });

  const loadProfile = useCallback(async () => {
    try {
      if (user?.id) {
        const response = await fetch(`/api/dashboard/profile?userId=${user.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setProfile(result.data);
            setFormData({
              full_name: result.data.full_name || "",
              company_name: result.data.company_name || "",
              slug: result.data.slug || "",
              vapi_org_id: result.data.vapi_org_id || "",
            });
          }
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile().then(() => setIsLoading(false));
  }, [loadProfile]);

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          full_name: formData.full_name,
          company_name: formData.company_name,
          slug: formData.slug,
          vapi_org_id: formData.vapi_org_id,
        }),
      });
      
      if (response.ok) {
        setHasChanges(false);
        await loadProfile();
      }
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateForm = (updates: Partial<typeof formData>) => {
    setFormData({ ...formData, ...updates });
    setHasChanges(true);
  };

  const handleSeedMockData = async () => {
    if (!user?.id) {
      setSeedResult({ success: false, message: "Kullanıcı bilgisi bulunamadı." });
      return;
    }
    
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const response = await fetch("/api/seed-mock-data", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const result = await response.json();
      
      if (result.success) {
        setSeedResult({ success: true, message: "Demo veriler başarıyla oluşturuldu!", stats: result.stats });
      } else {
        setSeedResult({ success: false, message: result.error || "Veriler oluşturulurken hata oluştu" });
      }
    } catch (error) {
      setSeedResult({ success: false, message: "Sunucu hatası oluştu." });
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">Ayarlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtNHY2aDR2LTJ6TTI2IDI0aC0ydjJoMnYtMnptMCAyaC0ydjJoMnYtMnptMTAgMTBoLTJ2Mmgydi0yem0wIDBoMnYtMmgtMnYyem0tMTAgMGgtMnYyaDJ2LTJ6bTAgMGgydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Cog className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold">Ayarlar</h1>
              </div>
              <p className="text-slate-300 text-lg">
                Hesap ve entegrasyon ayarlarınızı yönetin
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !hasChanges}
              className="bg-white text-slate-800 hover:bg-slate-100 shadow-lg"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Kaydet
            </Button>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-slate-400/10 rounded-full blur-2xl" />
      </div>

      {/* Profile Settings */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Profil Bilgileri</h2>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ad Soyad</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => updateForm({ full_name: e.target.value })}
                placeholder="John Doe"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="h-11 rounded-xl bg-gray-50 dark:bg-gray-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Settings */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-100 dark:border-purple-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
              <Building className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Şirket Bilgileri</h2>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Şirket Adı</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => updateForm({ company_name: e.target.value })}
                placeholder="Smile and Holiday"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 whitespace-nowrap">volina.online/</span>
                <Input
                  value={formData.slug}
                  onChange={(e) => updateForm({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  placeholder="smileandholiday"
                  className="h-11 rounded-xl flex-1"
                />
              </div>
              <p className="text-xs text-gray-500">Dashboard URL&apos;niz: volina.online/{formData.slug || tenant}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Settings */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-100 dark:border-emerald-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
              <Link className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Entegrasyonlar</h2>
              <p className="text-sm text-gray-500">Harici servislerle bağlantı ayarları</p>
            </div>
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">VAPI Organization ID</Label>
            <Input
              value={formData.vapi_org_id}
              onChange={(e) => updateForm({ vapi_org_id: e.target.value })}
              placeholder="ecaff27b-9d28-470c-a72b-f3d3b8b94791"
              className="h-11 rounded-xl font-mono text-sm"
            />
            <p className="text-xs text-gray-500">VAPI webhook&apos;larınızı bu hesaba yönlendirmek için kullanılır</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "WhatsApp", connected: false, icon: "💬", color: "from-green-400 to-emerald-500" },
              { name: "Instagram", connected: false, icon: "📷", color: "from-pink-400 to-rose-500" },
              { name: "Google Calendar", connected: false, icon: "📅", color: "from-blue-400 to-indigo-500" },
              { name: "Email SMTP", connected: false, icon: "📧", color: "from-amber-400 to-orange-500" },
            ].map((integration) => (
              <div
                key={integration.name}
                className={cn(
                  "p-4 rounded-2xl border-2 text-center transition-all hover:shadow-lg cursor-pointer",
                  integration.connected
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                )}
              >
                <div className={cn(
                  "w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center text-2xl",
                  integration.connected ? "bg-emerald-100" : "bg-gray-100 dark:bg-gray-800"
                )}>
                  {integration.icon}
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{integration.name}</p>
                <p className={cn(
                  "text-xs mt-1 font-medium",
                  integration.connected ? "text-emerald-600" : "text-gray-500"
                )}>
                  {integration.connected ? "✓ Bağlı" : "Bağlı değil"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-100 dark:border-amber-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bildirimler</h2>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[
              { label: "Yeni lead bildirimi", description: "Yeni lead geldiğinde bildirim al", enabled: true },
              { label: "Randevu hatırlatma", description: "Yaklaşan randevular için hatırlatma", enabled: true },
              { label: "Günlük özet", description: "Her gün sonunda performans özeti", enabled: false },
            ].map((notification) => (
              <div key={notification.label} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{notification.label}</p>
                  <p className="text-sm text-gray-500">{notification.description}</p>
                </div>
                <div className={cn(
                  "w-12 h-7 rounded-full transition-colors cursor-pointer relative",
                  notification.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                )}>
                  <div className={cn(
                    "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all",
                    notification.enabled ? "left-6" : "left-1"
                  )} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-100 dark:border-rose-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-xl">
              <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Güvenlik</h2>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-12 justify-start rounded-xl">
              <Key className="w-4 h-4 mr-3" />
              Şifre Değiştir
            </Button>
            <Button variant="outline" className="h-12 justify-start rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
              <Shield className="w-4 h-4 mr-3" />
              Hesabı Sil
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Demo Data */}
      <Card className="border-2 border-dashed border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10 overflow-hidden">
        <div className="p-6 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
              <Database className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Demo Veriler</h2>
              <p className="text-sm text-gray-500">Dashboard&apos;u test etmek için örnek veriler oluşturun</p>
            </div>
          </div>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="p-4 bg-amber-100/50 dark:bg-amber-900/30 rounded-xl">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>⚠️ Dikkat:</strong> Bu işlem mevcut tüm lead, arama ve mesaj verilerinizi silip yerine demo veriler oluşturacaktır.
            </p>
          </div>

          <Button 
            onClick={handleSeedMockData} 
            disabled={isSeeding}
            variant="outline"
            className="w-full h-12 rounded-xl border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/30"
          >
            {isSeeding ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Veriler Oluşturuluyor...</>
            ) : (
              <><Database className="w-4 h-4 mr-2" /> Demo Verileri Oluştur</>
            )}
          </Button>

          {seedResult && (
            <div className={cn(
              "p-4 rounded-xl flex items-start gap-3",
              seedResult.success 
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
            )}>
              {seedResult.success ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="font-medium">{seedResult.message}</p>
                {seedResult.stats && (
                  <p className="text-sm mt-1 opacity-80">
                    {seedResult.stats.leads} lead, {seedResult.stats.calls} arama oluşturuldu.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            size="lg" 
            className="shadow-2xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 rounded-xl"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Değişiklikleri Kaydet
          </Button>
        </div>
      )}
    </div>
  );
}
