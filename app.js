// app.js — frontend (safe + sidebar push)
const API = (typeof window !== "undefined" && window.API) ? window.API : "https://rupayana.onrender.com";
const el = id => document.getElementById(id);

// Hide loader safely
window.onload = () => {
  try {
    const loader = el("loader");
    if (loader) setTimeout(() => (loader.style.display = "none"), 400);
  } catch(e){}

  const user = loadUser();
  if (user && el("dashboard-section")) showDashboard(user);
  else if (el("login-section")) show("login-section");
  else {
    const any = document.querySelector(".page");
    if (any) any.style.display = "block";
  }
};

// MENU toggle: add class to body so CSS can shift main
const menuBtn = el("menu-btn");
if (menuBtn) {
  menuBtn.onclick = () => {
    const sidebar = el("sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("open");
    document.body.classList.toggle("sb-open");
  };
}

// safe el clicks
function safeOn(id, fn) {
  const e = el(id);
  if (e) e.onclick = fn;
}

// Navigation & show
function show(pageID) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const t = el(pageID);
  if (t) t.classList.add("active");
}
function navigate(pageID) {
  show(pageID);
  const sidebar = el("sidebar");
  if (sidebar) sidebar.classList.remove("open");
  document.body.classList.remove("sb-open");
}

// Storage
function saveUser(u) { try { localStorage.setItem("user", JSON.stringify(u)); } catch(e){} }
function loadUser() { try { const u = localStorage.getItem("user"); return u ? JSON.parse(u) : null; } catch(e){ return null; } }

// Update dashboard UI
function showDashboard(user) {
  if (!user) return;
  show("dashboard-section");
  if (el("dash-name")) el("dash-name").innerText = user.name || "";
  if (el("dash-email")) el("dash-email").innerText = user.email || "";
  if (el("dash-phone")) el("dash-phone").innerText = user.phone || "";
  if (el("dash-balance")) el("dash-balance").innerText = "₹" + (user.balance || 0);
  if (el("user-sidebar-name")) el("user-sidebar-name").innerText = user.name || "User";
}

// fetch wrapper
async function safeFetch(path, data = {}) {
  const res = await fetch(API + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json;
}

// wire buttons safely
safeOn("log-btn", async () => {
  try {
    const email = el("log-email") ? el("log-email").value : "";
    const password = el("log-password") ? el("log-password").value : "";
    if (!email || !password) { alert("Enter email & password"); return; }
    const r = await safeFetch("/api/login", { email, password });
    saveUser(r.user);
    showDashboard(r.user);
  } catch (e) { alert("Login failed: " + e.message); }
});

safeOn("reg-btn", async () => {
  try {
    const name = el("reg-name") ? el("reg-name").value : "";
    const email = el("reg-email") ? el("reg-email").value : "";
    const phone = el("reg-phone") ? el("reg-phone").value : "";
    const password = el("reg-password") ? el("reg-password").value : "";
    if (!email || !password) { alert("Enter email & password"); return; }
    const r = await safeFetch("/api/register", { name, email, phone, password });
    saveUser(r.user);
    showDashboard(r.user);
  } catch (e) { alert("Register failed: " + e.message); }
});

safeOn("logout-btn", () => {
  localStorage.removeItem("user");
  show("login-section");
  // notify backend but ignore errors
  fetch(API + "/api/logout", { method: "POST", credentials: "include" }).catch(()=>{});
});











