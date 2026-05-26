import React, { useState } from "react";
import type { Settings } from "@/types";

const STEPS = ["Profile", "Work & Pay", "Invoicing"] as const;

export const OnboardingWizard = React.memo(function OnboardingWizard({ initialSettings, onComplete, onSkip }: {
  initialSettings: Settings;
  onComplete: (partial: Partial<Settings>) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    yourName:      initialSettings.yourName      || "",
    yourEmail:     initialSettings.yourEmail     || "",
    yourPhone:     initialSettings.yourPhone     || "",
    abn:           initialSettings.abn           || "",
    defaultRate:   initialSettings.defaultRate   || "",
    bankName:      initialSettings.bankName      || "",
    bsb:           initialSettings.bsb           || "",
    accountNumber: initialSettings.accountNumber || "",
  });

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));
  const canAdvance = step !== 0 || form.yourName.trim().length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 28 }}>
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 600,
                  background: i <= step ? "var(--color-text-warning)" : "var(--color-background-tertiary)",
                  color: i <= step ? "#fff" : "var(--color-text-tertiary)",
                  border: `1.5px solid ${i <= step ? "var(--color-text-warning)" : "var(--color-border-secondary)"}`,
                  flexShrink: 0,
                }}>
                  {i < step ? <i className="ti ti-check" style={{ fontSize: 12 }} /> : i + 1}
                </div>
                <span style={{ fontSize: 10, color: i === step ? "var(--color-text-warning)" : "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1.5, background: i < step ? "var(--color-text-warning)" : "var(--color-border-secondary)", margin: "13px 8px 0" }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1 — Profile */}
        {step === 0 && (
          <>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Welcome to SplitShift</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
              Let's set up your profile in a few quick steps.
            </p>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="ob-name">
                  Your name <span style={{ color: "var(--color-text-danger)", fontWeight: 400 }}>*</span>
                </label>
                <input id="ob-name" type="text" placeholder="Jane Smith"
                  value={form.yourName} onChange={e => f("yourName", e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label htmlFor="ob-email">Email</label>
                <input id="ob-email" type="email" placeholder="jane@example.com"
                  value={form.yourEmail} onChange={e => f("yourEmail", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-phone">Phone</label>
                <input id="ob-phone" type="text" placeholder="04XX XXX XXX"
                  value={form.yourPhone} onChange={e => f("yourPhone", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* Step 2 — Work & Pay */}
        {step === 1 && (
          <>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Work & pay</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
              Set your default hourly rate and ABN for tax invoicing.
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="ob-rate">Default hourly rate (AUD/h)</label>
                <input id="ob-rate" type="number" min="0" step="0.01" placeholder="35.00"
                  value={form.defaultRate} onChange={e => f("defaultRate", e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label htmlFor="ob-abn">
                  Your ABN <span style={{ fontWeight: 400, color: "var(--color-text-tertiary)" }}>(optional)</span>
                </label>
                <input id="ob-abn" type="text" placeholder="12 345 678 901"
                  value={form.abn} onChange={e => f("abn", e.target.value)} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 8 }}>
              You can adjust these any time in Settings.
            </p>
          </>
        )}

        {/* Step 3 — Invoicing / Payment */}
        {step === 2 && (
          <>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Payment details</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
              These appear on your ABN tax invoices so your employer can pay you.
            </p>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="ob-bank">Bank name</label>
                <input id="ob-bank" type="text" placeholder="Commonwealth Bank"
                  value={form.bankName} onChange={e => f("bankName", e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label htmlFor="ob-bsb">BSB</label>
                <input id="ob-bsb" type="text" placeholder="062-028"
                  value={form.bsb} onChange={e => f("bsb", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-acc">Account number</label>
                <input id="ob-acc" type="text" placeholder="1144-0435"
                  value={form.accountNumber} onChange={e => f("accountNumber", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>
                <i className="ti ti-arrow-left" aria-hidden="true" /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canAdvance}>
                Next <i className="ti ti-arrow-right" aria-hidden="true" />
              </button>
            ) : (
              <button className="btn-primary" onClick={() => onComplete(form)}>
                <i className="ti ti-check" aria-hidden="true" /> Get started
              </button>
            )}
          </div>
          <button
            onClick={onSkip}
            style={{ fontSize: 12, color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: "4px 2px" }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
});
