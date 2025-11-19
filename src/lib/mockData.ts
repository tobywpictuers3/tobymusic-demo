import { Student, Lesson, Payment, SwapRequest, FileEntry } from './types';

// Mock data for offline functionality
export const mockStudents: Student[] = [
  {
    id: '1',
    firstName: 'שרה',
    lastName: 'כהן',
    phone: '052-123-4567',
    email: 'sarah.cohen@email.com',
    personalCode: '1234',
    swapCode: '4321',
    startDate: '2024-01-15',
    startingLessonNumber: 1,
    annualAmount: 4800,
    paymentMonths: 12,
    monthlyAmount: 400
  },
  {
    id: '2',
    firstName: 'רחל',
    lastName: 'לוי',
    phone: '054-987-6543',
    email: 'rachel.levi@email.com',
    personalCode: '5678',
    swapCode: '8765',
    startDate: '2024-02-01',
    startingLessonNumber: 1,
    annualAmount: 4800,
    paymentMonths: 12,
    monthlyAmount: 400
  },
  {
    id: '3',
    firstName: 'מירי',
    lastName: 'אברהם',
    phone: '050-555-1234',
    email: 'miri.abraham@email.com',
    personalCode: '9012',
    swapCode: '2109',
    startDate: '2024-03-10',
    startingLessonNumber: 1,
    annualAmount: 4200,
    paymentMonths: 12,
    monthlyAmount: 350
  }
];

export const mockLessons: Lesson[] = [
  {
    id: '1',
    studentId: '1',
    date: '2024-08-19',
    startTime: '16:00',
    endTime: '16:45',
    status: 'scheduled',
    isOneOff: false,
    lockedNumber: 1
  },
  {
    id: '2',
    studentId: '2',
    date: '2024-08-19',
    startTime: '17:00',
    endTime: '17:45',
    status: 'scheduled',
    isOneOff: false,
    lockedNumber: 2
  },
  {
    id: '3',
    studentId: '3',
    date: '2024-08-20',
    startTime: '15:30',
    endTime: '16:15',
    status: 'scheduled',
    isOneOff: false,
    lockedNumber: 1
  }
];

export const mockPayments: Payment[] = [
  {
    id: '1',
    studentId: '1',
    month: '2024-08',
    amount: 400,
    status: 'paid',
    paymentMethod: 'bank',
    paidDate: '2024-08-01'
  },
  {
    id: '2',
    studentId: '2',
    month: '2024-08',
    amount: 400,
    status: 'pending',
    paymentMethod: 'check'
  },
  {
    id: '3',
    studentId: '3',
    month: '2024-08',
    amount: 350,
    status: 'paid',
    paymentMethod: 'cash',
    paidDate: '2024-08-05'
  }
];

export const mockSwapRequests: SwapRequest[] = [
  {
    id: '1',
    requesterId: '1',
    targetId: '2',
    date: '2024-08-26',
    time: '16:00',
    reason: 'אירוע משפחתי',
    status: 'pending',
    createdAt: '2024-08-18T10:30:00Z'
  }
];

export const mockFiles: FileEntry[] = [
  {
    id: '1',
    studentId: '1',
    name: 'תרגיל 1 - סולמות.pdf',
    webViewLink: 'https://drive.google.com/file/d/example1',
    uploadDate: '2024-08-15'
  },
  {
    id: '2',
    studentId: '1',
    name: 'הקלטת שיעור 5.mp3',
    webViewLink: 'https://drive.google.com/file/d/example2',
    uploadDate: '2024-08-10'
  },
  {
    id: '3',
    studentId: '2',
    name: 'יצירה לתרגול - באך.pdf',
    webViewLink: 'https://drive.google.com/file/d/example3',
    uploadDate: '2024-08-12'
  }
];