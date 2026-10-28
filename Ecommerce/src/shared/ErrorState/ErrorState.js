import React from 'react';
import EmptyState from '@shared/EmptyState/EmptyState';

/**
 * Error state with retry. Thin preset over EmptyState so error and empty
 * UIs stay visually consistent. Used by screens when a query fails.
 */
function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Please check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  style,
}) {
  return (
    <EmptyState
      icon="wifi-off"
      title={title}
      message={message}
      actionLabel={onRetry ? retryLabel : undefined}
      onActionPress={onRetry}
      style={style}
    />
  );
}

export default React.memo(ErrorState);
