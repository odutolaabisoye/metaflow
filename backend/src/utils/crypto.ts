import crypto from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex chars)");
  }
  return key;
}

export function encryptToken(value: string): string {
  if (!value) return value;
  if (value.startsWith(PREFIX)) return value;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, encrypted, tag]).toString("base64")}`;
}

export function decryptToken(value: string): string {
  if (!value) return value;
  if (!value.startsWith(PREFIX)) return value;
  try {
    const key = getKey();
    const data = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(data.length - 16);
    const encrypted = data.subarray(12, data.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // Throw a generic error — do not surface which step failed (auth tag vs key vs format)
    // as that information aids padding/oracle-style attacks.
    throw new Error("Decryption failed");
  }
}

export function hashToken(value: string): string {
  if (!value) return value;
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
