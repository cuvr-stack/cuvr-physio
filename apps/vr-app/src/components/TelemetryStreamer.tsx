'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSocketContext } from './SocketProvider';
import { useSessionStore } from '@/store/sessionStore';
import type { TelemetryFrame } from '@physio-vr/shared-types';

export function TelemetryStreamer() {
  const socket = useSocketContext();
  const { camera } = useThree();
  const patientId = useSessionStore((s) => s.patientId);
  const session = useSessionStore((s) => s.session);
  const leftHandPos = useSessionStore((s) => s.leftHandPos);
  const rightHandPos = useSessionStore((s) => s.rightHandPos);
  const currentROM = useSessionStore((s) => s.currentROM);
  const currentRep = useSessionStore((s) => s.currentRep);
  const lastEmit = useRef(0);

  useFrame(() => {
    if (!patientId || !session || !socket) return;

    const now = Date.now();
    if (now - lastEmit.current < 100) return; // 10 fps
    lastEmit.current = now;

    const frame: TelemetryFrame = {
      patientId,
      sessionId: session.id,
      timestamp: now,
      headPosition: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      headRotation: {
        x: camera.quaternion.x,
        y: camera.quaternion.y,
        z: camera.quaternion.z,
        w: camera.quaternion.w,
      },
      currentROM,
      currentRep,
      ...(leftHandPos && {
        leftHand: {
          position: leftHandPos,
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
      }),
      ...(rightHandPos && {
        rightHand: {
          position: rightHandPos,
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
      }),
    };

    socket.emit('telemetry:update', frame);
  });

  return null;
}
