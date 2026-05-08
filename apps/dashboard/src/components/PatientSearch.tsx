'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface Patient {
  id: string;
  name: string;
  condition: string;
  session_code: string;
}

const COND_COLORS: Record<string, string> = {
  'Shoulder Impingement Syndrome': '#a855f7',
  'ACL Reconstruction':            '#06b6d4',
  'Rotator Cuff Injury':           '#10b981',
  'Post-Op Mobility':              '#f59e0b',
  'Neural Pathway Calibration':    '#ef4444',
};

export function PatientSearch() {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen]         = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load patients once on mount
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('patients')
        .select('id, name, condition, session_code, status')
        .eq('physio_id', user.id)
        .order('name');
      // Hide discharged patients from the dashboard search by default
      if (data) setPatients(data.filter((p: any) => (p.status ?? 'active') === 'active'));
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Cmd/Ctrl+K to focus the search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? patients.filter((p) =>
        p.name.toLowerCase().includes(trimmed) ||
        p.condition.toLowerCase().includes(trimmed) ||
        p.session_code.toLowerCase().includes(trimmed),
      ).slice(0, 8)
    : patients.slice(0, 6);

  function go(p: Patient) {
    setOpen(false);
    setQuery('');
    router.push(`/patients/${p.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      const target = results[highlight];
      if (target) go(target);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#445566', pointerEvents: 'none' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>

      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setHighlight(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search patients by name, condition, or code…"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '9px 60px 9px 36px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none',
          fontFamily: ff,
          transition: 'border-color 0.15s',
        }}
      />

      {/* ⌘K hint */}
      {!query && (
        <kbd style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          fontFamily: 'monospace', fontSize: 9,
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#6688aa', letterSpacing: 0.5,
          pointerEvents: 'none',
        }}>
          ⌘K
        </kbd>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
          background: '#0f0f24',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 10,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          maxHeight: 360, overflowY: 'auto',
          zIndex: 100, fontFamily: ff,
        }}>
          {/* Section label */}
          <div style={{
            padding: '8px 14px',
            fontSize: 9, letterSpacing: 2, color: '#5577aa',
            textTransform: 'uppercase', fontWeight: 600,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            {trimmed
              ? `${results.length} match${results.length !== 1 ? 'es' : ''}`
              : patients.length === 0 ? 'No patients yet' : 'Recent patients'}
          </div>

          {results.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#445566', margin: 0 }}>
                {trimmed
                  ? 'No patients match that search.'
                  : 'Add a patient to start searching.'}
              </p>
            </div>
          ) : (
            results.map((p, i) => {
              const accent = COND_COLORS[p.condition] ?? '#8b5cf6';
              const active = i === highlight;
              return (
                <button
                  key={p.id}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => go(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%',
                    padding: '10px 14px',
                    background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
                    border: 'none',
                    borderLeft: `3px solid ${active ? accent : 'transparent'}`,
                    cursor: 'pointer', textAlign: 'left',
                    color: '#fff', fontFamily: ff,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: `${accent}22`, border: `1px solid ${accent}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: accent,
                  }}>
                    {p.name[0]}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 700, margin: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      <Highlighted text={p.name} query={trimmed} />
                    </p>
                    <p style={{
                      fontSize: 10, color: '#6688aa', margin: '2px 0 0',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      <Highlighted text={p.condition} query={trimmed} />
                    </p>
                  </div>

                  <span style={{
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                    color: accent, letterSpacing: 1.5, flexShrink: 0,
                  }}>
                    <Highlighted text={p.session_code} query={trimmed} />
                  </span>
                </button>
              );
            })
          )}

          {/* Footer hint */}
          {results.length > 0 && (
            <div style={{
              padding: '8px 14px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', justifyContent: 'space-between',
              fontSize: 9, letterSpacing: 1, color: '#445566',
            }}>
              <span><kbd style={kbdStyle}>↑↓</kbd> navigate · <kbd style={kbdStyle}>↵</kbd> open</span>
              <span><kbd style={kbdStyle}>esc</kbd> close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 9,
  padding: '1px 5px', borderRadius: 3,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#8899aa',
};

/** Bolds the matching substring inside a result row. */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(139,92,246,0.3)', color: '#fff', padding: 0, borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
