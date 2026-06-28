const key = (uid) => `kk9_prefs_${uid}`;

export function loadPrefs(uid) {
  try { return JSON.parse(localStorage.getItem(key(uid)) || "{}"); }
  catch { return {}; }
}

export function savePref(uid, field, value) {
  const prefs = loadPrefs(uid);
  localStorage.setItem(key(uid), JSON.stringify({ ...prefs, [field]: value }));
}
