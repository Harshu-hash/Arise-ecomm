import { describe, expect, it } from 'vitest';
import { sensitiveCount, toggleKeys } from './permissionSelection';

describe('PermissionMatrix.toggleKeys', () => {
  it('pulls in the implied view when a non-view action is granted', () => {
    const next = toggleKeys([], ['catalog.category.edit'], true);
    expect(next).toContain('catalog.category.edit');
    expect(next).toContain('catalog.category.view'); // implied dependency
  });

  it('removing view also removes the actions that depend on it', () => {
    const start = toggleKeys([], ['catalog.category.edit'], true); // view + edit
    const next = toggleKeys(start, ['catalog.category.view'], false);
    expect(next).not.toContain('catalog.category.view');
    expect(next).not.toContain('catalog.category.edit'); // orphan removed
  });

  it('does not duplicate keys already present', () => {
    const next = toggleKeys(['catalog.category.view'], ['catalog.category.view'], true);
    expect(next.filter((k) => k === 'catalog.category.view')).toHaveLength(1);
  });
});

describe('PermissionMatrix.sensitiveCount', () => {
  it('counts only sensitive keys', () => {
    expect(sensitiveCount(['catalog.category.view'])).toBe(0);
    expect(sensitiveCount(['sellers.seller.blacklist', 'catalog.category.view'])).toBe(1);
  });
});
