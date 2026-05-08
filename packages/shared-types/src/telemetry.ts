export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface HandFrame {
  position: Vector3;
  rotation: Quaternion;
  joints?: Record<string, Vector3>;
}

export interface TelemetryFrame {
  patientId: string;
  sessionId: string;
  timestamp: number;
  headPosition: Vector3;
  headRotation: Quaternion;
  leftHand?: HandFrame;
  rightHand?: HandFrame;
  currentROM?: number;
  currentRep?: number;
}

export interface CoachDecision {
  ts: number;
  sessionId: string;
  patientId: string;
  difficulty_delta: 'increase' | 'decrease' | 'hold';
  message: string;                 // motivational line for the patient
  suggested_achievement?: string;  // optional title to celebrate
  rationale: string;               // one-line note for the physio
}

/** Live in-game target adjustment, broadcast to VR + dashboard. */
export interface CoachTargetUpdate {
  ts: number;
  sessionId: string;
  patientId: string;
  previousTargetROM: number;
  newTargetROM: number;
  reason: string;                  // short blurb for HUD ("Pushing for +5°")
}

/** Per-session AI-generated mini-challenge. */
export type ChallengeCriteria =
  | { type: 'rom_milestone'; threshold: number }
  | { type: 'rep_count';     threshold: number }
  | { type: 'consistency';   reps: number; stddev_max: number };

export interface AIChallenge {
  id: string;
  sessionId: string;
  patientId: string;
  title: string;
  description: string;
  criteria: ChallengeCriteria;
  xpReward: number;
}

export type SocketEvents = {
  'telemetry:update': (frame: TelemetryFrame) => void;
  'session:start': (payload: { patientId: string; exerciseId: string }) => void;
  'session:end': (payload: { sessionId: string }) => void;
  'session:rep_complete': (payload: { sessionId: string; repCount: number; rom: number }) => void;
  'dashboard:subscribe': (patientId: string) => void;
  'dashboard:unsubscribe': (patientId: string) => void;
  'coach:decision': (decision: CoachDecision) => void;
  'coach:target_update': (update: CoachTargetUpdate) => void;
  'coach:challenge_set': (challenge: AIChallenge) => void;
  'coach:challenge_earned': (challenge: AIChallenge) => void;
};
