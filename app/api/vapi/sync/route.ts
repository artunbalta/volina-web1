import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getVapiCalls, transformVapiCallToLocal, isVapiConfigured } from "@/lib/vapi-api";

// POST - Sync VAPI calls to Supabase
export async function POST(request: NextRequest) {
  try {
    if (!isVapiConfigured()) {
      return NextResponse.json(
        { error: "VAPI is not configured", code: "VAPI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") || "14"), 14);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Calculate date range (VAPI only allows 14 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch calls from VAPI
    const vapiCalls = await getVapiCalls({
      limit: 100,
      createdAtGe: startDate.toISOString(),
    });

    if (vapiCalls.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No calls to sync",
        synced: 0,
        skipped: 0,
      });
    }

    const supabase = createAdminClient();
    let synced = 0;
    let skipped = 0;

    for (const vapiCall of vapiCalls) {
      // Check if call already exists in Supabase
      const { data: existing } = await supabase
        .from("calls")
        .select("id")
        .eq("vapi_call_id", vapiCall.id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Transform and insert
      const localCall = transformVapiCallToLocal(vapiCall);
      
      // Calculate duration in seconds
      let duration: number | null = null;
      if (vapiCall.startedAt && vapiCall.endedAt) {
        duration = Math.round(
          (new Date(vapiCall.endedAt).getTime() - new Date(vapiCall.startedAt).getTime()) / 1000
        );
      }

      // Use original VAPI timestamp for created_at
      const originalTimestamp = vapiCall.startedAt || vapiCall.createdAt || new Date().toISOString();

      const insertData = {
        user_id: userId,
        vapi_call_id: vapiCall.id,
        recording_url: vapiCall.recordingUrl || vapiCall.stereoRecordingUrl || null,
        transcript: vapiCall.transcript || null,
        summary: vapiCall.analysis?.summary || vapiCall.summary || null,
        sentiment: localCall.sentiment,
        duration,
        type: localCall.type,
        caller_phone: vapiCall.customer?.number || null,
        created_at: originalTimestamp, // Use original VAPI call time
        metadata: {
          orgId: vapiCall.orgId,
          status: vapiCall.status,
          endedReason: vapiCall.endedReason,
          cost: vapiCall.cost || vapiCall.costBreakdown?.total,
          callType: vapiCall.type,
          originalStartedAt: vapiCall.startedAt,
          originalEndedAt: vapiCall.endedAt,
        },
      };

      const { error } = await supabase
        .from("calls")
        .insert(insertData as never);

      if (error) {
        console.error("Error inserting call:", error);
      } else {
        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} calls, skipped ${skipped} existing`,
      synced,
      skipped,
      total: vapiCalls.length,
    });
  } catch (error) {
    console.error("VAPI sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync VAPI calls", details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Get sync status
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Use POST to sync VAPI calls to Supabase",
    params: {
      days: "Number of days to sync (max 14)",
      userId: "User ID to associate calls with",
    },
  });
}

