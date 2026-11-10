// The only surface other modules may import from identity.
export {
  createSession,
  listSessions,
  revokeAllSessions,
  revokeSession,
  rotateSession,
} from '../application/session.service.js';
