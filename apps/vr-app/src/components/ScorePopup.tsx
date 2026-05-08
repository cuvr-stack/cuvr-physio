'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useSessionStore } from '@/store/sessionStore';
import type { ScorePopup as ScorePopupData } from '@/store/sessionStore';

let _nextId = 1;

// Hook that spawns a popup on every rep increment
export function useSpawnScorePopup() {
  const currentRep = useSessionStore((s) => s.currentRep);
  const score = useSessionStore((s) => s.score);
  const rightHandPos = useSessionStore((s) => s.rightHandPos);
  const addScorePopup = useSessionStore((s) => s.addScorePopup);
  const prevScore = useRef(0);

  useEffect(() => {
    if (score > prevScore.current && rightHandPos) {
      const gained = score - prevScore.current;
      addScorePopup({
        id: _nextId++,
        points: gained,
        x: rightHandPos.x,
        y: rightHandPos.y + 0.2,
        z: rightHandPos.z,
      });
    }
    prevScore.current = score;
  }, [currentRep]);
}

function SinglePopup({ popup }: { popup: ScorePopupData }) {
  const groupRef = useRef<THREE.Group>(null);
  const life = useRef(1);
  const removeScorePopup = useSessionStore((s) => s.removeScorePopup);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    life.current -= delta / 1.4;

    if (life.current <= 0) {
      removeScorePopup(popup.id);
      return;
    }

    groupRef.current.position.y += delta * 0.4;
    groupRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (mat?.opacity !== undefined) mat.opacity = Math.max(0, life.current);
      }
    });
  });

  return (
    <group ref={groupRef} position={[popup.x, popup.y, popup.z]}>
      <Text
        fontSize={0.08}
        color="#ffdd44"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.004}
        outlineColor="#000"
      >
        {`+${popup.points}`}
      </Text>
    </group>
  );
}

export function ScorePopups() {
  useSpawnScorePopup();
  const scorePopups = useSessionStore((s) => s.scorePopups);

  return (
    <>
      {scorePopups.map((popup) => (
        <SinglePopup key={popup.id} popup={popup} />
      ))}
    </>
  );
}
