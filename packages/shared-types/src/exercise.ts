export type ExerciseCategory = 'shoulder' | 'elbow' | 'wrist' | 'knee' | 'hip' | 'spine';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  targetReps: number;
  targetSets: number;
  targetROM: number; // degrees
  difficulty: 1 | 2 | 3;
  instructions: string[];
}

export interface ExerciseResult {
  sessionId: string;
  exerciseId: string;
  repsCompleted: number;
  maxROM: number;
  avgROM: number;
  durationSeconds: number;
  score: number;
  completedAt: string;
}
