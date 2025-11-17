// frontend/app.js (FULL - copy & paste entire file)
// API base (uses window.API if available)
const API = (typeof window !== 'undefined' && window.API) ? window.API : "https://rupayana.onrender.com";
console.log('[app] Using API base:', API);

/* -----------------------
   Utilities: DOM + user storage
   ----------------------- */
function el(id){ return document.getElementById(id) || null; }

function saveUser(user){
  try {
    sessionStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("rupayana_user", JSON.stringify(user));
  } catch(e) { console.warn('saveUser error', e); }
}
function getUser(){
  try { return JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("rupayana_user") || "null"); }
  catch(e){ return null; }
}
function restoreUser(){
  if(!sessionStorage.getItem("user") && localStorage.getItem("rupayana_user")){
    sessionStorage.setItem("user", localStorage.getItem("rupayana_user"));
  }
}

/* -----------------------
   safeFetch - sends credentials & handles 401
   ----------------------- */
async function safeFetch(url, opts = {}) {
  const fetchUrl = (url.startsWith('http') ? url : (API + url));
  const defaultOpts = { credentials: 'include', headers: {} };
  const finalOpts = Object.assign({}, defaultOpts, opts);
  finalOpts.headers = Object.assign({}, defaultOpts.headers, opts.headers || {});

  try {
    const res = await fetch(fetchUrl, finalOpts);
    const bodyText = await res.text().catch(()=> '');
    let json = null;
    try { json = bodyText ? JSON.parse(bodyText) : null; } catch(e) { json = null; }

    if (!res.ok) {
      console.error('[safeFetch] HTTP error', res.status, json || bodyText);
      if (res.status === 401) {
        // global cleanup and UI update
        sessionStorage.removeItem('user');
        localStorage.removeItem('rupayana_user');
        try { showAuth(); } catch(e) {}
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

/* -----------------------
   Basic UI helpers
   ----------------------- */
function showAuth(){
  if(el("auth")) el("auth").style.display = "block";
  if(el("dashboard")) el("dashboard").style.display = "none";
}
function showDashboard(user){
  if(!user) return showAuth();
  if(el("auth")) el("auth").style.display = "none";
  if(el("dashboard")) el("dashboard").style.display = "block";
  if(el("user-name")) el("user-name").innerText = user.name || user.email || "";
  if(el("acct-email")) el("acct-email").innerText = user.email || "";
  if(el("balance")) el("balance").innerText = user.balance || '0';
  saveUser(user);
  // load txs
  loadTransactionsForCurrentUser().catch(e => console.warn('load tx after showDash', e));
}

/* -----------------------
   Auth handlers
   ----------------------- */
function _loginDebug(email){
  console.log('[login] sending login for:', email);
}

async function loginHandler() {
  const email = (el("login-email") && el("login-email").value) || "";
  const password = (el("login-password") && el("login-password").value) || "";
  if (!email || !password) {
    if (el("login-msg")) el("login-msg").innerText = "Enter email & password";
    return;
  }

  // debug
  _loginDebug(email);

  try {
    const data = await safeFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (data && data.user) {
      saveUser(data.user);
      showDashboard(data.user);
      if (el("login-msg")) el("login-msg").innerText = "";
    } else {
      if (el("login-msg")) el("login-msg").innerText = "Login failed";
    }
  } catch (err) {
    if (el("login-msg")) el("login-msg").innerText = err.message || "Login error";
  }
}

async function registerHandler() {
  const name = (el("reg-name") && el("reg-name").value) || "";
  const email = (el("reg-email") && el("reg-email").value) || "";
  const phone = (el("reg-phone") && el("reg-phone").value) || "";
  const password = (el("reg-password") && el("reg-password").value) || "";
  if (!email || !password) {
    if (el("reg-msg")) el("reg-msg").innerText = "Enter email & password";
    return;
  }
  try {
    const data = await safeFetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password })
    });
    if (el("reg-msg")) el("reg-msg").innerText = (data && (data.message || 'Registered')) || 'Registered';
  } catch (err) {
    if (el("reg-msg")) el("reg-msg").innerText = err.message || "Registration error";
  }
}

function logout() {
  safeFetch("/api/logout", { method: "POST" }).catch(()=>{});
  sessionStorage.removeItem('user');
  localStorage.removeItem('rupayana_user');
  showAuth();
}
window.logout = logout;

/* -----------------------
   Profile / Billpay / Transfer / Transactions handlers
   ----------------------- */

// Update profile
async function updateProfileHandler() {
  const user = getUser();
  if (!user || !user.email) { alert('Not logged in'); return; }

  const name = (el('profile-name') && el('profile-name').value) || user.name || '';
  const phone = (el('profile-phone') && el('profile-phone').value) || user.phone || '';

  try {
    const res = await safeFetch('/api/update-profile', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: user.email, name, phone })
    });
    if (res && res.user) {
      saveUser(res.user);
      showDashboard(res.user);
    }
    alert(res && res.message ? res.message : 'Profile updated');
  } catch (err) {
    alert(err.message || 'Profile update failed');
  }
}

// Bill pay
async function billPayHandler() {
  const user = getUser();
  if (!user || !user.email) { alert('Please login'); return; }

  const biller = (el('biller') && el('biller').value) || '';
  const amount = (el('bamount') && el('bamount').value) || '';
  if (!biller || !amount) { alert('Enter biller and amount'); return; }

  try {
    const res = await safeFetch('/api/billpay', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: user.email, biller, amount })
    });
    alert(res && res.message ? res.message : 'Bill paid');
    // reload tx
    loadTransactionsForCurrentUser().catch(e => console.warn('reload tx after bill', e));
  } catch (err) {
    alert(err.message || 'Bill pay failed');
  }
}

// Transfer
async function transferHandler() {
  const user = getUser();
  if (!user || !user.email) { alert('Please login'); return; }

  const toEmail = (el('to-email') && el('to-email').value) || '';
  const amount = (el('tamount') && el('tamount').value) || '';
  if (!toEmail || !amount) { alert('Enter recipient and amount'); return; }

  try {
    const res = await safeFetch('/api/transfer', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ fromEmail: user.email, toEmail, amount })
    });
    alert(res && (res.message || 'Transfer complete') || 'Transfer complete');
    loadTransactionsForCurrentUser().catch(e => console.warn('reload tx after transfer', e));
  } catch (err) {
    alert(err.message || 'Transfer failed');
  }
}

// Load transactions for current user
async function loadTransactionsForCurrentUser() {
  const user = getUser();
  const container = el('tx-list');
  if (!user || !user.email) {
    if (container) container.innerHTML = '<div>Please login to view transactions</div>';
    return;
  }

  try {
    const url = `/api/transactions?email=${encodeURIComponent(user.email)}`;
    const res = await safeFetch(url, { method: 'GET' });
    const list = (res && res.transactions) ? res.transactions : [];
    if (!container) return;
    if (!list.length) { container.innerHTML = '<div>No transactions</div>'; return; }

    container.innerHTML = list.map(t => {
      const created = t.created_at ? (Number(t.created_at) > 1000000000 ? new Date(t.created_at * 1000) : new Date(t.created_at)) : null;
      const timeStr = created ? created.toLocaleString() : '';
      const amount = t.amount !== undefined ? `₹ ${t.amount}` : '';
      return `<div class="tx-row" style="display:flex;justify-content:space-between;padding:12px 16px;border-radius:8px;margin-bottom:8px;background:rgba(255,255,255,0.02);">
        <div>
          <div style="font-weight:600">${t.type || ''}</div>
          <div style="font-size:13px;color:var(--muted)">${t.details || (t.to_email ? 'To: '+t.to_email : '')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${amount}</div>
          <div style="font-size:12px;color:var(--muted)">${timeStr}</div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('loadTransactions error', err);
    if (container) container.innerHTML = `<div>Error loading transactions: ${err.message || ''}</div>`;
  }
}

/* -----------------------
   UI render helpers (showBill/showTransfer/showProfile/showTx/showForgot)
   These are required because index.html calls these functions via onclick.
   ----------------------- */
function setPanel(html) {
  const panelBody = el('panel-body');
  if (!panelBody) return;
  panelBody.innerHTML = html;
}

function showTransfer() {
  setPanel(`
    <h5 style="margin-top:0">Send Money</h5>
    <div style="margin-top:10px">
      <label class="form-label">To (email / UPI)</label>
      <input id="to-email" class="form-control" placeholder="recipient@domain or upi-id" />
      <label class="form-label" style="margin-top:8px">Amount</label>
      <input id="tamount" class="form-control" placeholder="Amount" />
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button id="transfer-btn" class="btn btn-primary">Send</button>
        <button class="btn btn-ghost" onclick="showDashboard(getUser())">Cancel</button>
      </div>
    </div>
  `);
  const btn = el('transfer-btn');
  if (btn) btn.addEventListener('click', transferHandler);
}

function showBill() {
  setPanel(`
    <h5 style="margin-top:0">Bill Payment</h5>
    <div style="margin-top:10px">
      <label class="form-label">Biller</label>
      <input id="biller" class="form-control" placeholder="Electricity / Vendor ID" />
      <label class="form-label" style="margin-top:8px">Amount</label>
      <input id="bamount" class="form-control" placeholder="Amount" />
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button id="billpay-btn" class="btn btn-primary">Pay Bill</button>
        <button class="btn btn-ghost" onclick="showDashboard(getUser())">Cancel</button>
      </div>
    </div>
  `);
  const btn = el('billpay-btn');
  if (btn) btn.addEventListener('click', billPayHandler);
}

function showProfile() {
  const user = getUser() || { name:'', email:'', phone:'' };
  setPanel(`
    <h5 style="margin-top:0">Account</h5>
    <div style="margin-top:10px">
      <label class="form-label">Name</label>
      <input id="profile-name" class="form-control" value="${(user.name||'')}" />
      <label class="form-label" style="margin-top:8px">Phone</label>
      <input id="profile-phone" class="form-control" value="${(user.phone||'')}" />
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button id="profile-save-btn" class="btn btn-primary">Save</button>
        <button class="btn btn-ghost" onclick="showDashboard(getUser())">Cancel</button>
      </div>
    </div>
  `);
  const btn = el('profile-save-btn');
  if (btn) btn.addEventListener('click', updateProfileHandler);
}

function showTx() {
  setPanel('<h5 style="margin-top:0">Transactions</h5><div id="tx-list" style="margin-top:12px"></div>');
  loadTransactionsForCurrentUser();
}

function showForgot() {
  setPanel(`
    <h5 style="margin-top:0">Forgot password</h5>
    <div style="margin-top:10px">
      <label class="form-label">Email</label>
      <input id="forgot-email" class="form-control" placeholder="you@domain.com" />
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button id="forgot-btn" class="btn btn-primary">Request reset</button>
        <button class="btn btn-ghost" onclick="showAuth()">Cancel</button>
      </div>
    </div>
  `);
  const btn = el('forgot-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const email = (el('forgot-email')||{}).value;
      if (!email) return alert('Enter email');
      try {
        const res = await safeFetch('/api/request-reset', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ email })
        });
        alert(res && (res.message || 'Reset requested'));
        showAuth();
      } catch (err) {
        alert(err.message || 'Request failed');
      }
    });
  }
}

/* -----------------------
   DOM wiring on load
   ----------------------- */
document.addEventListener('DOMContentLoaded', function(){
  restoreUser();

  // wire buttons (if present)
  const btnLogin = el("btn-login"); if (btnLogin) btnLogin.addEventListener('click', loginHandler);
  const btnReg = el("btn-register"); if (btnReg) btnReg.addEventListener('click', registerHandler);
  const profileBtn = el('profile-save-btn'); if (profileBtn) profileBtn.addEventListener('click', updateProfileHandler);
  const billBtn = el('billpay-btn'); if (billBtn) billBtn.addEventListener('click', billPayHandler);
  const transferBtn = el('transfer-btn'); if (transferBtn) transferBtn.addEventListener('click', transferHandler);
  const logoutBtn = el('logout-btn'); if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // show dashboard if user present
  const user = getUser();
  if (user) showDashboard(user);
  else showAuth();
});










