import type { FastifyInstance } from 'fastify';
import { supabase } from '../lib/supabase';
import { analyzePatient } from '../services/patientInsights';

export async function patientsRoutes(fastify: FastifyInstance) {
  // GET /api/patients?physio_id=<uuid>
  fastify.get<{ Querystring: { physio_id?: string } }>('/', async (req, reply) => {
    let query = supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (req.query.physio_id) query = query.eq('physio_id', req.query.physio_id);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // GET /api/patients/code/:code — VR app resolves session code → patient
  // Returns demographics so the VR client can scale target placement to the patient.
  fastify.get<{ Params: { code: string } }>('/code/:code', async (req, reply) => {
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, condition, physio_id, status, date_of_birth, height_cm, affected_side')
      .eq('session_code', req.params.code.toUpperCase())
      .single();

    if (error) return reply.code(404).send({ error: 'Invalid session code' });
    if (data.status === 'discharged') {
      return reply.code(403).send({ error: 'This patient has been discharged. Please contact your physiotherapist.' });
    }
    return data;
  });

  // GET /api/patients/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return reply.code(404).send({ error: 'Patient not found' });
    return data;
  });

  // POST /api/patients
  fastify.post<{
    Body: {
      physio_id: string;
      name: string;
      condition: string;
      email?: string;
      date_of_birth?: string;
      height_cm?: number;
      affected_side?: 'left' | 'right' | 'bilateral';
    };
  }>('/', async (req, reply) => {
    const {
      physio_id, name, condition, email, date_of_birth,
      height_cm, affected_side,
    } = req.body;

    const { data, error } = await supabase
      .from('patients')
      .insert({
        physio_id,
        name,
        condition,
        email: email || null,
        date_of_birth: date_of_birth || null,
        height_cm: height_cm ?? null,
        affected_side: affected_side ?? null,
      })
      .select()
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.code(201).send(data);
  });

  // PATCH /api/patients/:id
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    async (req, reply) => {
      const { data, error } = await supabase
        .from('patients')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) return reply.code(400).send({ error: error.message });
      return data;
    },
  );

  // DELETE /api/patients/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { error } = await supabase.from('patients').delete().eq('id', req.params.id);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.code(204).send();
  });

  // POST /api/patients/:id/discharge
  // Marks a patient as discharged + auto-cancels any future scheduled appointments.
  fastify.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/:id/discharge', async (req, reply) => {
    const dischargedAt = new Date().toISOString();

    const { data: patient, error: pErr } = await supabase
      .from('patients')
      .update({
        status: 'discharged',
        discharged_at: dischargedAt,
        discharged_reason: req.body?.reason || null,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (pErr) return reply.code(400).send({ error: pErr.message });

    // Cancel future scheduled appointments (best-effort — log if it fails)
    const { error: aErr, count } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' }, { count: 'exact' })
      .eq('patient_id', req.params.id)
      .eq('status', 'scheduled')
      .gte('scheduled_at', dischargedAt);

    if (aErr) {
      console.error('[discharge] could not cancel future appointments:', aErr.message);
    }

    return reply.send({ patient, cancelled_appointments: count ?? 0 });
  });

  // GET /api/patients/:id/insights — latest stored insight for the patient
  fastify.get<{ Params: { id: string } }>('/:id/insights', async (req, reply) => {
    const { data, error } = await supabase
      .from('ai_patient_insights')
      .select('*')
      .eq('patient_id', req.params.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    return data ?? null;
  });

  // POST /api/patients/:id/insights/refresh — force a re-analysis now
  fastify.post<{ Params: { id: string } }>('/:id/insights/refresh', async (req, reply) => {
    try {
      const insight = await analyzePatient(req.params.id);
      if (!insight) return reply.code(404).send({ error: 'Patient not found' });
      return insight;
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message ?? 'Insight generation failed' });
    }
  });

  // POST /api/patients/:id/reactivate
  fastify.post<{ Params: { id: string } }>('/:id/reactivate', async (req, reply) => {
    const { data, error } = await supabase
      .from('patients')
      .update({
        status: 'active',
        discharged_at: null,
        discharged_reason: null,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return data;
  });
}
