(() => {
  'use strict';
  for (const select of document.querySelectorAll('[data-language]')) {
    select.addEventListener('change', () => location.assign(select.value + location.hash));
  }
  const area = document.querySelector('.reading');
  if (!area) return;

  const iosLink = document.querySelector('[data-platform="ios"]');
  const macLink = document.querySelector('[data-platform="mac"]');
  const appleTouchDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (appleTouchDevice && iosLink && macLink) {
    macLink.before(iosLink);
    iosLink.classList.replace('secondary', 'primary');
    macLink.classList.replace('primary', 'secondary');
    const requirements = document.querySelector('[data-ios-requirements]');
    requirements.textContent = requirements.dataset.iosRequirements;
  }

  const messages = JSON.parse(document.querySelector('#translations').textContent);
  const t = (key, value) => messages[key].replace('{0}', value);
  const start = document.querySelector('#start');
  const stop = document.querySelector('#stop');
  const status = document.querySelector('.demo-status');
  const speed = document.querySelector('#speed');
  const interval = document.querySelector('#interval');
  const directions = document.querySelectorAll('[data-direction]');
  const modes = document.querySelectorAll('[data-mode]');
  const labels = { ready:'Ready', running:'Running', countdown:'Countdown', paused:'Paused', stopped:'Stopped', completed:'Completed', error:'Needs attention' };
  const engine = new ScrollCadenceCore.Engine({
    now: () => performance.now(), frame: callback => requestAnimationFrame(callback),
    cancelFrame: id => cancelAnimationFrame(id), setTimer: (callback, ms) => setTimeout(callback, ms),
    clearTimer: id => clearTimeout(id)
  }, ({state}) => {
    status.dataset.state = state;
    status.textContent = t(labels[state]);
    const playing = state === 'running' || state === 'countdown';
    start.dataset.playing = String(playing);
    start.textContent = t(playing ? 'Pause' : state === 'paused' ? 'Resume' : 'Start');
    stop.disabled = !playing && state !== 'paused';
  });
  engine.setTarget({
    connected: () => area.isConnected,
    canScroll: direction => ['left','right'].includes(direction) ? area.scrollWidth > area.clientWidth : area.scrollHeight > area.clientHeight,
    viewport: horizontal => horizontal ? area.clientWidth : area.clientHeight,
    position: horizontal => horizontal ? area.scrollLeft : area.scrollTop,
    move: (horizontal, delta) => area.scrollBy({ left: horizontal ? delta : 0, top: horizontal ? 0 : delta, behavior:'instant' })
  });
  let settings = { direction:'down', mode:'continuous', speed:40, interval:3, countdown:0, pageFraction:.9 };
  const meter = document.querySelector('.meter');
  function updateProgress() {
    const horizontal = ['left','right'].includes(settings.direction);
    const range = horizontal ? area.scrollWidth - area.clientWidth : area.scrollHeight - area.clientHeight;
    const position = horizontal ? area.scrollLeft : area.scrollTop;
    meter.style.setProperty('--progress', range > 0 ? Math.max(0, Math.min(1, position / range)) : 0);
  }
  area.addEventListener('scroll', updateProgress, {passive:true});
  new ResizeObserver(updateProgress).observe(area);
  function configure(patch) {
    settings = { ...settings, ...patch };
    engine.configure(settings);
    for (const b of directions) b.setAttribute('aria-pressed', String(b.dataset.direction === settings.direction));
    for (const b of modes) b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
    const paged = settings.mode === 'paged';
    interval.closest('label').hidden = !paged;
    speed.closest('label').hidden = paged;
    document.querySelector('#speed-output').textContent = t('{0} CSS px / second', settings.speed);
    updateProgress();
  }
  // Starting at an edge should allow a full pass in the selected direction.
  function rewindAtEdge() {
    const horizontal = ['left','right'].includes(settings.direction);
    const backwards = ['left','up'].includes(settings.direction);
    const max = horizontal ? area.scrollWidth - area.clientWidth : area.scrollHeight - area.clientHeight;
    const offset = horizontal ? area.scrollLeft : area.scrollTop;
    if (backwards ? offset <= 1 : offset >= max - 1) {
      area.scrollTo({ [horizontal ? 'left' : 'top']: backwards ? max : 0, behavior:'instant' });
    }
  }
  configure({});
  for (const b of directions) b.addEventListener('click', () => {
    configure({direction:b.dataset.direction});
    rewindAtEdge();
  });
  for (const b of modes) b.addEventListener('click', () => configure({mode:b.dataset.mode}));
  speed.addEventListener('input', () => configure({speed:speed.valueAsNumber}));
  interval.addEventListener('change', () => {
    if (interval.validity.valid && Number.isFinite(interval.valueAsNumber)) configure({interval:interval.valueAsNumber});
    else interval.value = String(settings.interval);
  });
  start.addEventListener('click', () => {
    if (engine.state === 'running' || engine.state === 'countdown') return engine.pause();
    rewindAtEdge();
    if (engine.state === 'paused') engine.resume();
    else engine.start();
  });
  stop.addEventListener('click', () => engine.stop());
  for (const name of ['wheel','touchmove','keydown']) area.addEventListener(name, () => {
    if (engine.state === 'running') engine.pause();
  }, {passive:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.state === 'running') engine.pause();
  });
  window.addEventListener('pagehide', () => engine.stop());
})();
