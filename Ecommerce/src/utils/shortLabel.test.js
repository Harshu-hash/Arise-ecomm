import { shortLabel } from './shortLabel';

describe('shortLabel', () => {
  it('keeps one-word names and cuts longer ones to the first word and an ellipsis', () => {
    expect(shortLabel('Fashion')).toBe('Fashion');
    expect(shortLabel('Home & Kitchen')).toBe('Home…');
    expect(shortLabel('  Beauty & Personal Care ')).toBe('Beauty…');
    expect(shortLabel('')).toBe('');
    expect(shortLabel()).toBe('');
  });
});
