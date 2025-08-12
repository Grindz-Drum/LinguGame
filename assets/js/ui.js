// 화면 전환 + 닉네임/기록 로컬 저장/복원 + 메인/플레이 볼륨 연동
const $ = (id) => document.getElementById(id);

const UI = (() => {
  const KEY_NICK = "lingu_nickname";
  const KEY_REC  = "lingu_records"; // 최근 5게임

  const main = $("screen-main");
  const play = $("screen-play");
  const result = $("screen-result");

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
      // 즉시 입력값 정리
      $("nickname").value = getNickname();
    });
  }

  // 최근 기록
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

  // 메인/플레이 볼륨 슬라이더 동기화
  function bindVolumeControls(){
    const mainVol = $("vol-main");
    const mainMute = $("btn-mute-main");
    const playVol = $("vol");
    const playMute = $("btn-mute");

    const syncInputsFromAudio = () => {
      const v = Math.round(AudioCtrl.getVolume() * 100);
      mainVol.value = v;
      playVol.value = v;
      mainMute.textContent = (v === 0 ? "음소거 해제" : "음소거");
      playMute.textContent = (v === 0 ? "음소거 해제" : "음소거");
    };

    // 초기값 반영
    syncInputsFromAudio();

    const onSlide = (e) => {
      const v = parseInt(e.target.value, 10) / 100;
      AudioCtrl.setVolume(v);
      syncInputsFromAudio();
    };
    const onMute = () => {
      AudioCtrl.toggleMute();
      syncInputsFromAudio();
    };

    mainVol.addEventListener("input", onSlide);
    playVol.addEventListener("input", onSlide);
    mainMute.addEventListener("click", onMute);
    playMute.addEventListener("click", onMute);
  }

  function init(){
    bindNickname();
    renderRecords();
    bindVolumeControls();
  }

  return { toMain, toPlay, toResult, init, getNickname, pushRecord, renderRecords };
})();

// 초기화
window.addEventListener("DOMContentLoaded", () => {
  AudioCtrl.init();  // 먼저 로드해서 볼륨을 UI에 반영 가능
  UI.init();
});
