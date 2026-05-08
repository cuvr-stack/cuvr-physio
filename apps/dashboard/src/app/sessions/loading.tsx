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

export default function SessionsLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080812', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px', background: '#0a0a16',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skel w={150} h={20} />
            <Skel w={240} h={10} />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
          }}>
            <Skel w={8} h={8} r={99} />
            <Skel w={120} h={11} />
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px 28px' }}>

          {/* Status banner */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '20px 22px',
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
          }}>
            <Skel w={48} h={48} r={12} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skel w={200} h={14} />
              <Skel w={320} h={10} />
            </div>
          </div>

          {/* Live session cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Skel w={40} h={40} r={10} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skel w="55%" h={13} />
                    <Skel w="40%" h={9} />
                  </div>
                  <Skel w={56} h={20} r={4} />
                </div>

                {/* Big stat */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skel w="35%" h={9} />
                  <Skel w="50%" h={32} />
                </div>

                {/* Mini stats row */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {[1, 2, 3].map(j => (
                    <div key={j} style={{
                      flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <Skel w="60%" h={9} />
                      <Skel w="40%" h={14} />
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Skel w={70} h={9} />
                    <Skel w={32} h={9} />
                  </div>
                  <Skel w="100%" h={6} r={3} />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
