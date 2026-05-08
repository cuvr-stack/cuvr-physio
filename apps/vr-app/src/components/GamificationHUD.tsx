'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useSessionStore } from '@/store/sessionStore';

// ── XP bar ────────────────────────────────────────────────────

function XPBar({ xp, level }: { xp: number; level: number }) {
  const barRef = useRef<THREE.Mesh>(null);

  // Level thresholds: L = floor(sqrt(xp/50))+1 → xpForLevel(L) = 50*(L-1)^2
  const floorXP = 50 * (level - 1) ** 2;
  const ceilXP = 50 * level ** 2;
  const pct = Math.min(1, (xp - floorXP) / (ceilXP - floorXP));

  const BAR_W = 0.38;

  useFrame(() => {
    if (!barRef.current) return;
    barRef.current.scale.x = Math.max(0.01, pct);
    barRef.current.position.x = -BAR_W / 2 + (BAR_W * pct) / 2;
  });

  return (
    <group>
      {/* Background track */}
      <mesh position={[0, 0, 0.001]}>
        <boxGeometry args={[BAR_W, 0.018, 0.002]} />
        <meshBasicMaterial color="#1a1a3a" />
      </mesh>
      {/* Fill */}
      <mesh ref={barRef} position={[0, 0, 0.002]}>
        <boxGeometry args={[BAR_W, 0.016, 0.002]} />
        <meshBasicMaterial color="#4488ff" />
      </mesh>
    </group>
  );
}

// ── Level-up flash ────────────────────────────────────────────

function LevelUpFlash() {
  const groupRef = useRef<THREE.Group>(null);
  const life = useRef(0);
  const leveledUp = useSessionStore((s) => s.leveledUp);
  const clearLevelUp = useSessionStore((s) => s.clearLevelUp);
  const level = useSessionStore((s) => s.level);

  useEffect(() => {
    if (leveledUp) {
      life.current = 1;
      setTimeout(clearLevelUp, 2500);
    }
  }, [leveledUp]);

  useFrame((_state, delta) => {
    if (!groupRef.current || life.current <= 0) return;
    life.current = Math.max(0, life.current - delta / 2.5);
    groupRef.current.visible = life.current > 0;
    groupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).opacity = life.current;
      }
    });
  });

  return (
    <group ref={groupRef} position={[0, 0.28, 0]} visible={false}>
      <Text fontSize={0.065} color="#ffdd44" anchorX="center" outlineWidth={0.005} outlineColor="#000">
        {`LEVEL UP! → LVL ${level}`}
      </Text>
    </group>
  );
}

// ── Main HUD ──────────────────────────────────────────────────

export function GamificationHUD() {
  const currentRep = useSessionStore((s) => s.currentRep);
  const currentROM = useSessionStore((s) => s.currentROM);
  const score = useSessionStore((s) => s.score);
  const xp = useSessionStore((s) => s.xp);
  const level = useSessionStore((s) => s.level);
  const streak = useSessionStore((s) => s.streak);

  return (
    <group position={[0, 1.85, -1.5]}>
      {/* Background panel */}
      <RoundedBox args={[0.72, 0.28, 0.01]} radius={0.02} smoothness={4} position={[0, 0, -0.005]}>
        <meshStandardMaterial color="#0a0a1e" transparent opacity={0.75} />
      </RoundedBox>

      {/* Level badge */}
      <group position={[-0.28, 0.06, 0]}>
        <Text fontSize={0.028} color="#8888cc" anchorX="center">LVL</Text>
        <Text fontSize={0.07} color="#4488ff" anchorX="center" position={[0, -0.045, 0]}>
          {String(level)}
        </Text>
      </group>

      {/* XP bar + label */}
      <group position={[0.05, 0.06, 0]}>
        <XPBar xp={xp} level={level} />
        <Text fontSize={0.022} color="#5566aa" anchorX="left" position={[-0.19, -0.025, 0]}>
          {`${xp} XP`}
        </Text>
      </group>

      {/* Streak */}
      {streak > 0 && (
        <group position={[0.28, 0.06, 0]}>
          <Text fontSize={0.028} color="#ff8844" anchorX="center">🔥</Text>
          <Text fontSize={0.035} color="#ff8844" anchorX="center" position={[0, -0.048, 0]}>
            {String(streak)}
          </Text>
        </group>
      )}

      {/* Divider */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[0.65, 0.001, 0.001]} />
        <meshBasicMaterial color="#2a2a4a" />
      </mesh>

      {/* Rep | ROM | Score row */}
      <group position={[0, -0.075, 0]}>
        <group position={[-0.22, 0, 0]}>
          <Text fontSize={0.022} color="#5566aa" anchorX="center">REPS</Text>
          <Text fontSize={0.048} color="#ffffff" anchorX="center" position={[0, -0.038, 0]}>
            {String(currentRep)}
          </Text>
        </group>
        <group position={[0, 0, 0]}>
          <Text fontSize={0.022} color="#5566aa" anchorX="center">ROM</Text>
          <Text fontSize={0.048} color="#00ccff" anchorX="center" position={[0, -0.038, 0]}>
            {`${currentROM}°`}
          </Text>
        </group>
        <group position={[0.22, 0, 0]}>
          <Text fontSize={0.022} color="#5566aa" anchorX="center">SCORE</Text>
          <Text fontSize={0.048} color="#ffdd44" anchorX="center" position={[0, -0.038, 0]}>
            {String(score)}
          </Text>
        </group>
      </group>

      <LevelUpFlash />
    </group>
  );
}
