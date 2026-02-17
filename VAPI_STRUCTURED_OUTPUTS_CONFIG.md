# VAPI Structured Outputs - Purpose ve Description

## 1. Success Evaluation (Numeric Scale) Structured Output

### Purpose (What is the purpose of this structured output?)
```
Evaluate the success of the call on a 1-10 numeric scale, determine the outcome, sentiment, and provide relevant tags for lead qualification and follow-up actions.
```

### Description (Detailed prompt)
```
Analyze this call and evaluate its success. You must fill ALL required fields in the structured output.

CRITICAL RULES FOR SCORING (1-10 scale):
1. If caller NEVER responded or only AI spoke → score 1, outcome "no_answer"
2. If voicemail system answered OR customer said "leave me a message", "you can leave me a brief message", "leave a message", "I'll get back to you" → score 1, outcome "voicemail" (CRITICAL: "leave me a message" = voicemail, NOT a conversation)
3. If customer said "can't take your call", "can't talk", "unavailable", "busy right now", "in a meeting" → score 1-2, outcome "unavailable" (this is NOT a successful call, user is not available to engage)
4. If call lasted <15 seconds with no real conversation → score 1 or 2
5. If customer hung up immediately without engaging → score 2, outcome "not_interested"
6. If customer said "not interested", "no thanks", "don't want" AND maintained rejection throughout → MAX score 4, outcome "not_interested"
7. If customer barely spoke (only greetings like "hello", "hi") → MAX score 3
8. If customer said multiple "no" WITHOUT any positive engagement later → MAX score 5
9. If call duration <20 seconds and customer showed no interest → MAX score 4
10. If customer asked for different language (e.g., "someone speak Spanish", "speak Turkish") → MAX score 3-4 (language mismatch = not interested in current conversation)
11. If customer only gave minimal passive responses (just "okay", "hello?", "yes" without context) → MAX score 3 (no real engagement)
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

OUTCOME VALUES (choose the most appropriate):
- "appointment_set": Appointment or meeting was scheduled
- "callback_requested": Customer asked to be called back later
- "interested": Customer showed genuine interest but no commitment yet
- "not_interested": Customer explicitly declined or showed no interest
- "needs_info": Customer needs more information before deciding
- "no_answer": Customer never answered the call
- "voicemail": Call went to voicemail
- "wrong_number": Wrong number or person reached
- "busy": Line was busy or customer was unavailable

SENTIMENT VALUES:
- "positive": Customer was positive, engaged, interested
- "neutral": Customer was neutral, neither positive nor negative
- "negative": Customer was negative, hostile, or clearly not interested

TAGS (add relevant tags from this list):
- "appointment_set", "callback_requested", "follow_up_needed"
- "hot_lead", "warm_lead", "cold_lead"
- "price_concern", "timing_concern", "needs_info"
- "interested", "not_interested", "highly_interested"
- "successful_call", "failed_call", "voicemail", "no_answer"
- "referral", "complaint", "vip_customer"

OBJECTIONS (optional - list any objections raised):
- "price_concern": Customer mentioned price as an issue
- "timing_concern": Customer mentioned timing as an issue
- "not_needed": Customer said they don't need the service
- "already_have": Customer already has similar service

NEXT ACTION (optional - recommended follow-up):
- "Schedule appointment"
- "Send information"
- "Follow up in X days"
- "No follow-up needed"
```

---

## 2. Call Summary Structured Output

### Purpose (What is the purpose of this structured output?)
```
Generate a concise summary of the call conversation in 2-3 sentences, capturing key points, customer interest level, decisions made, and next steps for the sales team.
```

### Description (Detailed prompt)
```
Create a concise summary of this call conversation. The summary should be 2-3 sentences maximum and written in the same language as the call.

The summary MUST include:
1. Customer's interest level and engagement (interested, not interested, needs info, etc.)
2. Key conversation points (what was discussed, questions asked, concerns raised)
3. Decisions or commitments made (appointment set, callback requested, information to be sent, etc.)
4. Next steps (what should happen next - follow-up, send info, schedule appointment, etc.)

IMPORTANT GUIDELINES:
- Keep it concise: 2-3 sentences maximum
- Be specific: Mention concrete details (e.g., "Customer wants appointment on Monday morning" not just "Customer wants appointment")
- Include customer quotes if relevant (e.g., "Customer said 'I'm interested but need to check my schedule'")
- Mention any objections or concerns raised
- Always include next steps or recommended action
- Write in the same language as the call (Turkish for Turkish calls, English for English calls)
- If call was voicemail or no answer, state that clearly
- If customer was unavailable or busy, mention that

EXAMPLES:

Good summary:
"Müşteri randevu almak istiyor ancak önce fiyat bilgisi görmek istiyor. Pazartesi sabahı uygun olduğunu belirtti. Fiyat listesi WhatsApp üzerinden gönderilecek ve sonrasında randevu planlanacak."

Good summary:
"Customer showed interest in the service and asked several questions about pricing and availability. They mentioned they need to check their schedule and requested a callback next week. Follow up in 3-4 days to schedule appointment."

Bad summary (too vague):
"Customer was interested. Will follow up." (Too vague, no details)

Bad summary (too long):
"Müşteri aradı ve randevu hakkında sorular sordu. Fiyat bilgisi istedi. Pazartesi uygun olduğunu söyledi. WhatsApp'tan bilgi göndereceğiz. Sonra randevu planlayacağız. Müşteri çok ilgili görünüyordu." (Too long, should be 2-3 sentences)
```

---

## VAPI Dashboard'da Nasıl Kullanılır?

### Success Evaluation Structured Output için:

1. **Name:** `successEvaluation`
2. **Purpose:** Yukarıdaki "Purpose" kısmını kopyalayıp yapıştırın
3. **Description:** Yukarıdaki "Description" kısmını kopyalayıp yapıştırın
4. **Schema:** JSON Schema'yı `VAPI_STRUCTURED_OUTPUTS.md` dosyasından kopyalayın

### Call Summary Structured Output için:

1. **Name:** `callSummary`
2. **Purpose:** Yukarıdaki "Purpose" kısmını kopyalayıp yapıştırın
3. **Description:** Yukarıdaki "Description" kısmını kopyalayıp yapıştırın
4. **Schema:** JSON Schema'yı `VAPI_STRUCTURED_OUTPUTS.md` dosyasından kopyalayın

## Notlar

- **Purpose** alanı kısa ve öz olmalı (1-2 cümle)
- **Description** alanı detaylı prompt içermeli (yukarıdaki gibi)
- Her iki structured output da arama sona erdiğinde otomatik olarak doldurulmalı
- Asistan system prompt'una şunu ekleyin: "Arama sona erdiğinde, successEvaluation ve callSummary structured output'larını mutlaka doldur."
