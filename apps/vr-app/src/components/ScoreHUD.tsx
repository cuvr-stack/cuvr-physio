'use client';

import { Text } from '@react-three/drei';
import { useSessionStore } from '@/store/sessionStore';

export function ScoreHUD() {
  const { currentRep, score, currentROM } = useSessionStore();

  return (
    <group position={[0, 1.8, -1.5]}>
      <Text fontSize={0.06} color="#ffffff" anchorX="center">
        {`Reps: ${currentRep}  |  ROM: ${currentROM}°  |  Score: ${score}`}
      </Text>
    </group>
  );
}
