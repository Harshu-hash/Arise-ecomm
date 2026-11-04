const parseVersion = version =>
  String(version)
    .split('.')
    .map(part => Number.parseInt(part, 10) || 0);

export const versionIsBelow = (current, minimum) => {
  const left = parseVersion(current);
  const right = parseVersion(minimum);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) < (right[index] || 0)) return true;
    if ((left[index] || 0) > (right[index] || 0)) return false;
  }
  return false;
};
