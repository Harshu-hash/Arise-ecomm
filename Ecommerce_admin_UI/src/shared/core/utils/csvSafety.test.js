import { describe, expect, it } from 'vitest';
import { csvCell, spreadsheetSafe } from './csvSafety';

describe('spreadsheet export safety', () => {
  it.each(['=HYPERLINK("https://bad")', '+cmd', '-1+2', '@SUM(A1:A2)', '\tformula'])('neutralises formula-like cells: %s', (value) => {
    expect(spreadsheetSafe(value)).toBe(`'${value}`);
  });
  it('quotes embedded delimiters and quotes', () => expect(csvCell('safe,"value"')).toBe('"safe,""value"""'));
});
