// ── XP / level formula ────────────────────────────────────────
// Level = floor(sqrt(totalXP / 50)) + 1
// Gives a curve: L1=0xp, L2=50, L3=200, L4=450, L5=800, L10=4050

export function xpToLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function xpForLevel(level: number): number {
  return 50 * (level - 1) ** 2;
}

export function xpProgressInLevel(xp: number): { current: number; required: number; pct: number } {
  const level = xpToLevel(xp);
  const floorXP = xpForLevel(level);
  const ceilXP = xpForLevel(level + 1);
  const current = xp - floorXP;
  const required = ceilXP - floorXP;
  return { current, required, pct: Math.round((current / required) * 100) };
}

// ── Per-rep scoring ───────────────────────────────────────────
// base 100 pts + ROM quality bonus (up to 100 pts extra)

export function scoreRep(currentROM: number, targetROM: number): number {
  const accuracy = Math.min(1.5, currentROM / targetROM); // cap at 150%
  const romBonus = Math.round(accuracy * 100);
  return 100 + romBonus;
}

export function xpForRep(currentROM: number, targetROM: number): number {
  const accuracy = Math.min(1.5, currentROM / targetROM);
  return Math.round(10 + accuracy * 10); // 10–25 XP per rep
}

// ── Streak ────────────────────────────────────────────────────

export function computeStreak(
  lastSessionAt: string | null,
  currentStreak: number,
): number {
  if (!lastSessionAt) return 1;

  const last = new Date(lastSessionAt);
  const today = new Date();
  const diffDays = Math.floor(
    (today.setHours(0, 0, 0, 0) - last.setHours(0, 0, 0, 0)) / 86_400_000,
  );

  if (diffDays === 0) return currentStreak;      // same day, no change
  if (diffDays === 1) return currentStreak + 1;  // consecutive day
  return 1;                                       // streak broken
}
