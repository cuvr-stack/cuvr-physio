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

function Card({ children, ...style }: { children?: React.ReactNode } & React.CSSProperties) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 20, ...style,
    }}>{children}</div>
  );
}

export default function AnalyticsLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080812', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px', background: '#0a0a16', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skel w={140} h={20} />
            <Skel w={260} h={10} />
          </div>
          <div style={{ display: 'flex', gap: 6, padding: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
            <Skel w={50} h={26} r={7} />
            <Skel w={50} h={26} r={7} />
            <Skel w={50} h={26} r={7} />
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skel w="55%" h={9} />
                  <Skel w="40%" h={26} />
                  <Skel w="70%" h={10} />
                </div>
              </Card>
            ))}
          </div>

          {/* Bar chart */}
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Skel w={140} h={13} />
              <Skel w={90} h={9} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Skel w="100%" h={Math.round(40 + Math.random() * 90)} r={4} />
                  <Skel w={14} h={9} />
                </div>
              ))}
            </div>
          </Card>

          {/* Two-col row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            {[0, 1].map(c => (
              <Card key={c}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <Skel w={160} h={13} />
                  <Skel w={210} h={9} />
                </div>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    {c === 1 && <Skel w={24} h={24} r={6} />}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <Skel w="60%" h={11} />
                      <Skel w="40%" h={9} />
                    </div>
                    <Skel w={50} h={10} />
                  </div>
                ))}
              </Card>
            ))}
          </div>

          {/* Outcomes */}
          <div style={{ marginTop: 16 }}>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                <Skel w={180} h={13} />
                <Skel w={140} h={9} />
              </div>
              <Skel w="100%" h={14} r={8} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skel w="60%" h={9} />
                    <Skel w="40%" h={18} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
