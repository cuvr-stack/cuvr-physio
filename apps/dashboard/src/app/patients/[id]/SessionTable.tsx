'use client';

const EXERCISE_NAMES: Record<string, string> = {
  'shoulder-flexion': 'Shoulder Flexion',
  'elbow-extension':  'Elbow Extension',
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function ROMBar({ value, max = 180 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = value >= 150 ? 'bg-green-500' : value >= 90 ? 'bg-blue-500' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-700 tabular-nums">{value}°</span>
    </div>
  );
}

interface SessionRow {
  date: string;
  dateISO: string;
  avgROM: number;
  maxROM: number;
  reps: number;
  score: number;
  exercise: string;
  duration: number;
}

interface Props {
  sessions: SessionRow[];
}

export function SessionTable({ sessions }: Props) {
  if (sessions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left px-6 py-3 font-medium">Date</th>
            <th className="text-left px-6 py-3 font-medium">Exercise</th>
            <th className="text-left px-6 py-3 font-medium">Reps</th>
            <th className="text-left px-6 py-3 font-medium">Avg ROM</th>
            <th className="text-left px-6 py-3 font-medium">Max ROM</th>
            <th className="text-left px-6 py-3 font-medium">Duration</th>
            <th className="text-right px-6 py-3 font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, i) => (
            <tr
              key={s.dateISO + i}
              className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{s.date}</td>
              <td className="px-6 py-4 text-gray-800 font-medium">
                {EXERCISE_NAMES[s.exercise] ?? s.exercise}
              </td>
              <td className="px-6 py-4 text-gray-700">{s.reps}</td>
              <td className="px-6 py-4">
                <ROMBar value={s.avgROM} />
              </td>
              <td className="px-6 py-4">
                <ROMBar value={s.maxROM} />
              </td>
              <td className="px-6 py-4 text-gray-500">{formatDuration(s.duration)}</td>
              <td className="px-6 py-4 text-right font-semibold text-blue-600">{s.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
