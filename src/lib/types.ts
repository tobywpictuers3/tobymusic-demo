
// Data Models for Music Students Management System - Updated

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  additionalPhones?: string[]; // Additional phone numbers
  additionalEmails?: string[]; // Additional email addresses
  personalCode: string; // 4-digit personal code
  startDate: string; // ISO date string (default: September 1st)
  endDate?: string; // Optional end date - when student stops lessons
  startingLessonNumber: number; // Starting lesson number (default: 1)
  annualAmount: number; // Annual payment amount
  paymentMonths: number; // Number of payment months (default: 12)
  calculatedAmount?: number; // Proportional amount when starting mid-year (overrides annualAmount for payment calculation)
  monthlyAmount: number; // Calculated: (calculatedAmount || annualAmount) / paymentMonths
  notes?: string;
}

export interface Lesson {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  isOneOff?: boolean; // for makeup lessons or special sessions
  lockedNumber?: number; // locked lesson number that won't change
  isFromTemplate?: boolean; // indicates lesson was generated from active template
  grade?: number; // lesson grade 1-5 (homework grade)
  gradeNotes?: string; // optional text notes for the grade
}

export interface Payment {
  id: string;
  studentId: string;
  month: string; // YYYY-MM format
  amount: number;
  status: 'not_paid' | 'pending' | 'paid' | 'debt';
  paymentMethod: 'bank' | 'check' | 'cash' | 'inactive';
  notes?: string;
  paidDate?: string;
}

export interface OneTimePayment {
  id: string;
  month: string; // YYYY-MM format
  amount: number;
  description: string;
  paidDate: string;
}

export interface Performance {
  id: string;
  name: string;
  client?: string;
  clientEmail?: string;
  clientPhone?: string;
  date: string; // YYYY-MM-DD format
  timeEstimate?: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | string; // can be specific time HH:MM or general
  orderContent?: string;
  amount?: number;
  travel?: number;
  invoiceNumber?: string;
  receiptNumber?: string;
  paymentStatus: 'not_paid' | 'bank' | 'check' | 'cash';
  paidDate?: string; // YYYY-MM-DD format
  notes?: string;
  status: 'open' | 'closed'; // open = not finalized, closed = finalized
  createdAt: string;
}

export interface SwapRequest {
  id: string;
  requesterId: string;
  targetId: string;
  date: string;
  time: string;
  targetDate?: string; // New field for target lesson date
  targetTime?: string; // New field for target lesson time
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface FileEntry {
  id: string;
  studentId: string;
  name: string;
  description?: string; // optional description/explanation for the file
  webViewLink: string;
  uploadDate: string;
}

export interface IntegrationSettings {
  apiBaseUrl: string;
  apiSecret: string;
  syncEnabled: boolean;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  effectiveDate: string; // ISO date string - when this template becomes active
  isActive: boolean;
  schedule: WeeklyScheduleData;
  createdAt: string;
  activatedAt?: string; // When this template was activated
  deactivatedAt?: string; // When this template was deactivated
}

export interface WeeklyScheduleData {
  [dayOfWeek: string]: { // '0'-'6' for Sunday-Saturday
    [timeSlot: string]: { // 'HH:MM' format
      studentId: string;
      studentName?: string; // cached for display
      duration: 30; // always 30 minutes
    };
  };
}

export interface StudentSchedule {
  studentId: string;
  dayOfWeek: number; // 0-6
  timeSlot: string; // HH:MM
  duration: 30; // always 30 minutes
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD format
  description?: string;
  createdAt: string;
}
