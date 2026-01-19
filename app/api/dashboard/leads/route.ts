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
    
    // REQUIRED: user_id must be provided for data isolation
    const userId = searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "user_id is required for data isolation" },
        { status: 400 }
      );
    }
    
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    // ALWAYS filter by user_id first for data isolation
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

// POST - Create a new lead or bulk create leads
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Handle bulk CSV upload
    if (body.leads && Array.isArray(body.leads)) {
      if (body.leads.length === 0) {
        return NextResponse.json(
          { success: false, error: "No leads provided" },
          { status: 400 }
        );
      }

      // Get user_id from first lead (all should have same user_id)
      let user_id = body.leads[0]?.user_id;
      
      if (!user_id) {
        return NextResponse.json(
          { success: false, error: "user_id is required for all leads" },
          { status: 400 }
        );
      }

      const validSources = ['web_form', 'instagram', 'referral', 'facebook', 'google_ads', 'other'];
      
      const leadsData = body.leads.map((lead: any) => {
        let source = lead.source?.toLowerCase() || 'other';
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

        return {
          user_id: lead.user_id || user_id,
          full_name: lead.full_name || null,
          email: lead.email || null,
          phone: lead.phone || null,
          whatsapp: lead.whatsapp || null,
          instagram: lead.instagram || null,
          language: lead.language || 'tr',
          source: source,
          treatment_interest: lead.interest || lead.treatment_interest || null,
          notes: lead.notes || null,
          status: lead.status || 'new',
          priority: lead.priority || 'medium',
        };
      }).filter((lead: any) => lead.full_name || lead.phone || lead.email); // Only include leads with at least one identifier

      if (leadsData.length === 0) {
        return NextResponse.json(
          { success: false, error: "No valid leads to import" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("leads")
        .insert(leadsData as never)
        .select();

      if (error) {
        console.error("Error creating leads:", error);
        return NextResponse.json(
          { success: false, error: "Failed to create leads", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        data,
        count: data?.length || 0
      });
    }

    // Handle single lead creation
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

    const { id, ...updates } = body;

    const { data, error } = await supabase
      .from("leads")
      .update(updates as never)
      .eq("id", id)
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
    
    // Try to get ids from request body for bulk delete
    let body: { ids?: string[] } | null = null;
    try {
      body = await request.json();
    } catch {
      // Body might not be JSON, that's okay
    }

    const ids = body?.ids || (id ? [id] : []);

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "id or ids array is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", ids);

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
