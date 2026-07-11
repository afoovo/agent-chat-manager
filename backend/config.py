import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

_defaults = {
    "db_path": None,
    "import_dir": "data/imports",
}


def load() -> dict:
    cfg = dict(_defaults)
    if os.path.isfile(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                for k in _defaults:
                    if k in loaded and loaded[k] is not None:
                        cfg[k] = loaded[k]
        except (json.JSONDecodeError, IOError):
            pass
    return cfg


def save(cfg: dict):
    to_save = {k: cfg.get(k, _defaults[k]) for k in _defaults}
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(to_save, f, ensure_ascii=False, indent=2)


def get_db_path(cfg: dict) -> str | None:
    p = cfg.get("db_path")
    if p and os.path.isfile(p):
        return p
    return None


def get_import_dir(cfg: dict) -> str:
    p = cfg.get("import_dir", _defaults["import_dir"])
    if not os.path.isabs(p):
        p = os.path.join(BASE_DIR, p)
    return os.path.normpath(p)
