import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get("endDate") || new Date().toISOString();

    // Fetch leads stats
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (leadsError) {
      console.error("Error fetching leads:", leadsError);
    }

    const leadsData = leads || [];

    // Fetch calls stats
    const { data: calls, error: callsError } = await supabase
      .from("calls")
      .select("*")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (callsError) {
      console.error("Error fetching calls:", callsError);
    }

    const callsData = calls || [];

    // Fetch messages stats
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
    }

    const messagesData = messages || [];

    // Calculate analytics
    const totalLeads = leadsData.length;
    const newLeads = leadsData.filter((l: any) => l.status === "new").length;
    const contactedLeads = leadsData.filter((l: any) => l.status === "contacted").length;
    const interestedLeads = leadsData.filter((l: any) => l.status === "interested").length;
    const appointmentsSet = leadsData.filter((l: any) => l.status === "appointment_set").length;
    const convertedLeads = leadsData.filter((l: any) => l.status === "converted").length;
    const lostLeads = leadsData.filter((l: any) => l.status === "lost").length;

    const totalCalls = callsData.length;
    const answeredCalls = callsData.filter((c: any) => c.duration && c.duration > 0).length;
    const missedCalls = totalCalls - answeredCalls;

    const totalMessages = messagesData.length;
    const deliveredMessages = messagesData.filter((m: any) => m.status === "delivered").length;
    const readMessages = messagesData.filter((m: any) => m.read_at).length;

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
    const responseRate = totalMessages > 0 ? (readMessages / totalMessages) * 100 : 0;

    // Group by source
    const leadsBySource = Object.entries(
      leadsData.reduce((acc: any, lead: any) => {
        const source = lead.source || "unknown";
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    // Group by status
    const leadsByStatus = Object.entries(
      leadsData.reduce((acc: any, lead: any) => {
        const status = lead.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    // Daily activity
    const dailyActivity = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const dayLeads = leadsData.filter((l: any) => l.created_at?.startsWith(dateStr)).length;
      const dayCalls = callsData.filter((c: any) => c.created_at?.startsWith(dateStr)).length;
      const dayMessages = messagesData.filter((m: any) => m.created_at?.startsWith(dateStr)).length;
      dailyActivity.push({
        date: dateStr,
        leads: dayLeads,
        calls: dayCalls,
        messages: dayMessages,
      });
    }

    // Channel performance
    const channelPerformance = [
      { channel: "call", sent: totalCalls, delivered: answeredCalls, opened: answeredCalls, replied: 0 },
      { channel: "whatsapp", sent: messagesData.filter((m: any) => m.channel === "whatsapp").length, delivered: 0, opened: 0, replied: 0 },
      { channel: "email", sent: messagesData.filter((m: any) => m.channel === "email").length, delivered: 0, opened: 0, replied: 0 },
      { channel: "sms", sent: messagesData.filter((m: any) => m.channel === "sms").length, delivered: 0, opened: 0, replied: 0 },
    ];

    return NextResponse.json({
      success: true,
      data: {
        totalLeads,
        newLeads,
        contactedLeads,
        interestedLeads,
        appointmentsSet,
        convertedLeads,
        lostLeads,
        totalCalls,
        answeredCalls,
        missedCalls,
        totalMessages,
        deliveredMessages,
        readMessages,
        conversionRate,
        responseRate,
        averageResponseTime: 0,
        leadsBySource,
        leadsByStatus,
        callsByResult: [],
        dailyActivity,
        channelPerformance,
      },
    });
  } catch (error: any) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        data: {
          totalLeads: 0, newLeads: 0, contactedLeads: 0, interestedLeads: 0,
          appointmentsSet: 0, convertedLeads: 0, lostLeads: 0,
          totalCalls: 0, answeredCalls: 0, missedCalls: 0,
          totalMessages: 0, deliveredMessages: 0, readMessages: 0,
          conversionRate: 0, responseRate: 0, averageResponseTime: 0,
          leadsBySource: [], leadsByStatus: [], callsByResult: [],
          dailyActivity: [], channelPerformance: [],
        }
      },
      { status: 500 }
    );
  }
}

