import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

// GET - List all calls
export async function GET(request: NextRequest) {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Failed to fetch calls", details: errorMessage },
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

    const callData = {
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
    };

    const { data, error } = await supabase
      .from("calls")
      .insert(callData as never)
      .select()
      .single();

    if (error) {
      console.error("Error creating call:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Failed to create call", details: errorMessage },
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
