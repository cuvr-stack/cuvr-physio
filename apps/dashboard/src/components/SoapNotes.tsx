'use client';

import { useEffect, useState } from 'react';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface SoapContent {
  subjective: string;
  objective:  string;
  assessment: string;
  plan:       string;
}

interface SoapNote {
  id: string;
  session_id: string;
  generated_at: string;
  edited_at: string | null;
  signed_at: string | null;
  content: SoapContent;
  edited_content: SoapContent | null;
  source: 'ai' | 'rule_fallback';
}

const SECTION_META = {
  subjective: { label: 'S — Subjective', color: '#06b6d4' },
  objective:  { label: 'O — Objective',  color: '#a855f7' },
  assessment: { label: 'A — Assessment', color: '#f59e0b' },
  plan:       { label: 'P — Plan',       color: '#10b981' },
} as const;

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function SoapNotes({ patientId }: { patientId: string }) {
  const [notes, setNotes]   = useState<SoapNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/soap-notes/patient/${patientId}`);
      if (r.ok) {
        const data = await r.json();
        setNotes(data);
        if (data.length > 0) setOpenId(data[0].id);   // auto-expand the most recent
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 20,
      marginBottom: 22,
      fontFamily: ff,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(16,185,129,0.18)',
          border: '1px solid rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#10b981',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8"  y2="13" />
            <line x1="16" y1="17" x2="8"  y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
            SOAP Notes
          </h2>
          <p style={{ fontSize: 10, color: '#5577aa', margin: '2px 0 0', letterSpacing: 0.5 }}>
            {notes.length === 0
              ? 'Auto-generated after each completed session'
              : `${notes.length} note${notes.length === 1 ? '' : 's'} on file · auto-drafted by AI for review`}
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: '#445566', margin: 0 }}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p style={{ fontSize: 12, color: '#445566', margin: 0 }}>
          No SOAP notes yet. One is drafted automatically the moment a patient ends a session.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map(n => {
            const isOpen = openId === n.id;
            const content = n.edited_content ?? n.content;
            return (
              <NoteRow
                key={n.id}
                note={n}
                content={content}
                open={isOpen}
                onToggle={() => setOpenId(isOpen ? null : n.id)}
                onSigned={(updated) => {
                  setNotes(prev => prev.map(x => x.id === updated.id ? updated : x));
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note, content, open, onToggle, onSigned,
}: {
  note: SoapNote;
  content: SoapContent;
  open: boolean;
  onToggle: () => void;
  onSigned: (n: SoapNote) => void;
}) {
  const [signing, setSigning]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [draft, setDraft]       = useState<SoapContent>(content);

  // Re-seed the local draft if the upstream content changes (e.g. after sign-off)
  useEffect(() => { setDraft(content); }, [content]);

  async function sign() {
    if (note.signed_at) return;
    setSigning(true);
    try {
      const r = await fetch(`${API}/api/soap-notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign: true }),
      });
      if (r.ok) onSigned(await r.json());
    } finally { setSigning(false); }
  }

  async function saveEdits() {
    setSavingEdit(true);
    try {
      const r = await fetch(`${API}/api/soap-notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_content: draft }),
      });
      if (r.ok) {
        onSigned(await r.json());
        setEditing(false);
      }
    } finally { setSavingEdit(false); }
  }

  function cancelEdits() {
    setDraft(content);
    setEditing(false);
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${note.signed_at ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header row — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          fontFamily: ff, color: '#fff',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
          padding: '3px 8px', borderRadius: 4,
          background: note.signed_at ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
          color: note.signed_at ? '#10b981' : '#f59e0b',
          border: `1px solid ${note.signed_at ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
          textTransform: 'uppercase',
        }}>
          {note.signed_at ? 'Signed' : 'Draft'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>
            Session note · {formatWhen(note.generated_at)}
          </p>
          <p style={{ fontSize: 10, color: '#6688aa', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {content.assessment.slice(0, 110)}…
          </p>
        </div>
        <span style={{
          color: '#445566', fontSize: 14,
          transform: open ? 'rotate(90deg)' : 'rotate(0)',
          transition: 'transform 0.15s',
        }}>›</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{
          padding: '4px 16px 14px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key => {
            const meta = SECTION_META[key];
            return (
              <div key={key}>
                <p style={{
                  fontSize: 9, letterSpacing: 2, color: meta.color,
                  textTransform: 'uppercase', fontWeight: 700, margin: '12px 0 5px',
                }}>
                  {meta.label}
                </p>
                {editing ? (
                  <textarea
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${meta.color}55`,
                      borderRadius: 8, color: '#fff', fontSize: 12, lineHeight: 1.55,
                      outline: 'none', fontFamily: ff, resize: 'vertical',
                    }}
                  />
                ) : (
                  <p style={{
                    fontSize: 12, color: '#dbe3ec', margin: 0,
                    lineHeight: 1.6,
                  }}>
                    {content[key]}
                  </p>
                )}
              </div>
            );
          })}

          {/* Footer / actions */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 10, marginTop: 4,
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontSize: 9, color: '#445566', letterSpacing: 0.5 }}>
              {note.source === 'ai' ? 'Drafted by AI' : 'Drafted by rule engine'}
              {note.edited_at ? ` · edited ${formatWhen(note.edited_at)}` : ''}
              {note.signed_at ? ` · signed ${formatWhen(note.signed_at)}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {editing ? (
                <>
                  <button
                    onClick={cancelEdits}
                    disabled={savingEdit}
                    style={ghostBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdits}
                    disabled={savingEdit}
                    style={primaryBtn(savingEdit)}
                  >
                    {savingEdit ? 'Saving…' : 'Save Edits'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigator.clipboard?.writeText(soapToText(content))}
                    style={ghostBtn}
                  >
                    Copy
                  </button>
                  {!note.signed_at && (
                    <button onClick={() => setEditing(true)} style={ghostBtn}>
                      Edit
                    </button>
                  )}
                  {!note.signed_at && (
                    <button
                      onClick={sign}
                      disabled={signing}
                      style={{
                        padding: '7px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                        background: signing ? 'rgba(99,60,180,0.3)' : 'linear-gradient(90deg, #10b981, #059669)',
                        border: 'none', borderRadius: 6, color: '#fff',
                        cursor: signing ? 'wait' : 'pointer', textTransform: 'uppercase',
                        fontFamily: ff,
                      }}
                    >
                      {signing ? 'Signing…' : 'Sign Off'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function soapToText(c: SoapContent): string {
  return `S — Subjective\n${c.subjective}\n\nO — Objective\n${c.objective}\n\nA — Assessment\n${c.assessment}\n\nP — Plan\n${c.plan}\n`;
}

const ghostBtn: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#aabbcc',
  cursor: 'pointer', textTransform: 'uppercase',
  fontFamily: ff,
};
function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    padding: '7px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
    background: busy ? 'rgba(99,60,180,0.3)' : 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)',
    border: 'none', borderRadius: 6, color: '#fff',
    cursor: busy ? 'wait' : 'pointer', textTransform: 'uppercase',
    fontFamily: ff,
  };
}
