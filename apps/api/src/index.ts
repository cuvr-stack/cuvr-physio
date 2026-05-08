import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { registerTelemetrySocket } from './socket/telemetry';
import { exercisesRoutes } from './routes/exercises';
import { sessionsRoutes } from './routes/sessions';
import { patientsRoutes } from './routes/patients';
import { gamificationRoutes } from './routes/gamification';
import { appointmentsRoutes } from './routes/appointments';
import { soapNotesRoutes } from './routes/soapNotes';

const fastify = Fastify({ logger: true });

// Attach Socket.io to Fastify's own HTTP server — no separate port needed
const io = new Server(fastify.server, {
  cors: {
    origin: [
      process.env.VR_APP_URL ?? 'http://localhost:3000',
      process.env.DASHBOARD_URL ?? 'http://localhost:3002',
    ],
    methods: ['GET', 'POST'],
  },
});

async function bootstrap() {
  await fastify.register(cors, {
    origin: [
      process.env.VR_APP_URL ?? 'http://localhost:3000',
      process.env.DASHBOARD_URL ?? 'http://localhost:3002',
    ],
  });

  await fastify.register(exercisesRoutes, { prefix: '/api/exercises' });
  await fastify.register(sessionsRoutes, { prefix: '/api/sessions' });
  await fastify.register(patientsRoutes, { prefix: '/api/patients' });
  await fastify.register(gamificationRoutes,  { prefix: '/api/gamification' });
  await fastify.register(appointmentsRoutes, { prefix: '/api/appointments' });
  await fastify.register(soapNotesRoutes,    { prefix: '/api/soap-notes' });

  fastify.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

  registerTelemetrySocket(io);

  const port = Number(process.env.PORT ?? 3001);
  await fastify.listen({ port, host: '0.0.0.0' });
  // Socket.io is now available on the same port as the REST API
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
