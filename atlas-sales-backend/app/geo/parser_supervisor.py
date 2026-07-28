from __future__ import annotations
import atexit
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
import requests
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PARSER_DIR = _BACKEND_ROOT / "rosreestr-parser"
_process: subprocess.Popen | None = None
_lock = threading.Lock()

def _parser_dir() -> Path:
    return Path(os.getenv("ROSREESTR_PARSER_DIR", str(DEFAULT_PARSER_DIR)))

def _parser_url() -> str:
    return os.getenv("ROSREESTR_PARSER_URL", "http://127.0.0.1:8000")

def autostart_enabled() -> bool:
    return os.getenv("ROSREESTR_PARSER_AUTOSTART", "1").strip() not in (
        "0",
        "false",
        "False",
        "",
    )

def is_running(timeout: float = 1.5) -> bool:
    try:
        response = requests.get(f"{_parser_url()}/health", timeout=timeout)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def _find_python(parser_dir: Path) -> str | None:
    candidates = [
        parser_dir / ".venv" / "bin" / "python",
        parser_dir / ".venv" / "Scripts" / "python.exe",
        parser_dir / "venv" / "bin" / "python",
        parser_dir / "venv" / "Scripts" / "python.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return sys.executable

def start(logger=None) -> bool:
    global _process
    def log(level: str, message: str) -> None:
        if logger is not None:
            getattr(logger, level)(message)
        else:
            print(f"[parser] {message}")
    if not autostart_enabled():
        return False
    with _lock:
        if _process is not None and _process.poll() is None:
            return True
        if is_running():
            log("info", "Парсер уже запущен, автозапуск пропущен")
            return True
        parser_dir = _parser_dir()
        main_py = parser_dir / "main.py"
        if not main_py.exists():
            log("warning", f"Парсер не найден: {main_py}")
            return False
        python_bin = _find_python(parser_dir)
        try:
            _process = subprocess.Popen(
                [python_bin, "main.py"],
                cwd=str(parser_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                start_new_session=True,
            )
        except OSError as e:
            log("warning", f"Не удалось запустить парсер: {e}")
            return False
        log("info", f"Парсер запускается ({python_bin})…")
        deadline = time.time() + float(os.getenv("ROSREESTR_PARSER_BOOT_TIMEOUT", "45"))
        while time.time() < deadline:
            if _process.poll() is not None:
                stderr = ""
                if _process.stderr is not None:
                    stderr = _process.stderr.read().decode("utf-8", "replace")
                _process = None
                log("warning", f"Парсер завершился при старте. {stderr.strip()[:400]}")
                return False
            if is_running(timeout=1.0):
                log("info", "Парсер готов")
                return True
            time.sleep(1.0)
        log("warning", "Парсер не ответил за отведённое время, продолжаем без него")
        return False

def stop() -> None:
    global _process
    with _lock:
        if _process is None:
            return
        if _process.poll() is None:
            _process.terminate()
            try:
                _process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                _process.kill()
        _process = None

def _is_reloader_child() -> bool:
    return os.environ.get("WERKZEUG_RUN_MAIN") == "true"

def init_app(app) -> None:
    if not autostart_enabled():
        app.logger.info("Автозапуск парсера отключён (ROSREESTR_PARSER_AUTOSTART=0)")
        return
    if app.debug and not _is_reloader_child():
        return
    def _boot() -> None:
        start(logger=app.logger)
    threading.Thread(target=_boot, name="parser-autostart", daemon=True).start()
    atexit.register(stop)
