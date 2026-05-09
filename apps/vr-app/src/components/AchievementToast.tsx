'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useSessionStore } from '@/store/sessionStore';
import type { PendingAchievement } from '@/store/sessionStore';

// Show each achievement for 3.5s then dismiss
function SingleToast({
  achievement,
  index,
}: {
  achievement: PendingAchievement;
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const opacity = useRef(0);
  const timer = useRef(0);
  const dismissAchievement = useSessionStore((s) => s.dismissAchievement);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    timer.current += delta;

    // Fade in over 0.3s, hold until 3.2s, fade out over 0.3s
    if (timer.current < 0.3) {
      opacity.current = timer.current / 0.3;
    } else if (timer.current < 3.2) {
      opacity.current = 1;
    } else if (timer.current < 3.5) {
      opacity.current = 1 - (timer.current - 3.2) / 0.3;
    } else {
      dismissAchievement(achievement.id);
      return;
    }

    groupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).opacity = opacity.current;
      }
    });
  });

  // Stack toasts vertically
  const yOffset = 1.5 - index * 0.22;

  return (
    <group ref={groupRef} position={[0.85, yOffset, -1.4]}>
      <RoundedBox args={[0.55, 0.16, 0.01]} radius={0.02} smoothness={4}>
        <meshStandardMaterial color="#1a1a3a" transparent opacity={0} />
      </RoundedBox>

      {/* Icon */}
      <Text position={[-0.22, 0, 0.01]} fontSize={0.065} anchorX="center">
        {achievement.icon}
      </Text>

      {/* Achievement name */}
      <Text
        position={[0.02, 0.025, 0.01]}
        fontSize={0.038}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        maxWidth={0.3}
      >
        {achievement.name}
      </Text>

      {/* XP reward */}
      <Text
        position={[0.02, -0.025, 0.01]}
        fontSize={0.03}
        color="#ffdd44"
        anchorX="left"
        anchorY="middle"
      >
        {`+${achievement.xpReward} XP`}
      </Text>
    </group>
  );
}

export function AchievementToasts() {
  const pendingAchievements = useSessionStore((s) => s.pendingAchievements);

  return (
    <>
      {pendingAchievements.slice(0, 4).map((a, i) => (
        <SingleToast key={a.id} achievement={a} index={i} />
      ))}
    </>
  );
}
