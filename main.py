"""
Uncipher - masaüstü uygulaması

Pencere mantığı (pywebview) ve yerel servisler:
  * Kelime listelerini uzak bağlantıdan indirir, kullanıcı klasörüne önbelleğe alır,
    bağlantı yoksa önbellekten veya uygulamayla gelen yedek listeden yükler.
  * Arayüze parça parça kelime listesi aktarır.
  * Üretilen ses dosyalarını yerel kaydetme penceresiyle diske yazar.
"""

import base64
import os
import ssl
import sys
import threading
import unicodedata
import urllib.request

import webview

APP_NAME = "Uncipher"
CHUNK_SIZE = 40000

WORDLIST_URLS = {
    "tr": [
        "https://raw.githubusercontent.com/CanNuhlar/Turkce-Kelime-Listesi/master/turkce_kelimeler.txt",
        # Depodaki güncel dosya adı
        "https://raw.githubusercontent.com/CanNuhlar/Turkce-Kelime-Listesi/master/turkce_kelime_listesi.txt",
    ],
    "en": [
        "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
    ],
}

ALPHABET_LOWER = {
    "tr": set("abcçdefgğhıijklmnoöprsştuüvyz"),
    "en": set("abcdefghijklmnopqrstuvwxyz"),
}


def resource_path(*parts):
    """PyInstaller paketinde (_MEIPASS) ve geliştirme ortamında dosya yolu."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)


def cache_dir():
    if sys.platform == "win32":
        root = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    elif sys.platform == "darwin":
        root = os.path.expanduser("~/Library/Application Support")
    else:
        root = os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache")
    path = os.path.join(root, APP_NAME, "wordlists")
    os.makedirs(path, exist_ok=True)
    return path


def ssl_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def turkish_lower(text):
    return text.replace("I", "ı").replace("İ", "i").lower()


def normalize_words(raw, lang):
    """Satırları kelimelere ayırır, küçük harfe çevirir, alfabe dışı kelimeleri atar."""
    allowed = ALPHABET_LOWER[lang]
    words = set()
    for line in raw.splitlines():
        for token in line.replace("/", " ").replace(",", " ").split():
            if lang == "tr":
                w = turkish_lower(token)
                # şapkalı harfler: â -> a, î -> i, û -> u
                w = w.replace("â", "a").replace("î", "i").replace("û", "u")
            else:
                w = unicodedata.normalize("NFKD", token).encode("ascii", "ignore").decode().lower()
            if w and all(ch in allowed for ch in w):
                words.add(w)
    return sorted(words)


class WordlistService:
    def __init__(self):
        self.lock = threading.Lock()
        self.status = {lang: {"state": "loading", "source": None, "count": 0} for lang in WORDLIST_URLS}
        self.words = {lang: [] for lang in WORDLIST_URLS}

    def start(self):
        for lang in WORDLIST_URLS:
            threading.Thread(target=self._load, args=(lang,), daemon=True).start()

    def _download(self, lang):
        ctx = ssl_context()
        for url in WORDLIST_URLS[lang]:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": APP_NAME})
                with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                    raw = resp.read().decode("utf-8", errors="ignore")
                if len(raw) > 1000:
                    return raw
            except Exception:
                continue
        return None

    def _load(self, lang):
        cache_file = os.path.join(cache_dir(), f"{lang}.txt")
        raw, source = self._download(lang), "remote"
        if raw:
            try:
                with open(cache_file, "w", encoding="utf-8") as f:
                    f.write(raw)
            except OSError:
                pass
        elif os.path.exists(cache_file):
            with open(cache_file, encoding="utf-8") as f:
                raw, source = f.read(), "cache"
        else:
            try:
                with open(resource_path("ui", "data", f"fallback_{lang}.txt"), encoding="utf-8") as f:
                    raw, source = f.read(), "bundled"
            except OSError as exc:
                with self.lock:
                    self.status[lang] = {"state": "error", "source": None, "count": 0, "message": str(exc)}
                return
        words = normalize_words(raw, lang)
        with self.lock:
            self.words[lang] = words
            self.status[lang] = {"state": "ready", "source": source, "count": len(words)}

    def reload(self):
        with self.lock:
            for lang in self.status:
                self.status[lang] = {"state": "loading", "source": None, "count": 0}
        self.start()


wordlists = WordlistService()
main_window = None


class Api:
    """Arayüzden window.pywebview.api.* ile çağrılan yerel servisler."""

    def wordlist_status(self):
        with wordlists.lock:
            return {k: dict(v) for k, v in wordlists.status.items()}

    def get_wordlist_chunk(self, lang, index):
        with wordlists.lock:
            words = wordlists.words.get(lang, [])
        start = int(index) * CHUNK_SIZE
        chunk = words[start:start + CHUNK_SIZE]
        return {"words": "\n".join(chunk), "done": start + CHUNK_SIZE >= len(words), "total": len(words)}

    def reload_wordlists(self):
        wordlists.reload()
        return True

    def save_file(self, data_b64, filename):
        try:
            save_kind = webview.FileDialog.SAVE if hasattr(webview, "FileDialog") else webview.SAVE_DIALOG
            result = main_window.create_file_dialog(
                save_kind, save_filename=filename, file_types=("WAV (*.wav)", "Tüm dosyalar (*.*)")
            )
            if not result:
                return {"saved": False}
            path = result if isinstance(result, str) else result[0]
            with open(path, "wb") as f:
                f.write(base64.b64decode(data_b64))
            return {"saved": True, "path": path}
        except Exception as exc:
            return {"saved": False, "error": str(exc)}

    def app_info(self):
        return {"name": APP_NAME, "platform": sys.platform}


def main():
    global main_window
    wordlists.start()
    main_window = webview.create_window(
        APP_NAME,
        url=resource_path("ui", "index.html"),
        js_api=Api(),
        width=1360,
        height=880,
        min_size=(1040, 700),
        background_color="#0e0d0c",
        text_select=True,
    )
    webview.start(http_server=True, debug=False)


if __name__ == "__main__":
    main()
