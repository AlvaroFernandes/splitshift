"use client";

import React from "react";
import { fd } from "@/lib/formatters";

export interface AppNotification {
  key: string;
  icon: string;          // tabler icon name, e.g. "ti-lock-open"
  text: string;
  action: string;        // button label
  tab: string;           // tab the action opens
}

// Bell in the header with a dropdown of things the worker needs to do.
// Items are derived from app state, so each one disappears once it's done
// (e.g. the week is closed) — there's nothing to mark as read.
export function NotificationsMenu({ items, onNavigate }: {
  items: AppNotification[];
  onNavigate: (tab: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey   = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const count = items.length;

  return (
    <div className="notif" ref={ref}>
      <button className="icon-btn notif-btn" onClick={() => setOpen(o => !o)}
        aria-label={count ? `Notifications (${count})` : "Notifications"} aria-expanded={open} aria-haspopup="true">
        <i className={`ti ${count ? "ti-bell-ringing" : "ti-bell"}`} aria-hidden="true" />
        {count > 0 && <span className="notif-count">{count > 9 ? "9+" : count}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-head">Notifications</div>
          {count === 0 ? (
            <div className="notif-empty">
              <i className="ti ti-circle-check" aria-hidden="true" />
              You&apos;re all caught up
            </div>
          ) : (
            <ul className="notif-list">
              {items.map(n => (
                <li key={n.key} className="notif-item">
                  <i className={`ti ${n.icon}`} aria-hidden="true" />
                  <span className="notif-text">{n.text}</span>
                  <button className="btn-secondary notif-action" role="menuitem"
                    onClick={() => { setOpen(false); onNavigate(n.tab); }}>
                    {n.action}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Close-week reminders: one per finished week that still has open entries.
export function closeWeekNotifications(weeks: { ws: string; needsInvoice: boolean }[]): AppNotification[] {
  return weeks.map(({ ws, needsInvoice }) => needsInvoice
    ? { key: `close-${ws}`, icon: "ti-receipt",   text: `Week of ${fd(ws)} is over and needs an invoice`, action: "Create invoice", tab: "abn" }
    : { key: `close-${ws}`, icon: "ti-lock-open", text: `Week of ${fd(ws)} is over — close it if all your hours are in`, action: "Close week", tab: "tfn" });
}
