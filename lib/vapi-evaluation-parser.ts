/**
 * VAPI Evaluation Parser
 * Parses VAPI's successEvaluation JSON response directly
 * 
 * Expected VAPI Response Format:
 * {
 *   "score": 7,
 *   "outcome": "interested",
 *   "sentiment": "positive",
 *   "summary": "Customer showed interest in the product",
 *   "tags": ["interested", "warm_lead"],
 *   "objections": ["price_concern"],
 *   "nextAction": "Schedule follow-up call"
 * }
 * 
 * Score Scale (1-10):
 * V = Voicemail (not a score, separate category)
 * F = Failed to connect (not a score, separate category)
 * 1-2 = Connected but very negative (immediate hang up, hostile, wrong number)
 * 3-4 = Connected but negative (not interested, rude, no engagement)
 * 5-6 = Neutral conversation (listened but non-committal, unclear interest)
 * 7-8 = Positive interest (engaged, asked questions, wants follow-up)
 * 9-10 = Success (appointment set, sale made, strong commitment, hot lead)
 */

export interface ParsedEvaluation {
  score: number | null;
  tags: string[];
  summary: string | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  outcome?: string;
  objections?: string[];
  nextAction?: string;
}

// Valid outcomes from VAPI
const VALID_OUTCOMES = [
  'appointment_set',
  'callback_requested', 
  'interested',
  'not_interested',
  'needs_info',
  'no_answer',
  'voicemail',
  'wrong_number',
  'busy',
] as const;

// Valid tags
const VALID_TAGS = [
  // Outcome tags
  'appointment_set', 'callback_requested', 'follow_up_needed',
  // Lead quality
  'hot_lead', 'warm_lead', 'cold_lead',
  // Objections
  'price_concern', 'timing_concern', 'needs_info',
  // Interest
  'interested', 'not_interested', 'highly_interested',
  // Call quality
  'successful_call', 'failed_call', 'voicemail', 'no_answer',
  // Special
  'referral', 'complaint', 'vip_customer',
] as const;

/**
 * Parse VAPI's successEvaluation - expects JSON from the new prompt
 */
export function parseVapiEvaluation(
  successEvaluation: string | null | undefined,
  endedReason?: string
): ParsedEvaluation {
  // Priority 1: Check endedReason for failed connections (always override)
  if (endedReason) {
    const failedResult = checkFailedConnection(endedReason);
    if (failedResult) return failedResult;
  }

  // Priority 2: Handle missing/invalid evaluation
  if (!successEvaluation || 
      successEvaluation === 'false' || 
      successEvaluation === 'true' ||
      successEvaluation.trim().toLowerCase() === 'false' ||
      successEvaluation.trim().toLowerCase() === 'true') {
    return endedReason 
      ? inferFromEndedReason(endedReason) 
      : createEmptyResult();
  }

  // Priority 3: Parse JSON from VAPI
  const parsed = parseJsonEvaluation(successEvaluation);
  if (parsed) return parsed;

  // Priority 4: Fallback - use raw text as summary
  return {
    score: null,
    tags: [],
    summary: cleanText(successEvaluation),
    sentiment: 'neutral',
  };
}

/**
 * Parse JSON evaluation from VAPI
 */
function parseJsonEvaluation(text: string): ParsedEvaluation | null {
  try {
    // Extract JSON from text (might have extra text around it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const json = JSON.parse(jsonMatch[0]);

    // Validate and extract score (1-10 scale)
    let score: number | null = null;
    if (typeof json.score === 'number' && json.score >= 1 && json.score <= 10) {
      score = Math.round(json.score);
    } else if (typeof json.score === 'number' && json.score >= 1 && json.score <= 5) {
      // Convert old 1-5 scale to 1-10 scale for backward compatibility
      score = Math.round(json.score * 2);
    }

    // Extract and validate tags
    let tags: string[] = [];
    if (Array.isArray(json.tags)) {
      tags = json.tags.filter((t: unknown) => 
        typeof t === 'string' && VALID_TAGS.includes(t as typeof VALID_TAGS[number])
      );
    }

    // Add outcome as a tag if valid
    if (json.outcome && VALID_OUTCOMES.includes(json.outcome)) {
      if (!tags.includes(json.outcome)) {
        tags.unshift(json.outcome);
      }
    }

    // Determine sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (json.sentiment === 'positive' || json.sentiment === 'negative' || json.sentiment === 'neutral') {
      sentiment = json.sentiment;
    } else if (score !== null) {
      // Infer from score if not provided (1-10 scale)
      sentiment = score >= 7 ? 'positive' : score <= 4 ? 'negative' : 'neutral';
    }

    // Clean summary
    const summary = typeof json.summary === 'string' ? cleanText(json.summary) : null;

    return {
      score,
      tags,
      summary,
      sentiment,
      outcome: json.outcome,
      objections: Array.isArray(json.objections) ? json.objections : undefined,
      nextAction: typeof json.nextAction === 'string' ? json.nextAction : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Check if call failed to connect
 * Note: V (Voicemail) and F (Failed) are separate categories, not scored on 1-10 scale
 * These will be displayed as V or F letters, not numbers
 */
function checkFailedConnection(endedReason: string): ParsedEvaluation | null {
  const reason = endedReason.toLowerCase();

  if (reason.includes('no-answer') || reason.includes('customer-did-not-answer')) {
    return {
      score: null, // F - Failed, will be shown as "F" not a number
      tags: ['no_answer', 'failed_call'],
      summary: 'Müşteriye ulaşılamadı',
      sentiment: 'negative',
      outcome: 'no_answer',
    };
  }

  if (reason.includes('voicemail')) {
    return {
      score: null, // V - Voicemail, will be shown as "V" not a number
      tags: ['voicemail'],
      summary: 'Sesli mesaja düştü',
      sentiment: 'negative',
      outcome: 'voicemail',
    };
  }

  if (reason.includes('busy')) {
    return {
      score: null, // F - Failed, will be shown as "F" not a number
      tags: ['timing_concern', 'failed_call'],
      summary: 'Hat meşgul',
      sentiment: 'negative',
      outcome: 'busy',
    };
  }

  return null;
}

/**
 * Infer evaluation from endedReason when no evaluation provided
 * Uses 1-10 scale for connected calls
 */
function inferFromEndedReason(endedReason: string): ParsedEvaluation {
  const reason = endedReason.toLowerCase();

  if (reason.includes('assistant-ended-call')) {
    return {
      score: 6, // Neutral on 1-10 scale (call completed normally)
      tags: ['successful_call'],
      summary: 'Görüşme asistan tarafından sonlandırıldı',
      sentiment: 'neutral',
    };
  }

  if (reason.includes('customer-ended-call')) {
    return {
      score: 5, // Slightly lower on 1-10 scale (customer ended, might indicate less interest)
      tags: [],
      summary: 'Müşteri görüşmeyi sonlandırdı',
      sentiment: 'neutral',
    };
  }

  return createEmptyResult();
}

/**
 * Create empty result
 */
function createEmptyResult(): ParsedEvaluation {
  return {
    score: null,
    tags: [],
    summary: null,
    sentiment: 'neutral',
  };
}

/**
 * Clean text - remove markdown and excess whitespace
 */
function cleanText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* -> italic
    .replace(/^\s*[\*\-•]\s*/gm, '')     // Remove bullet points
    .replace(/\n+/g, ' ')                // Newlines to spaces
    .replace(/\s{2,}/g, ' ')             // Multiple spaces to single
    .trim()
    .substring(0, 500);                  // Limit length
}

/**
 * Merge tags - adds new tags without duplicates
 */
export function mergeTags(existing: string[] | null, newTags: string[]): string[] {
  const existingSet = new Set(existing || []);
  newTags.forEach(tag => existingSet.add(tag));
  return Array.from(existingSet);
}
