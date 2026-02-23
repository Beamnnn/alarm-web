const STORAGE_KEY = "multi_alarm_pages_v1";
const DEFAULT_COUNT = 10;
const DEFAULT_MINUTES = 20;

const grid = document.getElementById("grid");
const toast = document.getElementById("toast");

function pad2(n) { return String(n).padStart(2, "0"); }
function formatMMSS(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

// เสียง beep
function beep(durationMs = 600, freq = 880) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, durationMs);
  } catch {}
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}

function defaultTimers(count = DEFAULT_COUNT) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `t-${i + 1}-${Date.now()}`,
    label: `รายการ ${i + 1}`,
    minutes: DEFAULT_MINUTES,
    remainingSec: DEFAULT_MINUTES * 60,
    running: false,
    done: 0,
    justFinished: false,
  }));
}

let timers = loadTimers();

function loadTimers() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultTimers();
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return defaultTimers();
    return arr.map((t, idx) => ({
      id: t.id || `t-${idx + 1}-${Date.now()}`,
      label: typeof t.label === "string" ? t.label : `รายการ ${idx + 1}`,
      minutes: Math.max(1, Math.floor(Number(t.minutes || DEFAULT_MINUTES))),
      remainingSec: Math.max(0, Math.floor(Number(t.remainingSec || DEFAULT_MINUTES * 60))),
      running: Boolean(t.running),
      done: Math.max(0, Math.floor(Number(t.done || 0))),
      justFinished: false,
    }));
  } catch {
    return defaultTimers();
  }
}

function saveTimers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  grid.innerHTML = "";

  timers.forEach((t) => {
    const total = t.minutes * 60;
    const progress = total > 0 ? (total - t.remainingSec) / total : 0;

    const card = document.createElement("section");
    card.className = "card";

    card.innerHTML = `
      <div class="row">
        <input class="label" value="${escapeHtml(t.label)}" placeholder="ชื่อรายการ"/>
        <input class="minutes" type="number" min="1" value="${t.minutes}" title="ตั้งนาที"/>
        <span style="opacity:.7">นาที</span>
      </div>

      <div class="time">${formatMMSS(t.remainingSec)}</div>

      <div class="bar">
        <div class="fill" style="width:${Math.min(100, Math.max(0, progress * 100))}%"></div>
      </div>

      <div class="meta">
        <button class="start primary">${t.running ? "Pause" : "Start"}</button>
        <button class="reset">Reset</button>
        <span class="right">ครบแล้ว: ${t.done} รอบ</span>
      </div>
    `;

    const labelInput = card.querySelector(".label");
    const minInput = card.querySelector(".minutes");
    const startBtn = card.querySelector(".start");
    const resetBtn = card.querySelector(".reset");

    labelInput.addEventListener("input", (e) => {
      t.label = e.target.value;
      saveTimers();
    });

    minInput.addEventListener("change", (e) => {
      const m = Math.max(1, Math.floor(Number(e.target.value || 1)));
      t.minutes = m;
      if (!t.running) t.remainingSec = m * 60;
      saveTimers();
      render();
    });

    startBtn.addEventListener("click", () => {
      if (t.remainingSec <= 0) t.remainingSec = t.minutes * 60; // ถ้าจบแล้วเริ่มใหม่
      t.running = !t.running;
      t.justFinished = false;
      saveTimers();
      render();
    });

    resetBtn.addEventListener("click", () => {
      t.running = false;
      t.remainingSec = t.minutes * 60;
      t.justFinished = false;
      saveTimers();
      render();
    });

    grid.appendChild(card);
  });
}

document.getElementById("pauseAll").addEventListener("click", () => {
  timers.forEach(t => t.running = false);
  saveTimers();
  render();
});

document.getElementById("resetAll").addEventListener("click", () => {
  timers.forEach(t => {
    t.running = false;
    t.remainingSec = t.minutes * 60;
    t.justFinished = false;
  });
  saveTimers();
  render();
});

document.getElementById("add").addEventListener("click", () => {
  timers.push({
    id: `t-${Date.now()}`,
    label: `รายการ ${timers.length + 1}`,
    minutes: DEFAULT_MINUTES,
    remainingSec: DEFAULT_MINUTES * 60,
    running: false,
    done: 0,
    justFinished: false,
  });
  saveTimers();
  render();
});

document.getElementById("remove").addEventListener("click", () => {
  if (timers.length <= 1) return;
  timers.pop();
  saveTimers();
  render();
});

// Tick ทุก 1 วินาที
setInterval(() => {
  let changed = false;

  timers.forEach((t) => {
    if (!t.running) return;

    t.remainingSec = Math.max(0, t.remainingSec - 1);
    changed = true;

    if (t.remainingSec === 0) {
      t.running = false;
      t.done += 1;

      if (!t.justFinished) {
        t.justFinished = true;
        beep(650, 880);
        setTimeout(() => beep(650, 660), 200);
        showToast(`⏰ ${t.label} ครบ ${t.minutes} นาทีแล้ว!`);
      }
    }
  });

  if (changed) {
    saveTimers();
    render();
  }
}, 1000);

render();