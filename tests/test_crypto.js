// Kullanım: node tests/test_crypto.js [tr_wordlist.txt] [en_wordlist.txt]
const fs = require('fs');
const path = require('path');
const C = require('../ui/crypto.js');
const B = require('../ui/breaker.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log('FAIL:', name, extra || ''); }
}

const SAMPLES = {
  tr: ['Çok gizli bir mesaj: Yarın İzmir’de buluşalım, ağaçların altında!', 'IĞDIR ışığı ŞÜPHE ÖZGÜR çiçek'],
  en: ['Meet me at the old bridge at midnight, bring the map!', 'The Quick Brown Fox Jumps Over The Lazy Dog 42'],
};

// Bazı metodlar büyük/küçük harfi veya alfabe dışı ayrıntıları korumaz; karşılaştırma buna göre yapılır.
function normalize(method, text, lang) {
  if (['polybius', 'bacon', 'pigpen'].includes(method)) {
    let t = C.toUpper(text, lang);
    if (method === 'polybius' && lang === 'en') t = t.replace(/J/g, 'I');
    if (method === 'bacon') t = t.replace(/\s+/g, ' ');
    return t;
  }
  return text;
}

const PARAM_SETS = {
  caesar: [{ shift: 3 }, { shift: 0 }, { shift: -5 }, { shift: 40 }],
  vigenere: [{ key: 'LEMON' }, { key: 'şifre' }, { key: 'Kİ' }],
  atbash: [{}],
  route: [{ cols: 2 }, { cols: 4 }, { cols: 7 }, { cols: 13 }, { cols: 200 }],
  polybius: [{}],
  bacon: [{}],
  pigpen: [{}],
  gronsfeld: [{ key: '31415' }, { key: '0' }, { key: '9 2 7' }],
  affine: [{ a: 5, b: 8 }, { a: 7, b: 3 }, { a: 1, b: 0 }],
};

// 1) Her metod, her iki alfabe: şifrele -> çöz
for (const lang of ['tr', 'en']) {
  for (const method of Object.keys(C.METHODS)) {
    for (const params of PARAM_SETS[method]) {
      for (const text of SAMPLES[lang]) {
        // Polybius girişinde rakam belirsizlik yaratır; rakamları çıkar
        const input = method === 'polybius' ? text.replace(/\d/g, '') : text;
        let ok = false, got;
        try {
          const enc = C.METHODS[method].encrypt(input, params, lang);
          got = C.METHODS[method].decrypt(enc, params, lang);
          ok = normalize(method, got, lang) === normalize(method, input, lang);
          if (['caesar', 'vigenere', 'gronsfeld', 'affine', 'route'].includes(method) && !(method === 'caesar' && params.shift % C.ALPHABETS[lang].length === 0) && params.key !== '0' && params.a !== 1 && params.cols < 100)
            check(`${lang}/${method}/${JSON.stringify(params)} metni değiştirir`, enc !== input);
        } catch (e) { got = 'HATA: ' + e.message; }
        check(`${lang}/${method}/${JSON.stringify(params)} gidiş-dönüş`, ok, `\n  giriş: ${input}\n  çıkış: ${got}`);
      }
    }
  }
}

// Affine: N ile aralarında asal olmayan a reddedilmeli (İngilizce N=26)
let threw = false;
try { C.METHODS.affine.encrypt('ABC', { a: 13, b: 1 }, 'en'); } catch (e) { threw = true; }
check('affine a=13 EN reddedilir', threw);
check('affine TR (N=29 asal) her a kabul', C.METHODS.affine.decrypt(C.METHODS.affine.encrypt('ÇAĞ', { a: 13, b: 2 }, 'tr'), { a: 13, b: 2 }, 'tr') === 'ÇAĞ');

// 2) Bilinen test vektörleri
check('Sezar EN', C.METHODS.caesar.encrypt('HELLO', { shift: 3 }, 'en') === 'KHOOR');
check('Sezar TR (29 harf, Z->C)', C.METHODS.caesar.encrypt('Z', { shift: 3 }, 'tr') === 'C');
check('Atbash TR A<->Z', C.METHODS.atbash.encrypt('ABC', {}, 'tr') === 'ZYV');
check('Atbash EN', C.METHODS.atbash.encrypt('ABC', {}, 'en') === 'ZYX');
check('Vigenère EN (ATTACKATDAWN/LEMON)', C.METHODS.vigenere.encrypt('ATTACKATDAWN', { key: 'LEMON' }, 'en') === 'LXFOPVEFRNHR');
check('Bacon A=AAAAA B=AAAAB', C.METHODS.bacon.encrypt('AB', {}, 'en') === 'AAAAA AAAAB');
check('Affine EN a=5 b=8', C.METHODS.affine.encrypt('AFFINE CIPHER', { a: 5, b: 8 }, 'en') === 'IHHWVC SWFRCP');
check('Polybius EN', C.METHODS.polybius.encrypt('HELLO', {}, 'en') === '2315313134');
check('Polybius TR 6x5 (Z=55)', C.METHODS.polybius.encrypt('AZ', {}, 'tr') === '1155');
check('Gronsfeld EN', C.METHODS.gronsfeld.encrypt('AAAAA', { key: '31415' }, 'en') === 'DBEBF');
check('Pigpen EN A,J,S,W', C.METHODS.pigpen.encrypt('AJSW', {}, 'en') === '⌟⌟•∨∨•');
check('Pigpen TR 29 benzersiz sembol', new Set(C.pigpenTokens('tr')).size === 29);
// Route: ABCDEFGHIJKL, 4 sütun:
//  A B C D
//  E F G H
//  I J K L   -> sağ üstten saat yönü: D H L K J I E A B C G F
check('Route spiral', C.METHODS.route.encrypt('ABCDEFGHIJKL', { cols: 4 }, 'en') === 'DHLKJIEABCGF', C.METHODS.route.encrypt('ABCDEFGHIJKL', { cols: 4 }, 'en'));
check('Alfabe uzunlukları', C.ALPHABETS.tr.length === 29 && C.ALPHABETS.en.length === 26);
check('Mors TR', C.textToMorse('Şiş', 'tr') === '.--.. .-..- .--..');
check('Mors gidiş-dönüş', C.morseToText(C.textToMorse('SOS HELP', 'en')) === 'SOS HELP');

// 3) Zincir: Sezar -> Atbash -> Route (+ diğer kombinasyonlar)
const chains = [
  [{ method: 'caesar', params: { shift: 3 } }, { method: 'atbash' }, { method: 'route', params: { cols: 5 } }],
  [{ method: 'vigenere', params: { key: 'KALE' } }, { method: 'affine', params: { a: 7, b: 11 } }, { method: 'gronsfeld', params: { key: '2718' } }, { method: 'route', params: { cols: 3 } }],
  [{ method: 'caesar', params: { shift: 5 } }, { method: 'bacon' }, { method: 'caesar', params: { shift: 2 } }, { method: 'route', params: { cols: 6 } }],
  [{ method: 'atbash' }, { method: 'polybius' }, { method: 'route', params: { cols: 4 } }],
  [{ method: 'route', params: { cols: 3 } }, { method: 'pigpen' }, { method: 'route', params: { cols: 5 } }],
];
for (const lang of ['tr', 'en']) {
  chains.forEach((chain, ci) => {
    const input = SAMPLES[lang][0].replace(/\d/g, '');
    let got;
    try {
      const enc = C.encryptChain(input, chain, lang);
      got = C.decryptChain(enc.output, chain, lang).output;
    } catch (e) { got = 'HATA: ' + e.message; }
    const lossy = chain.some((s) => ['polybius', 'bacon', 'pigpen'].includes(s.method));
    const norm = (t) => {
      let x = lossy ? C.toUpper(t, lang).replace(/\s+/g, ' ') : t;
      if (lang === 'en' && chain.some((s) => s.method === 'polybius')) x = x.replace(/J/g, 'I');
      return x;
    };
    check(`${lang} zincir #${ci + 1}`, norm(got) === norm(input), `\n  ${input}\n  ${got}`);
  });
}

console.log(`Kripto testleri: ${pass} başarılı, ${fail} başarısız`);

// 4) Otomatik kırma (kelime listeleri verilmişse)
function loadWords(file, lang) {
  const raw = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const tok of raw.split(/[^A-Za-zÇĞİÖŞÜçğıöşüâîû]+/)) {
    if (!tok) continue;
    const w = C.toLower(tok.replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u'), lang);
    if (Array.from(w).every((ch) => C.LOWER[lang].includes(ch))) out.add(w);
  }
  return out;
}

const trFile = process.argv[2], enFile = process.argv[3];
if (trFile && enFile) {
  const sets = { tr: loadWords(trFile, 'tr'), en: loadWords(enFile, 'en') };
  console.log('Kelime sayıları:', sets.tr.size, sets.en.size);
  const plain = {
    tr: 'yarın sabah limanda buluşalım ve gemiyi birlikte kontrol edelim',
    en: 'meet me tomorrow morning at the harbor and we will check the ship together',
  };
  const cases = [
    [{ method: 'caesar', params: { shift: 7 } }],
    [{ method: 'atbash' }],
    [{ method: 'affine', params: { a: 5, b: 8 } }],
    [{ method: 'route', params: { cols: 6 } }],
    [{ method: 'caesar', params: { shift: 4 } }, { method: 'route', params: { cols: 5 } }],
    [{ method: 'vigenere', params: { key: 'KALEM' } }],
    [{ method: 'gronsfeld', params: { key: '314' } }],
    [{ method: 'polybius' }],
    [{ method: 'bacon' }],
    [{ method: 'pigpen' }],
    [{ method: 'caesar', params: { shift: 11 } }, { method: 'polybius' }],
  ];
  let bpass = 0, bfail = 0;
  for (const lang of ['tr', 'en']) {
    const scorer = new B.Scorer(sets[lang], lang);
    for (const chain of cases) {
      const cipher = C.encryptChain(plain[lang], chain, lang).output;
      const t0 = Date.now();
      const res = B.breakCipher(cipher, lang, scorer, {}, ['kalem', 'anahtar', 'gizli', 'secret', 'key']);
      const ms = Date.now() - t0;
      const top = res[0];
      const ok = top && C.toLower(top.text, lang).replace(/\s+/g, ' ').trim() === plain[lang];
      const label = chain.map((s) => C.describeStep(s)).join(' -> ');
      if (ok) bpass++; else bfail++;
      console.log(`${ok ? 'OK  ' : 'MISS'} [${lang}] ${label}  (${ms} ms, ${res.length} sonuç) -> ${top ? top.chain.slice().reverse().map(C.describeStep).join(' -> ') + ' | ' + top.score.toFixed(1) + ' | ' + top.text.slice(0, 50) : '-'}`);
    }
  }
  console.log(`Kırma testleri: ${bpass} başarılı, ${bfail} başarısız`);
  if (bfail) fail += bfail;
}

process.exit(fail ? 1 : 0);
