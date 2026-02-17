import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

// POST - Re-evaluate all calls for a user (or all users if admin)
export async function POST(request: NextRequest) {
  try {
    const { userId, force = false, limit = 100 } = await request.json();

    const supabase = createAdminClient();

    // Build query to find calls without structured output
    let query = supabase
      .from("calls")
      .select("id, created_at, evaluation_score, metadata, transcript, summary")
      .not("transcript", "is", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 500)); // Max 500 at a time

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: callsData, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch calls", details: error.message },
        { status: 500 }
      );
    }

    const calls = (callsData || []) as Array<{
      id: string;
      created_at: string;
      evaluation_score: number | null;
      metadata: Record<string, unknown> | null;
      transcript: string | null;
      summary: string | null;
    }>;

    // Filter calls that need re-evaluation
    const callsNeedingReEvaluation = calls.filter(call => {
      if (force) return true; // Force mode: re-evaluate all
      
      const hasStructuredOutput = call.metadata?.structuredData && 
                                  typeof call.metadata.structuredData === 'object' &&
                                  (call.metadata.structuredData as Record<string, unknown>).successEvaluation;
      return !hasStructuredOutput;
    });

    if (callsNeedingReEvaluation.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No calls need re-evaluation",
        total: calls.length,
        needingReEvaluation: 0,
        evaluated: 0,
      });
    }

    // Call the re-evaluate endpoint for each call
    const callIds = callsNeedingReEvaluation.map(c => c.id);
    
    // Use the batch endpoint
    const reEvaluateResponse = await fetch(`${request.nextUrl.origin}/api/calls/re-evaluate-structured`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callIds,
        force,
        limit: Math.min(callIds.length, 500),
      }),
    });

    if (!reEvaluateResponse.ok) {
      const error = await reEvaluateResponse.json();
      return NextResponse.json(
        { error: "Failed to re-evaluate calls", details: error },
        { status: 500 }
      );
    }

    const results = await reEvaluateResponse.json();

    return NextResponse.json({
      success: true,
      message: `Re-evaluation complete for ${callsNeedingReEvaluation.length} calls`,
      total: calls.length,
      needingReEvaluation: callsNeedingReEvaluation.length,
      results: results.results,
    });
  } catch (error) {
    console.error("Re-evaluate all calls error:", error);
    return NextResponse.json(
      { error: "Failed to re-evaluate calls", details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Check how many calls need re-evaluation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "1000"), 1000);

    const supabase = createAdminClient();

    // Build query
    let query = supabase
      .from("calls")
      .select("id, created_at, evaluation_score, metadata", { count: "exact" })
      .not("transcript", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: callsData, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch calls", details: error.message },
        { status: 500 }
      );
    }

    const calls = (callsData || []) as Array<{
      id: string;
      created_at: string;
      evaluation_score: number | null;
      metadata: Record<string, unknown> | null;
    }>;

    // Filter calls that don't have structured output
    const callsNeedingReEvaluation = calls.filter(call => {
      const hasStructuredOutput = call.metadata?.structuredData && 
                                  typeof call.metadata.structuredData === 'object' &&
                                  (call.metadata.structuredData as Record<string, unknown>).successEvaluation;
      return !hasStructuredOutput;
    });

    return NextResponse.json({
      success: true,
      total: count || calls.length,
      needingReEvaluation: callsNeedingReEvaluation.length,
      percentage: count && count > 0 
        ? ((callsNeedingReEvaluation.length / count) * 100).toFixed(1) + "%"
        : "0%",
      message: callsNeedingReEvaluation.length === 0
        ? "✅ All calls already have structured output!"
        : `⚠️ ${callsNeedingReEvaluation.length}/${count || calls.length} calls need re-evaluation`,
    });
  } catch (error) {
    console.error("Check re-evaluation status error:", error);
    return NextResponse.json(
      { error: "Failed to check calls", details: String(error) },
      { status: 500 }
    );
  }
}
