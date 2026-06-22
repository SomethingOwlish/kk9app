// ============================================================
// КК9 — инициализация Firebase (modular SDK v9+)
// Конфиг проекта kk9app. Ключ не секретный — доступ режут Security Rules.
// ============================================================
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD3UJEjsWVMh2-0E4OXsuWyNnTYd1wVy68",
  authDomain: "kk9app.firebaseapp.com",
  projectId: "kk9app",
  storageBucket: "kk9app.firebasestorage.app",
  messagingSenderId: "613424707983",
  appId: "1:613424707983:web:03e0f09b8f5a422a0bb3fa",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
