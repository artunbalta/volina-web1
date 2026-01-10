"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Settings, 
  User, 
  Building, 
  Link,
  RefreshCw, 
  Save,
  Key,
  Globe,
  Bell,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_VERSION = "1.0.0";

export default function SettingsPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const { tenantProfile } = useTenant();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
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
      
      if (!response.ok) {
        throw new Error("Failed to save profile");
      }
      
      setHasChanges(false);
      await loadProfile();
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

  // Don't block on loading - show UI immediately

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ayarlar</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hesap ve entegrasyon ayarlarınızı yönetin
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Kaydet
        </Button>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profil Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => updateForm({ full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-gray-50 dark:bg-gray-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Şirket Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Şirket Adı</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => updateForm({ company_name: e.target.value })}
                placeholder="Smile and Holiday"
              />
            </div>
            <div className="space-y-2">
              <Label>URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">volina.online/</span>
                <Input
                  value={formData.slug}
                  onChange={(e) => updateForm({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  placeholder="smileandholiday"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500">Dashboard URL&apos;niz: volina.online/{formData.slug || tenant}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            Entegrasyonlar
          </CardTitle>
          <CardDescription>Harici servislerle bağlantı ayarları</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>VAPI Organization ID</Label>
            <Input
              value={formData.vapi_org_id}
              onChange={(e) => updateForm({ vapi_org_id: e.target.value })}
              placeholder="ecaff27b-9d28-470c-a72b-f3d3b8b94791"
            />
            <p className="text-xs text-gray-500">VAPI webhook&apos;larınızı bu hesaba yönlendirmek için kullanılır</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {[
              { name: "WhatsApp", connected: false, icon: "💬" },
              { name: "Instagram", connected: false, icon: "📷" },
              { name: "Google Calendar", connected: false, icon: "📅" },
              { name: "Email SMTP", connected: false, icon: "📧" },
            ].map((integration) => (
              <div
                key={integration.name}
                className={cn(
                  "p-4 rounded-lg border-2 text-center",
                  integration.connected
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                <span className="text-2xl mb-2 block">{integration.icon}</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{integration.name}</p>
                <p className={cn(
                  "text-xs mt-1",
                  integration.connected ? "text-green-600" : "text-gray-500"
                )}>
                  {integration.connected ? "Bağlı" : "Bağlı değil"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Bildirimler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: "Yeni lead bildirimi", description: "Yeni lead geldiğinde bildirim al", enabled: true },
              { label: "Randevu hatırlatma", description: "Yaklaşan randevular için hatırlatma", enabled: true },
              { label: "Günlük özet", description: "Her gün sonunda performans özeti", enabled: false },
              { label: "Ulaşılamayan lead uyarısı", description: "1 aydır ulaşılamayan lead&apos;ler için uyarı", enabled: true },
            ].map((notification) => (
              <div key={notification.label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{notification.label}</p>
                  <p className="text-sm text-gray-500">{notification.description}</p>
                </div>
                <div className={cn(
                  "w-10 h-6 rounded-full transition-colors cursor-pointer",
                  notification.enabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                )}>
                  <div className={cn(
                    "w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5",
                    notification.enabled ? "translate-x-4.5 ml-4" : "translate-x-0.5 ml-0.5"
                  )} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Güvenlik
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              <Key className="w-4 h-4 mr-2" />
              Şifre Değiştir
            </Button>
            <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
              <Shield className="w-4 h-4 mr-2" />
              Hesabı Sil
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button (Fixed) */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6">
          <Button onClick={handleSave} disabled={isSaving} size="lg" className="shadow-lg">
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Değişiklikleri Kaydet
          </Button>
        </div>
      )}
    </div>
  );
}
