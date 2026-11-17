/* Black Coffee · 10718. A little time together, from 10 to Sumie. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  document.body.classList.toggle('standalone', !!standalone);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = { hour12: false, seconds: true, motion: !reduced.matches, night: false, awake: false, timezone: 'local', focus: false, flower: false };
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('10718-black-coffee') || '{}'); } catch (_) { /* Private browsing can disable storage. */ }
  const prefs = { ...defaults };
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(defaults)) if (typeof stored[key] === typeof defaults[key]) prefs[key] = stored[key];
  }
  if (!['local', 'Asia/Tokyo', 'UTC'].includes(prefs.timezone)) prefs.timezone = 'local';
  const persist = () => { try { localStorage.setItem('10718-black-coffee', JSON.stringify(prefs)); } catch (_) {} };
  let timeFormatter;
  function setFormatter() {
    timeFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      ...(prefs.timezone === 'local' ? {} : { timeZone: prefs.timezone })
    });
    $('zone-label').textContent = prefs.timezone === 'Asia/Tokyo' ? 'JAPAN · JST' : prefs.timezone === 'UTC' ? 'UTC' : 'LOCAL TIME';
  }
  let lastSecond = '', lastMinute = '', lastDay = '';
  let previousClockStamp = Date.now(), chimeReady = false;
  function updateClock() {
    const now = new Date();
    const stamp = now.getTime();
    const crossedMinute = Math.floor(stamp / 60000) > Math.floor(previousClockStamp / 60000)
      && stamp - previousClockStamp <= 2000 && stamp % 60000 < 1500;
    previousClockStamp = stamp;
    if (chimeReady && crossedMinute && !document.hidden) minuteChime();
    const p = Object.fromEntries(timeFormatter.formatToParts(now).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    const h = Number(p.hour) % 24;
    const minute = `${p.year}-${p.month}-${p.day}-${p.hour}:${p.minute}:${prefs.hour12}`;
    if (minute !== lastMinute) {
      $('hours').textContent = String(prefs.hour12 ? h % 12 || 12 : h).padStart(2, '0');
      $('minutes').textContent = p.minute;
      $('period').textContent = h < 12 ? 'AM' : 'PM';
      $('time').dateTime = now.toISOString();
      $('time').setAttribute('aria-label', `${h}時${Number(p.minute)}分`);
      lastMinute = minute;
    }
    if (p.second !== lastSecond) {
      $('seconds').textContent = p.second;
      $('second-orbit').style.setProperty('--second-angle', `${Number(p.second) * 6}deg`);
      const progress = ((h * 3600 + Number(p.minute) * 60 + Number(p.second)) / 86400 * 100);
      document.documentElement.style.setProperty('--day-progress', `${progress}%`);
      $('day-percent').textContent = `${String(Math.floor(progress)).padStart(2, '0')}%`;
      lastSecond = p.second;
    }
    const day = `${p.year}-${p.month}-${p.day}`;
    if (day !== lastDay) {
      $('date').replaceChildren(document.createTextNode(`${p.weekday.toUpperCase()}`), separator(), document.createTextNode(`${p.day} ${p.month.toUpperCase()}`), separator(), document.createTextNode(p.year));
      lastDay = day;
    }
  }
  function separator() { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '·'; return s; }
  setFormatter();
  updateClock();
  let clockTimer;
  function scheduleClock() {
    clearTimeout(clockTimer);
    updateClock();
    if (!document.hidden) clockTimer = setTimeout(scheduleClock, 1000 - Date.now() % 1000 + 8);
  }
  scheduleClock();

  // The marks belong to a real 60-second dial. The 10 mark quietly keeps its gold.
  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 60; i++) {
    const angle = i / 60 * Math.PI * 2 - Math.PI / 2;
    const line = document.createElementNS(ns, 'line');
    const major = i % 5 === 0;
    const r = major ? 237 : 242;
    Object.entries({ x1: 250 + Math.cos(angle) * r, y1: 250 + Math.sin(angle) * r, x2: 250 + Math.cos(angle) * 247, y2: 250 + Math.sin(angle) * 247, class: major ? 'tick-major' : 'tick-minor' }).forEach(([k, v]) => line.setAttribute(k, v));
    $('ticks').append(line);
    if (major) {
      const text = document.createElementNS(ns, 'text');
      Object.entries({ x: 250 + Math.cos(angle) * 269, y: 252.5 + Math.sin(angle) * 269, 'text-anchor': 'middle', class: i === 10 ? 'tick-label tick-ten' : 'tick-label' }).forEach(([k, v]) => text.setAttribute(k, v));
      text.textContent = String(i).padStart(2, '0');
      $('ticks').append(text);
    }
  }

  // Procedural ink and reflected light; no image downloads or GPU libraries.
  const canvas = $('liquid');
  let gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  let program, uniforms, raf = 0, lastFrame = 0, elapsed = 0, lost = false;
  let warmth = 0, brewAnimation = null, brewRaf = 0, brewLastDraw = 0;
  let touch = [-5, -5, -100];
  const vertex = 'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
  const fragment = `
    precision highp float;
    varying vec2 uv;
    uniform float time;
    uniform float warmth;
    uniform vec3 touch;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float n=0.,a=.5;mat2 m=mat2(.8,-.6,.6,.8);for(int i=0;i<4;i++){n+=a*noise(p);p=m*p*2.13+1.7;a*=.5;}return n;}
    void main(){
      vec2 p=uv*2.-1.;float r=length(p);
      // Transparent pixels outside the disc also protect against Safari's
      // composited-canvas overflow clipping failures.
      if(r>=1.){gl_FragColor=vec4(0.);return;}
      float theta=atan(p.y,p.x);
      float age=time-touch.z;
      float dist=distance(p,touch.xy);
      float wave=sin(dist*27.-age*6.)*exp(-dist*2.1)*exp(-max(0.,age)*.75)*step(0.,age);
      p+=normalize(p-touch.xy+.001)*wave*.055;
      float drift=time*.022;
      vec2 q=vec2(fbm(p*2.7+vec2(drift,0)),fbm(p*2.6+vec2(4.3,-drift)));
      float bend=theta+2.6*(1.-r)+q.x*2.2;
      vec2 v=vec2(cos(bend),sin(bend))*r;
      float n=fbm(v*3.6+q*2.8+vec2(drift,-drift*.4));
      float veins=pow(.5+.5*sin(n*31.+r*12.+q.y*3.),9.);
      float fine=pow(.5+.5*sin(n*80.+r*16.),16.);
      float sweep=smoothstep(-.7,.8,cos(theta-1.5)+n*.7);
      vec3 ink=mix(vec3(.027,.043,.049),vec3(.065,.104,.104),n);
      vec3 bronze=vec3(.59,.37,.18);
      vec3 sea=vec3(.23,.43,.40);
      vec3 light=mix(bronze,sea,sweep);
      light=mix(light,vec3(.95,.48,.12),warmth);
      ink=mix(ink,vec3(.065,.032,.012)+n*.018,warmth*.8);
      float clarity=smoothstep(.12,.92,r);
      vec3 color=ink+light*(veins*.34+fine*.14+n*.10)*clarity;
      color+=vec3(.65,.51,.28)*pow(max(0.,sin(theta+2.2)*.5+.5),8.)*pow(r,7.)*.4;
      color+=vec3(.20,.38,.35)*pow(max(0.,sin(theta-.8)*.5+.5),8.)*pow(r,5.)*.3;
      color+=vec3(.4,.38,.22)*wave*.18;
      color*=1.-smoothstep(.87,1.04,r)*.6;
      color+= (hash(uv*1500.)-.5)*.009;
      gl_FragColor=vec4(color,1.-smoothstep(.994,1.,r));
    }`;
  function shader(type, source) {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('Clock visual unavailable'); }
    return s;
  }
  function setupVisual() {
    if (!gl) return;
    try {
      const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
      program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Visual unavailable');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      uniforms = { time: gl.getUniformLocation(program, 'time'), touch: gl.getUniformLocation(program, 'touch'), warmth: gl.getUniformLocation(program, 'warmth') };
      gl.deleteShader(vs); gl.deleteShader(fs);
      resizeVisual();
    } catch (_) { gl = null; canvas.style.display = 'none'; }
  }
  function resizeVisual() {
    if (!gl || lost || !uniforms) return;
    const size = Math.min(1000, Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
    canvas.width = size; canvas.height = size;
    gl.viewport(0, 0, size, size); drawVisual();
  }
  function drawVisual() {
    if (!gl || lost || !uniforms) return;
    gl.uniform1f(uniforms.time, elapsed); gl.uniform1f(uniforms.warmth, warmth); gl.uniform3fv(uniforms.touch, touch); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function animate(timestamp) {
    if (!gl || lost || !prefs.motion || reduced.matches || document.hidden) { raf = 0; return; }
    if (timestamp - lastFrame >= 1000 / 24) {
      elapsed += Math.min((timestamp - (lastFrame || timestamp)) / 1000, .1);
      lastFrame = timestamp; drawVisual();
    }
    raf = requestAnimationFrame(animate);
  }
  function startVisual() { if (!raf && gl && !lost && prefs.motion && !reduced.matches && !document.hidden) { lastFrame = 0; raf = requestAnimationFrame(animate); } }
  function stopVisual() { cancelAnimationFrame(raf); raf = 0; }
  setupVisual();
  const observer = new ResizeObserver(resizeVisual); observer.observe(canvas);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; stopVisual(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; setupVisual(); startVisual(); });

  // Audio is created only from the sound button; quiet, generated locally, never autoplayed.
  let audio = null, soundEnabled = false, master = null, noiseSource = null, noiseGain = null;
  chimeReady = true;
  async function initAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!audio) {
      audio = new Audio(); master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination);
      const length = Math.ceil(audio.sampleRate * 3), buffer = audio.createBuffer(1, length, audio.sampleRate), data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) { const white = Math.random() * 2 - 1; last = (last + .02 * white) / 1.02; data[i] = last * 3; }
      noiseSource = audio.createBufferSource(); noiseSource.buffer = buffer; noiseSource.loop = true;
      const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 680;
      noiseGain = audio.createGain(); noiseGain.gain.value = .14;
      noiseSource.connect(filter); filter.connect(noiseGain); noiseGain.connect(master); noiseSource.start();
    }
    await audio.resume(); return audio.state === 'running';
  }
  function note(frequency, delay = 0, strength = .12) {
    if (!soundEnabled || !audio || audio.state !== 'running') return;
    const at = audio.currentTime + delay;
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(strength, at + .018); gain.gain.exponentialRampToValueAtTime(.0001, at + 2.5);
    osc.connect(gain); gain.connect(master); osc.start(at); osc.stop(at + 2.6);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  // A descending glass double note, separate from the cup's four-note phrase.
  function minuteChime() {
    if (!soundEnabled || !audio || audio.state !== 'running' || document.hidden) return;
    const at = audio.currentTime;
    for (const [frequency, delay] of [[783.99, 0], [587.33, .24]]) {
      for (const [ratio, level, tail] of [[1, .065, 2.8], [2.756, .012, 1.4], [4.13, .004, .8]]) {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'sine'; osc.frequency.value = frequency * ratio;
        const start = at + delay;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + .009);
        gain.gain.exponentialRampToValueAtTime(.0001, start + tail);
        osc.connect(gain); gain.connect(master); osc.start(start); osc.stop(start + tail + .05);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      }
    }
  }
  $('sound').addEventListener('click', async () => {
    try {
      if (!soundEnabled) { if (!await initAudio()) { announce('このブラウザでは音を再生できないみたい。時計はそのまま使えるよ。'); return; } soundEnabled = true; master.gain.setTargetAtTime(.38, audio.currentTime, .35); note(261.63); note(392, .25); }
      else { soundEnabled = false; master.gain.setTargetAtTime(0, audio.currentTime, .12); }
      $('sound').setAttribute('aria-pressed', String(soundEnabled)); $('sound').setAttribute('aria-label', soundEnabled ? '音を消す' : '静かな音をつける');
    } catch (_) { announce('音を始められなかった。もう一度、音のボタンに触れてね。'); }
  });

  let messageTimer, breakTimer, breakEndsAt = 0, coffeeBreak = false, breakCount = 0;
  const messages = [
    ['Sumie、少しだけコーヒーブレイク。', 'THE DARKER, THE SWEETER.'],
    ['濃くしたよ。甘さのほうを。', 'BLACK COFFEE, AS PROMISED.'],
    ['研究はいったん、ここまで。隣、空いてる。', 'A LITTLE CLOSER.'],
    ['花はつぶさないように。', 'SOME MOMENTS STAY.']
  ];
  function announce(text, subtitle = '', duration = 5200) {
    clearTimeout(messageTimer); $('letter').replaceChildren(document.createTextNode(text));
    if (subtitle) { const s = document.createElement('small'); s.textContent = subtitle; $('letter').append(s); }
    $('letter').classList.add('visible'); messageTimer = setTimeout(() => $('letter').classList.remove('visible'), duration);
  }
  function showTulip() {
    $('tulip').classList.add('visible'); $('flower').classList.add('visible'); $('flower').disabled = false;
    prefs.flower = true; persist();
  }
  let flowerTimer;
  $('flower').addEventListener('click', () => {
    clearTimeout(flowerTimer); $('flower').classList.remove('nod');
    void $('flower').offsetWidth;
    $('flower').classList.add('nod');
    flowerTimer = setTimeout(() => $('flower').classList.remove('nod'), 1500);
    announce('持ってるよ。今日も。', 'ONE LITTLE FLOWER, STILL HERE.');
    note(659.25, 0, .055); note(523.25, .22, .04);
  });
  // One wall-clock envelope drives both the light overlay and the shader.
  // Water can be still while the color softly leaves the cup.
  function updateBrewColor() {
    if (!brewAnimation) return;
    const progress = brewAnimation.duration ? Math.min(1, Math.max(0, (Date.now() - brewAnimation.at) / brewAnimation.duration)) : 1;
    const eased = progress * progress * (3 - 2 * progress);
    warmth = brewAnimation.from + (brewAnimation.to - brewAnimation.from) * eased;
    $('world').style.setProperty('--brew', warmth.toFixed(4));
    if ((!prefs.motion || reduced.matches || progress === 1) && (progress === 1 || performance.now() - brewLastDraw >= 1000 / 24)) {
      drawVisual(); brewLastDraw = performance.now();
    }
    if (progress === 1) {
      brewAnimation = null;
      if (warmth === 0) $('world').classList.remove('brewing');
    }
  }
  function animateBrew() {
    brewRaf = 0; updateBrewColor();
    if (brewAnimation && !document.hidden) brewRaf = requestAnimationFrame(animateBrew);
  }
  function setBrew(active, at = Date.now()) {
    cancelAnimationFrame(brewRaf); brewRaf = 0;
    updateBrewColor();
    if (active) $('world').classList.add('brewing');
    brewAnimation = { from: warmth, to: active ? 1 : 0, at, duration: reduced.matches ? 0 : active ? 1000 : 3200 };
    animateBrew();
  }
  function finishCoffee(at = Date.now()) {
    coffeeBreak = false; breakEndsAt = 0;
    clearTimeout(breakTimer); setBrew(false, at);
    $('coffee').setAttribute('aria-pressed', 'false');
    $('caption').textContent = 'a little closer, a little sweeter.';
  }
  function resumeCoffee() {
    updateBrewColor();
    if (coffeeBreak && Date.now() >= breakEndsAt) finishCoffee(breakEndsAt);
    else if (brewAnimation && !brewRaf) animateBrew();
  }
  $('coffee').addEventListener('click', () => {
    coffeeBreak = !coffeeBreak; $('coffee').setAttribute('aria-pressed', String(coffeeBreak));
    setBrew(coffeeBreak);
    clearTimeout(breakTimer);
    if (coffeeBreak) {
      const message = messages[breakCount++ % messages.length]; announce(...message, 6500);
      if ((breakCount - 1) % messages.length === 3) showTulip();
      $('caption').textContent = 'the darker, the sweeter.';
      note(261.63); note(329.63, .25); note(392, .6); note(523.25, 1.15, .075);
      breakEndsAt = Date.now() + 30000;
      breakTimer = setTimeout(() => finishCoffee(breakEndsAt), 30000);
    } else { breakEndsAt = 0; $('letter').classList.remove('visible'); $('caption').textContent = 'a little closer, a little sweeter.'; }
  });
  let taps = 0;
  function rippleAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(), shell = $('instrument').getBoundingClientRect();
    touch = [(clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2, elapsed];
    const ring = document.createElement('span'); ring.className = 'ripple'; ring.style.setProperty('--x', `${clientX - shell.left}px`); ring.style.setProperty('--y', `${clientY - shell.top}px`); $('instrument').append(ring);
    setTimeout(() => ring.remove(), 2100);
    const tones = [261.63, 293.66, 329.63, 392, 440]; note(tones[taps % tones.length], 0, .07);
    taps++;
    if (taps === 10) { showTulip(); announce('今日の一輪。ちゃんと守ってる。', '10718 · FOR SUMIE'); }
    drawVisual();
  }
  $('instrument').addEventListener('pointerdown', event => { if (event.button !== 0) return; rippleAt(event.clientX, event.clientY); });
  $('instrument').addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); const r = canvas.getBoundingClientRect(); rippleAt(r.left + r.width * .67, r.top + r.height * .7); } });

  // A wake lock is opt-in and its actual state is shown if Safari refuses it.
  let wakeLock = null, wakeRequest = null;
  async function requestWake() {
    if (wakeRequest || wakeLock || !prefs.awake || document.hidden) return;
    if (!('wakeLock' in navigator)) { $('awake-status').textContent = 'このブラウザでは画面の自動ロックを止められないため、端末の設定が使われる。'; return; }
    wakeRequest = navigator.wakeLock.request('screen');
    try {
      const lock = await wakeRequest;
      if (!prefs.awake || document.hidden) { await lock.release(); return; }
      wakeLock = lock; $('awake-status').textContent = 'この時計を開いている間、画面をつけたままにする。';
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; if (prefs.awake) $('awake-status').textContent = '画面保持が解除された。時計へ戻ると、もう一度試す。'; });
    } catch (_) { $('awake-status').textContent = '画面保持を開始できなかった。省電力設定やブラウザの状態を確認してね。'; }
    finally { wakeRequest = null; }
  }
  function syncSettings() {
    $('hour12').checked = prefs.hour12; $('show-seconds').checked = prefs.seconds; $('motion').checked = prefs.motion;
    $('night').checked = prefs.night; $('stay-awake').checked = prefs.awake; $('timezone').value = prefs.timezone;
    document.body.classList.toggle('twelve-hour', prefs.hour12); document.body.classList.toggle('dim', prefs.night); document.body.classList.toggle('focus', prefs.focus);
    document.body.classList.toggle('still', !prefs.motion || reduced.matches);
    $('seconds').hidden = !prefs.seconds; $('second-orbit').hidden = !prefs.seconds;
    $('focus').setAttribute('aria-pressed', String(prefs.focus)); $('focus').setAttribute('aria-label', prefs.focus ? '全体のデザインに戻す' : '時刻を大きく眺める');
    if (prefs.motion && !reduced.matches) startVisual(); else { stopVisual(); drawVisual(); }
    if (!prefs.awake && wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    if (!prefs.awake) $('awake-status').textContent = '';
    requestWake();
    lastMinute = ''; lastSecond = ''; lastDay = ''; setFormatter(); updateClock();
    persist();
  }
  const bindings = { hour12: 'hour12', 'show-seconds': 'seconds', motion: 'motion', night: 'night', 'stay-awake': 'awake' };
  for (const [id, key] of Object.entries(bindings)) $(id).addEventListener('change', event => { prefs[key] = event.target.checked; syncSettings(); });
  $('timezone').addEventListener('change', event => { prefs.timezone = event.target.value; syncSettings(); });
  $('focus').addEventListener('click', () => { prefs.focus = !prefs.focus; syncSettings(); });
  $('settings').addEventListener('click', () => $('sheet').showModal());
  $('close-sheet').addEventListener('click', () => $('sheet').close());
  $('sheet').addEventListener('click', event => { if (event.target !== $('sheet')) return; const r = $('sheet').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('sheet').close(); });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('sheet').open && prefs.focus) { prefs.focus = false; syncSettings(); } });
  if (reduced.addEventListener) reduced.addEventListener('change', syncSettings);
  document.addEventListener('visibilitychange', () => {
    previousClockStamp = Date.now();
    scheduleClock();
    if (document.hidden) { stopVisual(); cancelAnimationFrame(brewRaf); brewRaf = 0; if (audio) audio.suspend().catch(() => {}); }
    else { resumeCoffee(); startVisual(); requestWake(); if (audio && soundEnabled) audio.resume().catch(() => {}); }
  });
  window.addEventListener('pageshow', () => { previousClockStamp = Date.now(); scheduleClock(); resumeCoffee(); requestWake(); });
  if (standalone) $('install-help').hidden = true;
  if (prefs.flower) showTulip();
  syncSettings();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* The clock also works without offline caching. */ });
  }
})();
