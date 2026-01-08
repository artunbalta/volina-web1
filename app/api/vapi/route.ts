import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

// Vapi webhook types
interface VapiEndOfCallReport {
  message: {
    type: "end-of-call-report";
    call: {
      id: string;
      orgId: string;
      createdAt: string;
      endedAt: string;
      type: string;
      status: string;
      endedReason: string;
      phoneNumberId?: string;
      customer?: {
        number: string;
      };
    };
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    transcript?: string;
    summary?: string;
    analysis?: {
      summary?: string;
      structuredData?: Record<string, unknown>;
      successEvaluation?: string;
    };
  };
}

// POST handler for Vapi webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as VapiEndOfCallReport;

    // Validate the webhook payload
    if (body.message?.type !== "end-of-call-report") {
      return NextResponse.json(
        { error: "Unsupported webhook type" },
        { status: 400 }
      );
    }

    const { call, recordingUrl, transcript, summary, analysis } = body.message;
    const vapiOrgId = call.orgId;

    if (!vapiOrgId) {
      console.error("No Vapi orgId in webhook");
      return NextResponse.json(
        { error: "Missing Vapi organization ID" },
        { status: 400 }
      );
    }

    // Create Supabase admin client for server-side operations
    const supabase = createAdminClient();

    // Find user by vapi_org_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("vapi_org_id", vapiOrgId)
      .single() as { data: { id: string } | null; error: unknown };

    if (profileError || !profile) {
      console.error("No user found for Vapi orgId:", vapiOrgId);
      return NextResponse.json(
        { error: "User not found for this Vapi organization" },
        { status: 404 }
      );
    }

    const userId = profile.id;

    // Determine sentiment from analysis or default to neutral
    let sentiment: "positive" | "neutral" | "negative" = "neutral";
    if (analysis?.successEvaluation) {
      const evaluation = analysis.successEvaluation.toLowerCase();
      if (evaluation.includes("positive") || evaluation.includes("success")) {
        sentiment = "positive";
      } else if (evaluation.includes("negative") || evaluation.includes("fail")) {
        sentiment = "negative";
      }
    }

    // Determine call type from summary or transcript
    let callType: "appointment" | "inquiry" | "follow_up" | "cancellation" = "inquiry";
    const lowerSummary = (summary || transcript || "").toLowerCase();
    
    if (lowerSummary.includes("cancel")) {
      callType = "cancellation";
    } else if (lowerSummary.includes("follow") || lowerSummary.includes("follow-up")) {
      callType = "follow_up";
    } else if (
      lowerSummary.includes("appointment") ||
      lowerSummary.includes("schedule") ||
      lowerSummary.includes("book")
    ) {
      callType = "appointment";
    }

    // Calculate duration in seconds
    const startTime = new Date(call.createdAt).getTime();
    const endTime = new Date(call.endedAt).getTime();
    const duration = Math.round((endTime - startTime) / 1000);

    // Insert call record into database
    const insertData = {
      user_id: userId,
      vapi_call_id: call.id,
      recording_url: recordingUrl || null,
      transcript: transcript || null,
      summary: analysis?.summary || summary || null,
      sentiment,
      duration,
      type: callType,
      caller_phone: call.customer?.number || null,
      metadata: {
        orgId: call.orgId,
        status: call.status,
        endedReason: call.endedReason,
        structuredData: analysis?.structuredData,
      },
    };

    const { data: callData, error: callError } = await supabase
      .from("calls")
      .insert(insertData as never)
      .select()
      .single() as { data: { id: string } | null; error: unknown };

    if (callError) {
      console.error("Error inserting call:", callError);
      return NextResponse.json(
        { error: "Failed to save call record", details: callError.message },
        { status: 500 }
      );
    }

    console.log("Successfully processed Vapi webhook:", {
      callId: callData.id,
      vapiCallId: call.id,
      userId,
      type: callType,
      sentiment,
    });

    return NextResponse.json({
      success: true,
      callId: callData.id,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Vapi webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

// GET handler for webhook verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Volina AI Vapi webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
