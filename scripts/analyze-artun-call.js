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

async function analyzeCall() {
  try {
    // Get the specific call ID we found
    const callId = '24b14f87-d5f5-463e-97f3-d061b3437b7b';
    
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
    console.log(`Type: ${call.type ?? 'N/A'}`);
    
    console.log('\n=== SUMMARY ===');
    console.log(call.summary || 'N/A');
    
    console.log('\n=== EVALUATION SUMMARY ===');
    console.log(call.evaluation_summary || 'N/A');
    
    console.log('\n=== FULL TRANSCRIPT ===');
    console.log(call.transcript || 'N/A');
    
    console.log('\n=== METADATA ===');
    console.log(JSON.stringify(call.metadata, null, 2));
    
    // Analyze the transcript
    if (call.transcript) {
      const transcript = call.transcript.toLowerCase();
      const userText = call.transcript.match(/User:.*/g)?.join(' ') || '';
      const lowerUserText = userText.toLowerCase();
      
      console.log('\n=== ANALYSIS ===');
      console.log(`User word count: ${lowerUserText.split(/\s+/).filter(w => w.length > 0).length}`);
      console.log(`"No" count: ${(lowerUserText.match(/\bno\b/g) || []).length}`);
      console.log(`"Not interested" found: ${lowerUserText.includes('not interested')}`);
      console.log(`"I said no" found: ${lowerUserText.includes('i said no')}`);
      
      // Check what our adjustScoreBasedOnContent would do
      const originalScore = call.evaluation_score || 7;
      console.log(`\nOriginal Score: ${originalScore}`);
      console.log(`\nIssues detected:`);
      
      if (lowerUserText.includes('no') && (lowerUserText.match(/\bno\b/g) || []).length >= 2) {
        console.log(`- User said "no" multiple times`);
      }
      if (lowerUserText.includes('not interested') || lowerUserText.includes('i said no')) {
        console.log(`- User explicitly declined`);
      }
      if (call.duration && call.duration < 90) {
        console.log(`- Call was short (${call.duration}s)`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeCall();
