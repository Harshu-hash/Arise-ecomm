import { cubicPath, cubicTable, STREAKS } from './splashGeometry';

describe('splash geometry', () => {
  test('a straight "curve" has the length of the line and sampled points along it', () => {
    const table = cubicTable([[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(table.length).toBeCloseTo(3, 5);
    expect(table.xs[0]).toBe(0);
    expect(table.xs[table.xs.length - 1]).toBeCloseTo(3, 5);
    expect(table.lengths).toEqual([...table.lengths].sort((a, b) => a - b));
  });

  test('every streak starts and ends where its control points say', () => {
    for (const points of Object.values(STREAKS)) {
      const table = cubicTable(points);
      expect([table.xs[0], table.ys[0]]).toEqual(points[0]);
      expect(table.xs[table.xs.length - 1]).toBeCloseTo(points[3][0], 5);
      expect(table.ys[table.ys.length - 1]).toBeCloseTo(points[3][1], 5);
      expect(table.length).toBeGreaterThan(0.5);
    }
  });

  test('the path string follows the points', () => {
    expect(cubicPath([[0, 1], [2, 3], [4, 5], [6, 7]])).toBe('M0,1 C2,3 4,5 6,7');
  });
});
