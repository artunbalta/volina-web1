// @ts-nocheck
// TODO: Remove ts-nocheck when Supabase is connected
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isDemoMode } from "@/lib/supabase";

// GET - List all calls
export async function GET(request: NextRequest) {
  // Return mock data in demo mode
  if (isDemoMode) {
    return NextResponse.json({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
      message: "Demo mode - no real data",
    });
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type");
    const sentiment = searchParams.get("sentiment");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // Return error in demo mode
  if (isDemoMode) {
    return NextResponse.json({
      error: "Demo mode - cannot create calls",
    }, { status: 400 });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from("calls") as any)
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

