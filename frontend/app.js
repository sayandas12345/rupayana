// API root
const API = "https://rupayana.onrender.com";

// Helper
const el = (id) => document.getElementById(id);

// Loader
window.onload = () => {
    setTimeout(() => (el("loader").style.display = "none"), 700);

    const user = loadUser();
    if (user) showDashboard(user);
    else show("login-section");
};

// Sidebar
document.getElementById("menu-btn").onclick = () => {
    document.getElementById("sidebar").classList.toggle("open");
};

// PAGE NAVIGATION
function show(pageID) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    el(pageID).classList.add("active");
}

// For sidebar navigation
function navigate(pageID) {
    show(pageID);
    document.getElementById("sidebar").classList.remove("open");
}

// STORAGE
function saveUser(u) { localStorage.setItem("user", JSON.stringify(u)); }
function loadUser() {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
}

// DASHBOARD UPDATE
function showDashboard(user) {
    show("dashboard-section");

    el("dash-name").innerText = user.name;
    el("dash-email").innerText = user.email;
    el("dash-phone").innerText = user.phone;
    el("dash-balance").innerText = "₹" + user.balance;

    el("user-sidebar-name").innerText = user.name;
}

// FETCH WRAPPER
async function safeFetch(endpoint, data) {
    const res = await fetch(API + endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json;
}

// LOGIN
el("log-btn").onclick = async () => {
    try {
        const email = el("log-email").value;
        const password = el("log-password").value;
        const result = await safeFetch("/api/login", { email, password });

        saveUser(result.user);
        showDashboard(result.user);
    } catch (err) {
        alert("Login failed: " + err.message);
    }
};

// REGISTER
el("reg-btn").onclick = async () => {
    try {
        const name = el("reg-name").value;
        const email = el("reg-email").value;
        const phone = el("reg-phone").value;
        const password = el("reg-password").value;
        const result = await safeFetch("/api/register", { name, email, phone, password });

        saveUser(result.user);
        showDashboard(result.user);
    } catch (err) {
        alert("Register failed: " + err.message);
    }
};

// LOGOUT
el("logout-btn").onclick = () => {
    localStorage.removeItem("user");
    show("login-section");
};











