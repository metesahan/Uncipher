# Uncipher · Tasarım Sistemi (ui-ux-pro-max)

Kaynak: ui-ux-pro-max `--design-system` (developer tool / dark / glass) + `liquid-glass` stili.
Önerilen slate paleti mavi tonlu olduğu için (kullanıcı mavi/mor istemiyor) nötr grafit tonlarla değiştirildi.

## Stil
- **Liquid Glass (Apple, dark):** cam yalnızca kabuk ve kontrollerde (kenar çubuğu, araç çubukları, kartlar, düğmeler). İçerik (metin alanları, sonuç listeleri) ayrı, daha opak katmanda kalır ki okunabilirlik bozulmasın.
- Renk "az ve anlamlı": arayüz monokrom, renk yalnızca durum bildirir.
- Kaçınılacaklar: mavi/mor/cyan, neon parlama, renk geçişli başlıklar, emoji ikonlar, her yerde blur.

## Renk token'ları (nötr grafit, mavi kayması yok)
```css
:root{
  --bg:            #0B0B0C;                 /* pencere zemini */
  --bg-2:          #141416;                 /* zemin ikinci ton (vinyet) */
  --glass:         rgba(255,255,255,0.055); /* cam yüzey */
  --glass-strong:  rgba(255,255,255,0.085); /* hover / aktif cam */
  --glass-content: rgba(12,12,13,0.62);     /* içerik katmanı (textarea, liste) */
  --stroke:        rgba(255,255,255,0.10);  /* 1px kenar */
  --stroke-hi:     rgba(255,255,255,0.22);  /* üst kenar ışığı (specular) */
  --text:          #F4F4F5;                 /* ana metin, ~17:1 */
  --text-2:        #A1A1AA;                 /* ikincil metin, ~7:1 */
  --text-3:        #71717A;                 /* yalnızca etiket/ipucu, ≥4.5:1 */
  --primary:       #F4F4F5;                 /* ana düğme: açık zemin */
  --on-primary:    #0B0B0C;
  --ok:            #4ADE80;                 /* başarı / yüklendi */
  --warn:          #FBBF24;
  --err:           #F87171;
  --ring:          rgba(255,255,255,0.65);  /* odak halkası */
}
```

## Cam malzemesi
```css
.glass{
  background: var(--glass);
  backdrop-filter: blur(28px) saturate(140%);
  -webkit-backdrop-filter: blur(28px) saturate(140%);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  box-shadow:
    inset 0 1px 0 var(--stroke-hi),        /* üst kenar ışığı */
    inset 0 -1px 0 rgba(0,0,0,0.35),
    0 20px 50px -20px rgba(0,0,0,0.7);
}
@media (prefers-reduced-transparency: reduce){
  .glass{ background:#1A1A1C; backdrop-filter:none; }
}
```
- Blur'un görünmesi için arkada hareketli/dokulu bir şey olmalı: Canvas ağı + çok soluk, büyük, bulanık **gri-beyaz** ışık lekeleri (renkli değil).
- Köşe yarıçapları: pencere 22, kart 18, kontrol 12, chip 999.

## Tipografi
- Arayüz: sistem fontu `-apple-system, "SF Pro Text", "Segoe UI Variable", "Segoe UI", system-ui` (masaüstü uygulaması gibi görünür, çevrimdışı çalışır).
- Şifreli metin, anahtarlar, alfabe, skorlar: **JetBrains Mono** (yerel dosya olarak `ui/fonts/` içine gömülü; Google Fonts'a bağlanılmaz).
- Ölçek: 12 / 13 / 15 (gövde) / 20 / 28. Satır yüksekliği 1.5. Başlıklar 600, `letter-spacing:-0.01em`.

## Boşluk (density 6)
4 · 8 · 12 · 16 · 24 · 32 · 48. Kart iç boşluğu 20–24, kartlar arası 16.

## Etkileşim
- Tüm tıklanabilirler en az 36px yükseklik (masaüstü), `cursor:pointer`, hover 150ms, basışta `scale(.98)`.
- Görünür odak: `outline:2px solid var(--ring); outline-offset:2px`.
- Uzun işlem (Otomatik Kırma, wordlist yükleme): ilerleme çubuğu + iptal düğmesi; düğme işlem sırasında devre dışı.
- Hareket: 150–300ms, `cubic-bezier(.2,.8,.2,1)`; `prefers-reduced-motion` ile Canvas animasyonu durur.

## İkonlar
Unicode/emoji yerine tek setten çizgi SVG (Lucide stili, 1.5px stroke, 18px): shuffle (Şifrele & Çöz), key-round (Otomatik Kırma), audio-waveform (Ses & Görsel), book-open (Sözlük).

## Teslim öncesi kontrol
- [ ] Mavi/mor/cyan hiçbir token'da yok
- [ ] Metin kontrastı ≥ 4.5:1 (cam üstünde de)
- [ ] Emoji/unicode ikon yok
- [ ] Odak halkaları görünür, klavyeyle tüm sekmeler gezilebilir
- [ ] reduced-motion / reduced-transparency yedekleri var
- [ ] 1024px ve 1440px pencere genişliğinde taşma yok
- [ ] Footer sabit: "© Mete Şahan Tarafından Geliştirilmiştir Tüm Hakları Saklıdır."
