'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import type { TelemetryFrame } from '@physio-vr/shared-types';

interface Props {
  frame: TelemetryFrame;
}

export function LiveSessionCard({ frame }: Props) {
  const [history, setHistory] = useState<{ t: number; rom: number }[]>([]);

  useEffect(() => {
    setHistory((prev) => [
      ...prev.slice(-59),
      { t: frame.timestamp, rom: frame.currentROM ?? 0 },
    ]);
  }, [frame]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="font-semibold text-gray-900">Patient {frame.patientId.slice(0, 8)}</p>
          <p className="text-xs text-gray-400">Session {frame.sessionId.slice(0, 8)}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-brand-500">{frame.currentROM ?? 0}°</p>
          <p className="text-xs text-gray-400">Current ROM</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{frame.currentRep ?? 0}</p>
          <p className="text-xs text-gray-400">Reps</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-700">
            {frame.headPosition.y.toFixed(2)}m
          </p>
          <p className="text-xs text-gray-400">Head Height</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={history}>
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 180]} hide />
          <Tooltip formatter={(v) => [`${v}°`, 'ROM']} labelFormatter={() => ''} />
          <Line type="monotone" dataKey="rom" stroke="#4488ff" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
