import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function isAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

let adminApp: App | undefined;

export function getFirebaseAdmin() {
  if (!isAdminConfigured()) return null;
  if (!adminApp) {
    adminApp =
      getApps()[0] ||
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(
            /\\n/g,
            "\n"
          ),
        }),
      });
  }
  return adminApp;
}

export async function verifyFirebaseIdToken(idToken: string) {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    return await getAuth(app).verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export async function createFirebaseAuthUser(opts: {
  email: string;
  password: string;
  displayName: string;
}) {
  const app = getFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin is not configured");
  }
  const auth = getAuth(app);
  const email = opts.email.trim().toLowerCase();
  try {
    return await auth.createUser({
      email,
      password: opts.password,
      displayName: opts.displayName,
      emailVerified: false,
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "";
    // Already in Firebase Auth (e.g. Google-only) — add password provider
    if (code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(email);
      await auth.updateUser(existing.uid, {
        password: opts.password,
        displayName: opts.displayName,
      });
      return auth.getUser(existing.uid);
    }
    throw e;
  }
}

/**
 * Set or create email/password for a Firebase user.
 * Prefer UID when known; otherwise look up / create by email.
 */
export async function setFirebaseUserPassword(opts: {
  email: string;
  password: string;
  firebaseUid?: string | null;
  displayName?: string | null;
}) {
  const app = getFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin is not configured");
  }
  const auth = getAuth(app);
  const email = opts.email.trim().toLowerCase();
  const password = opts.password;
  const displayName = opts.displayName?.trim() || undefined;

  if (opts.firebaseUid) {
    try {
      await auth.updateUser(opts.firebaseUid, {
        password,
        ...(displayName ? { displayName } : {}),
        email,
      });
      return auth.getUser(opts.firebaseUid);
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: string }).code)
          : "";
      if (code !== "auth/user-not-found") throw e;
      // Fall through to email lookup / create
    }
  }

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password,
      ...(displayName ? { displayName } : {}),
    });
    return auth.getUser(existing.uid);
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "";
    if (code !== "auth/user-not-found") throw e;
  }

  return auth.createUser({
    email,
    password,
    ...(displayName ? { displayName } : {}),
    emailVerified: false,
  });
}

/** Resolve Firebase Auth UID for an email if the account already exists. */
export async function getFirebaseUidByEmail(email: string) {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    const user = await getAuth(app).getUserByEmail(email.trim().toLowerCase());
    return user.uid;
  } catch {
    return null;
  }
}

/** Delete Firebase Auth user by UID and/or email. Ignores not-found. */
export async function deleteFirebaseAuthUser(opts: {
  firebaseUid?: string | null;
  email?: string | null;
}): Promise<{ deleted: boolean; uid?: string }> {
  const app = getFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin is not configured");
  }
  const auth = getAuth(app);

  let uid = opts.firebaseUid?.trim() || null;
  if (!uid && opts.email) {
    try {
      const existing = await auth.getUserByEmail(opts.email.trim().toLowerCase());
      uid = existing.uid;
    } catch {
      return { deleted: false };
    }
  }
  if (!uid) return { deleted: false };

  try {
    await auth.deleteUser(uid);
    return { deleted: true, uid };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "";
    if (code === "auth/user-not-found") {
      return { deleted: false, uid };
    }
    throw e;
  }
}

export { isAdminConfigured };
