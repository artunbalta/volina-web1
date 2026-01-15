"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { AISettings } from "@/lib/types-outbound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
  Target,
  AlertCircle,
  Sparkles,
  Loader2,
  Brain,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AISettingsPage() {
  const params = useParams();
  useTenant();
  const { user } = useAuth();

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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
      
      if (response.ok) {
        setHasChanges(false);
      }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">AI Ayarları yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtNHY2aDR2LTJ6TTI2IDI0aC0ydjJoMnYtMnptMCAyaC0ydjJoMnYtMnptMTAgMTBoLTJ2Mmgydi0yem0wIDBoMnYtMmgtMnYyem0tMTAgMGgtMnYyaDJ2LTJ6bTAgMGgydi0yaC0ydjJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Brain className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold">AI Ayarları</h1>
              </div>
              <p className="text-indigo-100 text-lg">
                AI asistanınızın davranışlarını özelleştirin
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !hasChanges}
              className="bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Kaydet
            </Button>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-purple-400/20 rounded-full blur-2xl" />
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
            Kaydedilmemiş değişiklikleriniz var
          </p>
        </div>
      )}

      {/* Basic Settings */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border-b border-indigo-100 dark:border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
              <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Temel Ayarlar</h2>
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Adı</Label>
              <Input
                value={formData.agent_name}
                onChange={(e) => updateForm({ agent_name: e.target.value })}
                placeholder="Volina AI"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div>
                <Label className="text-sm font-medium">AI Olduğunu Belirt</Label>
                <p className="text-xs text-gray-500 mt-1">Aramalarda AI olduğunu duyur</p>
              </div>
              <Switch
                checked={formData.announce_ai}
                onCheckedChange={(checked) => updateForm({ announce_ai: checked })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              Amaç Açıklaması
            </Label>
            <Tabs defaultValue="tr" className="w-full">
              <TabsList className="mb-3">
                <TabsTrigger value="tr" className="rounded-lg">🇹🇷 Türkçe</TabsTrigger>
                <TabsTrigger value="en" className="rounded-lg">🇬🇧 English</TabsTrigger>
              </TabsList>
              <TabsContent value="tr">
                <Textarea
                  value={formData.goal_description_tr}
                  onChange={(e) => updateForm({ goal_description_tr: e.target.value })}
                  placeholder="Örn: Online bir doktor randevusu ayarlamak"
                  rows={2}
                  className="rounded-xl"
                />
              </TabsContent>
              <TabsContent value="en">
                <Textarea
                  value={formData.goal_description_en}
                  onChange={(e) => updateForm({ goal_description_en: e.target.value })}
                  placeholder="E.g., Set up an online doctor appointment"
                  rows={2}
                  className="rounded-xl"
                />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Opening Scripts */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-100 dark:border-purple-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
              <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Açılış Scripti</h2>
              <p className="text-sm text-gray-500">AI'ın aramaya nasıl başlayacağı</p>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <Tabs defaultValue="tr" className="w-full">
            <TabsList className="mb-3">
              <TabsTrigger value="tr" className="rounded-lg">🇹🇷 Türkçe</TabsTrigger>
              <TabsTrigger value="en" className="rounded-lg">🇬🇧 English</TabsTrigger>
            </TabsList>
            <TabsContent value="tr">
              <Textarea
                value={formData.opening_script_tr}
                onChange={(e) => updateForm({ opening_script_tr: e.target.value })}
                placeholder="Merhaba, ben Smile and Holiday'den arıyorum..."
                rows={4}
                className="rounded-xl"
              />
            </TabsContent>
            <TabsContent value="en">
              <Textarea
                value={formData.opening_script_en}
                onChange={(e) => updateForm({ opening_script_en: e.target.value })}
                placeholder="Hello, I'm calling from Smile and Holiday..."
                rows={4}
                className="rounded-xl"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Curiosity Questions */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-100 dark:border-amber-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Merak Uyandırıcı Sorular</h2>
              <p className="text-sm text-gray-500">İlgi çekici, jenerik olmayan sorular</p>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <Tabs defaultValue="tr" className="w-full">
            <TabsList className="mb-3">
              <TabsTrigger value="tr" className="rounded-lg">🇹🇷 Türkçe</TabsTrigger>
              <TabsTrigger value="en" className="rounded-lg">🇬🇧 English</TabsTrigger>
            </TabsList>
            <TabsContent value="tr" className="space-y-3">
              {formData.curiosity_questions_tr.map((question, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={question}
                    onChange={(e) => updateQuestion('tr', index, e.target.value)}
                    placeholder="Neden Türkiye'yi tercih ettiniz?"
                    className="rounded-xl"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion('tr', index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addQuestion('tr')} className="rounded-xl">
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
                    className="rounded-xl"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion('en', index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addQuestion('en')} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Negative Response Handling */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-100 dark:border-rose-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Olumsuz Yanıt Stratejisi</h2>
              <p className="text-sm text-gray-500">&quot;Hayır&quot; yanıtına nasıl tepki verileceği</p>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <Tabs defaultValue="tr" className="w-full">
            <TabsList className="mb-3">
              <TabsTrigger value="tr" className="rounded-lg">🇹🇷 Türkçe</TabsTrigger>
              <TabsTrigger value="en" className="rounded-lg">🇬🇧 English</TabsTrigger>
            </TabsList>
            <TabsContent value="tr">
              <Textarea
                value={formData.negative_response_handling_tr}
                onChange={(e) => updateForm({ negative_response_handling_tr: e.target.value })}
                placeholder="Anlıyorum. Peki size şunu sormama izin verin..."
                rows={4}
                className="rounded-xl"
              />
            </TabsContent>
            <TabsContent value="en">
              <Textarea
                value={formData.negative_response_handling_en}
                onChange={(e) => updateForm({ negative_response_handling_en: e.target.value })}
                placeholder="I understand. Let me ask you this..."
                rows={4}
                className="rounded-xl"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Call Settings */}
      <Card className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-b border-cyan-100 dark:border-cyan-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/50 rounded-xl">
              <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Arama Ayarları</h2>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Başlangıç Saati</Label>
              <Input
                type="time"
                value={formData.call_hours_start}
                onChange={(e) => updateForm({ call_hours_start: e.target.value })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bitiş Saati</Label>
              <Input
                type="time"
                value={formData.call_hours_end}
                onChange={(e) => updateForm({ call_hours_end: e.target.value })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Max Deneme</Label>
              <Input
                type="number"
                value={formData.max_unreachable_attempts}
                onChange={(e) => updateForm({ max_unreachable_attempts: parseInt(e.target.value) || 5 })}
                min={1}
                max={20}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Timeout (gün)</Label>
              <Input
                type="number"
                value={formData.unreachable_timeout_days}
                onChange={(e) => updateForm({ unreachable_timeout_days: parseInt(e.target.value) || 30 })}
                min={7}
                max={365}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            💡 Lead&apos;e {formData.max_unreachable_attempts} kez ulaşılamazsa veya {formData.unreachable_timeout_days} gün geçerse &quot;ulaşılamaz&quot; olarak işaretlenir.
          </p>
        </CardContent>
      </Card>

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            size="lg" 
            className="shadow-2xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 rounded-xl"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Değişiklikleri Kaydet
          </Button>
        </div>
      )}
    </div>
  );
}
