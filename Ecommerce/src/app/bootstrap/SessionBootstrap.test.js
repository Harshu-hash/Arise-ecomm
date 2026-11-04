import { versionIsBelow } from './version';

describe('versionIsBelow', () => {
  test.each([
    ['1.0.0', '1.0.1', true],
    ['1.2.0', '1.1.9', false],
    ['2.0', '2.0.0', false],
    ['1.10.0', '1.9.9', false],
  ])('%s compared with %s', (current, minimum, expected) => {
    expect(versionIsBelow(current, minimum)).toBe(expected);
  });
});
