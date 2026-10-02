/*
 * Uncipher - Kripto çekirdeği
 * Tarayıcı penceresi, Web Worker ve Node (test) ortamlarında aynı kod çalışır.
 */
(function (root) {
  'use strict';

  const ALPHABETS = {
    tr: 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ',
    en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  };
  const LOWER = {
    tr: 'abcçdefgğhıijklmnoöprsştuüvyz',
    en: 'abcdefghijklmnopqrstuvwxyz',
  };

  function alphabet(lang) {
    const a = ALPHABETS[lang];
    if (!a) throw new Error('Bilinmeyen dil: ' + lang);
    return a;
  }

  /** Harfin alfabedeki indeksini ve küçük harf olup olmadığını döndürür. */
  function letterInfo(ch, lang) {
    let i = ALPHABETS[lang].indexOf(ch);
    if (i >= 0) return { idx: i, lower: false };
    i = LOWER[lang].indexOf(ch);
    if (i >= 0) return { idx: i, lower: true };
    return null;
  }

  function toUpper(text, lang) {
    let out = '';
    for (const ch of text) {
      const info = letterInfo(ch, lang);
      if (info) out += ALPHABETS[lang][info.idx];
      else out += lang === 'tr' ? ch.toLocaleUpperCase('tr-TR') : ch.toUpperCase();
    }
    return out;
  }

  function toLower(text, lang) {
    let out = '';
    for (const ch of text) {
      const info = letterInfo(ch, lang);
      if (info) out += LOWER[lang][info.idx];
      else out += lang === 'tr' ? ch.toLocaleLowerCase('tr-TR') : ch.toLowerCase();
    }
    return out;
  }

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function modInverse(a, m) {
    a = mod(a, m);
    for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;
    return null;
  }

  /**
   * Yalnızca alfabedeki harfleri dönüştürür; büyük/küçük harf korunur,
   * diğer karakterler olduğu gibi kalır. fn(idx, letterPos) -> yeni indeks.
   */
  function mapLetters(text, lang, fn) {
    const up = ALPHABETS[lang], lo = LOWER[lang], n = up.length;
    let out = '', pos = 0;
    for (const ch of text) {
      const info = letterInfo(ch, lang);
      if (!info) { out += ch; continue; }
      const j = mod(fn(info.idx, pos++), n);
      out += info.lower ? lo[j] : up[j];
    }
    return out;
  }

  function toInt(v, name) {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new Error(name + ' bir tam sayı olmalıdır.');
    return n;
  }

  function keyShifts(key, lang) {
    const shifts = [];
    for (const ch of String(key || '')) {
      const info = letterInfo(ch, lang);
      if (info) shifts.push(info.idx);
    }
    if (!shifts.length) throw new Error('Anahtar kelime seçili alfabeden en az bir harf içermelidir.');
    return shifts;
  }

  function digitShifts(key) {
    const shifts = String(key || '').replace(/\s+/g, '').split('');
    if (!shifts.length || shifts.some((d) => !/^[0-9]$/.test(d)))
      throw new Error('Gronsfeld anahtarı yalnızca rakamlardan oluşmalıdır (örn: 31415).');
    return shifts.map(Number);
  }

  /* ---------------- Route (Spiral) ---------------- */

  /** Sağ üst köşeden başlayıp saat yönünde ilerleyen spiral okuma sırası. */
  function spiralOrder(len, cols) {
    const rows = Math.ceil(len / cols);
    let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
    const order = [];
    const push = (r, c) => { const p = r * cols + c; if (p < len) order.push(p); };
    while (top <= bottom && left <= right) {
      for (let r = top; r <= bottom; r++) push(r, right); // sağ kenar, aşağı
      right--;
      if (left > right) break;
      for (let c = right; c >= left; c--) push(bottom, c); // alt kenar, sola
      bottom--;
      if (top > bottom) break;
      for (let r = bottom; r >= top; r--) push(r, left); // sol kenar, yukarı
      left++;
      if (left > right) break;
      for (let c = left; c <= right; c++) push(top, c); // üst kenar, sağa
      top++;
    }
    return order;
  }

  function routeCols(p) {
    const cols = toInt(p.cols, 'Sütun sayısı');
    if (cols < 2) throw new Error('Route şifresi için sütun sayısı en az 2 olmalıdır.');
    return cols;
  }

  /* ---------------- Polybius ---------------- */

  function polybiusGrid(lang) {
    if (lang === 'tr') return { cells: ALPHABETS.tr.split(''), cols: 6 }; // 5 satır x 6 sütun
    return { cells: 'ABCDEFGHIKLMNOPQRSTUVWXYZ'.split(''), cols: 5 }; // I/J birleşik
  }

  /* ---------------- Bacon ---------------- */

  function baconCode(idx) {
    return idx.toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B');
  }

  /* ---------------- Pigpen ---------------- */

  const PIG_GRID = ['⌟', '⊔', '⌞', '⊐', '□', '⊏', '⌝', '⊓', '⌜'];
  const PIG_X = ['∨', '>', '<', '∧'];
  const PIG_DOT = '•';
  const PIG_BASES = new Set(PIG_GRID.concat(PIG_X));

  function pigpenTokens(lang) {
    const t = [];
    PIG_GRID.forEach((g) => t.push(g));
    PIG_GRID.forEach((g) => t.push(g + PIG_DOT));
    PIG_X.forEach((g) => t.push(g));
    PIG_X.forEach((g) => t.push(g + PIG_DOT));
    if (lang === 'tr') PIG_GRID.slice(0, 3).forEach((g) => t.push(g + PIG_DOT + PIG_DOT));
    return t.slice(0, ALPHABETS[lang].length);
  }

  /** Pigpen metnini [{token}|{char}] parçalarına ayırır. */
  function parsePigpen(text) {
    const chars = Array.from(text), parts = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (PIG_BASES.has(ch)) {
        let tok = ch;
        while (chars[i + 1] === PIG_DOT) { tok += PIG_DOT; i++; }
        parts.push({ token: tok });
      } else {
        parts.push({ char: ch });
      }
    }
    return parts;
  }

  /* ---------------- Metod tanımları ---------------- */

  const METHODS = {
    caesar: {
      name: 'Sezar',
      params: [{ key: 'shift', label: 'Kaydırma (k)', type: 'number', default: 3 }],
      encrypt(text, p, lang) {
        const k = toInt(p.shift, 'Kaydırma');
        return mapLetters(text, lang, (i) => i + k);
      },
      decrypt(text, p, lang) {
        const k = toInt(p.shift, 'Kaydırma');
        return mapLetters(text, lang, (i) => i - k);
      },
      describe: (p) => 'k=' + p.shift,
    },

    vigenere: {
      name: 'Vigenère',
      params: [{ key: 'key', label: 'Anahtar kelime', type: 'text', default: 'ANAHTAR' }],
      encrypt(text, p, lang) {
        const s = keyShifts(p.key, lang);
        return mapLetters(text, lang, (i, pos) => i + s[pos % s.length]);
      },
      decrypt(text, p, lang) {
        const s = keyShifts(p.key, lang);
        return mapLetters(text, lang, (i, pos) => i - s[pos % s.length]);
      },
      describe: (p) => 'anahtar=' + p.key,
    },

    atbash: {
      name: 'Atbash',
      params: [],
      encrypt(text, p, lang) {
        const n = alphabet(lang).length;
        return mapLetters(text, lang, (i) => n - 1 - i);
      },
      decrypt(text, p, lang) {
        return METHODS.atbash.encrypt(text, p, lang);
      },
      describe: () => '',
    },

    route: {
      name: 'Route (Spiral)',
      params: [{ key: 'cols', label: 'Sütun sayısı', type: 'number', default: 4 }],
      encrypt(text, p) {
        const cols = routeCols(p), chars = Array.from(text);
        return spiralOrder(chars.length, cols).map((i) => chars[i]).join('');
      },
      decrypt(text, p) {
        const cols = routeCols(p), chars = Array.from(text);
        const order = spiralOrder(chars.length, cols), out = new Array(chars.length);
        order.forEach((pos, i) => { out[pos] = chars[i]; });
        return out.join('');
      },
      describe: (p) => 'sütun=' + p.cols,
    },

    polybius: {
      name: 'Polybius Karesi',
      params: [],
      encrypt(text, p, lang) {
        const g = polybiusGrid(lang);
        let out = '';
        for (const ch of text) {
          const info = letterInfo(ch, lang);
          if (!info) { out += ch; continue; }
          let L = ALPHABETS[lang][info.idx];
          if (lang === 'en' && L === 'J') L = 'I';
          const i = g.cells.indexOf(L);
          out += String(Math.floor(i / g.cols) + 1) + String((i % g.cols) + 1);
        }
        return out;
      },
      decrypt(text, p, lang) {
        const g = polybiusGrid(lang), rows = Math.ceil(g.cells.length / g.cols);
        return text.replace(/\d+/g, (run) => {
          if (run.length % 2) throw new Error('Polybius: rakam grupları çift uzunlukta olmalıdır ("' + run + '").');
          let out = '';
          for (let i = 0; i < run.length; i += 2) {
            const r = +run[i], c = +run[i + 1];
            const cell = g.cells[(r - 1) * g.cols + (c - 1)];
            if (r < 1 || r > rows || c < 1 || c > g.cols || !cell)
              throw new Error('Polybius: geçersiz koordinat ' + run.substr(i, 2));
            out += cell;
          }
          return out;
        });
      },
      describe: () => '',
    },

    bacon: {
      name: 'Bacon',
      params: [],
      encrypt(text, p, lang) {
        const tokens = [];
        for (const ch of text) {
          const info = letterInfo(ch, lang);
          if (info) tokens.push(baconCode(info.idx));
          else if (/\s/.test(ch)) tokens.push('/');
          else tokens.push(ch);
        }
        return tokens.join(' ');
      },
      decrypt(text, p, lang) {
        const A = ALPHABETS[lang];
        let out = '';
        for (let tok of text.split(/\s+/)) {
          if (!tok) continue;
          if (tok === '/') { out += ' '; continue; }
          const norm = tok.replace(/[aA0]/g, 'A').replace(/[bB1]/g, 'B');
          if (/^[AB]+$/.test(norm) && norm.length % 5 === 0) {
            for (let i = 0; i < norm.length; i += 5) {
              const idx = parseInt(norm.substr(i, 5).replace(/A/g, '0').replace(/B/g, '1'), 2);
              if (idx >= A.length) throw new Error('Bacon: geçersiz grup ' + norm.substr(i, 5));
              out += A[idx];
            }
          } else {
            out += tok;
          }
        }
        return out;
      },
      describe: () => '',
    },

    pigpen: {
      name: 'Pigpen (Mason)',
      params: [],
      encrypt(text, p, lang) {
        const toks = pigpenTokens(lang);
        let out = '';
        for (const ch of text) {
          const info = letterInfo(ch, lang);
          out += info ? toks[info.idx] : ch;
        }
        return out;
      },
      decrypt(text, p, lang) {
        const toks = pigpenTokens(lang), A = ALPHABETS[lang];
        return parsePigpen(text).map((part) => {
          if (part.char !== undefined) return part.char;
          const i = toks.indexOf(part.token);
          if (i < 0) throw new Error('Pigpen: bu alfabede tanımsız sembol ' + part.token);
          return A[i];
        }).join('');
      },
      describe: () => '',
    },

    gronsfeld: {
      name: 'Gronsfeld',
      params: [{ key: 'key', label: 'Sayısal anahtar', type: 'text', default: '31415' }],
      encrypt(text, p, lang) {
        const s = digitShifts(p.key);
        return mapLetters(text, lang, (i, pos) => i + s[pos % s.length]);
      },
      decrypt(text, p, lang) {
        const s = digitShifts(p.key);
        return mapLetters(text, lang, (i, pos) => i - s[pos % s.length]);
      },
      describe: (p) => 'anahtar=' + p.key,
    },

    affine: {
      name: 'Affine (Afin)',
      params: [
        { key: 'a', label: 'a', type: 'number', default: 5 },
        { key: 'b', label: 'b', type: 'number', default: 8 },
      ],
      encrypt(text, p, lang) {
        const n = alphabet(lang).length, a = toInt(p.a, 'a'), b = toInt(p.b, 'b');
        if (gcd(a, n) !== 1) throw new Error('Affine: a (' + a + ') ile N (' + n + ') aralarında asal olmalıdır.');
        return mapLetters(text, lang, (x) => a * x + b);
      },
      decrypt(text, p, lang) {
        const n = alphabet(lang).length, a = toInt(p.a, 'a'), b = toInt(p.b, 'b');
        if (gcd(a, n) !== 1) throw new Error('Affine: a (' + a + ') ile N (' + n + ') aralarında asal olmalıdır.');
        const inv = modInverse(a, n);
        return mapLetters(text, lang, (y) => inv * (y - b));
      },
      describe: (p) => 'a=' + p.a + ', b=' + p.b,
    },
  };

  function defaultParams(methodId) {
    const p = {};
    METHODS[methodId].params.forEach((d) => { p[d.key] = d.default; });
    return p;
  }

  /** steps: [{method, params}] — her adımın ara çıktısıyla birlikte döner. */
  function encryptChain(text, steps, lang) {
    const trace = [];
    let cur = text;
    steps.forEach((s, i) => {
      cur = METHODS[s.method].encrypt(cur, s.params || {}, lang);
      trace.push({ step: i + 1, method: s.method, output: cur });
    });
    return { output: cur, trace };
  }

  function decryptChain(text, steps, lang) {
    const trace = [];
    let cur = text;
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      cur = METHODS[s.method].decrypt(cur, s.params || {}, lang);
      trace.push({ step: i + 1, method: s.method, output: cur });
    }
    return { output: cur, trace };
  }

  function describeStep(s) {
    const m = METHODS[s.method], d = m.describe(s.params || {});
    return m.name + (d ? ' (' + d + ')' : '');
  }

  /* ---------------- Mors ---------------- */

  const MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
    K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    'Ç': '-.-..', 'Ğ': '--.-.', 'İ': '.-..-', 'Ö': '---.', 'Ş': '.--..', 'Ü': '..--',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
    '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '"': '.-..-.', '@': '.--.-.',
    "'": '.----.',
  };
  const MORSE_REV = {};
  Object.keys(MORSE).forEach((k) => { if (!(MORSE[k] in MORSE_REV)) MORSE_REV[MORSE[k]] = k; });

  /** Harfler arası tek boşluk, kelimeler arası " / ". */
  function textToMorse(text, lang) {
    const words = toUpper(text, lang || 'tr').trim().split(/\s+/).filter(Boolean);
    return words.map((w) => Array.from(w).map((ch) => MORSE[ch] || '').filter(Boolean).join(' ')).join(' / ');
  }

  function morseToText(code) {
    return code.trim().split(/\s*\/\s*|\s{3,}/).map((w) =>
      w.trim().split(/\s+/).filter(Boolean).map((c) => MORSE_REV[c.replace(/[·•]/g, '.').replace(/[−–—_]/g, '-')] || '?').join('')
    ).join(' ');
  }

  const api = {
    ALPHABETS, LOWER, METHODS, PIG_GRID, PIG_X, PIG_DOT, MORSE,
    alphabet, letterInfo, toUpper, toLower, mod, gcd, modInverse, mapLetters,
    spiralOrder, polybiusGrid, baconCode, pigpenTokens, parsePigpen,
    defaultParams, encryptChain, decryptChain, describeStep, textToMorse, morseToText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UCrypto = api;
})(typeof self !== 'undefined' ? self : this);
