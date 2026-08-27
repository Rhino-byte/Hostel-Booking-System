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
    // Already in Firebase Auth — reuse that UID so app User can link
    if (code === "auth/email-already-exists") {
      return auth.getUserByEmail(email);
    }
    throw e;
  }
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

export { isAdminConfigured };
