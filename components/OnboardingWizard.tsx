import React, { useState } from "react";
import type { Settings } from "@/types";
import { createClient } from "@/lib/supabase";

const WORKER_STEPS = ["Password", "Profile", "Work & Pay", "Invoicing"] as const;

function PasswordFields({ pwd, confirmPwd, pwdError, pwdLoading, onChange }: {
  pwd: string; confirmPwd: string; pwdError: string | null; pwdLoading: boolean;
  onChange: (field: "pwd" | "confirm", val: string) => void;
}) {
  return (
    <div className="form-grid">
      <div className="field full">
        <label htmlFor="ob-pwd">New password</label>
        <input id="ob-pwd" type="password" placeholder="Min. 8 characters" autoFocus
          value={pwd} disabled={pwdLoading}
          onChange={e => onChange("pwd", e.target.value)} />
      </div>
      <div className="field full">
        <label htmlFor="ob-cpwd">Confirm password</label>
        <input id="ob-cpwd" type="password" placeholder="Repeat password"
          value={confirmPwd} disabled={pwdLoading}
          onChange={e => onChange("confirm", e.target.value)} />
      </div>
      {pwdError && (
        <p style={{ fontSize: 12, color: "var(--color-text-danger)", margin: 0, gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-alert-circle" aria-hidden="true" />{pwdError}
        </p>
      )}
      <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0, gridColumn: "1 / -1" }}>
        Leave both fields empty to set your password later in Settings.
      </p>
    </div>
  );
}

export const OnboardingWizard = React.memo(function OnboardingWizard({
  initialSettings, onComplete, onSkip, isAdmin,
}: {
  initialSettings: Settings;
  onComplete: (partial: Partial<Settings>) => void;
  onSkip: () => void;
  isAdmin?: boolean;
}) {
  const [step,       setStep]       = useState(0);
  const [pwd,        setPwd]        = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError,   setPwdError]   = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);
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

  const handlePwdChange = (field: "pwd" | "confirm", val: string) => {
    setPwdError(null);
    if (field === "pwd") setPwd(val); else setConfirmPwd(val);
  };

  // Validates and calls Supabase if fields are filled.
  // Returns true to proceed, false to stay on step.
  const applyPassword = async (): Promise<boolean> => {
    if (!pwd && !confirmPwd) return true; // skipped — that's fine
    if (pwd.length < 8)   { setPwdError("Password must be at least 8 characters."); return false; }
    if (pwd !== confirmPwd) { setPwdError("Passwords do not match."); return false; }
    setPwdLoading(true);
    const { error } = await createClient().auth.updateUser({ password: pwd });
    setPwdLoading(false);
    if (error) { setPwdError(error.message); return false; }
    return true;
  };

  const overlay = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} />
  );
  void overlay; // suppress unused warning — used inline below

  const skipBtn = (
    <button
      onClick={onSkip}
      style={{ fontSize: 12, color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: "4px 2px" }}
    >
      Skip for now
    </button>
  );

  // ── Admin: single password step ─────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div className="card" style={{ width: "100%", maxWidth: 460 }}>
          <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Welcome to SplitShift</p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
            Create a password to secure your admin account.
          </p>
          <PasswordFields
            pwd={pwd} confirmPwd={confirmPwd} pwdError={pwdError} pwdLoading={pwdLoading}
            onChange={handlePwdChange}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
            <button
              className="btn-primary"
              disabled={pwdLoading}
              onClick={async () => {
                const ok = await applyPassword();
                if (ok) onComplete({});
              }}
            >
              <i className="ti ti-check" aria-hidden="true" />
              {pwdLoading ? "Saving…" : "Get started"}
            </button>
            {skipBtn}
          </div>
        </div>
      </div>
    );
  }

  // ── Worker: 4-step wizard ───────────────────────────────────────────────────
  const canAdvance =
    step === 0 ? true :                          // password step always advanceable
    step === 1 ? form.yourName.trim().length > 0 // profile requires name
               : true;

  const handleNext = async () => {
    if (step === 0) {
      const ok = await applyPassword();
      if (!ok) return;
    }
    setStep(s => s + 1);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 28 }}>
          {WORKER_STEPS.map((label, i) => (
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
              {i < WORKER_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1.5, background: i < step ? "var(--color-text-warning)" : "var(--color-border-secondary)", margin: "13px 8px 0" }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0 — Password */}
        {step === 0 && (
          <>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Welcome to SplitShift</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
              First, create a password so you can log in again any time.
            </p>
            <PasswordFields
              pwd={pwd} confirmPwd={confirmPwd} pwdError={pwdError} pwdLoading={pwdLoading}
              onChange={handlePwdChange}
            />
          </>
        )}

        {/* Step 1 — Profile */}
        {step === 1 && (
          <>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Your profile</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
              Tell us a bit about yourself. Your name appears on invoices.
            </p>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="ob-name">
                  Your name <span style={{ color: "var(--color-text-danger)", fontWeight: 400 }}>*</span>
                </label>
                <input id="ob-name" type="text" placeholder="Jane Smith" autoFocus
                  value={form.yourName} onChange={e => f("yourName", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-email">Email</label>
                <input id="ob-email" type="email" placeholder="jane@example.com"
                  value={form.yourEmail} onChange={e => f("yourEmail", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-phone">Phone</label>
                <input id="ob-phone" type="text" placeholder="0400 000 000"
                  value={form.yourPhone} onChange={e => f("yourPhone", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* Step 2 — Work & Pay */}
        {step === 2 && (
          <>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Work & pay</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
              Set your default hourly rate and ABN for tax invoicing.
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="ob-rate">Default hourly rate (AUD/h)</label>
                <input id="ob-rate" type="number" min="0" step="0.01" placeholder="0.00" autoFocus
                  value={form.defaultRate} onChange={e => f("defaultRate", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-abn">
                  Your ABN <span style={{ fontWeight: 400, color: "var(--color-text-tertiary)" }}>(optional)</span>
                </label>
                <input id="ob-abn" type="text" placeholder="00 000 000 000"
                  value={form.abn} onChange={e => f("abn", e.target.value)} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 8 }}>
              You can adjust these any time in Settings.
            </p>
          </>
        )}

        {/* Step 3 — Payment */}
        {step === 3 && (
          <>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>Payment details</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
              These appear on your ABN tax invoices so your employer can pay you.
            </p>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="ob-bank">Bank name</label>
                <input id="ob-bank" type="text" placeholder="Your bank" autoFocus
                  value={form.bankName} onChange={e => f("bankName", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-bsb">BSB</label>
                <input id="ob-bsb" type="text" placeholder="000-000"
                  value={form.bsb} onChange={e => f("bsb", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-acc">Account number</label>
                <input id="ob-acc" type="text" placeholder="00000000"
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
            {step < WORKER_STEPS.length - 1 ? (
              <button className="btn-primary" onClick={handleNext} disabled={!canAdvance || pwdLoading}>
                {pwdLoading ? "Saving…" : "Next"} {!pwdLoading && <i className="ti ti-arrow-right" aria-hidden="true" />}
              </button>
            ) : (
              <button className="btn-primary" onClick={() => onComplete(form)}>
                <i className="ti ti-check" aria-hidden="true" /> Get started
              </button>
            )}
          </div>
          {skipBtn}
        </div>
      </div>
    </div>
  );
});
