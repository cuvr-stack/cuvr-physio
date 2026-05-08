import { Sidebar } from '@/components/Sidebar';

function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}

export default function ScheduleLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080812', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px', background: '#0a0a16',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skel w={120} h={20} />
            <Skel w={220} h={10} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Skel w={34} h={34} r={8} />
            <Skel w={70} h={30} r={8} />
            <Skel w={34} h={34} r={8} />
          </div>
        </header>

        <main style={{ flex: 1, padding: '20px 28px', display: 'flex', gap: 20 }}>

          {/* Calendar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Day header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px 12px 0 0', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 8px' }} />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ padding: '12px 8px', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <Skel w={28} h={9} />
                  <Skel w={20} h={18} />
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '0 0 12px 12px', overflow: 'hidden', flex: 1,
            }}>
              {Array.from({ length: 8 }).map((_, ri) => (
                <div key={ri} style={{
                  display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  minHeight: 52,
                }}>
                  <div style={{ padding: '10px 10px 6px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <Skel w={32} h={9} />
                  </div>
                  {Array.from({ length: 7 }).map((_, ci) => (
                    <div key={ci} style={{
                      borderLeft: '1px solid rgba(255,255,255,0.04)',
                      padding: 6,
                    }}>
                      {/* Sprinkle a few skeleton appointments randomly */}
                      {(ri + ci) % 5 === 0 && <Skel w="100%" h={32} r={6} />}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <Skel w={280} h={10} r={4} />
          </div>

          {/* Right panel */}
          <div style={{ width: 252, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skel w={60} h={12} />
                <Skel w={50} h={10} />
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <Skel w="70%" h={11} />
                  <Skel w="50%" h={9} />
                  <Skel w="40%" h={10} />
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <Skel w={70} h={12} />
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <Skel w={30} h={30} r={8} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Skel w="70%" h={11} />
                    <Skel w="50%" h={9} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
