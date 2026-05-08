import type { FastifyInstance } from 'fastify';
import type { Exercise } from '@physio-vr/shared-types';

const EXERCISE_LIBRARY: Exercise[] = [
  {
    id: 'shoulder-flexion',
    name: 'Shoulder Flexion',
    category: 'shoulder',
    description: 'Raise your arm forward and upward to target shoulder flexion ROM.',
    targetReps: 10,
    targetSets: 3,
    targetROM: 180,
    difficulty: 1,
    instructions: [
      'Stand or sit upright with arms at your sides.',
      'Slowly raise your right arm forward.',
      'Lift until you feel resistance — do not force.',
      'Hold for 2 seconds, then lower slowly.',
    ],
  },
  {
    id: 'elbow-extension',
    name: 'Elbow Extension',
    category: 'elbow',
    description: 'Extend your elbow from a flexed position to improve ROM.',
    targetReps: 12,
    targetSets: 3,
    targetROM: 145,
    difficulty: 1,
    instructions: [
      'Hold your arm bent at 90 degrees.',
      'Slowly straighten your elbow.',
      'Hold fully extended for 1 second.',
      'Return to starting position.',
    ],
  },
];

export async function exercisesRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => EXERCISE_LIBRARY);

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const exercise = EXERCISE_LIBRARY.find((e) => e.id === req.params.id);
    if (!exercise) return reply.code(404).send({ error: 'Exercise not found' });
    return exercise;
  });
}
