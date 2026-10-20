"""pytest 共通設定。src/memos を import できるようにする。"""

from __future__ import annotations

import sys
from pathlib import Path

_MEMOS_DIR = Path(__file__).resolve().parents[1] / "src" / "memos"
if str(_MEMOS_DIR) not in sys.path:
    sys.path.insert(0, str(_MEMOS_DIR))
