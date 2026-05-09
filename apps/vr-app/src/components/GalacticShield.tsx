'use client';

/**
 * Galactic Shield — cockpit-feel scenery + per-hand shield biofeedback.
 *
 * The actual incoming bolts are rendered via the standard TargetNode loop
 * (with `mode='galactic-shield'`); this component adds:
 *   • A starfield backdrop so the scene feels like deep space.
 *   • A pair of `<HandShield>` discs — one per tracked hand — that pulse
 *     and brighten based on the patient's reach velocity and ROM. Faster
 *     reach = larger/brighter shield ring (the visual reward for the
 *     core movement we're training).
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh } from 'three';
import { useSessionStore } from '@/store/sessionStore';

const STAR_COUNT = 240;
const STAR_RADIUS = 18;

export function GalacticShield() {
  return (
    <group>
      <Starfield />
      <HandShield side="left"  />
      <HandShield side="right" />
    </group>
  );
}

// ─── Starfield ──────────────────────────────────────────────────────────────
function Starfield() {
  // Generate once, never re-randomise on re-render
  const positions = useMemo(() => {
    const arr = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Sample direction from a unit sphere
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const x = r * Math.cos(t);
      const y = u;
      const z = r * Math.sin(t);
      // Place at random distance within outer shell
      const dist = STAR_RADIUS + Math.random() * 6;
      arr[i * 3 + 0] = x * dist;
      arr[i * 3 + 1] = y * dist + 1.5;          // shift up so player is centred
      arr[i * 3 + 2] = z * dist;
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={STAR_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.18}
        color="#ffffff"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── HandShield ─────────────────────────────────────────────────────────────
/**
 * Renders a glowing ring centred on a given hand. The ring's:
 *   • SCALE pulses with the hand's instantaneous velocity
 *   • OPACITY/EMISSIVE intensity grows with the hand's reach distance
 *     from the player's chest (more ROM = brighter shield)
 *
 * The shield orients to face the cockpit centre so it visually "blocks"
 * incoming bolts.
 */
function HandShield({ side }: { side: 'left' | 'right' }) {
  const handPos = useSessionStore(s =>
    side === 'left' ? s.leftHandPos : s.rightHandPos,
  );

  const ringRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);

  // Sample the previous frame's position to derive velocity
  const prevPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const prevTime = useRef<number>(0);
  const smoothedVel = useRef<number>(0);

  useFrame((state) => {
    if (!ringRef.current || !innerRef.current || !handPos) {
      // Hide the shield when the hand isn't tracked
      if (ringRef.current)  ringRef.current.scale.setScalar(0.001);
      if (innerRef.current) innerRef.current.scale.setScalar(0.001);
      return;
    }

    const now = state.clock.elapsedTime;
    const cur = new THREE.Vector3(handPos.x, handPos.y, handPos.z);

    // Compute instantaneous velocity (m/s), smoothed for visual stability
    if (prevTime.current > 0) {
      const dt = Math.max(0.001, now - prevTime.current);
      const inst = cur.clone().sub(prevPos.current).length() / dt;
      smoothedVel.current = smoothedVel.current * 0.7 + inst * 0.3;
    }
    prevPos.current.copy(cur);
    prevTime.current = now;

    // Reach distance from cockpit chest centre (0, 1.5, 0)
    const reach = Math.hypot(cur.x, cur.y - 1.5, cur.z);

    // Map velocity → scale (clamped)
    const v = Math.min(1.6, smoothedVel.current);
    const scale = 0.4 + v * 0.6;

    // Map reach → opacity (the further the brighter)
    const reachMapped = Math.min(1, Math.max(0, (reach - 0.25) / 0.7));
    const opacity = 0.15 + reachMapped * 0.55;

    // Position + face the cockpit centre so the ring "guards" the body
    ringRef.current.position.copy(cur);
    innerRef.current.position.copy(cur);
    ringRef.current.lookAt(0, 1.5, 0);
    innerRef.current.lookAt(0, 1.5, 0);

    ringRef.current.scale.setScalar(scale);
    innerRef.current.scale.setScalar(scale * 0.7);

    // Pulse breathing animation on top of velocity-driven scale
    const pulse = 1 + Math.sin(now * 4) * 0.06;
    ringRef.current.scale.multiplyScalar(pulse);

    // Update materials
    const ringMat  = ringRef.current.material as THREE.MeshBasicMaterial;
    const innerMat = innerRef.current.material as THREE.MeshBasicMaterial;
    ringMat.opacity  = opacity;
    innerMat.opacity = opacity * 0.6;
    // Tint shifts blue → cyan as reach increases
    const colour = new THREE.Color().setHSL(0.55 - reachMapped * 0.07, 1, 0.5 + reachMapped * 0.15);
    ringMat.color.copy(colour);
    innerMat.color.copy(colour);
    ringMat.needsUpdate = true;
    innerMat.needsUpdate = true;
  });

  return (
    <group>
      {/* Outer ring — torus aligned to face the cockpit */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.18, 0.012, 12, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* Inner translucent disc */}
      <mesh ref={innerRef}>
        <circleGeometry args={[0.18, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
