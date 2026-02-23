/**
 * Shared call-scoring pipeline used by BOTH the Calls page and the Leads
 * evaluation-history / leads API.  A single source of truth so that the score
 * displayed in Calls ("SCORE") always matches the one shown in Leads ("EVAL").
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallScoringInput {
  evaluation_score: number | string | null | undefined;
  transcript: string | null;
  summary: string | null;
  evaluation_summary: string | null;
  duration: number | null;
  sentiment?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CallScoreResult {
  /** What should be displayed: "V", "F", or "1"–"10" */
  display: string;
  /** The numeric effective score (after adjustment), null when V/F */
  numericScore: number | null;
}

// ---------------------------------------------------------------------------
// parseScore – parses raw DB evaluation_score
// ---------------------------------------------------------------------------

export function parseScore(score: unknown): number | null {
  if (score === null || score === undefined) return null;

  if (typeof score === 'string') {
    const parsed = parseFloat(score);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      return Math.round(parsed);
    }
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      return Math.round(parsed * 2);
    }
    return null;
  }

  if (typeof score === 'number' && !isNaN(score) && score >= 1 && score <= 10) {
    return Math.round(score);
  }

  if (typeof score === 'number' && !isNaN(score) && score >= 1 && score <= 5) {
    return Math.round(score * 2);
  }

  return null;
}

// ---------------------------------------------------------------------------
// estimateScore – fallback when no DB score exists
// ---------------------------------------------------------------------------

export function estimateScore(call: CallScoringInput): number | null {
  const duration = call.duration || 0;
  const sentiment = call.sentiment;
  const hasTranscript = !!call.transcript;
  const metadata = call.metadata as Record<string, unknown> | undefined;
  const endedReason = metadata?.endedReason as string | undefined;

  if (endedReason) {
    const reason = endedReason.toLowerCase();
    if (reason.includes('no-answer') || reason.includes('customer-did-not-answer')) return null;
    if (reason.includes('voicemail')) return null;
    if (reason.includes('busy')) return null;
  }

  if (!hasTranscript && duration < 10) return null;

  let score = 5.5;
  if (sentiment === 'positive') score += 2;
  else if (sentiment === 'negative') score -= 2;

  if (duration > 180) score += 1.5;
  else if (duration > 60) score += 0.5;
  else if (duration < 30) score -= 1;

  return Math.max(1, Math.min(10, Math.round(score)));
}

// ---------------------------------------------------------------------------
// adjustScoreBasedOnContent – transcript / summary analysis (800+ lines)
// ---------------------------------------------------------------------------

export function adjustScoreBasedOnContent(
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
  const normalizedUserText = lowerUserText.replace(/[.,!?;:'"]/g, ' ').replace(/\s+/g, ' ').trim();
  const userWords = normalizedUserText.split(/\s+/).filter(w => w.length > 0);
  const userWordCount = userWords.length;

  // === RULE 0A: User never responded ===
  if (userWordCount === 0) {
    return 1;
  }

  // === RULE 0B: Single meaningless words ===
  if (userWordCount === 1) {
    const meaninglessSingleWords = [
      'in', 'out', 'what', 'huh', 'eh', 'uh', 'oh', 'ah', 'um', 'er', 'hm', 'hmm',
      'sorry', 'pardon', 'excuse', 'who', 'where', 'when', 'why', 'how'
    ];
    const meaningfulSingleWords = [
      'yes', 'yeah', 'yep', 'yea', 'no', 'ok', 'okay', 'sure', 'hello', 'hi', 'hey',
      'thanks', 'thank', 'bye', 'goodbye', 'alright', 'right', 'correct', 'wrong',
      'evet', 'hayır', 'tamam', 'merhaba', 'selam'
    ];
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
      return 2;
    }
  }

  // === RULE 0B: Incomplete or meaningless short phrases (2-5 words) ===
  if (userWordCount >= 2 && userWordCount <= 5) {
    const incompleteEndings = [
      "it's", "its", "i'm", "im", "we're", "were", "they're", "theyre", "you're", "youre",
      "he's", "hes", "she's", "shes", "that's", "thats", "what's", "whats", "who's", "whos",
      "is", "this", "that", "the", "a", "an"
    ];

    const lastWord = userWords[userWords.length - 1];
    const endsWithIncomplete = lastWord ? incompleteEndings.includes(lastWord) : false;

    const hasThisIsPattern = normalizedUserText.includes("this is") && userWordCount <= 5;

    const meaninglessPhrases = [
      "in zirconia", "zirconia it", "zirconia its", "zirconia",
      "what the", "what is", "who is", "where is",
      "i think", "i guess", "i mean", "i don't", "i cant", "i can't"
    ];
    const hasMeaninglessPhrase = meaninglessPhrases.some(phrase =>
      normalizedUserText.includes(phrase)
    );

    const startsWithInAndTechnical = normalizedUserText.startsWith("in ") &&
      userWordCount <= 4 &&
      (normalizedUserText.includes("zirconia") ||
        normalizedUserText.includes("titanium") ||
        normalizedUserText.includes("ceramic") ||
        normalizedUserText.includes("implant") ||
        normalizedUserText.includes("crown"));

    if ((endsWithIncomplete && userWordCount <= 3) ||
      (hasMeaninglessPhrase && userWordCount <= 4) ||
      startsWithInAndTechnical ||
      hasThisIsPattern) {
      return Math.min(originalScore, 3);
    }
  }

  // === RULE 0.5: Early financial rejection check ===
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

  if (hasFinancialRejectionEarly) {
    if (lowerSummary.includes('not interested') &&
      (lowerSummary.includes('can\'t afford') || lowerSummary.includes('cant afford') ||
        lowerSummary.includes('cannot afford') || lowerSummary.includes('can t afford')) &&
      lowerSummary.includes('declined')) {
      return 1;
    }
    return Math.min(originalScore, 2);
  }

  // === RULE 0.6: Early callback request check ===
  const callbackRequestPatterns = [
    'call me another time', 'call me later', 'call back', 'call me back',
    'possible to call me', 'can you call me', 'would you call me',
    'sonra ara', 'geri ara', 'başka zaman ara', 'daha sonra ara',
    'call me when', 'call me tomorrow', 'call me next week'
  ];

  const hasCallMeAnotherTime = (lowerUserText.includes('call me') &&
    (lowerUserText.includes('another time') ||
      lowerUserText.includes('later') ||
      lowerUserText.includes('back'))) ||
    (lowerUserText.includes('possible') &&
      lowerUserText.includes('call me')) ||
    (lowerUserText.includes('possible') &&
      lowerUserText.includes('call me') &&
      lowerUserText.includes('another time')) ||
    (lowerUserText.includes('possible to call me')) ||
    (lowerUserText.includes('possible') &&
      lowerUserText.includes('call') &&
      lowerUserText.includes('another time')) ||
    (lowerUserText.includes('possible') &&
      (lowerUserText.includes('call me') || lowerUserText.includes('call')) &&
      lowerUserText.includes('another time'));

  const hasCallbackRequest = callbackRequestPatterns.some(p =>
    lowerUserText.includes(p) || lowerSummary.includes(p)
  ) || hasCallMeAnotherTime;

  const summaryHasCallbackRequest = lowerSummary.includes('call back') ||
    lowerSummary.includes('callback') ||
    (lowerSummary.includes('call me') && lowerSummary.includes('another time')) ||
    (lowerSummary.includes('call') && lowerSummary.includes('another time'));

  if (hasCallbackRequest || summaryHasCallbackRequest) {
    return Math.max(originalScore, 8);
  }

  // === RULE 1: Very short calls should never get high scores ===
  if (callDuration > 0 && callDuration < 15) {
    return Math.min(originalScore, 2);
  }
  if (callDuration > 0 && callDuration < 20 && originalScore > 4) {
    return Math.min(originalScore, 4);
  }
  if (callDuration > 0 && callDuration < 30 && originalScore > 6) {
    return Math.min(originalScore, 5);
  }

  // === RULE 2: User barely spoke ===
  if (userWordCount <= 3) {
    return Math.min(originalScore, 3);
  }

  const earlyPositiveCheck = (lowerUserText.match(/\b(yeah|yes|yep|yea)\b/g) || []).length >= 2;
  const earlySummaryInterest = lowerSummary.includes('considering') ||
    lowerSummary.includes('interested') ||
    lowerSummary.includes('open to');
  const hasStrongEarlyPositive = earlyPositiveCheck ||
    (earlySummaryInterest && lowerUserText.includes('yeah'));

  if (userWordCount <= 10 && originalScore > 6 && !hasStrongEarlyPositive) {
    return Math.min(originalScore, 5);
  }
  if (userWordCount <= 20 && originalScore > 7 && !hasStrongEarlyPositive) {
    return Math.min(originalScore, 6);
  }

  // === RULE 3: Summary indicates premature end ===
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

  // === RULE 3B: Voicemail detection ===
  const voicemailIndicators = [
    'can\'t take your call', 'can\'t take call', 'can\'t take the call',
    'please leave a message', 'leave a message', 'leave your message',
    'leave me a message', 'leave me a brief message', 'leave me',
    'after the beep', 'after the tone', 'at the tone',
    'unavailable to take your call', 'not available to take your call',
    'mesaj bırakın', 'bip sesinden sonra', 'sesli mesaj bırakın',
    'please stay on the line', 'stay on the line',
    'is on another line', 'on another line',
    'available',
    'get back to you', 'i\'ll get back to you'
  ];

  const phoneNumberPattern1 = /[\d\s\.\-\(\)]{3,}(can\'t take|can t take|can t take|leave|message|unavailable|voicemail|right now)/i;
  const phoneNumberPattern2 = /[\d\s\.\-\(\)]{3,}(cant take|leave|message|unavailable|voicemail|right now)/i;
  const isPhoneNumberPattern = phoneNumberPattern1.test(userText) || phoneNumberPattern2.test(userText);

  const hasVoicemailPhrase = voicemailIndicators.some(p =>
    lowerUserText.includes(p) ||
    lowerSummary.includes(p) ||
    lowerUserText.includes(p.replace("'", " ")) ||
    lowerUserText.includes(p.replace("'", ""))
  );

  const isOnlyAvailable = userWordCount === 1 && lowerUserText.trim() === 'available';

  const hasPositiveEngagementForVoicemail = lowerUserText.includes('yeah') ||
    lowerUserText.includes('yes') ||
    lowerUserText.includes('yep') ||
    lowerUserText.includes('yea') ||
    lowerUserText.includes('sure') ||
    lowerUserText.includes('okay') ||
    lowerUserText.includes('ok') ||
    lowerSummary.includes('interested') ||
    lowerSummary.includes('considering');

  const hasAvailableAndStayOnLine = lowerUserText.includes('available') &&
    (lowerUserText.includes('stay on the line') ||
      lowerUserText.includes('please stay')) &&
    !hasPositiveEngagementForVoicemail;

  const hasAnotherLineAndLeaveMessage = (lowerUserText.includes('is on another line') ||
    lowerUserText.includes('on another line')) &&
    (lowerUserText.includes('leave your message') ||
      lowerUserText.includes('leave a message') ||
      lowerUserText.includes('after the tone') ||
      lowerUserText.includes('after the beep'));

  const hasJustLeaveMessageAfterTone = (lowerUserText.includes('just leave') ||
    lowerUserText.includes('leave your message')) &&
    (lowerUserText.includes('after the tone') ||
      lowerUserText.includes('after the beep') ||
      lowerUserText.includes('at the tone'));

  if (!hasCallbackRequest && (isPhoneNumberPattern ||
    (hasVoicemailPhrase && userWordCount <= 25) ||
    isOnlyAvailable ||
    hasAvailableAndStayOnLine ||
    hasAnotherLineAndLeaveMessage ||
    hasJustLeaveMessageAfterTone)) {
    return 1;
  }

  // === RULE 3C: User unavailable/unreachable ===
  const unavailablePatterns = [
    'can\'t talk', 'can\'t speak',
    'unavailable', 'unreachable', 'not available', 'busy right now',
    'in a meeting', 'in meeting', 'can\'t talk now', 'can\'t speak now',
    'not right now', 'later', 'call back later',
    'müsait değilim', 'konuşamam', 'aramayın', 'sonra ara'
  ];

  const userUnavailable =
    unavailablePatterns.some(p => lowerUserText.includes(p)) ||
    unavailablePatterns.some(p => lowerSummary.includes(p)) ||
    (lowerSummary.includes('unavailable') && !hasVoicemailPhrase) ||
    (lowerSummary.includes('unreachable') && !hasVoicemailPhrase);

  if (userUnavailable && !hasVoicemailPhrase && !hasCallbackRequest) {
    return Math.min(originalScore, 2);
  }

  // === RULE 4: Strong negative indicators ===
  const strongNegativePatterns = [
    'not interested', 'no thanks', 'no thank you', 'don\'t want',
    'not for me', 'don\'t need', 'no need', 'i\'m not',
    'ilgilenmiyorum', 'istemiyorum', 'hayır teşekkürler',
    'hayır', 'yok', 'gerek yok', 'istemedim', 'istemiş değilim',
    'no i don\'t', 'i don\'t want', 'i\'m not interested',
    'not right now', 'maybe later',
    'can\'t afford', 'cant afford', 'can t afford', 'cannot afford',
    'can\'t pay', 'cant pay', 'can t pay', 'cannot pay',
    'too expensive', 'too much', 'afford', 'expensive',
    'param yok', 'karşılayamam', 'pahalı', 'çok pahalı'
  ];
  const userDeclined = strongNegativePatterns.some(p => lowerUserText.includes(p));
  const hasFinancialRejection = hasFinancialRejectionEarly;

  // === RULE 4.5: Aggressive/hostile language ===
  const aggressivePatterns = [
    'fucking', 'fuck', 'mental', 'crazy', 'ridiculous', 'stupid', 'annoying',
    'that\'s mental', 'that\'s crazy', 'that\'s ridiculous', 'that\'s stupid',
    'what the hell', 'what the fuck', 'are you kidding', 'are you serious',
    'rahatsız ediyorsunuz', 'sinir bozucu', 'saçma', 'aptal'
  ];
  const hasAggressiveLanguage = aggressivePatterns.some(p => lowerUserText.includes(p));

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

  if (hasAggressiveLanguage || strongNegativeSentiment) {
    return Math.min(originalScore, 2);
  }

  // === RULE 5: Summary indicates not interested ===
  const summaryIndicatesNotInterested =
    lowerSummary.includes('not interested') ||
    lowerSummary.includes('declined') ||
    lowerSummary.includes('refused') ||
    lowerSummary.includes('rejected') ||
    lowerSummary.includes('ilgilenmedi') ||
    lowerSummary.includes('reddetti') ||
    lowerSummary.includes('said no') ||
    lowerSummary.includes('not want') ||
    lowerSummary.includes('explicitly stated "no"') ||
    lowerSummary.includes('repeatedly declined') ||
    lowerSummary.includes('denied') ||
    lowerSummary.includes('lack of interest') ||
    (lowerSummary.includes('can\'t afford') || lowerSummary.includes('cant afford') ||
      lowerSummary.includes('cannot afford') || lowerSummary.includes('can t afford')) ||
    (lowerSummary.includes('afford') && (lowerSummary.includes('can\'t') || lowerSummary.includes('cannot')));

  const positiveEngagementPatterns = [
    'yeah', 'yes', 'yep', 'yea', 'sure', 'okay', 'interested', 'considering',
    'i want', 'i need', 'i\'d like', 'i would like', 'tell me', 'explain',
    'i said yes', 'said yes', 'i said yeah', 'said yeah',
    'for how much', 'how much', 'what\'s the price', 'whats the price', 'what is the price',
    'how much does it cost', 'how much is it', 'what does it cost',
    'if i\'m interested', 'if im interested', 'if i am interested',
    'what should i do', 'what do i do', 'what should i do if',
    'i\'m interested', 'im interested', 'i am interested',
    'i\'m in town', 'im in town', 'i am in town',
    'all good', 'it\'s all good', 'its all good'
  ];
  const hasPositiveEngagement = positiveEngagementPatterns.some(p => lowerUserText.includes(p));
  const multipleYeah = (lowerUserText.match(/\b(yeah|yes|yep|yea)\b/g) || []).length >= 2;

  const hasExplicitConfirmation = lowerUserText.includes('i said yes') ||
    lowerUserText.includes('said yes') ||
    lowerUserText.includes('i said yeah') ||
    lowerUserText.includes('said yeah');

  const hasPriceQuestion = lowerUserText.includes('how much') ||
    lowerUserText.includes('for how much') ||
    lowerUserText.includes('what\'s the price') ||
    lowerUserText.includes('whats the price') ||
    lowerUserText.includes('what is the price') ||
    lowerUserText.includes('how much does') ||
    lowerUserText.includes('how much is') ||
    lowerUserText.includes('what does it cost');

  const hasEngagementQuestion = lowerUserText.includes('what should i do') ||
    lowerUserText.includes('what do i do') ||
    lowerUserText.includes('if i\'m interested') ||
    lowerUserText.includes('if im interested') ||
    lowerUserText.includes('if i am interested');

  const summaryShowsInterest = lowerSummary.includes('considering') ||
    lowerSummary.includes('interested') ||
    lowerSummary.includes('open to');

  if (!hasFinancialRejection && (hasExplicitConfirmation || hasPriceQuestion || hasEngagementQuestion)) {
    const strongSignalCount = (hasExplicitConfirmation ? 1 : 0) +
      (hasPriceQuestion ? 1 : 0) +
      (hasEngagementQuestion ? 1 : 0);

    if (hasExplicitConfirmation || (hasPriceQuestion && hasPositiveEngagement)) {
      if (strongSignalCount >= 2) return Math.max(originalScore, 9);
      return Math.max(originalScore, 8);
    } else if (hasPriceQuestion || hasEngagementQuestion) {
      if (hasPriceQuestion && hasEngagementQuestion) return Math.max(originalScore, 8);
      return Math.max(originalScore, 7);
    }
  }

  if (!hasFinancialRejection && summaryShowsInterest && (multipleYeah || hasPositiveEngagement)) {
    if (multipleYeah && summaryShowsInterest) return Math.max(originalScore, 9);
    else if (hasPositiveEngagement && summaryShowsInterest) return Math.max(originalScore, 8);
  }

  if (!hasFinancialRejection &&
    (hasPositiveEngagement || multipleYeah || summaryShowsInterest ||
      hasExplicitConfirmation || hasPriceQuestion || hasEngagementQuestion) &&
    (userDeclined || summaryIndicatesNotInterested)) {
    if (hasExplicitConfirmation || hasPriceQuestion || multipleYeah ||
      (hasPositiveEngagement && summaryShowsInterest)) {
      return Math.max(originalScore, 7);
    } else if (hasPositiveEngagement || hasEngagementQuestion || summaryShowsInterest) {
      return Math.max(originalScore, 6);
    }
  }

  if ((userDeclined || summaryIndicatesNotInterested) && !hasCallbackRequest) {
    if (lowerSummary.includes('not interested') && lowerSummary.includes('explicitly')) {
      return Math.min(originalScore, 3);
    }
    return Math.min(originalScore, 4);
  }

  // === RULE 6: User said "no" ===
  const noCount = (lowerUserText.match(/\bno\b/g) || []).length;
  const hayirCount = (lowerUserText.match(/\bhayır\b/g) || []).length;
  const totalNoCount = noCount + hayirCount;

  const explicitRejection =
    lowerUserText.includes('i said no') ||
    lowerUserText.includes('i told you no') ||
    lowerUserText.includes('i already said no') ||
    lowerUserText.includes('dedim hayır') ||
    lowerUserText.includes('söyledim hayır');

  // === RULE 6A: Long detailed conversations with concerns ===
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

  if (isLongDetailedConversation &&
    (hasDetailedConcerns || hasAskedQuestions || hasPreviousEngagement) &&
    !hasFinancialRejection &&
    !explicitRejection) {
    return Math.max(originalScore, 5);
  }

  const strongPositivePatterns = [
    'i\'m gonna hear', 'i\'ll hear', 'tell me more', 'explain', 'i want to hear',
    'i\'d like to', 'i would like', 'sure', 'yes', 'okay', 'yeah', 'yea', 'yep',
    'interested', 'i need', 'i want', 'solution', 'help me',
    'dinleyeceğim', 'anlat', 'açıkla', 'istiyorum', 'ihtiyacım var',
    'open to', 'considering', 'finding a solution', 'would be grateful',
    'yeah yeah', 'yes yes', 'yeah i', 'yes i'
  ];
  const hasStrongPositive = strongPositivePatterns.some(p => lowerUserText.includes(p));

  const summaryPositiveIndicators =
    lowerSummary.includes('open to hearing') ||
    lowerSummary.includes('open to') ||
    lowerSummary.includes('considering') ||
    lowerSummary.includes('finding a solution') ||
    lowerSummary.includes('wants to hear') ||
    lowerSummary.includes('interested in learning') ||
    lowerSummary.includes('changed their mind');

  if (!hasFinancialRejection && (hasStrongPositive || summaryPositiveIndicators) && totalNoCount <= 3 && !explicitRejection) {
    if (hasStrongPositive && summaryPositiveIndicators) return Math.max(originalScore, 8);
    else if (hasStrongPositive) return Math.max(originalScore, 7);
    else if (summaryPositiveIndicators) return Math.max(originalScore, 6);
  }

  if (!hasFinancialRejection) {
    const yeahCount = (lowerUserText.match(/\b(yeah|yes|yep|yea)\b/g) || []).length;
    if (yeahCount >= 2 && totalNoCount <= 1 && !explicitRejection && originalScore >= 7) {
      return Math.max(originalScore, 8);
    }
  }

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

    if (explicitRejection || (totalNoCount >= 3 && !hasPositive)) {
      return Math.min(originalScore, 4);
    }
    if (!hasPositive) {
      return Math.min(originalScore, 5);
    }
  }

  // === RULE 7: Only greeting ===
  const onlyGreeting = userWordCount <= 2 &&
    (lowerUserText.includes('hello') || lowerUserText.includes('hi') ||
      lowerUserText.includes('hey') || lowerUserText.includes('merhaba') ||
      lowerUserText.includes('alo') || lowerUserText.includes('efendim'));
  if (onlyGreeting) {
    return Math.min(originalScore, 3);
  }

  // === RULE 7A: Language mismatch ===
  const languageMismatchPatterns = [
    'someone speak spanish', 'speak spanish', 'spanish', 'español',
    'someone speak turkish', 'speak turkish', 'türkçe', 'turkish',
    'someone speak', 'speak another language', 'different language',
    'i don\'t speak', 'i dont speak', 'no hablo', 'no entiendo',
    'farklı dil', 'başka dil', 'türkçe konuş', 'spanish speaker'
  ];
  const hasLanguageMismatch = languageMismatchPatterns.some(p =>
    lowerUserText.includes(p) || lowerSummary.includes(p)
  );
  if (hasLanguageMismatch && userWordCount <= 10) return Math.min(originalScore, 3);
  if (hasLanguageMismatch) return Math.min(originalScore, 4);

  // === RULE 8: Wrong number ===
  const wrongNumberPatterns = [
    'wrong number', 'yanlış numara', 'wrong person', 'yanlış kişi',
    'who is this', 'kimsiniz', 'tanımıyorum', 'don\'t know'
  ];
  const isWrongNumber = wrongNumberPatterns.some(p => lowerUserText.includes(p) || lowerSummary.includes(p));
  if (isWrongNumber) return Math.min(originalScore, 2);

  // === RULE 9: Hostile responses ===
  const hostilePatterns = [
    'stop calling', 'don\'t call', 'remove me', 'unsubscribe',
    'aramayın', 'arama', 'rahatsız etmeyin', 'kaldır beni'
  ];
  const isHostile = hostilePatterns.some(p => lowerUserText.includes(p) || lowerSummary.includes(p));
  if (isHostile) return Math.min(originalScore, 2);

  // === RULE 10: Minimal engagement despite longer duration ===
  if (callDuration > 30 && userWordCount <= 15 && originalScore > 6) {
    return Math.min(originalScore, 5);
  }

  // === RULE 10A: Very minimal passive responses ===
  const minimalPassiveResponses = [
    'okay', 'ok', 'alright', 'fine', 'sure', 'yeah', 'yes', 'yep',
    'hello', 'hi', 'hey', 'hello?', 'hi?', 'hey?',
    'tamam', 'olur', 'evet', 'hayır', 'merhaba'
  ];
  const userWordsArray = userText.trim().split(/\s+/).filter(w => w.length > 0);
  const allMinimalResponses = userWordsArray.length > 0 &&
    userWordsArray.every(word => {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
      return minimalPassiveResponses.includes(cleanWord) || cleanWord.length <= 2;
    });

  if (allMinimalResponses && userWordCount <= 8 && originalScore > 4) {
    return Math.min(originalScore, 3);
  }
  if (userWordCount <= 5 && allMinimalResponses && originalScore > 3) {
    return Math.min(originalScore, 3);
  }

  return originalScore;
}

// ---------------------------------------------------------------------------
// extractUserText – pulls user speech from a transcript string
// ---------------------------------------------------------------------------

export function extractUserText(transcript: string): { userTextRaw: string; userText: string } {
  const lower = (transcript || '').toLowerCase();
  const userParts = lower.split(/ai:/i).filter(part => part.includes('user:'));
  const userTextRaw = userParts.map(p => p.split('user:')[1] || '').join(' ').toLowerCase();
  const userText = userTextRaw.replace(/[.,!?;:'"]/g, ' ').replace(/\s+/g, ' ');
  return { userTextRaw, userText };
}

// ---------------------------------------------------------------------------
// computeCallScore – runs the FULL pipeline, returns display string + numeric
// ---------------------------------------------------------------------------

export function computeCallScore(call: CallScoringInput): CallScoreResult {
  const transcript = (call.transcript || '').toLowerCase();
  const callSummary = (call.summary || '').toLowerCase();
  const evalSummary = (call.evaluation_summary || '').toLowerCase();
  const metadata = (call.metadata || {}) as Record<string, unknown>;
  const endedReason = (metadata.endedReason as string || '').toLowerCase();

  // Extract user text from transcript
  const { userTextRaw, userText } = extractUserText(call.transcript || '');

  // User word count
  const userWords = userText.trim().split(/\s+/).filter(w => w.length > 0);
  const userWordCount = userWords.length;

  // User response count
  const userResponses = (transcript.match(/user:/gi) || []).length;

  // --- Step 1: parse raw score ---
  const parsedScore = parseScore(call.evaluation_score);

  // --- Step 2: estimate if no DB score ---
  const estimatedScoreValue = estimateScore(call);
  const rawScore = parsedScore !== null ? parsedScore : estimatedScoreValue;

  // --- Step 3: adjust based on content ---
  const effectiveScore = rawScore !== null
    ? adjustScoreBasedOnContent(rawScore, transcript, callSummary, userText, call.duration)
    : null;

  // --- Step 4: voicemail detection ---
  const voicemailSystemPhrases = [
    'voicemail', 'sesli mesaj',
    'can\'t take your call', 'can\'t take call', 'can\'t take the call',
    'can\'t take call right now', 'can\'t take your call right now', 'can\'t take the call right now',
    'please leave a message', 'leave a message', 'leave your message', 'after the beep',
    'after the tone', 'at the tone',
    'unavailable to take your call', 'not available to take your call',
    'mesaj bırakın', 'bip sesinden sonra', 'sesli mesaj bırakın',
    'record your message',
    'unable to take your call', 'can t take your call', 'cannot take your call',
    'mailbox',
    'press hash', 'hang up', 'just hang up', 'when you re done', 'when you\'re done',
    'please stay on the line', 'stay on the line',
    'is on another line', 'on another line'
  ];

  const meaningfulUserPatterns = [
    'who is this', 'who are you', 'which company', 'what do you want',
    'call me', 'call back', 'another time', 'not interested', 'no thanks',
    'yes', 'no', 'okay', 'sure', 'hello', 'hi', 'what', 'why', 'how much',
    'i\'m', 'i am', 'i don\'t', 'i cant', 'i can\'t',
    'kimsiniz', 'ne istiyorsunuz', 'sonra ara', 'ilgilenmiyorum', 'hayır', 'evet'
  ];

  const userSaidMeaningful = meaningfulUserPatterns.some(p => userText.includes(p));

  const phoneNumberVoicemailPattern1 = /[\d\s\.\-\(\)]{3,}(can\'t take|can t take|leave|message|unavailable|voicemail|right now)/i;
  const phoneNumberVoicemailPattern2 = /[\d\s\.\-\(\)]{3,}(cant take|leave|message|unavailable|voicemail|right now)/i;
  const transcriptLower = transcript;
  const isPhoneNumberVoicemail = phoneNumberVoicemailPattern1.test(userText) ||
    phoneNumberVoicemailPattern2.test(userText) ||
    phoneNumberVoicemailPattern1.test(userTextRaw) ||
    phoneNumberVoicemailPattern2.test(userTextRaw) ||
    phoneNumberVoicemailPattern1.test(transcriptLower) ||
    phoneNumberVoicemailPattern2.test(transcriptLower);

  const hasVoicemailInUserText = voicemailSystemPhrases.some(p => {
    const normalized = p.replace(/'/g, ' ').replace(/\s+/g, ' ');
    const noApostrophe = p.replace(/'/g, '');
    return userText.includes(p) ||
      userTextRaw.includes(p) ||
      userText.includes(normalized) ||
      userText.includes(noApostrophe) ||
      userTextRaw.includes(normalized) ||
      userTextRaw.includes(noApostrophe);
  });

  const userOnlyVoicemailPhrases = (hasVoicemailInUserText || isPhoneNumberVoicemail) && !userSaidMeaningful;

  const isOnlyAvailable = userWordCount === 1 && userText.trim() === 'available';

  const hasPositiveEngagement = userText.includes('yeah') ||
    userText.includes('yes') ||
    userText.includes('yep') ||
    userText.includes('yea') ||
    userText.includes('sure') ||
    userText.includes('okay') ||
    userText.includes('ok');

  const hasAvailableAndStayOnLine = userText.includes('available') &&
    (userText.includes('stay on the line') ||
      userText.includes('please stay')) &&
    !hasPositiveEngagement;

  const hasAnotherLineAndLeaveMessage = (userText.includes('is on another line') ||
    userText.includes('on another line')) &&
    (userText.includes('leave your message') ||
      userText.includes('leave a message') ||
      userText.includes('after the tone') ||
      userText.includes('after the beep'));

  const hasJustLeaveMessageAfterTone = (userText.includes('just leave') ||
    userText.includes('leave your message')) &&
    (userText.includes('after the tone') ||
      userText.includes('after the beep') ||
      userText.includes('at the tone'));

  const hasVoicemailPhrases = voicemailSystemPhrases.some(p => transcript.includes(p));
  const isRealConversation = userSaidMeaningful;

  const isVoicemail = isPhoneNumberVoicemail ||
    (hasVoicemailInUserText && !userSaidMeaningful) ||
    (hasVoicemailPhrases && !isRealConversation) ||
    (userOnlyVoicemailPhrases) ||
    isOnlyAvailable ||
    hasAvailableAndStayOnLine ||
    hasAnotherLineAndLeaveMessage ||
    hasJustLeaveMessageAfterTone;

  const isSilenceTimeout = endedReason === 'silence-timed-out';
  const isShortCall = (call.duration || 0) < 30;
  const likelyVoicemailByBehavior = isSilenceTimeout && isShortCall && !isRealConversation;
  const isVoicemailFinal = isVoicemail || likelyVoicemailByBehavior;

  // --- Step 5: failed call detection ---
  const failedPatterns = [
    'no-answer', 'customer-did-not-answer', 'busy', 'customer-busy', 'failed',
    'ulaşılamadı', 'meşgul', 'cevap yok', 'hat meşgul',
    'bağlantı kurulamadı', 'bağlanamadı', 'aranılamadı', 'cevaplanmadı'
  ];
  const textToCheck = `${endedReason} ${evalSummary} ${callSummary}`;
  const isFailedByText = failedPatterns.some(p => textToCheck.includes(p));
  const isVeryShortCall = (call.duration || 0) < 15;
  const aiOnlySpoke = transcript.includes('ai:') && userResponses === 0;
  const customerHungUpQuickly = endedReason === 'customer-ended-call' && isVeryShortCall;
  const userNeverResponded = userWordCount === 0;

  const isFailedCall = isFailedByText ||
    effectiveScore === null ||
    userNeverResponded ||
    (customerHungUpQuickly && !isRealConversation) ||
    (aiOnlySpoke && isVeryShortCall);

  // --- Final result ---
  if (isVoicemailFinal) {
    return { display: "V", numericScore: null };
  }
  if (isFailedCall) {
    return { display: "F", numericScore: null };
  }

  const displayScore = effectiveScore || 5;
  return { display: displayScore.toString(), numericScore: displayScore };
}
