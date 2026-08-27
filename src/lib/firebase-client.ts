import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.appId &&
      process.env.NEXT_PUBLIC_DEMO_AUTH !== "true"
  );
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let persistenceReady: Promise<void> | undefined;

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(config);
  }
  if (!auth) {
    auth = getAuth(app);
    persistenceReady = setPersistence(auth, browserLocalPersistence).catch(
      () => undefined
    );
  }
  return auth;
}

async function ensurePersistence() {
  getFirebaseAuth();
  await persistenceReady;
}

export class GoogleRedirectStarted extends Error {
  constructor() {
    super("google-redirect");
    this.name = "GoogleRedirectStarted";
  }
}

function authCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: string }).code);
  }
  return "";
}

export function firebaseAuthMessage(err: unknown): string {
  switch (authCode(err)) {
    case "auth/popup-blocked":
      return "Pop-up was blocked. Allow pop-ups for this site and try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before finishing.";
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Incorrect email or password";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/account-exists-with-different-credential":
      return "This email is already used with a different sign-in method.";
    default:
      return err instanceof Error ? err.message : "Sign-in failed";
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<UserCredential> {
  await ensurePersistence();
  return signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

export async function signInWithGoogle(opts?: {
  forceAccountPicker?: boolean;
}): Promise<UserCredential> {
  await ensurePersistence();
  const a = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  if (opts?.forceAccountPicker) {
    provider.setCustomParameters({ prompt: "select_account" });
  }
  try {
    return await signInWithPopup(a, provider);
  } catch (err) {
    const code = authCode(err);
    if (code === "auth/popup-blocked") {
      await signInWithRedirect(a, provider);
      throw new GoogleRedirectStarted();
    }
    throw err;
  }
}

export async function completeGoogleRedirect(): Promise<UserCredential | null> {
  if (!isFirebaseConfigured()) return null;
  await ensurePersistence();
  return getRedirectResult(getFirebaseAuth());
}

export async function waitForFirebaseUser(
  timeoutMs = 2500
): Promise<User | null> {
  if (!isFirebaseConfigured()) return null;
  await ensurePersistence();
  const a = getFirebaseAuth();
  if (a.currentUser) return a.currentUser;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(a.currentUser);
    }, timeoutMs);
    const unsub = onAuthStateChanged(a, (user) => {
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}

export async function getIdTokenFromCurrentUser(): Promise<string | null> {
  const user = await waitForFirebaseUser();
  if (!user) return null;
  return user.getIdToken();
}

export async function getIdTokenFromCredential(
  credential: UserCredential
): Promise<string> {
  return credential.user.getIdToken();
}

export async function signOutFirebase() {
  if (!isFirebaseConfigured()) return;
  try {
    await ensurePersistence();
    await signOut(getFirebaseAuth());
  } catch {
    // Ignore — app cookie is the source of truth for this request
  }
}
