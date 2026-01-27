import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

const SQL_TO_RUN = `
ALTER TABLE calls ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_calls_tags ON calls USING GIN(tags);
`.trim();

// POST - Check and provide SQL to add tags column
export async function POST() {
  try {
    const supabase = createAdminClient();
    
    // Try to select with tags column to check if it exists
    const { error } = await supabase
      .from("calls")
      .select("tags")
      .limit(1);
    
    if (error && error.message.includes("tags")) {
      // Column doesn't exist
      return NextResponse.json({
        success: false,
        exists: false,
        message: "Tags column does not exist. Please run this SQL in your Supabase SQL Editor:",
        sql: SQL_TO_RUN,
      }, { status: 400 });
    }
    
    // Column exists
    return NextResponse.json({
      success: true,
      exists: true,
      message: "Tags column already exists",
    });
    
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({
      success: false,
      error: "Check failed",
      message: "Please run this SQL in your Supabase SQL Editor:",
      sql: SQL_TO_RUN,
      details: String(error),
    }, { status: 500 });
  }
}

// GET - Check if tags column exists
export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // Try to select with tags column
    const { error } = await supabase
      .from("calls")
      .select("tags")
      .limit(1);
    
    if (error && error.message.includes("tags")) {
      return NextResponse.json({
        exists: false,
        message: "Tags column does not exist",
        sql_to_run: SQL_TO_RUN,
      });
    }
    
    return NextResponse.json({
      exists: true,
      message: "Tags column exists",
    });
    
  } catch (error) {
    return NextResponse.json({
      error: "Check failed",
      details: String(error),
    }, { status: 500 });
  }
}
