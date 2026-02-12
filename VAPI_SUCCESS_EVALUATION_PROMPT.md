# VAPI Success Evaluation Prompt

Bu prompt'u Vapi Assistant konfigürasyonunuzdaki `successEvaluation` alanına ekleyin.

## Prompt:

```
Analyze this call and evaluate its success. Respond with ONLY valid JSON. 

CRITICAL RULES FOR SCORING (1-10 scale):
1. If caller NEVER responded or only AI spoke → score 1, outcome "no_answer"
2. If voicemail system answered (beep, "leave message", "unavailable") → score 1, outcome "voicemail"
3. If customer said "can't take your call", "can't talk", "unavailable", "busy right now", "in a meeting" → score 1-2, outcome "unavailable" (this is NOT a successful call, user is not available to engage)
4. If call lasted <15 seconds with no real conversation → score 1 or 2
5. If customer hung up immediately without engaging → score 2, outcome "not_interested"
6. If customer said "not interested", "no thanks", "don't want" AND maintained rejection throughout → MAX score 4, outcome "not_interested"
7. If customer barely spoke (only greetings like "hello", "hi") → MAX score 3
8. If customer said multiple "no" WITHOUT any positive engagement later → MAX score 5
9. If call duration <20 seconds and customer showed no interest → MAX score 4
10. IMPORTANT: If customer initially said "no" but THEN showed positive engagement (e.g., "I'm gonna hear", "tell me more", "yeah", "open to", "considering", "finding a solution") → score 7-8 (this shows they changed their mind or are open to learning more)
11. ONLY give score 7-8 if customer showed GENUINE interest (asked questions, discussed details, engaged in conversation, OR changed their mind after initial hesitation)
12. ONLY give score 9-10 if appointment was set, sale was made, or strong commitment was given

Scoring (1-10):
- 1: No connection (voicemail, no answer, busy, only AI spoke, customer never responded, call <15 seconds)
- 2: Connected but immediately rejected (immediate hang up, "not interested" immediately, "wrong number", hostile)
- 3: Connected but minimal engagement (only greetings, barely spoke, no real conversation)
- 4: Connected but negative (said "not interested", "no thanks", declined, no engagement, call <20 seconds)
- 5: Neutral conversation (brief chat, listened but unclear interest, some "no" responses)
- 6: Neutral with some interest (listened, asked basic questions, but non-committal)
- 7: Positive interest (engaged conversation, asked questions, wants more info, showed genuine interest)
- 8: Strong interest (engaged, asked detailed questions, wants follow-up, discussed details)
- 9: Success (appointment set, callback scheduled, strong commitment, hot lead)
- 10: Great success (sale made, appointment confirmed, very strong commitment, VIP lead)

IMPORTANT:
- Be STRICT with high scores (7-10). Only give them if there's clear evidence of genuine interest or success.
- If customer said "can't take your call", "unavailable", "busy", "in a meeting" → score 1-2 (user is not available, this is NOT a successful engagement)
- If customer said "not interested" or similar AND maintained rejection throughout, NEVER give score > 4
- BUT: If customer initially said "no" but THEN showed positive engagement (e.g., "I'm gonna hear", "tell me more", "yeah", "open to", "considering"), this is POSITIVE - give score 7-8
- If call was very short (<20 seconds) and customer didn't engage, NEVER give score > 4
- If customer barely spoke (only greetings), NEVER give score > 3
- Consider call duration: very short calls (<20 seconds) cannot be highly successful
- Consider user engagement: if user said very few words, it cannot be a great call
- Pay attention to the FULL conversation: initial "no" followed by positive engagement (like "I'm gonna hear", "tell me more", "open to") indicates genuine interest - score 7-8
- NEVER give high scores (7-10) if user explicitly said they can't take the call or are unavailable - this is a failed connection, not a success

JSON format:
{
  "score": <1-10>,
  "outcome": "<appointment_set|callback_requested|interested|not_interested|needs_info|no_answer|voicemail|wrong_number|hung_up>",
  "sentiment": "<positive|neutral|negative>",
  "summary": "<1-2 sentence summary in call's language>",
  "tags": ["<relevant tags>"],
  "nextAction": "<recommended next step>"
}
```

## Kullanım:

1. Vapi Dashboard'a gidin
2. Assistant konfigürasyonunuzu açın
3. `successEvaluation` veya `analysis` alanını bulun
4. Yukarıdaki prompt'u ekleyin
5. Kaydedin

## Notlar:

- Bu prompt, daha sıkı kurallar içerir ve yüksek puanları sadece gerçek ilgi gösterildiğinde verir
- Kısa aramalar ve minimal etkileşimler için düşük puanlar verir
- "Not interested" gibi açık reddetmeler için maksimum 4 puan verir
