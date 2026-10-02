/* Uncipher - fare hareketine hafif tepki veren arka plan ağı */
(function () {
  'use strict';
  const cv = document.getElementById('bg');
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, pts = [], t = 0;
  // Camın arkasında kırılacak yumuşak, nötr ışık kütleleri
  const ORBS = [
    { x: 0.18, y: 0.22, r: 0.42, c: '255,255,255', a: 0.17, sx: 0.00021, sy: 0.00017 },
    { x: 0.82, y: 0.30, r: 0.36, c: '255,226,196', a: 0.13, sx: 0.00016, sy: 0.00023 },
    { x: 0.62, y: 0.86, r: 0.46, c: '214,218,222', a: 0.12, sx: 0.00019, sy: 0.00013 },
    { x: 0.30, y: 0.78, r: 0.28, c: '255,200,170', a: 0.09, sx: 0.00025, sy: 0.00019 },
  ];
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  const LINK = 130, MOUSE_R = 170;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(110, (W * H) / 14000));
    pts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.4 + 0.6,
    }));
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; });
  document.addEventListener('mouseleave', () => { mouse.tx = -9999; mouse.ty = -9999; });

  function frame() {
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    if (mouse.tx < -9000) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    g.clearRect(0, 0, W, H);
    t += 16;
    const px = mouse.tx > -9000 ? (mouse.x / W - 0.5) : 0, py = mouse.ty > -9000 ? (mouse.y / H - 0.5) : 0;
    const M = Math.max(W, H);
    for (const o of ORBS) {
      const cx = (o.x + Math.sin(t * o.sx) * 0.06 + px * 0.04) * W;
      const cy = (o.y + Math.cos(t * o.sy) * 0.06 + py * 0.04) * H;
      const rad = o.r * M;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grd.addColorStop(0, `rgba(${o.c},${o.a})`);
      grd.addColorStop(0.5, `rgba(${o.c},${o.a * 0.35})`);
      grd.addColorStop(1, `rgba(${o.c},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }

    for (const p of pts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < MOUSE_R && d > 0.1) {
        const f = (1 - d / MOUSE_R) * 0.6; // hafif itme
        p.x += (dx / d) * f; p.y += (dy / d) * f;
      }
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
    }

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          g.strokeStyle = `rgba(255,255,255,${(1 - d / LINK) * 0.09})`;
          g.lineWidth = 1;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        }
      }
      const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (md < MOUSE_R) {
        g.strokeStyle = `rgba(255,255,255,${(1 - md / MOUSE_R) * 0.22})`;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(mouse.x, mouse.y); g.stroke();
      }
      g.fillStyle = md < MOUSE_R ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.32)';
      g.beginPath(); g.arc(a.x, a.y, a.r, 0, Math.PI * 2); g.fill();
    }
    if (!still) requestAnimationFrame(frame);
  }

  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  resize();
  requestAnimationFrame(frame);
})();
