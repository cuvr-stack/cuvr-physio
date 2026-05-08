'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSessionStore } from '@/store/sessionStore';

const PARTICLE_COUNT = 20;
const LIFETIME = 0.8; // seconds

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number; // 1 → 0
}

function spawnParticles(origin: THREE.Vector3): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5,
      (Math.random() - 0.5) * 2,
    ).normalize().multiplyScalar(0.8 + Math.random() * 1.2);

    return {
      position: origin.clone(),
      velocity: dir,
      life: 1,
    };
  });
}

export function RepParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<Particle[]>([]);
  const prevRep = useRef(0);

  const currentRep = useSessionStore((s) => s.currentRep);
  const rightHandPos = useSessionStore((s) => s.rightHandPos);

  // Spawn on new rep
  useEffect(() => {
    if (currentRep > prevRep.current && rightHandPos) {
      const origin = new THREE.Vector3(rightHandPos.x, rightHandPos.y, rightHandPos.z);
      particles.current = [...particles.current, ...spawnParticles(origin)];
    }
    prevRep.current = currentRep;
  }, [currentRep, rightHandPos]);

  const _matrix = new THREE.Matrix4();
  const _color = new THREE.Color();

  useFrame((_state, delta) => {
    if (!meshRef.current || particles.current.length === 0) return;

    // Age and move particles
    particles.current = particles.current
      .map((p) => {
        p.life -= delta / LIFETIME;
        p.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= 2.5 * delta; // gravity
        return p;
      })
      .filter((p) => p.life > 0);

    // Update instanced mesh
    const count = particles.current.length;
    meshRef.current.count = count;

    for (let i = 0; i < count; i++) {
      const p = particles.current[i];
      const scale = p.life * 0.04;
      _matrix.makeScale(scale, scale, scale);
      _matrix.setPosition(p.position);
      meshRef.current.setMatrixAt(i, _matrix);

      // Colour: gold → orange → fade
      _color.setHSL(0.12 - (1 - p.life) * 0.08, 1, 0.5 + p.life * 0.2);
      meshRef.current.setColorAt(i, _color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT * 5]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial vertexColors emissive="#ffaa00" emissiveIntensity={0.6} />
    </instancedMesh>
  );
}
