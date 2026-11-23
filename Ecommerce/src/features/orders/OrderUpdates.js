import { useEffect } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { selectIsAuthenticated } from '@features/auth';
import { startOrderUpdates } from '@core/realtime/orderUpdates';

// Renders nothing: while a customer is signed in, their order and notification screens update live.
const OrderUpdates = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const authenticated = useSelector(selectIsAuthenticated);
  useEffect(
    () => (authenticated ? startOrderUpdates(dispatch, () => store.getState().auth.accessToken) : undefined),
    [authenticated, dispatch, store],
  );
  return null;
};

export default OrderUpdates;
