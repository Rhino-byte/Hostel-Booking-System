import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type Auth,
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

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(config);
  }
  if (!auth) auth = getAuth(app);
  return auth;
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(getFirebaseAuth(), provider);
}

export async function getIdTokenFromCredential(
  credential: UserCredential
): Promise<string> {
  return credential.user.getIdToken();
}
