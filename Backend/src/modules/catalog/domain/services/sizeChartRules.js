import { ValidationError } from '../../../../shared/errors/AppError.js';

const key = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export const sizeChartNameKey = key;

export function validateSizeChartGrid(columns, rows) {
  if (rows.some((row) => row.length !== columns.length)) {
    throw new ValidationError('Every row must have one value per column.', {
      rows: ['Every row must have one value per column.'],
    });
  }
  if (new Set(columns.map(key)).size !== columns.length) {
    throw new ValidationError('Column headings must be unique.', {
      columns: ['Column headings must be unique.'],
    });
  }
  if (new Set(rows.map((row) => key(row[0]))).size !== rows.length) {
    throw new ValidationError('Size labels must be unique.', {
      rows: ['Size labels in the first column must be unique.'],
    });
  }
}
