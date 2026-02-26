import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUCCESS_MESSAGE =
  "If an account exists with that email, we've sent instructions to reset your password. Check your inbox and spam folder.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Use the request origin so the reset link points to where the user is (production vs localhost)
    const baseUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "";
    const redirectTo = baseUrl ? `${baseUrl}/reset-password` : "";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // Intentionally not exposing errors (e.g. user not found) to avoid email enumeration
  }

  return NextResponse.json({
    success: true,
    message: SUCCESS_MESSAGE,
  });
}
