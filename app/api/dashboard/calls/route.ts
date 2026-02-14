import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

interface CallRecord {
  id: string;
  user_id: string;
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

// GET - Fetch calls from Supabase (synced from VAPI) - User-specific
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    // Get user_id from query params (REQUIRED - sent from frontend)
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }
    
    const days = parseInt(searchParams.get("days") || "365");
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's vapi_assistant_id from profile for filtering
    const { data: profile } = await supabase
      .from("profiles")
      .select("vapi_assistant_id")
      .eq("id", userId)
      .single() as { data: { vapi_assistant_id?: string | null } | null };
    
    const userAssistantId = profile?.vapi_assistant_id;

    // Build query - MUST filter by user_id for security
    let query = supabase
      .from("calls")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });
    
    const { data: allCalls, error } = await query as { data: CallRecord[] | null; error: { message: string } | null };
    
    // Filter by assistant_id if user has one set
    // Include: user's assistant OR calls without assistant_id (legacy calls)
    let filteredCalls = allCalls || [];
    if (userAssistantId && filteredCalls.length > 0) {
      filteredCalls = filteredCalls.filter(call => {
        const callAssistantId = (call as Record<string, unknown>).assistant_id as string | undefined;
        const metadataAssistantId = call.metadata?.assistantId as string | undefined;
        const hasAssistantId = callAssistantId || metadataAssistantId;
        
        // Include if: matches user's assistant OR has no assistantId (legacy/old calls)
        if (!hasAssistantId) return true; // Include legacy calls
        return callAssistantId === userAssistantId || metadataAssistantId === userAssistantId;
      });
    }
    
    // Filter out test calls (webCalls from VAPI dashboard)
    // Only include outboundPhoneCall and inboundPhoneCall
    filteredCalls = filteredCalls.filter(call => {
      const callType = call.metadata?.callType as string | undefined;
      // Exclude webCalls (test calls from VAPI dashboard)
      // Include if: not a webCall, or if callType is not set (legacy calls)
      return callType !== 'webCall';
    });
    
    // Filter out calls from wrong assistants (e.g., GOP Dentel)
    // Exclude calls where transcript contains indicators of wrong assistant
    filteredCalls = filteredCalls.filter(call => {
      const transcript = String(call.transcript || '').toLowerCase();
      const summary = String(call.summary || '').toLowerCase();
      const textToCheck = `${transcript} ${summary}`;
      
      // Exclude calls from GOP Dentel assistant
      const wrongAssistantPatterns = [
        'gop dentel',
        'özel gop dentel',
        'gop dentel diş polikliniği',
        'eda ben', // GOP Dentel assistant name
        'turkcell sekreter servisi' // This appears in the transcript
      ];
      
      // If transcript contains any wrong assistant pattern, exclude this call
      const isWrongAssistant = wrongAssistantPatterns.some(pattern => 
        textToCheck.includes(pattern.toLowerCase())
      );
      
      return !isWrongAssistant;
    });
    
    // Helper to check if string looks like a phone number
    const looksLikePhone = (str: string | null | undefined): boolean => {
      if (!str) return false;
      const cleaned = str.replace(/[\s\-\(\)]/g, '');
      return cleaned.startsWith('+') || /^\d{7,}$/.test(cleaned);
    };
    
    // Filter out Unknown Callers:
    // 1. No caller_name at all
    // 2. caller_name is a phone number and no caller_phone (would display as "Unknown Caller")
    filteredCalls = filteredCalls.filter(call => {
      const hasName = call.caller_name !== null && call.caller_name !== undefined && call.caller_name !== '';
      if (!hasName) return false;
      
      // If name looks like a phone number and there's no actual phone, it's effectively unknown
      const callerPhone = (call as Record<string, unknown>).caller_phone as string | null | undefined;
      if (looksLikePhone(call.caller_name) && !callerPhone) {
        return false; // This would show as "Unknown Caller" in UI
      }
      
      return true;
    });

    if (error) {
      console.error("Error fetching calls:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch calls", details: error.message },
        { status: 500 }
      );
    }

    // Use filtered calls for everything
    const calls = filteredCalls;

    // Calculate KPI stats from filtered data
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const totalCalls = calls.length;
    const monthlyCalls = calls.filter(c => new Date(c.created_at) >= startOfMonth).length;
    const dailyCalls = calls.filter(c => new Date(c.created_at) >= startOfDay).length;
    
    // Calculate average duration
    const callsWithDuration = calls.filter(c => c.duration && c.duration > 0);
    const avgDuration = callsWithDuration.length > 0
      ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length)
      : 0;

    // Calculate appointment rate (based on sentiment or type)
    const appointmentCalls = calls.filter(c => 
      c.type === 'appointment' || 
      c.sentiment === 'positive' ||
      (c.metadata && typeof c.metadata === 'object' && 
       (c.metadata as Record<string, unknown>).appointmentBooked === true)
    ).length;
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

// DELETE - Delete all calls for a user (from database)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    // Get user_id from query params (REQUIRED - sent from frontend)
    const userId = searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }
    
    // Delete all calls for this user
    const { error } = await supabase
      .from("calls")
      .delete()
      .eq("user_id", userId);
    
    if (error) {
      console.error("Error deleting calls:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete calls", details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "All calls deleted successfully",
    });
  } catch (error) {
    console.error("Delete calls error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}