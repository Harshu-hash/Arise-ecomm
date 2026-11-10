import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import { Server } from 'socket.io';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { redis } from '../../config/redis.js';
import { ROLES } from '../../shared/constants/roles.js';
import { verifyAccessToken } from '../../shared/utils/jwt.js';

let io;
let subscriber;
let emitter;

export const rooms = Object.freeze({
  user: (userId) => `user:${userId}`,
  seller: (sellerId) => `seller:${sellerId}`,
  admin: 'admin',
});

// Rooms are derived from the verified JWT only; clients can never ask to join a room.
function roomsFor({ sub, role, sellerId }) {
  const joined = [rooms.user(sub)];
  if ((role === ROLES.SELLER || role === ROLES.SELLER_STAFF) && sellerId) joined.push(rooms.seller(sellerId));
  if (role === ROLES.ADMIN) joined.push(rooms.admin);
  return joined;
}

// socket.handshake.address is the proxy hop, so honour TRUST_PROXY the same way Express does.
function clientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (env.TRUST_PROXY > 0 && forwarded) {
    const hops = String(forwarded).split(',').map((hop) => hop.trim());
    return hops.at(-env.TRUST_PROXY) ?? hops[0];
  }
  return socket.handshake.address;
}

// Per-IP connection-attempt limit (Redis-backed, fails open). Without Redis there is no shared counter, so it is skipped.
async function connectionRateLimit(socket, next) {
  if (!redis) return next();
  try {
    const key = `rl:socket:${clientIp(socket)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return next(count > env.SOCKET_CONNECT_LIMIT ? new Error('RATE_LIMITED') : undefined);
  } catch {
    return next();
  }
}

export function createSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 16 * 1024,
    connectTimeout: 10_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Mandatory with multiple API replicas so emits reach sockets on every instance.
  if (redis) {
    subscriber = redis.duplicate();
    io.adapter(createAdapter(redis, subscriber));
  }

  io.use(connectionRateLimit);
  io.use((socket, next) => {
    try {
      socket.data.claims = verifyAccessToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(roomsFor(socket.data.claims));
    // Sent on every (re)connect: clients must refetch durable resources, since missed events are not replayed.
    socket.emit('session:ready', { serverTime: new Date().toISOString() });
    socket.on('error', (err) => logger.warn({ err }, 'Socket error'));
  });

  return io;
}

// Small invalidation/status hints after a durable commit; clients refetch the truth over HTTP.
// In the worker/outbox processes there is no Server, so publish through Redis to the API replicas instead.
export function emitTo(room, event, payload) {
  if (io) return io.to(room).emit(event, payload);
  if (!redis) return undefined;
  emitter ??= new Emitter(redis);
  return emitter.to(room).emit(event, payload);
}

export const socketConnectionCount = () => io?.engine.clientsCount ?? 0;

export async function closeSocketServer() {
  if (io) await io.close();
  if (subscriber && subscriber.status !== 'end') await subscriber.quit().catch(() => undefined);
}
