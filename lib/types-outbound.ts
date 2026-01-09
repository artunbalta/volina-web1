// ===========================================
// Outbound Sales Dashboard Types
// ===========================================

export interface Lead {
  id: string;
  user_id: string;
  
  // Contact Info
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  
  // Details
  language: 'tr' | 'en';
  source: 'web_form' | 'instagram' | 'referral' | 'facebook' | 'google_ads' | 'other';
  treatment_interest: string | null;
  notes: string | null;
  
  // Status
  status: 'new' | 'contacted' | 'interested' | 'appointment_set' | 'converted' | 'lost' | 'unreachable';
  priority: 'high' | 'medium' | 'low';
  
  // Follow-up
  first_contact_date: string | null;
  last_contact_date: string | null;
  next_contact_date: string | null;
  contact_attempts: number;
  unreachable_since: string | null;
  
  // Campaign
  campaign_id: string | null;
  campaign_day: number;
  
  // Meta
  form_data: Record<string, unknown>;
  tags: string[];
  assigned_to: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  duration_days: number;
  max_attempts_per_period: number;
  unreachable_threshold_days: number;
  schedule: CampaignTouchpoint[];
  default_language: 'tr' | 'en';
  created_at: string;
  updated_at: string;
}

export interface CampaignTouchpoint {
  day: number;
  channel: 'call' | 'whatsapp' | 'email' | 'sms' | 'instagram_dm';
  template?: string;
  description?: string;
}

export interface Outreach {
  id: string;
  user_id: string;
  lead_id: string;
  campaign_id: string | null;
  
  // Channel
  channel: 'call' | 'whatsapp' | 'email' | 'sms' | 'instagram_dm';
  direction: 'outbound' | 'inbound';
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'scheduled';
  result: OutreachResult | null;
  
  // Call specific
  duration: number | null;
  recording_url: string | null;
  transcript: string | null;
  
  // Message specific
  message_content: string | null;
  template_used: string | null;
  
  // AI
  ai_summary: string | null;
  ai_sentiment: 'positive' | 'neutral' | 'negative' | null;
  ai_next_action: string | null;
  
  // Scheduling
  scheduled_for: string | null;
  completed_at: string | null;
  
  // VAPI
  vapi_call_id: string | null;
  
  // Meta
  metadata: Record<string, unknown>;
  notes: string | null;
  performed_by: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  lead?: Lead;
}

export type OutreachResult = 
  | 'answered_interested'
  | 'answered_not_interested'
  | 'answered_callback_requested'
  | 'answered_appointment_set'
  | 'no_answer'
  | 'busy'
  | 'voicemail'
  | 'wrong_number'
  | 'message_sent'
  | 'message_delivered'
  | 'message_read'
  | 'message_replied';

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  channel: 'whatsapp' | 'email' | 'sms' | 'instagram_dm' | 'call_script';
  language: 'tr' | 'en';
  subject: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface AISettings {
  id: string;
  user_id: string;
  company_name: string;
  agent_name: string;
  opening_script_tr: string;
  opening_script_en: string;
  announce_ai: boolean;
  persistence_level: 'low' | 'medium' | 'high';
  curiosity_questions: string[];
  primary_goal: string;
  call_hours_start: string;
  call_hours_end: string;
  call_days: string[];
  vapi_assistant_id: string | null;
  vapi_phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnlineAppointment {
  id: string;
  user_id: string;
  lead_id: string;
  outreach_id: string | null;
  appointment_date: string;
  doctor_name: string | null;
  treatment_type: string | null;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  meeting_link: string | null;
  meeting_platform: 'zoom' | 'google_meet' | 'teams' | 'whatsapp_video' | 'other';
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined
  lead?: Lead;
}

// Dashboard Stats
export interface OutboundStats {
  total_leads: number;
  new_leads: number;
  contacted_leads: number;
  interested_leads: number;
  appointments_set: number;
  converted_leads: number;
  unreachable_leads: number;
  todays_calls: number;
  completed_calls_today: number;
  conversion_rate: number;
}

// Funnel Data
export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

// Channel Performance
export interface ChannelPerformance {
  channel: string;
  attempts: number;
  successes: number;
  conversion_rate: number;
}
