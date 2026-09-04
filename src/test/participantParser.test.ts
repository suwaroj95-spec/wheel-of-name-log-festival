import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasLegacyHeaderRow, parseParticipantInput } from '../utils/participantParser';

const cleanedCsvPath = 'D:/Wheel-of-name-log-festival/รายชื่อสำหรับการสุ่ม_แยกยศ.csv';

describe('participant parser', () => {
  it('parses CSV with the cleaned three-column schema', () => {
    const result = parseParticipantInput('ยศ,ชื่อ-สกุล,สังกัด\nน.อ.,กิตติอนันต์ หม่อมศิลำ,สจย.กบ.ทอ', 'csv');
    expect(result.validParticipants).toEqual([{
      id: 'p-001',
      title: 'น.อ.',
      fullName: 'กิตติอนันต์ หม่อมศิลำ',
      affiliation: 'สจย.กบ.ทอ',
    }]);
  });

  it('parses pasted Excel rows as title, fullName, affiliation', () => {
    const result = parseParticipantInput('ร.อ.\tทดสอบ หนึ่ง\tกองทดสอบ\nน.ส.\tตัวอย่าง สอง\tหน่วยงาน', 'paste');
    expect(result.validParticipants).toHaveLength(2);
    expect(result.validParticipants[0]).toMatchObject({
      title: 'ร.อ.',
      fullName: 'ทดสอบ หนึ่ง',
      affiliation: 'กองทดสอบ',
    });
  });

  it('detects and skips the cleaned header row', () => {
    const result = parseParticipantInput('ยศ\tชื่อ-สกุล\tสังกัด\nร.อ.\tทดสอบ หนึ่ง\tกองทดสอบ', 'paste');
    expect(result.totalRowsDetected).toBe(1);
    expect(result.validParticipants[0].title).toBe('ร.อ.');
  });

  it('supports harmless full-name header aliases', () => {
    const result = parseParticipantInput('ยศ\tชื่อ-นามสกุล\tสังกัด\nร.อ.\tทดสอบ หนึ่ง\tกองทดสอบ', 'paste');
    expect(result.validParticipants[0].fullName).toBe('ทดสอบ หนึ่ง');
  });

  it('rejects legacy sequence and combined-name headers', () => {
    const result = parseParticipantInput('ลำดับ\tยศ ชื่อ-สกุล\tสังกัด\n1\tร.อ.ทดสอบ หนึ่ง\tกองทดสอบ', 'paste');
    expect(hasLegacyHeaderRow(['ลำดับ', 'ยศ ชื่อ-สกุล', 'สังกัด'])).toBe(true);
    expect(result.validParticipants).toHaveLength(0);
    expect(result.invalidRows[0].reason).toContain('รูปแบบรายชื่อเดิม');
  });

  it('requires exactly three logical columns', () => {
    const tooFew = parseParticipantInput('ร.อ.\tทดสอบ หนึ่ง', 'paste');
    const tooMany = parseParticipantInput('ร.อ.\tทดสอบ หนึ่ง\tกองทดสอบ\tเกิน', 'paste');
    expect(tooFew.invalidRows).toHaveLength(1);
    expect(tooMany.invalidRows).toHaveLength(1);
  });

  it('requires title, fullName and affiliation', () => {
    const result = parseParticipantInput('\tทดสอบ หนึ่ง\tกองทดสอบ\nร.อ.\t\tกองทดสอบ\nร.อ.\tทดสอบ หนึ่ง\t', 'paste');
    expect(result.invalidRows).toHaveLength(3);
    expect(result.validParticipants).toHaveLength(0);
  });

  it('detects duplicates using title, fullName and affiliation', () => {
    const result = parseParticipantInput('ร.อ.\tทดสอบ   หนึ่ง\tกองทดสอบ\nร.อ.\tทดสอบ หนึ่ง\tกองทดสอบ', 'paste');
    expect(result.validParticipants).toHaveLength(1);
    expect(result.duplicateRows).toHaveLength(1);
  });

  it('does not collapse different titles into duplicates', () => {
    const result = parseParticipantInput('ร.อ.\tทดสอบ หนึ่ง\tกองทดสอบ\nน.อ.\tทดสอบ หนึ่ง\tกองทดสอบ', 'paste');
    expect(result.validParticipants).toHaveLength(2);
    expect(result.duplicateRows).toHaveLength(0);
  });

  it('preserves Thai title text', () => {
    const result = parseParticipantInput('ร.ท.หญิง\tคเชนทร์  พุกกลิ่น\tกผท.สนผ.กบ.ทอ.', 'paste');
    expect(result.validParticipants[0].title).toBe('ร.ท.หญิง');
  });

  it('preserves Thai fullName text exactly', () => {
    const result = parseParticipantInput('ร.ท.\tคเชนทร์  พุกกลิ่น\tกผท.สนผ.กบ.ทอ.', 'paste');
    expect(result.validParticipants[0].fullName).toBe('คเชนทร์  พุกกลิ่น');
  });

  it('preserves Thai affiliation text exactly', () => {
    const result = parseParticipantInput('ร.ท.\tตัวอย่าง ทดสอบ\tกองโครงการและงบประมาณ สนผ.กบ.ทอ.', 'paste');
    expect(result.validParticipants[0].affiliation).toBe('กองโครงการและงบประมาณ สนผ.กบ.ทอ.');
  });

  it('generates unique participant IDs', () => {
    const result = parseParticipantInput('นาย\tก หนึ่ง\tสังกัด\nนาง\tข สอง\tสังกัด', 'paste');
    expect(new Set(result.validParticipants.map((participant) => participant.id)).size).toBe(2);
    expect(result.validParticipants.map((participant) => participant.id)).toEqual(['p-001', 'p-002']);
  });

  it('imports the cleaned runtime CSV as 316 valid participants', () => {
    const csv = readFileSync(cleanedCsvPath, 'utf8');
    const result = parseParticipantInput(csv, 'csv');
    expect(result.validParticipants).toHaveLength(316);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.duplicateRows).toHaveLength(0);
  });
});
