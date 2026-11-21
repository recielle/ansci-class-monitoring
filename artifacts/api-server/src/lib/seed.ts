import { db, studentParentsTable, studentsTable, usersTable } from "@workspace/db";

let seedPromise: Promise<void> | undefined;

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .limit(1);
      if (existing.length > 0) {
        return;
      }

      const students = await db
        .insert(studentsTable)
        .values([
          {
            cardUid: "RFID-2001",
            fullName: "Mateo Dela Cruz",
            grade: "Grade 7",
            section: "Mahogany",
            homeLocation: null,
            status: "unaccounted",
          },
          {
            cardUid: "RFID-2002",
            fullName: "Sofia Reyes",
            grade: "Grade 8",
            section: "Sampaguita",
            homeLocation: null,
            status: "unaccounted",
          },
        ])
        .returning();

      const users = await db
        .insert(usersTable)
        .values([
          {
            email: "geraldinemerjilla@gmail.com",
            displayName: "Geraldine Merjilla",
            role: "staff",
          },
          {
            email: "shanshanlosie@gmail.com",
            displayName: "Shanshan Losie",
            role: "staff",
          },
          {
            email: "songeunp926@gmail.com",
            displayName: "Songeunp926",
            role: "parent",
          },
          {
            email: "kidstory12345@gmail.com",
            displayName: "Kidstory12345",
            role: "parent",
          },
          {
            email: "gmerjilla.09.19.09@gmail.com",
            displayName: "Mateo Dela Cruz",
            role: "student",
            studentId: students[0].id,
          },
          {
            email: "gera10192009@gmail.com",
            displayName: "Sofia Reyes",
            role: "student",
            studentId: students[1].id,
          },
        ])
        .returning();

      const parentByEmail = new Map(
        users
          .filter((user) => user.role === "parent")
          .map((user) => [user.email, user.id]),
      );

      await db.insert(studentParentsTable).values([
        {
          studentId: students[0].id,
          parentUserId: parentByEmail.get("songeunp926@gmail.com")!,
        },
        {
          studentId: students[1].id,
          parentUserId: parentByEmail.get("kidstory12345@gmail.com")!,
        },
      ]);
    })().catch((error) => {
      seedPromise = undefined;
      throw error;
    });
  }

  await seedPromise;
}