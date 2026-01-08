// ===========================================
// VOLINA AI - Mock Supabase Client (No Backend)
// ===========================================
// This file provides mock implementations for all database operations
// All functions return mock data - no actual Supabase connection

import type { Doctor, Appointment, Call, Profile } from './types';

// Mock mode flag - always true
export const isDemoMode = true;

// Mock Supabase client (not actually used, but kept for compatibility)
export const supabase = {
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
    update: () => ({ data: null, error: null }),
    delete: () => ({ data: null, error: null }),
    eq: () => ({ data: [], error: null }),
    single: () => ({ data: null, error: null }),
  }),
  removeChannel: () => {},
  channel: () => ({
    on: () => ({
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
  }),
} as any;

// Mock admin client
export function createAdminClient() {
  return supabase;
}

// ===========================================
// Mock Data
// ===========================================

const mockDoctors: Doctor[] = [
  {
    id: "d1a2b3c4-5678-90ab-cdef-111111111111",
    name: "Sarah Chen",
    specialty: "Sales",
    color_code: "#0055FF",
    avatar_url: null,
    email: "sarah.chen@volina.ai",
    phone: "+1 (555) 123-4567",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "d1a2b3c4-5678-90ab-cdef-222222222222",
    name: "Michael Torres",
    specialty: "Support",
    color_code: "#10B981",
    avatar_url: null,
    email: "michael.torres@volina.ai",
    phone: "+1 (555) 234-5678",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "d1a2b3c4-5678-90ab-cdef-333333333333",
    name: "Emily Watson",
    specialty: "Consulting",
    color_code: "#F59E0B",
    avatar_url: null,
    email: "emily.watson@volina.ai",
    phone: "+1 (555) 345-6789",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ===========================================
// Database Query Functions (Mock)
// ===========================================

// Doctors
export async function getDoctors(): Promise<Doctor[]> {
  return Promise.resolve(mockDoctors.filter(d => d.is_active));
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  return Promise.resolve(mockDoctors.find(d => d.id === id) || null);
}

// Appointments
export async function getAppointments(date?: string): Promise<Appointment[]> {
  const baseDate = date || new Date().toISOString().split('T')[0];
  
  const mockAppointments: Appointment[] = [
    {
      id: "apt-1",
      doctor_id: "d1a2b3c4-5678-90ab-cdef-111111111111",
      patient_name: "John Smith",
      patient_phone: "+1 (555) 111-0001",
      patient_email: "john.smith@email.com",
      start_time: `${baseDate}T09:00:00`,
      end_time: `${baseDate}T09:30:00`,
      status: "scheduled",
      notes: "Sales consultation",
      created_via_ai: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      doctor: mockDoctors[0],
    },
    {
      id: "apt-2",
      doctor_id: "d1a2b3c4-5678-90ab-cdef-111111111111",
      patient_name: "Maria Garcia",
      patient_phone: "+1 (555) 111-0002",
      patient_email: "maria.garcia@email.com",
      start_time: `${baseDate}T10:00:00`,
      end_time: `${baseDate}T10:30:00`,
      status: "confirmed",
      notes: "Follow-up call",
      created_via_ai: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      doctor: mockDoctors[0],
    },
  ];

  return Promise.resolve(mockAppointments);
}

export async function getAppointmentsByDoctor(doctorId: string, date?: string): Promise<Appointment[]> {
  const all = await getAppointments(date);
  return Promise.resolve(all.filter(apt => apt.doctor_id === doctorId));
}

export async function createAppointment(appointment: any): Promise<Appointment> {
  const newAppointment: Appointment = {
    ...appointment,
    id: `apt-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return Promise.resolve(newAppointment);
}

export async function updateAppointmentStatus(id: string, status: Appointment['status']): Promise<Appointment> {
  const existing = await getAppointments();
  const appointment = existing.find(a => a.id === id) || {
    id,
    doctor_id: "",
    patient_name: "",
    patient_phone: null,
    patient_email: null,
    start_time: new Date().toISOString(),
    end_time: new Date().toISOString(),
    status: "scheduled",
    notes: null,
    created_via_ai: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  return Promise.resolve({
    ...appointment,
    status,
    updated_at: new Date().toISOString(),
  });
}

// Calls
export async function getCalls(limit = 50): Promise<Call[]> {
  const mockCalls: Call[] = [
    {
      id: "1",
      vapi_call_id: "vapi_call_001",
      appointment_id: null,
      recording_url: "https://api.vapi.ai/recordings/sample1.mp3",
      transcript: "Agent: Hello, this is Volina AI. How can I help you today?\nCaller: Hi, I'd like to schedule an appointment.",
      summary: "Customer scheduled an appointment for 9 AM tomorrow.",
      sentiment: "positive",
      duration: 145,
      type: "appointment",
      caller_phone: "+1 (555) 111-0002",
      metadata: {},
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "2",
      vapi_call_id: "vapi_call_002",
      appointment_id: null,
      recording_url: "https://api.vapi.ai/recordings/sample2.mp3",
      transcript: "Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I have a question about your services.",
      summary: "Customer inquired about operating hours.",
      sentiment: "neutral",
      duration: 98,
      type: "inquiry",
      caller_phone: "+1 (555) 444-5555",
      metadata: {},
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ];

  return Promise.resolve(mockCalls.slice(0, limit));
}

export async function getCallById(id: string): Promise<Call | null> {
  const calls = await getCalls();
  return Promise.resolve(calls.find(c => c.id === id) || null);
}

export async function createCall(call: any): Promise<Call> {
  const newCall: Call = {
    ...call,
    id: `call-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return Promise.resolve(newCall);
}

// Analytics
export async function getCallStats() {
  return Promise.resolve({
    monthlyCalls: 1250,
    dailyCalls: 45,
    avgDuration: 120,
    typeDistribution: {
      appointment: 600,
      inquiry: 400,
      follow_up: 150,
      cancellation: 100,
    },
  });
}

// User Profile
export async function getProfile(userId: string): Promise<Profile | null> {
  return Promise.resolve({
    id: userId,
    email: "demo@volina.ai",
    full_name: "Demo User",
    avatar_url: null,
    role: "admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// ===========================================
// Realtime Subscriptions (Mock - No-op)
// ===========================================

export function subscribeToAppointments(
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Appointment | null;
    old: Appointment | null;
  }) => void
) {
  // Return a mock channel that does nothing
  return {
    unsubscribe: () => {},
  } as any;
}

export function subscribeToCalls(
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Call | null;
    old: Call | null;
  }) => void
) {
  // Return a mock channel that does nothing
  return {
    unsubscribe: () => {},
  } as any;
}
