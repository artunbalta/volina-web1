"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/providers/SupabaseProvider";
import type { Call } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Phone, 
  RefreshCw, 
  Search,
  Play,
  Pause,
  Rewind,
  FastForward,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn, cleanCallSummary } from "@/lib/utils";

// Audio Player Component
function AudioPlayer({ 
  call, 
  isOpen, 
  onClose 
}: { 
  call: Call | null; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRefs = useRef<number[]>([]);

  // Format time helper with proper alignment
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration for display (with seconds)
  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) {
      return `${secs} sec.`;
    }
    return `${mins} min. ${secs} sec.`;
  };

  // Initialize audio when call changes
  useEffect(() => {
    if (!call?.recording_url || !isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setDuration(0);
      setCurrentTime(0);
      setIsLoading(false);
      setError(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    
    // Create audio element and set crossOrigin BEFORE setting src
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = call.recording_url;
    audioRef.current = audio;
    
    // Generate waveform heights
    waveformRefs.current = Array.from({ length: 60 }, () => Math.random() * 60 + 20);
    
    let loadTimeout: NodeJS.Timeout | null = null;
    let hasLoaded = false;
    
    const handleLoadedMetadata = () => {
      hasLoaded = true;
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
      }
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setIsLoading(false);
      } else if (call.duration) {
        // Use call duration as fallback
        setDuration(call.duration);
        setIsLoading(false);
      }
    };
    
    const handleCanPlay = () => {
      hasLoaded = true;
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
      }
      setIsLoading(false);
    };
    
    const handleError = () => {
      // Extract error details from MediaError
      const mediaError = audio.error;
      let errorMessage = "Unable to load audio recording.";
      
      if (mediaError) {
        switch (mediaError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "Audio loading was aborted.";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "Network error while loading audio. The recording URL may have expired.";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "Audio decoding error. The file may be corrupted.";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Audio format not supported or recording unavailable.";
            break;
        }
        console.error("Audio loading error:", mediaError.code, mediaError.message);
      }
      
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
      }
      setError(errorMessage);
      setIsLoading(false);
      audioRef.current = null;
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    
    // Preload audio
    audio.load();
    
    // Timeout fallback - if audio doesn't load in 10 seconds, show error
    loadTimeout = setTimeout(() => {
      if (!hasLoaded) {
        console.error("Audio loading timeout");
        setError("Audio loading timed out. The recording may be unavailable or expired.");
        setIsLoading(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      }
    }, 10000);
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.recording_url, call?.duration, isOpen]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percent * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  if (!call || !call.recording_url) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = duration - currentTime;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl bg-white dark:bg-gray-800 p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              {call.caller_name || "Unknown Caller"}
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </DialogHeader>
        
        <div className="px-6 py-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Call Info Bubble */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 inline-block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-900 flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {call.caller_name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Audiocall</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                  {duration > 0 ? formatDuration(duration) : (call.duration ? formatDuration(call.duration) : "—")}
                </p>
              </div>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="relative h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg overflow-hidden flex items-center justify-center">
            <div className="flex items-center gap-0.5 h-full px-4">
              {waveformRefs.current.map((height, i) => {
                const isActive = (i / 60) * 100 <= progress;
                const isPlayingNow = isPlaying && isActive;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 rounded-full transition-all duration-100",
                      isActive
                        ? "bg-orange-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    )}
                    style={{
                      height: isActive ? `${height}%` : "20%",
                      animation: isPlayingNow ? "pulse 0.5s ease-in-out infinite" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div 
              className="relative h-2 bg-gray-900 dark:bg-gray-700 rounded-full cursor-pointer"
              onClick={handleSeek}
            >
              {/* Progress fill */}
              <div 
                className="absolute left-0 top-0 h-full bg-orange-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              
              {/* Progress segments/markers */}
              <div className="absolute inset-0 flex items-center">
                {Array.from({ length: 20 }).map((_, i) => {
                  const segmentPos = (i / 20) * 100;
                  const isActive = segmentPos <= progress;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "absolute h-1 rounded-full",
                        isActive ? "bg-orange-500" : "bg-gray-700 dark:bg-gray-600"
                      )}
                      style={{
                        left: `${segmentPos}%`,
                        width: "2px",
                      }}
                    />
                  );
                })}
              </div>
              
              {/* Scrubber */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-orange-500 rounded-full border-2 border-white dark:border-gray-900 transition-all"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(remainingTime)}</span>
      </div>
    </div>

          {/* Loading State */}
          {isLoading && !error && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading audio...</p>
            </div>
          )}

          {/* Playback Controls */}
          {!isLoading && !error && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => skip(-10)}
                disabled={!duration}
                className="w-12 h-12 rounded-lg bg-gray-900 dark:bg-gray-700 text-white flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Rewind className="w-5 h-5" />
              </button>
              
              <button
                onClick={togglePlay}
                disabled={!duration || isLoading}
                className="w-16 h-16 rounded-lg bg-gray-900 dark:bg-gray-700 text-white flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </button>
              
              <button
                onClick={() => skip(10)}
                disabled={!duration}
                className="w-12 h-12 rounded-lg bg-gray-900 dark:bg-gray-700 text-white flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FastForward className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Summary Bubble */}
          {call.summary && cleanCallSummary(call.summary) && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 inline-block max-w-md">
              <p className="text-sm text-gray-700 dark:text-gray-300">{cleanCallSummary(call.summary)}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to parse and validate score - handles all edge cases
function parseScore(score: unknown): number | null {
  if (score === null || score === undefined) return null;
  
  // Handle string scores (from DB)
  if (typeof score === 'string') {
    const parsed = parseFloat(score);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      return Math.round(parsed);
    }
    return null;
  }
  
  // Handle number scores
  if (typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 10) {
    return Math.round(score);
  }
  
  return null;
}

// Estimate a score based on call properties when no score is available
function estimateScore(call: Call): number {
  const duration = call.duration || 0;
  const sentiment = call.sentiment;
  const hasTranscript = !!call.transcript;
  const hasSummary = !!call.summary;
  const metadata = call.metadata as Record<string, unknown> | undefined;
  const endedReason = metadata?.endedReason as string | undefined;
  
  // Check ended reason for special cases - all failed connections get 1
  if (endedReason) {
    const reason = endedReason.toLowerCase();
    if (reason.includes('no-answer') || reason.includes('customer-did-not-answer')) {
      return 1;
    }
    if (reason.includes('voicemail')) {
      return 1;
    }
    if (reason.includes('busy')) {
      return 1;
    }
  }
  
  // No transcript and very short call = likely failed
  if (!hasTranscript && duration < 10) {
    return 2;
  }
  
  // Base score starts at 5 (neutral)
  let score = 5;
  
  // Adjust based on sentiment
  if (sentiment === 'positive') {
    score += 2;
  } else if (sentiment === 'negative') {
    score -= 2;
  }
  
  // Adjust based on duration (longer calls are usually better)
  if (duration > 180) { // > 3 minutes
    score += 1;
  } else if (duration > 60) { // > 1 minute
    score += 0.5;
  } else if (duration < 30) { // < 30 seconds
    score -= 1;
  }
  
  // Has transcript is a good sign
  if (hasTranscript && hasSummary) {
    score += 0.5;
  }
  
  // Clamp between 1 and 10
  return Math.max(1, Math.min(10, Math.round(score)));
}

// Helper function to get valid evaluation summary
function getValidEvaluationSummary(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const trimmed = summary.trim().toLowerCase();
  // Filter out invalid values
  if (trimmed === 'false' || trimmed === 'true' || trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
    return null;
  }
  return summary;
}

// Helper to get score color classes
function getScoreColor(score: number): { bg: string; text: string } {
  if (score >= 7) {
    return {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-400"
    };
  } else if (score >= 4) {
    return {
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-400"
    };
  } else {
    return {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400"
    };
  }
}

// Call Row Component with Expandable Detail - Mobile Responsive
function CallRow({ 
  call, 
  onPlay 
}: { 
  call: Call;
  onPlay: (call: Call) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Pre-calculate valid score and summary
  const metadata = call.metadata as Record<string, unknown> | undefined;
  const endedReason = (metadata?.endedReason as string || '').toLowerCase();
  
  // Check if this is a failed connection (no-answer, voicemail, busy)
  const isFailedConnection = endedReason.includes('no-answer') || 
                             endedReason.includes('customer-did-not-answer') ||
                             endedReason.includes('voicemail') || 
                             endedReason.includes('busy');
  
  // For failed connections, always show 1 regardless of DB value
  // For others, use DB value or estimate
  const parsedScore = parseScore(call.evaluation_score);
  const validScore = isFailedConnection ? 1 : (parsedScore !== null ? parsedScore : estimateScore(call));
  const isEstimated = parsedScore === null && !isFailedConnection;
  const validSummary = getValidEvaluationSummary(call.evaluation_summary);
  const scoreColors = getScoreColor(validScore);

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div 
        className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Mobile Layout */}
        <div className="sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {call.caller_name || "Unknown Caller"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {call.caller_phone || "No phone"}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {format(new Date(call.created_at), "MMM d, HH:mm")}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {formatDuration(call.duration)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Score badge - always shows a score */}
              <span className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold",
                scoreColors.bg,
                scoreColors.text,
                isEstimated && "opacity-70" // Slightly dim estimated scores
              )}>
                {validScore}
              </span>
              {call.recording_url && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(call);
                  }}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              <ChevronDown className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                expanded && "rotate-180"
              )} />
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Index/Number */}
          <div className="w-8 text-center text-sm text-gray-400 dark:text-gray-500">
            #
          </div>
          
          {/* Customer Info */}
          <div className="w-64">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {call.caller_name || "Unknown Caller"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {call.caller_phone || "No phone"}
            </p>
          </div>
          
          {/* Score */}
          <div className="w-16 flex justify-center">
            <span className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold",
              scoreColors.bg,
              scoreColors.text,
              isEstimated && "opacity-70" // Slightly dim estimated scores
            )}>
              {validScore}
            </span>
          </div>
          
          {/* Duration */}
          <div className="w-20 text-sm text-gray-600 dark:text-gray-300 text-center font-mono tabular-nums">
            {formatDuration(call.duration)}
          </div>
          
          {/* Date */}
          <div className="w-28 text-sm text-gray-500 dark:text-gray-400 text-center">
            {format(new Date(call.created_at), "MMM d, HH:mm")}
          </div>
          
          {/* Actions */}
          <div className="w-20 flex items-center justify-end gap-2">
            {call.recording_url && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(call);
                }}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Play className="w-4 h-4" />
              </button>
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
        <div className="px-4 sm:px-6 pb-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="sm:ml-12 space-y-4">
            {/* Summary */}
            {call.summary && cleanCallSummary(call.summary) && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Summary</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{cleanCallSummary(call.summary)}</p>
              </div>
            )}
            
            {/* AI Evaluation - Always show since we always have a score now */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">AI Evaluation</p>
              <div className="flex items-start gap-4">
                {/* Score Display */}
                <div className={cn(
                  "flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl",
                  scoreColors.bg,
                  isEstimated && "opacity-80"
                )}>
                  <span className={cn("text-xl sm:text-2xl font-bold", scoreColors.text)}>
                    {validScore}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">/10</span>
                </div>
                
                {/* Summary/Details */}
                <div className="flex-1 space-y-2">
                  {validSummary && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">{cleanCallSummary(validSummary)}</p>
                  )}
                  
                  {/* Score interpretation */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      validScore >= 7 
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : validScore >= 4
                        ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    )}>
                      {validScore >= 8 ? "Excellent" : 
                       validScore >= 7 ? "Good" :
                       validScore >= 5 ? "Average" :
                       validScore >= 3 ? "Below Average" : "Poor"}
                    </span>
                    {isEstimated && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        Estimated
                      </span>
                    )}
                    {call.sentiment && call.sentiment !== 'neutral' && (
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
                        call.sentiment === 'positive' 
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          : "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                      )}>
                        {call.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Transcript */}
            {call.transcript && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Transcript</p>
                <div className="text-sm text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm">{call.transcript}</pre>
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
  const { user, isLoading: authLoading } = useAuth();
  const [calls, setCalls] = useState<Call[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCalls = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/dashboard/calls?days=365&userId=${user.id}`);
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
            evaluation_score: number | string | null;
            created_at: string;
            updated_at: string;
          }) => {
            // Use parseScore helper to handle all edge cases (string, number, null, undefined)
            const parsedScore = parseScore(call.evaluation_score);

            return {
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
              evaluation_summary: call.evaluation_summary, // Will be validated in CallRow
              evaluation_score: parsedScore,
              metadata: {},
              created_at: call.created_at,
              updated_at: call.updated_at,
            };
          });
          setCalls(transformedCalls);
          setFilteredCalls(transformedCalls);
        } else {
          setCalls([]);
          setFilteredCalls([]);
        }
      } else {
        console.error("Failed to load calls:", response.statusText);
        setCalls([]);
        setFilteredCalls([]);
      }
    } catch (error) {
      console.error("Error loading calls:", error);
      setCalls([]);
      setFilteredCalls([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Sync calls from Vapi in the background (returns true if new calls were synced)
  const syncCallsFromVapi = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const syncResponse = await fetch(`/api/vapi/sync?days=14&userId=${user.id}`, {
        method: 'POST',
      });
      
      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        if (syncData.synced > 0) {
          console.log(`Synced ${syncData.synced} new calls from Vapi`);
          return true;
        }
      }
    } catch (error) {
      console.error("Error syncing from Vapi:", error);
    }
    return false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    
    if (user?.id) {
      // Load cached calls immediately, then sync in background
      loadCalls().then(() => {
        // After showing cached data, sync from Vapi in background
        syncCallsFromVapi().then((hasNewCalls) => {
          if (hasNewCalls) {
            // Reload to show new calls
            loadCalls();
          }
        });
      });
    } else {
      setIsLoading(false);
      setCalls([]);
      setFilteredCalls([]);
    }
  }, [user?.id, authLoading, loadCalls, syncCallsFromVapi]);

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
    
    setFilteredCalls(filtered);
  }, [calls, searchQuery]);

  const handleRefresh = async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      // Sync from Vapi and reload
      const hasNewCalls = await syncCallsFromVapi();
      await loadCalls();
      
      if (hasNewCalls) {
        console.log("New calls synced from Vapi");
      }
    } catch (error) {
      console.error("Error during refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearAll = async () => {
    if (!user?.id) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/calls?userId=${user.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
      const data = await response.json();
      if (data.success) {
          setCalls([]);
          setFilteredCalls([]);
          setShowClearAllDialog(false);
      } else {
          alert("Failed to delete calls: " + (data.error || "Unknown error"));
        }
      } else {
        alert("Failed to delete calls. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting calls:", error);
      alert("An error occurred while deleting calls. Please try again.");
    } finally {
      setIsDeleting(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Calls</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">View and manage your call history</p>
            </div>
              <Button 
                variant="outline" 
                onClick={handleRefresh} 
                disabled={isRefreshing}
          className="border-gray-200 dark:border-gray-700 w-full sm:w-auto"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
              </Button>
            </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">All</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{totalCalls}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Transferred</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">0</p>
          </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Successful</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{successfulCalls}</p>
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

            </div>

      {/* Calls Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header - Hidden on mobile */}
        <div className="hidden sm:block px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            <div className="w-8 text-center">#</div>
            <div className="w-64">Customer</div>
            <div className="w-16 text-center">Score</div>
            <div className="w-20 text-center">Duration</div>
            <div className="w-28 text-center">Date</div>
            <div className="w-20"></div>
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
              <CallRow 
                key={call.id} 
                call={call} 
                onPlay={(call) => {
                  setSelectedCall(call);
                  setIsPlayerOpen(true);
                }}
              />
            ))}
              </div>
        )}
      </div>

      {/* Audio Player Modal */}
      <AudioPlayer
        call={selectedCall}
        isOpen={isPlayerOpen}
        onClose={() => {
          setIsPlayerOpen(false);
          setSelectedCall(null);
        }}
      />

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear All Calls</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {calls.length} calls? This action cannot be undone and will permanently remove all calls from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearAllDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClearAll} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
