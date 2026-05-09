'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useXRInputSourceState } from '@react-three/xr';
import { useSessionStore } from '@/store/sessionStore';
import { useHandTracking } from '@/hooks/useHandTracking';

// ─── ROM arc drawn in the sagittal plane around the shoulder ─────────────────

function buildArcGeometry(angleDeg: number, radius = 0.3, segments = 32): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const rad = (angleDeg * Math.PI) / 180;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * rad;
    // Arc starts at neutral (arm down = -Y) and sweeps forward (+Z)
    points.push(new THREE.Vector3(0, -Math.cos(t) * radius, Math.sin(t) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

interface ROMarcProps {
  shoulder: THREE.Vector3;
  rom: number;
}

function ROMArc({ shoulder, rom }: ROMarcProps) {
  const geometry = useMemo(() => buildArcGeometry(rom), [rom]);

  return (
    // @ts-expect-error — JSX <line> collides with SVG lineElement; this is the R3F three.js Line
    <line position={shoulder}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#00ccff" linewidth={2} transparent opacity={0.7} />
    </line>
  );
}

// ─── Wrist indicator sphere ───────────────────────────────────────────────────

interface WristSphereProps {
  side: 'left' | 'right';
}

function WristSphere({ side }: WristSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const handState = useXRInputSourceState('hand', side);
  const controllerState = useXRInputSourceState('controller', side);

  useFrame(() => {
    const obj = handState?.object ?? controllerState?.object ?? null;
    if (!obj || !meshRef.current) return;
    obj.getWorldPosition(meshRef.current.position);
  });

  const color = side === 'right' ? '#4488ff' : '#ff8844';

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.025, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.85} />
    </mesh>
  );
}

// ─── ROM label + arc anchored to estimated shoulder ──────────────────────────

function ROMOverlay() {
  const { camera } = useThree();
  const currentROM = useSessionStore((s) => s.currentROM);
  const rightHandPos = useSessionStore((s) => s.rightHandPos);

  const shoulder = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    // Mirror the shoulder estimate from useHandTracking
    shoulder.set(camera.position.x + 0.2, camera.position.y - 0.25, camera.position.z);
  });

  if (!rightHandPos || currentROM === 0) return null;

  return (
    <group>
      <ROMArc shoulder={shoulder} rom={currentROM} />
      <Text
        position={[shoulder.x + 0.35, shoulder.y + 0.05, shoulder.z]}
        fontSize={0.04}
        color="#00ccff"
        anchorX="left"
      >
        {`${currentROM}°`}
      </Text>
    </group>
  );
}

// ─── Public component — place this inside <XR> ───────────────────────────────

/**
 * HandVisualizer must live inside the <XR> context so that useXRInputSourceState
 * and useHandTracking can access the WebXR session.
 *
 * It renders:
 *   - Wrist spheres for both hands (works with controllers or hand tracking)
 *   - A ROM arc around the right shoulder showing current range of motion
 *   - A degree label next to the arc
 */
export function HandVisualizer() {
  // Call the tracking hook here — it lives inside <XR> context
  useHandTracking();

  return (
    <>
      <WristSphere side="right" />
      <WristSphere side="left" />
      <ROMOverlay />
    </>
  );
}
