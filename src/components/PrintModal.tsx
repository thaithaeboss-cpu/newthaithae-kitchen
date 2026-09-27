'use client';

import { useRef } from 'react';

// A print surface that works inside an iOS standalone PWA, where the old
// `window.open('', '_blank')` + programmatic `window.print()` pattern silently
// fails (the popup opens with no toolbar and iOS ignores the print call, so
// there's no button to tap — see the delivery/receipt print bug).
//
// Instead we render the print HTML in a same-document <iframe> with a visible
// "พิมพ์" button. Printing is triggered by the user's tap via
// `iframe.contentWindow.print()`, which prints the iframe's full document
// (no clipping) and, being a real user gesture on an in-page frame, is honoured
// by iOS Safari including standalone mode.
export function PrintModal({
  html,
  title,
  onClose,
  locale = 'th',
}: {
  html: string | null;
  title?: string;
  onClose: () => void;
  locale?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!html) return null;

  function handlePrint() {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/60">
      {/* Toolbar — always visible so there is a real button to tap */}
      <div className="flex items-center justify-between gap-2 bg-emerald-950 text-white px-4 py-3 shrink-0">
        <span className="font-semibold text-sm truncate">
          {title ?? (locale === 'th' ? 'ตัวอย่างก่อนพิมพ์' : 'Print preview')}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white text-emerald-950 font-semibold text-sm px-4 py-2 hover:opacity-90 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            {locale === 'th' ? 'พิมพ์' : 'Print'}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 text-white font-semibold text-sm px-3 py-2 hover:bg-emerald-700"
          >
            {locale === 'th' ? 'ปิด' : 'Close'}
          </button>
        </div>
      </div>

      {/* The receipt itself, in its own document so its styles are isolated */}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="print-preview"
        className="flex-1 w-full bg-white border-0"
      />
    </div>
  );
}
