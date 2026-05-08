'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { StartSessionModal } from './StartSessionModal';

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconVR() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8z" />
      <circle cx="9" cy="12" r="2" /><circle cx="15" cy="12" r="2" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconSignal() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

const navItems = [
  { href: '/', label: 'DASHBOARD', Icon: IconGrid },
  { href: '/patients', label: 'PATIENTS', Icon: IconUsers },
  { href: '/sessions', label: 'VR SESSIONS', Icon: IconVR },
  { href: '/analytics', label: 'ANALYTICS', Icon: IconChart },
  { href: '/schedule', label: 'SCHEDULE', Icon: IconCalendar },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [startOpen, setStartOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside style={{
      width: 260,
      height: '100vh',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      background: '#0b0b18',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>

      {/* Brand */}
      <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <img src="/cuvr-logo.png" alt="CUVR Logo" style={{ width: 44, height: 22, objectFit: 'contain' }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: '#fff' }}>
            CU<span style={{ color: '#a855f7' }}>VR</span>
          </span>
        </div>
        <p style={{ fontSize: 9, letterSpacing: 3, color: '#5577aa', fontWeight: 500, textTransform: 'uppercase', margin: 0 }}>
          VR Recovery Wing
        </p>
      </div>

      {/* Nav — scrollable if it ever overflows */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px',
                borderRadius: 8,
                marginBottom: 2,
                fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                textDecoration: 'none',
                color: active ? '#fff' : '#4a5f7a',
                background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                borderLeft: active ? '3px solid #8b5cf6' : '3px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ color: active ? '#a855f7' : '#4a5f7a' }}>
                <Icon />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Pinned bottom section ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Start New Session */}
        <div style={{ padding: '16px 16px 12px' }}>
          <button
            onClick={() => setStartOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%',
              padding: '13px',
              background: 'linear-gradient(90deg, #7c3aed, #a855f7, #06b6d4)',
              borderRadius: 10,
              border: 'none',
              color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase',
              boxShadow: '0 4px 20px rgba(139,92,246,0.35)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <IconPlus />
            Start New Session
          </button>
        </div>

        {/* System Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 26px',
          fontSize: 11, fontWeight: 600, letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          <span style={{ color: '#10b981' }}><IconSignal /></span>
          <span style={{ color: '#2a4a5a' }}>System Status</span>
          <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        </div>

        {/* Log Out */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '11px 26px 20px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#4a5f7a',
            fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a5f7a')}
        >
          <IconLogout />
          Log Out
        </button>

      </div>

      {/* Patient picker for the Start New Session button */}
      {startOpen && <StartSessionModal onClose={() => setStartOpen(false)} />}
    </aside>
  );
}
