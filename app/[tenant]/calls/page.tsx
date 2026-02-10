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
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
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
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsLoading(false);
      setError(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    
    // Create audio element and set crossOrigin BEFORE setting src
    // Add cache-busting parameter to prevent browser caching issues
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    const cacheBuster = `${call.recording_url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    audio.src = call.recording_url + cacheBuster;
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
      // Reset audio position for replay
      if (audio) {
        audio.currentTime = 0;
      }
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
      audio.removeAttribute('src');
      audio.load(); // Release resources properly
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
      // If audio ended, reset before playing
      if (audio.ended) {
        audio.currentTime = 0;
      }
      audio.play().catch((err) => {
        console.error("Audio play error:", err);
        setError("Failed to play audio. Try reopening the player.");
      });
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
              {getCallerDisplay(call).name}
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
                  {getCallerDisplay(call).name.charAt(0).toUpperCase()}
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

// Helper to check if a string looks like a phone number
function looksLikePhoneNumber(str: string | null | undefined): boolean {
  if (!str) return false;
  // Remove spaces, dashes, parentheses
  const cleaned = str.replace(/[\s\-\(\)]/g, '');
  // Check if it starts with + or is mostly digits (7+ digits)
  return cleaned.startsWith('+') || /^\d{7,}$/.test(cleaned);
}

// Helper to get proper display values for name and phone
// Handles cases where phone number ends up in name field
function getCallerDisplay(call: Call): { name: string; phone: string } {
  const callerName = call.caller_name;
  const callerPhone = call.caller_phone;
  
  // If name looks like a phone number and phone is empty, swap them
  if (looksLikePhoneNumber(callerName) && !callerPhone) {
    return {
      name: "Unknown Caller",
      phone: callerName || "No phone"
    };
  }
  
  // If both are empty
  if (!callerName && !callerPhone) {
    return {
      name: "Unknown Caller",
      phone: "No phone"
    };
  }
  
  // Normal case
  return {
    name: callerName || "Unknown Caller",
    phone: callerPhone || "No phone"
  };
}

// Helper function to parse and validate score - handles all edge cases
function parseScore(score: unknown): number | null {
  if (score === null || score === undefined) return null;
  
  // Handle string scores (from DB)
  if (typeof score === 'string') {
    const parsed = parseFloat(score);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      return Math.round(parsed);
    }
    return null;
  }
  
  // Handle number scores (1-5 scale)
  if (typeof score === 'number' && !isNaN(score) && score >= 1 && score <= 5) {
    return Math.round(score);
  }
  
  return null;
}

// Estimate a score based on call properties when no score is available (1-5 scale)
function estimateScore(call: Call): number {
  const duration = call.duration || 0;
  const sentiment = call.sentiment;
  const hasTranscript = !!call.transcript;
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
    return 1;
  }
  
  // Base score starts at 3 (neutral conversation)
  let score = 3;
  
  // Adjust based on sentiment
  if (sentiment === 'positive') {
    score += 1;
  } else if (sentiment === 'negative') {
    score -= 1;
  }
  
  // Adjust based on duration (longer calls are usually better)
  if (duration > 180) { // > 3 minutes
    score += 0.5;
  } else if (duration < 30) { // < 30 seconds
    score -= 0.5;
  }
  
  // Clamp between 1 and 5
  return Math.max(1, Math.min(5, Math.round(score)));
}

// Helper function to get sort key for calls - MUST match display logic exactly
// Returns: 1 = V (voicemail), 2 = F (failed), 3 = N (neutral), 4 = L (lead)
function getCallSortKey(call: Call): number {
  const metadata = call.metadata as Record<string, unknown> | undefined;
  const endedReason = (metadata?.endedReason as string || '').toLowerCase();
  const evalSummary = (call.evaluation_summary || '').toLowerCase();
  const callSummary = (call.summary || '').toLowerCase();
  const transcript = (call.transcript || '').toLowerCase();
  
  // MUST match display logic patterns exactly
  const voicemailSystemPhrases = [
    'voicemail', 'sesli mesaj',
    'record your message', 'leave a message', 'leave your message',
    'unable to take your call', 'can\'t take your call', 'can t take your call', 'cannot take your call',
    'after the tone', 'after the beep', 'at the tone', 'mailbox',
    'press hash', 'hang up', 'just hang up', 'when you re done', 'when you\'re done'
  ];
  
  const failedPatterns = [
    'no-answer', 'customer-did-not-answer', 'busy', 'customer-busy', 'failed',
    // Turkish failed phrases  
    'ulaşılamadı', 'meşgul', 'cevap yok', 'hat meşgul',
    'bağlantı kurulamadı', 'bağlanamadı', 'aranılamadı', 'cevaplanmadı'
  ];
  
  const meaningfulUserPatterns = [
    'who is this', 'who are you', 'which company', 'what do you want',
    'call me', 'call back', 'another time', 'not interested', 'no thanks',
    'yes', 'no', 'okay', 'sure', 'hello', 'hi', 'what', 'why', 'how much',
    'i\'m', 'i am', 'i don\'t', 'i cant', 'i can\'t',
    // Turkish - MUST match display logic
    'kimsiniz', 'ne istiyorsunuz', 'sonra ara', 'ilgilenmiyorum', 'hayır', 'evet'
  ];
  
  const positiveIndicators = [
    // Interest signals - affirmative responses
    'interested', 'yes please', 'sure', 'okay', 'sounds good', 'yes i am',
    'yep', 'yeah', 'yea', 'yes', 'alright',  // Common affirmatives
    'tell me more', 'how much', 'when can', 'i want', 'i need', 'i would like',
    // Callback/contact requests
    'call me', 'call back', 'reach me', 'contact me', 'get back to me',
    'send me', 'email me', 'whatsapp', 'message me', 'text me',
    // Appointment
    'book', 'schedule', 'appointment', 'available', 'free time',
    // Turkish - MUST match display logic
    'ilgili', 'randevu', 'evet', 'tamam', 'olur', 'istiyorum', 'ara beni',
    'geri ara', 'iletişime geç', 'bilgi gönder'
  ];
  
  const textToCheck = `${endedReason} ${evalSummary} ${callSummary}`;
  
  // Count user responses
  const userResponses = (transcript.match(/user:/gi) || []).length;
  const userParts = transcript.split(/ai:/i).filter(part => part.includes('user:'));
  const userTextRaw = userParts.map(p => p.split('user:')[1] || '').join(' ').toLowerCase();
  const userText = userTextRaw.replace(/[.,!?;:'"]/g, ' ').replace(/\s+/g, ' '); // Normalize punctuation
  const userSaidMeaningful = meaningfulUserPatterns.some(p => userText.includes(p));
  const userOnlyVoicemailPhrases = voicemailSystemPhrases.some(p => userText.includes(p)) && !userSaidMeaningful;
  
  const hasVoicemailPhrases = voicemailSystemPhrases.some(p => transcript.includes(p));
  // Key change: even if userResponses >= 2, if user ONLY said voicemail phrases, it's still voicemail
  const isRealConversation = userSaidMeaningful; // Simplified - must say something meaningful
  
  // Voicemail detection - MUST match display logic
  const isVoicemail = (hasVoicemailPhrases && !isRealConversation) || 
                      (userOnlyVoicemailPhrases);
  const isSilenceTimeout = endedReason === 'silence-timed-out';
  const isShortCall = (call.duration || 0) < 30;
  const likelyVoicemailByBehavior = isSilenceTimeout && isShortCall && !isRealConversation;
  const isVoicemailFinal = isVoicemail || likelyVoicemailByBehavior;
  
  // If voicemail → V (sort key 1)
  if (isVoicemailFinal) {
    return 1;
  }
  
  // Get effective score for failed check
  const parsedScore = parseScore(call.evaluation_score);
  const effectiveScore = parsedScore !== null ? parsedScore : estimateScore(call);
  
  const isFailedByText = failedPatterns.some(p => textToCheck.includes(p));
  const isVeryShortCall = (call.duration || 0) < 15;
  const aiOnlySpoke = transcript.includes('ai:') && userResponses === 0;
  const customerHungUpQuickly = endedReason === 'customer-ended-call' && isVeryShortCall;
  
  const isFailedCall = isFailedByText || 
    effectiveScore === 1 ||  // Explicitly scored as failed
    (customerHungUpQuickly && !isRealConversation) ||
    (aiOnlySpoke && isVeryShortCall);
  
  // If failed → F (sort key 2)
  if (isFailedCall) {
    return 2;
  }
  
  // Check if Lead - MUST match display logic
  // Negative indicators - avoid short words that match inside other words
  const negativeIndicators = [
    'not interested', 'no thanks', 'no thank you', 'don\'t call', 'stop calling',
    'remove me', 'wrong number', 'can\'t talk', 'not now', 'not for me',
    'i\'m busy', 'too busy', 'leave me alone',
    'hayır', 'ilgilenmiyorum', 'aramayın', 'meşgulüm', 'istemiyorum'
  ];
  
  // Check positive/negative ONLY in USER's speech
  const hasPositiveFromUser = positiveIndicators.some(p => userText.includes(p));
  const hasNegativeFromUser = negativeIndicators.some(p => userText.includes(p));
  
  // Special case: if user ONLY said "no" (very short response)
  const userWords = userText.trim().split(/\s+/).filter(w => w.length > 0);
  const onlySaidNo = userWords.length <= 2 && /\bno\b/i.test(userText) && !hasPositiveFromUser;
  
  const hasMinimumEngagement = isRealConversation && !isVeryShortCall;
  
  const isLead = hasMinimumEngagement && 
    hasPositiveFromUser && !hasNegativeFromUser && !onlySaidNo && call.sentiment !== 'negative';
  
  // If lead → L (sort key 4)
  if (isLead) {
    return 4;
  }
  
  // Otherwise → N (neutral, sort key 3)
  return 3;
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

// Generate actionable summary for salespeople based on call category
function getSalesAdvice(
  category: 'V' | 'F' | 'L' | 'N',
  transcript: string,
  userText: string
): string {
  // For voicemail, failed, and neutral - simple messages
  if (category === 'V') {
    return "Voicemail";
  }
  if (category === 'F') {
    return "Failed";
  }
  if (category === 'N') {
    return "Neutral";
  }
  
  // Only L (Lead) gets detailed advice
  const lowerTranscript = transcript.toLowerCase();
  const lowerUserText = userText.toLowerCase();
  
  const advice: string[] = [];
  advice.push("İlgili müşteri!");
  
  // Check what they agreed to
  if (lowerTranscript.includes('zoom') || lowerTranscript.includes('q and a')) {
    advice.push("Zoom görüşmesi planlanacak.");
  }
  if (lowerUserText.includes('call me') || lowerUserText.includes('call back') || lowerUserText.includes('ara')) {
    advice.push("Geri arama istedi.");
  }
  if (lowerUserText.includes('send') || lowerUserText.includes('email') || lowerUserText.includes('whatsapp')) {
    advice.push("Bilgi gönderilmesini istedi.");
  }
  if (lowerUserText.includes('monday') || lowerUserText.includes('tuesday') || lowerUserText.includes('wednesday') || 
      lowerUserText.includes('thursday') || lowerUserText.includes('friday') || lowerUserText.includes('saturday') ||
      lowerUserText.includes('pazartesi') || lowerUserText.includes('salı') || lowerUserText.includes('çarşamba')) {
    advice.push("Belirli gün tercih etti - takvimi kontrol edin.");
  }
  if (lowerUserText.includes('morning') || lowerUserText.includes('afternoon') || lowerUserText.includes('evening') ||
      lowerUserText.includes('sabah') || lowerUserText.includes('öğleden') || lowerUserText.includes('akşam')) {
    advice.push("Saat tercihi belirtti.");
  }
  
  // If no specific action found
  if (advice.length === 1) {
    advice.push("Hızlıca takip edin ve randevu alın.");
  }
  
  return advice.join(" ");
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

  // Get proper caller name and phone display (handles swapped data)
  const callerDisplay = getCallerDisplay(call);

  // Pre-calculate valid score and summary
  const metadata = call.metadata as Record<string, unknown> | undefined;
  const endedReason = (metadata?.endedReason as string || '').toLowerCase();
  const evalSummary = (call.evaluation_summary || '').toLowerCase();
  const callSummary = (call.summary || '').toLowerCase();
  const transcript = (call.transcript || '').toLowerCase();
  
  // Get the score first (either from evaluation or estimated)
  const parsedScore = parseScore(call.evaluation_score);
  const estimatedScoreValue = estimateScore(call);
  const effectiveScore = parsedScore !== null ? parsedScore : estimatedScoreValue;
  
  // === SMART CALL CLASSIFICATION ALGORITHM ===
  
  // Voicemail system phrases (these appear in automated voicemail greetings)
  const voicemailSystemPhrases = [
    'voicemail', 'sesli mesaj',
    'record your message', 'leave a message', 'leave your message',
    'unable to take your call', 'can\'t take your call', 'can t take your call', 'cannot take your call',
    'after the tone', 'after the beep', 'at the tone', 'mailbox',
    'press hash', 'hang up', 'just hang up', 'when you re done', 'when you\'re done'
  ];
  
  // Hold/wait phrases (can appear in both voicemail AND real calls)
  const holdPhrases = ['please stay on the line', 'please hold', 'not available'];
  
  // Failed call patterns (in endedReason or summary)
  const failedPatterns = [
    'no-answer', 'customer-did-not-answer', 'busy', 'customer-busy', 'failed',
    // Turkish failed phrases  
    'ulaşılamadı', 'meşgul', 'cevap yok', 'hat meşgul',
    'bağlantı kurulamadı', 'bağlanamadı', 'aranılamadı', 'cevaplanmadı'
  ];
  
  // Meaningful user responses (indicates real conversation, not voicemail)
  const meaningfulUserPatterns = [
    'who is this', 'who are you', 'which company', 'what do you want',
    'call me', 'call back', 'another time', 'not interested', 'no thanks',
    'yes', 'no', 'okay', 'sure', 'hello', 'hi', 'what', 'why', 'how much',
    'i\'m', 'i am', 'i don\'t', 'i cant', 'i can\'t',
    // Turkish
    'kimsiniz', 'ne istiyorsunuz', 'sonra ara', 'ilgilenmiyorum', 'hayır', 'evet'
  ];
  
  const textToCheck = `${endedReason} ${evalSummary} ${callSummary}`;
  
  // Count user responses in transcript
  const userResponses = (transcript.match(/user:/gi) || []).length;
  
  // Extract what the user actually said (not the AI parts)
  // Normalize: remove punctuation for better matching
  const userParts = transcript.split(/ai:/i).filter(part => part.includes('user:'));
  const userTextRaw = userParts.map(p => p.split('user:')[1] || '').join(' ').toLowerCase();
  const userText = userTextRaw.replace(/[.,!?;:'"]/g, ' ').replace(/\s+/g, ' ');
  
  // Check if user said something meaningful (not just voicemail system)
  const userSaidMeaningful = meaningfulUserPatterns.some(p => userText.includes(p));
  const userOnlyVoicemailPhrases = voicemailSystemPhrases.some(p => userText.includes(p)) && !userSaidMeaningful;
  
  // Determine if this is a voicemail
  // It's voicemail if: voicemail phrases exist AND user didn't say anything meaningful
  const hasVoicemailPhrases = voicemailSystemPhrases.some(p => transcript.includes(p));
  const hasOnlyHoldPhrases = holdPhrases.some(p => transcript.includes(p)) && !hasVoicemailPhrases;
  
  // Key insight: Even if user responded multiple times, if they ONLY said voicemail phrases, it's still voicemail
  const isRealConversation = userSaidMeaningful; // Simplified - must say something meaningful
  
  const isVoicemail = (hasVoicemailPhrases && !isRealConversation) || 
                      (userOnlyVoicemailPhrases);
  
  // Silence timeout with short call = likely voicemail
  const isSilenceTimeout = endedReason === 'silence-timed-out';
  const isShortCall = (call.duration || 0) < 30;
  const likelyVoicemailByBehavior = isSilenceTimeout && isShortCall && !isRealConversation;
  
  // Check for explicit failed patterns
  const isFailedByText = failedPatterns.some(p => textToCheck.includes(p));
  
  // Very short call where customer hung up without engaging
  const isVeryShortCall = (call.duration || 0) < 15;
  const aiOnlySpoke = transcript.includes('ai:') && userResponses === 0;
  const customerHungUpQuickly = endedReason === 'customer-ended-call' && isVeryShortCall;
  
  // Determine call category
  const isVoicemailFinal = isVoicemail || likelyVoicemailByBehavior;
  
  // Failed call: explicit failure patterns OR no real engagement
  const isFailedCall = isFailedByText || 
    effectiveScore === 1 ||  // Explicitly scored as failed
    (customerHungUpQuickly && !isRealConversation) ||
    (aiOnlySpoke && isVeryShortCall);
  
  // Lead detection: Real conversation with positive indicators FROM USER (not AI!)
  const positiveIndicators = [
    // Interest signals - affirmative responses
    'interested', 'yes please', 'sure', 'okay', 'sounds good', 'yes i am',
    'yep', 'yeah', 'yea', 'yes', 'alright',  // Common affirmatives
    'tell me more', 'how much', 'when can', 'i want', 'i need', 'i would like',
    // Callback/contact requests
    'call me', 'call back', 'reach me', 'contact me', 'get back to me',
    'send me', 'email me', 'whatsapp', 'message me', 'text me',
    // Appointment
    'book', 'schedule', 'appointment', 'available', 'free time',
    // Turkish
    'ilgili', 'randevu', 'evet', 'tamam', 'olur', 'istiyorum', 'ara beni',
    'geri ara', 'iletişime geç', 'bilgi gönder'
  ];
  
  // Negative indicators - these should NOT be leads
  // Avoid short words that could match inside other words
  const negativeIndicators = [
    'not interested', 'no thanks', 'no thank you', 'don\'t call', 'stop calling',
    'remove me', 'wrong number', 'can\'t talk', 'not now', 'not for me',
    'i\'m busy', 'too busy', 'leave me alone',
    // Turkish
    'hayır', 'ilgilenmiyorum', 'aramayın', 'meşgulüm', 'istemiyorum'
  ];
  
  // Check positive/negative ONLY in USER's speech, not AI's
  const hasPositiveFromUser = positiveIndicators.some(p => userText.includes(p));
  const hasNegativeFromUser = negativeIndicators.some(p => userText.includes(p));
  
  // Special case: if user ONLY said "no" (very short response), it's negative
  const userWords = userText.trim().split(/\s+/).filter(w => w.length > 0);
  const onlySaidNo = userWords.length <= 2 && /\bno\b/i.test(userText) && !hasPositiveFromUser;
  const hasMinimumEngagement = isRealConversation && !isVeryShortCall;
  
  // Lead requires: engagement + positive indicators from user + NO negative indicators
  const isLead = !isVoicemailFinal && !isFailedCall && hasMinimumEngagement && 
    hasPositiveFromUser && !hasNegativeFromUser && !onlySaidNo && call.sentiment !== 'negative';
  
  // Determine what to display in score badge
  // V = Voicemail (red), F = Failed (red), L = Lead (green), N = Neutral (yellow)
  let scoreDisplay: string;
  let badgeColor: { bg: string; text: string };
  
  if (isVoicemailFinal) {
    scoreDisplay = "V";
    badgeColor = { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" };
  } else if (isFailedCall) {
    scoreDisplay = "F";
    badgeColor = { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" };
  } else if (isLead) {
    scoreDisplay = "L";
    badgeColor = { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" };
  } else {
    scoreDisplay = "N";
    badgeColor = { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" };
  }
  
  const validSummary = getValidEvaluationSummary(call.evaluation_summary);
  
  // Generate actionable sales advice based on category
  const salesAdvice = getSalesAdvice(
    scoreDisplay as 'V' | 'F' | 'L' | 'N',
    call.transcript || '',
    userText
  );

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
                {callerDisplay.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {callerDisplay.phone}
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
              {/* Score badge - V (voicemail), F (failed), L (lead), N (neutral) */}
              <span className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold",
                badgeColor.bg,
                badgeColor.text
              )}>
                {scoreDisplay}
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
              {callerDisplay.name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {callerDisplay.phone}
            </p>
          </div>
          
          {/* Score - V (voicemail), F (failed), L (lead), N (neutral) */}
          <div className="w-16 flex justify-center">
            <span className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold",
              badgeColor.bg,
              badgeColor.text
            )}>
              {scoreDisplay}
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
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Call Status</p>
              <div className="flex items-start gap-4">
                {/* Status Display - V (voicemail), F (failed), L (lead), N (neutral) */}
                <div className={cn(
                  "flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl",
                  badgeColor.bg
                )}>
                  <span className={cn("text-xl sm:text-2xl font-bold", badgeColor.text)}>
                    {scoreDisplay}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {scoreDisplay === 'V' ? "oicemail" :
                     scoreDisplay === 'F' ? "ailed" :
                     scoreDisplay === 'L' ? "ead" : "eutral"}
                  </span>
          </div>
                
                {/* Sales Advice */}
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{salesAdvice}</p>
                  
                  {/* Status label */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      badgeColor.bg,
                      badgeColor.text
                    )}>
                      {scoreDisplay === 'V' ? "Voicemail" :
                       scoreDisplay === 'F' ? "Not Reached" :
                       scoreDisplay === 'L' ? "Lead" : "Neutral"}
                    </span>
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

type SortOption = "latest" | "earliest" | "score_high" | "score_low";
  
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
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("latest");

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
            metadata: Record<string, unknown> | null;
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
            evaluation_summary: call.evaluation_summary,
              evaluation_score: parsedScore,
              tags: [],
              metadata: call.metadata || {},
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

  // Filter and sort calls
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

    // Date filter
    if (selectedDate) {
      const filterDate = parseISO(selectedDate);
      const dayStart = startOfDay(filterDate);
      const dayEnd = endOfDay(filterDate);
      filtered = filtered.filter(call => {
        const callDate = new Date(call.created_at);
        return isWithinInterval(callDate, { start: dayStart, end: dayEnd });
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "latest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "earliest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "score_high":
          // Sort by status: L (leads) first, then N, F, V
          return getCallSortKey(b) - getCallSortKey(a);
        case "score_low":
          // Sort by status: V (voicemail) first, then F, N, L
          return getCallSortKey(a) - getCallSortKey(b);
        default:
          return 0;
      }
    });
    
    setFilteredCalls(filtered);
  }, [calls, searchQuery, selectedDate, sortBy]);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <Input
            placeholder="Search calls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-gray-200 dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

        {/* Date Picker */}
        <div className="relative w-full sm:w-auto">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="pl-10 pr-3 w-full sm:w-44 border-gray-200 dark:border-gray-700 dark:bg-gray-800 [&::-webkit-calendar-picker-indicator]:dark:invert"
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
      </div>

        {/* Sort Dropdown */}
        <div className="w-full sm:w-auto">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-52 border-gray-200 dark:border-gray-700 dark:bg-gray-800">
              <ArrowUpDown className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest First</SelectItem>
              <SelectItem value="earliest">Earliest First</SelectItem>
              <SelectItem value="score_high">Highest Score</SelectItem>
              <SelectItem value="score_low">Lowest Score</SelectItem>
            </SelectContent>
          </Select>
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
