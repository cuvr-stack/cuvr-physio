'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { useSessionStore } from '@/store/sessionStore';
import type { GameTarget, GameMode } from '@/store/gameStore';

const REACH_DISTANCE = 0.18;     // metres — generous tolerance for hand-tracking jitter
const GROUND_Y = 0.55;            // cosmic-catch: target is "missed" once it falls below this
const SHIELD_BREACH = 0.45;       // galactic-shield: target reached the cockpit (miss)

// ── Per-mode colour palette ──────────────────────────────────────────────────
const PALETTE: Record<GameMode, Record<GameTarget['status'], string>> = {
  cascade: {
    pending: '#1f2540',
    active:  '#ff3aa0',
    hit:     '#10b981',
    missed:  '#ef4444',
  },
  'cosmic-catch': {
    pending: '#1a2240',
    active:  '#7dd3fc',           // cyan — falling stars
    hit:     '#fbbf24',           // gold sparkle
    missed:  '#475569',           // slate — fades out
  },
  boxing: {
    pending: '#202238',
    active:  '#ff3aa0',           // overridden per-hand below
    hit:     '#10b981',
    missed:  '#ef4444',
  },
  archer: {
    pending: '#1f2540',
    active:  '#fbbf24',
    hit:     '#10b981',
    missed:  '#ef4444',
  },
  'galactic-shield': {
    pending: '#1f2540',
    active:  '#ff6b35',           // hot orange — incoming threat
    hit:     '#06b6d4',           // cyan — shield deflected
    missed:  '#ef4444',           // red — bolt got through
  },
  'knee-flexion': {
    pending: '#1f2a3a',
    active:  '#22d3ee',           // bright teal — calm aquatic feel
    hit:     '#10b981',
    missed:  '#ef4444',
  },
  'hip-abduction': {
    pending: '#1f2a3a',
    active:  '#22d3ee',
    hit:     '#10b981',
    missed:  '#ef4444',
  },
};

// Hand-specific accents for boxing
const BOXING_HAND_COLOR: Record<'left' | 'right' | 'either', string> = {
  left:   '#ef4444',              // red glove
  right:  '#3b82f6',              // blue glove
  either: '#a855f7',
};

const _handPos   = new THREE.Vector3();
const _targetPos = new THREE.Vector3();

export function TargetNode({
  target,
  mode,
  onHit,
  onMiss,
}: {
  target: GameTarget;
  mode: GameMode;
  onHit:  (id: number, responseMs: number) => void;
  onMiss?: (id: number) => void;     // fired when a falling target hits the ground
}) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const handInside = useRef(false);
  const yPosRef = useRef<number>(target.position[1]);
  const missedFiredRef = useRef(false);

  const rightHandPos = useSessionStore((s) => s.rightHandPos);
  const leftHandPos  = useSessionStore((s) => s.leftHandPos);

  useFrame((state, delta) => {
    if (!meshRef.current || !groupRef.current) return;

    const t = state.clock.elapsedTime;

    // ── Visual state ────────────────────────────────────────────────
    if (target.status === 'active') {
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      meshRef.current.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.3);
      if (haloRef.current) {
        const haloPulse = 1.5 + Math.sin(t * 3) * 0.4;
        haloRef.current.scale.set(haloPulse, haloPulse, haloPulse);
        const m = haloRef.current.material as THREE.MeshBasicMaterial;
        m.opacity = 0.18 + Math.sin(t * 3) * 0.08;
      }
    } else if (target.status === 'hit' || target.status === 'missed') {
      meshRef.current.scale.lerp(new THREE.Vector3(0.001, 0.001, 0.001), 0.18);
    } else {
      meshRef.current.scale.lerp(new THREE.Vector3(0.55, 0.55, 0.55), 0.2);
    }

    // ── Cosmic-catch falling motion ─────────────────────────────────
    if (mode === 'cosmic-catch' && target.status === 'active') {
      yPosRef.current -= (target.fallSpeed ?? 0.8) * delta;
      groupRef.current.position.y = yPosRef.current;

      if (yPosRef.current <= GROUND_Y && !missedFiredRef.current && onMiss) {
        missedFiredRef.current = true;
        onMiss(target.id);
        return;
      }
    }

    // ── Galactic-shield: full-3D velocity-driven motion ────────────
    if (mode === 'galactic-shield' && target.status === 'active' && target.velocity) {
      groupRef.current.position.x += target.velocity[0] * delta;
      groupRef.current.position.y += target.velocity[1] * delta;
      groupRef.current.position.z += target.velocity[2] * delta;

      // Distance to the cockpit centre (player chest)
      const dx = groupRef.current.position.x - 0;
      const dy = groupRef.current.position.y - 1.5;
      const dz = groupRef.current.position.z - 0;
      const distToCockpit = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distToCockpit < SHIELD_BREACH && !missedFiredRef.current && onMiss) {
        missedFiredRef.current = true;
        onMiss(target.id);
        return;
      }
    }

    // ── Hit detection (only while active) ───────────────────────────
    if (target.status !== 'active') return;

    // Use the live group position for hit checks (cosmic-catch updates it; others static)
    _targetPos.copy(groupRef.current.position);

    // Restrict hand check by target.hand for boxing
    const handsToCheck: ('left' | 'right')[] =
      target.hand === 'left' ? ['left']
      : target.hand === 'right' ? ['right']
      : ['left', 'right'];

    let nearestDist = Infinity;
    for (const side of handsToCheck) {
      const hp = side === 'left' ? leftHandPos : rightHandPos;
      if (!hp) continue;
      _handPos.set(hp.x, hp.y, hp.z);
      nearestDist = Math.min(nearestDist, _handPos.distanceTo(_targetPos));
    }

    const inside = nearestDist < REACH_DISTANCE;
    if (inside && !handInside.current) {
      handInside.current = true;
      const responseMs = Date.now() - target.activatedAt;
      onHit(target.id, responseMs);
    } else if (!inside) {
      handInside.current = false;
    }
  });

  // Reset y ref each time a new active state begins
  if (target.status === 'pending' && yPosRef.current !== target.position[1]) {
    yPosRef.current = target.position[1];
    missedFiredRef.current = false;
  }

  // Pick the right colour for this mode/state
  const baseColor = PALETTE[mode][target.status];
  const isActive = target.status === 'active';
  // Boxing tints active target by hand
  const color = (mode === 'boxing' && isActive && target.hand)
    ? BOXING_HAND_COLOR[target.hand]
    : baseColor;

  return (
    <group ref={groupRef} position={target.position}>
      {/* Pulsing halo only on the active target */}
      {isActive && (
        <mesh ref={haloRef}>
          <sphereGeometry args={[0.09, 24, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}

      {/* Falling-star trail for cosmic-catch */}
      {mode === 'cosmic-catch' && isActive && (
        <mesh position={[0, 0.12, 0]}>
          <coneGeometry args={[0.04, 0.18, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}

      {/* Energy-bolt trail for galactic-shield — ring around the threat */}
      {mode === 'galactic-shield' && isActive && (
        <>
          <mesh>
            <sphereGeometry args={[0.13, 24, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
          </mesh>
        </>
      )}

      <Sphere ref={meshRef} args={[mode === 'boxing' ? 0.085 : 0.07, 24, 24]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 1.5 : 0.3}
          metalness={0.2}
          roughness={0.4}
        />
      </Sphere>
    </group>
  );
}
