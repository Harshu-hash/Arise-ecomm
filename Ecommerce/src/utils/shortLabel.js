/** A name of several words shows only its first word and an ellipsis ("Beauty & Personal Care" -> "Beauty…"), so tabs stay narrow. */
export const shortLabel = (label = '') => {
  const [first, ...rest] = String(label).trim().split(/\s+/);
  return rest.length ? `${first}…` : first;
};
