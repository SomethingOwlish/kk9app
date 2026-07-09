import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Force HTTP long polling instead of the default WebChannel streaming transport.
// On Safari/WebKit the streaming channel frequently fails to establish — realtime
// onSnapshot listeners then hang and never fire, so the app is stuck on the
// "Загрузка кампании…" placeholder even though login (which uses plain HTTPS)
// succeeds. The SDK's auto-detect long polling can itself hang mid-handshake on
// Safari, so we force long polling: it's the compatible transport that works
// across Safari, corporate proxies, and older browsers. The extra latency is
// negligible for this app's data volume.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
