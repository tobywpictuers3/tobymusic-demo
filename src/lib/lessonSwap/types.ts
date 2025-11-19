// Types for the new lesson swap system

export interface SwapRequest {
  id: string;
  requesterStudentId: string;
  requesterLessonId: string;
  targetLessonId: string;
  targetStudentId: string;
  requesterSwapCode: string;
  targetSwapCode?: string;
  status: 'pending_manager' | 'auto_approved' | 'rejected' | 'cancelled';
  createdAt: string;
  resolvedAt?: string;
  reason?: string;
}
