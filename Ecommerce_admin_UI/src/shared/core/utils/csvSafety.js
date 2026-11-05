/** Prevents spreadsheet programs from interpreting exported user data as formulas. */
export function spreadsheetSafe(value) {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvCell(value) {
  return `"${spreadsheetSafe(value).replaceAll('"', '""')}"`;
}
