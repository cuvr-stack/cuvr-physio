import type { Metadata } from 'next';
import './globals.css';
import { IdleTimeout } from '@/components/IdleTimeout';

export const metadata: Metadata = {
  title: 'CuVR Physio Dashboard',
  description: 'Physiotherapist Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#080812', color: '#fff', minHeight: '100vh' }}>
        {/* HIPAA-aligned idle auto-logout — sits on top of all routes, skips auth pages itself. */}
        <IdleTimeout />
        {children}
      </body>
    </html>
  );
}
