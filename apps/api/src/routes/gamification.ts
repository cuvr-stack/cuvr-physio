import type { FastifyInstance } from 'fastify';
import { supabase } from '../lib/supabase';
import { xpToLevel, xpProgressInLevel } from '../lib/scoring';

export async function gamificationRoutes(fastify: FastifyInstance) {
  // GET /api/gamification/stats/:patientId
  fastify.get<{ Params: { patientId: string } }>(
    '/stats/:patientId',
    async (req, _reply) => {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('patient_id', req.params.patientId)
        .single();

      if (error) {
        // First time — return defaults
        return {
          patient_id: req.params.patientId,
          xp: 0,
          level: 1,
          total_reps: 0,
          total_sessions: 0,
          best_rom: 0,
          current_streak: 0,
          longest_streak: 0,
        };
      }

      const progress = xpProgressInLevel(data.xp);
      return { ...data, level: xpToLevel(data.xp), xpProgress: progress };
    },
  );

  // GET /api/gamification/achievements/:patientId
  fastify.get<{ Params: { patientId: string } }>(
    '/achievements/:patientId',
    async (req, reply) => {
      const { data, error } = await supabase
        .from('player_achievements')
        .select('earned_at, achievements(id, name, description, icon, xp_reward)')
        .eq('patient_id', req.params.patientId)
        .order('earned_at', { ascending: false });

      if (error) return reply.code(500).send({ error: error.message });
      return data;
    },
  );

  // GET /api/gamification/catalog  — all available achievements
  fastify.get('/catalog', async (_req, reply) => {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('xp_reward', { ascending: true });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });
}
