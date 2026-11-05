import { Button } from 'antd';
import { useRef, useState } from 'react';

/** Ignores repeated clicks while the same command is in flight. */
export default function AsyncActionButton({ onAction, onError, children, disabled, ...buttonProps }) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true);
    try { await onAction?.(); } catch (error) { onError?.(error); } finally { inFlight.current = false; setPending(false); }
  };
  return <Button {...buttonProps} disabled={disabled || pending} loading={pending} onClick={run}>{children}</Button>;
}
