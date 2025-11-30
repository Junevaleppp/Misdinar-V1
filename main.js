// =======================
// KONFIGURASI SUPABASE
// =======================
const SUPABASE_URL = "https://umliqzhyimeyyyemtzsx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtbGlxemh5aW1leXl5ZW10enN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzODU4MTMsImV4cCI6MjA3OTk2MTgxM30.TT0aZFXBPl79TU0OOgc71FN8GjselHA3Pqv-nY0WKQ0";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Konfigurasi Umum
const MAX_PER_MASS = 8;
const MASS_TIMES = [
  { value: "17.00", label: "Sabtu/Minggu 17.00" },
  { value: "06.00", label: "Minggu 06.00" },
  { value: "08.30", label: "Minggu 08.30" }
];
const MEMBER_SESSION_KEY = "barto_member_session";

// =======================
// HELPER SESSION
// =======================
function getMemberSession() {
  try { return JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY)); } catch { return null; }
}
function setMemberSession(session) {
  if (!session) localStorage.removeItem(MEMBER_SESSION_KEY);
  else localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
}
function showMessage(elOrId, text, type) {
  const el = typeof elOrId === "string" ? document.getElementById(elOrId) : elOrId;
  if (el) { el.textContent = text; el.className = "form-message " + (type || ""); }
}

// =======================
// INIT & NAVBAR
// =======================
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  updateNavbar();
  
  if (document.getElementById("user-login-form")) initUserLoginPage();
  if (document.getElementById("duty-form")) initDutyPage();
  if (document.getElementById("schedule-container")) loadScheduleTable(); // Fungsi baru untuk jadwal
  
  // Setup Modal Settings
  setupSettingsModal(); 
});

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (toggle && navLinks) toggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  document.querySelectorAll(".year-now").forEach(el => el.textContent = new Date().getFullYear());
}

function updateNavbar() {
  const session = getMemberSession();
  const navInner = document.querySelector(".nav-inner");
  const oldProfile = document.getElementById("nav-user-profile");
  if (oldProfile) oldProfile.remove();
  
  const loginLink = document.querySelector('a[href="login.html"]');

  if (session) {
    if (loginLink) loginLink.style.display = "none";
    
    const profileDiv = document.createElement("div");
    profileDiv.id = "nav-user-profile";
    profileDiv.className = "user-profile-nav";
    const roleLabel = session.role === 'pengurus' ? 'Pengurus' : 'Petugas';
    const roleClass = session.role === 'pengurus' ? 'badge-pengurus' : 'badge-petugas';
    const adminLink = session.role === 'pengurus' ? `<a href="admin.html" class="nav-admin-link">Admin</a>` : '';

    profileDiv.innerHTML = `
      <div class="user-info-text">
        <span class="user-name">${session.full_name}</span>
        <span class="user-meta"><span class="${roleClass}">${roleLabel}</span></span>
      </div>
      <div class="user-actions">
        ${adminLink}
        <button id="btn-settings-nav" class="btn-xs btn-outline">Settings</button>
        <button id="logout-btn-nav" class="btn-xs btn-outline">Logout</button>
      </div>
    `;
    navInner.appendChild(profileDiv);

    document.getElementById("logout-btn-nav").addEventListener("click", () => {
      if(confirm("Logout?")) { setMemberSession(null); window.location.href = "login.html"; }
    });
    
    // Trigger Modal Settings
    document.getElementById("btn-settings-nav").addEventListener("click", () => {
       document.getElementById("settings-modal").style.display = "flex";
    });

  } else {
    if (loginLink) loginLink.style.display = "block";
  }
}

// =======================
// AUTH LOGIN (Supabase)
// =======================
function initUserLoginPage() {
  const form = document.getElementById("user-login-form");
  const msgEl = document.getElementById("user-login-message");
  if (getMemberSession()) window.location.href = "index.html";

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value.trim();
      
      showMessage(msgEl, "Loading...", "");

      // Query ke Supabase Table Members
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('username', username)
        .eq('password', password) // Warning: Harusnya hash
        .eq('is_active', true)
        .single();

      if (error || !data) {
        showMessage(msgEl, "Username/Password salah.", "error");
      } else {
        setMemberSession(data);
        showMessage(msgEl, "Berhasil!", "success");
        setTimeout(() => window.location.href = "duties.html", 800);
      }
    });
  }
}

// =======================
// DUTY REGISTRATION
// =======================
function initDutyPage() {
  const session = getMemberSession();
  if (!session) {
    document.querySelector(".duty-layout").style.display = "none";
    document.getElementById("duty-locked-message").style.display = "block";
    return;
  }
  document.querySelector(".duty-layout").style.display = "grid";
  document.getElementById("duty-locked-message").style.display = "none";
  document.getElementById("duty-user-info").textContent = `Halo, ${session.full_name}`;

  // Populate Select Options
  const sel = document.getElementById("mass-time-select");
  sel.innerHTML = "";
  MASS_TIMES.forEach(mt => {
     sel.innerHTML += `<option value="${mt.value}">${mt.label}</option>`;
  });

  loadMemberHistory(session.id);

  document.getElementById("duty-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("duty-date").value;
    const time = document.getElementById("mass-time-select").value;
    const msgEl = document.getElementById("duty-message");

    showMessage(msgEl, "Memproses...", "");

    // 1. Cek Kuota (Logic sederhana di client, idealnya RPC database)
    const { data: dutiesCheck } = await supabase
       .from('duties')
       .select('member_id')
       .eq('date', date)
       .eq('mass_time', time)
       .eq('status', 'active');
       
    if (dutiesCheck && dutiesCheck.length >= MAX_PER_MASS) {
        showMessage(msgEl, "Kuota Penuh!", "error");
        return;
    }
    
    // 2. Cek Duplikat
    const isDup = dutiesCheck.find(d => d.member_id === session.id);
    if (isDup) {
        showMessage(msgEl, "Kamu sudah terdaftar di misa ini.", "error");
        return;
    }

    // 3. Insert
    const { error } = await supabase.from('duties').insert({
        member_id: session.id,
        member_name: session.full_name,
        date: date,
        mass_time: time
    });

    if (error) showMessage(msgEl, "Gagal daftar: " + error.message, "error");
    else {
        // Update total assignment member
        await supabase.rpc('increment_assignment', { row_id: session.id }); // Opsional: buat RPC atau update manual
        showMessage(msgEl, "Berhasil terdaftar!", "success");
        loadMemberHistory(session.id);
    }
  });
}

async function loadMemberHistory(memberId) {
  const { data } = await supabase
    .from('duties')
    .select('*')
    .eq('member_id', memberId)
    .order('date', { ascending: false });

  const upBody = document.getElementById("upcoming-body");
  const pastBody = document.getElementById("past-body");
  upBody.innerHTML = ""; pastBody.innerHTML = "";
  
  const today = new Date().toISOString().split('T')[0];

  data.forEach(d => {
     const isUp = d.date >= today && d.status === 'active';
     const html = `
       <tr>
         <td>${d.date}</td><td>${d.mass_time}</td><td>${d.status}</td>
         <td>${isUp ? `<button onclick="cancelDuty('${d.id}')" class="btn-sm btn-ghost">Batal</button>` : ''}</td>
       </tr>`;
     (isUp ? upBody : pastBody).innerHTML += html;
  });
  document.getElementById("history-total-count").textContent = data.length;
}

window.cancelDuty = async function(dutyId) {
    if(!confirm("Batalkan tugas?")) return;
    await supabase.from('duties').update({ status: 'canceled' }).eq('id', dutyId);
    alert("Dibatalkan.");
    loadMemberHistory(getMemberSession().id);
}

// =======================
// FITUR SETTINGS (Ganti Password)
// =======================
function setupSettingsModal() {
    // Inject HTML Modal ke body
    const modalHTML = `
    <div id="settings-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content">
        <h3>Pengaturan Akun</h3>
        <form id="settings-form">
           <label>Username Baru <input type="text" id="set-user" required /></label>
           <label>Password Baru <input type="password" id="set-pass" required /></label>
           <div style="margin-top:1rem; display:flex; gap:0.5rem;">
             <button type="submit" class="btn-primary">Simpan</button>
             <button type="button" class="btn-ghost" onclick="document.getElementById('settings-modal').style.display='none'">Tutup</button>
           </div>
        </form>
      </div>
    </div>
    <style>
      .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:99; display:flex; justify-content:center; align-items:center;}
      .modal-content { background:white; padding:2rem; border-radius:12px; width:90%; max-width:400px; }
    </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const session = getMemberSession();
    if(session) {
        document.getElementById("set-user").value = session.username;
        document.getElementById("set-pass").value = session.password;
    }

    document.getElementById("settings-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const newUser = document.getElementById("set-user").value;
        const newPass = document.getElementById("set-pass").value;

        const { error } = await supabase
            .from('members')
            .update({ username: newUser, password: newPass })
            .eq('id', session.id);

        if(error) alert("Gagal update: " + error.message);
        else {
            alert("Data berhasil diupdate! Silakan login ulang.");
            setMemberSession(null);
            window.location.href = "login.html";
        }
    });
}
// =======================
// JADWAL TABEL OTOMATIS
// =======================
async function loadScheduleTable() {
  const container = document.getElementById("schedule-container");
  const picker = document.getElementById("schedule-month-picker");
  
  if (!container) return;
  
  // Default ke bulan sekarang jika kosong
  if (!picker.value) {
      const now = new Date();
      picker.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  const [year, month] = picker.value.split('-').map(Number);
  
  // 1. Ambil data duties di bulan tersebut
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDate = `${year}-${String(month).padStart(2,'0')}-31`; // Loose end date
  
  const { data: duties } = await supabase
    .from('duties')
    .select('date, mass_time, member_name')
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('status', 'active');

  // 2. Cari tanggal Sabtu & Minggu di bulan itu
  const weekends = [];
  const dateObj = new Date(year, month - 1, 1);
  while (dateObj.getMonth() === month - 1) {
    const day = dateObj.getDay();
    if (day === 6 || day === 0) { // 6=Sabtu, 0=Minggu
       weekends.push(new Date(dateObj)); 
    }
    dateObj.setDate(dateObj.getDate() + 1);
  }

  // 3. Render HTML
  let html = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem;">`;
  
  // Kelompokkan per weekend (Sabtu + Minggu)
  // Logic simple: Loop tanggal, render card
  
  // Kita buat per Misa saja biar rapi seperti Excel
  const uniqueDates = [...new Set(weekends.map(d => d.toISOString().split('T')[0]))];
  
  uniqueDates.forEach(dateStr => {
      const datePretty = new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
      
      // Filter petugas per jam misa
      const getNames = (time) => {
          const list = duties.filter(d => d.date === dateStr && d.mass_time === time);
          if (list.length === 0) return "<i>Belum ada petugas</i>";
          return `<ol style="margin:0; padding-left:1.2rem;">${list.map(l => `<li>${l.member_name}</li>`).join('')}</ol>`;
      };

      // Tentukan kolom misa berdasarkan hari
      const dayIndex = new Date(dateStr).getDay();
      let massCols = "";
      
      if (dayIndex === 6) { // Sabtu
          massCols = `
            <div class="mass-col"><strong>17.00 WIB</strong>${getNames("17.00")}</div>
          `;
      } else { // Minggu
          massCols = `
            <div class="mass-col"><strong>06.00 WIB</strong>${getNames("06.00")}</div>
            <div class="mass-col"><strong>08.30 WIB</strong>${getNames("08.30")}</div>
            <div class="mass-col"><strong>17.00 WIB</strong>${getNames("17.00")}</div>
          `;
      }

      html += `
        <div class="schedule-card" style="border:1px solid #ccc; border-radius:8px; overflow:hidden;">
            <div style="background:#8b5cf6; color:white; padding:0.5rem; text-align:center; font-weight:bold;">${datePretty}</div>
            <div style="padding:1rem; font-size:0.9rem;">
               ${massCols}
            </div>
        </div>
      `;
  });

  html += `</div>`;
  container.innerHTML = html;
}