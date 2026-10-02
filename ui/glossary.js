/* Uncipher - Kriptoloji Sözlüğü: yöntem listesi, görsel anlatımlar ve canlı örnekler */
(function () {
  'use strict';
  const C = window.UCrypto;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang = () => window.UApp.getLang();
  const A = () => C.ALPHABETS[lang()];
  const letters = (text) => Array.from(C.toUpper(text, lang())).filter((ch) => A().includes(ch));

  // Her yöntem için düzenlenebilir örnek değerleri (dil değişince örnek metin yenilenir)
  const EXAMPLES = {
    tr: { word: 'KALE', long: 'GİZLİ MESAJ', key: 'ANAHTAR', route: 'BULUŞMA YERİ LİMANDA' },
    en: { word: 'HELLO', long: 'ATTACK AT DAWN', key: 'LEMON', route: 'MEET ME AT THE HARBOR' },
  };
  const st = {
    caesar: { k: 3 }, vigenere: {}, atbash: {}, route: { cols: 4 }, polybius: {}, bacon: {},
    pigpen: {}, gronsfeld: { key: '31415' }, affine: { a: 5, b: 8 },
  };
  function resetExamples() {
    const ex = EXAMPLES[lang()];
    st.caesar.text = ex.word; st.vigenere.text = ex.long; st.vigenere.key = ex.key;
    st.atbash.text = ex.word; st.route.text = ex.route; st.polybius.text = ex.word;
    st.bacon.text = ex.word; st.pigpen.text = ex.word; st.gronsfeld.text = ex.long; st.affine.text = ex.word;
  }

  /* ---------- ortak parçalar ---------- */

  const field = (m, key, label, attrs) =>
    `<label class="vf"><span>${label}</span><input data-m="${m}" data-k="${key}" value="${esc(st[m][key])}" ${attrs || 'type="text"'}></label>`;

  function result(m, params) {
    let out;
    try { out = C.METHODS[m].encrypt(st[m].text, params, lang()); } catch (e) { out = '⚠ ' + e.message; }
    return `<div class="vres"><div><span class="vlab">Açık metin</span><code>${esc(st[m].text)}</code></div>
      <svg class="varrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      <div><span class="vlab">Şifreli</span><code>${esc(out)}</code></div>
      <button class="btn tiny" data-use="${m}">Şifrele &amp; Çöz'de kullan</button></div>`;
  }

  function strip(cells, cls) {
    return `<div class="strip ${cls || ''}">${cells.join('')}</div>`;
  }

  /* ---------- görselleştirmeler ---------- */

  const VIZ = {
    caesar() {
      const a = A(), n = a.length, k = C.mod(Number(st.caesar.k) || 0, n);
      const used = new Set(letters(st.caesar.text));
      const cols = a.split('').map((ch, i) =>
        `<div class="col ${used.has(ch) ? 'hit' : ''}"><b>${ch}</b><i>↓</i><b>${a[(i + k) % n]}</b><small>${i}</small></div>`);
      return `<div class="vrow">${field('caesar', 'k', 'Kaydırma (k)', `type="range" min="1" max="${n - 1}"`)}<span class="vval">k = ${k}</span>${field('caesar', 'text', 'Örnek metin')}</div>
        <p class="vnote">Üst sıra açık alfabe, alt sıra ${k} adım kaydırılmış alfabedir. Örnekteki harfler vurgulanır; her biri altındaki harfle değiştirilir.</p>
        ${strip(cols, 'scroll')}${result('caesar', { shift: k })}`;
    },

    vigenere() {
      const a = A(), n = a.length, s = st.vigenere;
      const ks = letters(s.key);
      const pl = Array.from(C.toUpper(s.text, lang()));
      let pos = 0;
      const cols = pl.map((ch) => {
        if (!a.includes(ch)) return `<div class="col gap"><b>${ch === ' ' ? '&nbsp;' : esc(ch)}</b><b></b><small></small><b></b></div>`;
        if (!ks.length) return '';
        const kc = ks[pos % ks.length], sh = a.indexOf(kc), out = a[(a.indexOf(ch) + sh) % n];
        pos++;
        return `<div class="col"><b>${ch}</b><b class="key">${kc}</b><small>+${sh}</small><b class="out">${out}</b></div>`;
      });
      return `<div class="vrow">${field('vigenere', 'key', 'Anahtar kelime')}${field('vigenere', 'text', 'Örnek metin')}</div>
        <p class="vnote">Anahtar metnin altına tekrar tekrar yazılır. Her harf, altındaki anahtar harfinin alfabedeki sırası kadar ileri kayar.</p>
        <div class="legend"><span>Açık</span><span class="key">Anahtar</span><span>Kaydırma</span><span class="out">Şifreli</span></div>
        ${strip(cols, 'scroll tall')}${ks.length ? result('vigenere', { key: s.key }) : '<p class="vnote warn">Anahtar en az bir harf içermeli.</p>'}`;
    },

    atbash() {
      const a = A(), n = a.length, used = new Set(letters(st.atbash.text));
      const half = Math.ceil(n / 2);
      const pairs = [];
      for (let i = 0; i < half; i++) {
        const x = a[i], y = a[n - 1 - i];
        pairs.push(`<div class="pair ${used.has(x) || used.has(y) ? 'hit' : ''}"><b>${x}</b><svg viewBox="0 0 24 12"><path d="M3 6h18M7 2 3 6l4 4M17 2l4 4-4 4"/></svg><b>${y}</b></div>`);
      }
      return `<div class="vrow">${field('atbash', 'text', 'Örnek metin')}</div>
        <p class="vnote">Alfabe ortadan katlanmış gibi düşünün: ilk harf sonuncuyla, ikinci harf sondan ikinciyle eşleşir. Aynı işlem şifreyi geri de çözer.</p>
        <div class="pairs">${pairs.join('')}</div>${result('atbash', {})}`;
    },

    route() {
      const s = st.route, cols = Math.max(2, Math.min(12, Number(s.cols) || 4));
      const chars = Array.from(s.text);
      const L = chars.length, rows = Math.ceil(L / cols), cw = 54, pad = 20;
      const W = cols * cw + pad * 2, H = rows * cw + pad * 2;
      const order = C.spiralOrder(L, cols);
      const ctr = (p) => [pad + (p % cols) * cw + cw / 2, pad + Math.floor(p / cols) * cw + cw / 2];
      let cells = '', texts = '';
      for (let p = 0; p < rows * cols; p++) {
        const [x, y] = ctr(p);
        const filled = p < L;
        cells += `<rect x="${x - cw / 2 + 3}" y="${y - cw / 2 + 3}" width="${cw - 6}" height="${cw - 6}" rx="10" class="${filled ? 'cell' : 'cell empty'}"/>`;
        if (filled) texts += `<text x="${x}" y="${y + 6}" class="ch">${chars[p] === ' ' ? '␣' : esc(chars[p])}</text>`;
      }
      const pts = order.map(ctr);
      const path = pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1]).join(' ');
      const nums = order.map((p, i) => { const [x, y] = ctr(p); return `<text x="${x + cw / 2 - 8}" y="${y - cw / 2 + 15}" class="num">${i + 1}</text>`; }).join('');
      const start = pts[0] ? `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="5" class="start"/>` : '';
      return `<div class="vrow">${field('route', 'cols', 'Sütun sayısı', 'type="number" min="2" max="12"')}${field('route', 'text', 'Örnek metin')}</div>
        <p class="vnote">Metin satır satır tabloya yazılır. Okuma sağ üst köşedeki noktadan başlar ve çizgiyi izleyerek saat yönünde içe doğru döner. Küçük sayılar okuma sırasını gösterir.</p>
        <div class="route-wrap"><svg class="route" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
          <defs><marker id="rarr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10z" class="arrowhead"/></marker></defs>
          ${cells}<path d="${path}" class="spiral" marker-end="url(#rarr)"/>${start}${texts}${nums}</svg></div>
        ${result('route', { cols })}`;
    },

    polybius() {
      const g = C.polybiusGrid(lang()), rows = Math.ceil(g.cells.length / g.cols);
      const ws = letters(st.polybius.text).map((ch) => (lang() === 'en' && ch === 'J' ? 'I' : ch));
      const used = new Set(ws);
      let t = '<table class="poly"><tr><th></th>';
      for (let c = 1; c <= g.cols; c++) t += `<th>${c}</th>`;
      t += '</tr>';
      for (let r = 0; r < rows; r++) {
        t += `<tr><th>${r + 1}</th>`;
        for (let c = 0; c < g.cols; c++) {
          const ch = g.cells[r * g.cols + c] || '';
          const lab = lang() === 'en' && ch === 'I' ? 'I/J' : ch;
          t += `<td class="${used.has(ch) ? 'hit' : ''}">${lab}</td>`;
        }
        t += '</tr>';
      }
      t += '</table>';
      const steps = ws.map((ch) => {
        const i = g.cells.indexOf(ch);
        return `<span class="chip"><b>${ch}</b> → satır ${Math.floor(i / g.cols) + 1}, sütun ${(i % g.cols) + 1} → <b>${Math.floor(i / g.cols) + 1}${(i % g.cols) + 1}</b></span>`;
      }).join('');
      return `<div class="vrow">${field('polybius', 'text', 'Örnek metin')}</div>
        <p class="vnote">${lang() === 'tr' ? 'Türkçe 29 harf 5 satır × 6 sütunluk tabloya yerleşir.' : 'İngilizce alfabe 5 × 5 tabloya sığsın diye I ve J aynı kareyi paylaşır.'} Her harf önce satır, sonra sütun numarasıyla yazılır.</p>
        <div class="vsplit">${t}<div class="chips">${steps}</div></div>${result('polybius', {})}`;
    },

    bacon() {
      const a = A(), used = new Set(letters(st.bacon.text));
      const bits = (code) => Array.from(code).map((b) => `<i class="${b === 'B' ? 'on' : ''}"></i>`).join('');
      const table = a.split('').map((ch, i) => {
        const code = C.baconCode(i);
        return `<div class="bc ${used.has(ch) ? 'hit' : ''}"><b>${ch}</b><span class="bits">${bits(code)}</span><code>${code}</code></div>`;
      }).join('');
      return `<div class="vrow">${field('bacon', 'text', 'Örnek metin')}</div>
        <p class="vnote">Her harfin alfabedeki sırası 5 basamaklı ikili sayıya çevrilir: 0 = A, 1 = B. Kutucuklarda dolu kare B'yi, boş kare A'yı gösterir.</p>
        <div class="bacon">${table}</div>${result('bacon', {})}`;
    },

    pigpen() {
      const toks = C.pigpenTokens(lang()), a = A();
      const letterAt = (tok) => a[toks.indexOf(tok)] || '';
      const S = 132, s3 = S / 3;
      const grid = (dots) => {
        let g = `<svg viewBox="-6 -6 ${S + 12} ${S + 12}" class="pkey"><path d="M${s3} 0V${S}M${2 * s3} 0V${S}M0 ${s3}H${S}M0 ${2 * s3}H${S}" class="pline"/>`;
        C.PIG_GRID.forEach((base, i) => {
          const x = (i % 3) * s3 + s3 / 2, y = Math.floor(i / 3) * s3 + s3 / 2;
          const L = letterAt(base + C.PIG_DOT.repeat(dots));
          if (!L) return;
          g += `<text x="${x}" y="${y + 6}" class="plet">${L}</text>`;
          if (dots === 1) g += `<circle cx="${x + 15}" cy="${y - 12}" r="3" class="pdot"/>`;
          if (dots === 2) g += `<circle cx="${x + 11}" cy="${y - 12}" r="3" class="pdot"/><circle cx="${x + 19}" cy="${y - 12}" r="3" class="pdot"/>`;
        });
        return g + '</svg>';
      };
      const xgrid = (dots) => {
        let g = `<svg viewBox="-6 -6 ${S + 12} ${S + 12}" class="pkey"><path d="M10 10 ${S - 10} ${S - 10}M${S - 10} 10 10 ${S - 10}" class="pline"/>`;
        const pos = [[S / 2, 28], [28, S / 2], [S - 28, S / 2], [S / 2, S - 28]];
        C.PIG_X.forEach((base, i) => {
          const L = letterAt(base + C.PIG_DOT.repeat(dots));
          const [x, y] = pos[i];
          g += `<text x="${x}" y="${y + 6}" class="plet">${L}</text>`;
          if (dots) g += `<circle cx="${x + 14}" cy="${y - 10}" r="3" class="pdot"/>`;
        });
        return g + '</svg>';
      };
      const keys = [grid(0), grid(1), xgrid(0), xgrid(1)];
      if (lang() === 'tr') keys.push(grid(2));
      const word = Array.from(C.toUpper(st.pigpen.text, lang())).map((ch) => {
        const i = a.indexOf(ch);
        if (i < 0) return ch === ' ' ? '<span class="pg-sp"></span>' : '';
        return `<span class="pg"><span>${window.UApp.pigSvg(toks[i])}</span><small>${ch}</small></span>`;
      }).join('');
      return `<div class="vrow">${field('pigpen', 'text', 'Örnek metin')}</div>
        <p class="vnote">Harfler bu ızgaralara yerleşir. Bir harfin sembolü, içinde bulunduğu bölmenin çerçevesidir; ikinci takımdaki harflere nokta eklenir.${lang() === 'tr' ? ' Türkçenin 3 ek harfi çift noktalı son ızgaradadır.' : ''}</p>
        <div class="pkeys">${keys.join('')}</div>
        <div class="vlab">Örnek metnin sembolleri</div><div class="pgword">${word}</div>
        <div class="vres"><button class="btn tiny" data-use="pigpen">Şifrele &amp; Çöz'de kullan</button></div>`;
    },

    gronsfeld() {
      const a = A(), n = a.length, s = st.gronsfeld;
      const ds = String(s.key).replace(/\D/g, '').split('').map(Number);
      const pl = Array.from(C.toUpper(s.text, lang()));
      let pos = 0;
      const cols = pl.map((ch) => {
        if (!a.includes(ch)) return `<div class="col gap"><b>&nbsp;</b><b></b><b></b></div>`;
        if (!ds.length) return '';
        const d = ds[pos++ % ds.length];
        return `<div class="col"><b>${ch}</b><b class="key">${d}</b><b class="out">${a[(a.indexOf(ch) + d) % n]}</b></div>`;
      });
      return `<div class="vrow">${field('gronsfeld', 'key', 'Sayısal anahtar')}${field('gronsfeld', 'text', 'Örnek metin')}</div>
        <p class="vnote">Vigenère ile aynı fikir, ama anahtar harf yerine rakamdır. Her harf altındaki rakam kadar ileri kayar (0–9).</p>
        <div class="legend"><span>Açık</span><span class="key">Rakam</span><span class="out">Şifreli</span></div>
        ${strip(cols, 'scroll tall')}${ds.length ? result('gronsfeld', { key: ds.join('') }) : '<p class="vnote warn">Anahtar en az bir rakam içermeli.</p>'}`;
    },

    affine() {
      const a = A(), n = a.length, s = st.affine;
      const coprime = [];
      for (let x = 1; x < n; x++) if (C.gcd(x, n) === 1) coprime.push(x);
      if (!coprime.includes(Number(s.a))) s.a = coprime.includes(5) ? 5 : coprime[1];
      const av = Number(s.a), bv = C.mod(Number(s.b) || 0, n), inv = C.modInverse(av, n);
      const rows = letters(s.text).map((ch) => {
        const x = a.indexOf(ch), raw = av * x + bv, y = raw % n;
        return `<tr><td><b>${ch}</b></td><td>${x}</td><td>${av}·${x} + ${bv} = ${raw}</td><td>${raw} mod ${n} = ${y}</td><td><b class="out">${a[y]}</b></td></tr>`;
      }).join('');
      const opts = coprime.map((x) => `<option ${x === av ? 'selected' : ''}>${x}</option>`).join('');
      return `<div class="vrow"><label class="vf"><span>a</span><select data-m="affine" data-k="a">${opts}</select></label>${field('affine', 'b', 'b', `type="number" min="0" max="${n - 1}"`)}${field('affine', 'text', 'Örnek metin')}</div>
        <p class="vnote">Listede yalnızca N = ${n} ile aralarında asal olan a değerleri var; böylece her harfin tek bir karşılığı olur ve şifre çözülebilir. Çözme işlemi a⁻¹ = ${inv} ile yapılır: D(y) = ${inv}·(y − ${bv}) mod ${n}.</p>
        <div class="table-wrap"><table class="aff"><thead><tr><th>Harf</th><th>x</th><th>a·x + b</th><th>mod N</th><th>Şifreli</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${result('affine', { a: av, b: bv })}`;
    },
  };

  /* ---------- çizim ve olaylar ---------- */

  function render(m, full) {
    const art = document.querySelector(`.gloss[data-method="${m}"]`);
    if (!art) return;
    const box = art.querySelector('.viz');
    const tmp = document.createElement('div');
    tmp.innerHTML = VIZ[m]();
    const oldRow = box.querySelector(':scope > .vrow'), newRow = tmp.querySelector(':scope > .vrow');
    if (!full && oldRow && newRow) {
      // Kontroller yerinde kalsın (odak ve kaydırıcı sürükleme bozulmasın); yalnızca altı yenilenir
      const ov = oldRow.querySelectorAll('.vval'), nv = newRow.querySelectorAll('.vval');
      ov.forEach((v, i) => { if (nv[i]) v.textContent = nv[i].textContent; });
      while (oldRow.nextSibling) oldRow.nextSibling.remove();
      newRow.remove();
      box.append(...Array.from(tmp.childNodes));
    } else {
      box.innerHTML = '';
      box.append(...Array.from(tmp.childNodes));
    }
  }
  const renderAll = () => Object.keys(VIZ).forEach((m) => render(m, true));

  function select(m) {
    document.querySelectorAll('.gloss').forEach((g) => g.classList.toggle('active', g.dataset.method === m));
    document.querySelectorAll('#glossIndex button').forEach((b) => b.classList.toggle('active', b.dataset.m === m));
  }

  function buildIndex() {
    const nav = $('glossIndex');
    nav.innerHTML = '<div class="label">Yöntemler</div>' + Array.from(document.querySelectorAll('.gloss')).map((g, i) => {
      const name = g.querySelector('h3').childNodes[1].textContent.trim();
      const tag = g.querySelector('.gloss-tag').textContent;
      return `<button data-m="${g.dataset.method}"><span class="gi">${i + 1}</span><span><b>${esc(name)}</b><small>${esc(tag)}</small></span></button>`;
    }).join('');
    nav.addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) select(b.dataset.m); });
  }

  const grid = $('glossGrid');
  grid.addEventListener('input', (e) => {
    const t = e.target, m = t.dataset.m;
    if (!m) return;
    st[m][t.dataset.k] = t.value;
    render(m);
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-use]');
    if (!b) return;
    const m = b.dataset.use, s = st[m];
    const params = { caesar: { shift: Number(s.k) }, vigenere: { key: s.key }, route: { cols: Number(s.cols) }, gronsfeld: { key: s.key }, affine: { a: Number(s.a), b: Number(s.b) } }[m] || {};
    window.UApp.useMethod(m, params);
  });
  document.addEventListener('langchange', () => { resetExamples(); renderAll(); });

  resetExamples();
  buildIndex();
  renderAll();
  select('caesar');
})();
