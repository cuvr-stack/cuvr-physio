import { supabase } from './supabase';

export interface EarnedAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
}

interface CheckContext {
  patientId: string;
  totalReps: number;
  totalSessions: number;
  bestROM: number;
  maxRepROM: number;       // highest ROM in this session's reps
  targetROM: number;
  currentStreak: number;
  level: number;
  sessionReps: number;    // reps in current session
}

// Returns achievement IDs that should be awarded based on current state
function eligibleAchievements(ctx: CheckContext): string[] {
  const ids: string[] = [];

  if (ctx.totalReps >= 1)   ids.push('first_rep');
  if (ctx.sessionReps >= 10) ids.push('rep_10');
  if (ctx.totalReps >= 50)  ids.push('rep_50');
  if (ctx.totalReps >= 100) ids.push('rep_100');
  if (ctx.bestROM >= 90)    ids.push('rom_90');
  if (ctx.bestROM >= 120)   ids.push('rom_120');
  if (ctx.bestROM >= 150)   ids.push('rom_150');
  if (ctx.bestROM >= 180)   ids.push('rom_180');
  if (ctx.maxRepROM >= ctx.targetROM) ids.push('perfect_rep');
  if (ctx.currentStreak >= 3)  ids.push('streak_3');
  if (ctx.currentStreak >= 7)  ids.push('streak_7');
  if (ctx.level >= 5)   ids.push('level_5');
  if (ctx.level >= 10)  ids.push('level_10');

  return ids;
}

export async function checkAndAwardAchievements(
  ctx: CheckContext,
): Promise<EarnedAchievement[]> {
  const candidates = eligibleAchievements(ctx);
  if (candidates.length === 0) return [];

  // Find which ones are already earned
  const { data: existing } = await supabase
    .from('player_achievements')
    .select('achievement_id')
    .eq('patient_id', ctx.patientId)
    .in('achievement_id', candidates);

  const alreadyEarned = new Set((existing ?? []).map((r) => r.achievement_id));
  const newIds = candidates.filter((id) => !alreadyEarned.has(id));

  if (newIds.length === 0) return [];

  // Fetch achievement details for XP rewards
  const { data: achievementRows } = await supabase
    .from('achievements')
    .select('id, name, description, icon, xp_reward')
    .in('id', newIds);

  if (!achievementRows?.length) return [];

  // Insert earned records
  await supabase.from('player_achievements').insert(
    newIds.map((id) => ({ patient_id: ctx.patientId, achievement_id: id })),
  );

  return achievementRows.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    xpReward: a.xp_reward,
  }));
}
