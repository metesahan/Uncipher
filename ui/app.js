/* Uncipher - arayüz mantığı */
(function () {
  'use strict';
  const C = window.UCrypto, B = window.UBreaker, A = window.UAudio;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    lang: 'tr',
    chain: [
      { method: 'caesar', params: { shift: 3 } },
      { method: 'atbash', params: {} },
      { method: 'route', params: { cols: 4 } },
    ],
    words: { tr: null, en: null },      // Set
    keyWords: { tr: [], en: [] },       // Vigenère anahtar adayları
    wlInfo: { tr: null, en: null },
  };

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function copy(text) {
    const done = () => toast('Panoya kopyalandı');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Kopyalanamadı'); }
      ta.remove();
    }
  }

  const hasApi = () => !!(window.pywebview && window.pywebview.api);

  /* ---------------- Gezinme ---------------- */

  document.querySelectorAll('.nav-item').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + b.dataset.view));
  }));

  /* ---------------- Dil ---------------- */

  function setLang(lang) {
    state.lang = lang;
    document.querySelectorAll('#langSeg button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
    $('alphaPreview').textContent = C.ALPHABETS[lang].split('').join(' ');
    renderChain();
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  document.querySelectorAll('#langSeg button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ================= MODÜL 1: Şifrele & Çöz ================= */

  const sel = $('methodSelect');
  Object.keys(C.METHODS).forEach((id) => {
    const o = document.createElement('option');
    o.value = id; o.textContent = C.METHODS[id].name; sel.appendChild(o);
  });

  function renderChain() {
    const list = $('chainList');
    list.innerHTML = '';
    if (!state.chain.length) {
      list.innerHTML = '<li class="empty">Zincir boş. Yukarıdan metod ekleyin.</li>';
    }
    state.chain.forEach((step, i) => {
      const m = C.METHODS[step.method];
      const li = document.createElement('li');
      let params = '';
      m.params.forEach((p) => {
        let hint = '';
        if (step.method === 'affine' && p.key === 'a') hint = ` title="N=${C.ALPHABETS[state.lang].length} ile aralarında asal olmalı"`;
        params += `<label${hint}>${esc(p.label)} <input type="${p.type}" data-i="${i}" data-k="${p.key}" value="${esc(step.params[p.key] ?? p.default)}"></label>`;
      });
      if (!m.params.length) params = '<span class="muted small">parametre yok</span>';
      li.innerHTML = `<span class="idx">${i + 1}</span><span class="mname">${esc(m.name)}</span>
        <span class="params">${params}</span>
        <span class="ctrl">
          <button class="btn icon ghost" data-act="up" data-i="${i}" title="Yukarı" aria-label="Yukarı"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
          <button class="btn icon ghost" data-act="down" data-i="${i}" title="Aşağı" aria-label="Aşağı"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
          <button class="btn icon ghost" data-act="del" data-i="${i}" title="Kaldır" aria-label="Kaldır"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </span>`;
      list.appendChild(li);
    });
    $('chainFlow').textContent = state.chain.length
      ? state.chain.map((s, i) => `${i + 1}. ${C.describeStep(s)}`).join('  →  ')
      : '';
  }

  $('chainList').addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k === undefined) return;
    const step = state.chain[+t.dataset.i];
    const def = C.METHODS[step.method].params.find((p) => p.key === t.dataset.k);
    step.params[t.dataset.k] = def.type === 'number' ? Number(t.value) : t.value;
    $('chainFlow').textContent = state.chain.map((s, i) => `${i + 1}. ${C.describeStep(s)}`).join('  →  ');
  });

  $('chainList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const i = +b.dataset.i, ch = state.chain;
    if (b.dataset.act === 'del') ch.splice(i, 1);
    if (b.dataset.act === 'up' && i > 0) [ch[i - 1], ch[i]] = [ch[i], ch[i - 1]];
    if (b.dataset.act === 'down' && i < ch.length - 1) [ch[i + 1], ch[i]] = [ch[i], ch[i + 1]];
    renderChain();
  });

  $('btnAddStep').addEventListener('click', () => {
    state.chain.push({ method: sel.value, params: C.defaultParams(sel.value) });
    renderChain();
  });

  function runChain(dir) {
    $('cError').textContent = '';
    const text = $('cInput').value;
    if (!state.chain.length) { $('cError').textContent = 'Önce zincire en az bir metod ekleyin.'; return; }
    try {
      const r = dir === 'enc' ? C.encryptChain(text, state.chain, state.lang) : C.decryptChain(text, state.chain, state.lang);
      $('cOutput').value = r.output;
      $('cOutMeta').textContent = (dir === 'enc' ? 'şifrelendi' : 'çözüldü') + ' · ' + Array.from(r.output).length + ' karakter · ' + (state.lang === 'tr' ? 'Türkçe' : 'İngilizce') + ' alfabe';
      const tl = $('traceList');
      tl.innerHTML = r.trace.map((t) => `<li><b>${esc(C.describeStep(state.chain[t.step - 1]))}${dir === 'enc' ? '' : ' (çöz)'}</b><br>${esc(t.output)}</li>`).join('');
      $('traceBox').hidden = r.trace.length < 2;
      renderPigpen(r.output);
    } catch (e) {
      $('cError').textContent = e.message;
    }
  }
  $('btnEncrypt').addEventListener('click', () => runChain('enc'));
  $('btnDecrypt').addEventListener('click', () => runChain('dec'));
  $('btnSwap').addEventListener('click', () => { $('cInput').value = $('cOutput').value; $('cOutput').value = ''; $('pigpenView').hidden = true; });
  $('btnCopy').addEventListener('click', () => copy($('cOutput').value));
  $('btnClearIn').addEventListener('click', () => { $('cInput').value = ''; });

  /* Pigpen sembollerinin çizimi */
  const PIG_EDGES = { '⌟': 'rb', '⊔': 'lrb', '⌞': 'lb', '⊐': 'trb', '□': 'tlrb', '⊏': 'tlb', '⌝': 'tr', '⊓': 'ltr', '⌜': 'tl' };
  const PIG_X = { '∨': 'M4 4 L13 22 L22 4', '>': 'M4 4 L22 13 L4 22', '<': 'M22 4 L4 13 L22 22', '∧': 'M4 22 L13 4 L22 22' };
  const PIG_XDOT = { '∨': [13, 10], '>': [10, 13], '<': [16, 13], '∧': [13, 16] };

  function pigSvg(token) {
    const base = token[0], dots = token.length - 1;
    let path = '', dc = [13, 13];
    if (PIG_EDGES[base]) {
      const e = PIG_EDGES[base];
      if (e.includes('t')) path += 'M4 4 L22 4 ';
      if (e.includes('b')) path += 'M4 22 L22 22 ';
      if (e.includes('l')) path += 'M4 4 L4 22 ';
      if (e.includes('r')) path += 'M22 4 L22 22 ';
    } else { path = PIG_X[base]; dc = PIG_XDOT[base]; }
    let circles = '';
    if (dots === 1) circles = `<circle cx="${dc[0]}" cy="${dc[1]}" r="2.2"/>`;
    if (dots >= 2) circles = `<circle cx="${dc[0] - 3.5}" cy="${dc[1]}" r="2"/><circle cx="${dc[0] + 3.5}" cy="${dc[1]}" r="2"/>`;
    return `<svg viewBox="0 0 26 26"><path d="${path}" fill="none" stroke="#f2f2f2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><g fill="#f2f2f2">${circles}</g></svg>`;
  }

  function renderPigpen(text) {
    const box = $('pigpenView');
    const parts = C.parsePigpen(text);
    if (!parts.some((p) => p.token)) { box.hidden = true; return; }
    box.innerHTML = parts.slice(0, 1500).map((p) => p.token ? pigSvg(p.token) : (/\s/.test(p.char) ? '<span class="sp"></span>' : `<span class="ch">${esc(p.char)}</span>`)).join('');
    box.hidden = false;
  }

  /* ================= Kelime listeleri ================= */

  function setWl(lang, cls, info) {
    const el = $('wl-' + lang);
    el.classList.remove('ready', 'error');
    if (cls) el.classList.add(cls);
    el.querySelector('.wl-info').textContent = info;
  }

  const SOURCE_TXT = { remote: 'uzak', cache: 'önbellek', bundled: 'yerel yedek' };

  function parseWords(raw, lang) {
    const out = [];
    for (const tok of raw.split(/[\s,;/]+/)) {
      if (!tok) continue;
      const w = C.toLower(tok, lang);
      let ok = true;
      for (const ch of w) if (!C.LOWER[lang].includes(ch)) { ok = false; break; }
      if (ok) out.push(w);
    }
    return out;
  }

  let worker = null;
  try {
    worker = new Worker('worker.js');
    worker.onerror = (e) => { console.warn('Worker kullanılamıyor, ana iş parçacığına geçiliyor', e); worker = null; };
  } catch (e) { worker = null; }

  function wordsReady(lang, words, source) {
    state.words[lang] = new Set(words);
    if (worker) worker.postMessage({ type: 'wordlist', lang, words });
    setWl(lang, 'ready', words.length.toLocaleString('tr-TR') + ' kelime · ' + (SOURCE_TXT[source] || source));
  }

  async function loadKeyWords() {
    for (const lang of ['tr', 'en']) {
      try {
        const raw = await (await fetch('data/fallback_' + lang + '.txt')).text();
        state.keyWords[lang] = parseWords(raw, lang).filter((w) => w.length >= 3 && w.length <= 10);
      } catch (e) { /* isteğe bağlı */ }
    }
  }

  async function loadFromApi() {
    const api = window.pywebview.api;
    const pending = new Set(['tr', 'en']);
    while (pending.size) {
      const st = await api.wordlist_status();
      for (const lang of Array.from(pending)) {
        const s = st[lang];
        if (s.state === 'loading') { setWl(lang, '', 'yükleniyor…'); continue; }
        if (s.state === 'error') { setWl(lang, 'error', s.message || 'yüklenemedi'); pending.delete(lang); continue; }
        pending.delete(lang);
        setWl(lang, '', 'aktarılıyor…');
        let words = [], idx = 0;
        for (;;) {
          const chunk = await api.get_wordlist_chunk(lang, idx);
          if (chunk.words) words = words.concat(chunk.words.split('\n'));
          if (chunk.done) break;
          idx++;
        }
        wordsReady(lang, words, s.source);
      }
      if (pending.size) await new Promise((r) => setTimeout(r, 400));
    }
  }

  async function loadFromBundle() {
    for (const lang of ['tr', 'en']) {
      try {
        const raw = await (await fetch('data/fallback_' + lang + '.txt')).text();
        wordsReady(lang, parseWords(raw, lang), 'bundled');
      } catch (e) { setWl(lang, 'error', 'yüklenemedi'); }
    }
  }

  function startWordlists() {
    loadKeyWords();
    if (hasApi()) { loadFromApi().catch((e) => { console.error(e); loadFromBundle(); }); return; }
    let started = false;
    const go = () => { if (started) return; started = true; hasApi() ? loadFromApi().catch(loadFromBundle) : loadFromBundle(); };
    window.addEventListener('pywebviewready', go);
    setTimeout(go, 1500); // masaüstü köprüsü yoksa (ör. tarayıcıda önizleme) yerel listeler
  }

  /* ================= MODÜL 2: Otomatik Kırma ================= */

  let breakId = 0, running = null;

  function breakOpts() {
    const o = {};
    document.querySelectorAll('#bOpts input[data-opt]').forEach((c) => { o[c.dataset.opt] = c.checked; });
    return o;
  }

  function scoreColor(s) {
    const t = Math.max(0, Math.min(1, s / 100));
    return `background: rgba(255,255,255,${(0.05 + t * 0.22).toFixed(2)}); color: rgba(255,255,255,${(0.45 + t * 0.55).toFixed(2)})`;
  }

  function showResults(results, ms) {
    const tb = $('bResults');
    if (!results.length) { tb.innerHTML = '<tr><td colspan="6" class="muted center">Sonuç bulunamadı.</td></tr>'; return; }
    tb.innerHTML = results.map((r, i) => {
      const enc = r.chain.slice().reverse();
      const label = enc.map((s) => C.describeStep(s)).join(' → ');
      return `<tr><td class="muted">${i + 1}</td><td><span class="score" style="${scoreColor(r.score)}">${r.score.toFixed(1)}</span></td>
        <td class="muted">${r.words}</td><td class="chainc">${esc(label)}</td><td class="txt">${esc(r.text.length > 400 ? r.text.slice(0, 400) + '…' : r.text)}</td>
        <td><div class="row"><button class="btn tiny" data-copy="${i}">Kopyala</button><button class="btn tiny ghost" data-load="${i}" title="Zinciri Şifrele & Çöz ekranına aktar">Zincire aktar</button></div></td></tr>`;
    }).join('');
    tb._results = results;
    $('bMeta').textContent = results.length + ' sonuç · ' + (ms / 1000).toFixed(2) + ' s';
  }

  $('bResults').addEventListener('click', (e) => {
    const res = $('bResults')._results || [];
    const c = e.target.closest('[data-copy]'), l = e.target.closest('[data-load]');
    if (c) copy(res[+c.dataset.copy].text);
    if (l) {
      const r = res[+l.dataset.load];
      state.chain = r.chain.slice().reverse().map((s) => ({ method: s.method, params: Object.assign({}, s.params) }));
      $('cInput').value = $('bInput').value;
      renderChain();
      document.querySelector('.nav-item[data-view="cipher"]').click();
      runChain('dec');
      toast('Zincir aktarıldı ve çözüldü');
    }
  });

  function finishBreak() {
    running = null;
    $('btnBreak').disabled = false;
    $('btnBreakStop').hidden = true;
  }

  $('btnBreak').addEventListener('click', () => {
    const text = $('bInput').value.trim(), lang = state.lang;
    if (!text) { toast('Şifreli metin girin'); return; }
    if (!state.words[lang]) { toast('Kelime listesi henüz yüklenmedi'); return; }
    const userKeys = $('bKeys').value.split(/[,;\s]+/).filter(Boolean);
    const keyWords = userKeys.concat(state.keyWords[lang]);
    const opts = breakOpts();
    const id = ++breakId, t0 = performance.now();
    $('btnBreak').disabled = true; $('btnBreakStop').hidden = false;
    $('bProgress').style.width = '2%';
    $('bMeta').textContent = 'deneniyor…';

    if (worker) {
      running = id;
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.id !== running) return;
        if (m.type === 'progress') $('bProgress').style.width = m.pct + '%';
        if (m.type === 'result') { $('bProgress').style.width = '100%'; showResults(m.results, performance.now() - t0); finishBreak(); }
        if (m.type === 'error') { toast(m.message); $('bMeta').textContent = m.message; finishBreak(); }
      };
      worker.postMessage({ type: 'break', id, text, lang, opts, keyWords });
    } else {
      running = id;
      setTimeout(() => {
        try {
          const scorer = new B.Scorer(state.words[lang], lang);
          const res = B.breakCipher(text, lang, scorer, opts, keyWords);
          if (running === id) { $('bProgress').style.width = '100%'; showResults(res, performance.now() - t0); }
        } catch (err) { toast(err.message); }
        finishBreak();
      }, 30);
    }
  });

  $('btnBreakStop').addEventListener('click', () => {
    if (worker) {
      worker.terminate();
      worker = new Worker('worker.js');
      ['tr', 'en'].forEach((lang) => { if (state.words[lang]) worker.postMessage({ type: 'wordlist', lang, words: Array.from(state.words[lang]) }); });
    }
    $('bMeta').textContent = 'durduruldu';
    $('bProgress').style.width = '0';
    finishBreak();
  });

  /* ================= MODÜL 3: Ses & Görsel İnceleme ================= */

  async function saveWav(buffer, name) {
    const bytes = new Uint8Array(A.encodeWav(buffer));
    if (hasApi() && window.pywebview.api.save_file) {
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const r = await window.pywebview.api.save_file(btoa(bin), name);
      if (r && r.saved) toast('Kaydedildi: ' + r.path);
      else if (r && r.error) toast('Kaydedilemedi: ' + r.error);
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Spektrogram
  let specBuffer = null, specPlot = null, specLabel = '';
  function redrawSpec() {
    if (!specBuffer) return;
    const info = A.drawSpectrogram($('specCanvas'), specBuffer, {
      fftSize: +$('aFft').value, maxFreq: +$('aMax').value, logScale: $('aLog').checked,
    });
    specPlot = info.plot;
    $('aInfo').textContent = (specLabel ? specLabel + ' · ' : '') + `${info.duration.toFixed(2)} s · ${info.sampleRate} Hz · ${info.channels} kanal · FFT ${$('aFft').value}`;
  }
  async function loadSpecBuffer(buf, label) {
    specBuffer = buf; specLabel = label || '';
    $('specEmpty').hidden = true;
    $('aPlay').disabled = false;
    redrawSpec();
  }
  $('aFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('specEmpty').hidden = false; $('specEmpty').textContent = 'Çözümleniyor…';
    try { await loadSpecBuffer(await A.decodeFile(f), f.name); }
    catch (err) { $('specEmpty').hidden = false; $('specEmpty').textContent = 'Dosya çözülemedi: ' + (err && err.message || 'desteklenmeyen biçim'); }
    e.target.value = '';
  });
  ['aFft', 'aMax', 'aLog'].forEach((id) => $(id).addEventListener('change', redrawSpec));
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(redrawSpec, 200); });
  $('aPlay').addEventListener('click', () => {
    if (!specBuffer) return;
    const head = $('specHead');
    A.play(specBuffer, (r) => {
      if (!specPlot) return;
      head.style.display = r >= 1 ? 'none' : 'block';
      head.style.left = (specPlot.x + r * specPlot.w) + 'px';
    }, () => { head.style.display = 'none'; });
  });
  $('aStop').addEventListener('click', () => A.stop());

  // Görselden sese
  let imgBuffer = null;
  $('iFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const img = $('iPreview');
    img.onload = () => { img.hidden = false; $('imgEmpty').hidden = true; $('iPlay').disabled = false; $('iSave').disabled = false; $('iToSpec').disabled = false; $('iInfo').textContent = `${img.naturalWidth}×${img.naturalHeight} px`; };
    img.src = URL.createObjectURL(f);
    imgBuffer = null;
    e.target.value = '';
  });
  async function buildImageAudio() {
    const fMin = Math.max(20, +$('iFmin').value), fMax = Math.max(fMin + 100, +$('iFmax').value);
    $('iInfo').textContent = 'Osilatörler işleniyor…';
    imgBuffer = await A.imageToAudio($('iPreview'), {
      duration: Math.max(1, Math.min(30, +$('iDur').value || 5)), fMin, fMax, invert: $('iInv').checked,
    });
    $('iInfo').textContent = `${$('iPreview').naturalWidth}×${$('iPreview').naturalHeight} px → ${imgBuffer.duration.toFixed(1)} s, ${fMin}–${fMax} Hz`;
    $('iSave').disabled = false; $('iToSpec').disabled = false;
    return imgBuffer;
  }
  ['iDur', 'iFmin', 'iFmax', 'iInv'].forEach((id) => $(id).addEventListener('change', () => { imgBuffer = null; }));
  $('iPlay').addEventListener('click', async () => {
    A.audioCtx();
    const buf = imgBuffer || await buildImageAudio();
    const img = $('iPreview'), head = $('imgHead'), wrap = img.parentElement;
    A.play(buf, (r) => {
      const left = img.offsetLeft + r * img.clientWidth;
      head.style.display = r >= 1 ? 'none' : 'block';
      head.style.left = left + 'px';
      head.style.top = img.offsetTop + 'px'; head.style.bottom = (wrap.clientHeight - img.offsetTop - img.clientHeight) + 'px';
    }, () => { head.style.display = 'none'; });
  });
  $('iStop').addEventListener('click', () => A.stop());
  $('iSave').addEventListener('click', async () => saveWav(imgBuffer || await buildImageAudio(), 'uncipher_gorsel.wav'));
  $('iToSpec').addEventListener('click', async () => {
    await loadSpecBuffer(imgBuffer || await buildImageAudio(), 'görselden üretilen ses');
    const fMax = +$('iFmax').value;
    const opt = Array.from($('aMax').options).map((o) => +o.value).filter((v) => v >= fMax).sort((x, y) => x - y)[0];
    $('aMax').value = String(opt || 0);
    redrawSpec();
    $('specCanvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Metinden sese / Mors
  let mMode = 'morse';
  document.querySelectorAll('#mMode button').forEach((b) => b.addEventListener('click', () => {
    mMode = b.dataset.mode;
    document.querySelectorAll('#mMode button').forEach((x) => x.classList.toggle('active', x === b));
    $('mWpmWrap').hidden = mMode !== 'morse'; $('mFreqWrap').hidden = mMode !== 'morse'; $('mBaseWrap').hidden = mMode === 'morse';
    renderMorse();
  }));

  function renderMorse(activeChar) {
    const text = $('mText').value;
    const box = $('mOut');
    if (mMode === 'morse') {
      const up = Array.from(C.toUpper(text, state.lang));
      box.innerHTML = up.map((ch, i) => {
        if (/\s/.test(ch)) return '<span> / </span>';
        const code = C.MORSE[ch];
        if (!code) return '';
        return `<span class="${i === activeChar ? 'on' : ''}">${code}</span> `;
      }).join('');
    } else {
      const Al = C.ALPHABETS[state.lang], base = +$('mBase').value, step = +$('mStep').value;
      box.innerHTML = Array.from(C.toUpper(text, state.lang)).map((ch, i) => {
        if (/\s/.test(ch)) return '<span> · </span>';
        let k = Al.indexOf(ch);
        if (k < 0 && /[0-9]/.test(ch)) k = Al.length + Number(ch);
        if (k < 0) return '';
        return `<span class="${i === activeChar ? 'on' : ''}">${esc(ch)}:${base + k * step}Hz</span> `;
      }).join('');
    }
  }
  ['mText', 'mBase', 'mStep'].forEach((id) => $(id).addEventListener('input', () => renderMorse()));

  function morseSeq() {
    return A.textToEvents($('mText').value, state.lang, {
      mode: mMode, wpm: Math.max(5, +$('mWpm').value || 18), freq: +$('mFreq').value || 650,
      toneBase: +$('mBase').value || 300, toneStep: +$('mStep').value || 40,
    });
  }
  $('mPlay').addEventListener('click', async () => {
    A.audioCtx();
    const seq = morseSeq();
    if (!seq.events.length) { toast('Çalınacak karakter yok'); return; }
    const buf = await A.renderEvents(seq);
    let last = -1;
    A.play(buf, (r) => {
      const t = r * seq.duration;
      const ev = seq.events.find((e) => t >= e.t && t < e.t + e.d + 0.25);
      const ci = r >= 1 ? -1 : (ev ? ev.charIndex : last);
      if (ci !== last) { last = ci; renderMorse(ci); }
    }, () => renderMorse());
  });
  $('mStop').addEventListener('click', () => { A.stop(); renderMorse(); });
  $('mSave').addEventListener('click', async () => {
    const seq = morseSeq();
    if (!seq.events.length) { toast('Kaydedilecek karakter yok'); return; }
    saveWav(await A.renderEvents(seq), mMode === 'morse' ? 'uncipher_mors.wav' : 'uncipher_frekans.wav');
  });
  $('mDecode').addEventListener('click', () => {
    const v = $('mText').value;
    if (!/^[\s.\-·•−–—_/]+$/.test(v)) { toast('Kutuda yalnızca nokta, tire, boşluk ve / olmalı'); return; }
    $('mText').value = C.morseToText(v);
    renderMorse();
  });

  /* Sözlük modülünün kullandığı yardımcılar */
  window.UApp = {
    getLang: () => state.lang,
    pigSvg,
    useMethod(method, params) {
      state.chain.push({ method, params: Object.assign(C.defaultParams(method), params || {}) });
      renderChain();
      document.querySelector('.nav-item[data-view="cipher"]').click();
      toast(C.METHODS[method].name + ' zincire eklendi');
    },
  };

  /* ---------------- Başlat ---------------- */
  setLang('tr');
  $('cInput').value = 'Gizli mesaj: Yarın öğlen köprünün altında buluşalım.';
  renderMorse();
  startWordlists();
})();
