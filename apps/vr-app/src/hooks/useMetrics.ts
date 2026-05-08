'use client';

import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';

interface Sample { t: number; x: number; y: number; z: number; }

export interface LiveMetrics {
  /** Peak hand speed over the rolling window, in m/s. */
  peakVelocity: number;
  /** 0–100, higher = smoother (lower acceleration variance). */
  smoothness: number;
  /** 0–100, % of perfect straight-line travel (100 = perfect). */
  efficiency: number;
  /** Cumulative path length over the window, in metres. */
  pathLength: number;
}

const BUFFER_MS  = 2000;   // rolling window
const POLL_MS    = 100;    // recompute frequency

const empty: LiveMetrics = { peakVelocity: 0, smoothness: 100, efficiency: 100, pathLength: 0 };

/**
 * Computes live motion-quality metrics from the dominant hand position.
 * Uses Zustand's getState() rather than subscribing per-frame so we never
 * re-render the calling component on every hand update — only at POLL_MS.
 */
export function useLiveMetrics(): LiveMetrics {
  const [metrics, setMetrics] = useState<LiveMetrics>(empty);
  const buffer = useRef<Sample[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = useSessionStore.getState();
      const hand = s.rightHandPos ?? s.leftHandPos;
      const now = Date.now();

      if (hand) {
        buffer.current.push({ t: now, x: hand.x, y: hand.y, z: hand.z });
      }
      // Trim old samples
      while (buffer.current.length && now - buffer.current[0].t > BUFFER_MS) {
        buffer.current.shift();
      }

      if (buffer.current.length < 4) {
        setMetrics(empty);
        return;
      }

      const samples = buffer.current;

      // Velocities + path length
      const velocities: number[] = [];
      let pathLength = 0;
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const dt = (b.t - a.t) / 1000;
        if (dt > 0) {
          velocities.push(dist / dt);
          pathLength += dist;
        }
      }

      const peakVelocity = velocities.length ? Math.max(...velocities) : 0;

      // Smoothness from acceleration variance.
      // Map: var=0 → 100 (perfect), var≥1 → 0.
      const accels: number[] = [];
      for (let i = 1; i < velocities.length; i++) {
        accels.push(Math.abs(velocities[i] - velocities[i - 1]));
      }
      let smoothness = 100;
      if (accels.length > 1) {
        const meanA = accels.reduce((a, b) => a + b, 0) / accels.length;
        const varA = accels.reduce((sum, a) => sum + (a - meanA) ** 2, 0) / accels.length;
        smoothness = Math.max(0, Math.min(100, 100 - varA * 80));
      }

      // Efficiency = straight-line / actual path length.
      const first = samples[0];
      const last = samples[samples.length - 1];
      const straight = Math.sqrt(
        (last.x - first.x) ** 2 + (last.y - first.y) ** 2 + (last.z - first.z) ** 2,
      );
      const efficiency = pathLength > 0.01
        ? Math.max(0, Math.min(100, (straight / pathLength) * 100))
        : 100;

      setMetrics({ peakVelocity, smoothness, efficiency, pathLength });
    }, POLL_MS);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}
