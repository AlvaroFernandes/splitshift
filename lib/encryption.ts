// Server-side only — never import from client components or pages.
// AES-256-GCM field-level encryption for sensitive settings values.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const SENTINEL = "enc:v1:";

function getKey(): Buffer {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64)
    throw new Error("SETTINGS_ENCRYPTION_KEY must be a 64-char hex string");
  return Buffer.from(hex, "hex");
}

function encrypt(plain: string): string {
  const iv     = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct     = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`;
}

function decrypt(enc: string): string {
  const [ivHex, ctHex, tagHex] = enc.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(ctHex, "hex")).toString("utf8") + decipher.final("utf8");
}

// Returns the value unchanged if already encrypted or empty.
export function encryptField(value: string | undefined): string | undefined {
  if (!value) return value;
  if (value.startsWith(SENTINEL)) return value;
  return SENTINEL + encrypt(value);
}

// Returns the value unchanged if not encrypted (backwards-compatible with plain values).
export function decryptField(value: string | undefined): string | undefined {
  if (!value) return value;
  if (!value.startsWith(SENTINEL)) return value;
  return decrypt(value.slice(SENTINEL.length));
}
