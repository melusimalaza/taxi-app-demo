// Cross-device "make sure they notice" helper: in-page toast (always works),
// OS push-style Notification (where supported/permitted), vibration on
// Android, and a short tone — because on a demo you can't rely on any one
// of these alone across different phones/browsers.

const Notify = (function () {
  function requestPermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Promise.resolve(Notification.permission);
    }
    return Notification.requestPermission();
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch {}
    }
  }

  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
      o.start();
      o.stop(audioCtx.currentTime + 0.4);
    } catch {}
  }

  function toast(title, body, kind) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    el.innerHTML = `<div class="toast-title">${title}</div>${body ? `<div class="toast-body">${body}</div>` : ''}`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 6000);
  }

  // Fires every channel it can: in-page toast, vibration, tone, and a real
  // OS notification if permission was granted.
  function fire(title, body, opts = {}) {
    toast(title, body, opts.kind);
    if (opts.vibrate !== false) vibrate(opts.vibrate || [250, 100, 250]);
    if (opts.sound !== false) beep();
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, tag: opts.tag });
      } catch {}
    }
  }

  return { requestPermission, fire, toast };
})();
