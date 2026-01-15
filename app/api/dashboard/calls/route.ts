import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

interface CallRecord {
  id: string;
  created_at: string;
  duration?: number;
  type?: string;
  sentiment?: string;
  metadata?: Record<string, unknown>;
  caller_name?: string;
  evaluation_summary?: string;
  evaluation_score?: number;
  [key: string]: unknown;
}

// GET - Fetch calls from Supabase (synced from VAPI)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const days = parseInt(searchParams.get("days") || "14");
    // userId filter is now optional - for single-tenant, show all calls
    // For multi-tenant, you can still pass userId to filter
    const userId = searchParams.get("userId");
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query - get all calls for display (user_id filter optional)
    let query = supabase
      .from("calls")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });
    
    // Only filter by user_id if explicitly provided and not empty
    if (userId && userId.trim() !== "") {
      query = query.eq("user_id", userId);
    }
    
    const { data: allCalls, error } = await query as { data: CallRecord[] | null; error: { message: string } | null };

    if (error) {
      console.error("Error fetching calls:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch calls", details: error.message },
        { status: 500 }
      );
    }

    // Limited calls for display
    const calls = allCalls?.slice(0, limit) || [];

    // Calculate KPI stats from all fetched data
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const totalCalls = allCalls?.length || 0;
    const monthlyCalls = allCalls?.filter(c => new Date(c.created_at) >= startOfMonth).length || 0;
    const dailyCalls = allCalls?.filter(c => new Date(c.created_at) >= startOfDay).length || 0;
    
    // Calculate average duration
    const callsWithDuration = calls?.filter(c => c.duration && c.duration > 0) || [];
    const avgDuration = callsWithDuration.length > 0
      ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length)
      : 0;

    // Calculate appointment rate (based on sentiment or type)
    const appointmentCalls = calls?.filter(c => 
      c.type === 'appointment' || 
      c.sentiment === 'positive' ||
      (c.metadata && typeof c.metadata === 'object' && 
       (c.metadata as Record<string, unknown>).appointmentBooked === true)
    ).length || 0;
    const appointmentRate = totalCalls > 0 ? Math.round((appointmentCalls / totalCalls) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: calls,
      kpi: {
        totalCalls,
        monthlyCalls,
        dailyCalls,
        avgDuration,
        appointmentRate,
      },
      source: "supabase",
    });
  } catch (error) {
    console.error("Dashboard calls error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

