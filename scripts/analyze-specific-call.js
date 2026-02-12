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

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeCall(callId) {
  try {
    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (!call) {
      console.log('Call not found');
      return;
    }

    console.log('\n=== FULL CALL ANALYSIS ===\n');
    console.log(`Caller: ${call.caller_name || 'Unknown'}`);
    console.log(`Date: ${new Date(call.created_at).toLocaleString()}`);
    console.log(`Duration: ${call.duration}s`);
    console.log(`Current Score: ${call.evaluation_score ?? 'N/A'}`);
    console.log(`Sentiment: ${call.sentiment ?? 'N/A'}`);
    
    console.log('\n=== SUMMARY ===');
    console.log(call.summary || 'N/A');
    
    console.log('\n=== FULL TRANSCRIPT ===');
    console.log(call.transcript || 'N/A');
    
    console.log('\n=== METADATA ===');
    console.log(JSON.stringify(call.metadata, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get call ID from command line
const callId = process.argv[2];
if (!callId) {
  console.log('Usage: node analyze-specific-call.js <call-id>');
  process.exit(1);
}

analyzeCall(callId);
