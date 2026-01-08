// @ts-nocheck
// TODO: Remove ts-nocheck when Supabase is connected
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isDemoMode } from "@/lib/supabase";

// GET - List all calls
export async function GET(request: NextRequest) {
  // Always return mock data
  const mockCalls = [
    {
      id: "1",
      vapi_call_id: "vapi_call_001",
      appointment_id: null,
      recording_url: "https://api.vapi.ai/recordings/sample1.mp3",
      transcript: "Agent: Hello, this is Volina AI. How can I help you today?\nCaller: Hi, I'd like to schedule an appointment.",
      summary: "Customer scheduled an appointment for 9 AM tomorrow.",
      sentiment: "positive",
      duration: 145,
      type: "appointment",
      caller_phone: "+1 (555) 111-0002",
      metadata: {},
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "2",
      vapi_call_id: "vapi_call_002",
      appointment_id: null,
      recording_url: "https://api.vapi.ai/recordings/sample2.mp3",
      transcript: "Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I have a question about your services.",
      summary: "Customer inquired about operating hours.",
      sentiment: "neutral",
      duration: 98,
      type: "inquiry",
      caller_phone: "+1 (555) 444-5555",
      metadata: {},
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ];

  return NextResponse.json({
    data: mockCalls,
    pagination: { total: mockCalls.length, limit: 50, offset: 0, hasMore: false },
    message: "Mock mode - using demo data",
  });

  // Mock mode - no backend operations
}

// POST - Create a new call record
export async function POST(request: NextRequest) {
  // Mock mode - return success without saving
  const body = await request.json();
  
  return NextResponse.json({
    success: true,
    data: {
      id: `call-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    message: "Mock mode - call not actually saved",
  }, { status: 201 });

  // Mock mode - no backend operations
}

