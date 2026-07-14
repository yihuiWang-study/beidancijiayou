const state = {
  mode: "reading",
  pools: { reading: [], listening: [] },
  current: null,
  answered: false,
};

const storeKey = "ielts-word-card-v2";
const $ = (id) => document.getElementById(id);

function readStore() {
  const fallback = { done: {}, mistakes: {}, customReading: [] };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(storeKey) || "{}") };
  } catch {
    return fallback;
  }
}

function writeStore(data) {
  localStorage.setItem(storeKey, JSON.stringify(data));
}

function keyFor(word) {
  return word.id;
}

async function loadWords() {
  let reading = window.VOCAB_DATA?.reading || [];
  let listening = window.VOCAB_DATA?.listening || [];
  if (!reading.length || !listening.length) {
    [reading, listening] = await Promise.all([
      fetch("./data/ielts-reading-538.json").then((res) => res.json()),
      fetch("./data/ielts-listening-179.json").then((res) => res.json()),
    ]);
  }
  const saved = readStore();
  state.pools.reading = [...reading, ...(saved.customReading || [])];
  state.pools.listening = listening;
  pickWord();
}

function activePool() {
  if (state.mode === "mistakes") {
    const saved = readStore();
    const all = [...state.pools.reading, ...state.pools.listening];
    return Object.keys(saved.mistakes || {})
      .map((id) => all.find((word) => word.id === id))
      .filter(Boolean);
  }
  return state.pools[state.mode] || [];
}

function pickWord() {
  const saved = readStore();
  const pool = activePool();
  const remaining = pool.filter((word) => !saved.done[keyFor(word)] || state.mode === "mistakes");
  state.current = remaining[0] || pool[0] || null;
  state.answered = false;
  render();
}

function render() {
  const saved = readStore();
  const pool = activePool();
  const doneInMode = pool.filter((word) => saved.done[keyFor(word)]).length;
  const index = state.current ? Math.max(0, pool.findIndex((word) => word.id === state.current.id)) + 1 : 0;
  const progress = pool.length ? Math.round((doneInMode / pool.length) * 100) : 0;

  $("doneCount").textContent = doneInMode;
  $("leftCount").textContent = Math.max(pool.length - doneInMode, 0);
  $("mistakeCount").textContent = Object.keys(saved.mistakes || {}).length;
  $("progressBar").style.width = `${progress}%`;
  $("counter").textContent = `${index} / ${pool.length}`;

  $("mistakePanel").hidden = state.mode !== "mistakes";
  renderMistakes();

  if (!state.current) {
    $("term").textContent = state.mode === "mistakes" ? "错词本是空的" : "词库为空";
    $("meaning").textContent = "";
    $("synonyms").textContent = "";
    $("answer").hidden = true;
    $("hint").textContent = "";
    $("wrongBtn").disabled = true;
    $("rightBtn").disabled = true;
    $("nextBtn").hidden = true;
    return;
  }

  $("wrongBtn").disabled = false;
  $("rightBtn").disabled = false;
  $("term").textContent = state.current.term;
  $("meaning").textContent = state.current.meaning || "暂无中文释义";
  $("synonyms").textContent = state.current.synonyms ? `同义替换：${state.current.synonyms}` : "暂无同义替换";
  $("answer").hidden = !state.answered;
  $("hint").textContent = "";
  $("nextBtn").hidden = !state.answered;
}

function answer(isCorrect) {
  if (!state.current) return;
  const saved = readStore();
  const id = keyFor(state.current);
  saved.done[id] = true;
  if (isCorrect) {
    delete saved.mistakes[id];
  } else {
    saved.mistakes[id] = { at: Date.now(), source: state.mode };
  }
  writeStore(saved);
  state.answered = true;
  render();
}

function nextWord() {
  const saved = readStore();
  const pool = activePool();
  const start = state.current ? pool.findIndex((word) => word.id === state.current.id) + 1 : 0;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  state.current = ordered.find((word) => state.mode === "mistakes" || !saved.done[keyFor(word)]) || ordered[0] || null;
  state.answered = false;
  render();
}

function renderMistakes() {
  const saved = readStore();
  const all = [...state.pools.reading, ...state.pools.listening];
  const words = Object.keys(saved.mistakes || {})
    .map((id) => all.find((word) => word.id === id))
    .filter(Boolean);
  $("mistakeList").innerHTML = words.length
    ? words.map((word) => `<div class="mistake-item"><strong>${word.term}</strong><span>${word.meaning}</span><span>${word.synonyms || ""}</span></div>`).join("")
    : `<div class="mistake-item"><strong>暂无错词</strong><span>选择“不会”的词会自动加入。</span></div>`;
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  pickWord();
}

function importReading() {
  const lines = $("importText").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return;
  const saved = readStore();
  const now = Date.now();
  const imported = lines.map((line, index) => {
    const [term, meaning = "", synonyms = ""] = line.split(/[｜|]/).map((part) => part.trim());
    return { id: `custom-reading-${now}-${index}`, number: state.pools.reading.length + index + 1, term, meaning, synonyms };
  }).filter((word) => word.term);
  saved.customReading = [...(saved.customReading || []), ...imported];
  writeStore(saved);
  state.pools.reading.push(...imported);
  $("importText").value = "";
  setMode("reading");
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
$("wrongBtn").addEventListener("click", () => answer(false));
$("rightBtn").addEventListener("click", () => answer(true));
$("nextBtn").addEventListener("click", nextWord);
$("importBtn").addEventListener("click", importReading);
$("clearMistakes").addEventListener("click", () => {
  const saved = readStore();
  saved.mistakes = {};
  writeStore(saved);
  render();
});
$("resetProgress").addEventListener("click", () => {
  const saved = readStore();
  activePool().forEach((word) => delete saved.done[keyFor(word)]);
  writeStore(saved);
  pickWord();
});

loadWords();
