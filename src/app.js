// ─────────────────────────────────────────────────────────────────────────────
// BACKEND URL — paste your bot's API endpoint here, or set it via the Settings
// tab and it will be saved to localStorage automatically.
// ─────────────────────────────────────────────────────────────────────────────
let BACKEND_URL = localStorage.getItem("vpBackendUrl") || "";

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove());
  }, 3500);
}

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${tab}`).classList.add("active");
    if (window.innerWidth <= 680) closeSidebar();
  });
});

// ── Mobile sidebar ────────────────────────────────────────────────────────────
const sidebar = document.getElementById("sidebar");
const mobileToggle = document.getElementById("mobileToggle");

function closeSidebar() { sidebar.classList.remove("open"); }
mobileToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
document.addEventListener("click", (e) => {
  if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) closeSidebar();
});

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  if (!BACKEND_URL) {
    showToast("No backend URL set. Go to Settings and save one.", "error");
    return null;
  }
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
    return await res.json();
  } catch (err) {
    showToast(`Request failed: ${err.message}`, "error");
    return null;
  }
}

// ── Overview — load stats ─────────────────────────────────────────────────────
async function loadStats() {
  const data = await apiFetch("/stats");
  if (!data) return;
  document.getElementById("metric-servers").textContent = data.servers ?? "—";
  document.getElementById("metric-users").textContent   = data.users   ?? "—";
  document.getElementById("metric-ping").textContent    = data.ping    ? `${data.ping}ms` : "—";
  document.getElementById("metric-uptime").textContent  = data.uptime  ?? "—";
}

document.getElementById("refreshActivity").addEventListener("click", () => {
  loadStats();
  showToast("Stats refreshed.", "info");
});

// ── Settings — save backend URL ───────────────────────────────────────────────
const backendInput = document.getElementById("backendUrlInput");
backendInput.value = BACKEND_URL;

document.getElementById("saveBackendBtn").addEventListener("click", () => {
  const url = backendInput.value.trim().replace(/\/$/, "");
  if (!url) {
    showToast("Please enter a valid URL.", "error");
    return;
  }
  BACKEND_URL = url;
  localStorage.setItem("vpBackendUrl", url);
  showToast("Backend URL saved!", "success");
});

// ── Settings — change bot status ──────────────────────────────────────────────
document.getElementById("updateStatusBtn").addEventListener("click", async () => {
  const status = document.getElementById("statusText").value.trim();
  const type   = document.getElementById("activityType").value;

  if (!status) {
    showToast("Please enter a status message.", "error");
    return;
  }

  const btn = document.getElementById("updateStatusBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";

  const data = await apiFetch("/update-status", {
    method: "POST",
    body: JSON.stringify({ status, type }),
  });

  btn.disabled = false;
  btn.textContent = "Change Status";

  if (data) showToast(`Status updated to "${type} ${status}"`, "success");
});

// ── Settings — force refresh cache ───────────────────────────────────────────
document.getElementById("refreshCacheBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshCacheBtn");
  btn.disabled = true;
  btn.textContent = "Refreshing…";

  const data = await apiFetch("/refresh-cache", { method: "POST" });

  btn.disabled = false;
  btn.textContent = "↻ Force Refresh Cache";

  if (data) showToast("Cache cleared. Next poll will do a fresh scan.", "success");
});

// ── Logs — filter ─────────────────────────────────────────────────────────────
let activeFilter = "all";

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyFilter();
  });
});

function applyFilter() {
  document.querySelectorAll(".console-line").forEach((line) => {
    if (activeFilter === "all") {
      line.classList.remove("hidden");
    } else {
      line.classList.toggle("hidden", !line.classList.contains(activeFilter));
    }
  });
}

// ── Logs — clear ─────────────────────────────────────────────────────────────
document.getElementById("clearLogsBtn").addEventListener("click", () => {
  document.getElementById("consoleWindow").innerHTML = "";
  showToast("Logs cleared.", "info");
});

// ── Logs — fetch live ─────────────────────────────────────────────────────────
document.getElementById("fetchLogsBtn").addEventListener("click", async () => {
  const data = await apiFetch("/logs");
  if (!data || !Array.isArray(data.lines)) return;

  const win = document.getElementById("consoleWindow");
  win.innerHTML = "";

  data.lines.forEach(({ time, level, msg }) => {
    const lvl = (level || "info").toLowerCase();
    const line = document.createElement("div");
    line.className = `console-line ${lvl}`;
    line.innerHTML = `
      <span class="log-time">${time || "--:--:--"}</span>
      <span class="log-badge ${lvl}">${lvl.toUpperCase()}</span>
      <span class="log-msg">${escapeHtml(msg)}</span>
    `;
    win.appendChild(line);
  });

  applyFilter();
  win.scrollTop = win.scrollHeight;
  showToast(`Loaded ${data.lines.length} log lines.`, "success");
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── On load ───────────────────────────────────────────────────────────────────
if (BACKEND_URL) loadStats();
