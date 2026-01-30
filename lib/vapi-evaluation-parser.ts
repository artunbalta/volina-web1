/**
 * VAPI Evaluation Parser
 * Parses VAPI's successEvaluation field to extract score, tags, and summary
 */

export interface ParsedEvaluation {
  score: number | null;
  tags: string[];
  summary: string | null;
  sentiment: 'positive' | 'neutral' | 'negative';
}

// Tag keywords mapping - maps keywords found in evaluation to tags
const TAG_KEYWORDS: Record<string, string[]> = {
  // Interest level tags
  'interested': ['interested', 'ilgili', 'meraklı', 'curious', 'want', 'istiyor'],
  'not_interested': ['not interested', 'ilgisiz', 'ilgilenmiyor', 'declined', 'reddetti'],
  'highly_interested': ['very interested', 'çok ilgili', 'kesinlikle', 'definitely', 'eager'],
  
  // Outcome tags
  'appointment_set': ['appointment', 'randevu', 'scheduled', 'booking', 'rezervasyon', 'confirmed'],
  'callback_requested': ['callback', 'geri arama', 'tekrar ara', 'call back', 'dönüş'],
  'follow_up_needed': ['follow up', 'takip', 'follow-up', 'tekrar', 'again'],
  
  // Lead quality tags
  'hot_lead': ['hot lead', 'sıcak', 'ready to buy', 'hazır', 'acil', 'urgent'],
  'warm_lead': ['warm', 'ılık', 'considering', 'düşünüyor'],
  'cold_lead': ['cold', 'soğuk', 'not ready', 'hazır değil'],
  
  // Objections
  'price_concern': ['price', 'fiyat', 'expensive', 'pahalı', 'cost', 'maliyet', 'budget', 'bütçe'],
  'timing_concern': ['timing', 'zaman', 'later', 'sonra', 'busy', 'meşgul'],
  'needs_info': ['information', 'bilgi', 'details', 'detay', 'question', 'soru'],
  
  // Call quality
  'successful_call': ['success', 'başarılı', 'good', 'iyi', 'positive', 'olumlu'],
  'failed_call': ['failed', 'başarısız', 'unsuccessful', 'bad', 'kötü'],
  'voicemail': ['voicemail', 'sesli mesaj', 'mailbox'],
  'no_answer': ['no answer', 'cevap yok', 'ulaşılamadı', 'unreachable'],
  
  // Special cases
  'vip_customer': ['vip', 'premium', 'önemli', 'important'],
  'referral': ['referral', 'referans', 'recommendation', 'tavsiye'],
  'complaint': ['complaint', 'şikayet', 'unhappy', 'mutsuz', 'problem'],
};

// Score keywords - maps to approximate scores
const SCORE_INDICATORS: Array<{ keywords: string[]; scoreRange: [number, number] }> = [
  { keywords: ['excellent', 'mükemmel', 'perfect', 'kesin satış', '10/10'], scoreRange: [9, 10] },
  { keywords: ['very good', 'çok iyi', 'great', 'harika', 'highly successful'], scoreRange: [8, 9] },
  { keywords: ['good', 'iyi', 'positive', 'olumlu', 'successful', 'başarılı'], scoreRange: [7, 8] },
  { keywords: ['moderate', 'orta', 'okay', 'acceptable', 'kabul edilebilir'], scoreRange: [5, 7] },
  { keywords: ['poor', 'kötü', 'negative', 'olumsuz', 'unsuccessful'], scoreRange: [3, 5] },
  { keywords: ['very poor', 'çok kötü', 'failed', 'başarısız', 'terrible'], scoreRange: [1, 3] },
  { keywords: ['no answer', 'cevap yok', 'voicemail', 'unreachable', 'busy', 'meşgul'], scoreRange: [1, 1] },
];

/**
 * Try to parse JSON evaluation from VAPI
 */
function tryParseJsonEvaluation(text: string): ParsedEvaluation | null {
  try {
    // Try to extract JSON from the text (might have extra text around it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const json = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (typeof json.score !== 'number' || json.score < 1 || json.score > 10) {
      return null;
    }
    
    const result: ParsedEvaluation = {
      score: Math.round(json.score),
      tags: [],
      summary: json.summary || null,
      sentiment: 'neutral',
    };
    
    // Map outcome to tags
    if (json.outcome) {
      const outcome = json.outcome.toLowerCase();
      if (outcome === 'appointment_set') {
        result.tags.push('appointment_set');
        result.sentiment = 'positive';
      } else if (outcome === 'interested') {
        result.tags.push('interested');
        result.sentiment = 'positive';
      } else if (outcome === 'callback_requested') {
        result.tags.push('callback_requested');
        result.sentiment = 'positive';
      } else if (outcome === 'not_interested') {
        result.tags.push('not_interested');
        result.sentiment = 'negative';
      } else if (outcome === 'no_answer') {
        result.tags.push('no_answer');
        result.sentiment = 'negative';
      } else if (outcome === 'voicemail') {
        result.tags.push('voicemail');
        result.sentiment = 'negative';
      } else if (outcome === 'busy') {
        result.tags.push('timing_concern');
        result.sentiment = 'negative';
      }
    }
    
    // Set sentiment from score if not already set
    if (result.sentiment === 'neutral' && result.score !== null) {
      if (result.score >= 7) result.sentiment = 'positive';
      else if (result.score <= 3) result.sentiment = 'negative';
    }
    
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse VAPI's successEvaluation string to extract structured data
 */
export function parseVapiEvaluation(
  successEvaluation: string | null | undefined,
  endedReason?: string
): ParsedEvaluation {
  const result: ParsedEvaluation = {
    score: null,
    tags: [],
    summary: null,
    sentiment: 'neutral',
  };

  // First, check ended reason for failed connections - these always get score 1
  if (endedReason) {
    const reason = endedReason.toLowerCase();
    if (reason.includes('no-answer') || 
        reason.includes('customer-did-not-answer') ||
        reason.includes('voicemail') ||
        reason.includes('busy')) {
      return inferFromEndedReason(endedReason);
    }
  }

  // Handle missing, empty, or invalid evaluation values
  if (!successEvaluation || 
      successEvaluation === 'false' || 
      successEvaluation === 'true' ||
      successEvaluation.toLowerCase().trim() === 'false' ||
      successEvaluation.toLowerCase().trim() === 'true') {
    // If no evaluation but we have ended reason, try to infer
    if (endedReason) {
      return inferFromEndedReason(endedReason);
    }
    return result;
  }

  // Try to parse as JSON first (new format)
  const jsonResult = tryParseJsonEvaluation(successEvaluation);
  if (jsonResult) {
    return jsonResult;
  }

  // Fall back to legacy text parsing
  const lowerEval = successEvaluation.toLowerCase();
  
  // Extract score
  result.score = extractScore(successEvaluation, lowerEval);
  
  // Extract tags
  result.tags = extractTags(lowerEval);
  
  // Determine sentiment
  result.sentiment = determineSentiment(lowerEval, result.score);
  
  // Use the evaluation as summary (clean it up)
  result.summary = cleanSummary(successEvaluation);

  return result;
}

/**
 * Extract numeric score from evaluation text
 */
function extractScore(original: string, lowerText: string): number | null {
  // First try to find explicit score patterns like "8/10", "score: 7", etc.
  const scorePatterns = [
    /(\d+)\s*\/\s*10/i,                    // 8/10
    /score[:\s]+(\d+)/i,                   // score: 8 or score 8
    /puan[:\s]+(\d+)/i,                    // puan: 8 (Turkish)
    /rating[:\s]+(\d+)/i,                  // rating: 8
    /(\d+)\s*out\s*of\s*10/i,             // 8 out of 10
    /(\d+)\s*puan/i,                       // 8 puan
  ];

  for (const pattern of scorePatterns) {
    const match = original.match(pattern);
    if (match && match[1]) {
      const score = parseInt(match[1], 10);
      if (score >= 0 && score <= 10) {
        return score;
      }
    }
  }

  // If no explicit score, infer from keywords
  for (const indicator of SCORE_INDICATORS) {
    for (const keyword of indicator.keywords) {
      if (lowerText.includes(keyword)) {
        // Return middle of range
        const [min, max] = indicator.scoreRange;
        return Math.round((min + max) / 2);
      }
    }
  }

  // Default based on general sentiment
  if (lowerText.includes('success') || lowerText.includes('başarı')) {
    return 7;
  }
  if (lowerText.includes('fail') || lowerText.includes('başarısız')) {
    return 3;
  }

  return null;
}

/**
 * Extract tags from evaluation text
 */
function extractTags(lowerText: string): string[] {
  const tags: string[] = [];

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
        break; // Found this tag, move to next
      }
    }
  }

  return tags;
}

/**
 * Determine sentiment from evaluation
 */
function determineSentiment(
  lowerText: string,
  score: number | null
): 'positive' | 'neutral' | 'negative' {
  // If we have a score, use it
  if (score !== null) {
    if (score >= 7) return 'positive';
    if (score <= 4) return 'negative';
    return 'neutral';
  }

  // Check keywords
  const positiveKeywords = ['success', 'başarı', 'positive', 'olumlu', 'good', 'iyi', 'great', 'excellent'];
  const negativeKeywords = ['fail', 'başarısız', 'negative', 'olumsuz', 'bad', 'kötü', 'poor', 'terrible'];

  const hasPositive = positiveKeywords.some(k => lowerText.includes(k));
  const hasNegative = negativeKeywords.some(k => lowerText.includes(k));

  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && !hasPositive) return 'negative';
  
  return 'neutral';
}

/**
 * Clean up evaluation text for summary
 */
function cleanSummary(text: string): string {
  // Remove score patterns from summary
  let cleaned = text
    .replace(/\d+\s*\/\s*10/gi, '')
    .replace(/score[:\s]+\d+/gi, '')
    .replace(/puan[:\s]+\d+/gi, '')
    .replace(/rating[:\s]+\d+/gi, '')
    .trim();

  // Remove markdown formatting
  cleaned = cleaned
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* -> italic
    .replace(/^\s*[\*\-•]\s*/gm, '')     // Remove bullet points at start of lines
    .replace(/\s*[\*\-•]\s+/g, ' ')      // Remove inline bullet markers
    .replace(/\n+/g, ' ')                // Replace newlines with spaces
    .replace(/\s{2,}/g, ' ')             // Multiple spaces to single
    .trim();

  // Limit length
  if (cleaned.length > 500) {
    cleaned = cleaned.substring(0, 497) + '...';
  }

  return cleaned || text;
}

/**
 * Infer evaluation from ended reason when no evaluation provided
 */
function inferFromEndedReason(endedReason: string): ParsedEvaluation {
  const reason = endedReason.toLowerCase();

  if (reason.includes('no-answer') || reason.includes('customer-did-not-answer')) {
    return {
      score: 1,
      tags: ['no_answer'],
      summary: 'Müşteriye ulaşılamadı',
      sentiment: 'negative',
    };
  }

  if (reason.includes('voicemail')) {
    return {
      score: 1,
      tags: ['voicemail'],
      summary: 'Sesli mesaja düştü',
      sentiment: 'negative',
    };
  }

  if (reason.includes('busy')) {
    return {
      score: 1,
      tags: ['timing_concern'],
      summary: 'Hat meşgul',
      sentiment: 'negative',
    };
  }

  if (reason.includes('assistant-ended-call')) {
    return {
      score: 6,
      tags: ['successful_call'],
      summary: 'Görüşme asistan tarafından sonlandırıldı',
      sentiment: 'neutral',
    };
  }

  if (reason.includes('customer-ended-call')) {
    return {
      score: 5,
      tags: [],
      summary: 'Müşteri görüşmeyi sonlandırdı',
      sentiment: 'neutral',
    };
  }

  return {
    score: null,
    tags: [],
    summary: null,
    sentiment: 'neutral',
  };
}

/**
 * Merge tags - adds new tags without duplicates
 */
export function mergeTags(existing: string[] | null, newTags: string[]): string[] {
  const existingSet = new Set(existing || []);
  newTags.forEach(tag => existingSet.add(tag));
  return Array.from(existingSet);
}
