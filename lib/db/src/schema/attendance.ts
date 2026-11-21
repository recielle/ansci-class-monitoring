import { createInsertSchema } from "drizzle-zod";
import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["student", "parent", "staff"]);
export const studentStatusEnum = pgEnum("student_status", [
  "on_campus",
  "checked_out",
  "late",
  "unaccounted",
]);

export type HomeLocation = {
  latitude: number;
  longitude: number;
};

export const studentsTable = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    cardUid: text("card_uid").notNull(),
    fullName: text("full_name").notNull(),
    grade: text("grade").notNull(),
    section: text("section").notNull(),
    homeLocation: jsonb("home_location").$type<HomeLocation | null>(),
    status: studentStatusEnum("status").notNull().default("unaccounted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    cardUidIndex: uniqueIndex("students_card_uid_idx").on(table.cardUid),
  }),
);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").unique(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: userRoleEnum("role").notNull(),
    studentId: integer("student_id").references(() => studentsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIndex: uniqueIndex("users_email_idx").on(table.email),
    studentUserIndex: uniqueIndex("users_student_id_idx").on(table.studentId),
  }),
);

export const studentParentsTable = pgTable(
  "student_parents",
  {
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id),
    parentUserId: integer("parent_user_id")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    relationshipIndex: uniqueIndex("student_parents_relationship_idx").on(
      table.studentId,
      table.parentUserId,
    ),
  }),
);

export const attendanceEventsTable = pgTable("attendance_events", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id),
  deviceId: text("device_id").notNull(),
  action: text("action").$type<"in" | "out">().notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  schoolDate: date("school_date", { mode: "string" }).notNull(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AppUser = typeof usersTable.$inferSelect;

export const insertStudentParentSchema = createInsertSchema(
  studentParentsTable,
).omit({ createdAt: true });
export type InsertStudentParent = z.infer<typeof insertStudentParentSchema>;
export type StudentParent = typeof studentParentsTable.$inferSelect;

export const insertAttendanceEventSchema = createInsertSchema(
  attendanceEventsTable,
).omit({ id: true });
export type InsertAttendanceEvent = z.infer<typeof insertAttendanceEventSchema>;
export type AttendanceEvent = typeof attendanceEventsTable.$inferSelect;