import { type FirebaseApp, initializeApp } from "firebase/app";
import { type Auth, browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";

/**
 * Firebase config. These values are PUBLIC by design (they only identify the
 * project); data is protected by Firestore Security Rules, not by hiding them.
 * They are injected at build time from VITE_FIREBASE_* (GitHub Actions secrets).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** The fixed e-mail of the single shared family account (not sensitive). */
export const SHARED_ACCOUNT_EMAIL: string = import.meta.env.VITE_FIREBASE_ACCOUNT_EMAIL ?? "";

/** True when the build has a usable Firebase config. */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && SHARED_ACCOUNT_EMAIL,
);

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Keep the session across reloads/tabs so the password is typed only once.
void setPersistence(auth, browserLocalPersistence);
