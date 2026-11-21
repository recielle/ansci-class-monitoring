import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const apiBaseUrl = (
  process.env.QR_TEST_API_BASE_URL ?? "http://localhost:8080/api"
).replace(/\/$/, "");
const deviceApiKey = process.env.DEVICE_API_KEY;
const sessionSecret = process.env.SESSION_SECRET;
const studentId = Number(process.env.QR_TEST_STUDENT_ID);

if (!deviceApiKey) {
  throw new Error("DEVICE_API_KEY is not configured in the environment.");
}
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is not configured in the environment.");
}
if (
  !process.env.QR_TEST_STUDENT_ID ||
  !Number.isSafeInteger(studentId) ||
  studentId < 1
) {
  throw new Error("Set QR_TEST_STUDENT_ID to the ID of an existing student.");
}

const SCHOOL_TIME_ZONE = "Asia/Manila";
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function schoolDateKey(date) {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function nextSchoolDayBoundary(date) {
  const nextDay = new Date(`${schoolDateKey(date)}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDate = nextDay.toISOString().slice(0, 10);
  return new Date(`${nextDate}T00:00:00.000+08:00`);
}
const now = new Date();
const today = schoolDateKey(now);
const signingKey = createHmac("sha256", sessionSecret)
  .update("rfid-attendance:daily-qr-token:v1")
  .digest();

function createTestToken(date) {
  const expiresAt = Math.floor(
    Math.min(
      now.getTime() + 120_000,
      nextSchoolDayBoundary(new Date(`${date}T00:00:00.000+08:00`)).getTime(),
    ) / 1000,
  ) * 1000;
  const payload = {
    version: 1,
    studentId,
    date,
    exp: Math.floor(expiresAt / 1000),
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingKey)
    .update(payloadPart)
    .digest("base64url");
  return `${payloadPart}.${signature}`;
}

async function verify(token) {
  const response = await fetch(`${apiBaseUrl}/attendance/qr/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-device-api-key": deviceApiKey,
    },
    body: JSON.stringify({ token, action: "in" }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

const valid = await verify(createTestToken(today));
assert.equal(valid.status, 201, `Valid token was rejected: ${valid.body.error ?? "unknown error"}`);
assert.equal(valid.body.studentId, studentId);
assert.ok(valid.body.studentName, "Successful scan should return the student's name");

const yesterday = new Date(Date.parse(`${today}T00:00:00.000Z`) - 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const expired = await verify(createTestToken(yesterday));
assert.equal(expired.status, 410, "Expired token should be rejected");
assert.match(expired.body.error, /expired/i);

const validToken = createTestToken(today);
const [payloadPart, signaturePart] = validToken.split(".");
const firstSignatureCharacter = signaturePart[0] === "A" ? "B" : "A";
const modifiedToken = `${payloadPart}.${firstSignatureCharacter}${signaturePart.slice(1)}`;
const modified = await verify(modifiedToken);
assert.equal(modified.status, 401, "Modified token should be rejected");
assert.match(modified.body.error, /signature|modified/i);

console.log(
  `QR check passed: valid token recorded ${valid.body.studentName}; expired and modified tokens were rejected.`,
);
