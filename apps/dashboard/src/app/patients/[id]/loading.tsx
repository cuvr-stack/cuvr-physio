import type React from 'react';
import { Sidebar } from '@/components/Sidebar';

function Skeleton({
  w = '100%', h = 16, radius = 6, style,
}: {
  w?: string | number; h?: number; radius?: number; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  );
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14, padding: '20px 22px',
};

export default function PatientDetailLoading() {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#080812',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px', background: '#0a0a16',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Skeleton w={70} h={12} />
            <Skeleton w={8} h={12} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton w={150} h={18} />
              <Skeleton w={110} h={10} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Skeleton w={140} h={36} radius={8} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <Skeleton w={90} h={9} />
              <Skeleton w={110} h={26} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton w="55%" h={9} />
                <Skeleton w="45%" h={28} />
                <Skeleton w="65%" h={10} />
              </div>
            ))}
          </div>

          {/* ROM chart */}
          <div style={{ ...card, marginBottom: 20 }}>
            <Skeleton w={100} h={14} style={{ marginBottom: 16 }} />
            <Skeleton w="100%" h={220} radius={8} />
          </div>

          {/* Achievements */}
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Skeleton w={110} h={14} />
              <Skeleton w={60} h={10} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  width: 64,
                }}>
                  <Skeleton w={48} h={48} radius={12} />
                  <Skeleton w={54} h={9} />
                </div>
              ))}
            </div>
          </div>

          {/* Session table */}
          <div style={card}>
            <Skeleton w={130} h={14} style={{ marginBottom: 16 }} />
            {/* Table header */}
            <div style={{
              display: 'flex', gap: 8, padding: '8px 12px', marginBottom: 4,
              background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            }}>
              {[15, 25, 10, 12, 12, 14, 12].map((w, i) => (
                <Skeleton key={i} w={`${w}%`} h={9} />
              ))}
            </div>
            {/* Table rows */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                {[15, 25, 10, 12, 12, 14, 12].map((w, j) => (
                  <Skeleton key={j} w={`${w}%`} h={11} />
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
