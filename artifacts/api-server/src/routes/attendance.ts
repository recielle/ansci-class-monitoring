import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  attendanceEventsTable,
  db,
  studentsTable,
  type AppUser,
} from "@workspace/db";
import {
  CreateAttendanceTapBody,
  CreateAttendanceTapResponse,
  CreateDailyQrTokenBody,
  CreateDailyQrTokenResponse,
  GetAttendanceSummaryQueryParams,
  GetAttendanceSummaryResponse,
  ListAttendanceRecordsQueryParams,
  ListAttendanceRecordsResponse,
  ListRecentAttendanceQueryParams,
  ListRecentAttendanceResponse,
  ListStudentsResponse,
  VerifyDailyQrTokenBody,
  VerifyDailyQrTokenResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requireRole,
  visibleStudentIds,
} from "../middlewares/auth";
import { requireDeviceApiKey } from "../middlewares/deviceApiKey";
import {
  createDailyQrToken,
  isQrSigningConfigured,
  verifyDailyQrToken,
} from "../lib/dailyQrToken";
import { schoolDateKey, schoolMinutesOfDay } from "../lib/schoolDate";

const router: IRouter = Router();

type AttendanceStatus = "present" | "late" | "absent" | "checked-out";

function dateFromQuery(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date("invalid") : parsed;
}

function getStatus(
  events: Array<typeof attendanceEventsTable.$inferSelect>,
): AttendanceStatus {
  const lastEvent = events[0];
  if (!lastEvent) {
    return "absent";
  }

  if (lastEvent.action === "out") {
    return "checked-out";
  }

  const firstIn = events
    .filter((event) => event.action === "in")
    .sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    )[0]?.occurredAt;
  if (!firstIn) {
    return "absent";
  }

  const minutes = schoolMinutesOfDay(firstIn);
  return minutes > 8 * 60 + 15 ? "late" : "present";
}

async function getVisibleStudents(user: AppUser) {
  const ids = await visibleStudentIds(user);
  if (ids && ids.length === 0) {
    return [];
  }

  if (ids) {
    return db
      .select()
      .from(studentsTable)
      .where(inArray(studentsTable.id, ids))
      .orderBy(asc(studentsTable.fullName));
  }

  return db.select().from(studentsTable).orderBy(asc(studentsTable.fullName));
}

async function getRecords(date: string, user: AppUser) {
  const students = await getVisibleStudents(user);
  if (students.length === 0) {
    return [];
  }

  const ids = students.map((student) => student.id);
  const events = await db
    .select()
    .from(attendanceEventsTable)
    .where(
      and(
        eq(attendanceEventsTable.schoolDate, date),
        inArray(attendanceEventsTable.studentId, ids),
      ),
    )
    .orderBy(desc(attendanceEventsTable.occurredAt));

  return students.map((student) => {
    const studentEvents = events.filter(
      (event) => event.studentId === student.id,
    );
    const firstTapAt =
      studentEvents
        .filter((event) => event.action === "in")
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0]
        ?.occurredAt ?? null;
    const lastEvent = studentEvents[0];

    return {
      studentId: student.id,
      studentName: student.fullName,
      grade: student.grade,
      section: student.section,
      cardUid: student.cardUid,
      status: getStatus(studentEvents),
      firstTapAt,
      lastTapAt: lastEvent?.occurredAt ?? null,
      deviceId: lastEvent?.deviceId ?? null,
    };
  });
}

async function recordAttendanceEvent(
  student: typeof studentsTable.$inferSelect,
  deviceId: string,
  action: "in" | "out",
  occurredAt = new Date(),
) {
  const [event] = await db
    .insert(attendanceEventsTable)
    .values({
      studentId: student.id,
      deviceId,
      action,
      occurredAt,
      schoolDate: schoolDateKey(occurredAt),
    })
    .returning();

  return CreateAttendanceTapResponse.parse({
    id: event.id,
    studentId: student.id,
    studentName: student.fullName,
    grade: student.grade,
    section: student.section,
    cardUid: student.cardUid,
    deviceId: event.deviceId,
    action: event.action,
    occurredAt: event.occurredAt,
  });
}

async function verifyAndRecordDailyQr(
  req: Request,
  res: Response,
  scannerId: "QR-SCANNER" | "STAFF-QR-SCANNER",
): Promise<void> {
  const parsed = VerifyDailyQrTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Include a QR token and an action of either 'in' or 'out'.",
    });
    return;
  }

  if (!isQrSigningConfigured()) {
    res.status(503).json({
      error:
        "QR verification is not configured: server signing secret is missing.",
    });
    return;
  }

  const verification = verifyDailyQrToken(parsed.data.token);
  if (!verification.valid) {
    res.status(verification.status).json({ error: verification.error });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, verification.studentId))
    .limit(1);
  if (!student) {
    res
      .status(404)
      .json({ error: "The student in this QR token was not found." });
    return;
  }

  const event = await recordAttendanceEvent(
    student,
    scannerId,
    parsed.data.action,
  );
  res.status(201).json(VerifyDailyQrTokenResponse.parse(event));
}

router.post(
  "/attendance/qr/verify",
  requireDeviceApiKey,
  async (req, res): Promise<void> => {
    await verifyAndRecordDailyQr(req, res, "QR-SCANNER");
  },
);

router.use(requireAuth);

router.post(
  "/attendance/qr/staff-verify",
  requireRole("staff"),
  async (req, res): Promise<void> => {
    await verifyAndRecordDailyQr(req, res, "STAFF-QR-SCANNER");
  },
);

router.post("/attendance/qr-tokens", async (req, res): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = CreateDailyQrTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid studentId is required." });
    return;
  }

  if (!isQrSigningConfigured()) {
    res.status(503).json({
      error:
        "QR token generation is not configured: server signing secret is missing.",
    });
    return;
  }

  const studentId = parsed.data.studentId;
  const visibleIds = await visibleStudentIds(user);
  if (visibleIds && !visibleIds.includes(studentId)) {
    res
      .status(404)
      .json({ error: "Student not found or not available to your account." });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);
  if (!student) {
    res
      .status(404)
      .json({ error: "Student not found or not available to your account." });
    return;
  }

  const qr = createDailyQrToken(student.id);
  res.json(
    CreateDailyQrTokenResponse.parse({
      token: qr.token,
      studentId: student.id,
      studentName: student.fullName,
      date: new Date(`${qr.date}T00:00:00.000Z`),
      expiresAt: qr.expiresAt,
    }),
  );
});

router.get("/students", async (req, res): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const students = await getVisibleStudents(user);
  res.json(
    ListStudentsResponse.parse(
      students.map(
        ({ id, cardUid, fullName, grade, section, homeLocation, status }) => ({
          id,
          cardUid,
          fullName,
          grade,
          section,
          homeLocation,
          status,
        }),
      ),
    ),
  );
});

router.get("/attendance/summary", async (req, res): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = GetAttendanceSummaryQueryParams.safeParse({
    date: dateFromQuery(req.query.date),
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const date = parsed.data.date
    ? schoolDateKey(parsed.data.date)
    : schoolDateKey();
  const records = await getRecords(date, user);
  const present = records.filter(
    (record) => record.status === "present",
  ).length;
  const late = records.filter((record) => record.status === "late").length;
  const absent = records.filter((record) => record.status === "absent").length;
  const checkedOut = records.filter(
    (record) => record.status === "checked-out",
  ).length;

  const gradeMap = new Map<
    string,
    { grade: string; present: number; absent: number; total: number }
  >();
  for (const record of records) {
    const current = gradeMap.get(record.grade) ?? {
      grade: record.grade,
      present: 0,
      absent: 0,
      total: 0,
    };
    current.total += 1;
    if (record.status === "absent") current.absent += 1;
    else current.present += 1;
    gradeMap.set(record.grade, current);
  }

  res.json(
    GetAttendanceSummaryResponse.parse({
      date: new Date(`${date}T00:00:00.000Z`),
      totalStudents: records.length,
      present,
      late,
      absent,
      checkedOut,
      attendanceRate:
        records.length === 0
          ? 0
          : ((present + late + checkedOut) / records.length) * 100,
      lastSyncAt: new Date(),
      byGrade: [...gradeMap.values()],
    }),
  );
});

router.get("/attendance/records", async (req, res): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = ListAttendanceRecordsQueryParams.safeParse({
    date: dateFromQuery(req.query.date),
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const date = parsed.data.date
    ? schoolDateKey(parsed.data.date)
    : schoolDateKey();
  const records = await getRecords(date, user);
  const filtered = parsed.data.status
    ? records.filter((record) => record.status === parsed.data.status)
    : records;
  res.json(ListAttendanceRecordsResponse.parse(filtered));
});

router.get("/attendance/recent", async (req, res): Promise<void> => {
  const user = req.appUser;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = ListRecentAttendanceQueryParams.safeParse({
    limit:
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : req.query.limit,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ids = await visibleStudentIds(user);
  if (ids && ids.length === 0) {
    res.json([]);
    return;
  }

  const events = ids
    ? await db
        .select({
          id: attendanceEventsTable.id,
          studentId: studentsTable.id,
          studentName: studentsTable.fullName,
          grade: studentsTable.grade,
          section: studentsTable.section,
          cardUid: studentsTable.cardUid,
          deviceId: attendanceEventsTable.deviceId,
          action: attendanceEventsTable.action,
          occurredAt: attendanceEventsTable.occurredAt,
        })
        .from(attendanceEventsTable)
        .innerJoin(
          studentsTable,
          eq(attendanceEventsTable.studentId, studentsTable.id),
        )
        .where(inArray(attendanceEventsTable.studentId, ids))
        .orderBy(desc(attendanceEventsTable.occurredAt))
        .limit(parsed.data.limit)
    : await db
        .select({
          id: attendanceEventsTable.id,
          studentId: studentsTable.id,
          studentName: studentsTable.fullName,
          grade: studentsTable.grade,
          section: studentsTable.section,
          cardUid: studentsTable.cardUid,
          deviceId: attendanceEventsTable.deviceId,
          action: attendanceEventsTable.action,
          occurredAt: attendanceEventsTable.occurredAt,
        })
        .from(attendanceEventsTable)
        .innerJoin(
          studentsTable,
          eq(attendanceEventsTable.studentId, studentsTable.id),
        )
        .orderBy(desc(attendanceEventsTable.occurredAt))
        .limit(parsed.data.limit);
  res.json(ListRecentAttendanceResponse.parse(events));
});

router.post(
  "/attendance/taps",
  requireRole("staff"),
  async (req, res): Promise<void> => {
    const parsed = CreateAttendanceTapBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [student] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.cardUid, parsed.data.cardUid))
      .limit(1);
    if (!student) {
      res.status(404).json({ error: "RFID card is not registered" });
      return;
    }

    const event = await recordAttendanceEvent(
      student,
      parsed.data.deviceId,
      parsed.data.action,
      parsed.data.occurredAt ?? new Date(),
    );
    res.status(201).json(event);
  },
);

export default router;
