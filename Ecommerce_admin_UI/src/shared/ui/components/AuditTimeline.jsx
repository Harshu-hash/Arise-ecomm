import ActivityTimeline from './ActivityTimeline';

/** Canonical S9 audit-event presentation. */
export default function AuditTimeline({ events, ...props }) {
  const normalized = (events ?? []).map((event) => ({
    ...event,
    at: event.at ?? event.createdAt,
    title: event.title ?? event.actionLabel ?? event.action,
    actorName: event.actorName ?? event.actor?.name,
    actorId: event.actorId ?? event.actor?.id,
    actorType: event.actorType ?? event.actor?.type,
    reason: event.reason ?? event.reasonCode,
  }));
  return <ActivityTimeline events={normalized} {...props} />;
}
