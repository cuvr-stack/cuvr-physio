import type { FastifyInstance } from 'fastify';
import type { ExerciseResult } from '@physio-vr/shared-types';
import { supabase } from '../lib/supabase';

export async function sessionsRoutes(fastify: FastifyInstance) {
  // POST /api/sessions/start
  fastify.post<{ Body: { patientId: string; exerciseId: string; pain_at_start?: number } }>(
    '/start',
    async (req, reply) => {
      const { patientId, exerciseId, pain_at_start } = req.body;
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          patient_id: patientId,
          exercise_id: exerciseId,
          status: 'active',
          pain_at_start: pain_at_start != null
            ? Math.max(0, Math.min(10, Math.round(pain_at_start)))
            : null,
        })
        .select()
        .single();

      if (error) return reply.code(400).send({ error: error.message });
      return reply.code(201).send(data);
    },
  );

  // POST /api/sessions/:id/end
  fastify.post<{
    Params: { id: string };
    Body: { score: number; repsCompleted: number };
  }>('/:id/end', async (req, reply) => {
    const { data, error } = await supabase
      .from('sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        score: req.body.score ?? 0,
        reps_completed: req.body.repsCompleted ?? 0,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return reply.code(404).send({ error: error.message });
    return data;
  });

  // GET /api/sessions/patient/:patientId
  fastify.get<{ Params: { patientId: string } }>(
    '/patient/:patientId',
    async (req, reply) => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, session_results(*)')
        .eq('patient_id', req.params.patientId)
        .order('started_at', { ascending: false });

      if (error) return reply.code(500).send({ error: error.message });
      return data;
    },
  );

  // POST /api/sessions/results  — save per-session summary
  fastify.post<{ Body: ExerciseResult }>('/results', async (req, reply) => {
    const { error } = await supabase.from('session_results').insert({
      session_id: req.body.sessionId,
      exercise_id: req.body.exerciseId,
      reps_completed: req.body.repsCompleted,
      max_rom: req.body.maxROM,
      avg_rom: req.body.avgROM,
      duration_seconds: req.body.durationSeconds,
      score: req.body.score,
    });

    if (error) return reply.code(400).send({ error: error.message });
    return { ok: true };
  });
}
