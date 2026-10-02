/*
 * Uncipher - Ses & Görsel İnceleme
 * Spektrogram (STFT), görselden sese dönüştürme (osilatör bankası) ve Mors / frekans sesleri.
 */
(function (root) {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  let ctx = null;
  let current = null; // çalan kaynak

  function audioCtx() {
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ---------------- FFT ---------------- */

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  function colormap(t) {
    // siyah -> grafit -> gümüş -> beyaz (hafif sıcak ton)
    const stops = [[8, 8, 9], [34, 33, 34], [78, 76, 76], [140, 136, 132], [205, 200, 194], [255, 253, 248]];
    t = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
    return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  }

  const LUT = Array.from({ length: 256 }, (_, i) => colormap(i / 255));

  function monoData(buffer) {
    const n = buffer.length, out = new Float32Array(n);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < n; i++) out[i] += d[i] / buffer.numberOfChannels;
    }
    return out;
  }

  /**
   * opts: { fftSize, maxFreq (Hz, 0 = Nyquist), logScale, dbRange }
   */
  function drawSpectrogram(canvas, buffer, opts) {
    opts = Object.assign({ fftSize: 2048, maxFreq: 0, logScale: false, dbRange: 90 }, opts || {});
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padL = 64, padB = 26, padT = 12, padR = 14;
    const W = Math.max(10, Math.floor(cssW - padL - padR)), H = Math.max(10, Math.floor(cssH - padT - padB));

    const data = monoData(buffer), sr = buffer.sampleRate, N = opts.fftSize;
    const nyq = sr / 2, fMax = opts.maxFreq > 0 ? Math.min(opts.maxFreq, nyq) : nyq;
    const cols = Math.min(W * Math.ceil(dpr), 1600);
    const hop = Math.max(1, (data.length - N) / Math.max(1, cols - 1));
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    const bins = N / 2, binHz = sr / N;
    const mags = new Array(cols);
    let peak = -Infinity;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let c = 0; c < cols; c++) {
      const start = Math.floor(c * hop);
      for (let i = 0; i < N; i++) { re[i] = (data[start + i] || 0) * win[i]; im[i] = 0; }
      fft(re, im);
      const m = new Float32Array(bins);
      for (let k = 0; k < bins; k++) {
        const db = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
        m[k] = db; if (db > peak) peak = db;
      }
      mags[c] = m;
    }

    const rowsPx = Math.round(H * dpr);
    const img = g.createImageData(cols, rowsPx);
    const fMin = 20;
    for (let y = 0; y < rowsPx; y++) {
      const t = 1 - y / (rowsPx - 1);
      const f = opts.logScale ? fMin * Math.pow(fMax / fMin, t) : t * fMax;
      const k = Math.min(bins - 1, Math.max(0, Math.round(f / binHz)));
      for (let c = 0; c < cols; c++) {
        const v = (mags[c][k] - (peak - opts.dbRange)) / opts.dbRange;
        const [r, gg, b] = LUT[Math.max(0, Math.min(255, Math.round(v * 255)))];
        const p = (y * cols + c) * 4;
        img.data[p] = r; img.data[p + 1] = gg; img.data[p + 2] = b; img.data[p + 3] = 255;
      }
    }
    const tmp = document.createElement('canvas');
    tmp.width = cols; tmp.height = rowsPx;
    tmp.getContext('2d').putImageData(img, 0, 0);
    g.clearRect(0, 0, cssW, cssH);
    g.imageSmoothingEnabled = true;
    g.drawImage(tmp, padL, padT, W, H);

    // Eksenler
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    g.textAlign = 'right'; g.textBaseline = 'middle';
    const fTicks = 5;
    for (let i = 0; i <= fTicks; i++) {
      const t = i / fTicks;
      const f = opts.logScale ? fMin * Math.pow(fMax / fMin, t) : t * fMax;
      const y = padT + H - t * H;
      g.fillText(f >= 1000 ? (f / 1000).toFixed(1) + ' kHz' : Math.round(f) + ' Hz', padL - 6, y);
      g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + W, y); g.stroke();
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    const dur = buffer.duration, tTicks = Math.max(2, Math.min(10, Math.floor(W / 90)));
    for (let i = 0; i <= tTicks; i++) {
      const x = padL + (i / tTicks) * W;
      g.fillText((dur * i / tTicks).toFixed(dur < 10 ? 2 : 1) + ' s', x, padT + H + 6);
    }
    return { duration: dur, sampleRate: sr, channels: buffer.numberOfChannels, plot: { x: padL, y: padT, w: W, h: H } };
  }

  async function decodeFile(file) {
    const arr = await file.arrayBuffer();
    return await new Promise((resolve, reject) => {
      const p = audioCtx().decodeAudioData(arr, resolve, reject);
      if (p && p.catch) p.catch(reject);
    });
  }

  /* ---------------- Oynatma ---------------- */

  function stop() {
    if (current) {
      try { current.src.stop(); } catch (e) { /* zaten durdu */ }
      cancelAnimationFrame(current.raf);
      if (current.onEnd) current.onEnd();
      current = null;
    }
  }

  /** onTick(oran 0..1) oynatma ilerlemesini bildirir. */
  function play(buffer, onTick, onEnd) {
    stop();
    const ac = audioCtx();
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    const t0 = ac.currentTime;
    const state = { src, onEnd, raf: 0 };
    const tick = () => {
      const r = (ac.currentTime - t0) / buffer.duration;
      if (onTick) onTick(Math.min(1, r));
      if (r < 1 && current === state) state.raf = requestAnimationFrame(tick);
    };
    src.onended = () => { if (current === state) { cancelAnimationFrame(state.raf); current = null; if (onTick) onTick(1); if (onEnd) onEnd(); } };
    current = state;
    src.start();
    tick();
    return state;
  }

  /* ---------------- Görselden sese ---------------- */

  /**
   * Görseli bir osilatör bankasıyla sese dönüştürür: her satır bir sinüs osilatörü (üst satır = yüksek frekans),
   * her sütun bir zaman dilimi, piksel parlaklığı = genlik. Sonuç spektrogramda görselin kendisi olarak görünür.
   */
  async function imageToAudio(img, opts) {
    opts = Object.assign({ duration: 5, fMin: 200, fMax: 8000, rows: 96, cols: 240, sampleRate: 44100, invert: false }, opts || {});
    const rows = opts.rows;
    const aspect = img.naturalWidth / img.naturalHeight;
    const cols = Math.max(16, Math.min(opts.cols, Math.round(rows * aspect * 2)));
    const cv = document.createElement('canvas');
    cv.width = cols; cv.height = rows;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, cols, rows);
    const px = g.getImageData(0, 0, cols, rows).data;
    const lum = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      let v = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255 * (px[i * 4 + 3] / 255);
      if (opts.invert) v = 1 - v;
      lum[i] = v * v; // kontrast
    }

    const len = Math.ceil(opts.duration * opts.sampleRate);
    const off = new OAC(1, len, opts.sampleRate);
    const master = off.createGain();
    master.gain.value = 1 / Math.sqrt(rows);
    master.connect(off.destination);
    const colDur = opts.duration / cols;
    for (let r = 0; r < rows; r++) {
      const freq = opts.fMax - (r / (rows - 1)) * (opts.fMax - opts.fMin);
      const osc = off.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = off.createGain();
      gain.gain.setValueAtTime(0, 0);
      for (let c = 0; c < cols; c++) {
        gain.gain.linearRampToValueAtTime(lum[r * cols + c], c * colDur + colDur / 2);
      }
      gain.gain.linearRampToValueAtTime(0, opts.duration);
      osc.connect(gain); gain.connect(master);
      osc.start(0); osc.stop(opts.duration);
    }
    const buf = await off.startRendering();
    normalize(buf);
    return buf;
  }

  function normalize(buf, target) {
    target = target || 0.9;
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    if (peak > 0) for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c), k = target / peak;
      for (let i = 0; i < d.length; i++) d[i] *= k;
    }
  }

  /* ---------------- Mors / frekans sesleri ---------------- */

  /**
   * Metni olay listesine çevirir. mode: 'morse' | 'tones'
   * Dönen: { events: [{t, d, f, label, charIndex}], duration }
   */
  function textToEvents(text, lang, opts) {
    opts = Object.assign({ mode: 'morse', wpm: 18, freq: 650, toneBase: 300, toneStep: 40, toneDur: 0.2 }, opts || {});
    const C = root.UCrypto;
    const events = [];
    let t = 0.05;
    if (opts.mode === 'morse') {
      const unit = 1.2 / opts.wpm;
      const chars = Array.from(C.toUpper(text, lang));
      chars.forEach((ch, idx) => {
        if (/\s/.test(ch)) { t += unit * 4; return; } // harf sonu 3 + 4 = 7 birim kelime arası
        const code = C.MORSE[ch];
        if (!code) return;
        Array.from(code).forEach((sym, k) => {
          const d = sym === '.' ? unit : unit * 3;
          events.push({ t, d, f: opts.freq, label: ch, charIndex: idx });
          t += d;
          if (k < code.length - 1) t += unit;
        });
        t += unit * 3;
      });
    } else {
      const A = C.ALPHABETS[lang];
      Array.from(C.toUpper(text, lang)).forEach((ch, idx) => {
        if (/\s/.test(ch)) { t += opts.toneDur; return; }
        let i = A.indexOf(ch);
        if (i < 0 && /[0-9]/.test(ch)) i = A.length + Number(ch);
        if (i < 0) return;
        events.push({ t, d: opts.toneDur, f: opts.toneBase + i * opts.toneStep, label: ch, charIndex: idx });
        t += opts.toneDur + 0.04;
      });
    }
    return { events, duration: t + 0.1 };
  }

  async function renderEvents(seq, sampleRate) {
    sampleRate = sampleRate || 44100;
    const len = Math.max(1, Math.ceil(seq.duration * sampleRate));
    const off = new OAC(1, len, sampleRate);
    const osc = off.createOscillator();
    osc.type = 'sine';
    const gain = off.createGain();
    gain.gain.setValueAtTime(0, 0);
    const ramp = 0.004;
    seq.events.forEach((e) => {
      osc.frequency.setValueAtTime(e.f, e.t);
      gain.gain.setValueAtTime(0, e.t);
      gain.gain.linearRampToValueAtTime(0.8, e.t + ramp);
      gain.gain.setValueAtTime(0.8, e.t + e.d - ramp);
      gain.gain.linearRampToValueAtTime(0, e.t + e.d);
    });
    osc.connect(gain); gain.connect(off.destination);
    osc.start(0); osc.stop(seq.duration);
    return await off.startRendering();
  }

  /* ---------------- WAV ---------------- */

  function encodeWav(buffer) {
    const ch = buffer.numberOfChannels, sr = buffer.sampleRate, n = buffer.length;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
    return out.buffer;
  }

  root.UAudio = { audioCtx, fft, drawSpectrogram, decodeFile, play, stop, imageToAudio, textToEvents, renderEvents, encodeWav, normalize };
})(window);
