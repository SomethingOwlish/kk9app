// ============================================================
// КК9 — авторизация: Google + анонимный фолбэк.
// ============================================================
import {
  GoogleAuthProvider, signInWithPopup, signInAnonymously,
  signOut as fbSignOut, onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";

const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}
export function signInAnon() {
  return signInAnonymously(auth);
}
export function signOut() {
  return fbSignOut(auth);
}
// Подписка на состояние входа. cb(user|null). Возвращает unsubscribe.
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}
