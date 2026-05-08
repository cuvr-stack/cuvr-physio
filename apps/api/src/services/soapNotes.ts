/**
 * Automated SOAP note generation.
 *
 * Triggered after a session ends. Pulls everything the physio would
 * normally hand-type:
 *   • Patient profile (condition, age, height, affected side)
 *   • This session's results (ROM, reps, duration, score)
 *   • Most recent longitudinal insight (trend, risk, recommendation)
 *   • Last few AI coach decisions during the session
 * Hands all of it to Claude with a SOAP-style system prompt and persists
 * the four-field JSON in `soap_notes`.
 *
 * Rule-based fallback runs if no API key is configured, so the loop still
 * works in development.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase';

const MODEL  = process.env.AI_COACH_MODEL ?? 'claude-haiku-4-5';
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export interface SoapContent {
  subjective: string;
  objective:  string;
  assessment: string;
  plan:       string;
}

export interface SoapNote {
  sessionId: string;
  patientId: string;
  content:   SoapContent;
  source:    'ai' | 'rule_fallback';
  features:  Record<string, unknown>;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  reps_completed: number;
  score: number;
  exercise_id: string;
  patient_id: string;
  physio_id?: string | null;
  session_results?: { avg_rom: number; max_rom: number; duration_seconds: number }[] | null;
}

const EXERCISE_LABELS: Record<string, string> = {
  'shoulder_flexion':   'shoulder flexion',
  'shoulder_abduction': 'shoulder abduction',
  'elbow_extension':    'elbow extension',
  'knee_flexion':       'knee flexion',
  'hip_abduction':      'hip abduction',
  'general':            'general assessment',
  'shoulder-flexion':   'shoulder flexion',
  'elbow-extension':    'elbow extension',
};

// ─── Public entry point ──────────────────────────────────────────────────────
export async function generateSoapNote(sessionId: string): Promise<SoapNote | null> {
  // Pull the session + per-session results + patient
  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select(`
      id, started_at, ended_at, reps_completed, score, exercise_id, patient_id,
      session_results(avg_rom, max_rom, duration_seconds)
    `)
    .eq('id', sessionId)
    .single();
  if (sErr || !session) return null;

  const s = session as SessionRow;

  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, condition, date_of_birth, height_cm, affected_side, physio_id')
    .eq('id', s.patient_id)
    .single();
  if (!patient) return null;

  // Latest longitudinal insight (may be null)
  const { data: insight } = await supabase
    .from('ai_patient_insights')
    .select('trend, risk_level, headline, summary, recommendation, sessions_analyzed')
    .eq('patient_id', s.patient_id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Last few coach decisions in this session — colourful evidence for the prompt
  const { data: coach } = await supabase
    .from('ai_coach_events')
    .select('payload')
    .eq('session_id', sessionId)
    .eq('kind', 'decision')
    .order('ts', { ascending: false })
    .limit(3);

  const features = buildFeatures(s, patient, insight);

  const content: SoapContent = client
    ? await callClaude(s, patient, insight, coach ?? [], features)
    : ruleFallback(s, patient, insight, features);

  // Persist
  const { error: pErr } = await supabase
    .from('soap_notes')
    .upsert({
      session_id: s.id,
      patient_id: s.patient_id,
      physio_id:  patient.physio_id,
      content,
      features,
      source: client ? 'ai' : 'rule_fallback',
    }, { onConflict: 'session_id' });
  if (pErr) console.error('[soap] persist failed:', pErr.message);

  return { sessionId: s.id, patientId: s.patient_id, content, source: client ? 'ai' : 'rule_fallback', features };
}

// ─── Feature pack used both for prompt context and stored audit ──────────────
function buildFeatures(s: SessionRow, p: any, insight: any) {
  const sr = s.session_results?.[0];
  const ageYears = p.date_of_birth
    ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 86400000))
    : null;
  const durationMin = sr?.duration_seconds ? Math.round(sr.duration_seconds / 60) : null;

  return {
    exercise:           EXERCISE_LABELS[s.exercise_id] ?? s.exercise_id,
    age_years:          ageYears,
    height_cm:          p.height_cm ?? null,
    affected_side:      p.affected_side ?? null,
    reps_completed:     s.reps_completed,
    avg_rom:            sr?.avg_rom ?? null,
    max_rom:            sr?.max_rom ?? null,
    score:              s.score,
    duration_min:       durationMin,
    longitudinal_trend: insight?.trend ?? null,
    risk_level:         insight?.risk_level ?? null,
  };
}

// ─── LLM ─────────────────────────────────────────────────────────────────────
async function callClaude(
  s: SessionRow, p: any, insight: any, coachDecisions: any[],
  features: Record<string, unknown>,
): Promise<SoapContent> {
  const systemPrompt = `You are an experienced physiotherapist generating a clinical SOAP note for a single VR rehabilitation session that just ended. The note will be reviewed and signed by the supervising physiotherapist.

Output ONLY a single JSON object, no markdown, no prose:
{
  "subjective": "<2-3 sentences>",
  "objective":  "<2-3 sentences with specific numbers>",
  "assessment": "<2-3 sentences with clinical interpretation>",
  "plan":       "<2-3 sentences with specific next-session steps>"
}

Section guidance:
- SUBJECTIVE: The patient's condition and engagement context. We don't have direct patient self-report from this session, so summarise based on attendance, condition, and known demographics. Use neutral clinical voice.
- OBJECTIVE: Measurable session data ONLY. Reference exact numbers: ROM in degrees with ° symbol, rep count, duration in minutes, score. Mention exercise type.
- ASSESSMENT: Interpret the data. Reference longitudinal trend if available. Use clinical hedges: "consistent with", "may indicate", "appears". Never diagnose.
- PLAN: Specific actionable steps. Cite numerical targets where reasonable. Reference the AI coach's adaptive difficulty if relevant.

Style rules:
- Clinical voice. Third person. Past tense for objective findings, future tense for plan.
- No first-person ("I think").
- Each section 2-3 sentences, max 320 chars.
- Use degree symbol (°) for ROM.`;

  const userMsg = JSON.stringify({
    patient: { name: p.name, condition: p.condition },
    features,
    last_few_coach_decisions: coachDecisions.map(c => ({
      delta: c.payload?.difficulty_delta,
      message: c.payload?.message,
      rationale: c.payload?.rationale,
    })),
    longitudinal: insight ? {
      trend:           insight.trend,
      risk_level:      insight.risk_level,
      recommendation:  insight.recommendation,
      sessions_analyzed: insight.sessions_analyzed,
    } : null,
  });

  try {
    const res = await client!.messages.create({
      model: MODEL,
      max_tokens: 700,
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
      subjective: trim(parsed.subjective),
      objective:  trim(parsed.objective),
      assessment: trim(parsed.assessment),
      plan:       trim(parsed.plan),
    };
  } catch (e: any) {
    console.error('[soap] LLM failed, using rule fallback:', e?.message ?? e);
    return ruleFallback(s, p, insight, features);
  }
}

function trim(v: unknown, max = 360): string {
  return String(v ?? '').trim().slice(0, max);
}

// ─── Rule fallback (no API key required) ────────────────────────────────────
function ruleFallback(
  s: SessionRow, p: any, insight: any,
  f: Record<string, any>,
): SoapContent {
  const ex = f.exercise ?? 'exercise';
  const age = f.age_years ? `${f.age_years}-year-old` : '';
  const side = f.affected_side ? ` ${f.affected_side}-side` : '';

  const subjective =
    `${age ? age + ' ' : ''}patient${side ? side : ''} attended a VR ${ex} session for ${p.condition.toLowerCase()}. ` +
    `Patient remained engaged throughout the session.`;

  const objParts: string[] = [];
  objParts.push(`${f.reps_completed ?? 0} reps completed${f.duration_min ? ` over ${f.duration_min} min` : ''}.`);
  if (f.avg_rom != null) objParts.push(`Average ROM ${f.avg_rom}°${f.max_rom != null ? `, peak ${f.max_rom}°` : ''}.`);
  if (f.score != null) objParts.push(`Session score ${f.score}.`);
  const objective = objParts.join(' ');

  let assessment = `Session metrics within expected range for ongoing rehabilitation of ${p.condition.toLowerCase()}.`;
  if (insight?.trend === 'improving') {
    assessment = `Performance trending upward across recent sessions; current numbers consistent with continued recovery.`;
  } else if (insight?.trend === 'plateau') {
    assessment = `ROM appears to have plateaued across recent sessions. May indicate accommodation rather than effort.`;
  } else if (insight?.trend === 'regressing') {
    assessment = `Recent decline in ROM/reps; worth reviewing for overload or new symptoms.`;
  }
  if (insight?.risk_level === 'high') assessment += ' Risk indicators elevated.';

  let plan = `Continue current protocol. Reassess at next session.`;
  if (insight?.recommendation) {
    plan = String(insight.recommendation);
  } else if (insight?.trend === 'improving') {
    plan = `Increase ROM target by 5° next session to maintain progressive overload. Continue current frequency.`;
  } else if (insight?.trend === 'plateau') {
    plan = `Switch to dynamic / timed sequences next session to break plateau. Review exercise variety.`;
  }

  return { subjective, objective, assessment, plan };
}
