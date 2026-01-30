import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

interface TimeSlot {
  id: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  callsPerSlot: number;
}

interface AutoCallCampaign {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  time_slots: TimeSlot[];
  timezone: string;
  created_at: string;
  updated_at: string;
}

// GET - List all auto-call campaigns for a user
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("auto_call_campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return NextResponse.json({
          success: true,
          data: [],
          message: "Auto call campaigns table not yet created"
        });
      }
      console.error("Error fetching campaigns:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("Campaigns API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new auto-call campaign
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { user_id, name, description, is_active, time_slots, timezone } = body;

    if (!user_id || !name) {
      return NextResponse.json(
        { success: false, error: "User ID and name are required" },
        { status: 400 }
      );
    }

    if (!time_slots || !Array.isArray(time_slots) || time_slots.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one time slot is required" },
        { status: 400 }
      );
    }

    // Check if table exists, if not create it
    const { error: tableCheckError } = await supabase
      .from("auto_call_campaigns")
      .select("id")
      .limit(1);

    if (tableCheckError && tableCheckError.code === "42P01") {
      // Table doesn't exist, create it
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS auto_call_campaigns (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          time_slots JSONB NOT NULL DEFAULT '[]',
          timezone TEXT DEFAULT 'Europe/Istanbul',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_auto_call_campaigns_user_id ON auto_call_campaigns(user_id);
        CREATE INDEX IF NOT EXISTS idx_auto_call_campaigns_is_active ON auto_call_campaigns(is_active);
      `;
      
      // Note: We can't run raw SQL easily, so we'll just try to insert and handle error
    }

    const campaignData = {
      user_id,
      name,
      description: description || null,
      is_active: is_active !== false,
      time_slots,
      timezone: timezone || "Europe/Istanbul",
    };

    const { data, error } = await supabase
      .from("auto_call_campaigns")
      .insert(campaignData as never)
      .select()
      .single();

    if (error) {
      console.error("Error creating campaign:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    }, { status: 201 });
  } catch (error) {
    console.error("Campaigns API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update an auto-call campaign
export async function PUT(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { id, user_id, ...updateData } = body;

    if (!id || !user_id) {
      return NextResponse.json(
        { success: false, error: "Campaign ID and User ID are required" },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("auto_call_campaigns")
      .update(dataToUpdate as never)
      .eq("id", id)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating campaign:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Campaigns API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an auto-call campaign
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!id || !userId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID and User ID are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("auto_call_campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting campaign:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    console.error("Campaigns API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
