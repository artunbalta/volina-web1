import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isDemoMode } from "@/lib/supabase";

// GET - List all calls
export async function GET(request: NextRequest) {
  // Return mock data in demo mode
  if (isDemoMode) {
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
      message: "Demo mode - using mock data",
    });
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type");
    const sentiment = searchParams.get("sentiment");

    let query = supabase
      .from("calls")
      .select(`
        *,
        appointment:appointments(
          *,
          doctor:doctors(*)
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq("type", type);
    }
    if (sentiment) {
      query = query.eq("sentiment", sentiment);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching calls:", error);
      return NextResponse.json(
        { error: "Failed to fetch calls", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Calls API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create a new call record
export async function POST(request: NextRequest) {
  // Return mock success in demo mode
  if (isDemoMode) {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      data: {
        id: `call-${Date.now()}`,
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      message: "Demo mode - call not actually saved",
    }, { status: 201 });
  }

  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Validate required fields
    if (!body.type) {
      return NextResponse.json(
        { error: "Missing required field: type" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("calls")
      .insert({
        vapi_call_id: body.vapi_call_id || null,
        appointment_id: body.appointment_id || null,
        recording_url: body.recording_url || null,
        transcript: body.transcript || null,
        summary: body.summary || null,
        sentiment: body.sentiment || "neutral",
        duration: body.duration || null,
        type: body.type,
        caller_phone: body.caller_phone || null,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating call:", error);
      return NextResponse.json(
        { error: "Failed to create call", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    }, { status: 201 });
  } catch (error) {
    console.error("Calls API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
