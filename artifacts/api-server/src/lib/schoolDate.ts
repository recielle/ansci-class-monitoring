export const SCHOOL_TIME_ZONE = "Asia/Manila";

const schoolDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function schoolDateKey(date = new Date()): string {
  const parts = schoolDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function schoolMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

export function nextSchoolDayBoundary(date = new Date()): Date {
  const nextDay = new Date(`${schoolDateKey(date)}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDateKey = nextDay.toISOString().slice(0, 10);
  return new Date(`${nextDateKey}T00:00:00.000+08:00`);
}
