"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Call } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  RefreshCw, 
  Search,
  Play,
  Loader2,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Score Badge
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>;
  
  const getColor = (s: number) => {
    if (s >= 8) return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    if (s >= 5) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400";
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  };
  
  return (
    <span className={cn("px-2 py-1 rounded-md text-sm font-medium", getColor(score))}>
      {score}/10
    </span>
  );
}

// Call Row Component with Expandable Detail
function CallRow({ call }: { call: Call }) {
  const [expanded, setExpanded] = useState(false);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div 
        className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {/* Index/Number */}
          <div className="w-8 text-center text-sm text-gray-400 dark:text-gray-500">
            #
          </div>
          
          {/* Customer Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white">
              {call.caller_name || "Unknown Caller"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {call.caller_phone || "No phone"}
            </p>
          </div>
          
          {/* Score */}
          <div className="w-20">
            <ScoreBadge score={call.evaluation_score} />
          </div>
          
          {/* Duration */}
          <div className="w-16 text-sm text-gray-600 dark:text-gray-300 text-right">
            {formatDuration(call.duration)}
          </div>
          
          {/* Date */}
          <div className="w-24 text-sm text-gray-500 dark:text-gray-400 text-right">
            {format(new Date(call.created_at), "MMM d, HH:mm")}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {call.recording_url && (
              <a 
                href={call.recording_url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Play className="w-4 h-4" />
              </a>
            )}
            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="px-6 pb-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="ml-12 space-y-4">
            {/* Summary */}
            {call.summary && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Summary</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{call.summary}</p>
              </div>
            )}
            
            {/* Evaluation */}
            {call.evaluation_summary && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">AI Evaluation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{call.evaluation_summary}</p>
              </div>
            )}
            
            {/* Transcript */}
            {call.transcript && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Transcript</p>
                <div className="text-sm text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <pre className="whitespace-pre-wrap font-sans">{call.transcript}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallsPage() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<Call[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");

  const loadCalls = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/calls?days=90&limit=100");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const transformedCalls: Call[] = data.data.map((call: {
            id: string;
            vapi_call_id: string;
            recording_url: string | null;
            transcript: string | null;
            summary: string | null;
            sentiment: string | null;
            duration: number | null;
            type: string;
            caller_phone: string | null;
            caller_name: string | null;
            evaluation_summary: string | null;
            evaluation_score: number | null;
            created_at: string;
            updated_at: string;
          }) => ({
            id: call.id,
            user_id: "",
            vapi_call_id: call.vapi_call_id,
            appointment_id: null,
            recording_url: call.recording_url,
            transcript: call.transcript,
            summary: call.summary,
            sentiment: call.sentiment as Call["sentiment"],
            duration: call.duration,
            type: call.type as Call["type"],
            caller_phone: call.caller_phone,
            caller_name: call.caller_name,
            evaluation_summary: call.evaluation_summary,
            evaluation_score: call.evaluation_score,
            metadata: {},
            created_at: call.created_at,
            updated_at: call.updated_at,
          }));
          setCalls(transformedCalls);
          setFilteredCalls(transformedCalls);
        }
      }
    } catch (error) {
      console.error("Error loading calls:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  // Filter calls
  useEffect(() => {
    let filtered = [...calls];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(call => 
        call.caller_name?.toLowerCase().includes(query) ||
        call.caller_phone?.includes(query) ||
        call.summary?.toLowerCase().includes(query)
      );
    }
    
    // Score filter
    if (scoreFilter !== "all") {
      filtered = filtered.filter(call => {
        const score = call.evaluation_score;
        if (scoreFilter === "high") return score !== null && score >= 8;
        if (scoreFilter === "medium") return score !== null && score >= 5 && score < 8;
        if (scoreFilter === "low") return score !== null && score < 5;
        return true;
      });
    }
    
    setFilteredCalls(filtered);
  }, [calls, searchQuery, scoreFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCalls();
    setIsRefreshing(false);
  };

  // Stats
  const totalCalls = calls.length;
  const successfulCalls = calls.filter(c => c.evaluation_score !== null && c.evaluation_score >= 7).length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calls</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View and manage your call history</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="border-gray-200 dark:border-gray-700"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">All</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCalls}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Transferred</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Successful</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{successfulCalls}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search calls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-gray-200 dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-40 border-gray-200 dark:border-gray-700 dark:bg-gray-800">
            <Filter className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="high">High (8+)</SelectItem>
            <SelectItem value="medium">Medium (5-7)</SelectItem>
            <SelectItem value="low">Low (&lt;5)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calls Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Customer</div>
            <div className="w-20">Score</div>
            <div className="w-16 text-right">Duration</div>
            <div className="w-24 text-right">Date</div>
            <div className="w-24"></div>
          </div>
        </div>
        
        {/* Table Body */}
        {filteredCalls.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Phone className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No calls found</p>
          </div>
        ) : (
          <div>
            {filteredCalls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
