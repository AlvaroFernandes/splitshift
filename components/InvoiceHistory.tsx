import React, { useState } from "react";
import type { SavedInvoice, Settings, InvLineRow } from "@/types";
import { fdInv, genId, buildPdfFilename, downloadPdf } from "@/lib/formatters";
import { DEFAULT_SETTINGS } from "@/services/settings";
import { SavedInvoiceDoc } from "./SavedInvoiceDoc";

function EditInvoiceForm({ inv, onSave, onCancel }: {
  inv: SavedInvoice;
  onSave: (updated: SavedInvoice) => void;
  onCancel: () => void;
}) {
  const [companyName, setCompanyName] = useState(inv.companyName);
  const [issueDate,   setIssueDate]   = useState(inv.issueDate);
  const [rows,        setRows]        = useState<InvLineRow[]>(inv.data.rows.map(r => ({ ...r })));
  const [newDate,     setNewDate]     = useState(inv.issueDate);
  const [newDesc,     setNewDesc]     = useState("");
  const [newAmt,      setNewAmt]      = useState("");
  const [error,       setError]       = useState<string | null>(null);

  const updateRow = (key: string, field: "description" | "amount", value: string) => {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      if (field === "amount") {
        const amt = parseFloat(value);
        return { ...r, amount: isNaN(amt) ? 0 : amt };
      }
      return { ...r, description: value };
    }));
  };

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));

  const addRow = () => {
    if (!newDate)        { setError("Date is required"); return; }
    if (!newDesc.trim()) { setError("Description is required"); return; }
    const amt = parseFloat(newAmt);
    if (isNaN(amt) || amt <= 0) { setError("Amount must be a positive number"); return; }
    setError(null);
    setRows(prev => [...prev, { key: genId(), date: newDate, description: newDesc.trim(), rate: null, hours: null, amount: amt }]);
    setNewDesc(""); setNewAmt("");
  };

  const save = () => {
    if (!companyName.trim()) { setError("Company name is required"); return; }
    if (rows.length === 0)   { setError("Invoice must have at least one line item"); return; }
    const subtotal = rows.reduce((s, r) => s + r.amount, 0);
    onSave({
      ...inv,
      companyName: companyName.trim(),
      issueDate,
      subtotal,
      data: { ...inv.data, rows },
    });
  };

  return (
    <div className="card" style={{ maxWidth: 820, margin: "0 auto" }}>
      <p style={{ fontWeight: 500, marginBottom: 12, fontSize: 13 }}>Edit invoice #{inv.invoiceNum}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="ei-company">Company</label>
          <input id="ei-company" type="text" value={companyName} onChange={e => { setCompanyName(e.target.value); setError(null); }} />
        </div>
        <div className="field" style={{ width: 160 }}>
          <label htmlFor="ei-issue-date">Issue date</label>
          <input id="ei-issue-date" type="date" value={issueDate} onChange={e => { setIssueDate(e.target.value); setError(null); }} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        {rows.map(row => (
          <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{fdInv(row.date)}</span>
            <input type="text" value={row.description} onChange={e => updateRow(row.key, "description", e.target.value)}
              style={{ flex: 1, minWidth: 120 }} />
            <input type="number" min="0" step="0.01" value={row.amount}
              onChange={e => updateRow(row.key, "amount", e.target.value)}
              style={{ width: 100, fontFamily: "var(--font-mono)" }} />
            <button className="icon-btn-sm danger" onClick={() => removeRow(row.key)} aria-label="Remove line item">
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 8 }}>
        <div className="field" style={{ width: 150 }}>
          <label htmlFor="ei-new-date">Date</label>
          <input id="ei-new-date" type="date" value={newDate} onChange={e => { setNewDate(e.target.value); setError(null); }} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="ei-new-desc">Description</label>
          <input id="ei-new-desc" type="text" placeholder="e.g. corrected amount" value={newDesc}
            onChange={e => { setNewDesc(e.target.value); setError(null); }} onKeyDown={e => e.key === "Enter" && addRow()} />
        </div>
        <div className="field" style={{ width: 130 }}>
          <label htmlFor="ei-new-amt">Amount (AUD)</label>
          <input id="ei-new-amt" type="number" min="0" step="0.01" placeholder="0.00" value={newAmt}
            onChange={e => { setNewAmt(e.target.value); setError(null); }} onKeyDown={e => e.key === "Enter" && addRow()} />
        </div>
        <button className="btn-secondary" onClick={addRow} style={{ marginBottom: 1 }}>
          <i className="ti ti-plus" aria-hidden="true" /> Add line
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--color-text-danger)", fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </p>
      )}

      <p style={{ fontSize: 13, marginBottom: 14 }}>
        New subtotal: <strong className="mono">$ {rows.reduce((s, r) => s + r.amount, 0).toFixed(2)}</strong>
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" onClick={save}>
          <i className="ti ti-check" aria-hidden="true" /> Save changes
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export const InvoiceHistory = React.memo(function InvoiceHistory({ invoices, viewing, onView, onDelete, onShare, onUpdate, pdfNamePattern }: {
  invoices: SavedInvoice[];
  viewing: SavedInvoice | null;
  onView: (inv: SavedInvoice | null) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  onUpdate: (inv: SavedInvoice) => void;
  pdfNamePattern: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [editing,     setEditing]     = useState(false);

  if (viewing) {
    if (editing) {
      return (
        <div>
          <div className="print-actions no-print">
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              <i className="ti ti-arrow-left" aria-hidden="true" /> Cancel edit
            </button>
          </div>
          <EditInvoiceForm
            inv={viewing}
            onCancel={() => setEditing(false)}
            onSave={updated => { onUpdate(updated); setEditing(false); }}
          />
        </div>
      );
    }
    return (
      <div>
        <div className="print-actions no-print">
          <button className="btn-secondary" onClick={() => onView(null)}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> Back to list
          </button>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <i className="ti ti-edit" aria-hidden="true" /> Edit
          </button>
          <button className="btn-secondary" disabled={downloading} onClick={async () => {
            setDownloading(true);
            const filename = buildPdfFilename(
              pdfNamePattern,
              viewing.invoiceNum,
              viewing.companyName,
              viewing.issueDate,
            );
            await downloadPdf("saved-invoice-doc", filename);
            setDownloading(false);
          }}>
            <i className="ti ti-download" aria-hidden="true" />
            {downloading ? "Generating…" : "Download PDF"}
          </button>
          <button className="btn-secondary" onClick={() => onShare(viewing.id)}>
            <i className="ti ti-link" aria-hidden="true" /> Copy share link
          </button>
        </div>
        <SavedInvoiceDoc inv={viewing} />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="empty-state">
        <i className="ti ti-history" aria-hidden="true" style={{ fontSize: 36, color: "var(--color-text-tertiary)" }} />
        <p>No past invoices</p>
        <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
          Mark an ABN invoice as sent to save it here
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="sr-only">Past invoices</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Issue date</th>
              <th>Company</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td className="mono" style={{ fontWeight: 500 }}>#{inv.invoiceNum}</td>
                <td className="mono" style={{ fontSize: 12 }}>{fdInv(inv.issueDate)}</td>
                <td>{inv.companyName || <span className="muted">—</span>}</td>
                <td className="mono" style={{ fontWeight: 500 }}>
                  $ {(inv.subtotal * (({ ...DEFAULT_SETTINGS, ...inv.data.settings } as Settings).gstRegistered ? 1.1 : 1)).toFixed(2)}
                </td>
                <td>
                  <span style={{ display: "flex", gap: 4 }}>
                    <button className="icon-btn-sm" onClick={() => onView(inv)} aria-label="View invoice">
                      <i className="ti ti-eye" aria-hidden="true" />
                    </button>
                    <button className="icon-btn-sm" onClick={() => onShare(inv.id)} aria-label="Copy share link"
                      title={inv.shareToken ? "Copy share link" : "Generate & copy share link"}>
                      <i className={`ti ${inv.shareToken ? "ti-link" : "ti-share"}`} aria-hidden="true" />
                    </button>
                    <button className="icon-btn-sm danger" onClick={() => onDelete(inv.id)} aria-label="Delete">
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
