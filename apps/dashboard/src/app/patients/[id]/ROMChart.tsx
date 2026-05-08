'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface DataPoint {
  date: string;
  avgROM: number;
  maxROM: number;
  reps: number;
  score: number;
}

interface Props {
  data: DataPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium">{p.value}°</span>
        </div>
      ))}
      <div className="border-t border-gray-100 mt-2 pt-2 text-gray-400">
        Reps: {payload[0]?.payload?.reps} · Score: {payload[0]?.payload?.score}
      </div>
    </div>
  );
}

export function ROMChart({ data }: Props) {
  const hasMultiple = data.length > 1;

  // Show trend arrow in legend area
  const firstAvg = data[0]?.avgROM ?? 0;
  const lastAvg = data[data.length - 1]?.avgROM ?? 0;
  const trend = lastAvg - firstAvg;
  const trendLabel = trend > 0 ? `+${trend}° improvement` : trend < 0 ? `${trend}° change` : 'No change';
  const trendColor = trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <div>
      {hasMultiple && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-gray-400">Trend across {data.length} sessions:</span>
          <span className={`font-semibold ${trendColor}`}>{trendLabel}</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="maxROMGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="avgROMGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 180]}
            ticks={[0, 45, 90, 135, 180]}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}°`}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />

          {/* Clinical ROM milestones */}
          <ReferenceLine y={90}  stroke="#e5e7eb" strokeDasharray="4 4" label={{ value: '90°', position: 'insideTopRight', fontSize: 10, fill: '#d1d5db' }} />
          <ReferenceLine y={180} stroke="#e5e7eb" strokeDasharray="4 4" label={{ value: '180°', position: 'insideTopRight', fontSize: 10, fill: '#d1d5db' }} />

          <Area
            type="monotone"
            dataKey="maxROM"
            name="Max ROM"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#maxROMGrad)"
            dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Area
            type="monotone"
            dataKey="avgROM"
            name="Avg ROM"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#avgROMGrad)"
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
