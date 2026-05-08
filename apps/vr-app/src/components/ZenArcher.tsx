'use client';

/**
 * The Zen Archer — bow-and-arrow rehab game for shoulder & upper-back.
 *
 * Movement model:
 *   • One hand holds the bow grip; the other hand draws the bowstring.
 *   • A "rep" = pull the string back past the full-draw threshold, hold
 *     long enough for the arrow to nock, then release smoothly.
 *
 * Biofeedback:
 *   • While drawing, we sample HEAD position deviation from where the
 *     draw started. Deviation = compensation (leaning, shrug-up, etc.).
 *   • The arrow's colour shifts gold → orange → red as form degrades.
 *   • The bow trembles when form is poor (visual punishment for cheating).
 *   • Average form quality during the draw determines whether the release
 *     counts as a "hit" (≥0.5) or a coached "miss" (<0.5).
 *
 * Affected-side aware:
 *   • The DRAW hand is the affected side — that's the limb doing the work.
 *   • The BOW hand (the steady, unaffected side) holds the bow.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { useSessionStore } from '@/store/sessionStore';
import type { GameTarget } from '@/store/gameStore';

// ── Tunable thresholds ───────────────────────────────────────────────────────
const DRAW_FULL          = 0.45;   // metres — must reach this for a "ready" shot
const DRAW_RELEASE       = 0.15;   // metres — drop below this after Ready = release
const DRAW_MIN           = 0.06;   // metres — below this, draw is considered cancelled
const FORM_THRESHOLD     = 0.07;   // metres of head deviation = poor form
const QUALITY_HIT_GATE   = 0.55;   // average form quality required for a "hit"
const TARGET_DISTANCE    = 8;      // metres in front of the player

// ── Component ────────────────────────────────────────────────────────────────
export function ZenArcher({
  targets, activeTargetIndex, onHit, onMiss,
}: {
  targets: GameTarget[];
  activeTargetIndex: number;
  onHit:  (id: number, responseMs: number) => void;
  onMiss: (id: number) => void;
}) {
  const leftHandPos    = useSessionStore(s => s.leftHandPos);
  const rightHandPos   = useSessionStore(s => s.rightHandPos);
  const demographics   = useSessionStore(s => s.demographics);

  // Pick which hand does what. Bow = stable side, draw = doing the work.
  const isLeftAffected = demographics.affectedSide === 'left';
  const bowHandSide    = isLeftAffected ? 'right' : 'left';
  const drawHandSide   = isLeftAffected ? 'left'  : 'right';

  // ── Refs ──────────────────────────────────────────────────────────────────
  const bowGroupRef    = useRef<Group>(null);
  const arrowGroupRef  = useRef<Group>(null);
  const arrowMeshRef   = useRef<Mesh>(null);
  const drawState      = useRef({
    active: false,
    ready:  false,
    startedAt: 0,
    baseHead: new THREE.Vector3(),
    samples: [] as number[],
  });

  // ── Render-driven UI state (kept lightweight; the heavy work is in refs) ──
  const [drawDist, setDrawDist] = useState(0);
  const [formScore, setFormScore] = useState(1);
  const [hitFlash, setHitFlash] = useState<{ at: number; quality: number } | null>(null);

  const { camera } = useThree();

  useFrame(() => {
    const bowHP  = bowHandSide  === 'left' ? leftHandPos : rightHandPos;
    const drawHP = drawHandSide === 'left' ? leftHandPos : rightHandPos;

    // No hand tracking = nothing to do (e.g. desktop preview without controllers)
    if (!bowHP || !drawHP) {
      if (drawDist !== 0) setDrawDist(0);
      return;
    }

    const bowVec  = new THREE.Vector3(bowHP.x,  bowHP.y,  bowHP.z);
    const drawVec = new THREE.Vector3(drawHP.x, drawHP.y, drawHP.z);

    // ── Bow position + orientation (always points toward the target) ──
    if (bowGroupRef.current) {
      bowGroupRef.current.position.copy(bowVec);
      bowGroupRef.current.lookAt(0, 1.5, -TARGET_DISTANCE);
    }

    // ── Compute draw distance + form quality ──
    const dist = bowVec.distanceTo(drawVec);
    setDrawDist(dist);

    const ds = drawState.current;
    const headPos = camera.position;

    // Detect draw start
    if (dist > DRAW_MIN && !ds.active) {
      ds.active = true;
      ds.ready  = false;
      ds.startedAt = Date.now();
      ds.baseHead.copy(headPos);
      ds.samples = [];
    }

    if (ds.active) {
      // Sample form quality every frame
      const dx = Math.abs(headPos.x - ds.baseHead.x);
      const dy = Math.abs(headPos.y - ds.baseHead.y);
      const dz = Math.abs(headPos.z - ds.baseHead.z);
      const maxDev = Math.max(dx, dy, dz);
      const sample = Math.max(0, Math.min(1, 1 - maxDev / FORM_THRESHOLD));
      ds.samples.push(sample);
      // Bias the displayed score toward recent samples so feedback is responsive
      const recent = ds.samples.slice(-12);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      setFormScore(avg);

      if (dist >= DRAW_FULL) ds.ready = true;

      // ── Release detection ──
      if (ds.ready && dist < DRAW_RELEASE) {
        const responseMs = Date.now() - ds.startedAt;
        const finalQuality =
          ds.samples.reduce((a, b) => a + b, 0) / Math.max(1, ds.samples.length);
        const t = targets[activeTargetIndex];

        if (t && t.status === 'active') {
          if (finalQuality >= QUALITY_HIT_GATE) {
            onHit(t.id, responseMs);
            setHitFlash({ at: Date.now(), quality: finalQuality });
          } else {
            onMiss(t.id);
            setHitFlash({ at: Date.now(), quality: finalQuality });
          }
        }

        ds.active = false;
        ds.ready  = false;
        ds.samples = [];
      }

      // Cancel the draw if patient lets go without reaching full draw
      if (!ds.ready && dist < DRAW_MIN) {
        ds.active = false;
        ds.samples = [];
      }
    }

    // ── Bow trembling when form is bad ──
    if (bowGroupRef.current && ds.active) {
      const tremble = (1 - formScore) * 0.04;
      bowGroupRef.current.rotation.x += (Math.random() - 0.5) * tremble;
      bowGroupRef.current.rotation.z += (Math.random() - 0.5) * tremble;
    }
  });

  // Decay the hit flash after 1s
  useEffect(() => {
    if (!hitFlash) return;
    const t = setTimeout(() => setHitFlash(null), 1000);
    return () => clearTimeout(t);
  }, [hitFlash]);

  // ── Colours derived from form quality ──
  const arrowColor =
    formScore >= 0.75 ? '#fbbf24'      // gold — perfect form
    : formScore >= 0.45 ? '#f97316'    // orange — slipping
    :                     '#ef4444';   // red — poor form

  const arrowGlowIntensity = formScore >= 0.75 ? 1.4 : 0.4;

  // Compute mid-point + length for the arrow visual, between bow + draw hands
  let arrowProps: { position: [number, number, number]; rotation: [number, number, number]; length: number } | null = null;
  if (drawDist > DRAW_MIN) {
    const bow  = bowHandSide  === 'left' ? leftHandPos : rightHandPos;
    const draw = drawHandSide === 'left' ? leftHandPos : rightHandPos;
    if (bow && draw) {
      const bowV = new THREE.Vector3(bow.x, bow.y, bow.z);
      const drV  = new THREE.Vector3(draw.x, draw.y, draw.z);
      const mid  = bowV.clone().add(drV).multiplyScalar(0.5);
      const dir  = drV.clone().sub(bowV).normalize();
      // Convert direction to euler — arrow length axis is Y in Cylinder primitive
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const eul  = new THREE.Euler().setFromQuaternion(quat);
      const len  = Math.max(0.4, drawDist * 1.6);  // slight visual stretch
      arrowProps = {
        position: [mid.x, mid.y, mid.z],
        rotation: [eul.x, eul.y, eul.z],
        length: len,
      };
    }
  }

  return (
    <group>
      {/* ── Mountain backdrop ───────────────────────────────────────── */}
      <Mountains />

      {/* ── Distant archery target ──────────────────────────────────── */}
      <ArcheryTarget
        position={[0, 1.5, -TARGET_DISTANCE]}
        flash={hitFlash}
      />

      {/* ── Bow ────────────────────────────────────────────────────── */}
      <group ref={bowGroupRef}>
        {/* Upper limb */}
        <mesh position={[0, 0.18, 0]} rotation={[0, 0, -0.32]}>
          <cylinderGeometry args={[0.008, 0.012, 0.42, 8]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.6} />
        </mesh>
        {/* Lower limb */}
        <mesh position={[0, -0.18, 0]} rotation={[0, 0, 0.32]}>
          <cylinderGeometry args={[0.012, 0.008, 0.42, 8]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.6} />
        </mesh>
        {/* Grip */}
        <mesh>
          <cylinderGeometry args={[0.018, 0.018, 0.14, 12]} />
          <meshStandardMaterial color="#3a1f0a" roughness={0.5} />
        </mesh>
      </group>

      {/* ── Bowstring ───────────────────────────────────────────────── */}
      {drawDist > 0.02 && (
        <BowString
          bowSide={bowHandSide}
          drawSide={drawHandSide}
          leftHandPos={leftHandPos}
          rightHandPos={rightHandPos}
          drawing={drawDist > DRAW_MIN}
        />
      )}

      {/* ── Arrow ──────────────────────────────────────────────────── */}
      {arrowProps && (
        <group ref={arrowGroupRef} position={arrowProps.position} rotation={arrowProps.rotation}>
          {/* Shaft */}
          <mesh ref={arrowMeshRef}>
            <cylinderGeometry args={[0.006, 0.006, arrowProps.length, 8]} />
            <meshStandardMaterial
              color={arrowColor}
              emissive={arrowColor}
              emissiveIntensity={arrowGlowIntensity}
              metalness={0.3}
              roughness={0.4}
            />
          </mesh>
          {/* Tip */}
          <mesh position={[0, arrowProps.length / 2 + 0.03, 0]}>
            <coneGeometry args={[0.012, 0.06, 8]} />
            <meshStandardMaterial
              color={arrowColor}
              emissive={arrowColor}
              emissiveIntensity={arrowGlowIntensity}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
          {/* Fletching */}
          <mesh position={[0, -arrowProps.length / 2 + 0.04, 0]}>
            <coneGeometry args={[0.025, 0.07, 4]} />
            <meshStandardMaterial color="#dddddd" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* ── Form quality bar (head-locked, above bow direction) ──── */}
      {drawState.current.active && drawDist > DRAW_MIN && (
        <FormBar score={formScore} drawn={Math.min(1, drawDist / DRAW_FULL)} />
      )}
    </group>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Mountains() {
  // 5 distant peaks, varying heights, behind the target
  const peaks = [
    { x: -10, y: 2.6, h: 5,   r: 3.5 },
    { x:  -5, y: 2.0, h: 4,   r: 3.0 },
    { x:   0, y: 3.2, h: 6.4, r: 4.0 },
    { x:   6, y: 2.4, h: 4.8, r: 3.5 },
    { x:  11, y: 2.0, h: 4,   r: 3.0 },
  ];
  return (
    <group position={[0, 0, -22]}>
      {peaks.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, 0]}>
          <coneGeometry args={[p.r, p.h, 6]} />
          <meshStandardMaterial color="#4a5a6a" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function ArcheryTarget({
  position,
  flash,
}: {
  position: [number, number, number];
  flash: { at: number; quality: number } | null;
}) {
  // Concentric circles in classic archery colours
  const ringRadii = [0.6, 0.48, 0.36, 0.24, 0.12];
  const ringColors = ['#ffffff', '#1a1a1a', '#3b82f6', '#ef4444', '#fbbf24'];

  return (
    <group position={position}>
      {/* Wooden stand pole */}
      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.5, 8]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.7} />
      </mesh>

      {/* Target rings (back-most first) */}
      {ringRadii.map((r, i) => (
        <mesh key={i} position={[0, 0, i * 0.001]}>
          <circleGeometry args={[r, 48]} />
          <meshStandardMaterial color={ringColors[i]} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Hit flash — text + halo */}
      {flash && (
        <group position={[0, 0.85, 0.05]}>
          <Text
            fontSize={0.18}
            color={flash.quality >= QUALITY_HIT_GATE ? '#fbbf24' : '#ef4444'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#000"
          >
            {flash.quality >= 0.85 ? 'BULLSEYE!'
             : flash.quality >= QUALITY_HIT_GATE ? 'GOOD FORM'
             : 'CHECK YOUR POSTURE'}
          </Text>
        </group>
      )}
    </group>
  );
}

function BowString({
  bowSide, drawSide, leftHandPos, rightHandPos, drawing,
}: {
  bowSide: 'left' | 'right';
  drawSide: 'left' | 'right';
  leftHandPos: { x: number; y: number; z: number } | null;
  rightHandPos: { x: number; y: number; z: number } | null;
  drawing: boolean;
}) {
  // Render two thin cylinders forming a V from the two bow tips to the draw point.
  const lineRef = useRef<Group>(null);
  const bow = bowSide === 'left' ? leftHandPos : rightHandPos;
  const draw = drawSide === 'left' ? leftHandPos : rightHandPos;
  if (!bow || !draw) return null;

  const bowV  = new THREE.Vector3(bow.x, bow.y, bow.z);
  const drawV = new THREE.Vector3(draw.x, draw.y, draw.z);

  // Approximated bow tips: 0.2m up and 0.2m down from grip, in the bow's local frame
  // For simplicity we'll just place tips along Y
  const upperTip = new THREE.Vector3(bowV.x, bowV.y + 0.2, bowV.z);
  const lowerTip = new THREE.Vector3(bowV.x, bowV.y - 0.2, bowV.z);

  return (
    <group ref={lineRef}>
      <Strand from={upperTip} to={drawV} thickness={drawing ? 0.004 : 0.002} />
      <Strand from={lowerTip} to={drawV} thickness={drawing ? 0.004 : 0.002} />
    </group>
  );
}

function Strand({ from, to, thickness }: { from: THREE.Vector3; to: THREE.Vector3; thickness: number }) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from);
  const len = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const eul = new THREE.Euler().setFromQuaternion(quat);
  return (
    <mesh position={[mid.x, mid.y, mid.z]} rotation={[eul.x, eul.y, eul.z]}>
      <cylinderGeometry args={[thickness, thickness, len, 6]} />
      <meshStandardMaterial color="#222" emissive="#666" emissiveIntensity={0.2} />
    </mesh>
  );
}

/** Floating bar showing live form quality during the draw. */
function FormBar({ score, drawn }: { score: number; drawn: number }) {
  const color = score >= 0.75 ? '#fbbf24' : score >= 0.45 ? '#f97316' : '#ef4444';
  const fillWidth = 0.6 * score;
  const drawWidth = 0.6 * drawn;
  return (
    <group position={[0, 2.05, -1]}>
      {/* Form quality bar */}
      <mesh position={[-0.3 + fillWidth / 2, 0.05, 0]}>
        <planeGeometry args={[fillWidth || 0.001, 0.03]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.05, -0.001]}>
        <planeGeometry args={[0.62, 0.05]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} />
      </mesh>
      <Text position={[0, 0.11, 0]} fontSize={0.045} color={color} anchorX="center" anchorY="middle">
        FORM
      </Text>

      {/* Draw progress bar */}
      <mesh position={[-0.3 + drawWidth / 2, -0.05, 0]}>
        <planeGeometry args={[drawWidth || 0.001, 0.03]} />
        <meshBasicMaterial color="#06b6d4" />
      </mesh>
      <mesh position={[0, -0.05, -0.001]}>
        <planeGeometry args={[0.62, 0.05]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} />
      </mesh>
      <Text position={[0, -0.11, 0]} fontSize={0.04} color="#06b6d4" anchorX="center" anchorY="middle">
        DRAW
      </Text>
    </group>
  );
}
