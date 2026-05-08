import type { FastifyInstance } from 'fastify';
import { supabase } from '../lib/supabase';
import { generateSoapNote } from '../services/soapNotes';

export async function soapNotesRoutes(fastify: FastifyInstance) {
  // GET /api/soap-notes/patient/:patientId — list (newest first)
  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId', async (req, reply) => {
    const { data, error } = await supabase
      .from('soap_notes')
      .select('id, session_id, generated_at, edited_at, signed_at, content, edited_content, source')
      .eq('patient_id', req.params.patientId)
      .order('generated_at', { ascending: false });
    if (error) return reply.code(500).send({ error: error.message });
    return data ?? [];
  });

  // GET /api/soap-notes/session/:sessionId — single note for a session
  fastify.get<{ Params: { sessionId: string } }>('/session/:sessionId', async (req, reply) => {
    const { data, error } = await supabase
      .from('soap_notes')
      .select('*')
      .eq('session_id', req.params.sessionId)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    return data ?? null;
  });

  // POST /api/soap-notes/session/:sessionId/generate — force regenerate
  fastify.post<{ Params: { sessionId: string } }>('/session/:sessionId/generate', async (req, reply) => {
    try {
      const note = await generateSoapNote(req.params.sessionId);
      if (!note) return reply.code(404).send({ error: 'Session not found' });
      return note;
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message ?? 'Generation failed' });
    }
  });

  // PATCH /api/soap-notes/:id — physio edits and/or signs the note
  fastify.patch<{
    Params: { id: string };
    Body: { edited_content?: any; sign?: boolean };
  }>('/:id', async (req, reply) => {
    const updates: Record<string, unknown> = {};
    if (req.body.edited_content) {
      updates.edited_content = req.body.edited_content;
      updates.edited_at = new Date().toISOString();
    }
    if (req.body.sign) {
      updates.signed_at = new Date().toISOString();
    }
    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'Nothing to update' });
    }
    const { data, error } = await supabase
      .from('soap_notes')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return reply.code(400).send({ error: error.message });
    return data;
  });
}
