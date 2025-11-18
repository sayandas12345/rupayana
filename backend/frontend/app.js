// app.js - frontend for dark UI
const API = (typeof window !== 'undefined' && window.API) ? window.API : "https://rupayana.onrender.com";
const $ = id => document.getElementById(id);

// basic show / page handling
function show(id){
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  const el = document.getElementById(id);
  if(!el) return;
  el.style.display = 'block';
}

// loader hide
window.onload = () => {
  setTimeout(()=>{ const L = document.getElementById('loader'); if(L) L.style.display='none'; }, 350);
  const user = loadUser();
  if(user) show('dashboard-section'); else show('login-section');
  if(user && $('#dash-email')) $('#dash-email').innerText = user.email;
  if(user && $('#dash-name')) $('#dash-name').innerText = user.name || '';
  if(user && $('#dash-balance')) $('#dash-balance').innerText = "₹ " + (user.balance||0);
  if(user && $('#user-email')) $('#user-email').innerText = user.email || 'guest';
};

// storage helpers
function saveUser(u){ try{ localStorage.setItem('user', JSON.stringify(u)); }catch(e){} }
function loadUser(){ try{ const s = localStorage.getItem('user'); return s? JSON.parse(s): null;}catch(e){return null;} }

// safe fetch
async function callAPI(path, payload){
  const res = await fetch(API + path, {
    method: 'POST',
    credentials: 'include',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload||{})
  });
  const json = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(json.error || json.message || 'Request failed');
  return json;
}

// login
document.addEventListener('click', (ev)=>{
  if(ev.target && ev.target.id === 'log-btn'){
    (async ()=>{
      try{
        const email = $('#log-email') ? $('#log-email').value : '';
        const pass = $('#log-password') ? $('#log-password').value : '';
        if(!email || !pass) { alert('Enter email and password'); return; }
        const r = await callAPI('/api/login',{email,password:pass});
        saveUser(r.user); show('dashboard-section'); location.reload();
      }catch(e){ alert('Login failed: '+e.message); }
    })();
  }
  if(ev.target && ev.target.id === 'reg-btn'){
    (async ()=>{
      try{
        const name = $('#reg-name') ? $('#reg-name').value : '';
        const email = $('#reg-email') ? $('#reg-email').value : '';
        const phone = $('#reg-phone') ? $('#reg-phone').value : '';
        const pass = $('#reg-password') ? $('#reg-password').value : '';
        if(!email || !pass) { alert('Enter email and password'); return; }
        const r = await callAPI('/api/register',{name,email,phone,password:pass});
        saveUser(r.user); show('dashboard-section'); location.reload();
      }catch(e){ alert('Register failed: '+e.message); }
    })();
  }
  if(ev.target && ev.target.id === 'logout-btn'){
    (async ()=>{
      try{ await fetch(API + '/api/logout', {method:'POST', credentials:'include'}).catch(()=>{}); }catch(e){}
      localStorage.removeItem('user'); show('login-section'); location.reload();
    })();
  }
});












