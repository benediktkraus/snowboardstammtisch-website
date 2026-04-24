// Snowboard Stammtisch Admin — full client-side logic
// No frameworks, no build step

let CONFIG = null;
let DATES = null;
let currentSeasonIdx = 0;
let pendingFiles = []; // compressed blobs ready for upload

// --- API helpers ---

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...opts });
  if (res.status === 401) { showLogin(); throw new Error("unauthorized"); }
  return res;
}

async function apiJSON(path, opts = {}) {
  const res = await api(path, opts);
  return res.json();
}

function showStatus(msg, type = "ok") {
  const bar = document.getElementById("status-bar");
  bar.innerHTML = `<div class="status status-${type}">${msg}</div>`;
  if (type === "ok") setTimeout(() => bar.innerHTML = "", 3000);
}

// --- Auth flow ---

async function checkAuth() {
  // Check if setup is needed
  const setup = await fetch("/api/setup").then(r => r.json()).catch(() => ({ needsSetup: false }));
  if (setup.needsSetup) {
    showSetupMode();
    return;
  }
  // Check if logged in
  try {
    const res = await fetch("/api/admin/config", { credentials: "same-origin" });
    if (res.ok) {
      CONFIG = await res.json();
      const dRes = await fetch("/api/admin/dates", { credentials: "same-origin" });
      if (dRes.ok) DATES = await dRes.json();
      showDashboard();
      loadAnalytics();
      return;
    }
  } catch {}
  showLogin();
}

function showSetupMode() {
  document.getElementById("view-login").classList.remove("hidden");
  document.getElementById("view-dashboard").classList.add("hidden");
  document.getElementById("login-subtitle").textContent = "Ersteinrichtung — Passwort festlegen";
  document.getElementById("setup-confirm").classList.remove("hidden");
  document.getElementById("login-btn").textContent = "Passwort setzen";
}

function showLogin() {
  document.getElementById("view-login").classList.remove("hidden");
  document.getElementById("view-dashboard").classList.add("hidden");
  document.getElementById("login-subtitle").textContent = "Admin Login";
  document.getElementById("setup-confirm").classList.add("hidden");
  document.getElementById("login-btn").textContent = "Login";
  document.getElementById("login-pw").value = "";
  document.getElementById("login-error").textContent = "";
}

function showDashboard() {
  document.getElementById("view-login").classList.add("hidden");
  document.getElementById("view-dashboard").classList.remove("hidden");
  renderDates();
  renderConfig();
  populatePhotoDateSelect();
}

// Login / Setup handler
document.getElementById("login-btn").addEventListener("click", async () => {
  const pw = document.getElementById("login-pw").value;
  const errEl = document.getElementById("login-error");
  if (!pw) { errEl.textContent = "Passwort eingeben"; return; }

  const isSetup = !document.getElementById("setup-confirm").classList.contains("hidden");

  if (isSetup) {
    const pw2 = document.getElementById("login-pw2").value;
    if (pw !== pw2) { errEl.textContent = "Passwoerter stimmen nicht ueberein"; return; }
    if (pw.length < 6) { errEl.textContent = "Mindestens 6 Zeichen"; return; }
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "password already set") {
          // Password was set elsewhere — switch to login mode
          showLogin();
          return;
        }
        errEl.textContent = data.error; return;
      }
      errEl.textContent = "";
    } catch (e) { errEl.textContent = "Fehler: " + e.message; return; }
  }

  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
      credentials: "same-origin"
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "Login fehlgeschlagen"; return; }
    // Seed if needed
    try {
      await api("/api/admin/seed", { method: "POST" });
    } catch {}
    // Load data
    try {
      CONFIG = await apiJSON("/api/admin/config");
      DATES = await apiJSON("/api/admin/dates");
    } catch {}
    showDashboard();
    loadAnalytics();
  } catch (e) { errEl.textContent = "Fehler: " + e.message; }
});

document.getElementById("login-pw").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const pw2 = document.getElementById("login-pw2");
    if (!document.getElementById("setup-confirm").classList.contains("hidden") && !pw2.value) {
      pw2.focus();
    } else {
      document.getElementById("login-btn").click();
    }
  }
});
document.getElementById("login-pw2").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});

// Logout
document.getElementById("btn-logout").addEventListener("click", () => {
  document.cookie = "sbi-admin=; Path=/; Max-Age=0";
  showLogin();
});

// --- Tabs ---

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// --- Dates Tab ---

function renderDates() {
  if (!DATES || !DATES.seasons) return;
  const sel = document.getElementById("season-select");
  sel.innerHTML = DATES.seasons.map((s, i) =>
    `<option value="${i}">${s.label}${s.current ? " (aktuell)" : ""}</option>`
  ).join("");
  sel.value = currentSeasonIdx;
  renderSeasonDetail();
}

function renderSeasonDetail() {
  const season = DATES.seasons[currentSeasonIdx];
  if (!season) return;
  document.getElementById("season-label").value = season.label || "";
  document.getElementById("season-current").checked = !!season.current;
  const list = document.getElementById("dates-list");
  list.innerHTML = "";
  (season.dates || []).forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "date-row";
    row.innerHTML = `<input type="date" value="${d}" data-idx="${i}"><button class="btn btn-danger btn-remove" data-idx="${i}">&times;</button>`;
    list.appendChild(row);
  });
  // Bind remove buttons
  list.querySelectorAll(".btn-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      season.dates.splice(idx, 1);
      renderSeasonDetail();
    });
  });
  // Bind date inputs
  list.querySelectorAll("input[type=date]").forEach(inp => {
    inp.addEventListener("change", () => {
      season.dates[parseInt(inp.dataset.idx)] = inp.value;
    });
  });
}

document.getElementById("season-select").addEventListener("change", e => {
  collectSeasonEdits();
  currentSeasonIdx = parseInt(e.target.value);
  renderSeasonDetail();
});

document.getElementById("season-label").addEventListener("input", e => {
  if (DATES.seasons[currentSeasonIdx]) DATES.seasons[currentSeasonIdx].label = e.target.value;
});

document.getElementById("season-current").addEventListener("change", e => {
  if (e.target.checked) {
    DATES.seasons.forEach((s, i) => s.current = i === currentSeasonIdx);
  } else {
    DATES.seasons[currentSeasonIdx].current = false;
  }
});

function collectSeasonEdits() {
  const season = DATES.seasons[currentSeasonIdx];
  if (!season) return;
  season.label = document.getElementById("season-label").value;
  season.current = document.getElementById("season-current").checked;
}

document.getElementById("btn-add-date").addEventListener("click", () => {
  const season = DATES.seasons[currentSeasonIdx];
  if (!season) return;
  const last = season.dates[season.dates.length - 1];
  // Default: next month from last date, or today
  let next;
  if (last) {
    const d = new Date(last);
    d.setMonth(d.getMonth() + 1);
    next = d.toISOString().split("T")[0];
  } else {
    next = new Date().toISOString().split("T")[0];
  }
  season.dates.push(next);
  renderSeasonDetail();
});

document.getElementById("btn-new-season").addEventListener("click", () => {
  collectSeasonEdits();
  const year = new Date().getFullYear();
  DATES.seasons.unshift({ label: `${year}/${(year + 1) % 100}`, current: false, dates: [] });
  currentSeasonIdx = 0;
  renderDates();
});

document.getElementById("btn-delete-season").addEventListener("click", () => {
  if (DATES.seasons.length <= 1) { showStatus("Mindestens eine Saison noetig", "err"); return; }
  if (!confirm("Saison wirklich loeschen?")) return;
  DATES.seasons.splice(currentSeasonIdx, 1);
  currentSeasonIdx = 0;
  renderDates();
});

document.getElementById("btn-save-dates").addEventListener("click", async () => {
  collectSeasonEdits();
  const hasActive = DATES.seasons.some(s => s.current);
  if (!hasActive) { showStatus("Eine Saison muss als 'aktuell' markiert sein", "err"); return; }
  try {
    const res = await api("/api/admin/dates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DATES)
    });
    const data = await res.json();
    if (!res.ok) { showStatus(data.error, "err"); return; }
    showStatus("Termine gespeichert");
  } catch (e) { showStatus("Fehler: " + e.message, "err"); }
});

// --- Config Tab ---

function renderConfig() {
  if (!CONFIG) return;
  document.getElementById("cfg-intro-de").value = CONFIG.intro?.de || "";
  document.getElementById("cfg-intro-en").value = CONFIG.intro?.en || "";
  document.getElementById("cfg-loc-name").value = CONFIG.location?.name || "";
  document.getElementById("cfg-loc-address").value = CONFIG.location?.address || "";
  document.getElementById("cfg-loc-maps").value = CONFIG.location?.mapsUrl || "";
  document.getElementById("cfg-time").value = CONFIG.time || "20:00";
  document.getElementById("cfg-season").value = CONFIG.season || "";
  document.getElementById("cfg-wa").value = CONFIG.links?.whatsapp || "";
  document.getElementById("cfg-boards").value = CONFIG.links?.boardSwap || "";
  document.getElementById("cfg-imprint").value = CONFIG.imprint || "";
  renderPartners();
}

function renderPartners() {
  const list = document.getElementById("partners-list");
  list.innerHTML = "";
  (CONFIG.partners || []).forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "partner-card";
    card.innerHTML = `
      <div class="field-row"><div class="field"><label>Name</label><input type="text" value="${esc(p.name)}" data-field="name" data-idx="${i}"></div>
      <div class="field"><label>URL</label><input type="url" value="${esc(p.url)}" data-field="url" data-idx="${i}"></div></div>
      <div class="field-row"><div class="field"><label>Rolle</label><select data-field="role" data-idx="${i}"><option value="host"${p.role === "host" ? " selected" : ""}>Host</option><option value="partner"${p.role === "partner" ? " selected" : ""}>Partner</option></select></div>
      <div class="field"><label>Form</label><select data-field="shape" data-idx="${i}"><option value="badge"${p.shape === "badge" ? " selected" : ""}>Badge</option><option value="wordmark"${p.shape === "wordmark" ? " selected" : ""}>Wordmark</option><option value="text"${p.shape === "text" ? " selected" : ""}>Text</option></select></div></div>
      <div class="field"><label>Logo-Pfad</label><input type="text" value="${esc(p.logo || "")}" data-field="logo" data-idx="${i}" placeholder="assets/logo-name.png"></div>
      <button class="btn btn-danger btn-sm partner-remove" data-idx="${i}">Entfernen</button>`;
    list.appendChild(card);
  });
  // Bind inputs
  list.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("change", () => {
      const idx = parseInt(el.dataset.idx);
      CONFIG.partners[idx][el.dataset.field] = el.value;
    });
  });
  list.querySelectorAll(".partner-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      CONFIG.partners.splice(parseInt(btn.dataset.idx), 1);
      renderPartners();
    });
  });
}

function esc(s) { return (s || "").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

document.getElementById("btn-add-partner").addEventListener("click", () => {
  if (!CONFIG.partners) CONFIG.partners = [];
  CONFIG.partners.push({ name: "", url: "", role: "partner", shape: "badge", logo: "" });
  renderPartners();
});

function collectConfig() {
  CONFIG.intro = { de: document.getElementById("cfg-intro-de").value, en: document.getElementById("cfg-intro-en").value };
  CONFIG.location = { name: document.getElementById("cfg-loc-name").value, address: document.getElementById("cfg-loc-address").value, mapsUrl: document.getElementById("cfg-loc-maps").value };
  CONFIG.time = document.getElementById("cfg-time").value;
  CONFIG.season = document.getElementById("cfg-season").value;
  CONFIG.links = { whatsapp: document.getElementById("cfg-wa").value, boardSwap: document.getElementById("cfg-boards").value };
  CONFIG.imprint = document.getElementById("cfg-imprint").value;
}

document.getElementById("btn-save-config").addEventListener("click", async () => {
  collectConfig();
  try {
    const res = await api("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CONFIG)
    });
    const data = await res.json();
    if (!res.ok) { showStatus(data.error, "err"); return; }
    showStatus("Config gespeichert");
  } catch (e) { showStatus("Fehler: " + e.message, "err"); }
});

// --- Photos Tab ---

function populatePhotoDateSelect() {
  const sel = document.getElementById("photo-date-select");
  sel.innerHTML = '<option value="">Datum waehlen...</option>';
  if (!DATES) return;
  const today = new Date().toISOString().split("T")[0];
  const allDates = [];
  DATES.seasons.forEach(s => {
    (s.dates || []).forEach(d => { if (d <= today) allDates.push(d); });
  });
  allDates.sort().reverse();
  allDates.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d; opt.textContent = formatDate(d);
    sel.appendChild(opt);
  });
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

document.getElementById("photo-date-select").addEventListener("change", async e => {
  const date = e.target.value;
  const area = document.getElementById("photo-area");
  if (!date) { area.classList.add("hidden"); return; }
  area.classList.remove("hidden");
  pendingFiles = [];
  document.getElementById("upload-previews").innerHTML = "";
  document.getElementById("btn-upload").classList.add("hidden");
  await loadPhotos(date);
});

async function loadPhotos(date) {
  const grid = document.getElementById("photo-grid");
  grid.innerHTML = "";
  try {
    const keys = await fetch(`/api/photos/list?date=${date}`).then(r => r.json());
    document.getElementById("photo-count").textContent = `${keys.length} Fotos`;
    keys.forEach(key => {
      const thumb = document.createElement("div");
      thumb.className = "photo-thumb";
      thumb.innerHTML = `<img src="/api/photos/serve?key=${encodeURIComponent(key)}" loading="lazy" alt="">
        <button class="delete-overlay" data-key="${esc(key)}" title="Loeschen">&times;</button>`;
      grid.appendChild(thumb);
    });
    grid.querySelectorAll(".delete-overlay").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Foto loeschen?")) return;
        try {
          await api(`/api/admin/photos?key=${encodeURIComponent(btn.dataset.key)}`, { method: "DELETE" });
          await loadPhotos(date);
          showStatus("Foto geloescht");
        } catch (e) { showStatus("Fehler: " + e.message, "err"); }
      });
    });
  } catch { document.getElementById("photo-count").textContent = "0 Fotos"; }
}

// Upload zone
const uploadZone = document.getElementById("upload-zone");
const photoInput = document.getElementById("photo-input");

uploadZone.addEventListener("click", () => photoInput.click());
uploadZone.addEventListener("dragover", e => { e.preventDefault(); uploadZone.classList.add("dragover"); });
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", e => {
  e.preventDefault(); uploadZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
photoInput.addEventListener("change", () => handleFiles(photoInput.files));

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith("image/"));
  if (!files.length) return;

  const previews = document.getElementById("upload-previews");
  for (const file of files) {
    const compressed = await compressImage(file);
    pendingFiles.push(compressed);
    const img = document.createElement("img");
    img.src = URL.createObjectURL(compressed);
    previews.appendChild(img);
  }
  document.getElementById("btn-upload").classList.remove("hidden");
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("compression failed"));
      }, "image/jpeg", 0.8);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("invalid image"));
    img.src = URL.createObjectURL(file);
  });
}

document.getElementById("btn-upload").addEventListener("click", async () => {
  const date = document.getElementById("photo-date-select").value;
  if (!date || !pendingFiles.length) return;

  const btn = document.getElementById("btn-upload");
  btn.disabled = true;
  const progressWrap = document.getElementById("upload-progress");
  const progressFill = document.getElementById("progress-fill");
  const statusText = document.getElementById("upload-status");
  progressWrap.classList.remove("hidden");

  let uploaded = 0;
  for (const blob of pendingFiles) {
    statusText.textContent = `${uploaded + 1} / ${pendingFiles.length}...`;
    progressFill.style.width = `${(uploaded / pendingFiles.length) * 100}%`;

    const fd = new FormData();
    fd.append("date", date);
    fd.append("file", blob, `photo-${date}-${uploaded}.jpg`);
    try {
      await api("/api/admin/photos", { method: "POST", body: fd });
      uploaded++;
    } catch (e) {
      showStatus(`Fehler bei Foto ${uploaded + 1}: ${e.message}`, "err");
      break;
    }
  }

  progressFill.style.width = "100%";
  statusText.textContent = `${uploaded} Fotos hochgeladen`;
  pendingFiles = [];
  document.getElementById("upload-previews").innerHTML = "";
  btn.classList.add("hidden");
  btn.disabled = false;
  setTimeout(() => progressWrap.classList.add("hidden"), 2000);
  await loadPhotos(date);
  showStatus(`${uploaded} Fotos hochgeladen`);
});

// --- Password change modal ---

document.getElementById("btn-pw-change").addEventListener("click", () => {
  document.getElementById("modal-pw").classList.add("show");
  document.getElementById("pw-error").textContent = "";
  document.getElementById("pw-current").value = "";
  document.getElementById("pw-new").value = "";
  document.getElementById("pw-confirm").value = "";
});

document.getElementById("btn-pw-cancel").addEventListener("click", () => {
  document.getElementById("modal-pw").classList.remove("show");
});

document.getElementById("btn-pw-save").addEventListener("click", async () => {
  const current = document.getElementById("pw-current").value;
  const pw = document.getElementById("pw-new").value;
  const confirm = document.getElementById("pw-confirm").value;
  const errEl = document.getElementById("pw-error");

  if (!current || !pw) { errEl.textContent = "Alle Felder ausfuellen"; return; }
  if (pw !== confirm) { errEl.textContent = "Passwoerter stimmen nicht ueberein"; return; }
  if (pw.length < 6) { errEl.textContent = "Mindestens 6 Zeichen"; return; }

  try {
    const res = await api("/api/admin/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, password: pw })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    document.getElementById("modal-pw").classList.remove("show");
    showStatus("Passwort geaendert");
  } catch (e) { errEl.textContent = "Fehler: " + e.message; }
});

// --- Analytics widget ---

async function loadAnalytics() {
  const bar = document.getElementById("analytics-bar");
  if (!bar) return;
  try {
    const res = await api("/api/admin/analytics");
    if (!res.ok) { bar.innerHTML = ""; return; }
    const d = await res.json();

    // Mini bar chart from daily data
    const maxViews = Math.max(1, ...d.daily.map(x => x.views));
    const bars = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      const day = d.daily.find(x => x.date === date);
      const v = day ? day.views : 0;
      const h = Math.max(2, (v / maxViews) * 32);
      const cls = v > 0 ? "mini-bar has-data" : "mini-bar";
      bars.push(`<div class="${cls}" style="height:${h}px" title="${date}: ${v}"></div>`);
    }

    bar.innerHTML = `
      <div class="stat-box"><div class="stat-num">${d.week.views}</div><div class="stat-label">Views / 7d</div></div>
      <div class="stat-box"><div class="stat-num">${d.week.visits}</div><div class="stat-label">Besucher / 7d</div></div>
      <div class="stat-box"><div class="mini-chart">${bars.join("")}</div><div class="stat-label">Letzte 7 Tage</div></div>
      <div class="stat-box"><div class="stat-num">${d.month.views}</div><div class="stat-label">Views / 30d</div></div>
    `;
  } catch { bar.innerHTML = ""; }
}

// --- Init ---
checkAuth();
