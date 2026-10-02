/* Uncipher - Otomatik Kırma arka plan iş parçacığı */
importScripts('crypto.js', 'breaker.js');

const scorers = {};

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'wordlist') {
    scorers[m.lang] = new UBreaker.Scorer(m.words, m.lang);
    self.postMessage({ type: 'wordlist-ok', lang: m.lang, count: scorers[m.lang].set.size });
  } else if (m.type === 'break') {
    const scorer = scorers[m.lang];
    if (!scorer) { self.postMessage({ type: 'error', id: m.id, message: 'Kelime listesi henüz yüklenmedi.' }); return; }
    try {
      const res = UBreaker.breakCipher(m.text, m.lang, scorer, m.opts, m.keyWords,
        (pct) => self.postMessage({ type: 'progress', id: m.id, pct }));
      self.postMessage({ type: 'result', id: m.id, results: res });
    } catch (err) {
      self.postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) });
    }
  }
};
