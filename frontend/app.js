// frontend/app.js (patched)
// Uses window.API or fallback
const API = (typeof window !== 'undefined' && window.API) ? window.API : "https://rupayana.onrender.com";
console.log('[app] Using API base:', API);

function el(id){ return document.getElementById(id) || null; }
function saveUser(user){ try { sessionStorage.setItem("user", JSON.stringify(user)); localStorage.setItem("rupayana_user", JSON.stringify(user)); } catch(e){} }
function getUser(){ try { return JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("rupayana_user") || "null"); } catch(e){ return null; } }
function restoreUser(){ if(!sessionStorage.getItem("user") && localStorage.getItem("rupayana_user")) sessionStorage.setItem("user", localStorage.getItem("rupayana_user")); }

// safe fetch wrapper (now forces credentials, handles 401)
async function safeFetch(url, opts = {}) {
  // ensure full URL passed (your code often passes full API + path already)
  const fetchUrl = (url.startsWith('http') ? url : (API + url));

  // sensible defaults; include credentials by default so cookie sessions work
  const defaultOpts = {
    credentials: 'include', // IMPORTANT for cookie-based sessions
    headers: {}
  };

  // Merge headers carefully
  const finalOpts = Object.assign({}, defaultOpts, opts);
  finalOpts.headers = Object.assign({}, defaultOpts.headers, opts.headers || {});

  try {
    const res = await fetch(fetchUrl, finalOpts);

    // read the body text first, then try JSON parse
    const bodyText = await res.text().catch(() => '');
    let json = null;
    try { json = bodyText ? JSON.parse(bodyText) : null; } catch(e) { json = null; }

    if (!res.ok) {
      console.error('[safeFetch] HTTP error', res.status, json || bodyText);
      // handle Unauthorized globally
      if (res.status === 401) {
        // clear local state so UI won't show stale logged-in user
        sessionStorage.removeItem('user');
        localStorage.removeItem('rupayana_user');
        // update UI immediately
        try { showAuth(); } catch(e) { /* ignore if not available */ }
        const errMsg = (json && (json.error || json.message)) || bodyText || 'Invalid credentials';
        throw new Error(errMsg);
      }
      const errMsg = (json && (json.error || json.message)) || bodyText || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }

    return json;
  } catch (err) {
    console.error('[safeFetch] Network or fetch error', err);
    throw err;
  }
}

function showAuth(){ if(el("auth")) el("auth").style.display = "block"; if(el("dashboard")) el("dashboard").style.display = "none"; }
function showDashboard(user){
  if(!user) return showAuth();
  if(el("auth")) el("auth").style.display = "none";
  if(el("dashboard")) el("dashboard").style.display = "block";
  if(el("user-name")) el("user-name").innerText = user.name || user.email || "";
  if(el("acct-email")) el("acct-email").innerText = user.email || "";
  if(el("balance")) el("balance").innerText = user.balance || '0';
  saveUser(user);
}

document.addEventListener("DOMContentLoaded", function(){
  // LOGIN
  const btnLogin = el("btn-login");
  if (btnLogin){
    btnLogin.addEventListener("click", async function(){
      const email = (el("login-email") && el("login-email").value) || "";
      const password = (el("login-password") && el("login-password").value) || "";
      if(!email || !password){ if(el("login-msg")) el("login-msg").innerText = "Enter email & password"; return; }
      try {
        const data = await safeFetch(API + "/api/login", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, password }) });
        if (data && data.user) {
          saveUser(data.user);
          showDashboard(data.user);
          // admin button handling as before
          try {
            const u = data.user;
            if (u && u.isAdmin) {
              if (!el('btn-admin')) {
                const container = el('dashboard-buttons');
                if (container) {
                  const btn = document.createElement('button');
                  btn.id = 'btn-admin';
                  btn.innerText = 'Admin Controls';
                  btn.onclick = () => { try { showAdminPanel(); } catch(e){ console.error(e); alert('Admin Error'); } };
                  container.appendChild(btn);
                }
              }
            }
          } catch(e){ console.warn('admin button', e); }
        } else {
          if(el("login-msg")) el("login-msg").innerText = "Login failed";
        }
      } catch(e){
        if(el("login-msg")) el("login-msg").innerText = e.message || "Network error";
      }
    });
  }

  // REGISTER
  const btnReg = el("btn-register");
  if (btnReg){
    btnReg.addEventListener("click", async function(){
      const name = (el("reg-name") && el("reg-name").value) || "";
      const email = (el("reg-email") && el("reg-email").value) || "";
      const phone = (el("reg-phone") && el("reg-phone").value) || "";
      const password = (el("reg-password") && el("reg-password").value) || "";
      if(!email || !password){ if(el("reg-msg")) el("reg-msg").innerText = "Enter email & password"; return; }
      try {
        const data = await safeFetch(API + "/api/register", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name, email, phone, password }) });
        if(el("reg-msg")) el("reg-msg").innerText = data && (data.message || 'Registered') || 'Registered';
      } catch(e){ if(el("reg-msg")) el("reg-msg").innerText = e.message || "Network error"; }
    });
  }

  // The rest of your UI handlers remain the same, but they now use safeFetch with credentials included.
  // Profile, Transfer, Billpay, Transactions, Admin panel code stays unchanged (kept intentionally).
  // Logout (clears both storages)
  window.logout = function(){ sessionStorage.removeItem("user"); localStorage.removeItem("rupayana_user"); showAuth(); };

  // No auto-restore on load (Resume session button still works)
});








