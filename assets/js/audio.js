// BGM: 플레이 화면에서만 루프, 볼륨 저장/복원
const AudioCtrl = (() => {
  let audio;
  let vol = 0.7;     // 0..1
  let prevVol = 0.7;
  const KEY_VOL = "lingu_vol";

  function loadVol(){
    const v = parseFloat(localStorage.getItem(KEY_VOL));
    if (!isNaN(v) && v >= 0 && v <= 1) vol = v;
  }
  function saveVol(){ localStorage.setItem(KEY_VOL, String(vol)); }
  function applyVol(){ if (audio) audio.volume = vol; }

  function init(){
    loadVol();
    audio = new Audio("assets/audio/bgm_play.mp3");
    audio.loop = true;
    applyVol();
  }
  function play(){ audio && audio.play().catch(()=>{}); }
  function pause(){ if(audio) audio.pause(); }
  function stop(){ if(!audio) return; audio.pause(); audio.currentTime = 0; }

  function setVolume(v){ vol = Math.max(0, Math.min(1, v)); applyVol(); saveVol(); }
  function getVolume(){ return vol; }
  function toggleMute(){
    if (vol > 0){ prevVol = vol; setVolume(0); }
    else { setVolume(prevVol > 0 ? prevVol : 0.7); }
  }

  return { init, play, pause, stop, setVolume, getVolume, toggleMute };
})();
