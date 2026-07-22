"use client";

import React, { useState } from "react";

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  required?: boolean;
  style?: React.CSSProperties; // merged onto the <input>, for callers using inline styles
}

export const PasswordInput = React.memo(function PasswordInput({
  id, value, onChange, placeholder, autoFocus, disabled, required, style,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        style={{ ...style, width: "100%", paddingRight: 34, boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: 5,
          display: "flex", alignItems: "center", color: "var(--color-text-tertiary)",
        }}
      >
        <i className={`ti ${visible ? "ti-eye-off" : "ti-eye"}`} aria-hidden="true" style={{ fontSize: 15 }} />
      </button>
    </div>
  );
});
