// LinguGame: 20x10, 빈칸 유지, 200s, 콤보창 2s, 가로 에뮬레이션(세로 상태 모바일에서 화면만 90° 회전)
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

  // ---- Board / Render ----
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

  // 화면 크기에 맞춰 셀 크기 계산
  function getViewportSize(){
    const vw = window.visualViewport ? visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? visualViewport.height : window.innerHeight;
    // 세로 모바일에서 가로 에뮬레이션 중이면 가상 가로/세로를 바꿔 계산
    const emu = document.body.classList.contains("emu-landscape");
    const portrait = document.body.classList.contains("portrait");
    if (emu && portrait) return { w: vh, h: vw };
    return { w: vw, h: vh };
  }

  function resizeBoardToFit(){
    const hud = document.querySelector(".hud");
    const hudH = hud ? hud.getBoundingClientRect().height : 0;

    const { w, h } = getViewportSize();

    const maxW = w * 0.96;
    const maxH = (h - hudH - 80);

    const gap = 4;
    const cellW = Math.floor((maxW - gap*(COLS-1)) / COLS);
    const cellH = Math.floor((maxH - gap*(ROWS-1)) / ROWS);
    const cell = Math.max(24, Math.min(cellW, cellH));

    document.documentElement.style.setProperty("--cell-size", `${cell}px`);
  }

  // ---- HUD / Score ----
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

  // ---- Input / Selection ----
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
    // 회전 변환은 레이아웃 상에서 적용되므로 elementFromPoint는 시각 위치 기준으로 정상 동작
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
      // 제거: 빈칸 유지(낙하/보충 없음)
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

  // ---- Timer ----
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

  // ---- Lifecycle ----
  function startGame(){
    UI.toPlay();
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
      nickname: UI.getNickname(),
      total, base: scoreBase, bonus: scoreBonus,
      maxCombo,
      duration: LIMIT_SEC - Math.max(0, Math.ceil(remainSec)),
      result
    };
    UI.pushRecord(run);
    UI.renderRecords();

    UI.toMain(); // 결과 화면을 쓰려면 UI.toResult()
  }

  function exitToMain(){
    if (running) finishGame("exit");
    else { AudioCtrl.stop(); UI.toMain(); }
  }

  // ---- Events ----
  window.addEventListener("DOMContentLoaded", () => {
    $("btn-start").addEventListener("click", startGame);
    $("btn-exit").addEventListener("click", exitToMain);
    $("btn-restart").addEventListener("click", startGame);
    $("btn-result-restart").addEventListener("click", startGame);
    $("btn-result-main").addEventListener("click", exitToMain);

    resizeBoardToFit();
  });

  // 방향/뷰포트 변화 → 회전 에뮬/보드 리사이즈 갱신
  function onViewportChange(){
    UI.updateEmulatedLandscape();
    resizeBoardToFit();
  }
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", () => setTimeout(onViewportChange, 80));
  if (window.visualViewport){
    visualViewport.addEventListener("resize", onViewportChange);
    visualViewport.addEventListener("scroll", onViewportChange);
  }
})();
