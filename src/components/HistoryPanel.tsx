import type { DrawRecord } from '../types/participant';

type HistoryPanelProps = {
  history: DrawRecord[];
  open: boolean;
  onClose: () => void;
};

export function HistoryPanel({ history, open, onClose }: HistoryPanelProps) {
  if (!open) return null;

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="history-drawer" aria-label="draw history" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-heading">
          <h2>ประวัติการสุ่ม</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="close history">
            x
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted-text">ยังไม่มีประวัติการสุ่ม</p>
        ) : (
          <div className="history-list">
            {history.map((record) => (
              <article key={`${record.drawNumber}-${record.participantId}`} className="history-card">
                <span>สุ่มครั้งที่ {record.drawNumber}</span>
                <p>{record.affiliation}</p>
                <strong>{record.title} {record.fullName}</strong>
                <small>นำออกจากรอบถัดไป: {record.removedFromEligibility ? 'ใช่' : 'ไม่ใช่'}</small>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
