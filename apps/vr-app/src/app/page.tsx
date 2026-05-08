'use client';

import dynamic from 'next/dynamic';
import { SessionSetup } from '@/components/SessionSetup';
import { SocketProvider } from '@/components/SocketProvider';
import { useSessionStore } from '@/store/sessionStore';

const VRScene = dynamic(() => import('@/components/VRScene'), { ssr: false });

export default function HomePage() {
  // Drive setup-vs-scene off the store so ending a session (which calls reset())
  // automatically returns us to the setup screen for the next patient.
  const session = useSessionStore((s) => s.session);

  return (
    <SocketProvider>
      <main style={{ width: '100vw', height: '100vh' }}>
        {!session && <SessionSetup onReady={() => { /* store state drives the swap */ }} />}
        <VRScene />
      </main>
    </SocketProvider>
  );
}
