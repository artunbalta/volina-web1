#!/bin/bash

# Re-evaluate all calls with new structured output format
# Usage: ./scripts/re-evaluate-all.sh [userId]

BASE_URL="http://localhost:3003"
USER_ID="${1:-}"

echo "🔍 Finding calls that need re-evaluation..."

# Step 1: Get calls that need re-evaluation
if [ -z "$USER_ID" ]; then
  echo "⚠️  No user_id provided. Getting calls for all users..."
  RESPONSE=$(curl -s "${BASE_URL}/api/calls/re-evaluate-structured?limit=1000")
else
  echo "👤 Getting calls for user: ${USER_ID}"
  RESPONSE=$(curl -s "${BASE_URL}/api/calls/re-evaluate-structured?userId=${USER_ID}&limit=1000")
fi

# Check if we got a valid response
if echo "$RESPONSE" | grep -q '"success":true'; then
  NEEDING_RE_EVAL=$(echo "$RESPONSE" | grep -o '"needingReEvaluation":[0-9]*' | grep -o '[0-9]*')
  TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
  
  echo "📊 Total calls: ${TOTAL}"
  echo "🔄 Calls needing re-evaluation: ${NEEDING_RE_EVAL}"
  
  if [ "$NEEDING_RE_EVAL" = "0" ]; then
    echo "✅ All calls already have structured output!"
    exit 0
  fi
  
  # Extract call IDs
  echo "$RESPONSE" | grep -o '"id":"[^"]*"' | grep -o '"[^"]*"' | tr -d '"' > /tmp/call_ids.txt
  CALL_COUNT=$(wc -l < /tmp/call_ids.txt | tr -d ' ')
  
  echo "📋 Found ${CALL_COUNT} calls to re-evaluate"
  echo ""
  echo "⚠️  This will make ${CALL_COUNT} API calls to OpenAI."
  echo "    Estimated time: ~${CALL_COUNT} seconds (1 call per second)"
  echo "    Press Ctrl+C to cancel, or wait 5 seconds to continue..."
  sleep 5
  
  # Step 2: Re-evaluate calls in batches
  BATCH_SIZE=5
  EVALUATED=0
  FAILED=0
  SKIPPED=0
  
  while IFS= read -r CALL_ID; do
    if [ -z "$CALL_ID" ]; then
      continue
    fi
    
    echo "🔄 Evaluating: ${CALL_ID}"
    
    RESULT=$(curl -s -X POST "${BASE_URL}/api/calls/re-evaluate-structured" \
      -H "Content-Type: application/json" \
      -d "{\"callId\":\"${CALL_ID}\",\"force\":true}")
    
    if echo "$RESULT" | grep -q '"success":true'; then
      SCORE=$(echo "$RESULT" | grep -o '"score":[0-9]*' | grep -o '[0-9]*' || echo "N/A")
      EVALUATED=$((EVALUATED + 1))
      echo "  ✅ Success - Score: ${SCORE}"
    elif echo "$RESULT" | grep -q "already has structured output"; then
      SKIPPED=$((SKIPPED + 1))
      echo "  ⏭️  Skipped (already has structured output)"
    else
      FAILED=$((FAILED + 1))
      ERROR=$(echo "$RESULT" | grep -o '"error":"[^"]*"' | head -1 || echo "Unknown error")
      echo "  ❌ Failed: ${ERROR}"
    fi
    
    # Rate limiting: wait 1 second between calls
    sleep 1
    
    # Progress update every 10 calls
    TOTAL_PROCESSED=$((EVALUATED + FAILED + SKIPPED))
    if [ $((TOTAL_PROCESSED % 10)) -eq 0 ]; then
      echo ""
      echo "📊 Progress: ${TOTAL_PROCESSED}/${CALL_COUNT} (✅ ${EVALUATED} | ❌ ${FAILED} | ⏭️  ${SKIPPED})"
      echo ""
    fi
  done < /tmp/call_ids.txt
  
  echo ""
  echo "✅ Re-evaluation complete!"
  echo "   ✅ Evaluated: ${EVALUATED}"
  echo "   ⏭️  Skipped: ${SKIPPED}"
  echo "   ❌ Failed: ${FAILED}"
  echo "   📊 Total: ${CALL_COUNT}"
  
  # Cleanup
  rm -f /tmp/call_ids.txt
else
  echo "❌ Error: Failed to get calls"
  echo "$RESPONSE"
  exit 1
fi
