export interface Patient {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  condition: string;
  assignedPhysioId: string;
  createdAt: string;
}

export interface PatientSession {
  id: string;
  patientId: string;
  exerciseId: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'paused';
  score: number;
  repsCompleted: number;
}
