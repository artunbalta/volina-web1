/**
 * Script to re-evaluate all calls with new structured output format
 * Usage: npx tsx scripts/re-evaluate-all-calls.ts [userId]
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function reEvaluateAllCalls(userId?: string) {
  console.log('🔍 Finding calls to re-evaluate...');
  
  // Build query
  let query = supabase
    .from('calls')
    .select('id, created_at, evaluation_score, metadata, transcript, summary')
    .not('transcript', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (userId) {
    query = query.eq('user_id', userId);
    console.log(`📋 Filtering by user_id: ${userId}`);
  }

  const { data: calls, error } = await query;

  if (error) {
    console.error('❌ Error fetching calls:', error);
    return;
  }

  if (!calls || calls.length === 0) {
    console.log('✅ No calls found to re-evaluate');
    return;
  }

  console.log(`📊 Found ${calls.length} calls to check`);

  // Filter calls that need re-evaluation
  const callsNeedingReEvaluation = calls.filter(call => {
    const hasStructuredOutput = call.metadata?.structuredData && 
                                typeof call.metadata.structuredData === 'object' &&
                                (call.metadata.structuredData as Record<string, unknown>).successEvaluation;
    return !hasStructuredOutput;
  });

  console.log(`🔄 ${callsNeedingReEvaluation.length} calls need re-evaluation`);

  if (callsNeedingReEvaluation.length === 0) {
    console.log('✅ All calls already have structured output!');
    return;
  }

  // Ask for confirmation
  console.log(`\n⚠️  This will re-evaluate ${callsNeedingReEvaluation.length} calls.`);
  console.log('   This will make API calls to OpenAI and may take a while.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Re-evaluate calls in batches
  const batchSize = 5;
  let evaluated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < callsNeedingReEvaluation.length; i += batchSize) {
    const batch = callsNeedingReEvaluation.slice(i, i + batchSize);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(callsNeedingReEvaluation.length / batchSize)}...`);

    await Promise.all(batch.map(async (call) => {
      try {
        // Call the re-evaluate endpoint
        const response = await fetch(`http://localhost:3003/api/calls/re-evaluate-structured`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callId: call.id,
            force: false,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.error?.includes('already has structured output')) {
            skipped++;
            console.log(`⏭️  Skipped: ${call.id} (already has structured output)`);
          } else {
            failed++;
            console.error(`❌ Failed: ${call.id} - ${error.error || response.statusText}`);
          }
          return;
        }

        const result = await response.json();
        evaluated++;
        console.log(`✅ Evaluated: ${call.id} - Score: ${result.evaluation?.successEvaluation?.score || 'N/A'}`);

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failed++;
        console.error(`❌ Error evaluating ${call.id}:`, error);
      }
    }));
  }

  console.log(`\n✅ Re-evaluation complete!`);
  console.log(`   Evaluated: ${evaluated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${callsNeedingReEvaluation.length}`);
}

// Get userId from command line args
const userId = process.argv[2];

if (userId) {
  console.log(`👤 Re-evaluating calls for user: ${userId}`);
} else {
  console.log(`🌍 Re-evaluating calls for all users`);
}

reEvaluateAllCalls(userId).catch(console.error);
