









// --------------------------------------------------
// app.js (FINAL WORKING VERSION)
// --------------------------------------------------

// API BASE
const API =
  typeof window !== "undefined" && window.API
    ? window.API
    : "https://rupayana.onrender.com";

console.log("[app] Using API =", API);

// Helper
function el(id) {
  return document.getElementById(id);
}

// Page switcher
function show(id) {
  document.querySelectorAll(".page").forEach((p) => (p.style.display = "none"));
  el(id).style.display = "block";
}

// --------------------------------------------------
// safeFetch
// --------------------------------------------------
async function safeFetch(path, options = {}) {
  const url = API + path;

  try {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("HTTP ERROR:", res.status, data);
      throw new Error(data.error || "Error");
    }

    return data;
  } catch (e) {
    console.error("FETCH FAILED:", e);
    throw e;
  }
}

// --------------------------------------------------
// Local Storage Helpers
// --------------------------------------------------
function saveUser(u) {
  localStorage.setItem("user", JSON.stringify(u));
}
function loadUser() {
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}
function logout() {
  safeFetch("/api/logout", { method: "POST" });
  localStorage.removeItem("user");
  show("login-section");
}

// --------------------------------------------------
// Dashboard
// --------------------------------------------------
function showDashboard(user) {
  el("dash-name").innerText = user.name;
  el("dash-email").innerText = user.email;
  el("dash-balance").innerText = "₹" + user.balance;
  show("dashboard-section");
}

// --------------------------------------------------
// Register
// --------------------------------------------------
async function registerHandler() {
  const name = el("reg-name").value;
  const email = el("reg-email").value;
  const phone = el("reg-phone").value;
  const password = el("reg-password").value;

  try {
    const data = await safeFetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, password }),
    });

    if (data.user) {
      saveUser(data.user);
      showDashboard(data.user);
    }
  } catch (e) {
    alert("Register failed: " + e.message);
  }
}

// --------------------------------------------------
// Login
// --------------------------------------------------
async function loginHandler() {
  const email = el("log-email").value;
  const password = el("log-password").value;

  try {
    const data = await safeFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.user) {
      saveUser(data.user);
      showDashboard(data.user);
    }
  } catch (e) {
    alert("Login failed: " + e.message);
  }
}

// --------------------------------------------------
// INIT
// --------------------------------------------------
window.onload = () => {
  const user = loadUser();
  if (user) showDashboard(user);
  else show("login-section");

  if (el("reg-btn")) el("reg-btn").onclick = registerHandler;
  if (el("log-btn")) el("log-btn").onclick = loginHandler;
  if (el("logout-btn")) el("logout-btn").onclick = logout;
};
