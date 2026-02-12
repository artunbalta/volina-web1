const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findCall(name) {
  try {
    // Search for calls with the name
    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .ilike('caller_name', `%${name}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`\nFound ${calls?.length || 0} calls with "${name}" in name:\n`);

    // Filter for January 17 calls (checking both 2025 and 2026)
    const jan17Calls = (calls || []).filter(call => {
      const date = new Date(call.created_at);
      return date.getMonth() === 0 && date.getDate() === 17; // January = 0, day 17
    });

    // Show all calls with full details
    if (calls && calls.length > 0) {
      console.log(`\n=== ALL CALLS FOR "${name}" (${calls.length}) ===\n`);
      calls.forEach((call, idx) => {
        const date = new Date(call.created_at);
        console.log(`\n${idx + 1}. ${call.caller_name || 'Unknown'}`);
        console.log(`   ID: ${call.id}`);
        console.log(`   Date: ${date.toLocaleString()}`);
        console.log(`   Score: ${call.evaluation_score ?? 'N/A'}`);
        console.log(`   Duration: ${call.duration ?? 'N/A'}s`);
        console.log(`   Sentiment: ${call.sentiment ?? 'N/A'}`);
        console.log(`   Type: ${call.type ?? 'N/A'}`);
        console.log(`   Summary: ${call.summary?.substring(0, 300) || 'N/A'}`);
        console.log(`   Transcript: ${call.transcript?.substring(0, 800) || 'N/A'}...`);
        if (call.metadata) {
          const successEval = call.metadata.successEvaluation;
          if (successEval) {
            console.log(`   Vapi Evaluation: ${typeof successEval === 'string' ? successEval.substring(0, 400) : JSON.stringify(successEval).substring(0, 400)}`);
          }
        }
        console.log(`\n   ---`);
      });
      return;
    }

    // Also check for calls around 01:41 time
    const earlyMorningCalls = (calls || []).filter(call => {
      const date = new Date(call.created_at);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      return hours === 1 && minutes >= 40 && minutes <= 45; // Around 01:41
    });

    if (jan17Calls.length > 0) {
      console.log(`\n=== January 17 Calls (${jan17Calls.length}) ===\n`);
      jan17Calls.forEach((call, idx) => {
        const date = new Date(call.created_at);
        console.log(`${idx + 1}. ${call.caller_name || 'Unknown'}`);
        console.log(`   ID: ${call.id}`);
        console.log(`   Date: ${date.toLocaleString()}`);
        console.log(`   Score: ${call.evaluation_score ?? 'N/A'}`);
        console.log(`   Duration: ${call.duration ?? 'N/A'}s`);
        console.log(`   Sentiment: ${call.sentiment ?? 'N/A'}`);
        console.log(`   Summary: ${call.summary?.substring(0, 200) || 'N/A'}`);
        console.log(`   Transcript preview: ${call.transcript?.substring(0, 500) || 'N/A'}`);
        if (call.metadata) {
          console.log(`   Metadata successEvaluation: ${call.metadata.successEvaluation?.substring(0, 300) || 'N/A'}`);
        }
        console.log('\n---\n');
      });
    }

    if (earlyMorningCalls.length > 0) {
      console.log(`\n=== Calls around 01:41 (${earlyMorningCalls.length}) ===\n`);
      earlyMorningCalls.forEach((call, idx) => {
        const date = new Date(call.created_at);
        console.log(`${idx + 1}. ${call.caller_name || 'Unknown'}`);
        console.log(`   ID: ${call.id}`);
        console.log(`   Date: ${date.toLocaleString()}`);
        console.log(`   Score: ${call.evaluation_score ?? 'N/A'}`);
        console.log(`   Duration: ${call.duration ?? 'N/A'}s`);
        console.log(`   Summary: ${call.summary?.substring(0, 200) || 'N/A'}`);
        console.log(`   Transcript preview: ${call.transcript?.substring(0, 500) || 'N/A'}`);
        if (call.metadata) {
          console.log(`   Metadata successEvaluation: ${call.metadata.successEvaluation?.substring(0, 300) || 'N/A'}`);
        }
        console.log('\n---\n');
      });
    }

    if (jan17Calls.length === 0 && earlyMorningCalls.length === 0) {
      console.log('\nNo calls found on January 17 or around 01:41');
      console.log('\n=== Recent Artun calls (showing first 5 with details) ===\n');
      (calls || []).slice(0, 5).forEach((call, idx) => {
        const date = new Date(call.created_at);
        console.log(`${idx + 1}. ${call.caller_name || 'Unknown'}`);
        console.log(`   Date: ${date.toLocaleString()}`);
        console.log(`   Score: ${call.evaluation_score ?? 'N/A'}`);
        console.log(`   Duration: ${call.duration ?? 'N/A'}s`);
        console.log(`   Summary: ${call.summary?.substring(0, 200) || 'N/A'}`);
        console.log(`   Transcript preview: ${call.transcript?.substring(0, 500) || 'N/A'}`);
        if (call.metadata) {
          console.log(`   Metadata successEvaluation: ${call.metadata.successEvaluation?.substring(0, 300) || 'N/A'}`);
        }
        console.log('\n---\n');
      });
    }

    // Also check for "Balta" separately
    const { data: baltaCalls } = await supabase
      .from('calls')
      .select('*')
      .ilike('caller_name', '%Balta%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (baltaCalls && baltaCalls.length > 0) {
      console.log(`\n\n=== Also found ${baltaCalls.length} calls with "Balta" in name ===\n`);
      baltaCalls.forEach((call, idx) => {
        const date = new Date(call.created_at);
        console.log(`${idx + 1}. ${call.caller_name || 'Unknown'} - ${date.toLocaleString()} - Score: ${call.evaluation_score ?? 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Get name from command line argument or use default
const searchName = process.argv[2] || 'Artun';
findCall(searchName);
