const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');

const normalizeHeader = (header, index) => {
  const raw = String(header === undefined || header === null ? '' : header).trim();
  if (!raw) return `column_${index}`;
  return raw
    .replace(/\r?\n/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
};

const normalizeCellValue = (value) => {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return normalizeCellValue(value.result);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'text')) {
      return String(value.text || '');
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => String(item.text || '')).join('');
    }
  }
  return value;
};

const normalizeRowKeys = (row) => {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    out[normalizeHeader(key, 0)] = normalizeCellValue(value);
  }
  return out;
};

const parseCsvRows = (buffer) => {
  const rows = parse(buffer.toString('utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
  return rows.map(normalizeRowKeys);
};

const parseXlsxRows = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const maxColumns = Math.max(headerRow.cellCount || 0, sheet.columnCount || 0);
  const headers = Array.from({ length: maxColumns + 1 }, (_, index) =>
    normalizeHeader(headerRow.getCell(index).value, index)
  );

  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record = {};
    let hasValue = false;

    for (let col = 1; col <= maxColumns; col += 1) {
      const key = headers[col] || `column_${col}`;
      const value = normalizeCellValue(row.getCell(col).value);
      if (value !== '' && value !== null && value !== undefined) {
        hasValue = true;
      }
      record[key] = value;
    }

    if (hasValue) rows.push(record);
  }

  return rows;
};

const parseSpreadsheetRows = async (file) => {
  const originalName = String(file?.originalname || '').toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase();
  const isCsv = originalName.endsWith('.csv') || mime.includes('csv');

  if (isCsv) {
    return parseCsvRows(file.buffer);
  }
  return parseXlsxRows(file.buffer);
};

module.exports = {
  parseSpreadsheetRows,
};
