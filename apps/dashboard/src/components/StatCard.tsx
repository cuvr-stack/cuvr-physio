interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'orange' | 'purple';
}

const accentColors: Record<string, string> = {
  blue:   'text-blue-600',
  green:  'text-green-600',
  orange: 'text-orange-500',
  purple: 'text-purple-600',
};

export function StatCard({ label, value, sub, accent = 'blue' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accentColors[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
