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

export default function DashboardLoading() {
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
        {/* Top bar skeleton */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px', background: '#0a0a16',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Skeleton w={80} h={18} />
            <Skeleton w={260} h={34} radius={8} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Skeleton w={34} h={34} radius={8} />
            <Skeleton w={34} h={34} radius={8} />
            <Skeleton w={34} h={34} radius={8} />
            <Skeleton w={120} h={34} radius={8} />
            <Skeleton w={38} h={38} radius={99} />
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px 28px' }}>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                flex: 1, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px',
                display: 'flex', gap: 16, alignItems: 'flex-start',
              }}>
                <Skeleton w={42} h={42} radius={10} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton w="60%" h={9} />
                  <Skeleton w="40%" h={26} />
                  <Skeleton w="70%" h={9} />
                </div>
              </div>
            ))}
          </div>

          {/* Middle row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
            {/* Patient cards */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton w={180} h={16} />
                  <Skeleton w={280} h={10} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, padding: 18,
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Skeleton w={38} h={38} radius={8} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <Skeleton w={90} h={13} />
                          <Skeleton w={70} h={9} />
                        </div>
                      </div>
                      <Skeleton w={60} h={18} radius={4} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Skeleton w={55} h={18} radius={4} />
                      <Skeleton w={45} h={18} radius={4} />
                    </div>
                    <Skeleton w="100%" h={4} radius={4} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Skeleton w="50%" h={36} radius={8} />
                      <Skeleton w="50%" h={36} radius={8} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Skeleton w={28} h={28} radius={6} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Skeleton w="70%" h={12} />
                    <Skeleton w="90%" h={9} />
                  </div>
                </div>
                <Skeleton w={110} h={110} radius={99} style={{ margin: '0 auto' }} />
                <Skeleton w="90%" h={9} />
                <Skeleton w="75%" h={9} />
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 18, flex: 1,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <Skeleton w={120} h={14} />
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                    padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <Skeleton w={36} h={12} />
                      <Skeleton w={20} h={9} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <Skeleton w="70%" h={12} />
                      <Skeleton w="50%" h={9} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Session monitor */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Skeleton w={220} h={16} />
              <Skeleton w={130} h={12} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Skeleton w={200} h={140} radius={12} />
              <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14 }}>
                    <Skeleton w="80%" h={12} />
                    <Skeleton w="50%" h={9} />
                    <Skeleton w="40%" h={28} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
