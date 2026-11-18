import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

function isConfiguredAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (envAdmins.includes(normalized)) {
    return true;
  }

  if (normalized === 'ebaluegbefodestiny@gmail.com') {
    return true;
  }

  return false;
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string | null) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const current = existing[0];
      const shouldBeAdmin = isConfiguredAdminEmail(email) && current.role !== 'admin';
      if (shouldBeAdmin || (displayName && displayName !== current.displayName)) {
        const updated = await db
          .update(users)
          .set({
            email,
            displayName: displayName ?? current.displayName,
            role: shouldBeAdmin ? 'admin' : current.role,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return current;
    }

    const totalUsersResult = await db.select({ total: count() }).from(users);
    const isFirstUser = Number(totalUsersResult[0]?.total ?? 0) === 0;
    const assignedRole = isFirstUser || isConfiguredAdminEmail(email) ? 'admin' : 'user';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        role: assignedRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || undefined,
          updatedAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database user lookup failed:', error);
    throw new Error('Failed to retrieve user profile.', { cause: error });
  }
}
