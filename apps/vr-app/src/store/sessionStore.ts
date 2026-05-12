import { create } from 'zustand';
import type { PatientSession } from '@physio-vr/shared-types';

export interface HandPos {
  x: number;
  y: number;
  z: number;
}

export interface PendingAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface ScorePopup {
  id: number;
  points: number;
  x: number;
  y: number;
  z: number;
}

export interface PatientDemographics {
  dateOfBirth: string | null;
  heightCm:    number | null;
  affectedSide: 'left' | 'right' | 'bilateral' | null;
}

const DEFAULT_DEMOGRAPHICS: PatientDemographics = {
  dateOfBirth: null,
  heightCm: null,
  affectedSide: null,
};

interface SessionState {
  patientId: string | null;
  /** Shown on Zen Archer glass HUD; set when a session starts from the lookup flow. */
  patientDisplayName: string | null;
  /** e.g. patient condition — surfaced as the session subtitle in Zen Archer. */
  patientConditionLabel: string | null;
  /** Pre-session VAS 0–10; drives the Pain slider on the Zen HUD when present. */
  painAtStart: number | null;
  demographics: PatientDemographics;
  session: PatientSession | null;
  currentRep: number;
  currentROM: number;
  score: number;
  isPresenting: boolean;
  leftHandPos: HandPos | null;
  rightHandPos: HandPos | null;
  // Gamification
  xp: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  pendingAchievements: PendingAchievement[];
  scorePopups: ScorePopup[];
  setPatientId: (id: string) => void;
  setPatientProfile: (name: string | null, conditionLabel: string | null, pain0to10: number | null) => void;
  setDemographics: (d: PatientDemographics) => void;
  setSession: (session: PatientSession) => void;
  incrementRep: (rom: number) => void;
  setPresenting: (val: boolean) => void;
  setHandPos: (side: 'left' | 'right', pos: HandPos) => void;
  setROM: (rom: number) => void;
  applyRepReward: (xpGained: number, repScore: number, totalXP: number, level: number, leveledUp: boolean) => void;
  clearLevelUp: () => void;
  addAchievements: (achievements: PendingAchievement[]) => void;
  dismissAchievement: (id: string) => void;
  addScorePopup: (popup: ScorePopup) => void;
  removeScorePopup: (id: number) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  patientId: null,
  patientDisplayName: null,
  patientConditionLabel: null,
  painAtStart: null,
  demographics: DEFAULT_DEMOGRAPHICS,
  session: null,
  currentRep: 0,
  currentROM: 0,
  score: 0,
  isPresenting: false,
  leftHandPos: null,
  rightHandPos: null,
  xp: 0,
  level: 1,
  leveledUp: false,
  streak: 0,
  pendingAchievements: [],
  scorePopups: [],
  setPatientId: (patientId) => set({ patientId }),
  setPatientProfile: (patientDisplayName, patientConditionLabel, painAtStart) =>
    set({ patientDisplayName, patientConditionLabel, painAtStart }),
  setDemographics: (demographics) => set({ demographics }),
  setSession: (session) => set({ session }),
  incrementRep: (rom) =>
    set((state) => ({
      currentRep: state.currentRep + 1,
      currentROM: rom,
    })),
  setPresenting: (isPresenting) => set({ isPresenting }),
  setHandPos: (side, pos) =>
    set(side === 'left' ? { leftHandPos: pos } : { rightHandPos: pos }),
  setROM: (rom) => set({ currentROM: rom }),
  applyRepReward: (_xpGained, repScore, totalXP, level, leveledUp) =>
    set((state) => ({
      score: state.score + repScore,
      xp: totalXP,
      level,
      leveledUp: leveledUp || state.leveledUp,
    })),
  clearLevelUp: () => set({ leveledUp: false }),
  addAchievements: (achievements) =>
    set((state) => ({
      pendingAchievements: [...state.pendingAchievements, ...achievements],
    })),
  dismissAchievement: (id) =>
    set((state) => ({
      pendingAchievements: state.pendingAchievements.filter((a) => a.id !== id),
    })),
  addScorePopup: (popup) =>
    set((state) => ({ scorePopups: [...state.scorePopups, popup] })),
  removeScorePopup: (id) =>
    set((state) => ({ scorePopups: state.scorePopups.filter((p) => p.id !== id) })),
  reset: () =>
    set({
      patientId: null,
      patientDisplayName: null,
      patientConditionLabel: null,
      painAtStart: null,
      session: null, currentRep: 0, currentROM: 0, score: 0,
      leftHandPos: null, rightHandPos: null, xp: 0, level: 1,
      leveledUp: false, streak: 0, pendingAchievements: [], scorePopups: [],
      demographics: DEFAULT_DEMOGRAPHICS,
    }),
}));
