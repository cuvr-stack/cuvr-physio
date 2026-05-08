/**
 * AI Coach service.
 *
 * Per active session:
 *  • buffers telemetry frames
 *  • generates a personalised AIChallenge at session start
 *  • ticks every N seconds → asks Claude for a CoachDecision
 *    → applies a difficulty delta to the live targetROM
 *    → emits coach:decision + coach:target_update
 *    → evaluates the challenge criteria → emits coach:challenge_earned
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase';
import type {
  TelemetryFrame,
  CoachDecision,
  CoachTargetUpdate,
  AIChallenge,
  ChallengeCriteria,
} from '@physio-vr/shared-types';

const MODEL          = process.env.AI_COACH_MODEL ?? 'claude-haiku-4-5';
const TICK_INTERVAL  = Number(process.env.AI_COACH_TICK_MS ?? 5000);
const MIN_FRAMES     = 4;
const ROM_DELTA_DEG  = 5;          // how much we shift target on increase / decrease
const ROM_FLOOR      = 30;
const ROM_CEILING    = 180;

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

// ─── Generic event sink so the socket layer can fan-out to VR + dashboard ───
type CoachEventMap = {
  'coach:decision':         CoachDecision;
  'coach:target_update':    CoachTargetUpdate;
  'coach:challenge_set':    AIChallenge;
  'coach:challenge_earned': AIChallenge;
};
export type CoachEmit = <K extends keyof CoachEventMap>(event: K, payload: CoachEventMap[K]) => void;

interface SessionContext {
  sessionId: string;
  patientId: string;
  patientName: string;
  exerciseId: string;
  initialTargetROM: number;
  currentTargetROM: number;
  baseline: {
    bestROM: number; level: number; totalSessions: number;
    ageYears: number | null;
    heightCm: number | null;
    affectedSide: 'left' | 'right' | 'bilateral' | null | string;
    condition: string | null;
  };
  recentDecisions: CoachDecision[];
  frameBuffer: TelemetryFrame[];
  repCountAtLastTick: number;
  startedAt: number;
  ticker: NodeJS.Timeout | null;
  emit: CoachEmit;

  // Challenge tracking
  challenge: AIChallenge | null;
  challengeEarned: boolean;
  totalReps: number;
  peakROM: number;
  romHistory: number[];     // for consistency criteria
}

const sessions = new Map<string, SessionContext>();

// ─── Lifecycle ────────────────────────────────────────────────────────────────
export async function startCoachSession(
  opts: { sessionId: string; patientId: string; exerciseId: string; targetROM: number },
  emit: CoachEmit,
): Promise<void> {
  const { data: patient } = await supabase
    .from('patients')
    .select('name, condition, date_of_birth, height_cm, affected_side')
    .eq('id', opts.patientId)
    .single();
  const { data: stats } = await supabase
    .from('player_stats')
    .select('best_rom, level, total_sessions')
    .eq('patient_id', opts.patientId)
    .single();

  const ageYears = patient?.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 86400000))
    : null;

  const baseline = {
    bestROM: stats?.best_rom ?? 0,
    level: stats?.level ?? 1,
    totalSessions: stats?.total_sessions ?? 0,
    ageYears,
    heightCm: patient?.height_cm ?? null,
    affectedSide: patient?.affected_side ?? null,
    condition: patient?.condition ?? null,
  };

  const ctx: SessionContext = {
    sessionId: opts.sessionId,
    patientId: opts.patientId,
    patientName: patient?.name ?? 'Patient',
    exerciseId: opts.exerciseId,
    initialTargetROM: opts.targetROM,
    currentTargetROM: opts.targetROM,
    baseline,
    recentDecisions: [],
    frameBuffer: [],
    repCountAtLastTick: 0,
    startedAt: Date.now(),
    ticker: null,
    emit,
    challenge: null,
    challengeEarned: false,
    totalReps: 0,
    peakROM: 0,
    romHistory: [],
  };

  sessions.set(opts.sessionId, ctx);
  console.log(`[ai-coach] started for session ${opts.sessionId} (patient: ${ctx.patientName})`);

  // Generate today's challenge in parallel — don't block coach ticking
  generateChallenge(ctx).then(ch => {
    if (!ch) return;
    ctx.challenge = ch;
    emit('coach:challenge_set', ch);
  }).catch(err => console.error('[ai-coach] challenge gen failed:', err));

  ctx.ticker = setInterval(async () => {
    const out = await tick(ctx);
    if (!out) return;

    emit('coach:decision', out.decision);
    if (out.targetUpdate) emit('coach:target_update', out.targetUpdate);
    if (out.challengeEarned && ctx.challenge) {
      emit('coach:challenge_earned', ctx.challenge);
    }
  }, TICK_INTERVAL);
}

export function ingestFrame(frame: TelemetryFrame): void {
  const ctx = sessions.get(frame.sessionId);
  if (!ctx) return;
  ctx.frameBuffer.push(frame);

  // Keep peak/rom history in sync immediately so challenge eval is always fresh
  if (frame.currentROM != null && frame.currentROM > 0) {
    ctx.peakROM = Math.max(ctx.peakROM, frame.currentROM);
  }
  if (frame.currentRep != null && frame.currentRep > ctx.totalReps) {
    // a new rep — record its ROM
    ctx.totalReps = frame.currentRep;
    if (frame.currentROM != null) {
      ctx.romHistory.push(frame.currentROM);
      if (ctx.romHistory.length > 30) ctx.romHistory.shift();
    }
  }
}

export function endCoachSession(sessionId: string): void {
  const ctx = sessions.get(sessionId);
  if (!ctx) return;
  if (ctx.ticker) clearInterval(ctx.ticker);

  // If challenge wasn't earned, mark expired
  if (ctx.challenge && !ctx.challengeEarned) {
    supabase
      .from('ai_session_challenges')
      .update({ status: 'expired' })
      .eq('id', ctx.challenge.id)
      .then(() => {});
  }

  sessions.delete(sessionId);
  console.log(`[ai-coach] ended for session ${sessionId}`);
}

// ─── Tick: decision + difficulty + challenge eval ─────────────────────────────
interface TickResult {
  decision: CoachDecision;
  targetUpdate?: CoachTargetUpdate;
  challengeEarned?: boolean;
}

async function tick(ctx: SessionContext): Promise<TickResult | null> {
  if (ctx.frameBuffer.length < MIN_FRAMES) return null;

  const frames = ctx.frameBuffer.splice(0);
  const roms   = frames.map(f => f.currentROM ?? 0).filter(r => r > 0);
  const lastRep = frames[frames.length - 1].currentRep ?? ctx.repCountAtLastTick;
  const repsThisTick = Math.max(0, lastRep - ctx.repCountAtLastTick);
  ctx.repCountAtLastTick = lastRep;

  const summary = {
    avgROM:        roms.length ? Math.round(roms.reduce((a, b) => a + b, 0) / roms.length) : 0,
    peakROM:       roms.length ? Math.max(...roms) : 0,
    minROM:        roms.length ? Math.min(...roms) : 0,
    repsTotal:     lastRep,
    repsThisTick,
    elapsedSec:    Math.round((Date.now() - ctx.startedAt) / 1000),
    targetROM:     ctx.currentTargetROM,
    bestROMEver:   ctx.baseline.bestROM,
  };

  const decision = client
    ? await callClaude(ctx, summary)
    : ruleFallback(ctx, summary);

  if (!decision) return null;

  ctx.recentDecisions.push(decision);
  if (ctx.recentDecisions.length > 5) ctx.recentDecisions.shift();

  // Persist the decision (fire & forget)
  supabase.from('ai_coach_events').insert({
    session_id: ctx.sessionId,
    patient_id: ctx.patientId,
    kind: 'decision',
    payload: decision,
  }).then(({ error }) => { if (error) console.error('[ai-coach] persist err:', error.message); });

  // ── Apply difficulty delta to live target ──
  let targetUpdate: CoachTargetUpdate | undefined;
  const prevTarget = ctx.currentTargetROM;
  if (decision.difficulty_delta === 'increase') {
    ctx.currentTargetROM = Math.min(ROM_CEILING, prevTarget + ROM_DELTA_DEG);
  } else if (decision.difficulty_delta === 'decrease') {
    ctx.currentTargetROM = Math.max(ROM_FLOOR, prevTarget - ROM_DELTA_DEG);
  }
  if (ctx.currentTargetROM !== prevTarget) {
    targetUpdate = {
      ts: Date.now(),
      sessionId: ctx.sessionId,
      patientId: ctx.patientId,
      previousTargetROM: prevTarget,
      newTargetROM: ctx.currentTargetROM,
      reason: decision.difficulty_delta === 'increase'
        ? `Pushing target up to ${ctx.currentTargetROM}°`
        : `Easing target to ${ctx.currentTargetROM}°`,
    };
  }

  // ── Evaluate challenge ──
  let challengeEarnedNow = false;
  if (ctx.challenge && !ctx.challengeEarned && evaluateCriteria(ctx.challenge.criteria, ctx)) {
    ctx.challengeEarned = true;
    challengeEarnedNow = true;

    // Persist + award XP
    await Promise.all([
      supabase.from('ai_session_challenges')
        .update({ status: 'earned', earned_at: new Date().toISOString() })
        .eq('id', ctx.challenge.id),
      awardXP(ctx.patientId, ctx.challenge.xpReward),
    ]);
  }

  return { decision, targetUpdate, challengeEarned: challengeEarnedNow };
}

// ─── Challenge evaluation ────────────────────────────────────────────────────
function evaluateCriteria(c: ChallengeCriteria, ctx: SessionContext): boolean {
  if (c.type === 'rom_milestone') {
    return ctx.peakROM >= c.threshold;
  }
  if (c.type === 'rep_count') {
    return ctx.totalReps >= c.threshold;
  }
  if (c.type === 'consistency') {
    if (ctx.romHistory.length < c.reps) return false;
    const window = ctx.romHistory.slice(-c.reps);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const stddev = Math.sqrt(variance);
    return stddev <= c.stddev_max;
  }
  return false;
}

async function awardXP(patientId: string, bonusXP: number) {
  const { data: stats } = await supabase
    .from('player_stats').select('xp').eq('patient_id', patientId).single();
  const newXP = (stats?.xp ?? 0) + bonusXP;
  await supabase.from('player_stats').upsert({
    patient_id: patientId,
    xp: newXP,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'patient_id' });
}

// ─── Challenge generation ────────────────────────────────────────────────────
async function generateChallenge(ctx: SessionContext): Promise<AIChallenge | null> {
  const challenge = client
    ? await generateChallengeViaClaude(ctx)
    : generateChallengeFallback(ctx);

  if (!challenge) return null;

  // Persist
  const { data, error } = await supabase
    .from('ai_session_challenges')
    .insert({
      session_id: ctx.sessionId,
      patient_id: ctx.patientId,
      title: challenge.title,
      description: challenge.description,
      criteria: challenge.criteria,
      xp_reward: challenge.xpReward,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[ai-coach] challenge insert failed:', error?.message);
    return null;
  }

  return { ...challenge, id: data.id };
}

async function generateChallengeViaClaude(ctx: SessionContext): Promise<Omit<AIChallenge, 'id'> | null> {
  const systemPrompt = `You design ONE single-session challenge for a VR rehabilitation patient. The challenge must be specific, measurable, and achievable in one 15–30 minute session given the patient's baseline.

Output ONLY this JSON, no markdown:
{
  "title": "<catchy 2-4 words>",
  "description": "<1 sentence, addressed to patient>",
  "criteria": <ONE of:
    { "type": "rom_milestone", "threshold": <int degrees> } |
    { "type": "rep_count",     "threshold": <int reps> } |
    { "type": "consistency",   "reps": <int 3-8>, "stddev_max": <number 3-8> }
  >,
  "xpReward": <int 50-200>
}

Difficulty rules:
- rom_milestone threshold: between 95% and 105% of patient's bestROM (never below current target)
- rep_count threshold: 8-15 for level 1-3, 15-25 for higher
- consistency: easier with more reps and larger stddev_max
- xpReward scales with difficulty: easy 50, moderate 100, hard 150-200`;

  const userMsg = JSON.stringify({
    patient: ctx.patientName,
    exercise: ctx.exerciseId,
    baseline: ctx.baseline,
    targetROM: ctx.currentTargetROM,
  });

  try {
    const res = await client!.messages.create({
      model: MODEL,
      max_tokens: 220,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = res.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, '');
    const parsed = JSON.parse(text);
    if (!parsed.title || !parsed.criteria) return null;
    return {
      sessionId: ctx.sessionId,
      patientId: ctx.patientId,
      title: String(parsed.title).slice(0, 50),
      description: String(parsed.description ?? '').slice(0, 200),
      criteria: parsed.criteria as ChallengeCriteria,
      xpReward: Math.max(25, Math.min(300, Number(parsed.xpReward ?? 75))),
    };
  } catch (e: any) {
    console.error('[ai-coach] challenge LLM failed:', e?.message ?? e);
    return generateChallengeFallback(ctx);
  }
}

function generateChallengeFallback(ctx: SessionContext): Omit<AIChallenge, 'id'> {
  const target = ctx.currentTargetROM;
  const isExperienced = ctx.baseline.totalSessions >= 5;

  // Rotate between three challenge types based on session count parity
  const variant = ctx.baseline.totalSessions % 3;

  if (variant === 0) {
    return {
      sessionId: ctx.sessionId,
      patientId: ctx.patientId,
      title: 'Range Pioneer',
      description: `Hit ${Math.round(target * 1.02)}° peak ROM at least once this session.`,
      criteria: { type: 'rom_milestone', threshold: Math.round(target * 1.02) },
      xpReward: isExperienced ? 150 : 100,
    };
  }
  if (variant === 1) {
    const reps = isExperienced ? 15 : 10;
    return {
      sessionId: ctx.sessionId,
      patientId: ctx.patientId,
      title: 'Steady Climb',
      description: `Complete ${reps} reps this session.`,
      criteria: { type: 'rep_count', threshold: reps },
      xpReward: 75,
    };
  }
  return {
    sessionId: ctx.sessionId,
    patientId: ctx.patientId,
    title: 'Smooth Operator',
    description: 'Complete 5 reps with consistent ROM (within 5° of each other).',
    criteria: { type: 'consistency', reps: 5, stddev_max: 5 },
    xpReward: 125,
  };
}

// ─── Decision via Claude ─────────────────────────────────────────────────────
async function callClaude(
  ctx: SessionContext,
  summary: Record<string, number>,
): Promise<CoachDecision | null> {
  const ageGroup = ctx.baseline.ageYears == null
    ? 'unknown age'
    : ctx.baseline.ageYears < 18 ? 'youth'
    : ctx.baseline.ageYears >= 65 ? 'older adult'
    : 'adult';

  const systemPrompt = `You are an AI physio coach watching a live VR rehabilitation session. Every few seconds you receive a numerical summary and must produce a JSON decision that gamifies and motivates the patient. Be concise, kind, evidence-based, and never recommend anything that could cause injury.

Patient context (use this to adjust language and difficulty thresholds):
- Age group: ${ageGroup}${ctx.baseline.ageYears != null ? ` (${ctx.baseline.ageYears} years old)` : ''}
- Height: ${ctx.baseline.heightCm ? `${ctx.baseline.heightCm} cm` : 'unknown'}
- Affected side: ${ctx.baseline.affectedSide ?? 'unknown'}
- Condition: ${ctx.baseline.condition ?? 'unknown'}

For older adults: be patient, allow more time, encourage smaller increments. Avoid pushing aggressively even if metrics are strong. For youth: more energetic language, faster pace acceptable. For unaffected-side or bilateral patients: encourage symmetry.

Output ONLY a single JSON object, no markdown, no prose. Schema:
{
  "difficulty_delta": "increase" | "decrease" | "hold",
  "message": "<one short motivational line addressed to the patient by first name when natural, max 90 chars>",
  "suggested_achievement": "<short title or empty string>",
  "rationale": "<one sentence for the physio dashboard, max 120 chars>"
}

Rules:
- "increase" only if peakROM ≥ 95% of targetROM AND patient has completed reps this tick AND avgROM is not collapsing.
- "decrease" if avgROM is below 60% of targetROM OR repsTotal has stalled for two consecutive ticks.
- otherwise "hold".
- "suggested_achievement" only when peakROM exceeds bestROMEver, otherwise empty string.`;

  const userMsg = JSON.stringify({
    patient: ctx.patientName,
    baseline: ctx.baseline,
    exercise: ctx.exerciseId,
    summary,
    recentDecisions: ctx.recentDecisions.slice(-3).map(d => ({
      delta: d.difficulty_delta,
      msg:   d.message,
    })),
  });

  try {
    const res = await client!.messages.create({
      model: MODEL,
      max_tokens: 220,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    });

    const text = res.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, '');
    const parsed = JSON.parse(text);

    return {
      ts: Date.now(),
      sessionId: ctx.sessionId,
      patientId: ctx.patientId,
      difficulty_delta: normalizeDelta(parsed.difficulty_delta),
      message:          String(parsed.message ?? '').slice(0, 140),
      suggested_achievement:
        parsed.suggested_achievement && String(parsed.suggested_achievement).length
          ? String(parsed.suggested_achievement).slice(0, 80)
          : undefined,
      rationale:        String(parsed.rationale ?? '').slice(0, 200),
    };
  } catch (e: any) {
    console.error('[ai-coach] LLM call failed:', e?.message ?? e);
    supabase.from('ai_coach_events').insert({
      session_id: ctx.sessionId,
      patient_id: ctx.patientId,
      kind: 'error',
      payload: { error: String(e?.message ?? e) },
    }).then(() => {});
    return null;
  }
}

// ─── Rule fallback ──────────────────────────────────────────────────────────
function ruleFallback(
  ctx: SessionContext,
  s: Record<string, number>,
): CoachDecision {
  const ratio = ctx.currentTargetROM > 0 ? s.peakROM / ctx.currentTargetROM : 0;

  let delta: CoachDecision['difficulty_delta'] = 'hold';
  let message = `Keep it steady, ${firstName(ctx.patientName)} — nice control.`;
  let rationale = `Avg ${s.avgROM}° / target ${ctx.currentTargetROM}°.`;

  if (ratio >= 0.95 && s.repsThisTick > 0) {
    delta = 'increase';
    message = `${firstName(ctx.patientName)}, you're hitting target — let's push 5° more.`;
    rationale = `Peak ${s.peakROM}° ≥ 95% of target; bumping difficulty.`;
  } else if (ratio < 0.6) {
    delta = 'decrease';
    message = `Easy does it, ${firstName(ctx.patientName)} — quality over range.`;
    rationale = `Avg ROM below 60% of target; easing difficulty.`;
  }

  const newBest = s.peakROM > ctx.baseline.bestROM && ctx.baseline.bestROM > 0;

  return {
    ts: Date.now(),
    sessionId: ctx.sessionId,
    patientId: ctx.patientId,
    difficulty_delta: delta,
    message,
    suggested_achievement: newBest ? 'New Personal Best' : undefined,
    rationale,
  };
}

function normalizeDelta(v: unknown): CoachDecision['difficulty_delta'] {
  if (v === 'increase' || v === 'decrease') return v;
  return 'hold';
}

function firstName(full: string) {
  return full.split(' ')[0] || full;
}
