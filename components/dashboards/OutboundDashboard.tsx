"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Users, 
  Phone, 
  CalendarCheck, 
  TrendingUp, 
  RefreshCw,
  UserPlus,
  Clock,
  PhoneCall,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Lead } from "@/lib/types-outbound";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Stats {
  total: number;
  newLeads: number;
  contacted: number;
  interested: number;
  appointmentSet: number;
  converted: number;
  unreachable: number;
  conversionRate: number;
}

export default function OutboundDashboard() {
  const router = useRouter();
  const params = useParams();
  const tenant = params?.tenant as string;
  const { user } = useAuth();
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/leads?limit=100");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
          // Filter active leads (new, contacted, interested)
          const activeLeads = (data.data || [])
            .filter((l: Lead) => ['new', 'contacted', 'interested'].includes(l.status))
            .slice(0, 10);
          setLeads(activeLeads);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const basePath = tenant ? `/${tenant}` : '/dashboard/outbound';

  if (isLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Outbound Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hoş geldin{user?.full_name ? `, ${user.full_name}` : ""}!
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {format(new Date(), "HH:mm", { locale: tr })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Toplam Lead</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <UserPlus className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Yeni</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.newLeads || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Phone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">İletişime Geçildi</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.contacted || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <CalendarCheck className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Randevu</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.appointmentSet || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Dönüşüm</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  %{stats?.conversionRate || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Leads */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-primary" />
              Hızlı İşlemler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => router.push(`${basePath}/leads`)}
            >
              <Users className="w-4 h-4 mr-2" />
              Tüm Lead'leri Gör
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => router.push(`${basePath}/calls`)}
            >
              <Phone className="w-4 h-4 mr-2" />
              Arama Kayıtları
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => router.push(`${basePath}/campaigns`)}
            >
              <CalendarCheck className="w-4 h-4 mr-2" />
              Kampanyalar
            </Button>
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Aranacak Lead'ler
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push(`${basePath}/leads`)}>
              Tümü
            </Button>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="mb-3">Henüz lead yok</p>
                <Button size="sm" onClick={() => router.push(`${basePath}/leads`)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Lead Ekle
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <div 
                    key={lead.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => router.push(`${basePath}/leads?id=${lead.id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{lead.full_name}</p>
                      <p className="text-sm text-gray-500">{lead.phone || lead.email || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        lead.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {lead.priority === 'high' ? 'Yüksek' : lead.priority === 'medium' ? 'Orta' : 'Düşük'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Satış Hunisi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: "Yeni", value: stats?.newLeads || 0, color: "bg-blue-500" },
              { label: "İletişim", value: stats?.contacted || 0, color: "bg-purple-500" },
              { label: "İlgili", value: stats?.interested || 0, color: "bg-yellow-500" },
              { label: "Randevu", value: stats?.appointmentSet || 0, color: "bg-orange-500" },
              { label: "Dönüşüm", value: stats?.converted || 0, color: "bg-emerald-500" },
            ].map((stage) => (
              <div key={stage.label} className="text-center">
                <div className={`h-2 ${stage.color} rounded-full mb-2`} 
                     style={{ width: `${Math.max((stage.value / Math.max(stats?.total || 1, 1)) * 100, 10)}%`, margin: '0 auto' }} />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stage.value}</p>
                <p className="text-xs text-gray-500">{stage.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
