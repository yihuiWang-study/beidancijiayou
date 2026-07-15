const state = {
  mode: "reading",
  speakingFilter: "all",
  pools: { reading: [], listening: [], speaking: [] },
  current: null,
  answered: false,
  referenceVisible: false,
};

const storeKey = "ielts-word-card-v2";
const $ = (id) => document.getElementById(id);

function readStore() {
  const fallback = { done: {}, mistakes: {}, customReading: [], speakingDone: {}, speakingPractice: {} };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(storeKey) || "{}") };
  } catch {
    return fallback;
  }
}

function writeStore(data) {
  localStorage.setItem(storeKey, JSON.stringify(data));
}

function keyFor(item) {
  return item.id;
}

function speakCurrentWord() {
  if (!state.current || !("speechSynthesis" in window)) return;
  const text = state.mode === "speaking" ? state.current.answer || "" : state.current.term || state.current.title || "";
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find((voice) => /^en[-_]/i.test(voice.lang));
  if (englishVoice) utterance.voice = englishVoice;
  window.speechSynthesis.speak(utterance);
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
  state.pools.speaking = window.SPEAKING_DATA || [];
  if (!state.pools.speaking.length) {
    try {
      state.pools.speaking = await fetch("./data/ielts-speaking-topics.json").then((res) => (res.ok ? res.json() : []));
    } catch {
      state.pools.speaking = [];
    }
  }
  pickWord();
}

function activePool() {
  if (state.mode === "speaking") {
    const saved = readStore();
    const speaking = state.pools.speaking || [];
    if (state.speakingFilter === "practice") {
      return Object.keys(saved.speakingPractice || {})
        .map((id) => speaking.find((topic) => topic.id === id))
        .filter(Boolean);
    }
    if (state.speakingFilter === "all") return speaking;
    return speaking.filter((topic) => topic.part === state.speakingFilter);
  }
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
  const doneMap = state.mode === "speaking" ? saved.speakingDone || {} : saved.done || {};
  const remaining = pool.filter((item) => !doneMap[keyFor(item)] || state.mode === "mistakes" || state.speakingFilter === "practice");
  state.current = remaining[0] || pool[0] || null;
  state.answered = false;
  state.referenceVisible = false;
  render();
}

function render() {
  document.body.dataset.mode = state.mode;
  const saved = readStore();
  const pool = activePool();
  const doneMap = state.mode === "speaking" ? saved.speakingDone || {} : saved.done || {};
  const doneInMode = pool.filter((item) => doneMap[keyFor(item)]).length;
  const index = state.current ? Math.max(0, pool.findIndex((item) => item.id === state.current.id)) + 1 : 0;
  const progress = pool.length ? Math.round((doneInMode / pool.length) * 100) : 0;

  $("doneCount").textContent = doneInMode;
  $("leftCount").textContent = Math.max(pool.length - doneInMode, 0);
  $("mistakeCount").textContent = state.mode === "speaking" ? Object.keys(saved.speakingPractice || {}).length : Object.keys(saved.mistakes || {}).length;
  $("doneLabel").textContent = state.mode === "speaking" ? "已练" : "已测";
  $("leftLabel").textContent = state.mode === "speaking" ? "未练" : "剩余";
  $("mistakeLabel").textContent = state.mode === "speaking" ? "待练" : "错词";
  $("progressBar").style.width = `${progress}%`;
  $("counter").textContent = `${index} / ${pool.length}`;

  $("mistakePanel").hidden = state.mode !== "mistakes";
  $("speakingControls").hidden = state.mode !== "speaking";
  $("wordCard").classList.toggle("long-speaking-term", state.mode === "speaking" && (state.current?.title || "").length > 52);
  renderMistakes();

  if (!state.current) {
    $("term").textContent = state.mode === "mistakes" ? "错词本是空的" : "词库为空";
    $("meaning").textContent = "";
    $("synonyms").textContent = "";
    $("answer").hidden = true;
    $("referenceAnswer").hidden = true;
    $("hint").textContent = "";
    $("wrongBtn").disabled = true;
    $("rightBtn").disabled = true;
    $("speakBtn").disabled = true;
    $("nextBtn").hidden = true;
    return;
  }

  $("wrongBtn").disabled = false;
  $("rightBtn").disabled = false;
  $("speakBtn").disabled = !("speechSynthesis" in window);
  const speakingAudio = state.mode === "speaking";
  $("speakBtn").title = speakingAudio ? "朗读参考答案" : "朗读当前单词";
  $("speakBtn").setAttribute("aria-label", $("speakBtn").title);
  $("term").textContent = state.current.term || state.current.title;
  if (state.mode === "speaking") {
    $("meaning").textContent = `${state.current.part} · ${state.current.frequency || "常规"} · ${state.current.type || "练习题"}`;
    $("synonyms").innerHTML = `<strong>可用表达：</strong>${(state.current.keywords || []).join(" / ")}<br><br><strong>答题提示：</strong>${state.current.hint || ""}`;
    $("referenceAnswer").hidden = false;
    $("referenceText").textContent = state.current.answer || "暂无参考答案";
    $("referenceText").hidden = !state.referenceVisible;
    $("referenceToggle").textContent = state.referenceVisible ? "隐藏" : "显示";
    $("referenceToggle").setAttribute("aria-expanded", String(state.referenceVisible));
    $("wrongBtn").textContent = "不会说";
    $("rightBtn").textContent = "会说";
  } else {
    $("meaning").textContent = state.current.meaning || "暂无中文释义";
    $("synonyms").textContent = state.current.synonyms ? `同义替换：${state.current.synonyms}` : "暂无同义替换";
    $("wrongBtn").textContent = "不会";
    $("rightBtn").textContent = "会";
    $("referenceAnswer").hidden = true;
  }
  $("answer").hidden = state.mode === "speaking" ? false : !state.answered;
  $("hint").textContent = "";
  $("nextBtn").hidden = !state.answered;
}

function answer(isCorrect) {
  if (!state.current) return;
  const saved = readStore();
  const id = keyFor(state.current);
  if (state.mode === "speaking") {
    saved.speakingDone[id] = true;
    if (isCorrect) {
      delete saved.speakingPractice[id];
    } else {
      saved.speakingPractice[id] = { at: Date.now(), part: state.current.part };
    }
    writeStore(saved);
    state.answered = true;
    render();
    return;
  }
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
  const start = state.current ? pool.findIndex((item) => item.id === state.current.id) + 1 : 0;
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  const doneMap = state.mode === "speaking" ? saved.speakingDone || {} : saved.done || {};
  state.current = ordered.find((item) => state.mode === "mistakes" || state.speakingFilter === "practice" || !doneMap[keyFor(item)]) || ordered[0] || null;
  state.answered = false;
  state.referenceVisible = false;
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

function setSpeakingFilter(filter) {
  state.speakingFilter = filter;
  document.querySelectorAll(".speaking-filter").forEach((button) => button.classList.toggle("active", button.dataset.speakingFilter === filter));
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
document.querySelectorAll(".speaking-filter").forEach((button) => button.addEventListener("click", () => setSpeakingFilter(button.dataset.speakingFilter)));
$("wrongBtn").addEventListener("click", () => answer(false));
$("rightBtn").addEventListener("click", () => answer(true));
$("speakBtn").addEventListener("click", speakCurrentWord);
$("referenceToggle").addEventListener("click", () => {
  if (state.mode !== "speaking" || !state.current) return;
  state.referenceVisible = !state.referenceVisible;
  render();
});
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
  if (state.mode === "speaking") {
    activePool().forEach((item) => {
      delete saved.speakingDone[keyFor(item)];
      delete saved.speakingPractice[keyFor(item)];
    });
  } else {
    activePool().forEach((item) => delete saved.done[keyFor(item)]);
  }
  writeStore(saved);
  pickWord();
});

loadWords();
