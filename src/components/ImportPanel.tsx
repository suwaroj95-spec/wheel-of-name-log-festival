import { useMemo, useState } from 'react';
import { parseParticipantInput, type ImportSource, type ImportValidation } from '../utils/participantParser';

type ImportPanelProps = {
  currentCount: number;
  hasHistory: boolean;
  onApply: (validation: ImportValidation) => void;
};

export function ImportPanel({ currentCount, hasHistory, onApply }: ImportPanelProps) {
  const [text, setText] = useState('');
  const [source, setSource] = useState<ImportSource>('paste');
  const [confirmedReplace, setConfirmedReplace] = useState(false);
  const validation = useMemo(() => parseParticipantInput(text, source), [text, source]);
  const canApply = validation.validParticipants.length > 0 && validation.invalidRows.length === 0;
  const needsReplaceWarning = hasHistory && currentCount > 0 && !confirmedReplace;

  async function handleCsvFile(file: File | null) {
    if (!file) return;
    setSource('csv');
    setText(await file.text());
    setConfirmedReplace(false);
  }

  return (
    <section className="setup-panel" aria-label="participant import">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">รายชื่อผู้ร่วมงาน</p>
          <h2>นำเข้ารายชื่อ</h2>
        </div>
        <p className="participant-total">ทั้งหมด {currentCount} คน</p>
      </div>

      <div className="segmented-control" role="tablist" aria-label="import method">
        <button className={source === 'paste' ? 'active' : ''} onClick={() => setSource('paste')} type="button">
          วางรายชื่อจาก Excel
        </button>
        <button className={source === 'csv' ? 'active' : ''} onClick={() => setSource('csv')} type="button">
          นำเข้า CSV
        </button>
      </div>

      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setConfirmedReplace(false);
        }}
        placeholder={
          source === 'paste'
            ? 'ยศ\tชื่อ-สกุล\tสังกัด'
            : 'ยศ,ชื่อ-สกุล,สังกัด'
        }
      />

      {source === 'csv' && (
        <label className="file-picker">
          <span>เลือกไฟล์ CSV UTF-8</span>
          <input type="file" accept=".csv,text/csv" onChange={(event) => void handleCsvFile(event.target.files?.[0] ?? null)} />
        </label>
      )}

      <div className="validation-grid">
        <Metric label="แถวที่พบ" value={validation.totalRowsDetected} />
        <Metric label="ใช้ได้" value={validation.validParticipants.length} />
        <Metric label="แถวว่าง" value={validation.blankRowsIgnored} />
        <Metric label="ไม่สมบูรณ์" value={validation.invalidRows.length} />
        <Metric label="ซ้ำ" value={validation.duplicateRows.length} />
      </div>

      {validation.preview.length > 0 && (
        <div className="preview-list">
          <p>ตัวอย่างรายชื่อ</p>
          {validation.preview.map((participant) => (
            <div key={participant.id} className="preview-row">
              <span>{participant.title}</span>
              <strong>{participant.fullName}</strong>
              <span>{participant.affiliation}</span>
            </div>
          ))}
        </div>
      )}

      {(validation.invalidRows.length > 0 || validation.duplicateRows.length > 0) && (
        <div className="feedback-box">
          {validation.invalidRows.slice(0, 5).map((row) => (
            <p key={`invalid-${row.rowNumber}`}>แถว {row.rowNumber}: {row.reason}</p>
          ))}
          {validation.duplicateRows.slice(0, 5).map((row) => (
            <p key={`duplicate-${row.rowNumber}`}>แถว {row.rowNumber}: รายชื่อซ้ำ {row.title} {row.fullName}</p>
          ))}
        </div>
      )}

      {needsReplaceWarning && (
        <label className="checkbox-row warning">
          <input
            type="checkbox"
            checked={confirmedReplace}
            onChange={(event) => setConfirmedReplace(event.target.checked)}
          />
          ยืนยันการแทนที่รายชื่อและล้างประวัติการสุ่มเดิม
        </label>
      )}

      <button
        className="primary-action"
        type="button"
        disabled={!canApply || needsReplaceWarning}
        onClick={() => onApply(validation)}
      >
        ใช้รายชื่อนี้
      </button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
