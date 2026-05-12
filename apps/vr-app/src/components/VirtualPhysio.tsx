'use client';

/**
 * Virtual Physio — a procedural humanoid coach that stands beside the patient
 * during a session, talks to them via the browser's SpeechSynthesis API, and
 * animates a lip-sync mouth + idle float when speaking.
 *
 * Game-state driven dialogue:
 *   • countdown      → "Take your stance."  /  "Eyes on the target."
 *   • first GO       → "Begin when you're ready."
 *   • each hit       → "Excellent form."  /  "Beautifully done."
 *   • each miss      → "Let your shoulders relax."
 *   • round complete → "Beautiful session. Take a moment to rest."
 *
 * Mute is exposed via the `muted` prop so the game can silence the voice
 * during a clinical demo if needed.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { useGameStore } from '@/store/gameStore';

const LINES = {
  countdown: [
    "Take your stance.",
    "Eyes on the target.",
    "Centre yourself, breathe out slowly.",
  ],
  go: ["Begin when you're ready."],
  hit: [
    "Excellent form.",
    "Smooth release.",
    "Beautifully done.",
    "Right on the mark.",
    "Strong and centred.",
  ],
  miss: [
    "Let your shoulders relax. Try again.",
    "Breathe out and reset your posture.",
    "Take your time. Mind your stance.",
    "Soften your grip, focus on the form.",
  ],
  roundEnd: [
    "Wonderful work. Take a moment to rest.",
    "Beautiful session. Slow breath in.",
    "Well done. Stand tall and breathe.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Speech engine — wraps SpeechSynthesis with cooldowns + voice selection ──
class Speaker {
  private lastBy = new Map<string, number>();
  private currentText = '';
  private setLine: (s: string) => void;
  private muted = false;

  constructor(setLine: (s: string) => void) {
    this.setLine = setLine;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.cancel();
  }

  cancel() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.setLine('');
    this.currentText = '';
  }

  speak(text: string, category: string, cooldownMs = 3500) {
    if (this.muted || typeof window === 'undefined') return;
    const last = this.lastBy.get(category) ?? 0;
    if (Date.now() - last < cooldownMs) return;
    this.lastBy.set(category, Date.now());

    this.currentText = text;
    this.setLine(text);

    if (!window.speechSynthesis) {
      // No TTS — keep the bubble up for a few seconds
      const captured = text;
      setTimeout(() => {
        if (this.currentText === captured) this.setLine('');
      }, 3500);
      return;
    }

    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.86;
    utt.pitch = 0.98;
    utt.volume = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /samantha|allison|ava|jenny|aria|google uk english female|google us english/i.test(v.name)) ??
      voices.find(v => v.lang?.startsWith('en') && v.localService) ??
      voices.find(v => v.lang?.startsWith('en')) ??
      voices[0];
    if (preferred) utt.voice = preferred;

    const captured = text;
    utt.onend = () => {
      if (this.currentText === captured) this.setLine('');
    };
    utt.onerror = utt.onend;

    window.speechSynthesis.speak(utt);
  }
}

export function VirtualPhysio({
  position = [1.8, 0, 0.3],
  muted = false,
}: {
  position?: [number, number, number];
  muted?: boolean;
}) {
  const bodyRef     = useRef<Group>(null);
  const mouthRef    = useRef<Mesh>(null);
  const leftArmRef  = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);

  const [speechLine, setSpeechLine] = useState('');
  const speakerRef = useRef<Speaker | null>(null);

  useEffect(() => {
    speakerRef.current = new Speaker(setSpeechLine);

    // Trigger voice list to populate (some browsers load lazily)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const handler = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', handler);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
        speakerRef.current?.cancel();
      };
    }
  }, []);

  useEffect(() => {
    speakerRef.current?.setMuted(muted);
  }, [muted]);

  // ── Subscribe to game state and drive dialogue ──
  const state             = useGameStore(s => s.state);
  const countdownSeconds  = useGameStore(s => s.countdownSeconds);
  const successCount      = useGameStore(s => s.successCount);
  const missCount         = useGameStore(s => s.missCount);

  const successPrev = useRef(0);
  const missPrev    = useRef(0);

  // Countdown / start
  useEffect(() => {
    if (state === 'countdown' && countdownSeconds === 3) {
      speakerRef.current?.speak(pickRandom(LINES.countdown), 'countdown', 30000);
    } else if (state === 'countdown' && countdownSeconds === 0) {
      // Pause briefly so countdown numbers can finish, then deliver the go line
      setTimeout(() => {
        speakerRef.current?.speak(pickRandom(LINES.go), 'go', 30000);
      }, 700);
    } else if (state === 'round-end') {
      speakerRef.current?.speak(pickRandom(LINES.roundEnd), 'roundEnd', 60000);
    }
  }, [state, countdownSeconds]);

  // Hit reactions
  useEffect(() => {
    if (successCount > successPrev.current) {
      successPrev.current = successCount;
      speakerRef.current?.speak(pickRandom(LINES.hit), 'hit', 3500);
    }
  }, [successCount]);

  // Miss reactions
  useEffect(() => {
    if (missCount > missPrev.current) {
      missPrev.current = missCount;
      speakerRef.current?.speak(pickRandom(LINES.miss), 'miss', 4000);
    }
  }, [missCount]);

  // ── Idle animation + lip-sync ──
  useFrame((s) => {
    const t = s.clock.elapsedTime;

    if (bodyRef.current) {
      bodyRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.03;
      bodyRef.current.rotation.y = Math.PI + 0.45;     // face the patient (camera direction)
      bodyRef.current.rotation.z = Math.sin(t * 0.5) * 0.015;
    }

    if (mouthRef.current) {
      if (speechLine) {
        // Animate mouth open/close while speaking; pitch slightly with sin
        const open = (Math.sin(t * 14) + 1) * 0.5;
        mouthRef.current.scale.set(1, 0.3 + open * 1.4, 1);
      } else {
        mouthRef.current.scale.lerp(new THREE.Vector3(1, 0.3, 1), 0.2);
      }
    }

    // Gentle hand gestures while speaking
    if (leftArmRef.current && rightArmRef.current) {
      if (speechLine) {
        leftArmRef.current.rotation.z  = 0.2 + Math.sin(t * 2.0) * 0.08;
        rightArmRef.current.rotation.z = -0.2 - Math.sin(t * 2.0 + Math.PI) * 0.08;
      } else {
        leftArmRef.current.rotation.z  = 0.2;
        rightArmRef.current.rotation.z = -0.2;
      }
    }
  });

  return (
    <group ref={bodyRef} position={position}>
      {/* Soft halo light around the physio */}
      <pointLight position={[0, 1.7, 0]} intensity={0.35} color="#a4d8e0" distance={3} />

      {/* Outer kimono body */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.42, 0.62, 1.45, 14, 1, false]} />
        <meshStandardMaterial color="#1a2840" roughness={0.85} emissive="#06101e" emissiveIntensity={0.25} />
      </mesh>

      {/* Sash / gold belt */}
      <mesh position={[0, 1.07, 0]}>
        <torusGeometry args={[0.44, 0.045, 14, 28]} />
        <meshStandardMaterial color="#d9b86e" emissive="#a07e30" emissiveIntensity={0.4} metalness={0.4} roughness={0.45} />
      </mesh>

      {/* Inner collar — slightly different tone */}
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.20, 0.40, 0.42, 14]} />
        <meshStandardMaterial color="#0c1a28" roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color="#e8d4b8" roughness={0.55} />
      </mesh>

      {/* Hair (simple cap) */}
      <mesh position={[0, 1.86, -0.02]}>
        <sphereGeometry args={[0.17, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#1a1208" roughness={0.85} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.052, 1.80, 0.14]}>
        <sphereGeometry args={[0.013, 12, 12]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0.052, 1.80, 0.14]}>
        <sphereGeometry args={[0.013, 12, 12]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      {/* Mouth — scales vertically while speaking for lip-sync */}
      <mesh ref={mouthRef} position={[0, 1.715, 0.145]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial color="#5a1a1a" />
      </mesh>

      {/* Arms (groups so we can animate rotation) */}
      <group ref={leftArmRef} position={[-0.40, 1.20, 0]}>
        <mesh position={[0, -0.30, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.65, 10]} />
          <meshStandardMaterial color="#1a2840" roughness={0.85} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.66, 0]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshStandardMaterial color="#e8d4b8" roughness={0.55} />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.40, 1.20, 0]}>
        <mesh position={[0, -0.30, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.65, 10]} />
          <meshStandardMaterial color="#1a2840" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.66, 0]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshStandardMaterial color="#e8d4b8" roughness={0.55} />
        </mesh>
      </group>

      {/* Subtle floor halo */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.85, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Speech bubble — always faces the camera via Billboard */}
      {speechLine && (
        <Billboard position={[0, 2.42, 0]}>
          <mesh position={[0, 0, -0.005]}>
            <planeGeometry args={[1.8, 0.45]} />
            <meshBasicMaterial color="#0a0d20" transparent opacity={0.88} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, -0.004]}>
            <planeGeometry args={[1.82, 0.47]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} depthWrite={false} />
          </mesh>
          <Text
            fontSize={0.085}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={1.7}
            outlineWidth={0.005}
            outlineColor="#000000"
          >
            {speechLine}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
