import {
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { studentsTable } from "./attendance";

export const studentLocationPingsTable = pgTable(
  "student_location_pings",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    pingedAt: timestamp("pinged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    studentPingedAtIndex: index("student_location_pings_student_time_idx").on(
      table.studentId,
      table.pingedAt,
    ),
  }),
);

export type StudentLocationPing = typeof studentLocationPingsTable.$inferSelect;
