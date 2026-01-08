// ===========================================
// VOLINA AI - Supabase Client Configuration
// ===========================================
// @ts-nocheck
// TODO: Remove ts-nocheck when Supabase is connected and types are generated

import { createClient } from '@supabase/supabase-js';
import type { Doctor, Appointment, Call, Profile } from './types';

// Type definitions for the database
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      doctors: {
        Row: Doctor;
        Insert: Omit<Doctor, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Doctor, 'id' | 'created_at' | 'updated_at'>>;
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Appointment, 'id' | 'created_at' | 'updated_at'>>;
      };
      calls: {
        Row: Call;
        Insert: Omit<Call, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Call, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}

// Environment variables with fallbacks for demo mode
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';

// Demo mode flag
export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

// Create Supabase client for browser/client-side usage
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Create admin client for server-side operations
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-service-key';

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ===========================================
// Database Query Functions
// ===========================================

// Doctors
export async function getDoctors() {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data;
}

export async function getDoctorById(id: string) {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Appointments
export async function getAppointments(date?: string) {
  let query = supabase
    .from('appointments')
    .select(`
      *,
      doctor:doctors(*)
    `)
    .order('start_time', { ascending: true });

  if (date) {
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    query = query
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getAppointmentsByDoctor(doctorId: string, date?: string) {
  let query = supabase
    .from('appointments')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('start_time', { ascending: true });

  if (date) {
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    query = query
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function createAppointment(appointment: Database['public']['Tables']['appointments']['Insert']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('appointments') as any)
    .insert(appointment)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAppointmentStatus(id: string, status: Appointment['status']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('appointments') as any)
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Calls
export async function getCalls(limit = 50) {
  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      appointment:appointments(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getCallById(id: string) {
  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      appointment:appointments(
        *,
        doctor:doctors(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCall(call: Database['public']['Tables']['calls']['Insert']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('calls') as any)
    .insert(call)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Analytics
export async function getCallStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Monthly calls
  const { count: monthlyCalls } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth);

  // Daily calls
  const { count: dailyCalls } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay);

  // Average duration
  const { data: durationData } = await supabase
    .from('calls')
    .select('duration')
    .not('duration', 'is', null);

  const avgDuration = durationData && durationData.length > 0
    ? durationData.reduce((sum, c) => sum + (c.duration || 0), 0) / durationData.length
    : 0;

  // Call type distribution
  const { data: typeData } = await supabase
    .from('calls')
    .select('type');

  const typeDistribution = typeData?.reduce((acc, call) => {
    acc[call.type] = (acc[call.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return {
    monthlyCalls: monthlyCalls || 0,
    dailyCalls: dailyCalls || 0,
    avgDuration: Math.round(avgDuration),
    typeDistribution,
  };
}

// User Profile
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

// ===========================================
// Realtime Subscriptions
// ===========================================

export function subscribeToAppointments(
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Appointment | null;
    old: Appointment | null;
  }) => void
) {
  return supabase
    .channel('appointments-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Appointment | null,
          old: payload.old as Appointment | null,
        });
      }
    )
    .subscribe();
}

export function subscribeToCalls(
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Call | null;
    old: Call | null;
  }) => void
) {
  return supabase
    .channel('calls-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'calls',
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Call | null,
          old: payload.old as Call | null,
        });
      }
    )
    .subscribe();
}

