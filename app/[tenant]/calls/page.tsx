"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/components/providers/TenantProvider";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { getCalls } from "@/lib/supabase";
import { getTodaysCalls, updateOutreach, getOutreachHistory } from "@/lib/supabase-outbound";
import type { Call } from "@/lib/types";
import type { Outreach, OutreachResult } from "@/lib/types-outbound";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  PhoneMissed,
  Clock, 
  RefreshCw, 
  Search,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Play,
  Filter
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const resultConfig: Record<OutreachResult, { label: string; color: string; icon: typeof CheckCircle }> = {
  answered_interested: { label: "Ulaşıldı - İlgili", color: "text-green-600 bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
  answered_not_interested: { label: "Ulaşıldı - İlgisiz", color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", icon: XCircle },
  answered_appointment_set: { label: "Randevu Alındı", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30", icon: Calendar },
  answered_callback_requested: { label: "Geri Arama İstendi", color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30", icon: PhoneCall },
  no_answer: { label: "Cevap Yok", color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30", icon: PhoneMissed },
  busy: { label: "Meşgul", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30", icon: Phone },
  voicemail: { label: "Sesli Mesaj", color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30", icon: Phone },
  wrong_number: { label: "Yanlış Numara", color: "text-gray-600 bg-gray-100 dark:bg-gray-700", icon: PhoneOff },
  message_sent: { label: "Mesaj Gönderildi", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30", icon: Phone },
  message_delivered: { label: "Mesaj İletildi", color: "text-green-600 bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
  message_read: { label: "Mesaj Okundu", color: "text-green-600 bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
  message_replied: { label: "Mesaj Yanıtlandı", color: "text-green-600 bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
};

export default function CallsPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const { tenantProfile, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  
  const dashboardType = tenantProfile?.dashboard_type || user?.dashboard_type || 'inbound';

  const [calls, setCalls] = useState<Call[]>([]);
  const [outreachCalls, setOutreachCalls] = useState<Outreach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Outreach | null>(null);
  const [callResult, setCallResult] = useState<OutreachResult | "">("");
  const [callNotes, setCallNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadCalls = useCallback(async () => {
    try {
      if (dashboardType === 'outbound') {
        const data = await getTodaysCalls();
        setOutreachCalls(data);
      } else {
        const data = await getCalls(50);
        setCalls(data);
      }
    } catch (error) {
      console.error("Error loading calls:", error);
    }
  }, [dashboardType]);

  useEffect(() => {
    loadCalls().then(() => setIsLoading(false));
  }, [loadCalls]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCalls();
    setIsRefreshing(false);
  };

  const openResultDialog = (call: Outreach) => {
    setSelectedCall(call);
    setCallResult(call.result || "");
    setCallNotes(call.notes || "");
    setShowResultDialog(true);
  };

  const handleSaveResult = async () => {
    if (!selectedCall || !callResult) return;
    setIsSaving(true);
    try {
      await updateOutreach(selectedCall.id, {
        result: callResult as OutreachResult,
        notes: callNotes,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      setShowResultDialog(false);
      setSelectedCall(null);
      setCallResult("");
      setCallNotes("");
      await loadCalls();
    } catch (error) {
      console.error("Error saving result:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (tenantLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Outbound Dashboard - Call Queue View
  if (dashboardType === 'outbound') {
    const pendingCalls = outreachCalls.filter(c => c.status === 'pending');
    const completedCalls = outreachCalls.filter(c => c.status === 'completed');

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aramalar</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Bugün {outreachCalls.length} arama planlandı
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                  <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Bekleyen</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingCalls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tamamlanan</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedCalls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <PhoneCall className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Toplam</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{outreachCalls.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Bekleyen Aramalar
            </CardTitle>
            <CardDescription>Bugün yapılması gereken aramalar</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <PhoneCall className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Bekleyen arama yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {call.lead?.full_name || "İsimsiz"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {call.lead?.phone || call.lead?.whatsapp || "Numara yok"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {call.scheduled_for ? format(new Date(call.scheduled_for), "HH:mm", { locale: tr }) : "-"}
                      </span>
                      <Button size="sm" onClick={() => openResultDialog(call)}>
                        <Phone className="w-4 h-4 mr-2" />
                        Sonuç Gir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Tamamlanan Aramalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Bugün tamamlanan arama yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedCalls.map((call) => {
                  const resultInfo = call.result ? resultConfig[call.result] : null;
                  const ResultIcon = resultInfo?.icon || Phone;
                  
                  return (
                    <div
                      key={call.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", resultInfo?.color || "bg-gray-100")}>
                          <ResultIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {call.lead?.full_name || "İsimsiz"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {resultInfo?.label || "Sonuç girilmemiş"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {call.completed_at && format(new Date(call.completed_at), "HH:mm", { locale: tr })}
                        </p>
                        {call.notes && (
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">{call.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result Dialog */}
        <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Arama Sonucu</DialogTitle>
              <DialogDescription>
                {selectedCall?.lead?.full_name} ile yapılan arama sonucunu girin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Sonuç *</Label>
                <Select value={callResult} onValueChange={(value) => setCallResult(value as OutreachResult)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sonuç seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(resultConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notlar</Label>
                <Textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Arama hakkında notlar..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResultDialog(false)}>
                İptal
              </Button>
              <Button onClick={handleSaveResult} disabled={isSaving || !callResult}>
                {isSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Inbound Dashboard - Call Logs View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Arama Kayıtları</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {calls.length} arama kaydı
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Arayan adı veya numara ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arayan</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Süre</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls
                .filter(call => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    call.caller_phone?.toLowerCase().includes(query) ||
                    call.summary?.toLowerCase().includes(query)
                  );
                })
                .map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {call.caller_phone || "Bilinmeyen"}
                        </p>
                        <p className="text-sm text-gray-500">{call.vapi_call_id?.slice(0, 8) || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 text-xs rounded-full font-medium",
                        call.type === "appointment" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        call.type === "inquiry" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        call.type === "cancellation" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                      )}>
                        {call.type === "appointment" ? "Randevu" :
                         call.type === "inquiry" ? "Bilgi" :
                         call.type === "cancellation" ? "İptal" :
                         call.type === "follow_up" ? "Takip" : call.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {call.duration ? formatDuration(call.duration) : "-"}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 text-xs rounded-full font-medium",
                        call.sentiment === "positive" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        call.sentiment === "negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      )}>
                        {call.sentiment === "positive" ? "Olumlu" :
                         call.sentiment === "negative" ? "Olumsuz" :
                         call.sentiment === "neutral" ? "Nötr" : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {format(new Date(call.created_at), "d MMM yyyy", { locale: tr })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(call.created_at), "HH:mm", { locale: tr })}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {calls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Henüz arama kaydı yok</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
