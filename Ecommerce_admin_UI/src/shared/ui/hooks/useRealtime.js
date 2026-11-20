import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { IS_MOCK, apiBaseForAudience } from '@core/config/env';
import { useSessionStore } from '@core/auth/sessionStore';

/**
 * Subscribes to the backend's realtime hints while the calling screen is mounted.
 * `handlers` maps an event name to a callback; events are only "something changed" hints, so callbacks
 * should refetch over HTTP. Missed events are not replayed, so every (re)connect also fires `session:ready`.
 * No-op against the mock API, which has no socket server.
 */
export default function useRealtime(audience, handlers) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (IS_MOCK) return undefined;
    const origin = new URL(apiBaseForAudience(audience), window.location.origin).origin;
    const socket = io(origin, {
      transports: ['websocket', 'polling'],
      // A function, so each reconnect sends the current (possibly refreshed) access token.
      auth: (done) => done({ token: useSessionStore.getState().accessToken }),
    });
    const names = [...new Set([...Object.keys(latest.current), 'session:ready'])];
    names.forEach((name) => socket.on(name, (payload) => latest.current[name]?.(payload)));
    return () => { socket.disconnect(); };
  }, [audience]);
}
