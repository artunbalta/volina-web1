import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

interface LeadRecord {
  id: string;
  status: string;
  priority?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  created_at: string;
  [key: string]: unknown;
}

// GET - Fetch leads from Supabase (admin access)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
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

    const { data: leads, error } = await query.limit(limit) as { data: LeadRecord[] | null; error: { message: string } | null };

    if (error) {
      console.error("Error fetching leads:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch leads", details: error.message },
        { status: 500 }
      );
    }

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
    });
  } catch (error) {
    console.error("Dashboard leads error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new lead
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    if (!body.full_name) {
      return NextResponse.json(
        { success: false, error: "full_name is required" },
        { status: 400 }
      );
    }

    let user_id = body.user_id;
    
    if (!user_id) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("dashboard_type", "outbound")
        .limit(1) as { data: { id: string }[] | null };
      
      if (profiles && profiles.length > 0 && profiles[0]) {
        user_id = profiles[0].id;
      } else {
        const { data: anyProfiles } = await supabase
          .from("profiles")
          .select("id")
          .limit(1) as { data: { id: string }[] | null };
        
        if (!anyProfiles || anyProfiles.length === 0 || !anyProfiles[0]) {
          return NextResponse.json(
            { success: false, error: "No user found" },
            { status: 400 }
          );
        }
        user_id = anyProfiles[0].id;
      }
    }

    const validSources = ['web_form', 'instagram', 'referral', 'facebook', 'google_ads', 'other'];
    let source = body.source?.toLowerCase() || 'other';
    if (!validSources.includes(source)) {
      if (source.includes('web') || source.includes('site') || source.includes('form')) {
        source = 'web_form';
      } else if (source.includes('insta') || source.includes('ig')) {
        source = 'instagram';
      } else if (source.includes('face') || source.includes('fb')) {
        source = 'facebook';
      } else if (source.includes('google') || source.includes('ads')) {
        source = 'google_ads';
      } else if (source.includes('refer')) {
        source = 'referral';
      } else {
        source = 'other';
      }
    }

    const leadData = {
      user_id: user_id,
      full_name: body.full_name,
      email: body.email || null,
      phone: body.phone || null,
      whatsapp: body.whatsapp || null,
      instagram: body.instagram || null,
      language: body.language || 'tr',
      source: source,
      treatment_interest: body.interest || body.treatment_interest || null,
      notes: body.notes || null,
      status: body.status || 'new',
      priority: body.priority || 'medium',
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(leadData as never)
      .select()
      .single();

    if (error) {
      console.error("Error creating lead:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create lead", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Create lead error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a lead
export async function PUT(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    if (!body.user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }

    const { id, user_id, ...updates } = body;

    // Verify lead belongs to user before updating
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("id", id)
      .eq("user_id", user_id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update(updates as never)
      .eq("id", id)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating lead:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update lead", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Update lead error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a lead or multiple leads
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");
    
    // Try to get ids and userId from request body for bulk delete
    let body: { ids?: string[]; userId?: string } | null = null;
    try {
      body = await request.json();
    } catch {
      // Body might not be JSON, that's okay
    }

    const ids = body?.ids || (id ? [id] : []);
    const user_id = body?.userId || userId;

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "id or ids array is required" },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }

    // Verify all leads belong to user before deleting
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id")
      .in("id", ids)
      .eq("user_id", user_id);

    if (!existingLeads || existingLeads.length !== ids.length) {
      return NextResponse.json(
        { success: false, error: "Some leads not found or access denied" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", ids)
      .eq("user_id", user_id);

    if (error) {
      console.error("Error deleting lead(s):", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete lead(s)", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
