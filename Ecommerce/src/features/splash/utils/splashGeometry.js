// Geometry for the splash light streaks: a cubic Bezier sampled into arc-length tables, so the glowing head can be placed at
// "how far along the streak" it is, whatever the curve's speed. Pure.

const STEPS = 64;

const bezier = (t, a, b, c, d) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** points: [[x,y] x4]. Returns { length, lengths, xs, ys } sampled at STEPS+1 points along the curve. */
export function cubicTable(points) {
  const [p0, p1, p2, p3] = points;
  const lengths = [0];
  const xs = [p0[0]];
  const ys = [p0[1]];
  for (let i = 1; i <= STEPS; i += 1) {
    const t = i / STEPS;
    xs.push(bezier(t, p0[0], p1[0], p2[0], p3[0]));
    ys.push(bezier(t, p0[1], p1[1], p2[1], p3[1]));
    lengths.push(lengths[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  }
  return { length: lengths[STEPS], lengths, xs, ys };
}

/** The SVG path string for the same curve. */
export const cubicPath = ([p0, p1, p2, p3]) => `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;

// Stage units: 1 = the screen width. Shapes are read off the reference animation.
export const STREAKS = {
  // the first sweep: in from the top, round the left, and across to the right
  sweep: [[0.5, -0.04], [-0.12, 0.1], [0.08, 0.56], [0.82, 0.42]],
  // the thinner ring that circles the logo as it appears
  orbit: [[0.94, 0.22], [0.78, -0.1], [-0.12, 0.02], [0.14, 0.66]],
};

// Fixed sparkle positions [x, y, size, phase] (stage units), so every launch looks the same.
export const SPARKLES = [
  [0.14, 0.12, 1.6, 0.0], [0.82, 0.08, 1.2, 0.3], [0.9, 0.34, 1.8, 0.6], [0.06, 0.5, 1.2, 0.15],
  [0.3, 0.06, 1.0, 0.8], [0.66, 0.16, 1.4, 0.45], [0.2, 0.7, 1.6, 0.7], [0.78, 0.66, 1.2, 0.1],
  [0.5, 0.02, 1.2, 0.55], [0.92, 0.6, 1.0, 0.9], [0.1, 0.34, 1.0, 0.4], [0.7, 0.04, 1.8, 0.25],
];
