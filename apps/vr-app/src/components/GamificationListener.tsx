'use client';

import { useEffect } from 'react';
import { useSocketContext } from './SocketProvider';
import { useSessionStore } from '@/store/sessionStore';
import type { PendingAchievement } from '@/store/sessionStore';
import { useGameStore } from '@/store/gameStore';

interface RepRewardPayload {
  xpGained: number;
  repScore: number;
  totalXP: number;
  level: number;
  leveledUp: boolean;
}

/**
 * Listens to gamification socket events and writes them into the session store.
 * Must be mounted inside SocketProvider but outside the R3F Canvas.
 */
export function GamificationListener() {
  const socket = useSocketContext();
  const applyRepReward = useSessionStore((s) => s.applyRepReward);
  const addAchievements = useSessionStore((s) => s.addAchievements);
  const applyTargetUpdate    = useGameStore((s) => s.applyTargetUpdate);
  const setChallenge         = useGameStore((s) => s.setChallenge);
  const markChallengeEarned  = useGameStore((s) => s.markChallengeEarned);

  useEffect(() => {
    if (!socket) return;

    socket.on('gamification:rep_reward', (payload: RepRewardPayload) => {
      applyRepReward(
        payload.xpGained,
        payload.repScore,
        payload.totalXP,
        payload.level,
        payload.leveledUp,
      );
    });

    socket.on('gamification:achievements_earned', (achievements: PendingAchievement[]) => {
      addAchievements(achievements);
    });

    // ── AI Coach loop closure ──────────────────────────────────────────────
    socket.on('coach:target_update', (payload: { newTargetROM: number; reason?: string }) => {
      applyTargetUpdate(payload.newTargetROM, payload.reason);
    });

    socket.on('coach:challenge_set', (payload: {
      id: string; title: string; description: string; xpReward?: number;
    }) => {
      setChallenge({
        id: payload.id,
        title: payload.title,
        description: payload.description,
        xpReward: payload.xpReward ?? 0,
        earned: false,
      });
    });

    socket.on('coach:challenge_earned', () => {
      markChallengeEarned();
    });

    return () => {
      socket.off('gamification:rep_reward');
      socket.off('gamification:achievements_earned');
      socket.off('coach:target_update');
      socket.off('coach:challenge_set');
      socket.off('coach:challenge_earned');
    };
  }, [socket]);

  return null;
}
