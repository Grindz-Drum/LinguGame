// 화면 전환 + 로컬 저장 + 볼륨 동기화 + 세로 모바일에서 회전/스케일 피팅
const $ = (id) => document.getElementById(id);

const UI = (() => {
  const KEY_NICK = "lingu_nickname";
  const KEY_REC  = "lingu_records";

  const main = $("screen-main");
  const play = $("screen-play");
  const result = $("screen-result");
  const fitBox = $("fit");
  const appBox = $("app");

  function toMain(){ main.classList.remove("hidden"); play.classList.add("hidden"); result.classList.add("hidden"); }
  function toPlay(){ play.classList.remove("hidden"); main.classList.add("hidden"); result.classList.add("hidden"); }
  function toResult(){ result.classList.remove("hidden"); main.classList.add("hidden"); play.classList.add("hidden"); }

  // 닉네임
  function getNickname(){ return localStorage.getItem(KEY_NICK) || "Player"; }
  function setNickname(v){ localStorage.setItem(KEY_NICK, (v || "Player")); }
  function bindNickname(){
    $("nickname").value = getNickname();
    $("btn-save-nick").addEventListener("click", () => {
      setNickname($("nickname").value.trim());
      $("nickname").value = getNickname();
      renderRecords();
    });
  }

  // 기록
  function getRecords(){
    try { return JSON.parse(localStorage.getItem(KEY_REC) || "[]"); }
    catch { return []; }
  }
  function pushRecord(run){
    const arr = getRecords();
    arr.unshift(run);
    while (arr.length > 5) arr.pop();
    localStorage.setItem(KEY_REC, JSON.stringify(arr));
  }
  function renderRecords(){
    const list = getRecords();
    $("records").innerHTML = list.length
      ? list.map(r => {
          const when = new Date(r.ts).toLocaleString();
          return `<div class="rec">${when} — <b>${r.nickname}</b> : 점수 <b>${r.total}</b> (B ${r.base} / C ${r.bonus}), 최대콤보 ${r.maxCombo}, 시간 ${r.duration}s</div>`;
        }).join("")
      : `<div class="rec">아직 기록이 없습니다.</div>`;
  }

  // 볼륨 슬라이더 동기화
  function bindVolumeControls(){
    const mainVol = $("vol-main"); const mainMute = $("btn-mute-main");
    const playVol = $("vol");      const playMute = $("btn-mute");

    const syncInputsFromAudio = () => {
      const v = Math.round(AudioCtrl.getVolume() * 100);
      mainVol.value = v; playVol.value = v;
      const lbl = (v === 0 ? "음소거 해제" : "음소거");
      mainMute.textContent = lbl; playMute.textContent = lbl;
    };

    syncInputsFromAudio();
    const onSlide = e => { AudioCtrl.setVolume(parseInt(e.target.value,10)/100); syncInputsFromAudio(); };
    const onMute  = () => { AudioCtrl.toggleMute(); syncInputsFromAudio(); };

    mainVol.addEventListener("input", onSlide);
    playVol.addEventListener("input", onSlide);
    mainMute.addEventListener("click", onMute);
    playMute.addEventListener("click", onMute);
  }

  // === 세로 모바일에서 회전 + 스케일 피팅 ===
  function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function isPortrait(){
    return window.matchMedia && window.matchMedia("(orientation: portrait)").matches;
  }

  function applyFitTransform(){
    // 기본: 변환 없음
    fitBox.style.transform = "";
    fitBox.style.left = "";
    fitBox.style.top = "";
    fitBox.style.position = "";

    if (!(isMobile() && isPortrait())) return; // 세로 모바일이 아니면 원래대로

    // 세로 모바일: 화면만 가로처럼 보이도록 90deg 회전 + 스케일
    // 측정 위해 transform 잠시 제거
    const prev = fitBox.style.transform;
    fitBox.style.transform = "none";

    const vw = (window.visualViewport ? visualViewport.width : window.innerWidth);
    const vh = (window.visualViewport ? visualViewport.height : window.innerHeight);
    const appW = appBox.offsetWidth;
    const appH = appBox.offsetHeight;

    // 회전 후: 가로폭 ← appH, 세로높이 ← appW
    const pad = 12; // 가장자리 여유
    const scaleX = (vw - pad) / appH;
    const scaleY = (vh - pad) / appW;
    const s = Math.max(0.5, Math.min(scaleX, scaleY)); // 너무 작아지지 않게 하한선

    fitBox.style.position = "absolute";
    fitBox.style.left = "50%";
    fitBox.style.top = "50%";
    fitBox.style.transformOrigin = "center center";
    fitBox.style.transform = `translate(-50%,-50%) rotate(90deg) scale(${s})`;

    // 복구용 저장 없음(그대로 유지)
    void(prev);
  }

  function init(){
    bindNickname();
    renderRecords();
    bindVolumeControls();
    applyFitTransform();
  }

  return { toMain, toPlay, toResult, init, getNickname, pushRecord, renderRecords, applyFitTransform };
})();

// 초기화
window.addEventListener("DOMContentLoaded", () => {
  AudioCtrl.init();
  UI.init();
});
