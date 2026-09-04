import type { Participant } from '../types/participant';

export type ImportSource = 'paste' | 'csv';

export type InvalidRow = {
  rowNumber: number;
  reason: string;
  raw: string[];
};

export type DuplicateRow = {
  rowNumber: number;
  title: string;
  fullName: string;
  affiliation: string;
};

export type ImportValidation = {
  totalRowsDetected: number;
  validParticipants: Participant[];
  blankRowsIgnored: number;
  invalidRows: InvalidRow[];
  duplicateRows: DuplicateRow[];
  preview: Participant[];
};

const HEADER_TITLE = new Set(['ยศ', 'title', 'rank']);
const HEADER_FULL_NAME = new Set(['ชื่อ-สกุล', 'ชื่อ-นามสกุล', 'fullname', 'full name']);
const HEADER_AFFILIATION = new Set(['สังกัด', 'affiliation', 'unit']);
const HEADER_SEQUENCE = new Set(['ลำดับ', 'sequence', 'no', 'no.', 'number']);
const HEADER_COMBINED_NAME = new Set(['ยศ ชื่อ-สกุล', 'ยศ ชื่อ-นามสกุล', 'displayname', 'display name']);

export function parseParticipantInput(input: string, source: ImportSource): ImportValidation {
  if (input.trim().length === 0) {
    return {
      totalRowsDetected: 0,
      validParticipants: [],
      blankRowsIgnored: 0,
      invalidRows: [],
      duplicateRows: [],
      preview: [],
    };
  }

  const rows = source === 'csv' ? parseCsv(input) : parseDelimitedPaste(input);
  const withoutTrailingEmpty = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  const firstRow = withoutTrailingEmpty[0] ?? [];
  const hasCurrentHeader = hasHeaderRow(firstRow);
  if (hasLegacyHeaderRow(firstRow)) {
    return {
      totalRowsDetected: Math.max(withoutTrailingEmpty.length - 1, 0),
      validParticipants: [],
      blankRowsIgnored: rows.length - withoutTrailingEmpty.length,
      invalidRows: [{
        rowNumber: 1,
        reason: 'รูปแบบรายชื่อเดิมไม่รองรับแล้ว กรุณาใช้ไฟล์ที่แยก ยศ, ชื่อ-สกุล และ สังกัด',
        raw: firstRow,
      }],
      duplicateRows: [],
      preview: [],
    };
  }
  const dataRows = hasCurrentHeader ? withoutTrailingEmpty.slice(1) : withoutTrailingEmpty;
  const validParticipants: Participant[] = [];
  const invalidRows: InvalidRow[] = [];
  const duplicateRows: DuplicateRow[] = [];
  const seen = new Set<string>();
  let blankRowsIgnored = rows.length - withoutTrailingEmpty.length;

  dataRows.forEach((row, index) => {
    const rowNumber = hasCurrentHeader ? index + 2 : index + 1;
    if (row.every((cell) => cell.trim().length === 0)) {
      blankRowsIgnored += 1;
      return;
    }

    if (row.length !== 3) {
      invalidRows.push({
        rowNumber,
        reason: 'ต้องมี 3 คอลัมน์: ยศ, ชื่อ-สกุล, สังกัด',
        raw: row,
      });
      return;
    }

    const title = cleanCell(row[0] ?? '');
    const fullName = cleanCell(row[1] ?? '');
    const affiliation = cleanCell(row[2] ?? '');

    if (!title || !fullName || !affiliation) {
      invalidRows.push({
        rowNumber,
        reason: 'ต้องมี ยศ, ชื่อ-สกุล และ สังกัด',
        raw: row,
      });
      return;
    }

    const duplicateKey = normalizeDuplicateKey(title, fullName, affiliation);
    if (seen.has(duplicateKey)) {
      duplicateRows.push({ rowNumber, title, fullName, affiliation });
      return;
    }
    seen.add(duplicateKey);

    validParticipants.push({
      id: makeParticipantId(validParticipants.length + 1),
      title,
      fullName,
      affiliation,
    });
  });

  return {
    totalRowsDetected: dataRows.length,
    validParticipants,
    blankRowsIgnored,
    invalidRows,
    duplicateRows,
    preview: validParticipants.slice(0, 10),
  };
}

export function normalizeDuplicateKey(title: string, fullName: string, affiliation: string): string {
  return [
    title.trim().replace(/\s+/g, ' '),
    fullName.trim().replace(/\s+/g, ' '),
    affiliation.trim().replace(/\s+/g, ' '),
  ].join('|');
}

export function hasHeaderRow(row: string[]): boolean {
  const normalized = row.map((cell) => cleanCell(cell).toLowerCase());
  return (
    HEADER_TITLE.has(normalized[0] ?? '') &&
    HEADER_FULL_NAME.has(normalized[1] ?? '') &&
    HEADER_AFFILIATION.has(normalized[2] ?? '')
  );
}

export function hasLegacyHeaderRow(row: string[]): boolean {
  const normalized = row.map((cell) => cleanCell(cell).toLowerCase());
  return (
    HEADER_SEQUENCE.has(normalized[0] ?? '') &&
    HEADER_COMBINED_NAME.has(normalized[1] ?? '') &&
    HEADER_AFFILIATION.has(normalized[2] ?? '')
  );
}

function parseDelimitedPaste(input: string): string[][] {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split('\t').map(cleanCell));
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cleanCell(cell));
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cleanCell(cell));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cleanCell(cell));
  rows.push(row);
  return rows;
}

function cleanCell(value: string): string {
  return value.replace(/^\uFEFF/, '').trim();
}

function makeParticipantId(index: number): string {
  return `p-${String(index).padStart(3, '0')}`;
}
