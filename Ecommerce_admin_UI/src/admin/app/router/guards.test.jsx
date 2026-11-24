import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@core/auth/sessionStore';
import { RequireNavAccess } from './guards';

// The real route guard against a chat-only agent: what they may open, what they are told, and where '/' sends them.
const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireNavAccess />}>
          <Route path="/" element={<div>dashboard page</div>} />
          <Route path="/orders" element={<div>orders page</div>} />
          <Route path="/support/chat" element={<div>chat page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const signInWith = (permissions) =>
  useSessionStore.setState({ status: 'authenticated', user: { roleNames: ['Chat agent'] }, permissions: new Set(permissions) });

describe('RequireNavAccess', () => {
  beforeEach(() => signInWith([]));

  it('opens a page the admin has a permission for', () => {
    signInWith(['support.chat.handle']);
    renderAt('/support/chat');
    expect(screen.getByText('chat page')).toBeTruthy();
  });

  it('shows the 403 page, naming the missing permission, for a page they do not have', () => {
    signInWith(['support.chat.handle']);
    renderAt('/orders');
    expect(screen.queryByText('orders page')).toBeNull();
    expect(screen.getByText(/do not have access/i)).toBeTruthy();
    expect(screen.getByText('Orders › Orders › View')).toBeTruthy();
  });

  it('sends an admin without dashboard access from the front door to the first page they can open', () => {
    signInWith(['support.chat.handle']);
    renderAt('/');
    expect(screen.getByText('chat page')).toBeTruthy();
  });

  it('lets Super Admin through everywhere', () => {
    signInWith(['*']);
    renderAt('/orders');
    expect(screen.getByText('orders page')).toBeTruthy();
  });
});
