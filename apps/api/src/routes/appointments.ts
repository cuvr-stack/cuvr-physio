import type { FastifyInstance } from 'fastify';
import { supabase } from '../lib/supabase';

export async function appointmentsRoutes(fastify: FastifyInstance) {

  // GET /api/appointments?physio_id=&from=&to=
  fastify.get<{ Querystring: { physio_id?: string; from?: string; to?: string } }>(
    '/',
    async (req, reply) => {
      const { physio_id, from, to } = req.query;

      let query = supabase
        .from('appointments')
        .select(`
          id, scheduled_at, duration_min, exercise_id, status, notes, created_at,
          patients(id, name, condition, session_code)
        `)
        .order('scheduled_at', { ascending: true });

      if (physio_id) query = query.eq('physio_id', physio_id);
      if (from)      query = query.gte('scheduled_at', from);
      if (to)        query = query.lte('scheduled_at', to);

      const { data, error } = await query;
      if (error) return reply.code(500).send({ error: error.message });
      return data;
    },
  );

  // POST /api/appointments
  fastify.post<{
    Body: {
      physio_id: string;
      patient_id: string;
      scheduled_at: string;
      duration_min?: number;
      exercise_id?: string;
      notes?: string;
    };
  }>('/', async (req, reply) => {
    const { physio_id, patient_id, scheduled_at, duration_min, exercise_id, notes } = req.body;

    // Reject past appointments
    if (new Date(scheduled_at).getTime() < Date.now()) {
      return reply.code(400).send({ error: 'Cannot book an appointment in the past.' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        physio_id,
        patient_id,
        scheduled_at,
        duration_min: duration_min ?? 45,
        exercise_id: exercise_id ?? 'general',
        notes: notes || null,
      })
      .select(`
        id, scheduled_at, duration_min, exercise_id, status, notes,
        patients(id, name, condition, session_code)
      `)
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.code(201).send(data);
  });

  // PATCH /api/appointments/:id  — reschedule, change notes, mark cancelled/completed
  fastify.patch<{
    Params: { id: string };
    Body: {
      scheduled_at?: string;
      duration_min?: number;
      exercise_id?: string;
      status?: string;
      notes?: string;
    };
  }>('/:id', async (req, reply) => {
    const updates: Record<string, unknown> = {};
    const { scheduled_at, duration_min, exercise_id, status, notes } = req.body;

    if (scheduled_at !== undefined) {
      if (new Date(scheduled_at).getTime() < Date.now()) {
        return reply.code(400).send({ error: 'Cannot reschedule to a past date or time.' });
      }
      updates.scheduled_at = scheduled_at;
    }
    if (duration_min  !== undefined) updates.duration_min  = duration_min;
    if (exercise_id   !== undefined) updates.exercise_id   = exercise_id;
    if (status        !== undefined) updates.status        = status;
    if (notes         !== undefined) updates.notes         = notes;

    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', req.params.id)
      .select(`
        id, scheduled_at, duration_min, exercise_id, status, notes,
        patients(id, name, condition, session_code)
      `)
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return data;
  });

  // DELETE /api/appointments/:id  — hard delete
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', req.params.id);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.code(204).send();
  });
}
