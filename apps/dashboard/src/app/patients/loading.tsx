import { Sidebar } from '@/components/Sidebar';

function Skeleton({ w = '100%', h = 16, radius = 6 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}

export default function PatientsLoading() {
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton w={100} h={20} />
            <Skeleton w={180} h={10} />
          </div>
          <Skeleton w={110} h={36} radius={8} />
        </header>

        <main style={{ flex: 1, padding: '24px 28px' }}>
          {/* Search bar */}
          <Skeleton w={380} h={38} radius={8} />

          {/* Patient rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Skeleton w={40} h={40} radius={10} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <Skeleton w={130} h={14} />
                    <Skeleton w={90} h={10} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    <Skeleton w={80} h={9} />
                    <Skeleton w={70} h={18} />
                  </div>
                  <Skeleton w={14} h={14} radius={4} />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
