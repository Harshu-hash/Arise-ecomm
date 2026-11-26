import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import AlertsFeed from './AlertsFeed';

it('keeps the empty alerts state compact', () => {
  render(
    <MemoryRouter>
      <AlertsFeed alerts={[]} unread={0} onRead={() => {}} />
    </MemoryRouter>,
  );

  expect(screen.getByText('No active alerts')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
