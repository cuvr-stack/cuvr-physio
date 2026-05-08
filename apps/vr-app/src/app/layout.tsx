import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CuVR Physio',
  description: 'VR Physiotherapy — Meta Quest 3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
