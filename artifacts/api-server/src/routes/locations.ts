import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
} from "drizzle-orm";
import {
  attendanceEventsTable,
  db,
  studentLocationPingsTable,
  studentsTable,
} from "@workspace/db";
import {
  CreateStudentLocationPingBody,
  CreateStudentLocationPingResponse,
  GetStudentLocationStatusResponse,
  ListLatestStudentLocationsResponse,
  UpdateStudentHomeLocationBody,
  UpdateStudentHomeLocationParams,
  UpdateStudentHomeLocationResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requireRole,
  visibleStudentIds,
} from "../middlewares/auth";
import { schoolDateKey } from "../lib/schoolDate";
import { ARRIVED_M, estimateEta, meters } from "../lib/eta";

const router: IRouter = Router();
const MIN_LOCATION_PING_INTERVAL_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type AttendanceEvent = typeof attendanceEventsTable.$inferSelect;

function schoolDayAge(event: AttendanceEvent, now: Date): number {
  const todayStart = Date.parse(`${schoolDateKey(now)}T00:00:00.000Z`);
  const eventDayStart = Date.parse(`${event.schoolDate}T00:00:00.000Z`);
  return Math.floor((todayStart - eventDayStart) / DAY_MS);
}

function getLocationStatusForEvent(
  event: AttendanceEvent | null,
  now = new Date(),
): {
  active: boolean;
  state: "no_checkout" | "checked_out" | "checked_in" | "checkout_expired";
  lastAttendanceAt: Date | null;
} {
  if (!event) {
    return {
      active: false,
      state: "no_checkout",
      lastAttendanceAt: null,
    };
  }

  if (event.action === "in") {
    return {
      active: false,
      state: "checked_in",
      lastAttendanceAt: event.occurredAt,
    };
  }

  const age = schoolDayAge(event, now);
  const stillInCheckoutWindow =
    age >= 0 && age <= 1 && event.occurredAt.getTime() <= now.getTime();

  return {
    active: stillInCheckoutWindow,
    state: stillInCheckoutWindow ? "checked_out" : "checkout_expired",
    lastAttendanceAt: event.occurredAt,
  };
}

async function getLatestAttendanceEvent(studentId: number) {
  const [event] = await db
    .select()
    .from(attendanceEventsTable)
    .where(eq(attendanceEventsTable.studentId, studentId))
    .orderBy(desc(attendanceEventsTable.occurredAt), desc(attendanceEventsTable.id))
    .limit(1);

  return event ?? null;
}

async function getStudentLocationStatus(studentId: number) {
  return getLocationStatusForEvent(await getLatestAttendanceEvent(studentId));
}

router.use(requireAuth);

router.get(
  "/attendance/location/status",
  requireRole("student"),
  async (req, res): Promise<void> => {
    const user = req.appUser;
    if (!user?.studentId) {
      res.json(
        GetStudentLocationStatusResponse.parse({
          active: false,
          state: "no_checkout",
          lastAttendanceAt: null,
        }),
      );
      return;
    }

    const status = await getStudentLocationStatus(user.studentId);
    res.json(GetStudentLocationStatusResponse.parse(status));
  },
);

router.get(
  "/attendance/notifications",
  requireRole("parent"),
  async (req, res): Promise<void> => {
    const user = req.appUser;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const ids = await visibleStudentIds(user);
    if (!ids || ids.length === 0) {
      res.json([]);
      return;
    }
    const children = await db
      .select()
      .from(studentsTable)
      .where(inArray(studentsTable.id, ids));
    const nameById = new Map(children.map((c) => [c.id, c.fullName]));

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const events = await db
      .select()
      .from(attendanceEventsTable)
      .where(
        and(
          inArray(attendanceEventsTable.studentId, ids),
          gte(attendanceEventsTable.occurredAt, since),
        ),
      )
      .orderBy(
        desc(attendanceEventsTable.occurredAt),
        desc(attendanceEventsTable.id),
      )
      .limit(60);

    const items: Array<{
      id: string;
      kind: string;
      studentId: number;
      studentName: string;
      at: Date;
    }> = events.map((e) => ({
      id: `event-${e.id}`,
      kind: e.action === "in" ? "checked_in" : "checked_out",
      studentId: e.studentId,
      studentName: nameById.get(e.studentId) ?? "Student",
      at: e.occurredAt,
    }));

    for (const child of children) {
      if (!child.homeLocation) continue;
      const lastOut = events.find(
        (e) => e.studentId === child.id && e.action === "out",
      );
      if (!lastOut) continue;
      const pings = await db
        .select()
        .from(studentLocationPingsTable)
        .where(
          and(
            eq(studentLocationPingsTable.studentId, child.id),
            gte(studentLocationPingsTable.pingedAt, lastOut.occurredAt),
          ),
        )
        .orderBy(asc(studentLocationPingsTable.pingedAt))
        .limit(500);
      const home = {
        lat: Number(child.homeLocation.latitude),
        lng: Number(child.homeLocation.longitude),
      };
      const arrival = pings.find(
        (p) =>
          meters({ lat: Number(p.latitude), lng: Number(p.longitude) }, home) <=
          ARRIVED_M,
      );
      if (arrival) {
        items.push({
          id: `arrived-${child.id}-${lastOut.id}`,
          kind: "arrived_home",
          studentId: child.id,
          studentName: child.fullName,
          at: arrival.pingedAt,
        });
      }
    }
    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    res.json(items.slice(0, 30));
  },
);

router.post(
  "/attendance/location/pings",
  requireRole("student"),
  async (req, res): Promise<void> => {
    const user = req.appUser;
    if (!user?.studentId) {
      res.status(403).json({ error: "No student profile is linked to this account." });
      return;
    }

    const parsed = CreateStudentLocationPingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid latitude and longitude." });
      return;
    }

    const now = new Date();
    const status = await getStudentLocationStatus(user.studentId);
    if (!status.active) {
      res.status(409).json({
        error:
          status.state === "checked_in"
            ? "Location sharing stopped because you checked in."
            : "Location sharing is available only after checkout.",
      });
      return;
    }

    const [lastPing] = await db
      .select({ pingedAt: studentLocationPingsTable.pingedAt })
      .from(studentLocationPingsTable)
      .where(eq(studentLocationPingsTable.studentId, user.studentId))
      .orderBy(desc(studentLocationPingsTable.pingedAt))
      .limit(1);

    if (
      lastPing &&
      now.getTime() - lastPing.pingedAt.getTime() <
        MIN_LOCATION_PING_INTERVAL_MS
    ) {
      const retryAfter = Math.ceil(
        (MIN_LOCATION_PING_INTERVAL_MS -
          (now.getTime() - lastPing.pingedAt.getTime())) /
          1000,
      );
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: `Please wait ${retryAfter} seconds before sending another location update.`,
      });
      return;
    }

    const [ping] = await db
      .insert(studentLocationPingsTable)
      .values({
        studentId: user.studentId,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        pingedAt: now,
      })
      .returning();

        await db
      .delete(studentLocationPingsTable)
      .where(
        and(
          eq(studentLocationPingsTable.studentId, user.studentId),
          lte(studentLocationPingsTable.pingedAt, new Date(Date.now() - DAY_MS)),
        ),
      );
    
    res
      .status(201)
      .json(CreateStudentLocationPingResponse.parse(ping));
  },
);

router.get(
  "/attendance/location/latest",
  requireRole("parent", "staff"),
  async (req, res): Promise<void> => {
    const user = req.appUser;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const visibleIds = await visibleStudentIds(user);
    if (visibleIds && visibleIds.length === 0) {
      res.json(ListLatestStudentLocationsResponse.parse([]));
      return;
    }

    const studentsQuery = db
      .select()
      .from(studentsTable)
      .orderBy(asc(studentsTable.fullName));
    const students = visibleIds
      ? await studentsQuery.where(inArray(studentsTable.id, visibleIds))
      : await studentsQuery;
    const studentIds = students.map((student) => student.id);

    if (studentIds.length === 0) {
      res.json(ListLatestStudentLocationsResponse.parse([]));
      return;
    }

    const latestPings = await db
      .selectDistinctOn([studentLocationPingsTable.studentId])
      .from(studentLocationPingsTable)
      .where(inArray(studentLocationPingsTable.studentId, studentIds))
      .orderBy(
        studentLocationPingsTable.studentId,
        desc(studentLocationPingsTable.pingedAt),
        desc(studentLocationPingsTable.id),
      );

    const today = schoolDateKey();
    const yesterday = new Date(
      Date.parse(`${today}T00:00:00.000Z`) - DAY_MS,
    )
      .toISOString()
      .slice(0, 10);
    const now = new Date();
    const recentEvents = await db
      .select()
      .from(attendanceEventsTable)
      .where(
        and(
          inArray(attendanceEventsTable.studentId, studentIds),
          gte(attendanceEventsTable.schoolDate, yesterday),
          lte(attendanceEventsTable.schoolDate, today),
        ),
      )
      .orderBy(
        attendanceEventsTable.studentId,
        desc(attendanceEventsTable.occurredAt),
        desc(attendanceEventsTable.id),
      );

    const pingByStudent = new Map(
      latestPings.map((ping) => [ping.studentId, ping]),
    );
    const eventByStudent = new Map<number, AttendanceEvent>();
    for (const event of recentEvents) {
      if (!eventByStudent.has(event.studentId)) {
        eventByStudent.set(event.studentId, event);
      }
    }

    const response = students.map((student) => {
      const ping = pingByStudent.get(student.id);
      const state = getLocationStatusForEvent(
        eventByStudent.get(student.id) ?? null,
        now,
      );
      return {
        studentId: student.id,
        studentName: student.fullName,
        grade: student.grade,
        section: student.section,
        latitude: ping?.latitude ?? null,
        longitude: ping?.longitude ?? null,
        pingedAt: ping?.pingedAt ?? null,
        trackingActive: state.active,
        homeLocation:
          user.role === "parent" ? student.homeLocation : null,
      };
    });

    res.json(ListLatestStudentLocationsResponse.parse(response));
  },
);

router.put(
  "/attendance/students/:studentId/home-location",
  requireRole("parent"),
  async (req, res): Promise<void> => {
    const user = req.appUser;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsedParams = UpdateStudentHomeLocationParams.safeParse({
      studentId: req.params.studentId,
    });
    const parsedBody = UpdateStudentHomeLocationBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "Enter a valid student ID and coordinates." });
      return;
    }

    const visibleIds = await visibleStudentIds(user);
    if (!visibleIds?.includes(parsedParams.data.studentId)) {
      res.status(404).json({ error: "Child not found for this parent account." });
      return;
    }

    const homeLocation = {
      latitude: parsedBody.data.latitude,
      longitude: parsedBody.data.longitude,
    };
    const [updatedStudent] = await db
      .update(studentsTable)
      .set({ homeLocation })
      .where(eq(studentsTable.id, parsedParams.data.studentId))
      .returning({ id: studentsTable.id });

    if (!updatedStudent) {
      res.status(404).json({ error: "Child not found for this parent account." });
      return;
    }

    res.json(
      UpdateStudentHomeLocationResponse.parse({
        studentId: updatedStudent.id,
        homeLocation,
      }),
    );
  },
);

router.get(
  "/attendance/location/eta",
  requireRole("parent"),
  async (req, res): Promise<void> => {
    const user = req.appUser;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const ids = await visibleStudentIds(user);
    if (!ids || ids.length === 0) {
      res.json([]);
      return;
    }
    const children = await db
      .select()
      .from(studentsTable)
      .where(inArray(studentsTable.id, ids));

    const results: Array<Record<string, unknown>> = [];
    for (const child of children) {
      const status = await getStudentLocationStatus(child.id);
      if (!status.active) {
        results.push({ studentId: child.id, state: "not_tracking" });
        continue;
      }
      if (!child.homeLocation) {
        results.push({ studentId: child.id, state: "no_home" });
        continue;
      }
      const pings = await db
        .select()
        .from(studentLocationPingsTable)
        .where(eq(studentLocationPingsTable.studentId, child.id))
        .orderBy(desc(studentLocationPingsTable.pingedAt))
        .limit(10);
      const latest = pings[0];
      if (!latest) {
        results.push({ studentId: child.id, state: "no_pings" });
        continue;
      }
      if (Date.now() - latest.pingedAt.getTime() > 5 * 60 * 1000) {
        results.push({ studentId: child.id, state: "stale", updatedAt: latest.pingedAt });
        continue;
      }
      const eta = estimateEta(
        pings.map((p) => ({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          at: p.pingedAt,
        })),
        {
          lat: Number(child.homeLocation.latitude),
          lng: Number(child.homeLocation.longitude),
        },
      );
      results.push({ studentId: child.id, updatedAt: latest.pingedAt, ...eta });
    }
    res.json(results);
  },
);

export default router;
