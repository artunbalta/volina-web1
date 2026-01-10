import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

// GET - Fetch leads from Supabase (admin access)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    // Build query
    let query = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: leads, error } = await query.limit(limit);

    if (error) {
      console.error("Error fetching leads:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch leads", details: error.message },
        { status: 500 }
      );
    }

    // Calculate stats
    const total = leads?.length || 0;
    const newLeads = leads?.filter(l => l.status === "new").length || 0;
    const contacted = leads?.filter(l => l.status === "contacted").length || 0;
    const interested = leads?.filter(l => l.status === "interested").length || 0;
    const appointmentSet = leads?.filter(l => l.status === "appointment_set").length || 0;
    const converted = leads?.filter(l => l.status === "converted").length || 0;
    const unreachable = leads?.filter(l => l.status === "unreachable").length || 0;

    return NextResponse.json({
      success: true,
      data: leads,
      stats: {
        total,
        newLeads,
        contacted,
        interested,
        appointmentSet,
        converted,
        unreachable,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      },
      source: "supabase",
    });
  } catch (error) {
    console.error("Dashboard leads error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

