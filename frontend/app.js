// =========================
//  FRONTEND APP.JS (FINAL)
// =========================

// Updated API line (your requirement)
const API = (typeof window !== 'undefined' && window.API)
  ? window.API
  : "https://rupayana.onrender.com";

console.log("[app] Using API base:", API);


// ===== Utility Helpers =====
function el(id){ return document.getElementById(id) || null; }

function saveUser(user){
  try {
    sessionStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("rupayana_user", JSON.stringify(user));
  } catch(e){ console.warn("saveUser error", e); }
}

function getUser(){
  try {
    return JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("rupayana_user") || "null");
  } catch(e){ return null; }
}

function restoreUser(){
  if(!sessionStorage.getItem("user") && localStorage.getItem("rupayana_user")){
    sessionStorage.setItem("user", localStorage.getItem("rupayana_user"));
  }
}


// ===== SAFE FETCH (never break login/logout) =====
async function safeFetch(url, opts = {}) {
  const fullUrl = url.startsWith("http") ? url : API + url;

  const defaultOpts = {
    credentials: "include",
    headers: { "Accept": "application/json" }
  };

  const finalOpts = Object.assign({}, defaultOpts, opts);
  finalOpts.headers = Object.assign({}, defaultOpts.headers, opts.headers || {});

  console.log("[safeFetch] =>", finalOpts.method || "GET", fullUrl);

  try {
    const res = await fetch(fullUrl, finalOpts);
    const text = await res.text();
    let json = null;

    try { json = text ? JSON.parse(text) : null; } catch { json = null; }

    if (!res.ok) {
      console.error("[safeFetch] HTTP error", res.status, json || text);

      if (res.status === 401) {
        sessionStorage.removeItem("user");
        localStorage.removeItem("rupayana_user");
        showAuth();
        throw new Error(json?.message || json?.error || "Invalid credentials");
      }

      throw new Error(json?.message || json?.error || text || "Error");
    }

    return json;
  }
  catch(err){
    console.error("[safeFetch] Network error:", err);
    throw err;
  }
}


// ===== UI state =====
function showAuth(){
  el("auth").style.display = "block";
  el("dashboard").style.display = "none";
  el("logout-btn").style.display = "none";
  el("user-name").innerText = "";
}

function showDashboard(user){
  if (!user) return showAuth();

  el("auth").style.display = "none";
  el("dashboard").style.display = "block";

  el("user-name").innerText = user.name || user.email;
  el("user-name-display").innerText = user.name || user.email;
  el("acct-email").innerText = user.email;
  el("balance").innerText = user.balance || 0;

  el("logout-btn").style.display = "inline-block";

  saveUser(user);

  loadTransactionsForCurrentUser().catch(console.warn);
}


// ===== Login =====
async function loginHandler(){
  const email = el("login-email").value.trim().toLowerCase();
  const password = el("login-password").value.trim();

  if (!email || !password){
    el("login-msg").innerText = "Enter email & password";
    return;
  }

  try {
    const data = await safeFetch("/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ email, password })
    });

    if (data?.user){
      saveUser(data.user);
      showDashboard(data.user);
      el("login-msg").innerText = "";
    } else {
      el("login-msg").innerText = "Invalid login";
    }

  } catch(err){
    el("login-msg").innerText = err.message || "Login failed";
  }
}


// ===== Register =====
async function registerHandler(){
  const name = el("reg-name").value.trim();
  const email = el("reg-email").value.trim().toLowerCase();
  const phone = el("reg-phone").value.trim();
  const password = el("reg-password").value.trim();

  if (!email || !password){
    el("reg-msg").innerText = "Enter email & password";
    return;
  }

  try {
    const data = await safeFetch("/api/register", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ name, email, phone, password })
    });

    el("reg-msg").innerText = data?.message || "Registered";

    if (data?.user){
      saveUser(data.user);
      showDashboard(data.user);
    }

  } catch(err){
    el("reg-msg").innerText = err.message || "Error";
  }
}


// ===== Logout =====
function logout(){
  safeFetch("/api/logout", { method: "POST" }).catch(()=>{});
  sessionStorage.removeItem("user");
  localStorage.removeItem("rupayana_user");
  showAuth();
}
window.logout = logout;


// ===== Profile Update =====
async function updateProfileHandler(){
  const user = getUser();
  if (!user) return alert("Login first");

  const name = el("profile-name").value.trim();
  const phone = el("profile-phone").value.trim();

  try {
    const data = await safeFetch("/api/update-profile", {
      method:"POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ email: user.email, name, phone })
    });

    if (data?.user){
      saveUser(data.user);
      showDashboard(data.user);
    }

    alert(data?.message || "Profile updated");
  }
  catch(err){
    alert(err.message);
  }
}


// ===== Bill Pay =====
async function billPayHandler(){
  const user = getUser();
  if (!user) return alert("Login first");

  const biller = el("biller").value;
  const amount = el("bamount").value;

  if (!biller || !amount) return alert("Enter biller & amount");

  try {
    const data = await safeFetch("/api/billpay", {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email:user.email, biller, amount })
    });

    alert(data?.message || "Bill Paid");

    loadTransactionsForCurrentUser();

  } catch(err){
    alert(err.message);
  }
}


// ===== Transfer =====
async function transferHandler(){
  const user = getUser();
  if (!user) return alert("Login first");

  const toEmail = el("to-email").value.trim().toLowerCase();
  const amount = el("tamount").value.trim();

  if (!toEmail || !amount) return alert("Enter recipient & amount");

  try {
    const data = await safeFetch("/api/transfer", {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ fromEmail:user.email, toEmail, amount })
    });

    alert(data?.message || "Transfer Complete");

    loadTransactionsForCurrentUser();

  } catch(err){
    alert(err.message);
  }
}


// ===== Transactions =====
async function loadTransactionsForCurrentUser(){
  const user = getUser();
  const list = el("tx-list");

  if (!user){
    list.innerHTML = "<div>Please login</div>";
    return;
  }

  try {
    const data = await safeFetch(`/api/transactions?email=${encodeURIComponent(user.email)}`);

    if (!data?.transactions?.length){
      list.innerHTML = "<div>No transactions</div>";
      return;
    }

    list.innerHTML = data.transactions.map(t => {
      const date = new Date(t.created_at).toLocaleString();
      const amount = `₹ ${t.amount}`;
      return `
        <div class="tx-item">
          <div><strong>${t.type}</strong> - ${t.details || ""}</div>
          <div>${amount}</div>
          <div class="tx-date">${date}</div>
        </div>
      `;
    }).join("");

  } catch(err){
    list.innerHTML = `<div>Error: ${err.message}</div>`;
  }
}


// ===== Dynamic UI Panels =====
function setPanel(html){ el("panel-body").innerHTML = html; }

function showTransfer(){
  setPanel(`
    <h3>Send Money</h3>
    <input id="to-email" class="input" placeholder="Recipient email">
    <input id="tamount" class="input" placeholder="Amount">
    <button class="btn-primary" id="transfer-btn">Send</button>
  `);

  el("transfer-btn").onclick = transferHandler;
}

function showBill(){
  setPanel(`
    <h3>Pay Bill</h3>
    <input id="biller" class="input" placeholder="Biller">
    <input id="bamount" class="input" placeholder="Amount">
    <button class="btn-primary" id="billpay-btn">Pay</button>
  `);

  el("billpay-btn").onclick = billPayHandler;
}

function showProfile(){
  const user = getUser() || { name:"", phone:"", email:"" };

  setPanel(`
    <h3>Profile</h3>
    <input id="profile-name" class="input" value="${user.name}">
    <input id="profile-phone" class="input" value="${user.phone}">
    <button class="btn-primary" id="profile-save-btn">Save</button>
  `);

  el("profile-save-btn").onclick = updateProfileHandler;
}

function showTx(){
  setPanel(`
    <h3>Transactions</h3>
    <div id="tx-list"></div>
  `);
  loadTransactionsForCurrentUser();
}


// ===== DOM Ready =====
document.addEventListener("DOMContentLoaded", () => {

  restoreUser();

  if (getUser()) showDashboard(getUser());
  else          showAuth();

  el("btn-login").onclick = loginHandler;
  el("btn-register").onclick = registerHandler;

  el("show-login").onclick = () => el("login-email").focus();
  el("show-register").onclick = () => el("reg-email").focus();

  if (el("logout-btn")) el("logout-btn").onclick = logout;
});










