# Outbound Calls - International Support

## Overview
Our system now fully supports international outbound calls with E.164 phone number formatting and explicit caller ID configuration.

## How It Works

### 1. Adding Leads with International Numbers
- **Dashboard**: When adding a lead, enter phone numbers in E.164 format
- **Examples**:
  - France: `+33768163591`
  - USA/Canada: `+12125551234`
  - Turkey: `+903129114094`
- The system automatically normalizes and validates the number when making the call

### 2. Making Outbound Calls

#### From Dashboard (Leads Page)
1. Navigate to Leads page
2. Click the phone icon (📞) next to any lead
3. The system will:
   - Normalize the phone number to E.164 format
   - Set the caller ID to `+903129114094` (Netgsm verified number)
   - Make the call via VAPI API

#### Via API
**Endpoint**: `POST /api/outreach/execute`

**Request Body**:
```json
{
  "lead_id": "lead-uuid",
  "channel": "call",
  "direct_call": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Arama başlatıldı: John Doe (+33768163591)",
  "vapi_call_id": "call-uuid",
  "lead_id": "lead-uuid"
}
```

### 3. Phone Number Normalization

The system automatically handles various input formats:

**Supported Input Formats**:
- `+33768163591` → `+33768163591` ✓
- `0033768163591` → `+33768163591` ✓
- `+33 7 68 16 35 91` → `+33768163591` ✓
- `0312 911 40 94` → `+903129114094` ✓ (Turkish numbers)
- `+1 (212) 555-1234` → `+12125551234` ✓

**Invalid Formats** (will be rejected):
- `123` ❌ (too short, no country code)
- `abc` ❌ (non-numeric)
- `+0` ❌ (cannot start with +0)

### 4. Country Code Handling

#### +1 (USA/Canada)
- **No distinction needed**: E.164 format uses `+1` for both USA and Canada
- The carrier (Netgsm) handles routing based on the area code
- Example: `+12125551234` (USA) or `+14165551234` (Canada)
- The system doesn't need to differentiate - just use E.164 format

#### Other Countries
- France: `+33`
- UK: `+44`
- Germany: `+49`
- Turkey: `+90`
- etc.

### 5. Caller ID Configuration

**Default Caller ID**: `+903129114094` (Netgsm verified number)

This is automatically included in all outbound calls via the `from` field in the VAPI API request. This ensures:
- International carriers can properly route the call
- The caller ID is recognized and displayed correctly
- Prevents "Customer Busy" errors for international calls

### 6. Error Handling

If a phone number cannot be normalized:
- **User sees**: "Geçersiz telefon numarası formatı: [number]. Lütfen E.164 formatında girin (örn: +903129114094, +33123456789)"
- **Logs show**: `[executeCallDirect] Phone normalization failed for [number]: [error]`

### 7. Logging

All outbound calls are logged with:
```javascript
{
  to: "+33768163591",           // Normalized E.164 number
  from: "+903129114094",        // Caller ID
  assistantId: "...",
  phoneNumberId: "...",
  lead_id: "...",
  original_phone: "+33 7 68 16 35 91",  // Original input
}
```

## Technical Details

### Files Modified
1. **`lib/phone-utils.ts`**: Phone number normalization and validation utilities
2. **`app/api/outreach/execute/route.ts`**: Updated `executeCallDirect()` and `executeCall()` functions

### Key Functions
- `normalizeToE164(input, defaultCountry)`: Converts various formats to E.164
- `validateAndNormalize(input, defaultCountry)`: Validates and normalizes, throws on error
- `isValidE164(phoneNumber)`: Checks if a number is valid E.164 format

### VAPI API Payload
```json
{
  "assistantId": "...",
  "phoneNumberId": "...",
  "customer": {
    "number": "+33768163591",  // Normalized E.164
    "name": "John Doe"
  },
  "from": "+903129114094",     // Explicit caller ID
  "metadata": {
    "lead_id": "...",
    "user_id": "...",
    "original_phone": "+33 7 68 16 35 91",
    "normalized_phone": "+33768163591"
  }
}
```

## Testing

To test international calls:
1. Add a lead with an international number (e.g., `+33768163591`)
2. Click the call button
3. Check server logs for the normalized payload
4. Verify the call is initiated successfully in VAPI dashboard

## Troubleshooting

**Issue**: "Customer Busy" error for international calls
- **Solution**: Ensure `from` field is set (now automatic)
- **Check**: Verify `DEFAULT_CALLER_ID` is correct in `lib/phone-utils.ts`

**Issue**: Phone number rejected
- **Solution**: Ensure number is in E.164 format (starts with `+` and country code)
- **Check**: Use the normalization function to convert your input
