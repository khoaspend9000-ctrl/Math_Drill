# test_import.py — Chạy file này để tìm lỗi import
# Đặt vào thư mục D:\lam_game_2026\ và chạy:
#   python test_import.py
import sys
import traceback

def ck(msg):
    print(msg, flush=True)

ck("=== TEST IMPORT ===")

# Test từng module
modules = [
    ("pygame", "import pygame"),
    ("game_init", "import game_init"),
    ("player", "from player import PlayerData"),
    ("game_manager", "from game_manager import GameManager"),
    ("audio", "from audio import init_audio, get_sound_manager"),
    ("utils.logger", "from utils.logger import init_logger"),
    ("data_manager", "from data_manager import LessonData"),
    ("smart_ai", "from smart_ai import SmartAI"),
    ("game_content_loader", "from game_content_loader import load_daily_rewards"),
    ("performance_utils", "from performance_utils import ParticleBudget"),
    ("ui.shop_enhanced", "from ui.shop_enhanced import collect_shop_catalog"),
    ("effects", "from effects import ConfettiSystem"),
]

for name, stmt in modules:
    try:
        exec(stmt)
        ck(f"  OK: {name}")
    except Exception as e:
        ck(f"  FAIL: {name}")
        ck(f"    Error: {e}")
        ck(f"    Traceback:\n{traceback.format_exc()}")
        break

ck("=== DONE ===")
