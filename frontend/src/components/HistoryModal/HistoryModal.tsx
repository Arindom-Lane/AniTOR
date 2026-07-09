import { MouseEvent, useEffect, useState } from 'react';
import { historyApi } from '../../api/historyApi';
import { HistoryItem } from '../../types';
import './HistoryModal.css';

interface HistoryModalProps {
  onClose: () => void;
  onSelect: (magnetLink: string) => void;
}

/** Modal listing previously streamed torrents, with re-stream and delete actions. */
export function HistoryModal({ onClose, onSelect }: HistoryModalProps) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    historyApi
      .getAll()
      .then(setItems)
      .catch(() => setError(true));
  }, []);

  const handleDelete = async (magnetLink: string) => {
    // Optimistic removal — the item disappears immediately instead of
    // waiting on the round trip. If the server-side delete fails, the
    // item will simply reappear next time history is reloaded, which
    // is an acceptable trade-off for a "nice to have" list like this.
    setItems((prev) => prev?.filter((i) => i.magnetLink !== magnetLink) ?? null);
    try {
      await historyApi.remove(magnetLink);
    } catch {
      // see comment above
    }
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>History</h2>
          <button className="btn-secondary" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <p className="anime-loading">Failed to load</p>}

          {!error && items === null && <p className="anime-loading">Loading…</p>}

          {!error && items?.length === 0 && <p className="anime-loading">No history yet</p>}

          {items?.map((item) => (
            <div key={item.magnetLink} className="list-item">
              <div className="list-item-info">
                <div className="list-item-title">{item.title}</div>
              </div>
              <div className="list-item-actions">
                <button className="btn-load-item" onClick={() => onSelect(item.magnetLink)}>
                  ▶ Stream
                </button>
                <button className="btn-del-item" onClick={() => handleDelete(item.magnetLink)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
