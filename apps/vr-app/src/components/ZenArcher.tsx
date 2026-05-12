'use client';

/**
 * The Zen Archer — bow-and-arrow rehab game for shoulder & upper-back.
 *
 * Mechanic (revised — draw-and-HOLD, no release gesture required):
 *   1. Pull the draw hand back. The bowstring stretches, the arrow appears.
 *   2. Once draw distance ≥ DRAW_ENTER (~40 cm) the patient is in the
 *      "hold zone" — a teal ring at the target starts filling.
 *   3. Hold full draw for HOLD_DURATION_MS (age-tuned, ~600 ms) and the
 *      arrow auto-fires. The hold IS the isometric end-range exercise.
 *   4. Dropping below DRAW_EXIT before the hold completes cancels the rep
 *      (resets the ring) without penalty — patient just redraws.
 *
 * Why draw-and-hold instead of draw-then-release?
 *   • The end-range hold is the actual rotator-cuff training stimulus.
 *   • Reliable across hand-tracking jitter and slow-snap-back motions.
 *   • Works with keyboard fallback (Space to draw) for desktop testing.
 *
 * Biofeedback:
 *   • Head position deviation during the draw → form quality score
 *   • Arrow colour: gold (good) → orange → red (poor form)
 *   • Bow trembles when form is poor
 *   • Final form score < QUALITY_HIT_GATE = a "miss" (no XP) even if held
 *
 * Affected-side aware:
 *   • DRAW hand = affected side (does the eccentric work)
 *   • BOW hand = stable, unaffected side
 *
 * Desktop fallback:
 *   • Hold Space — simulates drawing (no Quest required to test the loop).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import { useSessionStore } from '@/store/sessionStore';
import type { GameTarget } from '@/store/gameStore';

// ── Tunable thresholds ───────────────────────────────────────────────────────
const DRAW_ENTER       = 0.40;   // metres — entering the hold zone
const DRAW_EXIT        = 0.30;   // metres — drop below this in hold = cancel
const DRAW_MIN         = 0.06;   // metres — below this = no draw at all
const FORM_THRESHOLD   = 0.07;   // metres of head deviation = poor form
const QUALITY_HIT_GATE = 0.55;
const TARGET_DISTANCE  = 8;

function holdDurationMs(age: number | null): number {
  if (age == null) return 600;
  if (age < 18) return 800;     // youth: longer hold for control
  if (age >= 75) return 450;     // elderly: shorter — fatigue
  if (age >= 65) return 550;
  return 600;
}

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

  const isLeftAffected = demographics.affectedSide === 'left';
  const bowHandSide    = isLeftAffected ? 'right' : 'left';
  const drawHandSide   = isLeftAffected ? 'left'  : 'right';

  const ageYears = demographics.dateOfBirth
    ? Math.floor((Date.now() - new Date(demographics.dateOfBirth).getTime()) / (365.25 * 86400000))
    : null;
  const holdMs = holdDurationMs(ageYears);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const bowGroupRef    = useRef<Group>(null);
  const drawState      = useRef({
    active:   false,
    startedAt: 0,
    holdingSince: null as number | null,
    baseHead: new THREE.Vector3(),
    samples:  [] as number[],
  });

  // Keyboard fallback for desktop testing
  const keyDownRef = useRef(false);
  const synthDrawRef = useRef(0);          // 0..0.55, simulated draw amount

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); keyDownRef.current = true; }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { keyDownRef.current = false; }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // ── UI state (kept lightweight — heavy work in refs) ──────────────────────
  const [drawDist, setDrawDist]         = useState(0);
  const [formScore, setFormScore]       = useState(1);
  const [holdProgress, setHoldProgress] = useState(0);
  const [hitFlash, setHitFlash]         = useState<{ at: number; quality: number } | null>(null);
  const [arrowShot, setArrowShot]       = useState<{ at: number; quality: number } | null>(null);

  const { camera } = useThree();

  useFrame((_state, delta) => {
    // ── Resolve hand positions (or synthesize from keyboard for desktop) ──
    let bowHP  = bowHandSide  === 'left' ? leftHandPos : rightHandPos;
    let drawHP = drawHandSide === 'left' ? leftHandPos : rightHandPos;

    if (!bowHP || !drawHP) {
      // Animate synthetic draw amount based on Space key
      if (keyDownRef.current) {
        synthDrawRef.current = Math.min(0.55, synthDrawRef.current + delta * 0.8);
      } else {
        synthDrawRef.current = Math.max(0, synthDrawRef.current - delta * 1.6);
      }

      // Synthesize fake hand positions in front of the camera
      const camFwd = new THREE.Vector3();
      camera.getWorldDirection(camFwd);
      const bowAt = camera.position.clone().add(camFwd.clone().multiplyScalar(0.7));
      bowAt.y -= 0.18;
      const drawAt = bowAt.clone().sub(camFwd.clone().multiplyScalar(synthDrawRef.current));

      bowHP  = { x: bowAt.x,  y: bowAt.y,  z: bowAt.z };
      drawHP = { x: drawAt.x, y: drawAt.y, z: drawAt.z };
    }

    const bowVec  = new THREE.Vector3(bowHP.x,  bowHP.y,  bowHP.z);
    const drawVec = new THREE.Vector3(drawHP.x, drawHP.y, drawHP.z);

    // ── Bow position + orientation (always faces the target) ──
    if (bowGroupRef.current) {
      bowGroupRef.current.position.copy(bowVec);
      bowGroupRef.current.lookAt(0, 1.5, -TARGET_DISTANCE);
    }

    // ── Compute draw distance + form quality ──
    const dist = bowVec.distanceTo(drawVec);
    if (Math.abs(dist - drawDist) > 0.005) setDrawDist(dist);

    const ds = drawState.current;
    const headPos = camera.position;

    // Detect draw start
    if (dist > DRAW_MIN && !ds.active) {
      ds.active = true;
      ds.startedAt = Date.now();
      ds.holdingSince = null;
      ds.baseHead.copy(headPos);
      ds.samples = [];
    }

    if (ds.active) {
      // Sample form quality each frame
      const dx = Math.abs(headPos.x - ds.baseHead.x);
      const dy = Math.abs(headPos.y - ds.baseHead.y);
      const dz = Math.abs(headPos.z - ds.baseHead.z);
      const maxDev = Math.max(dx, dy, dz);
      const sample = Math.max(0, Math.min(1, 1 - maxDev / FORM_THRESHOLD));
      ds.samples.push(sample);

      const recent = ds.samples.slice(-12);
      const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (Math.abs(avgRecent - formScore) > 0.03) setFormScore(avgRecent);

      // ── Hold-zone detection ──
      if (dist >= DRAW_ENTER) {
        if (ds.holdingSince === null) ds.holdingSince = Date.now();
        const heldFor = Date.now() - ds.holdingSince;
        const progress = Math.min(1, heldFor / holdMs);
        if (Math.abs(progress - holdProgress) > 0.02) setHoldProgress(progress);

        if (heldFor >= holdMs) {
          // ── ARROW FIRES ──
          const responseMs = Date.now() - ds.startedAt;
          const finalQuality = ds.samples.reduce((a, b) => a + b, 0) / Math.max(1, ds.samples.length);
          const t = targets[activeTargetIndex];

          if (t && t.status === 'active') {
            const isHit = finalQuality >= QUALITY_HIT_GATE;
            if (isHit) onHit(t.id, responseMs);
            else       onMiss(t.id);
            setHitFlash({ at: Date.now(), quality: finalQuality });
            setArrowShot({ at: Date.now(), quality: finalQuality });
          }

          ds.active = false;
          ds.holdingSince = null;
          ds.samples = [];
          setHoldProgress(0);
        }
      } else if (dist < DRAW_EXIT && ds.holdingSince !== null) {
        // Slipped out of the hold zone before the timer completed → cancel
        ds.holdingSince = null;
        setHoldProgress(0);
      }

      // Total cancel — patient let go entirely
      if (dist < DRAW_MIN) {
        ds.active = false;
        ds.holdingSince = null;
        ds.samples = [];
        setHoldProgress(0);
      }
    }

    // Bow trembling when form is poor (only while actively drawing)
    if (bowGroupRef.current && ds.active && dist > DRAW_MIN) {
      const tremble = (1 - formScore) * 0.04;
      bowGroupRef.current.rotation.x += (Math.random() - 0.5) * tremble;
      bowGroupRef.current.rotation.z += (Math.random() - 0.5) * tremble;
    }
  });

  // Decay flashes
  useEffect(() => {
    if (!hitFlash) return;
    const t = setTimeout(() => setHitFlash(null), 1200);
    return () => clearTimeout(t);
  }, [hitFlash]);
  useEffect(() => {
    if (!arrowShot) return;
    const t = setTimeout(() => setArrowShot(null), 700);
    return () => clearTimeout(t);
  }, [arrowShot]);

  // ── Visual colours from form quality ──
  const arrowColor =
    formScore >= 0.75 ? '#fbbf24'
    : formScore >= 0.45 ? '#f97316'
    :                     '#ef4444';
  const arrowGlowIntensity = formScore >= 0.75 ? 1.6 : 0.5;

  // Arrow shaft transform between bow + draw hands
  let arrowProps: { position: [number, number, number]; rotation: [number, number, number]; length: number } | null = null;
  if (drawDist > 0.04) {
    const bow  = bowHandSide  === 'left' ? leftHandPos : rightHandPos;
    const draw = drawHandSide === 'left' ? leftHandPos : rightHandPos;
    let bowV: THREE.Vector3, drV: THREE.Vector3;

    if (bow && draw) {
      bowV = new THREE.Vector3(bow.x, bow.y, bow.z);
      drV  = new THREE.Vector3(draw.x, draw.y, draw.z);
    } else {
      // Synthesized — recompute from camera + synth draw amount
      const camFwd = new THREE.Vector3();
      camera.getWorldDirection(camFwd);
      bowV = camera.position.clone().add(camFwd.clone().multiplyScalar(0.7));
      bowV.y -= 0.18;
      drV  = bowV.clone().sub(camFwd.clone().multiplyScalar(synthDrawRef.current));
    }

    const mid  = bowV.clone().add(drV).multiplyScalar(0.5);
    const dir  = drV.clone().sub(bowV).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const eul  = new THREE.Euler().setFromQuaternion(quat);
    const len  = Math.max(0.4, drawDist * 1.6);
    arrowProps = {
      position: [mid.x, mid.y, mid.z],
      rotation: [eul.x, eul.y, eul.z],
      length: len,
    };
  }

  return (
    <group>
      {/* ── Scene atmosphere ───────────────────────────────────────── */}
      <TwilightSky />
      <SceneLighting />
      <fog attach="fog" args={['#3a3a5e', 6, 28]} />

      {/* ── Environment ────────────────────────────────────────────── */}
      <Mountains />
      <Lake />
      <Grass />
      <CherryGrove />
      <FallingPetals />

      {/* ── Distant archery target with neon overlay ──────────────── */}
      <ArcheryTarget
        position={[0, 1.5, -TARGET_DISTANCE]}
        flash={hitFlash}
        holdProgress={holdProgress}
      />

      {/* Floating dust/firefly particles for atmosphere */}
      <AmbientMotes />

      {/* ── Bow ────────────────────────────────────────────────────── */}
      <group ref={bowGroupRef}>
        {/* Upper limb */}
        <mesh position={[0, 0.20, 0]} rotation={[0, 0, -0.30]}>
          <cylinderGeometry args={[0.008, 0.012, 0.46, 8]} />
          <meshStandardMaterial color="#6a4218" roughness={0.55} metalness={0.1} />
        </mesh>
        {/* Lower limb */}
        <mesh position={[0, -0.20, 0]} rotation={[0, 0, 0.30]}>
          <cylinderGeometry args={[0.012, 0.008, 0.46, 8]} />
          <meshStandardMaterial color="#6a4218" roughness={0.55} metalness={0.1} />
        </mesh>
        {/* Grip */}
        <mesh>
          <cylinderGeometry args={[0.022, 0.022, 0.15, 12]} />
          <meshStandardMaterial color="#3a1f0a" roughness={0.45} />
        </mesh>
        {/* Grip wrap */}
        <mesh>
          <cylinderGeometry args={[0.023, 0.023, 0.06, 12]} />
          <meshStandardMaterial color="#1f0f08" roughness={0.7} />
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
          synthBow={!leftHandPos && !rightHandPos ? (() => {
            const camFwd = new THREE.Vector3();
            camera.getWorldDirection(camFwd);
            const bowAt = camera.position.clone().add(camFwd.clone().multiplyScalar(0.7));
            bowAt.y -= 0.18;
            const drawAt = bowAt.clone().sub(camFwd.clone().multiplyScalar(synthDrawRef.current));
            return { bowAt, drawAt };
          })() : null}
        />
      )}

      {/* ── Arrow ──────────────────────────────────────────────────── */}
      {arrowProps && (
        <group position={arrowProps.position} rotation={arrowProps.rotation}>
          {/* Shaft */}
          <mesh>
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
            <meshStandardMaterial color="#f0e6d2" roughness={0.7} />
          </mesh>
          {/* Glow when in hold-zone */}
          {holdProgress > 0 && (
            <mesh>
              <cylinderGeometry args={[0.018, 0.018, arrowProps.length, 8]} />
              <meshBasicMaterial color={arrowColor} transparent opacity={0.18 + holdProgress * 0.35} />
            </mesh>
          )}
        </group>
      )}

      {/* ── Flying arrow visual on release (brief animation) ──────── */}
      {arrowShot && (
        <FlyingArrow arrowShot={arrowShot} colour={arrowColor} />
      )}

      {/* ── Form + Draw HUD ────────────────────────────────────────── */}
      {drawState.current.active && drawDist > DRAW_MIN && (
        <FormBar score={formScore} drawn={Math.min(1, drawDist / DRAW_ENTER)} hold={holdProgress} />
      )}

      {/* Desktop hint */}
      {!leftHandPos && !rightHandPos && (
        <Text
          position={[0, 0.6, -1.2]}
          fontSize={0.05}
          color="#aabbcc"
          anchorX="center"
          outlineWidth={0.005}
          outlineColor="#000"
        >
          Hold [SPACE] to draw the bow · Hold past full draw to fire
        </Text>
      )}
    </group>
  );
}

// ─── Scene atmosphere ────────────────────────────────────────────────────────

function TwilightSky() {
  // Inverted sphere with a vertical-gradient shader. Wraps the player so the
  // daytime Sky from VRScene is occluded.
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color('#1a1c3a') },     // deep twilight blue
      midColor:    { value: new THREE.Color('#5a4060') },     // warm purple
      bottomColor: { value: new THREE.Color('#d68fa8') },     // soft pink horizon
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float h = clamp(vWorld.y / 40.0 + 0.5, 0.0, 1.0);
        vec3 col = h < 0.5
          ? mix(bottomColor, midColor, h * 2.0)
          : mix(midColor, topColor, (h - 0.5) * 2.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), []);

  return (
    <mesh material={material}>
      <sphereGeometry args={[40, 32, 32]} />
    </mesh>
  );
}

function SceneLighting() {
  return (
    <>
      {/* Cool ambient — twilight feel */}
      <ambientLight intensity={0.45} color="#7a86b8" />
      {/* "Moonlight" key from upper-back */}
      <directionalLight position={[6, 12, 4]} intensity={0.65} color="#c8d0e8" castShadow={false} />
      {/* Warm fill from the pink horizon */}
      <hemisphereLight args={['#e6a0bd', '#1a1c2c', 0.55]} />
    </>
  );
}

// ─── Environment elements ───────────────────────────────────────────────────

function Mountains() {
  // Multi-layered peaks at varying distances for misty depth. Fog handles the rest.
  const layers = [
    // Far back, very desaturated
    { z: -26, peaks: [[-13, 3.5], [-6, 3.0], [0, 4.2], [7, 3.4], [14, 3.0]], colour: '#5a607a', scale: 4.5 },
    // Mid layer, slightly larger + bluer
    { z: -20, peaks: [[-9, 2.6], [-2, 3.2], [5, 2.4], [11, 2.0]],            colour: '#48526a', scale: 3.8 },
    // Near layer, darker
    { z: -15, peaks: [[-7, 1.8], [3, 2.1], [9, 1.5]],                        colour: '#384258', scale: 3.0 },
  ];
  return (
    <>
      {layers.map((layer, li) => (
        <group key={li} position={[0, 0, layer.z]}>
          {layer.peaks.map(([x, h], i) => (
            <mesh key={i} position={[x, h * 0.45, 0]}>
              <coneGeometry args={[layer.scale, h * 1.6, 6]} />
              <meshStandardMaterial color={layer.colour} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Lake() {
  // Calm reflective water plane stretching forward to the mountain base.
  // Slight metalness + low roughness gives a subtle reflective look.
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]}>
      <planeGeometry args={[40, 22]} />
      <meshStandardMaterial
        color="#2a3e4e"
        metalness={0.45}
        roughness={0.25}
        envMapIntensity={0.6}
      />
    </mesh>
  );
}

function Grass() {
  // Foreground grass plane (closer than the lake)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 1.5]}>
      <planeGeometry args={[40, 4]} />
      <meshStandardMaterial color="#2a4030" roughness={0.95} />
    </mesh>
  );
}

function CherryGrove() {
  // Six cherry blossom trees framing the scene
  const trees: { pos: [number, number, number]; scale: number }[] = [
    { pos: [-3.2,  0, -1],   scale: 1.1 },
    { pos: [-4.6,  0, -3.5], scale: 0.95 },
    { pos: [-5.8,  0,  0.8], scale: 1.2 },
    { pos: [ 3.4,  0, -1.2], scale: 1.05 },
    { pos: [ 4.8,  0, -3.8], scale: 1.0 },
    { pos: [ 5.9,  0,  0.6], scale: 1.15 },
  ];
  return (
    <>
      {trees.map((t, i) => (
        <CherryTree key={i} position={t.pos} scale={t.scale} />
      ))}
    </>
  );
}

function CherryTree({ position, scale }: { position: [number, number, number]; scale: number }) {
  // Procedural cherry tree — tapered trunk + cluster of pink blossom spheres
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.08, 0.14, 2.0, 8]} />
        <meshStandardMaterial color="#3a2a1f" roughness={0.85} />
      </mesh>
      {/* Main branches as angled cylinders */}
      <mesh position={[0.15, 1.7, 0.05]} rotation={[0.2, 0, -0.5]}>
        <cylinderGeometry args={[0.03, 0.05, 0.8, 6]} />
        <meshStandardMaterial color="#3a2a1f" roughness={0.85} />
      </mesh>
      <mesh position={[-0.12, 1.7, 0.05]} rotation={[0.1, 0, 0.5]}>
        <cylinderGeometry args={[0.03, 0.05, 0.8, 6]} />
        <meshStandardMaterial color="#3a2a1f" roughness={0.85} />
      </mesh>
      {/* Blossom clusters — multiple soft pink spheres */}
      {[
        [0, 2.4, 0],
        [0.4, 2.25, 0.1],
        [-0.4, 2.25, 0.1],
        [0.2, 2.55, -0.25],
        [-0.2, 2.55, -0.25],
        [0.55, 2.0, -0.15],
        [-0.55, 2.0, -0.15],
        [0, 2.7, 0.2],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[0.35 + (i % 3) * 0.08, 1]} />
          <meshStandardMaterial
            color="#f5b8c8"
            emissive="#c8678a"
            emissiveIntensity={0.18}
            roughness={0.95}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function FallingPetals() {
  // Particle cloud of pink petals drifting downward
  const COUNT = 80;
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 1] = 1 + Math.random() * 5;
      arr[i * 3 + 2] = -Math.random() * 8 - 1;
    }
    return arr;
  }, []);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] -= delta * (0.12 + (i % 5) * 0.03);     // gentle fall
      arr[i * 3 + 0] += Math.sin(arr[i * 3 + 1] * 1.2 + i) * delta * 0.04;  // sway
      if (arr[i * 3 + 1] < 0.05) {
        arr[i * 3 + 1] = 5 + Math.random() * 2;
        arr[i * 3 + 0] = (Math.random() - 0.5) * 14;
      }
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#fcc8d6"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function AmbientMotes() {
  // Tiny floating motes for atmosphere
  const COUNT = 50;
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = 0.6 + Math.random() * 2.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#ffffff" transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── Target ─────────────────────────────────────────────────────────────────

function ArcheryTarget({
  position, flash, holdProgress,
}: {
  position: [number, number, number];
  flash: { at: number; quality: number } | null;
  holdProgress: number;
}) {
  const ringRadii  = [0.6, 0.48, 0.36, 0.24, 0.12];
  const ringColors = ['#ffffff', '#1a1a1a', '#3b82f6', '#ef4444', '#fbbf24'];

  // Neon teal overlay rings — these are the glowing aim guides
  const neonRingRef1 = useRef<THREE.Mesh>(null);
  const neonRingRef2 = useRef<THREE.Mesh>(null);
  const crosshairRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 2) * 0.05;
    if (neonRingRef1.current) neonRingRef1.current.scale.setScalar(pulse);
    if (neonRingRef2.current) neonRingRef2.current.scale.setScalar(pulse * 1.08);
    // Crosshair rotates gently
    if (crosshairRef.current) crosshairRef.current.rotation.z = t * 0.05;
  });

  return (
    <group position={position}>
      {/* Wooden pole + base in water */}
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.3, 8]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.7} />
      </mesh>
      <mesh position={[0, -2.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.45, 24]} />
        <meshBasicMaterial color="#152230" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Target rings (classic colours, layered) */}
      {ringRadii.map((r, i) => (
        <mesh key={i} position={[0, 0, i * 0.001]}>
          <circleGeometry args={[r, 48]} />
          <meshStandardMaterial color={ringColors[i]} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Neon teal aim rings — pulse + glow */}
      <mesh ref={neonRingRef1} position={[0, 0, 0.012]}>
        <ringGeometry args={[0.46, 0.50, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={neonRingRef2} position={[0, 0, 0.011]}>
        <ringGeometry args={[0.52, 0.58, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Glowing crosshair */}
      <group ref={crosshairRef} position={[0, 0, 0.015]}>
        <mesh>
          <ringGeometry args={[0.04, 0.055, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
        {/* Crosshair tick marks */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => (
          <mesh key={i} rotation={[0, 0, rot]} position={[0.08, 0, 0]}>
            <planeGeometry args={[0.05, 0.005]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Hold-progress ring — fills as the patient holds full draw */}
      {holdProgress > 0 && (
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry
            args={[0.62, 0.66, 48, 1, -Math.PI / 2, Math.PI * 2 * holdProgress]}
          />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Hit flash */}
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

// ─── Flying arrow ────────────────────────────────────────────────────────────

function FlyingArrow({
  arrowShot, colour,
}: {
  arrowShot: { at: number; quality: number };
  colour: string;
}) {
  // Brief arrow animation from origin (bow position roughly) to the target.
  // Fully transient — gone in ~600ms.
  const groupRef = useRef<Group>(null);
  const start = new THREE.Vector3(0, 1.5, 0);
  const end   = new THREE.Vector3(0, 1.5, -TARGET_DISTANCE);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = Math.min(1, (Date.now() - arrowShot.at) / 600);
    const pos = start.clone().lerp(end, t);
    groupRef.current.position.copy(pos);
    groupRef.current.lookAt(end);
    groupRef.current.rotateX(Math.PI / 2);   // Cylinder Y -> Z alignment
    const m = (groupRef.current.children[0] as THREE.Mesh)?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = 2.2 * (1 - t);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 8]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={2.2} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <coneGeometry args={[0.022, 0.08, 8]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={2.2} />
      </mesh>
    </group>
  );
}

// ─── Bowstring ──────────────────────────────────────────────────────────────

function BowString({
  bowSide, drawSide, leftHandPos, rightHandPos, drawing, synthBow,
}: {
  bowSide: 'left' | 'right';
  drawSide: 'left' | 'right';
  leftHandPos: { x: number; y: number; z: number } | null;
  rightHandPos: { x: number; y: number; z: number } | null;
  drawing: boolean;
  synthBow: { bowAt: THREE.Vector3; drawAt: THREE.Vector3 } | null;
}) {
  const bow  = bowSide  === 'left' ? leftHandPos : rightHandPos;
  const draw = drawSide === 'left' ? leftHandPos : rightHandPos;

  let bowV: THREE.Vector3, drawV: THREE.Vector3;
  if (bow && draw) {
    bowV  = new THREE.Vector3(bow.x,  bow.y,  bow.z);
    drawV = new THREE.Vector3(draw.x, draw.y, draw.z);
  } else if (synthBow) {
    bowV  = synthBow.bowAt;
    drawV = synthBow.drawAt;
  } else {
    return null;
  }

  const upperTip = new THREE.Vector3(bowV.x, bowV.y + 0.22, bowV.z);
  const lowerTip = new THREE.Vector3(bowV.x, bowV.y - 0.22, bowV.z);

  return (
    <group>
      <Strand from={upperTip} to={drawV} thickness={drawing ? 0.0045 : 0.002} />
      <Strand from={lowerTip} to={drawV} thickness={drawing ? 0.0045 : 0.002} />
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
      <meshStandardMaterial color="#1a1a1a" emissive="#888" emissiveIntensity={0.25} />
    </mesh>
  );
}

// ─── HUD ────────────────────────────────────────────────────────────────────

function FormBar({ score, drawn, hold }: { score: number; drawn: number; hold: number }) {
  const color = score >= 0.75 ? '#fbbf24' : score >= 0.45 ? '#f97316' : '#ef4444';
  const fillWidth = 0.6 * score;
  const drawWidth = 0.6 * drawn;
  const holdWidth = 0.6 * hold;
  return (
    <group position={[0, 2.1, -1.2]}>
      {/* Form row */}
      <mesh position={[-0.3 + fillWidth / 2, 0.08, 0]}>
        <planeGeometry args={[fillWidth || 0.001, 0.03]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.08, -0.001]}>
        <planeGeometry args={[0.62, 0.05]} />
        <meshBasicMaterial color="#000" transparent opacity={0.55} />
      </mesh>
      <Text position={[0, 0.145, 0]} fontSize={0.04} color={color} anchorX="center" anchorY="middle">FORM</Text>

      {/* Draw row */}
      <mesh position={[-0.3 + drawWidth / 2, 0.00, 0]}>
        <planeGeometry args={[drawWidth || 0.001, 0.03]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
      <mesh position={[0, 0.00, -0.001]}>
        <planeGeometry args={[0.62, 0.05]} />
        <meshBasicMaterial color="#000" transparent opacity={0.55} />
      </mesh>
      <Text position={[0, 0.065, 0]} fontSize={0.04} color="#22d3ee" anchorX="center" anchorY="middle">DRAW</Text>

      {/* Hold row (only renders when actually holding) */}
      <mesh position={[-0.3 + holdWidth / 2, -0.08, 0]}>
        <planeGeometry args={[holdWidth || 0.001, 0.03]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[0, -0.08, -0.001]}>
        <planeGeometry args={[0.62, 0.05]} />
        <meshBasicMaterial color="#000" transparent opacity={0.55} />
      </mesh>
      <Text position={[0, -0.015, 0]} fontSize={0.04} color="#fbbf24" anchorX="center" anchorY="middle">HOLD</Text>
    </group>
  );
}
