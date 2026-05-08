import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001', {
        transports: ['websocket'],
      });
    }
    socketRef.current = socket;

    return () => {
      // Keep socket alive across re-renders — disconnect on full app unmount
    };
  }, []);

  return socketRef;
}
