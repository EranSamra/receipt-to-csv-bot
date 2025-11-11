import { useEffect } from "react";
import "./InvoiceScanModal.css";

type Invoice = {
  id: string;
  number?: string;
  date?: string;
  total?: string;
  thumbnailUrl: string;
};

type Props = {
  isOpen: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onFinish?: () => void;
  scanDurationMs?: number;
  showBackgroundHints?: boolean;
  backgroundInvoices?: Invoice[];
};

export default function InvoiceScanModal({
  isOpen,
  invoice,
  onClose,
  onFinish,
  scanDurationMs = 1800,
  showBackgroundHints = false,
  backgroundInvoices = [],
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => onFinish?.(), scanDurationMs);
    return () => clearTimeout(t);
  }, [isOpen, scanDurationMs, onFinish]);

  if (!isOpen || !invoice) return null;

  return (
    <div className="scan-modal" role="dialog" aria-modal="true" aria-label="Receipt scanning">
      <button className="scan-close" onClick={onClose} aria-label="Close">×</button>
      <div className="scan-backdrop" />
      {showBackgroundHints && backgroundInvoices.length > 0 && (
        <div className="scan-hints">
          {backgroundInvoices.slice(0, 12).map(h => (
            <div key={h.id} className="scan-hint-card">
              <img src={h.thumbnailUrl} alt="" />
              <div className="scan-hint-line" />
            </div>
          ))}
        </div>
      )}
      <div className="scan-center">
        <div className="scan-preview">
          <img src={invoice.thumbnailUrl} alt={`Invoice ${invoice.number ?? invoice.id}`} />
          <div className="scan-overlay" aria-hidden="true">
            <div className="scan-line" />
          </div>
        </div>
        <div className="scan-copy" aria-live="polite">
          Scanning receipt...
        </div>
      </div>
    </div>
  );
}

