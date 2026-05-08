'use client';

import { useState } from 'react';

export interface ReportData {
  patient: {
    id?: string;
    name: string;
    condition: string;
    session_code: string;
    email?: string | null;
    created_at: string;
  };
  stats: {
    xp: number;
    level: number;
    total_sessions: number;
    total_reps: number;
    best_rom: number;
    current_streak: number;
    longest_streak: number;
  } | null;
  sessions: Array<{
    date: string;
    exercise: string;
    reps: number;
    avgROM: number;
    maxROM: number;
    duration: number;
    score: number;
  }>;
  achievements: Array<{
    icon: string;
    name: string;
    description: string;
    earned_at: string;
  }>;
}

interface InsightAddon {
  trend: string;
  risk_level: string;
  headline: string;
  summary: string;
  recommendation: string | null;
  generated_at: string;
}

interface SoapAddon {
  generated_at: string;
  signed_at: string | null;
  content: { subjective: string; objective: string; assessment: string; plan: string };
  edited_content: { subjective: string; objective: string; assessment: string; plan: string } | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function fmtExercise(id: string) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
function xpToLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}
function xpPct(xp: number) {
  const level = xpToLevel(xp);
  const floor = 50 * (level - 1) ** 2;
  const ceil  = 50 * level ** 2;
  return Math.round(((xp - floor) / (ceil - floor)) * 100);
}

async function buildPDF(
  data: ReportData,
  insight: InsightAddon | null,
  latestSoap: SoapAddon | null,
): Promise<void> {
  // Lazy-load — never runs on the server
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const joinDate = new Date(data.patient.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const level = data.stats ? xpToLevel(data.stats.xp) : 1;
  const pct   = data.stats ? xpPct(data.stats.xp) : 0;

  // ── Colour palette ──────────────────────────────────────────
  const navy   = [13, 13, 36]   as [number,number,number];
  const darker = [8, 8, 18]     as [number,number,number];
  const purple = [168, 85, 247] as [number,number,number];
  const teal   = [6, 182, 212]  as [number,number,number];
  const green  = [16, 185, 129] as [number,number,number];
  const amber  = [245, 158, 11] as [number,number,number];
  const blue   = [59, 130, 246] as [number,number,number];
  const white  = [255, 255, 255] as [number,number,number];
  const muted  = [68, 85, 102]  as [number,number,number];
  const dim    = [30, 30, 60]   as [number,number,number];

  let y = 0;

  // ── Header band ─────────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 28, 'F');

  // CUVR logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...white);
  doc.text('CU', 14, 13);
  const cuW = doc.getTextWidth('CU');
  doc.setTextColor(...purple);
  doc.text('VR', 14 + cuW, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text('ZENITH CLINIC SYSTEMS · VR RECOVERY WING', 14, 19);

  // Report label top-right
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('PATIENT PROGRESS REPORT', W - 14, 10, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setTextColor(180, 190, 210);
  doc.text(`Generated ${today}`, W - 14, 16, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text(`Patient since ${joinDate}`, W - 14, 22, { align: 'right' });

  y = 28;

  // ── Patient strip ───────────────────────────────────────────
  doc.setFillColor(15, 15, 40);
  doc.rect(0, y, W, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...white);
  doc.text(data.patient.name, 14, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(102, 136, 170);
  doc.text(data.patient.condition, 14, y + 15);
  if (data.patient.email) {
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(data.patient.email, 14, y + 19.5);
  }

  // Session code box
  doc.setFillColor(30, 10, 60);
  doc.setDrawColor(...purple);
  doc.setLineWidth(0.3);
  doc.roundedRect(W - 56, y + 3, 42, 14, 2, 2, 'FD');
  doc.setFontSize(6);
  doc.setTextColor(124, 90, 170);
  doc.text('VR SESSION CODE', W - 35, y + 8.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...purple);
  doc.text(data.patient.session_code, W - 35, y + 15, { align: 'center' });

  y += 20;

  // ── Divider ─────────────────────────────────────────────────
  doc.setDrawColor(...dim);
  doc.setLineWidth(0.2);
  doc.line(0, y, W, y);
  y += 8;

  // ── Performance Overview ────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('PERFORMANCE OVERVIEW', 14, y);
  doc.setDrawColor(...dim);
  doc.line(14, y + 1.5, W - 14, y + 1.5);
  y += 7;

  const statCards = [
    { label: 'PLAYER LEVEL',   value: `LVL ${level}`,                     sub: `${pct}% to next`,              color: blue },
    { label: 'TOTAL SESSIONS', value: String(data.stats?.total_sessions ?? 0), sub: `${data.stats?.total_reps ?? 0} reps`, color: purple },
    { label: 'BEST ROM',       value: `${data.stats?.best_rom ?? 0}°`,     sub: 'All-time max',                 color: green },
    { label: 'STREAK',         value: String(data.stats?.current_streak ?? 0), sub: `Best: ${data.stats?.longest_streak ?? 0} days`, color: amber },
  ];

  const cardW = (W - 28 - 9) / 4;
  statCards.forEach((card, i) => {
    const x = 14 + i * (cardW + 3);
    doc.setFillColor(...navy);
    doc.setDrawColor(...dim);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...muted);
    doc.text(card.label, x + 5, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 5, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text(card.sub, x + 5, y + 20);
  });

  y += 28;

  // ── Session History Table ───────────────────────────────────
  if (data.sessions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`SESSION HISTORY  (${data.sessions.length} sessions)`, 14, y);
    doc.setDrawColor(...dim);
    doc.line(14, y + 1.5, W - 14, y + 1.5);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Exercise', 'Reps', 'Avg ROM', 'Max ROM', 'Duration', 'Score']],
      body: data.sessions.map((s) => [
        s.date,
        fmtExercise(s.exercise),
        String(s.reps),
        `${s.avgROM}°`,
        `${s.maxROM}°`,
        fmtDuration(s.duration),
        s.score.toLocaleString(),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: [200, 210, 230],
        fillColor: [12, 12, 28],
        lineColor: [25, 25, 55],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: navy,
        textColor: muted,
        fontSize: 6.5,
        fontStyle: 'bold',
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      },
      alternateRowStyles: {
        fillColor: [10, 10, 22],
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 42 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 20, textColor: teal, halign: 'center' },
        4: { cellWidth: 20, textColor: green, halign: 'center' },
        5: { cellWidth: 24, halign: 'center' },
        6: { cellWidth: 22, textColor: purple as any, fontStyle: 'bold', halign: 'right' },
      },
      didDrawPage: () => {},
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Achievements ────────────────────────────────────────────
  if (data.achievements.length > 0) {
    // Check if we need a new page
    if (y > 230) {
      doc.addPage();
      doc.setFillColor(...darker);
      doc.rect(0, 0, W, 297, 'F');
      y = 14;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`ACHIEVEMENTS EARNED  (${data.achievements.length})`, 14, y);
    doc.setDrawColor(...dim);
    doc.line(14, y + 1.5, W - 14, y + 1.5);
    y += 7;

    const cols = 3;
    const achW = (W - 28 - (cols - 1) * 4) / cols;
    const achH = 18;

    data.achievements.forEach((ach, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ax = 14 + col * (achW + 4);
      const ay = y + row * (achH + 3);

      if (ay + achH > 280) {
        // Don't overflow the page — jsPDF won't auto-paginate here
        return;
      }

      doc.setFillColor(...navy);
      doc.setDrawColor(...dim);
      doc.setLineWidth(0.25);
      doc.roundedRect(ax, ay, achW, achH, 2, 2, 'FD');

      // Icon
      doc.setFontSize(11);
      doc.text(ach.icon, ax + 4, ay + 9);

      // Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...white);
      doc.text(ach.name, ax + 13, ay + 7);

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...muted);
      const descLines = doc.splitTextToSize(ach.description, achW - 17);
      doc.text(descLines[0], ax + 13, ay + 12);

      // Date
      doc.setFontSize(5.5);
      doc.setTextColor(60, 100, 130);
      doc.text(
        new Date(ach.earned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        ax + 13, ay + 16,
      );
    });
  }

  // ── AI Coach insight page ───────────────────────────────────
  if (insight) {
    doc.addPage();
    doc.setFillColor(247, 248, 252);
    doc.rect(0, 0, W, 297, 'F');

    doc.setFillColor(13, 12, 30);
    doc.rect(0, 0, W, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('AI Coach Insights', 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 195, 220);
    doc.text(`Longitudinal analysis · generated ${new Date(insight.generated_at).toLocaleString('en-GB')}`, 14, 22);

    let y = 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 150);
    doc.text(`TREND: ${String(insight.trend).toUpperCase()}`, 14, y);
    doc.text(`RISK: ${String(insight.risk_level).toUpperCase()}`, 70, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 25, 40);
    const headlineLines = doc.splitTextToSize(insight.headline, W - 28);
    doc.text(headlineLines, 14, y);
    y += headlineLines.length * 6 + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 70, 90);
    const summaryLines = doc.splitTextToSize(insight.summary, W - 28);
    doc.text(summaryLines, 14, y);
    y += summaryLines.length * 5 + 8;

    if (insight.recommendation) {
      doc.setFillColor(245, 245, 255);
      doc.setDrawColor(139, 92, 246);
      doc.setLineWidth(0.6);
      doc.rect(14, y - 4, W - 28, 24, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(139, 92, 246);
      doc.text('SUGGESTED NEXT STEP', 18, y + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(20, 25, 40);
      const recLines = doc.splitTextToSize(insight.recommendation, W - 36);
      doc.text(recLines, 18, y + 9);
      y += 30;
    }
  }

  // ── SOAP note page ──────────────────────────────────────────
  if (latestSoap) {
    const content = latestSoap.edited_content ?? latestSoap.content;
    doc.addPage();
    doc.setFillColor(247, 248, 252);
    doc.rect(0, 0, W, 297, 'F');

    doc.setFillColor(13, 12, 30);
    doc.rect(0, 0, W, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('SOAP Note', 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 195, 220);
    const status = latestSoap.signed_at ? `Signed ${new Date(latestSoap.signed_at).toLocaleDateString('en-GB')}` : 'Draft (unsigned)';
    doc.text(`${status} · drafted ${new Date(latestSoap.generated_at).toLocaleString('en-GB')}`, 14, 22);

    const sections: { label: string; body: string; tint: [number, number, number] }[] = [
      { label: 'S — Subjective', body: content.subjective, tint: [6, 182, 212] },
      { label: 'O — Objective',  body: content.objective,  tint: [139, 92, 246] },
      { label: 'A — Assessment', body: content.assessment, tint: [245, 158, 11] },
      { label: 'P — Plan',       body: content.plan,       tint: [16, 185, 129] },
    ];
    let y = 42;
    for (const s of sections) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(s.tint[0], s.tint[1], s.tint[2]);
      doc.text(s.label, 14, y);
      doc.setDrawColor(s.tint[0], s.tint[1], s.tint[2]);
      doc.setLineWidth(0.4);
      doc.line(14, y + 2, 60, y + 2);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(35, 40, 55);
      const lines = doc.splitTextToSize(s.body, W - 28);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 9;
    }

    if (!latestSoap.signed_at) {
      y += 6;
      doc.setFillColor(255, 247, 230);
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.4);
      doc.rect(14, y - 4, W - 28, 12, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(180, 100, 0);
      doc.text('This note has not yet been signed off by a physiotherapist.', 18, y + 3);
    }
  }

  // ── Footer on every page ────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(...dim);
    doc.setLineWidth(0.2);
    doc.line(14, 287, W - 14, 287);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text('© 2026 CUVR Spatial Systems · Zenith Clinic VR Recovery Wing', 14, 292);
    doc.text(`Page ${p} of ${pageCount}  ·  Confidential — For clinical use only`, W - 14, 292, { align: 'right' });
  }

  const fileName = `${data.patient.name.replace(/\s+/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

// ── Button component ─────────────────────────────────────────
export function DownloadReportButton({ data }: { data: ReportData }) {
  const [state, setState] = useState<'idle' | 'generating'>('idle');

  async function handleClick() {
    setState('generating');
    try {
      // Pull the latest insight + SOAP note in parallel — both optional, both
      // gracefully handled if they're not present yet.
      let insight: InsightAddon | null = null;
      let soap: SoapAddon | null = null;
      const pid = data.patient.id;
      if (pid) {
        const [iRes, sRes] = await Promise.allSettled([
          fetch(`${API}/api/patients/${pid}/insights`).then(r => r.ok ? r.json() : null),
          fetch(`${API}/api/soap-notes/patient/${pid}`).then(r => r.ok ? r.json() : []),
        ]);
        if (iRes.status === 'fulfilled' && iRes.value)        insight = iRes.value;
        if (sRes.status === 'fulfilled' && Array.isArray(sRes.value) && sRes.value.length > 0) {
          soap = sRes.value[0];                          // newest first per API
        }
      }
      await buildPDF(data, insight, soap);
    } finally {
      setState('idle');
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'generating'}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px',
        background: state === 'generating'
          ? 'rgba(99,60,180,0.4)'
          : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
        border: 'none', borderRadius: 8,
        color: '#fff', fontSize: 12, fontWeight: 700,
        cursor: state === 'generating' ? 'wait' : 'pointer',
        letterSpacing: 0.5,
        boxShadow: state === 'generating' ? 'none' : '0 2px 12px rgba(139,92,246,0.3)',
        transition: 'all 0.2s',
      }}
    >
      {state === 'generating' ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Generating…
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Report
        </>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
