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
  return getAuth(app).verifyIdToken(idToken);
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
  return getAuth(app).createUser({
    email: opts.email.trim().toLowerCase(),
    password: opts.password,
    displayName: opts.displayName,
    emailVerified: false,
  });
}

export { isAdminConfigured };
