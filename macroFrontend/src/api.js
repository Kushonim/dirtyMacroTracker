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

export async function register(username, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
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
