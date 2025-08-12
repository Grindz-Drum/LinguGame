// LinguGame core: 20x10, 빈칸 유지, 200s, 콤보 창 2s, 기록 닉네임 저장
(() => {
  const $ = (id) => document.getElementById(id);

  // UI refs
  const btnStart = $("btn-start");
  const btnExit  = $("btn-exit");
  const btnRestart = $("btn-restart");
  const btnResultRestart = $("btn-result-restart");
  const btnResultMain = $("btn-result-main");

  const boardEl  = $("board");
  const timeEl   = $("time");
  const scoreEl  = $("score");
  const comboEl  = $("combo");
  const comboBar = $("comboBar");

  // Constants
  const COLS = 20;
  const ROWS = 10;
  const LIMIT_SEC = 200;
  const COMBO_WINDOW_MS = 2000;

  // State
  let board = [];      // 1..9 or null
  let running = false;
  let startAt = 0;
  let remainSec = LIMIT_SEC;
  let tickId = null;

  // Score & combo
  let scoreBase = 0;
  let scoreBonus = 0;
  let activeCombo = 0;
  let lastSuccessAt = null;
  let comboOpen = false;
  let comboTickId = null;
  let comboSegments = [];
  let maxCombo = 0;

  // Selection
  let selecting = false;
  let selectedSet = new Set();
  let selectedList = [];
  let sumSelected = 0;

  // Board helpers
  const IMG = (n) => `assets/penguins/penguin_${n}.png`;
  const keyOf = (r,c) => `${r},${c}`;
  const isEmpty = (r,c) => board[r][c] == null;

  function initBoard(){
    board = Array.from({length: ROWS}, () =>
      Array.from({length: COLS}, () => Math.floor(Math.random()*9)+1)
    );
  }

  function renderBoard(){
    boardEl.innerHTML = "";
    for (let r=0;r<ROWS;r++){
      for (let c=0;c<COLS;c++){
        const v = board[r][c];
        const cell = document.createElement("div");
        cell.className = "cell" + (v==null ? " empty" : "");
        cell.dataset.r = r;
        cell.dataset.c = c;
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

  // Fit 20x10 board to viewport
  function resizeBoardToFit() {
    const hud = document.querySelector(".hud");
    const hudH = hud ? hud.getBoundingClientRect().height : 0;
    const maxW = Math.min(document.querySelector(".app").getBoundingClientRect().width, window.innerWidth * 0.96);
    const maxH = Math.min(window.innerHeight * 0.84 - hudH, 720);

    const gap = 4;
    const sizeW = Math.floor((maxW - gap*(COLS-1)) / COLS);
    const sizeH = Math.floor((maxH - gap*(ROWS-1)) / ROWS);
    const cell = Math.max(24, Math.min(sizeW, sizeH));
    document.documentElement.style.setProperty("--cell-size", `${cell}px`);
  }

  function resetScore(){
    scoreBase = 0; scoreBonus = 0;
    activeCombo = 0; lastSuccessAt = null; comboOpen = false;
    comboSegments = []; maxCombo = 0;
    updateHUD();
  }

  function updateHUD(){
    timeEl.textContent = Math.max(0, Math.ceil(remainSec));
    scoreEl.innerHTML = `${Math.floor(scoreBase + scoreBonus)} <span class="score-split" id="scoreSplit">(B ${scoreBase} / C ${scoreBonus})</span>`;
    $("combo").textContent = activeCombo;
    // combo gauge
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
      if (left <= 0){
        // timeout -> close segment
        closeComboSegment();
      }
    }, 50);
  }

  function closeComboSegment(){
    if (activeCombo > 0){
      comboSegments.push(activeCombo);
      scoreBonus += Math.floor(0.5 * activeCombo);
    }
    activeCombo = 0;
    lastSuccessAt = null;
    comboOpen = false;
    comboBar.style.width = "0%";
    updateHUD();
  }

  // Selection handling
  function bindBoardInputs(){
    selectedSet.clear();
    selectedList = []; sumSelected = 0;

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
      // remove and leave holes
      for (const {r,c} of selectedList) board[r][c] = null;
      scoreBase += selectedList.length;

      // combo success
      const now = performance.now();
      if (lastSuccessAt && (now - lastSuccessAt <= COMBO_WINDOW_MS)){
        activeCombo += 1;
      } else {
        if (comboOpen) closeComboSegment(); // 끊겼다면 정산
        activeCombo = 1;
        comboOpen = true;
      }
      lastSuccessAt = now;
      if (activeCombo > maxCombo) maxCombo = activeCombo;
      startComboGauge();

      renderBoard();
      if (isCleared()) { finishGame("clear"); return; }
    }
    // reset selection
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

  // Timer
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
      // combo window timeout check (게이지 타이머에서 close 처리되지만 안전망)
      if (comboOpen && lastSuccessAt && (now - lastSuccessAt > COMBO_WINDOW_MS)){
        closeComboSegment();
      }
      updateHUD();
    }, 100);
  }

  function startGame(){
    UI.toPlay();
    AudioCtrl.play();
    running = true;
    initBoard();
    renderBoard();
    bindBoardInputs();
    resetScore();
    resizeBoardToFit();
    startTimer();
  }

  function finishGame(result){
    if (!running) return;
    running = false;
    if (tickId) { clearInterval(tickId); tickId = null; }
    // close ongoing combo
    if (comboOpen && activeCombo > 0) closeComboSegment();
    AudioCtrl.stop();

    const total = Math.floor(scoreBase + scoreBonus);
    const run = {
      ts: Date.now(),
      nickname: UI.getNickname(),           // 닉네임 저장
      total, base: scoreBase, bonus: scoreBonus,
      maxCombo,
      duration: LIMIT_SEC - Math.max(0, Math.ceil(remainSec)),
      result
    };
    UI.pushRecord(run);
    UI.renderRecords();

    // 결과 화면 반영 (원하면 활성화)
    $("r-total").textContent = total;
    $("r-base").textContent = scoreBase;
    $("r-bonus").textContent = scoreBonus;
    $("r-maxcombo").textContent = maxCombo;
    $("r-combo-log").innerHTML = comboSegments.length
      ? comboSegments.map(n => `<div>콤보 ${n} → +${Math.floor(0.5*n)}</div>`).join("")
      : "<div>기록 없음</div>";

    UI.toMain(); // 결과 화면을 쓰고 싶으면 UI.toResult()로 바꾸세요.
  }

  function exitToMain(){
    if (running) finishGame("exit");
    else { AudioCtrl.stop(); UI.toMain(); }
  }

  // bootstrap
  window.addEventListener("DOMContentLoaded", () => {
    btnStart.addEventListener("click", startGame);
    btnExit.addEventListener("click", exitToMain);
    btnRestart.addEventListener("click", startGame);
    btnResultRestart.addEventListener("click", startGame);
    btnResultMain.addEventListener("click", exitToMain);

    resizeBoardToFit();
  });
  window.addEventListener("resize", resizeBoardToFit);
})();