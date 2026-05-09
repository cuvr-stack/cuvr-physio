/**
 * Longitudinal patient insights — reviews session history for trend, plateau,
 * and re-injury risk, and recommends an adjustment to the treatment plan.
 *
 * Pipeline:
 *   1. Fetch the last N completed sessions + their session_results.
 *   2. Compute numerical features (ROM slope, variance, drop, frequency).
 *   3. Ask Claude to interpret the features in clinical terms (or fall back
 *      to a deterministic rule engine when no API key is configured).
 *   4. Persist the result in ai_patient_insights for the dashboard to read.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase';

const MODEL  = process.env.AI_COACH_MODEL ?? 'claude-haiku-4-5';
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const WINDOW_SIZE = 12;        // most recent N completed sessions to analyse

export type InsightTrend = 'improving' | 'steady' | 'plateau' | 'regressing' | 'insufficient_data';
export type RiskLevel    = 'low' | 'moderate' | 'high' | 'unknown';

export interface PatientInsight {
  patientId:        string;
  trend:            InsightTrend;
  risk_level:       RiskLevel;
  headline:         string;
  summary:          string;
  recommendation:   string | null;
  evidence:         string[];
  features:         Record<string, unknown>;
  sessions_analyzed: number;
}

interface SessionRecord {
  id: string;
  started_at: string;
  ended_at: string | null;
  reps_completed: number;
  score: number;
  session_results: { avg_rom: number; max_rom: number; duration_seconds: number }[] | null;
}

// ─── Public entry point ──────────────────────────────────────────────────────
export async function analyzePatient(patientId: string): Promise<PatientInsight | null> {
  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, condition')
    .eq('id', patientId)
    .single();
  if (!patient) return null;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at, reps_completed, score, session_results(avg_rom, max_rom, duration_seconds)')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(WINDOW_SIZE);

  const list = (sessions ?? []) as SessionRecord[];
  // Newest-first → oldest-first for trend math
  list.reverse();

  if (list.length < 3) {
    return persist({
      patientId,
      trend: 'insufficient_data',
      risk_level: 'unknown',
      headline: 'Not enough sessions yet to detect a trend.',
      summary: `Only ${list.length} completed session${list.length === 1 ? '' : 's'} on record. Insights become available after 3 completed sessions.`,
      recommendation: null,
      evidence: [],
      features: { sessions: list.length },
      sessions_analyzed: list.length,
    });
  }

  const features = computeFeatures(list);

  const interpreted = client
    ? await callClaude(patient.name, patient.condition, list, features)
    : ruleFallback(features);

  const insight: PatientInsight = {
    patientId,
    sessions_analyzed: list.length,
    features: features as unknown as Record<string, unknown>,
    ...interpreted,
  };

  return persist(insight);
}

// ─── Feature engineering ─────────────────────────────────────────────────────
interface Features {
  sessions:                 number;
  rom_avg_recent:           number;
  rom_avg_window:           number;
  rom_lifetime_best:        number;
  rom_slope_per_session:    number;
  rom_variance_recent:      number;
  rom_drop_pct_from_peak:   number;
  reps_slope:               number;
  reps_avg_recent:          number;
  median_session_gap_days:  number;
  days_since_last:          number;
  consistency_score:        number; // 0-100
}

function computeFeatures(sessions: SessionRecord[]): Features {
  // Map sessions to (index, rom, reps, ts)
  const points = sessions.map((s, i) => {
    const sr  = s.session_results?.[0];
    const rom = sr?.avg_rom ?? 0;
    return {
      i,
      ts: new Date(s.started_at).getTime(),
      rom,
      reps: s.reps_completed ?? 0,
    };
  });

  const last3 = points.slice(-3);
  const recentRom  = last3.map(p => p.rom);
  const recentReps = last3.map(p => p.reps);

  const rom_avg_recent = avg(recentRom);
  const rom_avg_window = avg(points.map(p => p.rom));
  const rom_lifetime_best = Math.max(...points.map(p => p.rom), 0);
  const rom_slope_per_session = slope(points.map(p => p.i), points.map(p => p.rom));
  const rom_variance_recent  = variance(recentRom);

  const rom_drop_pct_from_peak = rom_lifetime_best > 0
    ? Math.round((1 - rom_avg_recent / rom_lifetime_best) * 100)
    : 0;

  const reps_slope        = slope(points.map(p => p.i), points.map(p => p.reps));
  const reps_avg_recent   = avg(recentReps);

  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    gaps.push((points[i].ts - points[i - 1].ts) / 86400000);
  }
  const median_session_gap_days = gaps.length ? median(gaps) : 0;
  const days_since_last = (Date.now() - points[points.length - 1].ts) / 86400000;

  // Consistency: 100 - (variance of all ROM, capped) — higher = more consistent
  const overallVar = variance(points.map(p => p.rom));
  const consistency_score = Math.max(0, Math.min(100, Math.round(100 - overallVar)));

  return {
    sessions: points.length,
    rom_avg_recent: round(rom_avg_recent),
    rom_avg_window: round(rom_avg_window),
    rom_lifetime_best,
    rom_slope_per_session: round2(rom_slope_per_session),
    rom_variance_recent: round2(rom_variance_recent),
    rom_drop_pct_from_peak,
    reps_slope: round2(reps_slope),
    reps_avg_recent: round(reps_avg_recent),
    median_session_gap_days: round2(median_session_gap_days),
    days_since_last: round2(days_since_last),
    consistency_score,
  };
}

// ─── LLM interpretation ──────────────────────────────────────────────────────
async function callClaude(
  patientName: string,
  condition: string,
  sessions: SessionRecord[],
  features: Features,
): Promise<Omit<PatientInsight, 'patientId' | 'sessions_analyzed' | 'features'>> {
  const systemPrompt = `You are reviewing a physiotherapy patient's session history to surface clinical observations to their physiotherapist. You receive both pre-computed trend features and the raw recent sessions.

Output ONLY a single JSON object, no markdown, no prose. Schema:
{
  "trend": "improving" | "steady" | "plateau" | "regressing",
  "risk_level": "low" | "moderate" | "high",
  "headline": "<one short clinical-style headline, max 90 chars>",
  "summary": "<2-3 sentence interpretation for the physio, max 280 chars>",
  "recommendation": "<one specific actionable suggestion, max 200 chars>",
  "evidence": ["<short data point 1>", "<short data point 2>", "<short data point 3>"]
}

Rules:
- Be concise and specific; reference actual numbers from the features.
- "plateau" only if ROM has stayed within ~5° for 3+ consecutive sessions and slope is near zero.
- "regressing" if recent avg ROM dropped > 10% from lifetime best.
- "high" risk only with strong signals: sudden drop > 15%, high recent variance, or > 14 days since last session combined with regression.
- Recommendations should suggest treatment plan changes (vary protocol, increase target, switch to dynamic exercises, schedule check-in), NOT generic advice.
- Never diagnose. Use language like "consider", "may indicate", "worth reviewing".`;

  const userMsg = JSON.stringify({
    patient: patientName,
    condition,
    sessionsAnalyzed: sessions.length,
    features,
    recentSessions: sessions.slice(-6).map(s => ({
      date: new Date(s.started_at).toISOString().split('T')[0],
      avg_rom: s.session_results?.[0]?.avg_rom ?? 0,
      max_rom: s.session_results?.[0]?.max_rom ?? 0,
      reps: s.reps_completed,
      score: s.score,
    })),
  });

  try {
    const res = await client!.messages.create({
      model: MODEL,
      max_tokens: 600,
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
      trend:           normalizeTrend(parsed.trend),
      risk_level:      normalizeRisk(parsed.risk_level),
      headline:        String(parsed.headline ?? '').slice(0, 110),
      summary:         String(parsed.summary ?? '').slice(0, 320),
      recommendation:  parsed.recommendation ? String(parsed.recommendation).slice(0, 240) : null,
      evidence:        Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 5).map((e: any) => String(e).slice(0, 140)) : [],
    };
  } catch (e: any) {
    console.error('[insights] LLM call failed, falling back:', e?.message ?? e);
    return ruleFallback(features);
  }
}

// ─── Rule-based fallback (no LLM) ────────────────────────────────────────────
function ruleFallback(f: Features): Omit<PatientInsight, 'patientId' | 'sessions_analyzed' | 'features'> {
  let trend: InsightTrend = 'steady';
  let risk_level: RiskLevel = 'low';
  const evidence: string[] = [];

  if (f.rom_slope_per_session > 1.0) trend = 'improving';
  else if (f.rom_slope_per_session < -1.5) trend = 'regressing';
  else if (Math.abs(f.rom_slope_per_session) < 0.5 && f.rom_variance_recent < 6) trend = 'plateau';

  if (f.rom_drop_pct_from_peak >= 15) risk_level = 'high';
  else if (f.rom_drop_pct_from_peak >= 8 || f.rom_variance_recent > 25) risk_level = 'moderate';
  else if (f.days_since_last > 14 && trend !== 'improving') risk_level = 'moderate';

  evidence.push(`Avg ROM trend: ${f.rom_slope_per_session >= 0 ? '+' : ''}${f.rom_slope_per_session}°/session over last ${f.sessions} sessions`);
  evidence.push(`Recent avg ROM ${f.rom_avg_recent}° vs lifetime best ${f.rom_lifetime_best}° (${f.rom_drop_pct_from_peak >= 0 ? f.rom_drop_pct_from_peak : 0}% gap)`);
  if (f.days_since_last > 7) evidence.push(`Last session ${Math.round(f.days_since_last)} days ago`);

  let headline = 'Patient performance is steady.';
  let summary  = `Across the last ${f.sessions} sessions, ROM and rep counts have remained consistent. Risk indicators are within normal range.`;
  let recommendation: string | null = 'Continue current protocol; reassess in 3–4 sessions.';

  if (trend === 'improving') {
    headline = `ROM improving at ${f.rom_slope_per_session}°/session.`;
    summary = `Patient is on a clear upward trajectory. Consider tightening targets to maintain challenge as performance climbs.`;
    recommendation = 'Increase target ROM by 5° next session to keep the difficulty curve engaging.';
  } else if (trend === 'plateau') {
    headline = `Plateau detected — ROM holding around ${f.rom_avg_recent}°.`;
    summary = `ROM has flatlined at roughly ${f.rom_avg_recent}° for the recent window. Plateau likely reflects accommodation rather than effort.`;
    recommendation = 'Switch to dynamic / timed sequences or change exercise protocol to break the plateau.';
  } else if (trend === 'regressing') {
    headline = `Performance regressing — recent ROM down ${f.rom_drop_pct_from_peak}% from peak.`;
    summary = `Avg ROM has dropped from ${f.rom_lifetime_best}° (peak) to ${f.rom_avg_recent}° over recent sessions. Worth reviewing for overload or re-injury.`;
    recommendation = 'Schedule a check-in. Consider reducing target ROM 10% and assessing for new pain or strain.';
  }

  if (risk_level === 'high') {
    summary = `⚠ ${summary}`;
    recommendation = `Priority: ${recommendation ?? 'review ASAP'}`;
  }

  return { trend, risk_level, headline, summary, recommendation, evidence };
}

// ─── Persist ─────────────────────────────────────────────────────────────────
async function persist(insight: PatientInsight): Promise<PatientInsight> {
  const { error } = await supabase
    .from('ai_patient_insights')
    .insert({
      patient_id:       insight.patientId,
      trend:            insight.trend,
      risk_level:       insight.risk_level,
      headline:         insight.headline,
      summary:          insight.summary,
      recommendation:   insight.recommendation,
      evidence:         insight.evidence,
      features:         insight.features,
      sessions_analyzed: insight.sessions_analyzed,
    });
  if (error) console.error('[insights] persist failed:', error.message);
  return insight;
}

// ─── Math helpers ────────────────────────────────────────────────────────────
function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}
function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return avg(arr.map(n => (n - m) ** 2));
}
function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/** Linear regression slope of y over x (least-squares). */
function slope(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0;
  const mx = avg(xs), my = avg(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
function round(n: number): number  { return Math.round(n); }
function round2(n: number): number { return Math.round(n * 100) / 100; }

function normalizeTrend(t: unknown): InsightTrend {
  return (['improving','steady','plateau','regressing','insufficient_data'].includes(t as string))
    ? t as InsightTrend
    : 'steady';
}
function normalizeRisk(r: unknown): RiskLevel {
  return (['low','moderate','high','unknown'].includes(r as string))
    ? r as RiskLevel
    : 'low';
}
