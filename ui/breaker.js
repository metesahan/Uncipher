/*
 * Uncipher - Otomatik Kırma
 * Metodları, anahtar/kaydırma kombinasyonlarını ve permütasyonları dener;
 * sonuçları seçilen dilin kelime listesiyle eşleşme oranına göre sıralar.
 */
(function (root) {
  'use strict';

  const C = (typeof module !== 'undefined' && module.exports) ? require('./crypto.js') : root.UCrypto;

  // Harf frekansları (%)
  const FREQ = {
    en: [8.17, 1.49, 2.78, 4.25, 12.7, 2.23, 2.02, 6.09, 6.97, 0.15, 0.77, 4.03, 2.41, 6.75, 7.51, 1.93, 0.1, 5.99, 6.33, 9.06, 2.76, 0.98, 2.36, 0.15, 1.97, 0.07],
    tr: [11.92, 2.84, 0.96, 1.15, 4.71, 8.91, 0.46, 1.25, 1.12, 1.23, 5.11, 8.6, 0.03, 4.68, 5.92, 3.75, 7.48, 2.47, 0.78, 0.79, 6.95, 3.01, 1.78, 3.31, 3.24, 1.85, 0.95, 3.37, 1.5],
  };

  // Kelime listesinde 3 harften kısa olup yine de anlamlı sayılan kelimeler
  const SHORT = {
    en: new Set('a i an am as at be by do go he if in is it me my no of oh ok on or so to up us we'.split(' ')),
    tr: new Set('o ve bu şu ne da de ki mi mı mu mü ya az al at ad ev su iş on öz üç ay el ön en ile'.split(' ')),
  };

  const MAX_WORD = 18;

  class Scorer {
    constructor(words, lang) {
      this.lang = lang;
      this.set = words instanceof Set ? words : new Set(words);
      this.short = SHORT[lang];
    }

    isWord(w) {
      if (w.length >= 3) return this.set.has(w);
      return this.short.has(w);
    }

    /** Bir kelime parçasında sözlük kelimeleriyle (>=3 harf) kapsanan en fazla harf sayısı. */
    coverage(tok) {
      const n = tok.length, dp = new Array(n + 1).fill(0);
      for (let i = 1; i <= n; i++) {
        dp[i] = dp[i - 1];
        for (let L = 3; L <= Math.min(MAX_WORD, i); L++) {
          if (dp[i - L] + L > dp[i] && this.set.has(tok.slice(i - L, i))) dp[i] = dp[i - L] + L;
        }
      }
      return dp[n];
    }

    score(text) {
      const lower = C.toLower(text, this.lang);
      const alpha = C.LOWER[this.lang];
      const tokens = [];
      let cur = '';
      for (const ch of lower) {
        if (alpha.includes(ch)) cur += ch;
        else if (cur) { tokens.push(cur); cur = ''; }
      }
      if (cur) tokens.push(cur);
      let total = 0, covered = 0, words = 0;
      const matched = [];
      for (const t of tokens) {
        total += t.length;
        if (this.isWord(t)) {
          covered += t.length; words++;
          if (matched.length < 12) matched.push(t);
        } else if (t.length >= 6) {
          // Boşluksuz metinler için alt-kelime kapsaması (kısmi ağırlık)
          const c = this.coverage(t);
          covered += c * 0.8;
          if (c >= t.length * 0.6) words += Math.round(c / 5);
        }
      }
      if (total < 2) return { score: 0, words: 0, matched };
      const fit = freqFit(lower, this.lang); // 0..1
      return { score: (covered / total) * 92 + fit * 8, words, matched };
    }
  }

  function counts(text, lang) {
    const n = C.ALPHABETS[lang].length, c = new Array(n).fill(0);
    let total = 0;
    for (const ch of text) {
      const info = C.letterInfo(ch, lang);
      if (info) { c[info.idx]++; total++; }
    }
    return { c, total };
  }

  function chi2(cnt, total, lang) {
    if (!total) return Infinity;
    const f = FREQ[lang];
    let s = 0;
    for (let i = 0; i < cnt.length; i++) {
      const e = (f[i] / 100) * total;
      s += ((cnt[i] - e) * (cnt[i] - e)) / (e || 0.01);
    }
    return s;
  }

  function freqFit(text, lang) {
    const { c, total } = counts(text, lang);
    if (total < 8) return 0;
    const x = chi2(c, total, lang) / total;
    return 1 / (1 + x);
  }

  /** Vigenère / Gronsfeld için sütun bazlı frekans analiziyle anahtar tahmini. */
  function estimateShifts(text, lang, keyLen, maxShift) {
    const n = C.ALPHABETS[lang].length, letters = [];
    for (const ch of text) { const i = C.letterInfo(ch, lang); if (i) letters.push(i.idx); }
    const shifts = [];
    for (let col = 0; col < keyLen; col++) {
      const cnt = new Array(n).fill(0);
      let tot = 0;
      for (let i = col; i < letters.length; i += keyLen) { cnt[letters[i]]++; tot++; }
      let best = 0, bestV = Infinity;
      for (let s = 0; s < Math.min(n, maxShift); s++) {
        const shifted = new Array(n);
        for (let k = 0; k < n; k++) shifted[k] = cnt[(k + s) % n];
        const v = chi2(shifted, tot, lang);
        if (v < bestV) { bestV = v; best = s; }
      }
      shifts.push(best);
    }
    return { shifts, letterCount: letters.length };
  }

  function detect(text) {
    const compact = text.replace(/\s+/g, '');
    return {
      polybius: compact.length >= 2 && /^[1-6]+$/.test(compact.replace(/[^\d]/g, '')) && (compact.match(/\d/g) || []).length / compact.length > 0.7,
      bacon: compact.length >= 5 && (compact.replace(/\//g, '').match(/[ABab01]/g) || []).length / compact.replace(/\//g, '').length > 0.95,
      pigpen: Array.from(text).some((ch) => C.PIG_GRID.includes(ch) || C.PIG_X.includes(ch)),
    };
  }

  const DEFAULT_OPTS = {
    caesar: true, atbash: true, affine: true, vigenere: true, gronsfeld: true,
    route: true, routeCombo: true, polybius: true, bacon: true, pigpen: true,
    maxRouteCols: 20, maxKeyLen: 12, top: 60,
  };

  /**
   * Dönen her sonucun "chain" alanı, şifreli metne uygulanan ÇÖZME adımlarını sırasıyla içerir.
   * Şifreleme zinciri bunun tersidir (chain.slice().reverse()).
   * text: şifreli metin, lang: 'tr'|'en', scorer: Scorer, keyWords: Vigenère için denenecek anahtar kelimeler.
   * onProgress(pct) isteğe bağlı.
   */
  function breakCipher(text, lang, scorer, opts, keyWords, onProgress) {
    opts = Object.assign({}, DEFAULT_OPTS, opts || {});
    const N = C.ALPHABETS[lang].length;
    const results = new Map();
    const progress = onProgress || function () {};

    function add(chain, out) {
      if (!out || results.has(out)) return;
      const s = scorer.score(out);
      results.set(out, { chain, text: out, score: s.score, words: s.words, matched: s.matched });
    }
    const step = (method, params) => ({ method, params: params || {} });

    // 1) Kod çözücüler: Polybius / Bacon / Pigpen -> taban metinler
    const bases = [{ chain: [], text }];
    const det = detect(text);
    const tryDecode = (m) => {
      try { bases.push({ chain: [step(m)], text: C.METHODS[m].decrypt(text, {}, lang) }); } catch (e) { /* uygun değil */ }
    };
    if (opts.polybius && det.polybius) tryDecode('polybius');
    if (opts.bacon && det.bacon) tryDecode('bacon');
    if (opts.pigpen && det.pigpen) tryDecode('pigpen');

    bases.forEach((base, bi) => {
      const T = base.text;
      const pre = base.chain;
      const subs = []; // yerine koyma adayları (route kombinasyonu için)
      add(pre.concat([]), T);

      if (opts.caesar) for (let k = 1; k < N; k++) {
        const st = step('caesar', { shift: k });
        subs.push(st); add(pre.concat([st]), C.METHODS.caesar.decrypt(T, st.params, lang));
      }
      if (opts.atbash) {
        const st = step('atbash');
        subs.push(st); add(pre.concat([st]), C.METHODS.atbash.decrypt(T, {}, lang));
      }
      if (opts.affine) for (let a = 2; a < N; a++) {
        if (C.gcd(a, N) !== 1) continue;
        for (let b = 0; b < N; b++) {
          const st = step('affine', { a, b });
          subs.push(st); add(pre.concat([st]), C.METHODS.affine.decrypt(T, st.params, lang));
        }
      }
      progress(Math.round(((bi + 0.3) / bases.length) * 100));

      if (opts.vigenere || opts.gronsfeld) {
        for (let L = 1; L <= opts.maxKeyLen; L++) {
          if (opts.gronsfeld) {
            const { shifts, letterCount } = estimateShifts(T, lang, L, 10);
            if (letterCount >= L * 3 && shifts.some((s) => s > 0)) {
              const key = shifts.join('');
              add(pre.concat([step('gronsfeld', { key })]), C.METHODS.gronsfeld.decrypt(T, { key }, lang));
            }
          }
          if (opts.vigenere && L > 1) {
            const { shifts, letterCount } = estimateShifts(T, lang, L, N);
            if (letterCount >= L * 3) {
              const key = shifts.map((s) => C.ALPHABETS[lang][s]).join('');
              add(pre.concat([step('vigenere', { key })]), C.METHODS.vigenere.decrypt(T, { key }, lang));
            }
          }
        }
        if (opts.vigenere && keyWords) {
          for (const w of keyWords) {
            const key = C.toUpper(w, lang);
            if (key.length < 3) continue;
            try { add(pre.concat([step('vigenere', { key })]), C.METHODS.vigenere.decrypt(T, { key }, lang)); } catch (e) { /* atla */ }
          }
        }
      }
      progress(Math.round(((bi + 0.6) / bases.length) * 100));

      if (opts.route) {
        const len = Array.from(T).length;
        const maxC = Math.min(opts.maxRouteCols, len - 1);
        // Harf frekansı yer değiştirmeden etkilenmez: en uyumlu yerine koymaları seç
        let topSubs = [];
        if (opts.routeCombo && subs.length) {
          topSubs = subs.map((st) => {
            const out = C.METHODS[st.method].decrypt(T, st.params, lang);
            const { c, total } = counts(out, lang);
            return { st, v: chi2(c, total, lang) };
          }).sort((x, y) => x.v - y.v).slice(0, 6).map((x) => x.st);
        }
        for (let cols = 2; cols <= maxC; cols++) {
          const rs = step('route', { cols });
          const routed = C.METHODS.route.decrypt(T, rs.params, lang);
          add(pre.concat([rs]), routed);
          for (const st of topSubs) {
            add(pre.concat([rs, st]), C.METHODS[st.method].decrypt(routed, st.params, lang));
          }
        }
      }
      progress(Math.round(((bi + 1) / bases.length) * 100));
    });

    return Array.from(results.values())
      .filter((r) => r.chain.length > 0)
      .sort((a, b) => b.score - a.score || b.words - a.words)
      .slice(0, opts.top);
  }

  const api = { Scorer, breakCipher, estimateShifts, freqFit, detect, FREQ, DEFAULT_OPTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UBreaker = api;
})(typeof self !== 'undefined' ? self : this);
