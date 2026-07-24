/**
 * Thin wrapper around the backend's REST API. Every function here mirrors
 * one endpoint 1:1 — no caching or state lives in this file, that's handled
 * by the React components that call these.
 *
 * Swapping environments (local dev vs. the deployed API) is a one-line
 * change: just update API_BASE below.
 */
const API_BASE = "https://dirtymacrotracker.onrender.com/api";

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data; // { token, user }
}

export async function register(username, email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data; // { token, user }
}

export async function getProfile(token) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load profile");
  return data;
}

export async function updateProfile(token, profile) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profile),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save profile");
  return data;
}

export async function changePassword(token, currentPassword, newPassword) {
  const res = await fetch(`${API_BASE}/auth/password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not change password");
  return data;
}

// Public endpoint — no auth header, since guests can submit requests too.
export async function submitRequest({ request_type, restaurant_name, item_name, note }) {
  const res = await fetch(`${API_BASE}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_type, restaurant_name, item_name, note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not submit request");
  return data;
}

// Public endpoint — bugs don't care whether you're logged in.
export async function submitBugReport({ description, contact_info }) {
  const res = await fetch(`${API_BASE}/bug-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, contact_info }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not submit bug report");
  return data;
}

// Loadout history — requires auth; guests never persist their loadout.
export async function getLoadoutDates(token) {
  const res = await fetch(`${API_BASE}/loadouts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load history");
  return data; // [{ date, totalCal }]
}

export async function getLoadoutForDate(token, date) {
  const res = await fetch(`${API_BASE}/loadouts/${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null; // no saved loadout for this day yet
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load that day");
  return data; // { loadout_date, goal_type, items }
}

export async function saveLoadoutForDate(token, date, { items, goal_type }) {
  const res = await fetch(`${API_BASE}/loadouts/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items, goal_type }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save loadout");
  return data;
}

export async function deleteLoadoutForDate(token, date) {
  const res = await fetch(`${API_BASE}/loadouts/${date}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not delete that day's loadout");
  return data;
}
