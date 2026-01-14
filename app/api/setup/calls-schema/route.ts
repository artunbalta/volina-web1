import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

// Sample OUTBOUND call data - sales team reaching out to leads
const SAMPLE_CALLS = [
  {
    caller_name: 'Ahmet Yılmaz',
    caller_phone: '0532 123 4567',
    summary: 'Form dolduran müşteriye ulaşıldı. Diş implantı için fiyat teklifi sunuldu.',
    evaluation_summary: 'Çok olumlu tepki aldık. Haftaya randevu için geri dönecek. Sıcak lead.',
    evaluation_score: 9,
    duration: 180,
    type: 'inquiry',
    sentiment: 'positive',
    hours_ago: 2
  },
  {
    caller_name: 'Ayşe Demir',
    caller_phone: '0535 987 6543',
    summary: 'Web sitesinden gelen lead arandı. Saç ekimi hakkında bilgi verildi.',
    evaluation_summary: 'İlgili ama başka klinikleri de araştırıyor. 3 gün sonra tekrar aranacak.',
    evaluation_score: 6,
    duration: 240,
    type: 'follow_up',
    sentiment: 'neutral',
    hours_ago: 5
  },
  {
    caller_name: 'Mehmet Kaya',
    caller_phone: '0542 456 7890',
    summary: 'Instagram reklamından gelen lead. Hemen randevu almak istedi.',
    evaluation_summary: 'Kesin randevu alındı. Yarın saat 14:00 için onaylandı. Çok hevesli.',
    evaluation_score: 10,
    duration: 120,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 24
  },
  {
    caller_name: 'Fatma Şahin',
    caller_phone: '0555 321 0987',
    summary: 'Eski müşteri takip araması. Önerilen tedaviyi yaptırmamış.',
    evaluation_summary: 'Maddi sorunlar yaşıyormuş. Taksit seçenekleri sunuldu ama ilgisiz kaldı.',
    evaluation_score: 3,
    duration: 300,
    type: 'follow_up',
    sentiment: 'negative',
    hours_ago: 28
  },
  {
    caller_name: 'Ali Öztürk',
    caller_phone: '0533 654 3210',
    summary: 'Randevu hatırlatma araması yapıldı. İptal etmek istedi.',
    evaluation_summary: 'İş yoğunluğu nedeniyle iptal. 2 hafta sonra tekrar aranması istendi.',
    evaluation_score: 4,
    duration: 90,
    type: 'cancellation',
    sentiment: 'neutral',
    hours_ago: 72
  },
  {
    caller_name: 'Zeynep Arslan',
    caller_phone: '0544 789 0123',
    summary: 'Google Ads\'ten gelen lead arandı. Botox ve dolgu ilgisi var.',
    evaluation_summary: 'Premium müşteri profili. Hafta sonu için randevu istedi. VIP takip.',
    evaluation_score: 8,
    duration: 420,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 4
  },
  {
    caller_name: 'Mustafa Çelik',
    caller_phone: '0536 012 3456',
    summary: 'Soğuk arama - eski veritabanından. Diş beyazlatma teklifi sunuldu.',
    evaluation_summary: 'Fiyat yüksek buldu. Kampanya olursa aranmasını istedi.',
    evaluation_score: 5,
    duration: 150,
    type: 'inquiry',
    sentiment: 'neutral',
    hours_ago: 6
  },
  {
    caller_name: 'Elif Yıldız',
    caller_phone: '0545 234 5678',
    summary: 'Referans ile gelen lead. Çocuğu için ortodonti tedavisi.',
    evaluation_summary: 'Anne çok araştırmacı. Ücretsiz muayene için randevu aldı.',
    evaluation_score: 9,
    duration: 360,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 48
  },
  {
    caller_name: 'Hakan Koç',
    caller_phone: '0537 111 2233',
    summary: 'Yurtdışından arayan lead. Hollywood smile paketi için teklif istedi.',
    evaluation_summary: 'Almanya\'dan geliyor. 2 hafta sonra için VIP paket hazırlandı. Kesin satış.',
    evaluation_score: 10,
    duration: 480,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 3
  },
  {
    caller_name: 'Selin Ak',
    caller_phone: '0538 444 5566',
    summary: 'WhatsApp\'tan mesaj atan lead arandı. Diş teli fiyatı sordu.',
    evaluation_summary: 'Üniversite öğrencisi. Taksit seçenekleri sunuldu, düşünecek.',
    evaluation_score: 7,
    duration: 200,
    type: 'inquiry',
    sentiment: 'neutral',
    hours_ago: 8
  },
  {
    caller_name: 'Burak Yılmaz',
    caller_phone: '0541 333 4455',
    summary: 'Facebook lead formu. Zirkonyum kaplama için 8 diş teklifi verildi.',
    evaluation_summary: 'Bütçe hazır. Haftaya kesin randevu için dönecek. Yüksek değerli satış.',
    evaluation_score: 9,
    duration: 320,
    type: 'inquiry',
    sentiment: 'positive',
    hours_ago: 1
  },
  {
    caller_name: 'Canan Özkan',
    caller_phone: '0546 777 8899',
    summary: 'Instagram DM\'den gelen lead arandı. Gülüş tasarımı ilgisi.',
    evaluation_summary: 'Influencer. Barter teklifi sunuldu. Pazarlama fırsatı olabilir.',
    evaluation_score: 8,
    duration: 280,
    type: 'inquiry',
    sentiment: 'positive',
    hours_ago: 12
  },
  {
    caller_name: 'Deniz Aydın',
    caller_phone: '0539 222 1100',
    summary: 'Acil hat araması. Ağrı şikayeti var, hemen randevu istedi.',
    evaluation_summary: 'Acil hasta. Bugün 16:00 için slot açıldı. Kesin gelecek.',
    evaluation_score: 10,
    duration: 95,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 0.5
  },
  {
    caller_name: 'Esra Polat',
    caller_phone: '0543 666 9988',
    summary: 'Ortodontist referansı ile gelen lead. Çene cerrahisi gerekiyor.',
    evaluation_summary: 'Medikal vaka. Prof. Dr. ile görüşme ayarlandı. Ciddi tedavi.',
    evaluation_score: 8,
    duration: 450,
    type: 'appointment',
    sentiment: 'neutral',
    hours_ago: 36
  },
  {
    caller_name: 'Ferhat Güneş',
    caller_phone: '0534 111 2244',
    summary: 'Teklif gönderilen müşteri arandı. Ödeme koşulları konuşuldu.',
    evaluation_summary: 'Tedaviye karar vermiş. 12 taksit seçeneği ile anlaştık. Satış kapandı.',
    evaluation_score: 10,
    duration: 180,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 16
  },
  {
    caller_name: 'Gizem Kara',
    caller_phone: '0548 555 6677',
    summary: 'Eski hasta takip araması. Dolgular yenilenecek.',
    evaluation_summary: 'Acil değil ama ihtiyaç var. Ay sonuna randevu alındı.',
    evaluation_score: 6,
    duration: 140,
    type: 'follow_up',
    sentiment: 'neutral',
    hours_ago: 20
  },
  {
    caller_name: 'Hüseyin Demir',
    caller_phone: '0531 999 8877',
    summary: 'İngiltere\'den arayan diaspora lead. All-on-4 implant.',
    evaluation_summary: 'Yüksek bütçe. Temmuz\'da gelecek. VIP transfer ve otel ayarlanacak.',
    evaluation_score: 10,
    duration: 520,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 10
  },
  {
    caller_name: 'İrem Başaran',
    caller_phone: '0547 444 3322',
    summary: 'Memnun müşteri takip araması. Kontrol randevusu.',
    evaluation_summary: 'Çok memnun. 3 arkadaşına önermiş. Referans programına dahil edildi.',
    evaluation_score: 9,
    duration: 110,
    type: 'follow_up',
    sentiment: 'positive',
    hours_ago: 52
  },
  {
    caller_name: 'Kemal Tekin',
    caller_phone: '0540 888 7766',
    summary: 'Yaşlı hasta - protez yenileme teklifi sunuldu.',
    evaluation_summary: 'Kararsız kaldı. Çocuklarıyla konuşacak. Hafta sonu tekrar aranacak.',
    evaluation_score: 5,
    duration: 260,
    type: 'inquiry',
    sentiment: 'neutral',
    hours_ago: 30
  },
  {
    caller_name: 'Leyla Şen',
    caller_phone: '0549 222 3344',
    summary: 'Çocuk hastası annesi arandı. Süt dişi problemi.',
    evaluation_summary: 'Endişeli ama olumlu. Pediatrik diş hekimi ile randevu oluşturuldu.',
    evaluation_score: 8,
    duration: 175,
    type: 'appointment',
    sentiment: 'positive',
    hours_ago: 14
  }
];

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const forceReseed = searchParams.get('force') === 'true';
    
    // Step 1: Check if columns exist by trying to select them
    const { error: columnCheckError } = await supabase
      .from('calls')
      .select('caller_name, evaluation_summary, evaluation_score')
      .limit(1);
    
    // If columns don't exist, try to add them via RPC function
    if (columnCheckError && columnCheckError.message.includes('does not exist')) {
      // Try calling the setup RPC function (if it exists)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('setup_calls_evaluation_schema');
      
      if (rpcError) {
        // RPC function doesn't exist, user needs to run migration manually
        return NextResponse.json({
          success: false,
          needsMigration: true,
          message: 'Please run the migration SQL in Supabase SQL Editor first.',
          migrationSQL: `
-- Run this in Supabase SQL Editor (one time only):
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_summary TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_score INTEGER;
CREATE INDEX IF NOT EXISTS idx_calls_evaluation_score ON calls(evaluation_score);
CREATE INDEX IF NOT EXISTS idx_calls_caller_name ON calls(caller_name);

-- This function enables auto-setup:
CREATE OR REPLACE FUNCTION setup_calls_evaluation_schema()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_summary TEXT;
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_score INTEGER;
    CREATE INDEX IF NOT EXISTS idx_calls_evaluation_score ON calls(evaluation_score);
    CREATE INDEX IF NOT EXISTS idx_calls_caller_name ON calls(caller_name);
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
          `.trim()
        });
      }
      
      console.log('Schema setup via RPC:', rpcResult);
    }
    
    // Step 2: If force reseed, delete existing sample data first
    if (forceReseed) {
      // Delete calls that have caller_name (sample data)
      await supabase
        .from('calls')
        .delete()
        .not('caller_name', 'is', null);
    } else {
      // Check if we have any calls with evaluation data
      const { data: existingCalls, error: fetchError } = await supabase
        .from('calls')
        .select('id, caller_name, evaluation_score')
        .not('caller_name', 'is', null)
        .limit(1);
      
      if (fetchError) {
        console.error('Error checking existing calls:', fetchError);
        return NextResponse.json({
          success: false,
          error: 'Failed to check existing data',
          details: fetchError.message
        }, { status: 500 });
      }
      
      // If we already have calls with evaluation data, don't seed
      if (existingCalls && existingCalls.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'Schema is ready and data exists',
          seeded: false
        });
      }
    }
    
    // Step 3: Get a user ID to associate the calls with
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1) as { data: { id: string }[] | null; error: { message: string } | null };
    
    if (profileError || !profiles || profiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No user found to associate calls with',
        details: profileError?.message
      }, { status: 400 });
    }
    
    const userId = profiles[0]!.id;
    
    // Step 4: Insert sample data
    const now = new Date();
    const callsToInsert = SAMPLE_CALLS.map(call => {
      const createdAt = new Date(now.getTime() - call.hours_ago * 60 * 60 * 1000);
      return {
        user_id: userId,
        caller_name: call.caller_name,
        caller_phone: call.caller_phone,
        summary: call.summary,
        evaluation_summary: call.evaluation_summary,
        evaluation_score: call.evaluation_score,
        duration: call.duration,
        type: call.type,
        sentiment: call.sentiment,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString()
      };
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('calls')
      .insert(callsToInsert);
    
    if (insertError) {
      console.error('Error inserting sample calls:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to insert sample data',
        details: (insertError as { message: string }).message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schema ready and sample data inserted',
      seeded: true,
      count: callsToInsert.length
    });
    
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// GET to check status
export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // Check if columns exist
    const { data, error } = await supabase
      .from('calls')
      .select('id, caller_name, evaluation_summary, evaluation_score')
      .not('caller_name', 'is', null)
      .limit(5);
    
    if (error && error.message.includes('does not exist')) {
      return NextResponse.json({
        ready: false,
        needsMigration: true,
        message: 'Columns do not exist'
      });
    }
    
    if (error) {
      return NextResponse.json({
        ready: false,
        error: error.message
      });
    }
    
    return NextResponse.json({
      ready: true,
      hasData: data && data.length > 0,
      sampleCount: data?.length || 0
    });
    
  } catch (error) {
    return NextResponse.json({
      ready: false,
      error: 'Failed to check status'
    }, { status: 500 });
  }
}

