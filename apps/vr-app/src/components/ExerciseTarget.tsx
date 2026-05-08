'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Mesh } from 'three';
import { useSessionStore } from '@/store/sessionStore';
import { useSocketContext } from './SocketProvider';

const REACH_DISTANCE = 0.14; // metres — hand must be this close to trigger

const _handPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();

interface ExerciseTargetProps {
  position: [number, number, number];
  targetROM: number;
}

export function ExerciseTarget({ position, targetROM }: ExerciseTargetProps) {
  const meshRef = useRef<Mesh>(null);
  const [reached, setReached] = useState(false);
  const handInside = useRef(false);

  const socket = useSocketContext();
  const rightHandPos = useSessionStore((s) => s.rightHandPos);
  const leftHandPos = useSessionStore((s) => s.leftHandPos);
  const currentROM = useSessionStore((s) => s.currentROM);
  const incrementRep = useSessionStore((s) => s.incrementRep);
  const patientId = useSessionStore((s) => s.patientId);
  const session = useSessionStore((s) => s.session);

  useFrame(() => {
    if (!meshRef.current) return;

    // Animate scale on reach
    const targetScale = reached ? 1.4 : 1.0;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.2,
    );

    // Proximity check — either hand can trigger
    _targetPos.set(...position);
    let nearestDist = Infinity;

    for (const hp of [rightHandPos, leftHandPos]) {
      if (!hp) continue;
      _handPos.set(hp.x, hp.y, hp.z);
      nearestDist = Math.min(nearestDist, _handPos.distanceTo(_targetPos));
    }

    const inside = nearestDist < REACH_DISTANCE;

    if (inside && !handInside.current) {
      handInside.current = true;
      if (!reached && currentROM >= targetROM * 0.8) {
        setReached(true);
        incrementRep(currentROM);

        // Notify server for XP + achievement calculation
        if (socket && session && patientId) {
          const newRepCount = useSessionStore.getState().currentRep;
          socket.emit('session:rep_complete', {
            sessionId: session.id,
            patientId,
            repCount: newRepCount,
            rom: currentROM,
          });
        }

        setTimeout(() => setReached(false), 900);
      }
    } else if (!inside) {
      handInside.current = false;
    }
  });

  const reachPct = Math.min(1, currentROM / targetROM);
  // Colour shifts from red → yellow → green as ROM approaches target
  const color = reached
    ? '#00ff88'
    : `hsl(${Math.round(reachPct * 120)}, 90%, 55%)`;

  return (
    <group position={position}>
      {/* Outer guide ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[REACH_DISTANCE * 0.9, REACH_DISTANCE, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      <Sphere ref={meshRef} args={[0.06, 20, 20]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={reached ? 1.2 : 0.4}
        />
      </Sphere>

      <Text position={[0, 0.13, 0]} fontSize={0.035} color="white" anchorX="center">
        {`${targetROM}°`}
      </Text>
    </group>
  );
}
