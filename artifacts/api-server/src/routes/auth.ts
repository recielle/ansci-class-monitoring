import { Router, type IRouter } from "express";
import { GetAuthMeResponse } from "@workspace/api-zod";
import { requireAuth, visibleStudentIds } from "../middlewares/auth";
import { db, studentsTable, type AppUser } from "@workspace/db";
import { asc, inArray } from "drizzle-orm";

const router: IRouter = Router();

async function whoAmI(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1]): Promise<void> {
  const user = req.appUser;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const ids = await visibleStudentIds(user);
  const visibleStudents = await getVisibleStudents(user, ids);
  res.json(
    GetAuthMeResponse.parse({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      visibleStudents,
    }),
  );
}

router.get("/whoami", requireAuth, whoAmI);
router.get("/auth/me", requireAuth, whoAmI);

async function getVisibleStudents(user: AppUser, ids: number[] | null) {
  if (ids && ids.length === 0) {
    return [];
  }

  const query = db
    .select()
    .from(studentsTable)
    .orderBy(asc(studentsTable.fullName));
  const students = ids
    ? await query.where(inArray(studentsTable.id, ids))
    : await query;

  return students.map(
    ({ id, cardUid, fullName, grade, section, homeLocation, status }) => ({
      id,
      cardUid,
      fullName,
      grade,
      section,
      homeLocation,
      status,
    }),
  );
}

export default router;