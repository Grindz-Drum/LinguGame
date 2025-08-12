// LinguGame: 20x10, 빈칸 유지, 200s, 콤보창 2s, 세로 모바일 회전/스케일 대응
(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const btnStart = $("btn-start");
  const btnExit  = $("btn-exit");
  const btnRestart = $("btn-restart");
  const btnResultRestart = $("btn-result-restart");
  const btnResultMain = $("btn-result-main");

  const boardEl  = $("board");
  const timeEl   = $("time");
  const scoreEl  = $("score");
  const comboBar = $("comboBar");

  // Const
  const COLS = 20, ROWS = 10;
  const LIMIT_SEC = 200;
  const COMBO_WINDOW_MS = 2000;

  // State
  let board = []; // 1..9 or null
  let running = false;
  let startAt = 0;
  let remainSec = LIMIT_SEC;
  let tickId = null;

  // Score/Combo
  let scoreBase = 0, scoreBonus = 0;
  let activeCombo = 0, lastSuccessAt = null, comboOpen = false;
  let comboTickId = null, comboSegments = [], maxCombo = 0;

  // Selection
  let selecting = false, selectedSet = new Set(), selectedList = [], sumSelected = 0;

  const IMG = (n) => `assets/penguins/penguin_${n}.png`;
  const keyOf = (r,c) => `${r},${c}`;
  const isEmpty = (r,c) => board[r][c] == null;

  // ----- Board / Render -----
  function initBoard(){
    board = Array.from({length: ROWS}, () =>
      Array.from({length: COLS}, () => Math.floor(Math.random()*9)+1));
  }

  function renderBoard(){
    boardEl.innerHTML = "";
    for (let r=0;r<ROWS;r++){
      for (let c=0;c<COLS;c++){
        const v = board[r][c];
        const cell = document.createElement("div");
        cell.className = "cell" + (v==null ? " empty" : "");
        cell.dataset.r = r; cell.dataset.c = c;
        if (v != null){
          const img = document.createElement("img");
          img.alt = `penguin ${v}`;
          img.src = IMG(v);
          cell.appendChild(img);
        }
        boardEl.appendChild(cell);
      }
    }
  }

  // 화면 크기에 맞춰 셀 크기 계산 (회전/스케일 고려)
  function getViewportSize(){
    const vw = window.visualViewport ? visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? visualViewport.height : window.innerHeight;
    // 세로 모바일이면 UI에서 회전/스케일로 화면을 맞추고 있으니,
    // 논리적으로는 가로=vh, 세로=vw 로 계산
    const portrait = window.matchMedia && window.matchMedia("(orientation: portrait)").matches;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (mobile && portrait) return { w: vh, h: vw };
    return { w: vw, h: vh };
  }

  function resizeBoardToFit(){
    const hud = document.querySelector(".hud");
    const hudH = hud ? hud.getBoundingClientRect().height : 0;

    const { w, h } = getViewportSize();

    const maxW = w * 0.96;
    const maxH = (h - hudH - 80); // 여백

    const gap = 4;
    const cellW = Math.floor((maxW - gap*(COLS-1)) / COLS);
    const cellH = Math.floor((maxH - gap*(ROWS-1)) / ROWS);
    const cell = Math.max(24, Math.min(cellW, cellH));

    document.documentElement.style.setProperty("--cell-size", `${cell}px`);
  }

  // ----- HUD / Score -----
  function resetScore(){
    scoreBase = 0; scoreBonus = 0;
    activeCombo = 0; lastSuccessAt = null; comboOpen = false;
    comboSegments = []; maxCombo = 0;
    updateHUD();
  }

  function updateHUD(){
    timeEl.textContent = Math.max(0, Math.ceil(remainSec));
    scoreEl.innerHTML = `${Math.floor(scoreBase + scoreBonus)} <span class="score-split" id="scoreSplit">(B ${scoreBase} / C ${scoreBonus})</span>`;
    if (lastSuccessAt && comboOpen){
      const left = Math.max(0, COMBO_WINDOW_MS - (performance.now() - lastSuccessAt));
      const pct = Math.max(0, Math.min(100, (left/COMBO_WINDOW_MS)*100));
      comboBar.style.width = `${pct}%`;
    } else {
      comboBar.style.width = "0%";
    }
  }

  function startComboGauge(){
    if (comboTickId) clearInterval(comboTickId);
    comboTickId = setInterval(() => {
      if (!comboOpen) { clearInterval(comboTickId); comboTickId = null; return; }
      const left = Math.max(0, COMBO_WINDOW_MS - (performance.now() - lastSuccessAt));
      comboBar.style.width = `${Math.max(0, Math.min(100, (left/COMBO_WINDOW_MS)*100))}%`;
      if (left <= 0) closeComboSegment();
    }, 50);
  }

  function closeComboSegment(){
    if (activeCombo > 0){
      comboSegments.push(activeCombo);
      scoreBonus += Math.floor(0.5 * activeCombo);
    }
    activeCombo = 0; lastSuccessAt = null; comboOpen = false;
    comboBar.style.width = "0%";
    updateHUD();
  }

  // ----- Input / Selection -----
  function bindBoardInputs(){
    selectedSet.clear(); selectedList = []; sumSelected = 0;

    const onDown = (e) => {
      const cell = getCellFromEvent(e);
      if (!cell) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;
      if (isEmpty(r,c)) return;
      selecting = true;
      addSelect(r,c, cell);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!selecting) return;
      const cell = getCellFromEvent(e);
      if (!cell) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;
      if (isEmpty(r,c)) return;
      addSelect(r,c, cell);
    };
    const onUp = () => {
      if (!selecting) return;
      selecting = false;
      commitSelection();
    };

    boardEl.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    boardEl.addEventListener("touchstart", onDown, {passive:false});
    boardEl.addEventListener("touchmove", onMove, {passive:false});
    boardEl.addEventListener("touchend", onUp);
  }

  function getCellFromEvent(e){
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    let t = document.elementFromPoint(p.clientX, p.clientY);
    if (!t) return null;
    if (t.classList.contains("cell")) return t;
    if (t.parentElement && t.parentElement.classList.contains("cell")) return t.parentElement;
    return null;
  }

  function addSelect(r,c, cellEl){
    const k = keyOf(r,c);
    if (selectedSet.has(k)) return;
    selectedSet.add(k);
    selectedList.push({r,c});
    sumSelected += (board[r][c] || 0);
    cellEl.classList.add("selected");
  }

  function clearSelectionCSS(){
    for (const {r,c} of selectedList){
      const idx = r*COLS + c;
      const cell = boardEl.children[idx];
      if (cell) cell.classList.remove("selected");
    }
  }

  function commitSelection(){
    const ok = (sumSelected === 10 && selectedList.length >= 2);
    if (ok){
      // 제거: 빈칸 유지
      for (const {r,c} of selectedList) board[r][c] = null;
      scoreBase += selectedList.length;

      // 콤보 성공
      const now = performance.now();
      if (lastSuccessAt && (now - lastSuccessAt <= COMBO_WINDOW_MS)) activeCombo += 1;
      else {
        if (comboOpen) closeComboSegment();
        activeCombo = 1; comboOpen = true;
      }
      lastSuccessAt = now;
      if (activeCombo > maxCombo) maxCombo = activeCombo;
      startComboGauge();

      renderBoard();
      if (isCleared()) { finishGame("clear"); return; }
    }
    clearSelectionCSS();
    selectedSet = new Set(); selectedList = []; sumSelected = 0;
    updateHUD();
  }

  function isCleared(){
    for (let r=0;r<ROWS;r++){
      for (let c=0;c<COLS;c++){
        if (board[r][c] != null) return false;
      }
    }
    return true;
  }

  // ----- Timer -----
  function startTimer(){
    startAt = performance.now();
    remainSec = LIMIT_SEC;
    if (tickId) clearInterval(tickId);
    tickId = setInterval(() => {
      const now = performance.now();
      remainSec = LIMIT_SEC - (now - startAt)/1000;
      if (remainSec <= 0){
        remainSec = 0;
        finishGame("timeout");
      }
      if (comboOpen && lastSuccessAt && (now - lastSuccessAt > COMBO_WINDOW_MS)) closeComboSegment();
      updateHUD();
    }, 100);
  }

  // ----- Lifecycle -----
  function startGame(){
    UI.toPlay();
    // 회전/스케일 재적용 후 보드 리사이즈
    UI.applyFitTransform();
    running = true;
    AudioCtrl.play();
    initBoard(); renderBoard(); bindBoardInputs();
    resetScore(); resizeBoardToFit(); startTimer();
  }

  function finishGame(result){
    if (!running) return;
    running = false;
    if (tickId) { clearInterval(tickId); tickId = null; }
    if (comboOpen && activeCombo > 0) closeComboSegment();
    AudioCtrl.stop();

    const total = Math.floor(scoreBase + scoreBonus);
    const run = {
      ts: Date.now(),
      nickname: localStorage.getItem("lingu_nickname") || "Player",
      total, base: scoreBase, bonus: scoreBonus,
      maxCombo,
      duration: LIMIT_SEC - Math.max(0, Math.ceil(remainSec)),
      result
    };
    // 기록 저장/갱신
    try {
      const list = JSON.parse(localStorage.getItem("lingu_records") || "[]");
      list.unshift(run); while (list.length > 5) list.pop();
      localStorage.setItem("lingu_records", JSON.stringify(list));
    } catch(_) {}
    // 메인에서 최신 렌더
    UI.toMain(); UI.applyFitTransform();
    // 약간 늦춰서 리스트 렌더(전환 후 DOM 준비)
    setTimeout(() => {
      const UI_mod = window.UI || null;
      UI_mod && UI_mod.renderRecords && UI_mod.renderRecords();
    }, 0);
  }

  function exitToMain(){
    if (running) finishGame("exit");
    else { AudioCtrl.stop(); UI.toMain(); UI.applyFitTransform(); }
  }

  // ----- Events -----
  window.addEventListener("DOMContentLoaded", () => {
    $("btn-start").addEventListener("click", startGame);
    $("btn-exit").addEventListener("click", exitToMain);
    $("btn-restart").addEventListener("click", startGame);
    $("btn-result-restart").addEventListener("click", startGame);
    $("btn-result-main").addEventListener("click", exitToMain);

    // 최초 메인 화면 피팅
    UI.applyFitTransform();
  });

  // 화면/주소창/회전 변화 대응
  function onViewportChange(){
    UI.applyFitTransform();
    // 플레이 중이면 보드도 재계산
    if (!document.getElementById("screen-play").classList.contains("hidden")){
      resizeBoardToFit();
    }
  }
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", () => setTimeout(onViewportChange, 80));
  if (window.visualViewport){
    visualViewport.addEventListener("resize", onViewportChange);
    visualViewport.addEventListener("scroll", onViewportChange);
  }
})();
