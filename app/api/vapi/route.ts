// @ts-nocheck
// TODO: Remove ts-nocheck when Supabase is connected
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isDemoMode } from "@/lib/supabase";

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
  // Return error in demo mode
  if (isDemoMode) {
    return NextResponse.json({
      error: "Demo mode - webhooks disabled",
    }, { status: 400 });
  }

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

    // Create Supabase admin client for server-side operations
    const supabase = createAdminClient();

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: callData, error: callError } = await (supabase
      .from("calls") as any)
      .insert({
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
      })
      .select()
      .single();

    if (callError) {
      console.error("Error inserting call:", callError);
      return NextResponse.json(
        { error: "Failed to save call record", details: callError.message },
        { status: 500 }
      );
    }

    // If this was an appointment call, we could also create an appointment
    // This would typically be handled by n8n with more sophisticated parsing
    // but here's a placeholder for the logic

    console.log("Successfully processed Vapi webhook:", {
      callId: callData.id,
      vapiCallId: call.id,
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

