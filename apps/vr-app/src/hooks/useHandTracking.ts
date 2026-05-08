import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXRInputSourceState } from '@react-three/xr';
import * as THREE from 'three';
import { useSessionStore } from '@/store/sessionStore';

// Reusable vectors to avoid GC pressure inside useFrame
const _wrist = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _armVec = new THREE.Vector3();
const _neutral = new THREE.Vector3(0, -1, 0);

function calcROM(wrist: THREE.Vector3, head: THREE.Vector3, side: 'left' | 'right'): number {
  // Estimate shoulder: 20cm lateral of head, 25cm inferior
  _shoulder.set(
    head.x + (side === 'right' ? 0.2 : -0.2),
    head.y - 0.25,
    head.z,
  );
  _armVec.subVectors(wrist, _shoulder);
  const angle = _armVec.angleTo(_neutral) * (180 / Math.PI);
  return Math.min(180, Math.max(0, Math.round(angle)));
}

/**
 * Mounts inside <XR> context. Reads whichever input source is active (hand or
 * controller), writes wrist position + ROM to the session store at 10 fps.
 *
 * The dominant (right) hand drives ROM; left hand is tracked for telemetry only.
 */
export function useHandTracking() {
  const { camera } = useThree();
  const setHandPos = useSessionStore((s) => s.setHandPos);
  const setROM = useSessionStore((s) => s.setROM);
  const lastEmit = useRef(0);

  // Prefer hand tracking; fall back to controller grip space
  const rightHand = useXRInputSourceState('hand', 'right');
  const rightController = useXRInputSourceState('controller', 'right');
  const leftHand = useXRInputSourceState('hand', 'left');
  const leftController = useXRInputSourceState('controller', 'left');

  useFrame(() => {
    const now = Date.now();
    if (now - lastEmit.current < 100) return; // 10 fps
    lastEmit.current = now;

    const rightObj = rightHand?.object ?? rightController?.object ?? null;
    const leftObj = leftHand?.object ?? leftController?.object ?? null;

    if (rightObj) {
      rightObj.getWorldPosition(_wrist);
      setHandPos('right', { x: _wrist.x, y: _wrist.y, z: _wrist.z });
      const rom = calcROM(_wrist, camera.position, 'right');
      setROM(rom);
    }

    if (leftObj) {
      leftObj.getWorldPosition(_wrist);
      setHandPos('left', { x: _wrist.x, y: _wrist.y, z: _wrist.z });
    }
  });
}
