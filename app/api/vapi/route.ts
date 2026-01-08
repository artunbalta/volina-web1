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
  // Mock mode - return success without saving
  const body = await request.json();
  
  console.log("Mock mode: Vapi webhook received (not saved)", body);
  
  return NextResponse.json({
    success: true,
    message: "Mock mode - webhook received but not processed",
    timestamp: new Date().toISOString(),
  });

  // Mock mode - no backend operations
}

// GET handler for webhook verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Volina AI Vapi webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}

