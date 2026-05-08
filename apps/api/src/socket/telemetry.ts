import type { Server, Socket } from 'socket.io';
import type { TelemetryFrame } from '@physio-vr/shared-types';
import { supabase } from '../lib/supabase';
import { scoreRep, xpForRep, xpToLevel, computeStreak } from '../lib/scoring';
import { checkAndAwardAchievements } from '../lib/achievements';
import { startCoachSession, ingestFrame, endCoachSession } from '../services/aiCoach';
import { analyzePatient } from '../services/patientInsights';
import { generateSoapNote } from '../services/soapNotes';

const activeSessions = new Map<string, TelemetryFrame>();

interface ROMAccumulator {
  sum: number; count: number; max: number; startMs: number;
  patientId: string; exerciseId: string; targetROM: number; sessionReps: number;
}
const sessionROMAccumulator = new Map<string, ROMAccumulator>();

// Track which sessions belong to which socket so we can clean them up on disconnect.
const socketSessions = new Map<string, Set<string>>();

interface FinalizePayload {
  sessionId: string;
  patientId: string;
  exerciseId: string;
  score: number;
  repsCompleted: number;
}

/**
 * Single source of truth for ending a session. Used by both the explicit
 * `session:end` socket event AND the auto-cleanup on disconnect.
 */
async function finalizeSession(io: Server, payload: FinalizePayload, reason: 'explicit' | 'disconnect' = 'explicit') {
  io.emit('session:end', payload);

  const acc = sessionROMAccumulator.get(payload.sessionId);
  // If we never accumulated anything AND there's no rep count, skip metrics work
  // but still flip the DB row so it doesn't dangle as 'active'.
  if (!acc || (acc.count === 0 && payload.repsCompleted === 0)) {
    await supabase.from('sessions').update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      score: payload.score,
      reps_completed: payload.repsCompleted,
    }).eq('id', payload.sessionId);

    sessionROMAccumulator.delete(payload.sessionId);
    endCoachSession(payload.sessionId);
    if (reason === 'disconnect') {
      console.log(`[telemetry] auto-ended empty session ${payload.sessionId} on disconnect`);
    }
    return;
  }

  const durationSeconds = Math.round((Date.now() - acc.startMs) / 1000);
  const avgROM = acc.count > 0 ? Math.round(acc.sum / acc.count) : 0;

  await Promise.all([
    supabase.from('session_results').insert({
      session_id: payload.sessionId,
      exercise_id: payload.exerciseId,
      reps_completed: payload.repsCompleted,
      max_rom: acc.max,
      avg_rom: avgROM,
      duration_seconds: durationSeconds,
      score: payload.score,
    }),
    supabase.from('sessions').update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      score: payload.score,
      reps_completed: payload.repsCompleted,
    }).eq('id', payload.sessionId),
  ]);

  // Update streak and session count
  const { data: stats } = await supabase
    .from('player_stats')
    .select('current_streak, longest_streak, total_sessions, last_session_at, xp, best_rom')
    .eq('patient_id', payload.patientId)
    .single();

  const newStreak = computeStreak(stats?.last_session_at ?? null, stats?.current_streak ?? 0);
  const longestStreak = Math.max(stats?.longest_streak ?? 0, newStreak);

  await supabase.from('player_stats').upsert({
    patient_id: payload.patientId,
    current_streak: newStreak,
    longest_streak: longestStreak,
    total_sessions: (stats?.total_sessions ?? 0) + 1,
    last_session_at: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'patient_id' });

  const { data: freshStats } = await supabase
    .from('player_stats')
    .select('xp, level, total_reps, best_rom')
    .eq('patient_id', payload.patientId)
    .single();

  const newAchievements = await checkAndAwardAchievements({
    patientId: payload.patientId,
    totalReps: freshStats?.total_reps ?? 0,
    totalSessions: (stats?.total_sessions ?? 0) + 1,
    bestROM: freshStats?.best_rom ?? 0,
    maxRepROM: acc.max,
    targetROM: acc.targetROM,
    currentStreak: newStreak,
    level: freshStats?.level ?? 1,
    sessionReps: payload.repsCompleted,
  });

  if (newAchievements.length > 0) {
    const bonusXP = newAchievements.reduce((s, a) => s + a.xpReward, 0);
    await supabase.from('player_stats').upsert({
      patient_id: payload.patientId,
      xp: (freshStats?.xp ?? 0) + bonusXP,
      level: xpToLevel((freshStats?.xp ?? 0) + bonusXP),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'patient_id' });

    // Best-effort notify the originating socket if still connected
    io.emit('gamification:achievements_earned', newAchievements);
  }

  sessionROMAccumulator.delete(payload.sessionId);
  endCoachSession(payload.sessionId);

  if (reason === 'disconnect') {
    console.log(`[telemetry] auto-ended session ${payload.sessionId} on disconnect (${payload.repsCompleted} reps)`);
  }

  // Fire-and-forget: refresh longitudinal insights, then auto-draft the SOAP note.
  // The SOAP generator pulls the just-saved insight, so we sequence them.
  setTimeout(async () => {
    try {
      const i = await analyzePatient(payload.patientId);
      if (i) console.log(`[insights] refreshed for ${payload.patientId} → ${i.trend}/${i.risk_level}`);
    } catch (err) { console.error('[insights] refresh failed:', err); }

    try {
      const note = await generateSoapNote(payload.sessionId);
      if (note) console.log(`[soap] drafted for session ${payload.sessionId} (${note.source})`);
    } catch (err) { console.error('[soap] draft failed:', err); }
  }, 500);
}

export function registerTelemetrySocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('telemetry:update', (frame: TelemetryFrame) => {
      activeSessions.set(frame.patientId, frame);
      socket.to(`patient:${frame.patientId}`).emit('telemetry:update', frame);

      // Feed the AI coach
      ingestFrame(frame);

      // Accumulate ROM stats for session result on end
      if (frame.sessionId && frame.currentROM != null) {
        const acc = sessionROMAccumulator.get(frame.sessionId) ?? {
          sum: 0, count: 0, max: 0, startMs: frame.timestamp,
        };
        acc.sum += frame.currentROM;
        acc.count += 1;
        acc.max = Math.max(acc.max, frame.currentROM);
        sessionROMAccumulator.set(frame.sessionId, acc);
      }
    });

    socket.on('session:start', (payload: {
      patientId: string; exerciseId: string; sessionId: string; targetROM: number;
    }) => {
      socket.join(`patient:${payload.patientId}`);
      sessionROMAccumulator.set(payload.sessionId, {
        sum: 0, count: 0, max: 0, startMs: Date.now(),
        patientId: payload.patientId,
        exerciseId: payload.exerciseId,
        targetROM: payload.targetROM,
        sessionReps: 0,
      });
      io.to(`patient:${payload.patientId}`).emit('session:start', payload);

      // Remember this socket owns this session — used by the disconnect handler
      // to auto-finalize anything not explicitly ended.
      let owned = socketSessions.get(socket.id);
      if (!owned) {
        owned = new Set();
        socketSessions.set(socket.id, owned);
      }
      owned.add(payload.sessionId);

      // Spin up the AI coach for this session — emits coach:decision every ~5s
      startCoachSession(
        {
          sessionId: payload.sessionId,
          patientId: payload.patientId,
          exerciseId: payload.exerciseId,
          targetROM: payload.targetROM,
        },
        (decision) => {
          // Push to dashboards subscribed to this patient AND the VR client itself
          io.to(`patient:${payload.patientId}`).emit('coach:decision', decision);
          socket.emit('coach:decision', decision);
        },
      ).catch(err => console.error('[ai-coach] failed to start:', err));
    });

    socket.on('session:rep_complete', async (payload: {
      sessionId: string; repCount: number; rom: number; patientId: string;
    }) => {
      io.to(`patient:${payload.patientId}`).emit('session:rep_complete', payload);

      const acc = sessionROMAccumulator.get(payload.sessionId);
      if (acc) {
        acc.sessionReps = payload.repCount;
        acc.max = Math.max(acc.max, payload.rom);
      }

      // Award XP for this rep immediately — fast feedback to VR client
      const targetROM = acc?.targetROM ?? 90;
      const xpGained = xpForRep(payload.rom, targetROM);
      const repScore = scoreRep(payload.rom, targetROM);

      const { data: stats } = await supabase
        .from('player_stats')
        .select('xp, level, total_reps, best_rom')
        .eq('patient_id', payload.patientId)
        .single();

      const newXP = (stats?.xp ?? 0) + xpGained;
      const newLevel = xpToLevel(newXP);
      const leveledUp = newLevel > (stats?.level ?? 1);

      await supabase.from('player_stats').upsert({
        patient_id: payload.patientId,
        xp: newXP,
        level: newLevel,
        total_reps: (stats?.total_reps ?? 0) + 1,
        best_rom: Math.max(stats?.best_rom ?? 0, payload.rom),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'patient_id' });

      // Send XP update back to the VR client immediately
      socket.emit('gamification:rep_reward', {
        xpGained,
        repScore,
        totalXP: newXP,
        level: newLevel,
        leveledUp,
      });
    });

    socket.on('session:end', async (payload: {
      sessionId: string; patientId: string; exerciseId: string;
      score: number; repsCompleted: number;
    }) => {
      socketSessions.get(socket.id)?.delete(payload.sessionId);
      try {
        await finalizeSession(io, payload, 'explicit');
      } catch (err) {
        console.error('[telemetry] session:end finalize failed:', err);
      }
    });

    socket.on('dashboard:subscribe', (patientId: string) => {
      socket.join(`patient:${patientId}`);
      const lastFrame = activeSessions.get(patientId);
      if (lastFrame) socket.emit('telemetry:update', lastFrame);
    });

    socket.on('dashboard:unsubscribe', (patientId: string) => {
      socket.leave(`patient:${patientId}`);
    });

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Auto-finalize any sessions this socket started but never explicitly ended.
      const owned = socketSessions.get(socket.id);
      if (!owned || owned.size === 0) {
        socketSessions.delete(socket.id);
        return;
      }

      for (const sessionId of owned) {
        const acc = sessionROMAccumulator.get(sessionId);
        if (!acc) {
          // No accumulator means the row may already have been cleaned. Still
          // belt-and-braces flip the DB row in case it dangles.
          await supabase.from('sessions')
            .update({ status: 'completed', ended_at: new Date().toISOString() })
            .eq('id', sessionId)
            .eq('status', 'active');
          endCoachSession(sessionId);
          continue;
        }
        try {
          await finalizeSession(io, {
            sessionId,
            patientId:     acc.patientId,
            exerciseId:    acc.exerciseId,
            score:         0,                  // unknown — VR client never told us
            repsCompleted: acc.sessionReps,
          }, 'disconnect');
        } catch (err) {
          console.error(`[telemetry] auto-finalize failed for ${sessionId}:`, err);
        }
      }
      socketSessions.delete(socket.id);
    });
  });
}
