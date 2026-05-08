'use client';

// All 13 achievement IDs from the catalog so we can show locked ones too
const ALL_ACHIEVEMENTS = [
  { id: 'first_rep',   name: 'First Rep',      icon: '🎯' },
  { id: 'rep_10',      name: 'Ten Reps',        icon: '💪' },
  { id: 'rep_50',      name: 'Half Century',    icon: '🏃' },
  { id: 'rep_100',     name: 'Century Club',    icon: '🏆' },
  { id: 'rom_90',      name: '90° Milestone',   icon: '📐' },
  { id: 'rom_120',     name: '120° Milestone',  icon: '📐' },
  { id: 'rom_150',     name: '150° Milestone',  icon: '📐' },
  { id: 'rom_180',     name: 'Full Range',       icon: '⭐' },
  { id: 'perfect_rep', name: 'Perfect Form',    icon: '✨' },
  { id: 'streak_3',    name: '3-Day Streak',    icon: '🔥' },
  { id: 'streak_7',    name: '7-Day Streak',    icon: '🔥' },
  { id: 'level_5',     name: 'Level 5',         icon: '⬆️' },
  { id: 'level_10',    name: 'Level 10',        icon: '🌟' },
];

interface EarnedRow {
  earned_at: string;
  achievements: {
    id: string;
    name: string;
    description: string;
    icon: string;
    xp_reward: number;
  } | null;
}

interface Props {
  earned: EarnedRow[];
}

export function AchievementBadges({ earned }: Props) {
  const earnedIds = new Set(earned.map((e) => e.achievements?.id).filter(Boolean));
  const earnedMap = new Map(
    earned
      .filter((e) => e.achievements)
      .map((e) => [e.achievements!.id, e]),
  );

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
      {ALL_ACHIEVEMENTS.map((a) => {
        const isEarned = earnedIds.has(a.id);
        const row = earnedMap.get(a.id);
        const earnedDate = row
          ? new Date(row.earned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
          : null;

        return (
          <div
            key={a.id}
            title={isEarned ? `${a.name} — earned ${earnedDate}` : `${a.name} — locked`}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
              isEarned
                ? 'bg-white border-blue-100 shadow-sm'
                : 'bg-gray-50 border-gray-100 opacity-40 grayscale'
            }`}
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="text-xs text-center text-gray-600 leading-tight font-medium">
              {a.name}
            </span>
            {isEarned && earnedDate && (
              <span className="text-xs text-gray-400">{earnedDate}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
