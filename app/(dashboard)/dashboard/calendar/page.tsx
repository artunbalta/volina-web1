"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, subDays, isSameDay, parseISO } from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  RefreshCw,
  Plus,
  Clock,
  User,
  Phone,
  Bot,
  X,
  Check
} from "lucide-react";
import { Calendar } from "@/components/dashboard/Calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatTime, getStatusColor } from "@/lib/utils";
import { useAuth } from "@/components/providers/SupabaseProvider";
import { 
  getDoctors, 
  getAppointments, 
  createAppointment, 
  updateAppointmentStatus, 
  deleteAppointment,
  subscribeToAppointments 
} from "@/lib/supabase";
import type { Doctor, Appointment } from "@/lib/types";


export default function CalendarPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    name: "",
    email: "",
    phone: "",
    assignee: "",
    time: "09:00",
    notes: "",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [doctorsData, appointmentsData] = await Promise.all([
        getDoctors(),
        getAppointments(format(selectedDate, "yyyy-MM-dd")),
      ]);
      
      setDoctors(doctorsData);
      setAppointments(appointmentsData);
      
      // Set default assignee if doctors loaded and no assignee set
      if (doctorsData.length > 0 && !newAppointment.assignee) {
        setNewAppointment(prev => ({ ...prev, assignee: doctorsData[0].id }));
      }
    } catch (error) {
      console.error("Error loading calendar data:", error);
    }
  }, [selectedDate, newAppointment.assignee]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData().then(() => setIsLoading(false));
    }
  }, [isAuthenticated, loadData]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = subscribeToAppointments((payload) => {
      if (payload.eventType === "INSERT" && payload.new) {
        const newApt = payload.new as Appointment;
        if (isSameDay(parseISO(newApt.start_time), selectedDate)) {
          setAppointments(prev => [...prev, newApt]);
        }
      } else if (payload.eventType === "UPDATE" && payload.new) {
        setAppointments(prev => prev.map(apt => 
          apt.id === (payload.new as Appointment).id ? payload.new as Appointment : apt
        ));
      } else if (payload.eventType === "DELETE" && payload.old) {
        setAppointments(prev => prev.filter(apt => apt.id !== (payload.old as Appointment).id));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthenticated, selectedDate]);

  // Reload appointments when date changes
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      getAppointments(format(selectedDate, "yyyy-MM-dd")).then(setAppointments);
    }
  }, [selectedDate, isAuthenticated, isLoading]);

  const handlePrevDay = () => {
    setSelectedDate((prev) => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleCreateAppointment = async () => {
    if (!newAppointment.name.trim() || !newAppointment.assignee) {
      alert("Please enter a client name and select an assignee");
      return;
    }

    setIsSaving(true);

    const baseDate = format(selectedDate, "yyyy-MM-dd");
    const timeParts = newAppointment.time.split(":");
    const hours = parseInt(timeParts[0] || "9", 10);
    const minutes = parseInt(timeParts[1] || "0", 10);
    
    // Calculate end time (30 minutes after start)
    let endHours = hours;
    let endMinutes = minutes + 30;
    if (endMinutes >= 60) {
      endHours += 1;
      endMinutes -= 60;
    }
    const endTimeStr = `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;

    const appointmentData = {
      doctor_id: newAppointment.assignee,
      patient_name: newAppointment.name.trim(),
      patient_phone: newAppointment.phone.trim() || null,
      patient_email: newAppointment.email.trim() || null,
      start_time: `${baseDate}T${newAppointment.time}:00`,
      end_time: `${baseDate}T${endTimeStr}:00`,
      status: "scheduled" as const,
      notes: newAppointment.notes.trim() || null,
      created_via_ai: false,
    };

    try {
      const newApt = await createAppointment(appointmentData);
      
      if (newApt) {
        setAppointments(prev => [...prev, newApt]);
        setSaveSuccess(true);
        
        setTimeout(() => {
          setSaveSuccess(false);
          setShowNewAppointment(false);
          setNewAppointment({
            name: "",
            email: "",
            phone: "",
            assignee: doctors[0]?.id || "",
            time: "09:00",
            notes: "",
          });
        }, 1500);
      } else {
        alert("Failed to create appointment. Please try again.");
      }
    } catch (error) {
      console.error("Error creating appointment:", error);
      alert("Failed to create appointment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmAppointment = async () => {
    if (selectedAppointment) {
      const updated = await updateAppointmentStatus(selectedAppointment.id, "confirmed");
      if (updated) {
        setAppointments(appointments.map(apt => 
          apt.id === selectedAppointment.id 
            ? { ...apt, status: "confirmed" as const }
            : apt
        ));
        setSelectedAppointment({ ...selectedAppointment, status: "confirmed" });
      }
    }
  };

  const handleCancelAppointment = async () => {
    if (selectedAppointment) {
      const success = await deleteAppointment(selectedAppointment.id);
      if (success) {
        setAppointments(appointments.filter(apt => apt.id !== selectedAppointment.id));
        setSelectedAppointment(null);
      }
    }
  };

  const getDoctor = (doctorId: string) => {
    return doctors.find((d) => d.id === doctorId);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="h-[700px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Show empty state if no doctors
  if (doctors.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar CRM</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage appointments across all team members with real-time updates.
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No team members yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
            Add team members (doctors/agents) to start scheduling appointments. You can do this from the Settings page.
          </p>
          <Button onClick={() => router.push("/dashboard/settings")}>
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar CRM</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage appointments across all team members with real-time updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowNewAppointment(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevDay} className="dark:bg-gray-700 dark:border-gray-600">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextDay} className="dark:bg-gray-700 dark:border-gray-600">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleToday} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
            Today
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </h2>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-primary">{appointments.length}</span>{" "}
          appointments today
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {doctors.map((doctor) => {
          const doctorAppointments = appointments.filter(
            (apt) => apt.doctor_id === doctor.id
          );
          const aiBooked = doctorAppointments.filter((apt) => apt.created_via_ai).length;

          return (
            <div key={doctor.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div
                className="h-1"
                style={{ backgroundColor: doctor.color_code }}
              />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{doctor.name}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {doctorAppointments.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Bot className="w-3 h-3" />
                      <span>{aiBooked} AI booked</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar */}
      <Calendar
        doctors={doctors}
        appointments={appointments}
        selectedDate={selectedDate}
        onAppointmentClick={handleAppointmentClick}
      />

      {/* Appointment Detail Modal */}
      <Dialog
        open={!!selectedAppointment}
        onOpenChange={() => setSelectedAppointment(null)}
      >
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-white">
              Appointment Details
              {selectedAppointment?.created_via_ai && (
                <span className="inline-flex items-center gap-1 text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded-full">
                  <Bot className="w-3 h-3" />
                  AI Booked
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {selectedAppointment && format(parseISO(selectedAppointment.start_time), "EEEE, MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 mt-4">
              {/* Client info */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedAppointment.patient_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAppointment.patient_email || "No email"}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Time</span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatTime(selectedAppointment.start_time)} -{" "}
                    {formatTime(selectedAppointment.end_time)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Phone className="w-4 h-4" />
                    <span className="text-xs">Phone</span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedAppointment.patient_phone || "N/A"}
                  </p>
                </div>
              </div>

              {/* Assignee */}
              {(() => {
                const doctor = getDoctor(selectedAppointment.doctor_id);
                return doctor ? (
                  <div className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-xl">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm"
                      style={{ backgroundColor: doctor.color_code }}
                    >
                      {doctor.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{doctor.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{doctor.specialty}</p>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Status */}
              <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-xl">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium capitalize",
                    getStatusColor(selectedAppointment.status)
                  )}
                >
                  {selectedAppointment.status}
                </span>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  onClick={handleCancelAppointment}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleConfirmAppointment}
                  disabled={selectedAppointment.status === "confirmed"}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {selectedAppointment.status === "confirmed" ? "Confirmed" : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Appointment Modal */}
      <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">New Appointment</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Schedule a new appointment for {format(selectedDate, "MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="dark:text-gray-300">Client Name</Label>
              <Input
                id="name"
                value={newAppointment.name}
                onChange={(e) => setNewAppointment({ ...newAppointment, name: e.target.value })}
                placeholder="John Smith"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="dark:text-gray-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newAppointment.email}
                  onChange={(e) => setNewAppointment({ ...newAppointment, email: e.target.value })}
                  placeholder="john@email.com"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="dark:text-gray-300">Phone</Label>
                <Input
                  id="phone"
                  value={newAppointment.phone}
                  onChange={(e) => setNewAppointment({ ...newAppointment, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignee" className="dark:text-gray-300">Assign To</Label>
                <select
                  id="assignee"
                  value={newAppointment.assignee}
                  onChange={(e) => setNewAppointment({ ...newAppointment, assignee: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="dark:text-gray-300">Time</Label>
                <select
                  id="time"
                  value={newAppointment.time}
                  onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {Array.from({ length: 18 }, (_, i) => {
                    const hour = Math.floor(i / 2) + 9;
                    const minute = i % 2 === 0 ? "00" : "30";
                    const time = `${hour.toString().padStart(2, "0")}:${minute}`;
                    return (
                      <option key={time} value={time}>
                        {hour > 12 ? hour - 12 : hour}:{minute} {hour >= 12 ? "PM" : "AM"}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="dark:text-gray-300">Notes (optional)</Label>
              <Input
                id="notes"
                value={newAppointment.notes}
                onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                placeholder="Add any notes..."
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowNewAppointment(false)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateAppointment}
              disabled={!newAppointment.name || !newAppointment.assignee || saveSuccess || isSaving}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Created!
                </>
              ) : isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Appointment
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
