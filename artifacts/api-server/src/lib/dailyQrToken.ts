import { createHmac, timingSafeEqual } from "node:crypto";
import { nextSchoolDayBoundary, schoolDateKey } from "./schoolDate";

const KEY_DERIVATION_CONTEXT = "rfid-attendance:daily-qr-token:v1";
export const QR_TOKEN_TTL_SECONDS = 120;
const QR_TOKEN_TTL_MS = QR_TOKEN_TTL_SECONDS * 1000;
const SIG_BYTES = 12;

export type DailyQrTokenResult =
  | { valid: true; studentId: number; date: string; expiresAt: Date }
  | {
      valid: false;
      status: 400 | 401 | 410;
      error: string;
    };

export function isQrSigningConfigured(): boolean {
  return Boolean(process.env.SESSION_SECRET);
}

function signingKey(masterSecret: string): Buffer {
  return createHmac("sha256", masterSecret)
    .update(KEY_DERIVATION_CONTEXT)
    .digest();
}

function signatureFor(payloadPart: string, masterSecret: string): Buffer {
  return createHmac("sha256", signingKey(masterSecret))
    .update(payloadPart)
    .digest();
}

function getMasterSecret(masterSecret?: string): string {
  const value = masterSecret ?? process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("QR token signing is not configured.");
  }
  return value;
}

export function createDailyQrToken(
  studentId: number,
  now = new Date(),
  masterSecret?: string,
): { token: string; date: string; expiresAt: Date } {
  const key = getMasterSecret(masterSecret);
  const date = schoolDateKey(now);
  const expiresAt = new Date(
    Math.floor(
      Math.min(
        now.getTime() + QR_TOKEN_TTL_MS,
        nextSchoolDayBoundary(now).getTime(),
      ) / 1000,
    ) * 1000,
  );
  const body = `${studentId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  const sig = signatureFor(body, key)
    .subarray(0, SIG_BYTES)
    .toString("base64url");
  return { token: `${body}.${sig}`, date, expiresAt };
}

function invalid(
  status: 400 | 401 | 410,
  error: string,
): DailyQrTokenResult {
  return { valid: false, status, error };
}

export function verifyDailyQrToken(
  token: string,
  now = new Date(),
  masterSecret?: string,
): DailyQrTokenResult {
  const key = getMasterSecret(masterSecret);
  const parts = token.split(".");
  if (
    token.length > 100 ||
    parts.length !== 3 ||
    !/^\d{1,9}$/.test(parts[0]) ||
    !/^\d{9,12}$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]+$/.test(parts[2])
  ) {
    return invalid(400, "QR token is malformed.");
  }
  const [idPart, expPart, sigPart] = parts;
  const supplied = Buffer.from(sigPart, "base64url");
  const expected = signatureFor(`${idPart}.${expPart}`, key).subarray(
    0,
    SIG_BYTES,
  );
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return invalid(401, "QR token signature is invalid or has been modified.");
  }
  const exp = Number(expPart);
  if (exp <= Math.floor(now.getTime() / 1000)) {
    return invalid(410, "QR token has expired. Generate a new code for today.");
  }
  return {
    valid: true,
    studentId: Number(idPart),
    date: schoolDateKey(now),
    expiresAt: new Date(exp * 1000),
  };
}