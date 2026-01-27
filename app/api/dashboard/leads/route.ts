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

// GET - Fetch leads from Supabase - User-specific
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
    
    const idsOnly = searchParams.get("idsOnly") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = 100;
    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "created_at"; // Default sort by created_at
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc"; // Default desc

    // Build base query for filtering - MUST filter by user_id for security
    const selectFields = idsOnly ? "id" : "*";
    let baseQuery = supabase
      .from("leads")
      .select(selectFields, { count: "exact" })
      .eq("user_id", userId);

    if (status && status !== "all") {
      baseQuery = baseQuery.eq("status", status);
    }
    if (priority && priority !== "all") {
      baseQuery = baseQuery.eq("priority", priority);
    }
    if (search) {
      baseQuery = baseQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Build sorting - add secondary sort by id for consistent pagination
    const buildSortedQuery = (query: typeof baseQuery) => {
      if (sortBy === "priority") {
        // Priority sort: high -> medium -> low (custom order)
        // Use Postgres CASE expression via raw SQL is not available, 
        // so we'll sort alphabetically which happens to work: high < low < medium in reverse
        // Actually: "high" < "low" < "medium" alphabetically, so ascending gives h,l,m
        // We want: high, medium, low - so we need custom handling
        // Best approach: return sorted by priority field, client can handle display
        return query
          .order("priority", { ascending: sortOrder === "asc" })
          .order("id", { ascending: true }); // Secondary sort for consistency
      } else {
        return query
          .order(sortBy, { ascending: sortOrder === "asc" })
          .order("id", { ascending: true }); // Secondary sort for consistency
      }
    };

    // If idsOnly, return all IDs without pagination
    if (idsOnly) {
      const { data: allIds, count, error } = await buildSortedQuery(baseQuery) as { data: { id: string }[] | null; count: number | null; error: { message: string } | null };
      
      if (error) {
        console.error("Error fetching lead IDs:", error);
        return NextResponse.json(
          { success: false, error: "Failed to fetch lead IDs", details: error.message },
          { status: 500 }
        );
      }
      
      const ids = allIds?.map(lead => lead.id) || [];
      const total = count || 0;
      
      return NextResponse.json({
        success: true,
        data: ids,
        count: total,
      });
    }

    // Get paginated data with count in single query
    const { data: leads, count, error } = await buildSortedQuery(baseQuery)
      .range(offset, offset + limit - 1) as { data: LeadRecord[] | null; count: number | null; error: { message: string } | null };

    if (error) {
      console.error("Error fetching leads:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch leads", details: error.message },
        { status: 500 }
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);
    
    // Get all leads for stats (not just current page) - use a separate query
    let statsQuery = supabase
      .from("leads")
      .select("status")
      .eq("user_id", userId);
    
    if (status && status !== "all") {
      statsQuery = statsQuery.eq("status", status);
    }
    if (priority && priority !== "all") {
      statsQuery = statsQuery.eq("priority", priority);
    }
    if (search) {
      statsQuery = statsQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    
    const { data: allLeadsForStats } = await statsQuery;
    const allLeads = allLeadsForStats || [];
    const newLeads = allLeads.filter((l: any) => l.status === "new").length || 0;
    const contacted = allLeads.filter((l: any) => l.status === "contacted").length || 0;
    const interested = allLeads.filter((l: any) => l.status === "interested").length || 0;
    const appointmentSet = allLeads.filter((l: any) => l.status === "appointment_set").length || 0;
    const converted = allLeads.filter((l: any) => l.status === "converted").length || 0;
    const unreachable = allLeads.filter((l: any) => l.status === "unreachable").length || 0;

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
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

// POST - Create a new lead or multiple leads (CSV upload)
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Get user_id from query params or body (REQUIRED)
    let user_id = body.user_id || request.nextUrl.searchParams.get("userId");
    
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Handle bulk insert (CSV upload)
    if (body.leads && Array.isArray(body.leads)) {
      const leadsData = body.leads.map((lead: any) => {
        const validSources = ['web_form', 'instagram', 'referral', 'facebook', 'google_ads', 'other'];
        let source = lead.source?.toLowerCase() || 'other';
        if (!validSources.includes(source)) {
          source = 'other';
        }

        return {
          user_id: user_id,
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
          form_data: lead.form_data || {},
        };
      }).filter((lead: any) => lead.full_name || lead.phone || lead.email); // Filter out invalid leads

      if (leadsData.length === 0) {
        return NextResponse.json(
          { success: false, error: "No valid leads to insert" },
          { status: 400 }
        );
      }

      // Insert in batches of 100 (Supabase has limits)
      const BATCH_SIZE = 100;
      const batches: typeof leadsData[] = [];
      for (let i = 0; i < leadsData.length; i += BATCH_SIZE) {
        batches.push(leadsData.slice(i, i + BATCH_SIZE));
      }

      const allInserted: any[] = [];
      let errorOccurred: any = null;

      for (const batch of batches) {
        const { data, error } = await supabase
          .from("leads")
          .insert(batch as never)
          .select();

        if (error) {
          console.error("Error creating leads batch:", error);
          errorOccurred = error;
          break; // Stop on first error
        }

        if (data) {
          allInserted.push(...data);
        }
      }

      if (errorOccurred) {
        return NextResponse.json(
          { success: false, error: "Failed to create leads", details: errorOccurred.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: allInserted, count: allInserted.length });
    }

    // Handle single lead insert
    if (!body.full_name) {
      return NextResponse.json(
        { success: false, error: "full_name is required" },
        { status: 400 }
      );
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

// PATCH - Update a lead (User-specific)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const body = await request.json();

    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const id = searchParams.get("id") || body.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Lead ID is required" },
        { status: 400 }
      );
    }

    const { id: _, ...updates } = body;

    // Verify the lead belongs to this user before updating
    const { data: existingLead } = await supabase
      .from("leads")
      .select("user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!existingLead) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update(updates as never)
      .eq("id", id)
      .eq("user_id", userId)
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

// DELETE - Delete a lead or multiple leads (User-specific)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const id = searchParams.get("id");
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }
    
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

    // Verify all leads belong to this user before deleting
    const { data: existingLeads, error: verifyError } = await supabase
      .from("leads")
      .select("id")
      .in("id", ids)
      .eq("user_id", userId) as { data: { id: string }[] | null; error: { message: string } | null };

    if (verifyError) {
      console.error("Error verifying leads:", verifyError);
      return NextResponse.json(
        { success: false, error: "Failed to verify leads", details: verifyError.message },
        { status: 500 }
      );
    }

    // Only delete leads that exist and belong to the user
    const validIds = existingLeads?.map((lead: { id: string }) => lead.id) || [];
    
    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid leads found to delete" },
        { status: 404 }
      );
    }

    // If some IDs were not found, log a warning but continue with valid ones
    if (validIds.length < ids.length) {
      console.warn(`Only ${validIds.length} out of ${ids.length} leads found and will be deleted`);
    }

    // Delete in batches to avoid Supabase limits (max 1000 items per query)
    const batchSize = 500;
    let deletedCount = 0;
    let lastError: any = null;

    for (let i = 0; i < validIds.length; i += batchSize) {
      const batch = validIds.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from("leads")
        .delete()
        .in("id", batch)
        .eq("user_id", userId);

      if (deleteError) {
        console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
        lastError = deleteError;
      } else {
        deletedCount += batch.length;
      }
    }

    if (lastError && deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to delete leads", details: lastError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount,
      requestedCount: ids.length,
      validCount: validIds.length
    });
  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
