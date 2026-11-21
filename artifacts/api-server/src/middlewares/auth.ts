import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { db, studentParentsTable, usersTable, type AppUser } from "@workspace/db";
import { ensureSeedData } from "../lib/seed";

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

async function sessionEmail(
  req: Parameters<RequestHandler>[0],
): Promise<string | null> {
  const auth = getAuth(req);
  const claim = auth.sessionClaims?.email;
  if (typeof claim === "string") return claim.toLowerCase();
  if (!auth.userId) return null;
  try {
    const u = await clerkClient.users.getUser(auth.userId);
    const primary = u.emailAddresses.find(
      (e) => e.id === u.primaryEmailAddressId,
    );
    const email = primary?.emailAddress ?? u.emailAddresses[0]?.emailAddress;
    return email ? email.toLowerCase() : null;
  } catch (err) {
    console.error("sessionEmail failed:", err);
    return null;
    }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  await ensureSeedData();
  const email = await sessionEmail(req);
  if (!email) {
    res.status(403).json({ error: "Your account does not have a school email" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (!user) {
    res.status(403).json({ error: "Your account is not registered for this school" });
    return;
  }

  const localUser =
    user.clerkId === auth.userId
      ? user
      : (
          await db
            .update(usersTable)
            .set({ clerkId: auth.userId })
            .where(eq(usersTable.id, user.id))
            .returning()
        )[0] ?? user;

  req.appUser = localUser;
  next();
};

export function requireRole(...roles: AppUser["role"][]): RequestHandler {
  return (req, res, next) => {
    if (!req.appUser || !roles.includes(req.appUser.role)) {
      res.status(403).json({ error: "You do not have access to this resource" });
      return;
    }
    next();
  };
}

export async function visibleStudentIds(user: AppUser): Promise<number[] | null> {
  if (user.role === "staff") {
    return null;
  }

  if (user.role === "student") {
    return user.studentId ? [user.studentId] : [];
  }

  const relationships = await db
    .select({ studentId: studentParentsTable.studentId })
    .from(studentParentsTable)
    .where(eq(studentParentsTable.parentUserId, user.id));
  return relationships.map((relationship) => relationship.studentId);
}