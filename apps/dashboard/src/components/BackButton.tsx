'use client';

import { useRouter } from 'next/navigation';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface Props {
  /** Where to go if there's no history to pop (deep link, bookmark, fresh tab). */
  fallbackHref?: string;
  /** Visible label next to the arrow. */
  label?: string;
}

/**
 * Returns to the previous page in browser history, or to `fallbackHref`
 * if the user landed here directly. Works across the dashboard regardless
 * of how the user navigated in (sidebar, search, deep link, schedule click, etc).
 */
export function BackButton({ fallbackHref = '/', label = 'Back' }: Props) {
  const router = useRouter();

  function handleClick() {
    // Heuristic: if we have intra-app history, pop it.
    // history.length > 1 means there's at least one entry behind us.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="back-btn"
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        color: '#aabbcc', fontSize: 12, fontWeight: 600,
        fontFamily: ff,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
      <style>{`
        .back-btn:hover {
          background: rgba(139,92,246,0.12) !important;
          border-color: rgba(139,92,246,0.35) !important;
          color: #fff !important;
        }
      `}</style>
    </button>
  );
}
