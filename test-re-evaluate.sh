#!/bin/bash

# Test script for re-evaluating all calls
# Usage: ./test-re-evaluate.sh [userId]

BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_ID="${1:-}"
FORCE="${FORCE:-true}"
LIMIT="${LIMIT:-100}"
BATCH_SIZE="${BATCH_SIZE:-20}"

echo "🔄 Re-evaluating calls with improved prompts..."
echo "   Base URL: $BASE_URL"
echo "   Force mode: $FORCE"
echo "   Limit: $LIMIT"
echo "   Batch size: $BATCH_SIZE"
if [ -n "$USER_ID" ]; then
  echo "   User ID: $USER_ID"
fi
echo ""

PAYLOAD="{\"force\": $FORCE, \"limit\": $LIMIT, \"batchSize\": $BATCH_SIZE"
if [ -n "$USER_ID" ]; then
  PAYLOAD="$PAYLOAD, \"userId\": \"$USER_ID\""
fi
PAYLOAD="$PAYLOAD}"

echo "📤 Sending request..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/calls/re-evaluate-all" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Success!"
  echo "$RESPONSE" | jq '.'
else
  echo "❌ Error:"
  echo "$RESPONSE" | jq '.'
fi
