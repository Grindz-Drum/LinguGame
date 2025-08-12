// 화면 전환 + 로컬 저장 + 볼륨 동기화 + 장치 스케일/회전 피팅(전체 UI를 비율 유지로)
const $ = (id) => document.getElementById(id);

const UI = (() => {
  const KEY_NICK = "lingu_nickname";
  const KEY_REC  = "lingu_records";

  const screenMain = $("screen-main");
  const screenPlay = $("screen-play");
  const screenResult = $("screen-result");

  const fit = $("fit");
  const scene = $("scene");

  function toMain(){ screenMain.classList.remove("hidden"); screenPlay.classList.add("hidden"); screenResult.classList.add("hidden"); }
  function toPlay(){ screenPlay.classList.remove("hidden"); screenMain.classList.add("hidden"); screenResult.classList.add("hidden"); }
  function toResult(){ screenResult.classList.remove("hidden"); screenMain.classList.add("hidden"); screenPlay.classList.add("hidden"); }

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
    try { return JSON.parse(localStorage.getItem(KEY_REC) || "[]"); } catch { return []; }
  }
  function pushRecord(run){
    const arr = getRecords(); arr.unshift(run); while (arr.length > 5) arr.pop();
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

  // 볼륨
  function bindVolume(){
    const mainVol = $("vol-main"), mainMute = $("btn-mute-main");
    const playVol = $("vol"),      playMute = $("btn-mute");

    const sync = () => {
      const v = Math.round(AudioCtrl.getVolume()*100);
      if (mainVol) mainVol.value = v;
      if (playVol) playVol.value = v;
      const lbl = (v === 0 ? "음소거 해제" : "음소거");
      if (mainMute) mainMute.textContent = lbl;
      if (playMute) playMute.textContent = lbl;
    };
    const onSlide = e => { AudioCtrl.setVolume(parseInt(e.target.value,10)/100); sync(); };
    const onMute  = () => { AudioCtrl.toggleMute(); sync(); };

    mainVol?.addEventListener("input", onSlide);
    playVol?.addEventListener("input", onSlide);
    mainMute?.addEventListener("click", onMute);
    playMute?.addEventListener("click", onMute);

    sync();
  }

  // === 전체 UI 비율 유지 스케일 + 세로 모바일 회전 ===
  function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function isPortrait(){ return window.matchMedia?.("(orientation: portrait)").matches; }

  function fitSceneToDisplay(){
    // 기준 사이즈
    const baseW = 1280, baseH = 720;
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;

    // 세로 모바일이면 콘텐츠만 회전
    const portrait = isMobile() && isPortrait();
    const availW = portrait ? vh : vw;
    const availH = portrait ? vw : vh;

    // uniform scale (contain)
    const pad = 8; // 가장자리 여유
    const scale = Math.max(0.4, Math.min((availW - pad)/baseW, (availH - pad)/baseH));

    fit.style.position = "absolute";
    fit.style.left = "50%";
    fit.style.top = "50%";
    fit.style.transformOrigin = "center center";

    const rotate = portrait ? "rotate(90deg)" : "none";
    fit.style.transform = `translate(-50%,-50%) ${rotate} scale(${scale})`;
  }

  function init(){
    bindNickname();
    renderRecords();
    bindVolume();
    fitSceneToDisplay();
  }

  return { toMain, toPlay, toResult, init, getNickname, pushRecord, renderRecords, fitSceneToDisplay };
})();

// 부팅
window.addEventListener("DOMContentLoaded", () => {
  AudioCtrl.init();
  UI.init();
});
