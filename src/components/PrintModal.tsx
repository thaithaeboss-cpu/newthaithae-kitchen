'use client';

import { useRef } from 'react';

// iOS home-screen (standalone) PWAs block JS-initiated printing entirely:
// window.print() AND iframe.contentWindow.print() both silently do nothing,
// because a standalone web app has no Share/Print UI to invoke. The only way to
// print is to hand the receipt off to real Safari, where Share → Print works.
function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      // iOS-specific flag, true when launched from the home-screen icon
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

// A print surface that works both in a normal browser (desktop/Safari tab) and
// inside an iOS standalone PWA. It shows the receipt in an <iframe> preview with
// a visible "พิมพ์" button:
//   • normal browser  → iframe.contentWindow.print() shows the print dialog.
//   • standalone PWA  → opens the receipt in Safari (new tab) so the user can
//     print via iOS Share → Print, since in-app printing is impossible there.
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
  const standalone = isStandalonePWA();

  if (!html) return null;

  function handlePrint() {
    if (standalone) {
      // Hand off to Safari — a real browser context that can print.
      const blob = new Blob([html!], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      // No window features: a plain _blank navigation is sent to Safari, unlike
      // a sized popup which iOS renders as a chrome-less in-app view (the
      // original "no print button" bug).
      const opened = window.open(url, '_blank');
      // Revoke after a while so Safari has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (!opened) {
        alert(
          locale === 'th'
            ? 'เบราว์เซอร์บล็อกการเปิดหน้าใหม่ กรุณาอนุญาต แล้วกดพิมพ์อีกครั้ง'
            : 'The browser blocked the new tab. Allow pop-ups and tap Print again.',
        );
      }
      return;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/60">
      {/* Toolbar — always visible so there is a real button to tap */}
      <div className="flex items-center justify-between gap-2 bg-emerald-950 text-white px-4 py-3 shrink-0">
        <div className="min-w-0">
          <span className="font-semibold text-sm truncate block">
            {title ?? (locale === 'th' ? 'ตัวอย่างก่อนพิมพ์' : 'Print preview')}
          </span>
          {standalone && (
            <span className="text-[11px] text-emerald-200/80 block leading-tight">
              {locale === 'th'
                ? 'กดพิมพ์ → เปิดในเบราว์เซอร์ แล้วเลือกแชร์ → พิมพ์'
                : 'Print opens in the browser — then use Share → Print'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white text-emerald-950 font-semibold text-sm px-4 py-2 hover:opacity-90 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">
              {standalone ? 'open_in_new' : 'print'}
            </span>
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
