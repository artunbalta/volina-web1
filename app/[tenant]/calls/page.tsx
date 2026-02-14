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
import { useTranslation, useLanguage } from "@/lib/i18n";

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
// Score is now on 1-10 scale. V (voicemail) and F (failed) are separate categories with null score.
function parseScore(score: unknown): number | null {
  if (score === null || score === undefined) return null;
  
  // Handle string scores (from DB)
  if (typeof score === 'string') {
    const parsed = parseFloat(score);
    // Accept 1-10 scale
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      return Math.round(parsed);
    }
    // Convert old 1-5 scale to 1-10 for backward compatibility
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      return Math.round(parsed * 2);
    }
    return null;
  }
  
  // Handle number scores (1-10 scale)
  if (typeof score === 'number' && !isNaN(score) && score >= 1 && score <= 10) {
    return Math.round(score);
  }
  
  // Convert old 1-5 scale to 1-10 for backward compatibility
  if (typeof score === 'number' && !isNaN(score) && score >= 1 && score <= 5) {
    return Math.round(score * 2);
  }
  
  return null;
}

// Adjust score based on transcript/summary analysis
// This catches cases where Vapi gave wrong high scores to "not interested" or short calls
function adjustScoreBasedOnContent(
  originalScore: number,
  transcript: string,
  summary: string,
  userText: string,
  duration?: number | null
): number {
  const lowerTranscript = transcript.toLowerCase();
  const lowerSummary = summary.toLowerCase();
  const lowerUserText = userText.toLowerCase();
  const callDuration = duration || 0;
  
  // === RULE 0: Meaningless or incomplete responses (HIGHEST PRIORITY) ===
  // Check this FIRST before any other rules - these are often voicemail, wrong number, or accidental answers
  // Normalize userText again to ensure punctuation is removed
  const normalizedUserText = lowerUserText.replace(/[.,!?;:'"]/g, ' ').replace(/\s+/g, ' ').trim();
  const userWords = normalizedUserText.split(/\s+/).filter(w => w.length > 0);
  const userWordCount = userWords.length;
  
  // === RULE 0A: User never responded (no answer) ===
  // If user said absolutely nothing (0 words), this is a failed call
  // This should return null so it's displayed as "F" (Failed) not a numeric score
  if (userWordCount === 0) {
    // User never responded → this is a failed call
    // Return a very low score that will be caught by failed call detection
    // The display logic will show this as "F" (Failed)
    return 1; // Will be overridden by failed call detection to show "F"
  }
  
  // === RULE 0B: Single meaningless words ===
  if (userWordCount === 1) {
    const meaninglessSingleWords = [
      'in', 'out', 'what', 'huh', 'eh', 'uh', 'oh', 'ah', 'um', 'er', 'hm', 'hmm',
      'sorry', 'pardon', 'excuse', 'who', 'where', 'when', 'why', 'how' // Question words/sorry = confusion/wrong number
    ];
    
    // Meaningful single words that should NOT be penalized
    const meaningfulSingleWords = [
      'yes', 'yeah', 'yep', 'yea', 'no', 'ok', 'okay', 'sure', 'hello', 'hi', 'hey',
      'thanks', 'thank', 'bye', 'goodbye', 'alright', 'right', 'correct', 'wrong',
      'evet', 'hayır', 'tamam', 'merhaba', 'selam'
    ];
    
    // Check if user text is just "Sorry?" or "What?" (with or without question mark)
    // These indicate confusion/wrong number and should be treated as meaningless
    const isQuestionWord = normalizedUserText === 'sorry' || 
                          normalizedUserText === 'what' ||
                          normalizedUserText === 'pardon' ||
                          normalizedUserText === 'excuse' ||
                          normalizedUserText === 'who' ||
                          normalizedUserText === 'where' ||
                          normalizedUserText === 'when' ||
                          normalizedUserText === 'why' ||
                          normalizedUserText === 'how';
    
    const userSingleWord = normalizedUserText;
    const isMeaninglessSingleWord = (meaninglessSingleWords.includes(userSingleWord) &&
                                    !meaningfulSingleWords.includes(userSingleWord)) ||
                                    isQuestionWord;
    
    if (isMeaninglessSingleWord) {
      // Meaningless single word like "In" or "Sorry?" → very low score (2), likely voicemail or wrong number
      return 2;
    }
  }
  
  // === RULE 0B: Incomplete or meaningless short phrases (2-5 words) ===
  // Catch cases like "In zirconia, it's" or "Hi. Good morning. This is" - incomplete sentences
  if (userWordCount >= 2 && userWordCount <= 5) {
    // Check for incomplete sentences ending with contractions or incomplete phrases
    const incompleteEndings = [
      "it's", "its", "i'm", "im", "we're", "were", "they're", "theyre", "you're", "youre",
      "he's", "hes", "she's", "shes", "that's", "thats", "what's", "whats", "who's", "whos",
      "is", "this", "that", "the", "a", "an" // Incomplete sentences ending with articles/demonstratives
    ];
    
    const lastWord = userWords[userWords.length - 1];
    const endsWithIncomplete = lastWord ? incompleteEndings.includes(lastWord) : false;
    
    // Check for "this is" pattern - often indicates wrong number or interrupted call
    // Like "Hi. Good morning. This is" - incomplete introduction
    const hasThisIsPattern = normalizedUserText.includes("this is") && userWordCount <= 5;
    
    // Check for meaningless/out-of-context phrases
    const meaninglessPhrases = [
      "in zirconia", "zirconia it", "zirconia its", "zirconia", // Dental material out of context
      "what the", "what is", "who is", "where is", // Incomplete questions
      "i think", "i guess", "i mean", "i don't", "i cant", "i can't" // Incomplete thoughts
    ];
    
    const hasMeaninglessPhrase = meaninglessPhrases.some(phrase => 
      normalizedUserText.includes(phrase)
    );
    
    // Check if user text starts with "in" followed by a technical/medical term (wrong number pattern)
    // Like "in zirconia", "in titanium", "in ceramic" - these are often wrong numbers
    const startsWithInAndTechnical = normalizedUserText.startsWith("in ") && 
                                     userWordCount <= 4 &&
                                     (normalizedUserText.includes("zirconia") ||
                                      normalizedUserText.includes("titanium") ||
                                      normalizedUserText.includes("ceramic") ||
                                      normalizedUserText.includes("implant") ||
                                      normalizedUserText.includes("crown"));
    
    // If it's a very short phrase (2-3 words) that's incomplete or meaningless
    // OR starts with "in" + technical term (wrong number pattern)
    // OR has "this is" pattern (incomplete introduction)
    if ((endsWithIncomplete && userWordCount <= 3) || 
        (hasMeaninglessPhrase && userWordCount <= 4) ||
        startsWithInAndTechnical ||
        hasThisIsPattern) {
      // Incomplete or meaningless phrase → very low score (2-3)
      return Math.min(originalScore, 3);
    }
  }
  
  // === RULE 0.5: Early financial rejection check (before other rules) ===
  // Check for financial rejection early so callback request can check it
  const earlyFinancialRejectionPatterns = [
    'can\'t afford', 'cant afford', 'can t afford', 'cannot afford',
    'can\'t pay', 'cant pay', 'can t pay', 'cannot pay',
    'too expensive', 'too much',
    'param yok', 'karşılayamam', 'pahalı', 'çok pahalı'
  ];
  const hasAffordWithNegativeEarly = 
    (lowerUserText.includes('afford') && (lowerUserText.includes('can\'t') || 
     lowerUserText.includes('cannot') || lowerUserText.includes('cant') || 
     lowerUserText.includes('can t'))) ||
    (lowerSummary.includes('afford') && (lowerSummary.includes('can\'t') || 
     lowerSummary.includes('cannot') || lowerSummary.includes('cant') || 
     lowerSummary.includes('can t'))) ||
    lowerUserText.includes('can t afford') ||
    lowerSummary.includes('can\'t afford') || lowerSummary.includes('cant afford') ||
    lowerSummary.includes('cannot afford') || lowerSummary.includes('can t afford');
  
  const hasFinancialRejectionEarly = earlyFinancialRejectionPatterns.some(p => 
    lowerUserText.includes(p) || lowerSummary.includes(p)
  ) || hasAffordWithNegativeEarly;
  
  // If financial rejection, return early (this overrides everything)
  if (hasFinancialRejectionEarly) {
    if (lowerSummary.includes('not interested') && 
        (lowerSummary.includes('can\'t afford') || lowerSummary.includes('cant afford') || 
         lowerSummary.includes('cannot afford') || lowerSummary.includes('can t afford')) &&
        lowerSummary.includes('declined')) {
      return 1;
    }
    return Math.min(originalScore, 2);
  }
  
  // === RULE 0.6: Early callback request check (HIGHEST PRIORITY after financial rejection) ===
  // Check callback request early to prevent other rules from lowering the score
  // Define callback request patterns here (will be reused in RULE 3A for voicemail check)
  const callbackRequestPatterns = [
    'call me another time', 'call me later', 'call back', 'call me back',
    'possible to call me', 'can you call me', 'would you call me',
    'sonra ara', 'geri ara', 'başka zaman ara', 'daha sonra ara',
    'call me when', 'call me tomorrow', 'call me next week'
  ];
  
  // More flexible check: look for "call me" + "another time" or "later" or "back"
  const hasCallMeAnotherTime = (lowerUserText.includes('call me') && 
                                 (lowerUserText.includes('another time') || 
                                  lowerUserText.includes('later') ||
                                  lowerUserText.includes('back'))) ||
                                (lowerUserText.includes('possible') && 
                                 lowerUserText.includes('call me')) ||
                                // "Possible to call me another time" - exact pattern
                                (lowerUserText.includes('possible') && 
                                 lowerUserText.includes('call me') && 
                                 lowerUserText.includes('another time')) ||
                                // "possible to call me" - even without "another time"
                                (lowerUserText.includes('possible to call me')) ||
                                // Very flexible: "possible" + "call" + "another time" (words can be separated)
                                (lowerUserText.includes('possible') && 
                                 lowerUserText.includes('call') && 
                                 lowerUserText.includes('another time')) ||
                                // Even more flexible: "possible" anywhere + "call me" + "another time"
                                (lowerUserText.includes('possible') && 
                                 (lowerUserText.includes('call me') || lowerUserText.includes('call')) && 
                                 lowerUserText.includes('another time'));
  
  const hasCallbackRequest = callbackRequestPatterns.some(p => 
    lowerUserText.includes(p) || lowerSummary.includes(p)
  ) || hasCallMeAnotherTime;
  
  // Also check summary for callback indicators
  const summaryHasCallbackRequest = lowerSummary.includes('call back') ||
                                    lowerSummary.includes('callback') ||
                                    (lowerSummary.includes('call me') && lowerSummary.includes('another time')) ||
                                    (lowerSummary.includes('call') && lowerSummary.includes('another time'));
  
  if (hasCallbackRequest || summaryHasCallbackRequest) {
    // Callback request → this is positive engagement, maintain higher score (8)
    // User wants to be called back = interested but not available now = high-value lead
    // Return immediately to prevent other rules from lowering the score
    return Math.max(originalScore, 8);
  }
  
  // === RULE 1: Very short calls should never get high scores ===
  // If call is under 15 seconds → max score 2
  if (callDuration > 0 && callDuration < 15) {
    return Math.min(originalScore, 2);
  }
  
  // If call is under 20 seconds and score > 4, cap it
  if (callDuration > 0 && callDuration < 20 && originalScore > 4) {
    return Math.min(originalScore, 4);
  }
  
  // If call is under 30 seconds and score > 6, cap it
  if (callDuration > 0 && callDuration < 30 && originalScore > 6) {
    return Math.min(originalScore, 5);
  }
  
  // === RULE 2: User barely spoke - can't be a great call ===
  // Note: userWords and userWordCount already calculated in RULE 0 above
  
  // User said almost nothing (0-3 words like "Hello?" or "Hi")
  if (userWordCount <= 3) {
    return Math.min(originalScore, 3);
  }
  
  // Check for strong positive engagement BEFORE applying word count penalties
  // This ensures cases like "Yeah. Yeah." maintain high score even with fewer words
  const earlyPositiveCheck = (lowerUserText.match(/\b(yeah|yes|yep|yea)\b/g) || []).length >= 2;
  const earlySummaryInterest = lowerSummary.includes('considering') || 
                               lowerSummary.includes('interested') ||
                               lowerSummary.includes('open to');
  
  // If strong positive engagement detected, skip word count penalties
  const hasStrongEarlyPositive = earlyPositiveCheck || 
                                 (earlySummaryInterest && lowerUserText.includes('yeah'));
  
  // User said very little (4-10 words) - can't be highly successful
  // BUT: Skip if strong positive engagement (e.g., "Yeah. Yeah.")
  if (userWordCount <= 10 && originalScore > 6 && !hasStrongEarlyPositive) {
    return Math.min(originalScore, 5);
  }
  
  // User said little (11-20 words) - can't be very successful
  // BUT: Skip if strong positive engagement (e.g., "Yeah. Yeah." + "considering")
  if (userWordCount <= 20 && originalScore > 7 && !hasStrongEarlyPositive) {
    return Math.min(originalScore, 6);
  }
  
  // === RULE 3: Summary indicates premature end or immediate hang up ===
  const prematureEndPatterns = [
    'ended prematurely', 'ended immediately', 'ended before',
    'call ended', 'hung up', 'disconnected',
    'incomplete', 'undetermined', 'no next step',
    'before meaningful', 'before any discussion',
    'cut short', 'abruptly ended', 'quickly ended'
  ];
  const summaryIndicatesPrematureEnd = prematureEndPatterns.some(p => lowerSummary.includes(p));
  
  if (summaryIndicatesPrematureEnd && originalScore > 4) {
    return Math.min(originalScore, 4);
  }
  
  // === RULE 3A: hasCallbackRequest was already defined in RULE 0.6 ===
  // It's used here for voicemail check (to skip voicemail if callback request exists)
  
  // === RULE 3B: Check if this is actually a voicemail (before unavailable check) ===
  // Voicemail indicators: automated messages, "can't take your call", "leave a message", phone numbers only
  const voicemailIndicators = [
    'can\'t take your call', 'can\'t take call', 'can\'t take the call',
    'please leave a message', 'leave a message', 'leave your message', 'after the beep',
    'after the tone', 'at the tone', // Voicemail tone indicators
    'unavailable to take your call', 'not available to take your call',
    'mesaj bırakın', 'bip sesinden sonra', 'sesli mesaj bırakın',
    'please stay on the line', 'stay on the line', // Voicemail system phrases (but skip if callback request)
    'is on another line', 'on another line', // "Is on another line. Just leave your message after the tone."
    'available' // Single word "Available" is often voicemail greeting
  ];
  
  // Check if user text contains phone number + voicemail phrase (typical voicemail pattern)
  // More flexible pattern: looks for digits followed by voicemail phrases anywhere in user text
  // Also check for normalized variations (can't -> can t, can't -> cant)
  const phoneNumberPattern1 = /[\d\s\.\-\(\)]{3,}(can\'t take|can t take|can t take|leave|message|unavailable|voicemail|right now)/i;
  const phoneNumberPattern2 = /[\d\s\.\-\(\)]{3,}(cant take|leave|message|unavailable|voicemail|right now)/i;
  const isPhoneNumberPattern = phoneNumberPattern1.test(userText) || phoneNumberPattern2.test(userText);
  
  const hasVoicemailPhrase = voicemailIndicators.some(p => 
    lowerUserText.includes(p) || 
    lowerSummary.includes(p) ||
    lowerUserText.includes(p.replace("'", " ")) || // Handle "can't" -> "can t"
    lowerUserText.includes(p.replace("'", ""))     // Handle "can't" -> "cant"
  );
  
  // Special case: "Available" alone (1 word) is typically voicemail greeting
  // This catches cases like Lewis Brown: "Available" + "Please stay on the line"
  const isOnlyAvailable = userWordCount === 1 && lowerUserText.trim() === 'available';
  
  // Check for positive engagement (yeah, yes, etc.) - if user showed engagement, it's not voicemail
  // Use different variable name to avoid conflict with later hasPositiveEngagement
  const hasPositiveEngagementForVoicemail = lowerUserText.includes('yeah') ||
                                            lowerUserText.includes('yes') ||
                                            lowerUserText.includes('yep') ||
                                            lowerUserText.includes('yea') ||
                                            lowerUserText.includes('sure') ||
                                            lowerUserText.includes('okay') ||
                                            lowerUserText.includes('ok') ||
                                            lowerSummary.includes('interested') ||
                                            lowerSummary.includes('considering');
  
  // "Available" + "Please stay on the line" is voicemail ONLY if no positive engagement
  // If user said "Yeah. Yeah." or showed interest, it's a real conversation, not voicemail
  const hasAvailableAndStayOnLine = lowerUserText.includes('available') && 
                                    (lowerUserText.includes('stay on the line') || 
                                     lowerUserText.includes('please stay')) &&
                                    !hasPositiveEngagementForVoicemail; // Skip if positive engagement exists
  
  // Special case: "Is on another line. Just leave your message after the tone."
  // This is a classic voicemail pattern
  const hasAnotherLineAndLeaveMessage = (lowerUserText.includes('is on another line') || 
                                        lowerUserText.includes('on another line')) &&
                                       (lowerUserText.includes('leave your message') ||
                                        lowerUserText.includes('leave a message') ||
                                        lowerUserText.includes('after the tone') ||
                                        lowerUserText.includes('after the beep'));
  
  // Special case: "Just leave your message after the tone" (even with "No" at the start)
  // This is a classic voicemail pattern - "No. Just leave your message after the tone."
  const hasJustLeaveMessageAfterTone = (lowerUserText.includes('just leave') || 
                                        lowerUserText.includes('leave your message')) &&
                                       (lowerUserText.includes('after the tone') ||
                                        lowerUserText.includes('after the beep') ||
                                        lowerUserText.includes('at the tone'));
  
  // If it looks like voicemail (phone number + voicemail phrase, or just voicemail phrase with minimal engagement)
  // Increased word count threshold to 25 to catch cases like "3 7 0 8 4 9 3 can't take your call right now"
  // Also catch "Available" + "Please stay on the line" pattern (Lewis Brown case)
  // Also catch "Is on another line. Just leave your message after the tone." pattern
  // Also catch "Just leave your message after the tone" pattern (even with "No" at start)
  // BUT: Skip if callback request exists (user wants to be called back, not voicemail)
  // BUT: Skip "Available" + "Please stay on the line" if positive engagement exists
  if (!hasCallbackRequest && (isPhoneNumberPattern || 
      (hasVoicemailPhrase && userWordCount <= 25) ||
      isOnlyAvailable ||
      hasAvailableAndStayOnLine ||
      hasAnotherLineAndLeaveMessage ||
      hasJustLeaveMessageAfterTone)) {
    // This is likely voicemail - return very low score
    // The voicemail detection in display logic will catch this and show "V"
    return 1; // Will be overridden by voicemail detection
  }
  
  // === RULE 3C: User unavailable/unreachable (can't take call, busy, in meeting) ===
  // BUT: Skip if callback request exists (user wants to be called back, not unavailable)
  const unavailablePatterns = [
    'can\'t talk', 'can\'t speak',
    'unavailable', 'unreachable', 'not available', 'busy right now',
    'in a meeting', 'in meeting', 'can\'t talk now', 'can\'t speak now',
    'not right now', 'later', 'call back later',
    'müsait değilim', 'konuşamam', 'aramayın', 'sonra ara'
    // Note: 'call me later' removed - it's handled as callback request
  ];
  
  const userUnavailable = 
    unavailablePatterns.some(p => lowerUserText.includes(p)) ||
    unavailablePatterns.some(p => lowerSummary.includes(p)) ||
    (lowerSummary.includes('unavailable') && !hasVoicemailPhrase) ||
    (lowerSummary.includes('unreachable') && !hasVoicemailPhrase);
  
  // Skip unavailable check if callback request exists (user wants callback, not unavailable)
  if (userUnavailable && !hasVoicemailPhrase && !hasCallbackRequest) {
    // User explicitly said they can't take the call → this is a failed connection, score 1-2
    return Math.min(originalScore, 2);
  }
  
  // === RULE 4: Strong negative indicators in user's speech ===
  // Note: "call me later" is NOT here - it's handled as callback request in RULE 4.3
  const strongNegativePatterns = [
    'not interested', 'no thanks', 'no thank you', 'don\'t want',
    'not for me', 'don\'t need', 'no need', 'i\'m not',
    'ilgilenmiyorum', 'istemiyorum', 'hayır teşekkürler',
    'hayır', 'yok', 'gerek yok', 'istemedim', 'istemiş değilim',
    'no i don\'t', 'i don\'t want', 'i\'m not interested',
    'not right now', 'maybe later',
    // Financial rejection - very strong negative indicator
    'can\'t afford', 'cant afford', 'can t afford', 'cannot afford',
    'can\'t pay', 'cant pay', 'can t pay', 'cannot pay',
    'too expensive', 'too much', 'afford', 'expensive',
    'param yok', 'karşılayamam', 'pahalı', 'çok pahalı'
  ];
  
  const userDeclined = strongNegativePatterns.some(p => lowerUserText.includes(p));
  
  // Financial rejection was already checked in RULE 0.5 (early check)
  // Use the early check result
  const hasFinancialRejection = hasFinancialRejectionEarly;
  
  // === RULE 4.5: Check for aggressive/hostile language FIRST (before other rules) ===
  // This catches cases like "That's fucking mental" which should be score 1-2
  const aggressivePatterns = [
    'fucking', 'fuck', 'mental', 'crazy', 'ridiculous', 'stupid', 'annoying',
    'that\'s mental', 'that\'s crazy', 'that\'s ridiculous', 'that\'s stupid',
    'what the hell', 'what the fuck', 'are you kidding', 'are you serious',
    'rahatsız ediyorsunuz', 'sinir bozucu', 'saçma', 'aptal'
  ];
  const hasAggressiveLanguage = aggressivePatterns.some(p => lowerUserText.includes(p));
  
  // Check summary for strong negative sentiment indicators
  const strongNegativeSentiment = 
    lowerSummary.includes('strong negative sentiment') ||
    lowerSummary.includes('annoyed') ||
    lowerSummary.includes('frustrated') ||
    lowerSummary.includes('angry') ||
    lowerSummary.includes('irritated') ||
    lowerSummary.includes('aggressive') ||
    lowerSummary.includes('hostile') ||
    lowerSummary.includes('rude') ||
    (lowerSummary.includes('negative') && lowerSummary.includes('sentiment')) ||
    (lowerSummary.includes('not interested') && lowerSummary.includes('strong'));
  
  // If aggressive language or strong negative sentiment → score 1-2 (highest priority)
  if (hasAggressiveLanguage || strongNegativeSentiment) {
    return Math.min(originalScore, 2);
  }
  
  // === RULE 5: Summary indicates not interested ===
  // BUT: Check for positive engagement first (e.g., "Yeah. Yeah." before "declined")
  const summaryIndicatesNotInterested = 
    lowerSummary.includes('not interested') ||
    lowerSummary.includes('declined') ||
    lowerSummary.includes('refused') ||
    lowerSummary.includes('rejected') ||
    lowerSummary.includes('ilgilenmedi') ||
    lowerSummary.includes('reddetti') ||
    lowerSummary.includes('declined') ||
    lowerSummary.includes('said no') ||
    lowerSummary.includes('not want') ||
    lowerSummary.includes('explicitly stated "no"') ||
    lowerSummary.includes('repeatedly declined') ||
    lowerSummary.includes('denied') ||
    lowerSummary.includes('lack of interest') ||
    // Financial rejection in summary - very strong negative indicator
    (lowerSummary.includes('can\'t afford') || lowerSummary.includes('cant afford') || 
     lowerSummary.includes('cannot afford') || lowerSummary.includes('can t afford')) ||
    (lowerSummary.includes('afford') && (lowerSummary.includes('can\'t') || lowerSummary.includes('cannot')));
  
  // Check for positive engagement patterns BEFORE applying decline rules
  // BUT: Skip if financial rejection detected (can't afford overrides everything)
  // This ensures cases like "Yeah. Yeah." followed by "No. I'm alright" maintain high score
  // BUT: "can't afford" is definitive rejection, even if they said "thanks" or "yeah"
  const positiveEngagementPatterns = [
    'yeah', 'yes', 'yep', 'yea', 'sure', 'okay', 'interested', 'considering',
    'i want', 'i need', 'i\'d like', 'i would like', 'tell me', 'explain',
    'i said yes', 'said yes', 'i said yeah', 'said yeah', // Explicit confirmations like "Yes. I said yes."
    'for how much', 'how much', 'what\'s the price', 'whats the price', 'what is the price', // Price questions show interest
    'how much does it cost', 'how much is it', 'what does it cost', // More price questions
    'if i\'m interested', 'if im interested', 'if i am interested', // "If I'm interested?" shows engagement
    'what should i do', 'what do i do', 'what should i do if', // "What should I do if I'm interested?" shows engagement
    'i\'m interested', 'im interested', 'i am interested', // Direct interest statements
    'i\'m in town', 'im in town', 'i am in town', // "I'm in town now" shows availability/interest
    'all good', 'it\'s all good', 'its all good' // "It's all good" shows positive engagement
  ];
  const hasPositiveEngagement = positiveEngagementPatterns.some(p => lowerUserText.includes(p));
  const multipleYeah = (lowerUserText.match(/\b(yeah|yes|yep|yea)\b/g) || []).length >= 2;
  
  // Check for explicit "I said yes/yeah" - very strong positive signal
  const hasExplicitConfirmation = lowerUserText.includes('i said yes') || 
                                  lowerUserText.includes('said yes') ||
                                  lowerUserText.includes('i said yeah') ||
                                  lowerUserText.includes('said yeah');
  
  // Check for price questions - shows strong interest
  const hasPriceQuestion = lowerUserText.includes('how much') ||
                          lowerUserText.includes('for how much') ||
                          lowerUserText.includes('what\'s the price') ||
                          lowerUserText.includes('whats the price') ||
                          lowerUserText.includes('what is the price') ||
                          lowerUserText.includes('how much does') ||
                          lowerUserText.includes('how much is') ||
                          lowerUserText.includes('what does it cost');
  
  // Check for "what should I do" or "if I'm interested" - shows engagement
  const hasEngagementQuestion = lowerUserText.includes('what should i do') ||
                                lowerUserText.includes('what do i do') ||
                                lowerUserText.includes('if i\'m interested') ||
                                lowerUserText.includes('if im interested') ||
                                lowerUserText.includes('if i am interested');
  
  const summaryShowsInterest = lowerSummary.includes('considering') || 
                                lowerSummary.includes('interested') ||
                                lowerSummary.includes('open to');
  
  // PRIORITY: Strong positive engagement indicators (explicit confirmations, price questions, engagement questions)
  // These should get high scores (8-9) even without summary confirmation
  // BUT: Skip if financial rejection (can't afford) - that overrides everything
  if (!hasFinancialRejection && (hasExplicitConfirmation || hasPriceQuestion || hasEngagementQuestion)) {
    // "Yes. I said yes." or "For how much?" or "If I'm interested?" → very strong engagement
    // If multiple strong signals exist, boost score even higher
    const strongSignalCount = (hasExplicitConfirmation ? 1 : 0) + 
                             (hasPriceQuestion ? 1 : 0) + 
                             (hasEngagementQuestion ? 1 : 0);
    
    if (hasExplicitConfirmation || (hasPriceQuestion && hasPositiveEngagement)) {
      // Explicit confirmation OR price question + positive engagement → maintain 8-9
      // If multiple signals, boost to 9
      if (strongSignalCount >= 2) {
        return Math.max(originalScore, 9);
      }
      return Math.max(originalScore, 8);
    } else if (hasPriceQuestion || hasEngagementQuestion) {
      // Price question or engagement question → maintain 7-8
      // If both exist, boost to 8
      if (hasPriceQuestion && hasEngagementQuestion) {
        return Math.max(originalScore, 8);
      }
      return Math.max(originalScore, 7);
    }
  }
  
  // PRIORITY: If summary says "considering" AND user said "yeah/yes", 
  // this is STRONG positive engagement - maintain high score (8-10) even if "declined" appears
  // BUT: Skip if financial rejection (can't afford) - that overrides everything
  // This catches cases like Jordan Dowson: "Considering dental treatment" + "Yeah. Yeah." + "declined offer"
  // BUT: Jason Jenkins: "can't afford" → score 1-2, even if they said "thanks"
  if (!hasFinancialRejection && summaryShowsInterest && (multipleYeah || hasPositiveEngagement)) {
    // Summary shows interest AND user confirmed with "yeah/yes" → this is high-value lead
    // Even if they declined a specific offer, they're still considering → score 8-10
    if (multipleYeah && summaryShowsInterest) {
      // Multiple "yeah" + "considering" in summary → maintain 9-10
      return Math.max(originalScore, 9);
    } else if (hasPositiveEngagement && summaryShowsInterest) {
      // Positive engagement + "considering" → maintain 8-9
      return Math.max(originalScore, 8);
    }
  }
  
  // If user showed strong positive engagement (e.g., "Yeah. Yeah.", "Yes. I said yes.", price questions), 
  // don't penalize for summary saying "declined" or early "no" - they showed interest later
  // BUT: Skip if financial rejection (can't afford) - that overrides everything
  // This catches cases like: "No. Of course, not." followed by "Yes. I said yes." and "For how much?"
  if (!hasFinancialRejection && 
      (hasPositiveEngagement || multipleYeah || summaryShowsInterest || 
       hasExplicitConfirmation || hasPriceQuestion || hasEngagementQuestion) && 
      (userDeclined || summaryIndicatesNotInterested)) {
    // User showed interest later (even after early "no") - this is still positive engagement
    // Don't drop score below 7-8 if they showed strong interest later
    if (hasExplicitConfirmation || hasPriceQuestion || multipleYeah || 
        (hasPositiveEngagement && summaryShowsInterest)) {
      // Explicit confirmation, price question, or strong positive signals → maintain 7-8
      return Math.max(originalScore, 7);
    } else if (hasPositiveEngagement || hasEngagementQuestion || summaryShowsInterest) {
      // Some positive engagement → maintain 6-7
      return Math.max(originalScore, 6);
    }
  }
  
  // If user declined or summary indicates not interested (and no strong positive engagement) → MAX score 4
  // If summary explicitly says "not interested" → MAX score 3
  // BUT: Skip if callback request exists (user wants callback, not declined)
  if ((userDeclined || summaryIndicatesNotInterested) && !hasCallbackRequest) {
    if (lowerSummary.includes('not interested') && lowerSummary.includes('explicitly')) {
      return Math.min(originalScore, 3);
    }
    return Math.min(originalScore, 4);
  }
  
  // === RULE 6: User said "no" - but check if they changed their mind ===
  const noCount = (lowerUserText.match(/\bno\b/g) || []).length;
  const hayirCount = (lowerUserText.match(/\bhayır\b/g) || []).length;
  const totalNoCount = noCount + hayirCount;
  
  // Check for explicit "I said no" or similar strong rejections
  const explicitRejection = 
    lowerUserText.includes('i said no') ||
    lowerUserText.includes('i told you no') ||
    lowerUserText.includes('i already said no') ||
    lowerUserText.includes('dedim hayır') ||
    lowerUserText.includes('söyledim hayır');
  
  // === RULE 6A: Long detailed conversations with concerns/questions (HIGH PRIORITY) ===
  // If user had a long conversation (50+ words) and explained concerns or asked questions,
  // this is valuable engagement even if they said "no"
  // This catches cases where user is interested but has concerns (e.g., guarantee, bone structure)
  const isLongDetailedConversation = userWordCount >= 50;
  const hasDetailedConcerns = lowerUserText.includes('guarantee') ||
                              lowerUserText.includes('warranty') ||
                              lowerUserText.includes('bone') ||
                              lowerUserText.includes('gum') ||
                              lowerUserText.includes('implant') ||
                              lowerUserText.includes('concern') ||
                              lowerUserText.includes('worry') ||
                              lowerUserText.includes('endise') ||
                              lowerUserText.includes('garanti');
  const hasAskedQuestions = lowerUserText.includes('what company') ||
                            lowerUserText.includes('what is') ||
                            lowerUserText.includes('how') ||
                            lowerUserText.includes('why') ||
                            lowerUserText.includes('when') ||
                            lowerUserText.includes('where') ||
                            lowerUserText.includes('ne zaman') ||
                            lowerUserText.includes('nasıl') ||
                            lowerUserText.includes('neden');
  const hasPreviousEngagement = lowerUserText.includes('already had') ||
                               lowerUserText.includes('already got') ||
                               lowerUserText.includes('quotation') ||
                               lowerUserText.includes('quote') ||
                               lowerUserText.includes('teklif');
  
  // If long conversation with concerns/questions/previous engagement, this is valuable even with "no"
  if (isLongDetailedConversation && 
      (hasDetailedConcerns || hasAskedQuestions || hasPreviousEngagement) &&
      !hasFinancialRejection && 
      !explicitRejection) {
    // Long detailed conversation with concerns/questions → this is valuable engagement (5-6)
    // User is interested but has concerns - this is still a good lead
    return Math.max(originalScore, 5);
  }
  
  // Strong positive engagement patterns (even after initial "no")
  // Include "yeah" variations as they indicate agreement/interest
  const strongPositivePatterns = [
    'i\'m gonna hear', 'i\'ll hear', 'tell me more', 'explain', 'i want to hear',
    'i\'d like to', 'i would like', 'sure', 'yes', 'okay', 'yeah', 'yea', 'yep',
    'interested', 'i need', 'i want', 'solution', 'help me',
    'dinleyeceğim', 'anlat', 'açıkla', 'istiyorum', 'ihtiyacım var',
    'open to', 'considering', 'finding a solution', 'would be grateful',
    'yeah yeah', 'yes yes', 'yeah i', 'yes i' // Multiple affirmatives show stronger interest
  ];
  
  const hasStrongPositive = strongPositivePatterns.some(p => lowerUserText.includes(p));
  
  // Check summary for positive indicators (even if user said "no" initially)
  const summaryPositiveIndicators = 
    lowerSummary.includes('open to hearing') ||
    lowerSummary.includes('open to') ||
    lowerSummary.includes('considering') ||
    lowerSummary.includes('finding a solution') ||
    lowerSummary.includes('wants to hear') ||
    lowerSummary.includes('interested in learning') ||
    lowerSummary.includes('changed their mind');
  
  // If user has strong positive engagement (even if they said "no" later), BOOST the score
  // This catches cases like "Yeah. Yeah." followed by "No. I'm alright. I got..." (incomplete rejection)
  // BUT: Skip if financial rejection detected (can't afford overrides everything)
  // Jason Jenkins: "can't afford" → score 1-2, even if they said "thanks"
  if (!hasFinancialRejection && (hasStrongPositive || summaryPositiveIndicators) && totalNoCount <= 3 && !explicitRejection) {
    // User showed interest (e.g., "Yeah. Yeah.") - this is positive engagement
    // Even if they later said "no", if they showed strong interest first, maintain higher score
    if (hasStrongPositive && summaryPositiveIndicators) {
      // Both transcript and summary show positive engagement → boost to 8-9
      return Math.max(originalScore, 8);
    } else if (hasStrongPositive) {
      // Strong positive in transcript (e.g., "Yeah. Yeah.") → boost to 7-8
      // This ensures cases like Jordan Dowson maintain high score despite later "no"
      return Math.max(originalScore, 7);
    } else if (summaryPositiveIndicators) {
      // Summary shows positive engagement → boost to 6-7
      return Math.max(originalScore, 6);
    }
  }
  
  // Special case: If user said "yeah" or "yes" multiple times (strong affirmation), 
  // even a single "no" later shouldn't drop the score too much
  // BUT: Skip if financial rejection detected (can't afford overrides everything)
  if (!hasFinancialRejection) {
    const yeahCount = (lowerUserText.match(/\b(yeah|yes|yep|yea)\b/g) || []).length;
    if (yeahCount >= 2 && totalNoCount <= 1 && !explicitRejection && originalScore >= 7) {
      // Multiple "yeah/yes" shows strong interest - maintain high score (8-10)
      return Math.max(originalScore, 8);
    }
  }
  
  // If user said "no" 3+ times or explicitly rejected, check for positive engagement
  const userOnlySaidNo = totalNoCount >= 3 || explicitRejection || (totalNoCount >= 2 && userWordCount <= 15);
  
  if (userOnlySaidNo && originalScore > 4) {
    const positivePatterns = [
      'yes', 'sure', 'okay', 'interested', 'tell me', 'how much', 
      'when', 'where', 'evet', 'tamam', 'olur', 'anlat', 'ne kadar',
      'ne zaman', 'nerede', 'bilgi', 'detay', 'fiyat', 'maybe', 'belki',
      'i want', 'i need', 'istiyorum', 'i\'d like', 'i would like',
      'i\'m gonna hear', 'i\'ll hear', 'tell me more', 'explain', 'open to'
    ];
    const hasPositive = positivePatterns.some(p => lowerUserText.includes(p));
    
    // If explicit rejection or 3+ "no" without positive engagement → max 4
    if (explicitRejection || (totalNoCount >= 3 && !hasPositive)) {
      return Math.min(originalScore, 4);
    }
    
    // If 2+ "no" without positive engagement → max 5
    if (!hasPositive) {
      return Math.min(originalScore, 5);
    }
  }
  
  // === RULE 7: Only "hello" or greeting - not a real conversation ===
  const onlyGreeting = userWordCount <= 2 && 
    (lowerUserText.includes('hello') || lowerUserText.includes('hi') || 
     lowerUserText.includes('hey') || lowerUserText.includes('merhaba') ||
     lowerUserText.includes('alo') || lowerUserText.includes('efendim'));
  if (onlyGreeting) {
    return Math.min(originalScore, 3);
  }
  
  // === RULE 8: Check for wrong number or confusion ===
  const wrongNumberPatterns = [
    'wrong number', 'yanlış numara', 'wrong person', 'yanlış kişi',
    'who is this', 'kimsiniz', 'tanımıyorum', 'don\'t know'
  ];
  const isWrongNumber = wrongNumberPatterns.some(p => lowerUserText.includes(p) || lowerSummary.includes(p));
  if (isWrongNumber) {
    return Math.min(originalScore, 2);
  }
  
  // === RULE 9: Check for hostile or rude responses (non-aggressive) ===
  // Note: Aggressive language is already handled in RULE 4.5 above
  const hostilePatterns = [
    'stop calling', 'don\'t call', 'remove me', 'unsubscribe',
    'aramayın', 'arama', 'rahatsız etmeyin', 'kaldır beni'
  ];
  const isHostile = hostilePatterns.some(p => lowerUserText.includes(p) || lowerSummary.includes(p));
  
  if (isHostile) {
    // Hostile response → score 1-2
    return Math.min(originalScore, 2);
  }
  
  // === RULE 10: Check for minimal engagement despite longer duration ===
  // If call was longer but user said very little, it might be AI doing most talking
  if (callDuration > 30 && userWordCount <= 15 && originalScore > 6) {
    return Math.min(originalScore, 5);
  }
  
  return originalScore;
}

// Estimate a score based on call properties when no score is available (1-10 scale)
// Returns null for V (voicemail) and F (failed) cases - these are separate categories
function estimateScore(call: Call): number | null {
  const duration = call.duration || 0;
  const sentiment = call.sentiment;
  const hasTranscript = !!call.transcript;
  const metadata = call.metadata as Record<string, unknown> | undefined;
  const endedReason = metadata?.endedReason as string | undefined;
  
  // Check ended reason for special cases - V and F don't get numeric scores
  if (endedReason) {
    const reason = endedReason.toLowerCase();
    // These will be shown as V or F, not a number
    if (reason.includes('no-answer') || reason.includes('customer-did-not-answer')) {
      return null; // Will be displayed as F
    }
    if (reason.includes('voicemail')) {
      return null; // Will be displayed as V
    }
    if (reason.includes('busy')) {
      return null; // Will be displayed as F
    }
  }
  
  // No transcript and very short call = likely failed (F)
  if (!hasTranscript && duration < 10) {
    return null; // Will be displayed as F
  }
  
  // Base score starts at 5-6 (neutral conversation on 1-10 scale)
  let score = 5.5;
  
  // Adjust based on sentiment
  if (sentiment === 'positive') {
    score += 2;
  } else if (sentiment === 'negative') {
    score -= 2;
  }
  
  // Adjust based on duration (longer calls are usually better)
  if (duration > 180) { // > 3 minutes
    score += 1.5;
  } else if (duration > 60) { // > 1 minute
    score += 0.5;
  } else if (duration < 30) { // < 30 seconds
    score -= 1;
  }
  
  // Clamp between 1 and 10
  return Math.max(1, Math.min(10, Math.round(score)));
}

// Helper function to get sort key for calls - MUST match display logic exactly
// Returns: 1 = V (voicemail), 2 = F (failed), then 3-12 based on 1-10 score (inverted for high scores first)
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
    'can\'t take call right now', 'can\'t take your call right now', 'can\'t take the call right now',
    'after the tone', 'after the beep', 'at the tone', 'mailbox',
    'press hash', 'hang up', 'just hang up', 'when you re done', 'when you\'re done',
    'please stay on the line', 'stay on the line' // Voicemail system phrases
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
  
  // Check for phone number pattern + voicemail phrase (e.g., "370 8493 can't take your call right now")
  // More flexible pattern: looks for digits followed by voicemail phrases anywhere in user text
  // Check both normalized text (can't -> can t) and original text
  // Pattern variations: "can't take", "can t take", "cant take"
  const phoneNumberVoicemailPattern1 = /[\d\s\.\-\(\)]{3,}(can\'t take|can t take|leave|message|unavailable|voicemail|right now)/i;
  const phoneNumberVoicemailPattern2 = /[\d\s\.\-\(\)]{3,}(cant take|leave|message|unavailable|voicemail|right now)/i;
  
  // Also check transcript directly for more reliable detection
  const transcriptLower = transcript.toLowerCase();
  const isPhoneNumberVoicemail = phoneNumberVoicemailPattern1.test(userText) || 
                                  phoneNumberVoicemailPattern2.test(userText) ||
                                  phoneNumberVoicemailPattern1.test(userTextRaw) ||
                                  phoneNumberVoicemailPattern2.test(userTextRaw) ||
                                  phoneNumberVoicemailPattern1.test(transcriptLower) ||
                                  phoneNumberVoicemailPattern2.test(transcriptLower);
  
  // Also check if user text contains voicemail phrases (normalized or original)
  // Handle variations: "can't" -> "can t" or "cant"
  const hasVoicemailInUserText = voicemailSystemPhrases.some(p => {
    const normalized = p.replace(/'/g, ' ').replace(/\s+/g, ' '); // "can't" -> "can t"
    const noApostrophe = p.replace(/'/g, ''); // "can't" -> "cant"
    return userText.includes(p) || 
           userTextRaw.includes(p) ||
           userText.includes(normalized) ||
           userText.includes(noApostrophe) ||
           userTextRaw.includes(normalized) ||
           userTextRaw.includes(noApostrophe);
  });
  
  const userOnlyVoicemailPhrases = (hasVoicemailInUserText || isPhoneNumberVoicemail) && !userSaidMeaningful;
  
  // Special case: "Available" + "Please stay on the line" pattern (Lewis Brown case)
  // This is a typical voicemail greeting pattern
  const userWords = userText.trim().split(/\s+/).filter(w => w.length > 0);
  const userWordCount = userWords.length;
  const isOnlyAvailable = userWordCount === 1 && userText.trim() === 'available';
  
  // Check for positive engagement (yeah, yes, etc.) - if user showed engagement, it's not voicemail
  const hasPositiveEngagement = userText.toLowerCase().includes('yeah') ||
                                userText.toLowerCase().includes('yes') ||
                                userText.toLowerCase().includes('yep') ||
                                userText.toLowerCase().includes('yea') ||
                                userText.toLowerCase().includes('sure') ||
                                userText.toLowerCase().includes('okay') ||
                                userText.toLowerCase().includes('ok');
  
  // "Available" + "Please stay on the line" is voicemail ONLY if no positive engagement
  // If user said "Yeah. Yeah." or showed interest, it's a real conversation, not voicemail
  const hasAvailableAndStayOnLine = userText.includes('available') && 
                                    (userText.includes('stay on the line') || 
                                     userText.includes('please stay')) &&
                                    !hasPositiveEngagement; // Skip if positive engagement exists
  
  // Special case: "Is on another line. Just leave your message after the tone."
  // This is a classic voicemail pattern
  const hasAnotherLineAndLeaveMessage = (userText.includes('is on another line') || 
                                        userText.includes('on another line')) &&
                                       (userText.includes('leave your message') ||
                                        userText.includes('leave a message') ||
                                        userText.includes('after the tone') ||
                                        userText.includes('after the beep'));
  
  // Special case: "Just leave your message after the tone" (even with "No" at the start)
  // This is a classic voicemail pattern - "No. Just leave your message after the tone."
  const hasJustLeaveMessageAfterTone = (userText.toLowerCase().includes('just leave') || 
                                        userText.toLowerCase().includes('leave your message')) &&
                                       (userText.toLowerCase().includes('after the tone') ||
                                        userText.toLowerCase().includes('after the beep') ||
                                        userText.toLowerCase().includes('at the tone'));
  
  const hasVoicemailPhrases = voicemailSystemPhrases.some(p => transcript.includes(p));
  // Key change: even if userResponses >= 2, if user ONLY said voicemail phrases, it's still voicemail
  const isRealConversation = userSaidMeaningful; // Simplified - must say something meaningful
  
  // Voicemail detection - MUST match display logic
  // Also catch "Available" + "Please stay on the line" pattern (Lewis Brown case)
  // Also catch "Is on another line. Just leave your message after the tone." pattern
  // Also catch "Just leave your message after the tone" pattern (even with "No" at start)
  const isVoicemail = (hasVoicemailPhrases && !isRealConversation) || 
                      (userOnlyVoicemailPhrases) ||
                      isPhoneNumberVoicemail ||
                      isOnlyAvailable ||  // Single word "Available" is voicemail greeting
                      hasAvailableAndStayOnLine ||  // "Available" + "Please stay on the line" pattern
                      hasAnotherLineAndLeaveMessage ||  // "Is on another line. Just leave your message after the tone." pattern
                      hasJustLeaveMessageAfterTone;  // "Just leave your message after the tone" pattern (even with "No" at start)
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
  const estimatedScore = estimateScore(call);
  const rawScore = parsedScore !== null ? parsedScore : estimatedScore;
  
  // Apply the same score adjustment as display logic
  const effectiveScore = rawScore !== null 
    ? adjustScoreBasedOnContent(rawScore, transcript, callSummary, userText, call.duration)
    : null;
  
  const isFailedByText = failedPatterns.some(p => textToCheck.includes(p));
  const isVeryShortCall = (call.duration || 0) < 15;
  const aiOnlySpoke = transcript.includes('ai:') && userResponses === 0;
  const customerHungUpQuickly = endedReason === 'customer-ended-call' && isVeryShortCall;
  
  // Check if user never responded (0 words) - this is always a failed call
  const userNeverResponded = userWordCount === 0;
  
  // Failed call: no score (null) means failed connection, or explicit failure patterns
  // OR user never responded (no answer at all)
  const isFailedCall = isFailedByText || 
    effectiveScore === null ||  // No score means failed to connect (V or F)
    userNeverResponded ||  // User never responded → failed call
    (customerHungUpQuickly && !isRealConversation) ||
    (aiOnlySpoke && isVeryShortCall);
  
  // If failed → F (sort key 2)
  if (isFailedCall) {
    return 2;
  }
  
  // For scored calls, return sort key based on ADJUSTED score (3-12 range)
  // Higher scores get higher sort keys for "score_high" sorting
  // Score 1 → sort key 3, Score 10 → sort key 12
  return (effectiveScore || 5) + 2;
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

// Generate actionable summary for salespeople based on call score
function getSalesAdvice(
  scoreDisplay: string,
  transcript: string,
  userText: string,
  lang: "en" | "tr" = "en"
): string {
  const texts = {
    voicemail: { en: "Voicemail - should be called back", tr: "Sesli mesaja düştü - tekrar aranmalı" },
    failed: { en: "Connection failed - should be called back", tr: "Bağlantı kurulamadı - tekrar aranmalı" },
    hotLead: { en: "🔥 Hot lead!", tr: "🔥 Sıcak lead!" },
    interested: { en: "✅ Interested customer!", tr: "✅ İlgili müşteri!" },
    neutral: { en: "📊 Neutral conversation", tr: "📊 Nötr görüşme" },
    lowInterest: { en: "⚠️ Low interest", tr: "⚠️ Düşük ilgi" },
    notInterested: { en: "❌ Not interested", tr: "❌ İlgisiz" },
    zoomMeeting: { en: "Zoom meeting to be scheduled.", tr: "Zoom görüşmesi planlanacak." },
    callbackRequested: { en: "Requested callback.", tr: "Geri arama istedi." },
    infoRequested: { en: "Requested information to be sent.", tr: "Bilgi gönderilmesini istedi." },
    dayPreference: { en: "Preferred specific day - check calendar.", tr: "Belirli gün tercih etti - takvimi kontrol edin." },
    timePreference: { en: "Specified time preference.", tr: "Saat tercihi belirtti." },
    followUp: { en: "Follow up quickly and schedule an appointment.", tr: "Hızlıca takip edin ve randevu alın." },
  };

  // For voicemail and failed - simple messages
  if (scoreDisplay === 'V') {
    return texts.voicemail[lang];
  }
  if (scoreDisplay === 'F') {
    return texts.failed[lang];
  }
  
  const score = Number(scoreDisplay);
  const lowerTranscript = transcript.toLowerCase();
  const lowerUserText = userText.toLowerCase();
  
  const advice: string[] = [];
  
  // Generate advice based on score
  if (score >= 9) {
    advice.push(texts.hotLead[lang]);
  } else if (score >= 7) {
    advice.push(texts.interested[lang]);
  } else if (score >= 5) {
    advice.push(texts.neutral[lang]);
  } else if (score >= 3) {
    advice.push(texts.lowInterest[lang]);
  } else {
    advice.push(texts.notInterested[lang]);
  }
  
  // For scores >= 6, add detailed advice
  if (score >= 6) {
    // Check what they agreed to
    if (lowerTranscript.includes('zoom') || lowerTranscript.includes('q and a')) {
      advice.push(texts.zoomMeeting[lang]);
    }
    if (lowerUserText.includes('call me') || lowerUserText.includes('call back') || lowerUserText.includes('ara')) {
      advice.push(texts.callbackRequested[lang]);
    }
    if (lowerUserText.includes('send') || lowerUserText.includes('email') || lowerUserText.includes('whatsapp')) {
      advice.push(texts.infoRequested[lang]);
    }
    if (lowerUserText.includes('monday') || lowerUserText.includes('tuesday') || lowerUserText.includes('wednesday') || 
        lowerUserText.includes('thursday') || lowerUserText.includes('friday') || lowerUserText.includes('saturday') ||
        lowerUserText.includes('pazartesi') || lowerUserText.includes('salı') || lowerUserText.includes('çarşamba')) {
      advice.push(texts.dayPreference[lang]);
    }
    if (lowerUserText.includes('morning') || lowerUserText.includes('afternoon') || lowerUserText.includes('evening') ||
        lowerUserText.includes('sabah') || lowerUserText.includes('öğleden') || lowerUserText.includes('akşam')) {
      advice.push(texts.timePreference[lang]);
    }
    
    // If no specific action found for interested customers
    if (advice.length === 1 && score >= 7) {
      advice.push(texts.followUp[lang]);
    }
  }
  
  return advice.join(" ");
}

// Call labels with translations
const callLabels = {
  summary: { en: "Summary", tr: "Özet" },
  callStatus: { en: "Call Status", tr: "Arama Durumu" },
  transcript: { en: "Transcript", tr: "Transkript" },
  voicemail: { en: "Voicemail", tr: "Sesli Mesaj" },
  notReached: { en: "Not Reached", tr: "Ulaşılamadı" },
  hotLead: { en: "Hot Lead", tr: "Sıcak Müşteri" },
  interested: { en: "Interested", tr: "İlgili" },
  neutral: { en: "Neutral", tr: "Nötr" },
  notInterested: { en: "Not Interested", tr: "İlgisiz" },
};

// Call Row Component with Expandable Detail - Mobile Responsive
function CallRow({ 
  call, 
  onPlay,
  lang
}: { 
  call: Call;
  onPlay: (call: Call) => void;
  lang?: "en" | "tr";
}) {
  const [expanded, setExpanded] = useState(false);
  const { language: contextLanguage } = useLanguage();
  
  // Use prop lang if provided, otherwise use context language
  // Ensure it's a valid language code
  const currentLang: "en" | "tr" = (lang === "tr" || lang === "en") ? lang : 
                                    (contextLanguage === "tr" || contextLanguage === "en") ? contextLanguage : "en";

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
  
  // === SMART CALL CLASSIFICATION ALGORITHM ===
  
  // Extract what the user actually said FIRST (needed for score adjustment)
  const userParts = transcript.split(/ai:/i).filter(part => part.includes('user:'));
  const userTextRaw = userParts.map(p => p.split('user:')[1] || '').join(' ').toLowerCase();
  const userText = userTextRaw.replace(/[.,!?;:'"]/g, ' ').replace(/\s+/g, ' ');
  
  // Calculate user word count for voicemail detection
  const userWords = userText.trim().split(/\s+/).filter(w => w.length > 0);
  const userWordCount = userWords.length;
  
  // Get the score first (either from evaluation or estimated)
  // Score is now on 1-10 scale, null means V or F
  const parsedScore = parseScore(call.evaluation_score);
  const estimatedScoreValue = estimateScore(call);
  const rawScore = parsedScore !== null ? parsedScore : estimatedScoreValue;
  
  // Adjust score based on transcript content (catches wrong high scores like "not interested" getting 10)
  const effectiveScore = rawScore !== null 
    ? adjustScoreBasedOnContent(rawScore, transcript, callSummary, userText, call.duration)
    : null;
  
  // Voicemail system phrases (these appear in automated voicemail greetings)
  const voicemailSystemPhrases = [
    'voicemail', 'sesli mesaj',
    'can\'t take your call', 'can\'t take call', 'can\'t take the call',
    'can\'t take call right now', 'can\'t take your call right now', 'can\'t take the call right now',
    'please leave a message', 'leave a message', 'leave your message', 'after the beep',
    'after the tone', 'at the tone', // Voicemail tone indicators
    'unavailable to take your call', 'not available to take your call',
    'mesaj bırakın', 'bip sesinden sonra', 'sesli mesaj bırakın',
    'record your message',
    'unable to take your call', 'can t take your call', 'cannot take your call',
    'mailbox',
    'press hash', 'hang up', 'just hang up', 'when you re done', 'when you\'re done',
    'please stay on the line', 'stay on the line', // Voicemail system phrases
    'is on another line', 'on another line' // "Is on another line. Just leave your message after the tone."
  ];
  
  // Hold/wait phrases (can appear in both voicemail AND real calls)
  const holdPhrases = ['please hold', 'not available'];
  
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
  
  // Check if user said something meaningful (not just voicemail system)
  const userSaidMeaningful = meaningfulUserPatterns.some(p => userText.includes(p));
  
  // Check for phone number pattern + voicemail phrase (e.g., "370 8493 can't take your call right now")
  // This is a typical voicemail pattern: phone number followed by automated message
  // More flexible pattern: looks for digits followed by voicemail phrases anywhere in user text
  // Check both normalized text (can't -> can t) and original text
  // Pattern variations: "can't take", "can t take", "cant take"
  const phoneNumberVoicemailPattern1 = /[\d\s\.\-\(\)]{3,}(can\'t take|can t take|leave|message|unavailable|voicemail|right now)/i;
  const phoneNumberVoicemailPattern2 = /[\d\s\.\-\(\)]{3,}(cant take|leave|message|unavailable|voicemail|right now)/i;
  
  // Also check transcript directly for more reliable detection
  const transcriptLower = transcript.toLowerCase();
  const isPhoneNumberVoicemail = phoneNumberVoicemailPattern1.test(userText) || 
                                  phoneNumberVoicemailPattern2.test(userText) ||
                                  phoneNumberVoicemailPattern1.test(userTextRaw) ||
                                  phoneNumberVoicemailPattern2.test(userTextRaw) ||
                                  phoneNumberVoicemailPattern1.test(transcriptLower) ||
                                  phoneNumberVoicemailPattern2.test(transcriptLower);
  
  // Also check if user text contains voicemail phrases (normalized or original)
  // Handle variations: "can't" -> "can t" or "cant"
  const hasVoicemailInUserText = voicemailSystemPhrases.some(p => {
    const normalized = p.replace(/'/g, ' ').replace(/\s+/g, ' '); // "can't" -> "can t"
    const noApostrophe = p.replace(/'/g, ''); // "can't" -> "cant"
    return userText.includes(p) || 
           userTextRaw.includes(p) ||
           userText.includes(normalized) ||
           userText.includes(noApostrophe) ||
           userTextRaw.includes(normalized) ||
           userTextRaw.includes(noApostrophe);
  });
  
  const userOnlyVoicemailPhrases = (hasVoicemailInUserText || isPhoneNumberVoicemail) && !userSaidMeaningful;
  
  // Special case: "Available" + "Please stay on the line" pattern (Lewis Brown case)
  // This is a typical voicemail greeting pattern
  const isOnlyAvailable = userWordCount === 1 && userText.trim() === 'available';
  
  // Check for positive engagement (yeah, yes, etc.) - if user showed engagement, it's not voicemail
  const hasPositiveEngagement = userText.toLowerCase().includes('yeah') ||
                                userText.toLowerCase().includes('yes') ||
                                userText.toLowerCase().includes('yep') ||
                                userText.toLowerCase().includes('yea') ||
                                userText.toLowerCase().includes('sure') ||
                                userText.toLowerCase().includes('okay') ||
                                userText.toLowerCase().includes('ok');
  
  // "Available" + "Please stay on the line" is voicemail ONLY if no positive engagement
  // If user said "Yeah. Yeah." or showed interest, it's a real conversation, not voicemail
  const hasAvailableAndStayOnLine = userText.includes('available') && 
                                    (userText.includes('stay on the line') || 
                                     userText.includes('please stay')) &&
                                    !hasPositiveEngagement; // Skip if positive engagement exists
  
  // Special case: "Is on another line. Just leave your message after the tone."
  // This is a classic voicemail pattern
  const hasAnotherLineAndLeaveMessage = (userText.includes('is on another line') || 
                                        userText.includes('on another line')) &&
                                       (userText.includes('leave your message') ||
                                        userText.includes('leave a message') ||
                                        userText.includes('after the tone') ||
                                        userText.includes('after the beep'));
  
  // Special case: "Just leave your message after the tone" (even with "No" at the start)
  // This is a classic voicemail pattern - "No. Just leave your message after the tone."
  const hasJustLeaveMessageAfterTone = (userText.toLowerCase().includes('just leave') || 
                                        userText.toLowerCase().includes('leave your message')) &&
                                       (userText.toLowerCase().includes('after the tone') ||
                                        userText.toLowerCase().includes('after the beep') ||
                                        userText.toLowerCase().includes('at the tone'));
  
  // Determine if this is a voicemail
  // It's voicemail if: voicemail phrases exist AND user didn't say anything meaningful
  const hasVoicemailPhrases = voicemailSystemPhrases.some(p => transcript.includes(p));
  const hasOnlyHoldPhrases = holdPhrases.some(p => transcript.includes(p)) && !hasVoicemailPhrases;
  
  // Key insight: Even if user responded multiple times, if they ONLY said voicemail phrases, it's still voicemail
  const isRealConversation = userSaidMeaningful; // Simplified - must say something meaningful
  
  // If phone number + voicemail pattern detected, it's definitely voicemail (highest priority)
  // This catches cases like "3 7 0 8 4 9 3 can't take your call right now"
  // Also catch "Available" + "Please stay on the line" pattern (Lewis Brown case)
  // Also catch "Is on another line. Just leave your message after the tone." pattern
  // Also catch "Just leave your message after the tone" pattern (even with "No" at start)
  // Otherwise check other voicemail indicators
  const isVoicemail = isPhoneNumberVoicemail ||  // Highest priority - phone number + voicemail phrase
                      (hasVoicemailInUserText && !userSaidMeaningful) ||  // User said voicemail phrase but nothing meaningful
                      (hasVoicemailPhrases && !isRealConversation) || 
                      (userOnlyVoicemailPhrases) ||
                      isOnlyAvailable ||  // Single word "Available" is voicemail greeting
                      hasAvailableAndStayOnLine ||  // "Available" + "Please stay on the line" pattern
                      hasAnotherLineAndLeaveMessage ||  // "Is on another line. Just leave your message after the tone." pattern
                      hasJustLeaveMessageAfterTone;  // "Just leave your message after the tone" pattern (even with "No" at start)
  
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
  
  // Check if user never responded (0 words) - this is always a failed call
  const userNeverResponded = userWordCount === 0;
  
  // Determine call category
  const isVoicemailFinal = isVoicemail || likelyVoicemailByBehavior;
  
  // Failed call: no score (null) OR explicit failure patterns
  // OR user never responded (no answer at all)
  const isFailedCall = isFailedByText || 
    effectiveScore === null ||  // No score means failed to connect
    userNeverResponded ||  // User never responded → failed call
    (customerHungUpQuickly && !isRealConversation) ||
    (aiOnlySpoke && isVeryShortCall);
  
  // Determine what to display in score badge
  // V = Voicemail (red), F = Failed (red), 1-10 = Score with color gradient
  let scoreDisplay: string;
  let badgeColor: { bg: string; text: string };
  
  if (isVoicemailFinal) {
    scoreDisplay = "V";
    badgeColor = { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" };
  } else if (isFailedCall) {
    scoreDisplay = "F";
    badgeColor = { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" };
  } else {
    // Show numeric score (1-10)
    const displayScore = effectiveScore || 5;
    scoreDisplay = displayScore.toString();
    
    // Color gradient based on score:
    // 1-3: Red (poor), 4-5: Orange (below average), 6-7: Yellow (neutral), 8-9: Light green, 10: Green (excellent)
    if (displayScore <= 3) {
      badgeColor = { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" };
    } else if (displayScore <= 5) {
      badgeColor = { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" };
    } else if (displayScore <= 7) {
      badgeColor = { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" };
    } else if (displayScore <= 9) {
      badgeColor = { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" };
    } else {
      badgeColor = { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" };
    }
  }
  
  const validSummary = getValidEvaluationSummary(call.evaluation_summary);
  
  // Generate actionable sales advice based on score
  const salesAdvice = getSalesAdvice(
    scoreDisplay,
    call.transcript || '',
    userText,
    lang
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
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                  {currentLang === "tr" ? "Özet" : "Summary"}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{cleanCallSummary(call.summary)}</p>
          </div>
            )}
            
            {/* AI Evaluation - Always show since we always have a score now */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{callLabels.callStatus[currentLang]}</p>
              <div className="flex items-start gap-4">
                {/* Status Display - V (voicemail), F (failed), or 1-10 score */}
                <div className={cn(
                  "flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl",
                  badgeColor.bg
                )}>
                  <span className={cn("text-xl sm:text-2xl font-bold", badgeColor.text)}>
                    {scoreDisplay}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {scoreDisplay === 'V' ? (lang === "tr" ? "oicemail" : "oicemail") :
                     scoreDisplay === 'F' ? (lang === "tr" ? "ailed" : "ailed") : "/10"}
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
                      {scoreDisplay === 'V' ? callLabels.voicemail[currentLang] :
                       scoreDisplay === 'F' ? callLabels.notReached[currentLang] :
                       Number(scoreDisplay) >= 8 ? callLabels.hotLead[currentLang] :
                       Number(scoreDisplay) >= 6 ? callLabels.interested[currentLang] :
                       Number(scoreDisplay) >= 4 ? callLabels.neutral[currentLang] : callLabels.notInterested[currentLang]}
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
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{callLabels.transcript[currentLang]}</p>
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
  const { t, language } = useTranslation("calls");
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">{t("subtitle")}</p>
                </div>
              <Button 
                variant="outline" 
                onClick={handleRefresh} 
                disabled={isRefreshing}
          className="border-gray-200 dark:border-gray-700 w-full sm:w-auto"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
          {t("refresh")}
              </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t("allCalls")}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{totalCalls}</p>
      </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t("transferred")}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">0</p>
          </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t("successful")}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{successfulCalls}</p>
            </div>
            </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <Input
            placeholder={t("searchPlaceholder")}
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
              <SelectValue placeholder={t("sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">{t("latestFirst")}</SelectItem>
              <SelectItem value="earliest">{t("earliestFirst")}</SelectItem>
              <SelectItem value="score_high">{t("highestScore")}</SelectItem>
              <SelectItem value="score_low">{t("lowestScore")}</SelectItem>
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
            <div className="w-64">{t("customer")}</div>
            <div className="w-16 text-center">{t("score")}</div>
            <div className="w-20 text-center">{t("duration")}</div>
            <div className="w-28 text-center">{t("date")}</div>
            <div className="w-20"></div>
                          </div>
                        </div>

        {/* Table Body */}
        {filteredCalls.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Phone className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">{t("noCalls")}</p>
                            </div>
        ) : (
                              <div>
            {filteredCalls.map((call) => (
              <CallRow 
                key={call.id} 
                call={call} 
                lang={language}
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
            <DialogTitle>{t("deleteAll")}</DialogTitle>
            <DialogDescription>
              {t("confirmDelete")} ({calls.length})
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearAllDialog(false)} disabled={isDeleting}>
              {t("cancel")}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClearAll} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("deleteAll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
