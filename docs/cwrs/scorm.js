// SCORM 1.2 runtime wrapper. Inside an LMS it talks to window.API; opened as a
// plain web page it falls back to localStorage so the same build works on both.
(function () {
  function findApi(win) {
    for (let depth = 0; win && depth < 10; depth++) {
      try { if (win.API) return win.API; } catch (e) { /* cross-origin frame */ }
      if (win.parent === win) break;
      win = win.parent;
    }
    return null;
  }

  const api = findApi(window) || (window.opener && findApi(window.opener));
  const storeKey = 'cwrs:' + location.pathname + location.search;
  let local = {};
  let finished = false;

  function readLocal() {
    try { local = JSON.parse(localStorage.getItem(storeKey)) || {}; } catch (e) { local = {}; }
  }
  function writeLocal() {
    try { localStorage.setItem(storeKey, JSON.stringify(local)); } catch (e) { /* private mode */ }
  }

  window.Scorm = {
    connected: false,
    init() {
      if (api) {
        this.connected = String(api.LMSInitialize('')) === 'true';
        if (this.connected && this.get('cmi.core.lesson_status') === 'not attempted') {
          this.set('cmi.core.lesson_status', 'incomplete');
        }
      } else readLocal();
      return this.connected;
    },
    get(key) {
      return this.connected ? String(api.LMSGetValue(key)) : (local[key] ?? '');
    },
    set(key, value) {
      if (this.connected) api.LMSSetValue(key, String(value));
      else { local[key] = String(value); writeLocal(); }
    },
    commit() {
      if (this.connected) api.LMSCommit('');
    },
    finish() {
      if (!this.connected || finished) return;
      finished = true;
      // 'suspend' tells Moodle to resume where the learner left off.
      if (this.get('cmi.core.lesson_status') !== 'passed') this.set('cmi.core.exit', 'suspend');
      api.LMSCommit('');
      api.LMSFinish('');
    },
  };
})();
