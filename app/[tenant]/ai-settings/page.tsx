"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { AISettings } from "@/lib/types-outbound";

const PAGE_VERSION = "1.0.0";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Bot, 
  MessageSquare, 
  Clock,
  RefreshCw, 
  Save,
  Plus,
  Trash2,
  Languages,
  Target,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AISettingsPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  useTenant();
  const { user } = useAuth();

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    agent_name: "Volina AI",
    opening_script_tr: "",
    opening_script_en: "",
    curiosity_questions_tr: [] as string[],
    curiosity_questions_en: [] as string[],
    negative_response_handling_tr: "",
    negative_response_handling_en: "",
    goal_description_tr: "",
    goal_description_en: "",
    max_unreachable_attempts: 5,
    unreachable_timeout_days: 30,
    call_hours_start: "09:00",
    call_hours_end: "18:00",
    announce_ai: true,
  });

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/ai-settings");
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          setSettings(data);
          setFormData({
            agent_name: data.agent_name || "Volina AI",
            opening_script_tr: data.opening_script_tr || "",
            opening_script_en: data.opening_script_en || "",
            curiosity_questions_tr: data.curiosity_questions_tr || [],
            curiosity_questions_en: data.curiosity_questions_en || [],
            negative_response_handling_tr: data.negative_response_handling_tr || "",
            negative_response_handling_en: data.negative_response_handling_en || "",
            goal_description_tr: data.goal_description_tr || "",
            goal_description_en: data.goal_description_en || "",
            max_unreachable_attempts: data.max_unreachable_attempts || 5,
            unreachable_timeout_days: data.unreachable_timeout_days || 30,
            call_hours_start: data.call_hours_start || "09:00",
            call_hours_end: data.call_hours_end || "18:00",
            announce_ai: true,
          });
        }
      }
    } catch (error) {
      console.error("Error loading AI settings:", error);
    }
  }, []);

  useEffect(() => {
    loadSettings().then(() => setIsLoading(false));
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, ...formData }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving AI settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateForm = (updates: Partial<typeof formData>) => {
    setFormData({ ...formData, ...updates });
    setHasChanges(true);
  };

  const addQuestion = (lang: 'tr' | 'en') => {
    const key = lang === 'tr' ? 'curiosity_questions_tr' : 'curiosity_questions_en';
    updateForm({ [key]: [...formData[key], ""] });
  };

  const removeQuestion = (lang: 'tr' | 'en', index: number) => {
    const key = lang === 'tr' ? 'curiosity_questions_tr' : 'curiosity_questions_en';
    updateForm({ [key]: formData[key].filter((_, i) => i !== index) });
  };

  const updateQuestion = (lang: 'tr' | 'en', index: number, value: string) => {
    const key = lang === 'tr' ? 'curiosity_questions_tr' : 'curiosity_questions_en';
    const newQuestions = [...formData[key]];
    newQuestions[index] = value;
    updateForm({ [key]: newQuestions });
  };

  // Don't block on loading - show UI immediately

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Ayarları</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI asistanınızın davranışlarını özelleştirin
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Kaydet
        </Button>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Kaydedilmemiş değişiklikleriniz var
          </p>
        </div>
      )}

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Temel Ayarlar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>AI Adı</Label>
              <Input
                value={formData.agent_name}
                onChange={(e) => updateForm({ agent_name: e.target.value })}
                placeholder="Volina AI"
              />
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.announce_ai}
                  onCheckedChange={(checked) => updateForm({ announce_ai: checked })}
                />
                <Label>Aramada AI olduğunu belirt</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Amaç Açıklaması
            </Label>
            <Tabs defaultValue="tr">
              <TabsList>
                <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
                <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
              </TabsList>
              <TabsContent value="tr">
                <Textarea
                  value={formData.goal_description_tr}
                  onChange={(e) => updateForm({ goal_description_tr: e.target.value })}
                  placeholder="Örn: Online bir doktor randevusu ayarlamak"
                  rows={2}
                />
              </TabsContent>
              <TabsContent value="en">
                <Textarea
                  value={formData.goal_description_en}
                  onChange={(e) => updateForm({ goal_description_en: e.target.value })}
                  placeholder="E.g., Set up an online doctor appointment"
                  rows={2}
                />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Opening Scripts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Açılış Scripti
          </CardTitle>
          <CardDescription>AI&apos;ın aramaya nasıl başlayacağı</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tr">
            <TabsList>
              <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
              <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
            </TabsList>
            <TabsContent value="tr">
              <Textarea
                value={formData.opening_script_tr}
                onChange={(e) => updateForm({ opening_script_tr: e.target.value })}
                placeholder="Merhaba, ben Smile and Holiday'den arıyorum. Size neden Türkiye'yi tercih ettiğinizi sorabilir miyim?"
                rows={4}
              />
            </TabsContent>
            <TabsContent value="en">
              <Textarea
                value={formData.opening_script_en}
                onChange={(e) => updateForm({ opening_script_en: e.target.value })}
                placeholder="Hello, I'm calling from Smile and Holiday. May I ask why you chose Turkey?"
                rows={4}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Curiosity Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Merak Uyandırıcı Sorular
          </CardTitle>
          <CardDescription>İlgi çekici, jenerik olmayan sorular</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tr">
            <TabsList>
              <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
              <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
            </TabsList>
            <TabsContent value="tr" className="space-y-3">
              {formData.curiosity_questions_tr.map((question, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={question}
                    onChange={(e) => updateQuestion('tr', index, e.target.value)}
                    placeholder="Neden Türkiye'yi tercih ettiniz?"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion('tr', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addQuestion('tr')}>
                <Plus className="w-4 h-4 mr-2" />
                Soru Ekle
              </Button>
            </TabsContent>
            <TabsContent value="en" className="space-y-3">
              {formData.curiosity_questions_en.map((question, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={question}
                    onChange={(e) => updateQuestion('en', index, e.target.value)}
                    placeholder="Why did you choose Turkey?"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion('en', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addQuestion('en')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Negative Response Handling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Olumsuz Yanıt Stratejisi
          </CardTitle>
          <CardDescription>&quot;Hayır&quot; yanıtına nasıl tepki verileceği</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tr">
            <TabsList>
              <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
              <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
            </TabsList>
            <TabsContent value="tr">
              <Textarea
                value={formData.negative_response_handling_tr}
                onChange={(e) => updateForm({ negative_response_handling_tr: e.target.value })}
                placeholder="Anlıyorum. Peki size şunu sormama izin verin - uzun ve sağlıklı bir yaşam sizin için ne kadar önemli?"
                rows={4}
              />
            </TabsContent>
            <TabsContent value="en">
              <Textarea
                value={formData.negative_response_handling_en}
                onChange={(e) => updateForm({ negative_response_handling_en: e.target.value })}
                placeholder="I understand. Let me ask you this - how important is a long and healthy life to you?"
                rows={4}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Call Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Arama Ayarları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Arama Başlangıç</Label>
              <Input
                type="time"
                value={formData.call_hours_start}
                onChange={(e) => updateForm({ call_hours_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Arama Bitiş</Label>
              <Input
                type="time"
                value={formData.call_hours_end}
                onChange={(e) => updateForm({ call_hours_end: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Ulaşılamama</Label>
              <Input
                type="number"
                value={formData.max_unreachable_attempts}
                onChange={(e) => updateForm({ max_unreachable_attempts: parseInt(e.target.value) || 5 })}
                min={1}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Timeout (gün)</Label>
              <Input
                type="number"
                value={formData.unreachable_timeout_days}
                onChange={(e) => updateForm({ unreachable_timeout_days: parseInt(e.target.value) || 30 })}
                min={7}
                max={365}
              />
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Lead&apos;e {formData.max_unreachable_attempts} kez ulaşılamazsa veya {formData.unreachable_timeout_days} gün geçerse &quot;ulaşılamaz&quot; olarak işaretlenir.
          </p>
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
