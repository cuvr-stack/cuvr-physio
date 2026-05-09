import { create } from 'zustand';

export type GameState = 'idle' | 'countdown' | 'playing' | 'round-end';
export type GameMode  = 'cascade' | 'cosmic-catch' | 'boxing' | 'archer' | 'galactic-shield' | 'knee-flexion' | 'hip-abduction' | 'cervical';

export interface GameTarget {
  id: number;
  position: [number, number, number];
  status: 'pending' | 'active' | 'hit' | 'missed';
  activatedAt: number;
  /** Constrains hit detection to a specific hand (boxing). */
  hand?: 'left' | 'right' | 'either';
  /** Falling speed in m/s (cosmic-catch). y velocity is negative. */
  fallSpeed?: number;
  /** Full 3D velocity vector in m/s (galactic-shield). */
  velocity?: [number, number, number];
}

export interface ActiveChallenge {
  id:        string;
  title:     string;
  description: string;
  xpReward:  number;
  earned:    boolean;
}

export interface CoachToast {
  ts: number;
  kind: 'target_up' | 'target_down' | 'challenge' | 'earned';
  text: string;
}

interface GameStore {
  mode: GameMode;
  state: GameState;
  countdownSeconds: number;
  targets: GameTarget[];
  activeTargetIndex: number;
  successCount: number;
  missCount: number;
  combo: number;
  bestCombo: number;
  score: number;
  roundNumber: number;
  startedAt: number;
  lastResponseTimeMs: number;

  // Live difficulty + challenge state pushed by the AI coach
  currentTargetROM: number;
  challenge: ActiveChallenge | null;
  toasts: CoachToast[];

  setMode: (mode: GameMode) => void;
  startCountdown: (targets: GameTarget[], targetROM: number, mode?: GameMode) => void;
  tickCountdown: () => void;
  hitTarget: (id: number, responseMs: number) => void;
  missTarget: (id: number) => void;
  applyTargetUpdate: (newTargetROM: number, reason?: string) => void;
  setChallenge: (challenge: ActiveChallenge | null) => void;
  markChallengeEarned: () => void;
  dismissToast: (ts: number) => void;
  reset: () => void;
}

const initial = {
  mode: 'cascade' as GameMode,
  state: 'idle' as GameState,
  countdownSeconds: 0,
  targets: [] as GameTarget[],
  activeTargetIndex: 0,
  successCount: 0,
  missCount: 0,
  combo: 0,
  bestCombo: 0,
  score: 0,
  roundNumber: 0,
  startedAt: 0,
  lastResponseTimeMs: 0,
  currentTargetROM: 90,                 // synced with patient/exercise default
  challenge: null as ActiveChallenge | null,
  toasts: [] as CoachToast[],
};

export const useGameStore = create<GameStore>((set) => ({
  ...initial,

  setMode: (mode) => set({ mode }),

  startCountdown: (targets, targetROM, mode) =>
    set((s) => ({
      ...initial,
      mode: mode ?? s.mode,
      state: 'countdown',
      countdownSeconds: 3,
      targets,
      roundNumber: 1,
      currentTargetROM: targetROM,
    })),

  applyTargetUpdate: (newTargetROM, reason) =>
    set((s) => ({
      currentTargetROM: newTargetROM,
      toasts: [
        ...s.toasts,
        {
          ts: Date.now(),
          kind: (newTargetROM > s.currentTargetROM ? 'target_up' : 'target_down') as CoachToast['kind'],
          text: reason ?? `Target ${newTargetROM > s.currentTargetROM ? 'raised' : 'eased'} to ${newTargetROM}°`,
        },
      ].slice(-3),
    })),

  setChallenge: (challenge) =>
    set((s) => ({
      challenge,
      toasts: challenge
        ? [...s.toasts, { ts: Date.now(), kind: 'challenge' as const, text: `Today's challenge: ${challenge.title}` }].slice(-3)
        : s.toasts,
    })),

  markChallengeEarned: () =>
    set((s) => ({
      challenge: s.challenge ? { ...s.challenge, earned: true } : null,
      toasts: [
        ...s.toasts,
        { ts: Date.now(), kind: 'earned' as const, text: `🏆 Challenge earned${s.challenge ? `: ${s.challenge.title}` : ''}` },
      ].slice(-3),
    })),

  dismissToast: (ts) => set((s) => ({ toasts: s.toasts.filter(t => t.ts !== ts) })),

  tickCountdown: () =>
    set((s) => {
      const next = s.countdownSeconds - 1;
      if (next > 0) return { countdownSeconds: next };
      // 0 → activate first target, transition to playing
      const targets = s.targets.map((t, i) =>
        i === 0 ? { ...t, status: 'active' as const, activatedAt: Date.now() } : t,
      );
      return { state: 'playing', countdownSeconds: 0, targets, startedAt: Date.now() };
    }),

  hitTarget: (id, responseMs) =>
    set((s) => {
      const targets = s.targets.map((t) =>
        t.id === id ? { ...t, status: 'hit' as const } : t,
      );
      const newCombo = s.combo + 1;
      const points = 100 + (newCombo - 1) * 25; // 100, 125, 150…
      const nextIdx = s.activeTargetIndex + 1;
      const isLast = nextIdx >= targets.length;
      if (!isLast) {
        targets[nextIdx] = { ...targets[nextIdx], status: 'active', activatedAt: Date.now() };
      }
      return {
        targets,
        activeTargetIndex: nextIdx,
        successCount: s.successCount + 1,
        combo: newCombo,
        bestCombo: Math.max(s.bestCombo, newCombo),
        score: s.score + points,
        lastResponseTimeMs: responseMs,
        state: isLast ? ('round-end' as const) : ('playing' as const),
      };
    }),

  missTarget: (id) =>
    set((s) => {
      const targets = s.targets.map((t) =>
        t.id === id ? { ...t, status: 'missed' as const } : t,
      );
      const nextIdx = s.activeTargetIndex + 1;
      const isLast = nextIdx >= targets.length;
      if (!isLast) {
        targets[nextIdx] = { ...targets[nextIdx], status: 'active', activatedAt: Date.now() };
      }
      return {
        targets,
        activeTargetIndex: nextIdx,
        missCount: s.missCount + 1,
        combo: 0,
        state: isLast ? ('round-end' as const) : ('playing' as const),
      };
    }),

  reset: () => set(initial),
}));

interface CascadeTuning {
  /** Patient height in cm — drives the y-range. Defaults to 170cm. */
  heightCm?: number | null;
  /** Affected side — biases x-position so the patient uses that arm. */
  affectedSide?: 'left' | 'right' | 'bilateral' | null;
  /** Patient age in years — older patients get a tighter range to reduce overhead reach. */
  ageYears?: number | null;
}

/**
 * Generate a vertical-cascade pattern of targets, scaled to the patient.
 *
 * Y range:    chest (0.7 × height) → comfortable overhead (1.3 × height)
 *             For age ≥ 65: cap overhead at 1.15 × height (no high reach)
 * X bias:     left=-0.15..-0.4   right=+0.15..+0.4   bilateral/null=−0.25..+0.25
 * Z constant: -0.7 (just out of resting reach)
 */
export function generateCascadeTargets(
  count = 15,
  tuning: CascadeTuning = {},
): GameTarget[] {
  const heightM = (tuning.heightCm ?? 170) / 100;
  const isOlder = (tuning.ageYears ?? 0) >= 65;

  const yMin = heightM * 0.78;
  const yMax = heightM * (isOlder ? 1.15 : 1.32);

  // Affected-side x-window — encourages the patient to use that arm.
  let xMin = -0.25, xMax = 0.25;
  if (tuning.affectedSide === 'left')  { xMin = -0.4;  xMax = -0.05; }
  if (tuning.affectedSide === 'right') { xMin =  0.05; xMax =  0.4; }

  return Array.from({ length: count }, (_, i) => {
    const phase = i % 5;
    const yBase = yMin + (phase / 4) * (yMax - yMin);
    const yJitter = (Math.random() - 0.5) * 0.08;
    const x = xMin + Math.random() * (xMax - xMin);
    const z = -0.7;
    return {
      id: i + 1,
      position: [x, yBase + yJitter, z] as [number, number, number],
      status: 'pending' as const,
      activatedAt: 0,
    };
  });
}

/**
 * Cosmic Catch — orbs spawn high overhead and fall under gravity. The patient
 * has to reach up and intercept before they hit the ground. Trains shoulder
 * flexion and eye-hand coordination. Faster patients catch high (more points).
 */
export function generateCosmicCatchTargets(
  count = 12,
  tuning: CascadeTuning = {},
): GameTarget[] {
  const heightM  = (tuning.heightCm ?? 170) / 100;
  const isOlder  = (tuning.ageYears ?? 0) >= 65;

  // Slightly lower start for older patients so they don't have to over-extend
  const startY = heightM * (isOlder ? 1.45 : 1.65);
  // Faster fall for younger patients keeps difficulty engaging
  const fallSpeed = (tuning.ageYears ?? 30) >= 65 ? 0.55
                  : (tuning.ageYears ?? 30) <  18 ? 1.0
                  : 0.8;

  let xMin = -0.45, xMax = 0.45;
  if (tuning.affectedSide === 'left')  { xMin = -0.5;  xMax = -0.05; }
  if (tuning.affectedSide === 'right') { xMin =  0.05; xMax =  0.5; }

  return Array.from({ length: count }, (_, i) => {
    const x = xMin + Math.random() * (xMax - xMin);
    const z = -0.65;
    return {
      id: i + 1,
      position: [x, startY, z] as [number, number, number],
      status: 'pending' as const,
      activatedAt: 0,
      hand: 'either' as const,
      fallSpeed,
    };
  });
}

/**
 * Boxing Drills — targets spawn at chest height alternating left/right hand.
 * Trains shoulder rotation, rotator cuff, and bilateral coordination.
 * Affected-side patients see more reps on that side.
 */
export function generateBoxingTargets(
  count = 16,
  tuning: CascadeTuning = {},
): GameTarget[] {
  const heightM = (tuning.heightCm ?? 170) / 100;
  // Chest-to-shoulder height for "punch" feel
  const yBase = heightM * 0.84;
  const z = -0.55;
  const lateralDist = 0.38;

  // Build a hand sequence biased toward the affected side
  const sequence: ('left' | 'right')[] = [];
  for (let i = 0; i < count; i++) {
    if (tuning.affectedSide === 'left')      sequence.push(i % 3 === 0 ? 'right' : 'left');
    else if (tuning.affectedSide === 'right') sequence.push(i % 3 === 0 ? 'left'  : 'right');
    else                                     sequence.push(i % 2 === 0 ? 'left'  : 'right');
  }

  return sequence.map((hand, i) => {
    const x = hand === 'left' ? -lateralDist : lateralDist;
    const yJitter = (Math.random() - 0.5) * 0.08;
    return {
      id: i + 1,
      position: [x, yBase + yJitter, z] as [number, number, number],
      status: 'pending' as const,
      activatedAt: 0,
      hand,
    };
  });
}

/**
 * Knee Flexion — seated heel-pull exercise. The patient sits in a chair
 * holding the controller against the affected ankle. Targets cycle from
 * "leg extended in front" toward "heel pulled back under the chair",
 * progressively requiring more knee flexion each phase.
 *
 * Trains: knee flexion ROM, quad/hamstring activation, post-op TKR or ACL.
 */
export function generateKneeFlexionTargets(
  count = 12,
  tuning: CascadeTuning = {},
): GameTarget[] {
  // Approximate ankle height when sitting in a normal chair
  const ankleY = 0.08;

  // Patient bends one leg at a time — shift X to that side
  const sideX =
    tuning.affectedSide === 'left'  ? -0.18
    : tuning.affectedSide === 'right' ?  0.18
    : 0;

  // Older patients: tighter Z range so they don't have to over-extend
  const isOlder = (tuning.ageYears ?? 0) >= 65;
  const zPositions = isOlder
    ? [0.40, 0.30, 0.20, 0.10, 0.02]   // 5 phases
    : [0.50, 0.36, 0.22, 0.08, -0.05];

  return Array.from({ length: count }, (_, i) => {
    const phase  = i % zPositions.length;
    const z      = zPositions[phase] + (Math.random() - 0.5) * 0.04;
    const yJit   = (Math.random() - 0.5) * 0.04;
    return {
      id: i + 1,
      position: [sideX, ankleY + yJit, z] as [number, number, number],
      status: 'pending' as const,
      activatedAt: 0,
      hand: 'either' as const,
    };
  });
}

/**
 * Cervical "Stargazer" — gaze-driven neck-mobility exercise.
 *
 * Each target is a star placed at a specific azimuth + elevation around the
 * patient's head at radius 4 m. To "hit" it, the patient must turn their
 * head until their gaze direction aligns with the star, then HOLD the
 * position long enough to confirm the rotation was deliberate (not a quick
 * head-flick that doesn't actually stretch tissues).
 *
 * The target sequence cycles through:
 *   • Right rotation        (cervical rotation right)
 *   • Left rotation         (cervical rotation left)
 *   • Extension              (look up — common stiffness)
 *   • Flexion                (look down — gentle range)
 *   • Diagonal up-right      (combined rotation + extension)
 *   • Diagonal down-left     (combined rotation + flexion)
 *
 * Trains: cervical rotation, flexion, extension, controlled hold endurance.
 */
export function generateCervicalTargets(
  count = 12,
  tuning: CascadeTuning = {},
): GameTarget[] {
  const isOlder = (tuning.ageYears ?? 0) >= 65;

  // Older patients get a tighter angular range (neck stiffness, vestibular caution)
  const maxRotDeg  = isOlder ? 40 : 60;          // cervical rotation
  const maxExtDeg  = isOlder ? 25 : 45;          // looking up
  const maxFlexDeg = isOlder ? 25 : 40;          // looking down

  // Affected-side bias: more reps on the affected side (asymmetric phases)
  const affectedSign =
    tuning.affectedSide === 'left' ? -1 : tuning.affectedSide === 'right' ? 1 : 0;

  // [azimuth deg (+ = right), elevation deg (+ = up)]
  const phases: [number, number][] = [
    [+maxRotDeg, 0],
    [-maxRotDeg, 0],
    [0, +maxExtDeg],
    [0, -maxFlexDeg],
    [+maxRotDeg / 2, +maxExtDeg / 2],
    [-maxRotDeg / 2, -maxFlexDeg / 2],
  ];

  // Target placement: 4 m radius around an assumed head position of (0, 1.6, 0)
  const radius = 4;
  const headY  = 1.6;

  return Array.from({ length: count }, (_, i) => {
    const phase = phases[i % phases.length];
    let [azDeg, elDeg] = phase;

    // Affected-side bias: every 3rd rep, force toward affected direction
    if (affectedSign !== 0 && i % 3 === 2) {
      azDeg = affectedSign * Math.abs(maxRotDeg) * 0.85;
      elDeg = (Math.random() - 0.5) * 20;
    }

    const az = (azDeg * Math.PI) / 180;
    const el = (elDeg * Math.PI) / 180;
    const x = Math.sin(az) * Math.cos(el) * radius;
    const y = headY + Math.sin(el) * radius;
    const z = -Math.cos(az) * Math.cos(el) * radius;        // -Z = forward

    return {
      id: i + 1,
      position: [x, y, z] as [number, number, number],
      status: 'pending' as const,
      activatedAt: 0,
      hand: 'either' as const,                              // not used; gaze-based
    };
  });
}

/**
 * Hip Abduction — lateral leg-lift. Patient stands (or sits) holding the
 * controller against the ankle and moves the leg laterally outward. Targets
 * fan from "foot under hip" through ~45° abduction.
 *
 * Trains: glute medius, hip abductor strength, balance, post-op THR.
 */
export function generateHipAbductionTargets(
  count = 12,
  tuning: CascadeTuning = {},
): GameTarget[] {
  // Sign: which side the leg moves out to (matches affected side)
  const sign =
    tuning.affectedSide === 'left'  ? -1
    : tuning.affectedSide === 'right' ?  1
    : 1;

  const isOlder = (tuning.ageYears ?? 0) >= 65;
  // X magnitudes from "just starting" to "fully abducted"
  const xMagnitudes = isOlder
    ? [0.06, 0.16, 0.26, 0.34, 0.40]
    : [0.08, 0.20, 0.32, 0.42, 0.50];

  return Array.from({ length: count }, (_, i) => {
    const phase = i % xMagnitudes.length;
    const x  = sign * xMagnitudes[phase] + (Math.random() - 0.5) * 0.03;
    const y  = 0.10 + (Math.random() - 0.5) * 0.04;
    const z  = (Math.random() - 0.5) * 0.10;
    return {
      id: i + 1,
      position: [x, y, z] as [number, number, number],
      status: 'pending' as const,
      activatedAt: 0,
      hand: 'either' as const,
    };
  });
}

/**
 * Galactic Shield — energy bolts streak toward the player from all directions.
 * Each target spawns at a random point on a sphere around the patient and
 * travels in a straight line toward an off-centre point near them. The hand
 * has to intercept before the bolt reaches the cockpit (the player position).
 *
 * Trains: multi-planar reach, reach velocity, proprioception (responding to
 * cues from above/below/sides without losing balance).
 */
export function generateGalacticShieldTargets(
  count = 14,
  tuning: CascadeTuning = {},
): GameTarget[] {
  const isOlder = (tuning.ageYears ?? 0) >= 65;
  const isYouth = (tuning.ageYears ?? 30) < 18;

  // Slower threats for older patients, faster for youth
  const speed = isOlder ? 1.0 : isYouth ? 1.7 : 1.4;
  // Spawn radius — bigger sphere = more reaction time, smaller = faster
  const spawnRadius = 2.6;
  // The "cockpit" centre that bolts aim at — slightly above eye-level chest
  const targetCx = 0;
  const targetCy = 1.5;
  const targetCz = 0;

  // Affected-side bias: skew incoming bolts to that side
  const sideBias =
    tuning.affectedSide === 'left'  ? -0.4
    : tuning.affectedSide === 'right' ? 0.4
    : 0;

  return Array.from({ length: count }, (_, i) => {
    // Random point on a hemisphere arc in front of the player (azimuth 90° wide either side, elevation ±60°)
    const azimuth = (Math.random() - 0.5) * Math.PI * 1.1;          // ±99°
    const elevation = (Math.random() - 0.4) * Math.PI * 0.7;        // ~−36° to +52°
    const sx = Math.sin(azimuth) * Math.cos(elevation) * spawnRadius + sideBias;
    const sy = targetCy + Math.sin(elevation) * spawnRadius * 0.6;
    const sz = -Math.cos(azimuth) * Math.cos(elevation) * spawnRadius;

    // Velocity toward the cockpit centre, normalised to `speed`
    const dx = targetCx - sx;
    const dy = targetCy - sy;
    const dz = targetCz - sz;
    const mag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const vx = (dx / mag) * speed;
    const vy = (dy / mag) * speed;
    const vz = (dz / mag) * speed;

    return {
      id: i + 1,
      position: [sx, sy, sz] as [number, number, number],
      status: 'pending' as const,
      activatedAt: 0,
      hand: 'either' as const,
      velocity: [vx, vy, vz] as [number, number, number],
    };
  });
}

/**
 * Zen Archer — each "target" is one slow archery shot. We don't place them in
 * 3D space (the ZenArcher component renders the single distant archery target
 * itself); we just need N counters so the existing round-state machine works.
 * Each rep = full draw + clean release with good form. ~8 shots in a round.
 */
export function generateArcherTargets(count = 8): GameTarget[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    // Logical position only — ZenArcher draws everything itself
    position: [0, 1.5, -8] as [number, number, number],
    status: 'pending' as const,
    activatedAt: 0,
    hand: 'either' as const,
  }));
}

export function targetsForMode(
  mode: GameMode,
  count: number,
  tuning: CascadeTuning,
): GameTarget[] {
  if (mode === 'cosmic-catch')    return generateCosmicCatchTargets(count, tuning);
  if (mode === 'boxing')           return generateBoxingTargets(count, tuning);
  if (mode === 'archer')           return generateArcherTargets(count);
  if (mode === 'galactic-shield')  return generateGalacticShieldTargets(count, tuning);
  if (mode === 'knee-flexion')     return generateKneeFlexionTargets(count, tuning);
  if (mode === 'hip-abduction')    return generateHipAbductionTargets(count, tuning);
  if (mode === 'cervical')         return generateCervicalTargets(count, tuning);
  return generateCascadeTargets(count, tuning);
}
