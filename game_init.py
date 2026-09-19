# =========================================================
# game_init.py – PHẦN 1: Khởi Tạo Hệ Thống & Infrastructure
# =========================================================
# Chứa:
#   • Import thư viện + pygame init + màu sắc + màn hình
#   • Helper functions (XP, gold, combo…)
#   • Tất cả Systems (AI, Gacha, Account, Pet, Skin…)
#   • Font / Text rendering / Draw utilities
#   • UI Widgets (Button, CardButton, InputBox…)
#   • Particle systems + Effects (Transition, ComboPopup…)
#   • Layout/HUD helpers (draw_top_bar, daily rewards…)
#   • AccountSystem + session helpers (save/load session, daily flags)
#
# Chạy game: python game_main.py
# =========================================================

# =========================================================
# MATHDRILL 5.0 - THE ULTIMATE EDITION
# (UI 3.0 + SMART AI + TIME ATTACK + ACHIEVEMENTS + ADAPTIVE AI)
# =========================================================
# -*- coding: utf-8 -*-
# pylint: disable=line-too-long
import pygame
def _ck(msg):
    """Ghi mốc debug ra CẢ print() (terminal nhúng nếu có) LẪN console.log()
    của trình duyệt qua cầu nối JS của Pyodide (chắc chắn hiện ở F12 Console)."""
    print(msg, flush=True)
    try:
        import js
        js.console.log(msg)
    except Exception:
        pass
_ck("MD_CHECKPOINT: 01 pygame imported")
try:
    import pygame.threads
except ModuleNotFoundError:
    pass
import asyncio
import webbrowser
import sys
import os
# pygbag (đóng gói pygame chạy trên web qua WebAssembly/Pyodide) đặt sys.platform
# thành "emscripten" khi chạy trong trình duyệt. Dùng cờ này để ẩn các tính năng
# không thể hoạt động trên web (hộp thoại chọn file của tkinter, TTS đọc to bằng
# thư viện hệ điều hành...) thay vì để chúng crash hoặc im lặng không phản hồi.
def _detect_web_build():
    """
    Phát hiện môi trường Web (Pygbag/Pyodide) chuẩn xác nhất qua nhiều lớp.
    """
    # 1. Kiểm tra sys.platform tiêu chuẩn của WASM
    if sys.platform in ("emscripten", "wasi", "web"):
        return True
        
    # 2. Kiểm tra kiến trúc CPU qua os.uname() (bắt các bản build đặc thù)
    try:
        if "wasm" in os.uname().machine.lower():
            return True
    except (AttributeError, Exception):
        pass
        
    # 3. Kiểm tra biến môi trường do pygbag/pyodide inject
    if os.environ.get("PYGBAG") == "1" or os.environ.get("PYODIDE") == "1":
        return True
        
    # 4. Kiểm tra các module chỉ tồn tại trên trình duyệt
    try:
        import js  # noqa: F401
        return True
    except ImportError:
        pass
    try:
        import pyodide # noqa: F401
        return True
    except ImportError:
        pass
        
    # 5. Kiểm tra sys.modules (Pygbag thường nạp aio.browser)
    if "pygbag" in sys.modules or "aio.browser" in sys.modules:
        return True
        
    return False

IS_WEB_BUILD = _detect_web_build()
_ck(f"MD_CHECKPOINT: 13b IS_WEB_BUILD={IS_WEB_BUILD} sys.platform={sys.platform!r}")
import os
import json
import random
import time
import math
import datetime
try:
    import shutil
except ImportError:
    shutil = None
try:
    import ctypes
except ImportError:
    ctypes = None
import logging
import re
import hashlib
import secrets
try:
    import sqlite3
except ImportError:
    sqlite3 = None
try:
    import threading
except ImportError:
    threading = None
from typing import Any
_ck("MD_CHECKPOINT: 02 stdlib imports done")
# Import new modular components
from player import PlayerData
_ck("MD_CHECKPOINT: 03 player imported")
from game_manager import GameManager
_ck("MD_CHECKPOINT: 04 game_manager imported")
from audio import init_audio, get_sound_manager, cleanup_audio
_ck("MD_CHECKPOINT: 05 audio imported")
from utils.logger import init_logger, get_logger, log_error, log_info
_ck("MD_CHECKPOINT: 06 utils.logger imported")
try:
    base_path = os.path.dirname(__file__)
except NameError:
    base_path = os.getcwd()
font_path = os.path.join(base_path, "Quicksand-Bold.ttf")
SEGOE_EMOJI_TTF = os.path.join(base_path, "Segoe UI Emoji.TTF")
if not os.path.exists(font_path):
    print(f"CẢNH BÁO: Không tìm thấy file tại {font_path}. Game đang dùng phông mặc định!")
if not os.path.exists(SEGOE_EMOJI_TTF):
    print(f"CẢNH BÁO: Không tìm thấy {SEGOE_EMOJI_TTF}. Icon/emoji có thể hiển thị sai!")
# Fix blurry text on high DPI Windows displays
# Fix blurry text on high DPI Windows displays
try:
    if ctypes:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
except (AttributeError, OSError):
    pass
# Enhanced SDL render quality for better anti-aliasing
# Chất lượng lọc khi scale render của SDL: '0'=nearest (nhanh nhất, thô nhất),
# '1'=linear (cân bằng tốc độ/chất lượng — phù hợp GPU tích hợp cũ ở phòng lab),
# '2'=best/anisotropic (đẹp nhất nhưng có thể làm giật máy yếu).
# TRƯỚC ĐÂY bị ép cứng '2' cho mọi máy — giờ mặc định '1' (nhẹ hơn, vẫn mượt), và có
# thể chỉnh trong "Cài đặt" hoặc ghi đè bằng biến môi trường MATHDRILL_RENDER_QUALITY.
def is_young_learner(grade):
    """
    Học sinh lớp 1-2 chưa đọc thạo và dễ bị quá tải nhận thức (cognitive overload)
    bởi các tính năng phức tạp (Gacha, Cây Kỹ Năng...). Dùng để đơn giản hoá giao
    diện và tạm khoá các tính năng nâng cao cho đến khi lên lớp 3.
    """
    try:
        return int(grade or 1) <= 2
    except (TypeError, ValueError):
        return False

# =========================================================
# HỖ TRỢ ĐỌC (TEXT-TO-SPEECH) — học sinh lớp 1-2 chưa đọc thạo nên việc đọc to
# câu hỏi/giải thích là một điểm cộng lớn về giáo dục hòa nhập (Accessibility).
# Dùng pyttsx3 (chạy OFFLINE, không cần Internet — phù hợp phòng máy trường học
# không đảm bảo có mạng). Nếu máy không cài pyttsx3 hoặc không có driver giọng
# đọc, hệ thống BỎ QUA LẶNG LẼ — nút đọc to sẽ tự ẩn, không làm crash game.
# =========================================================
_tts_engine = None
_tts_available = None
# BUG FIX (pygbag): không tạo Lock trên web vì threading.Lock trong Pyodide
# có thể gây lỗi — TTS vốn đã bị tắt trên web nên lock không cần thiết.
_tts_lock = (threading.Lock() if threading else None) if not IS_WEB_BUILD else None

def tts_is_available():
    """Kiểm tra (và cache) xem máy này có hỗ trợ đọc to hay không."""
    global _tts_engine, _tts_available
    if IS_WEB_BUILD:
        # pyttsx3 dùng thư viện giọng đọc của hệ điều hành — không thể chạy
        # trong trình duyệt/WebAssembly. Tắt hẳn thay vì tốn công thử import.
        return False
    if _tts_available is not None:
        return _tts_available
    try:
        import pyttsx3
        _tts_engine = pyttsx3.init()
        _tts_engine.setProperty('rate', 150)
        _tts_available = True
    except Exception as e:
        logger.info(f"TTS (pyttsx3) không khả dụng trên máy này — ẩn nút đọc to: {e}")
        _tts_available = False
    return _tts_available

def speak_text(text):
    """Đọc to một đoạn văn bản (câu hỏi/giải thích) cho học sinh nghe. An toàn:
    nếu TTS không khả dụng hoặc đang đọc dở câu trước, sẽ bỏ qua lặng lẽ thay vì
    làm treo/crash game. Chạy trên luồng riêng để không đứng hình khung hình."""
    if not tts_is_available():
        return False
    # BUG FIX (pygbag): _tts_lock là None trên web — kiểm tra trước khi gọi .locked()
    if _tts_lock is None:
        return False
    if _tts_lock.locked():
        return False  # Đang đọc câu trước — tránh chồng chéo giọng đọc
    def _run():
        with _tts_lock:
            try:
                _tts_engine.say(text)
                _tts_engine.runAndWait()
            except Exception as e:
                logger.warning(f"Lỗi khi đọc to văn bản: {e}")
    if threading:
        threading.Thread(target=_run, daemon=True).start()
    else:
        _run()
    return True

GLOBAL_RENDER_QUALITY = os.environ.get("MATHDRILL_RENDER_QUALITY", "1")
if not IS_WEB_BUILD:
    os.environ['SDL_RENDER_SCALE_QUALITY'] = GLOBAL_RENDER_QUALITY
# BUG FIX (pygbag): dòng set_env vô điều kiện cũ ở đây đã bị xoá.
# Chỉ đặt biến môi trường SDL khi không chạy trên web (đã làm ở trên).
from data_manager import LessonData, get_lessons_for_grade, theory_data
_ck("MD_CHECKPOINT: 07 data_manager imported")
from smart_ai import SmartAI
_ck("MD_CHECKPOINT: 08 smart_ai imported")
from game_content_loader import (
    load_achievements, load_pets, load_skins, load_skills, load_gacha_cards,
    get_daily_reward_for_streak, load_daily_rewards,
)
_ck("MD_CHECKPOINT: 09 game_content_loader imported")
from performance_utils import GLOBAL_MAX_PARTICLES, ParticleBudget, ui_surface_cache
_ck("MD_CHECKPOINT: 10 performance_utils imported")
from ui.shop_enhanced import collect_shop_catalog, filter_shop_items
_ck("MD_CHECKPOINT: 11 ui.shop_enhanced imported")
import pygame.gfxdraw  # For anti-aliased drawing functions
_ck("MD_CHECKPOINT: 12 pygame.gfxdraw imported")
# =========================================================
# SCREEN & COLORS — khai báo stub, khởi tạo thật trong init_display()
# pygame.init() + display.set_mode() BẮT BUỘC phải nằm trong async coroutine
# trên pygbag — gọi ở module-level sẽ treo vô thời hạn vì SDL2 cần canvas
# của trình duyệt đã sẵn sàng (chỉ có sau khi event loop bắt đầu chạy).
# =========================================================
confetti_sys: Any = None
virtual_mouse_pos: tuple[int, int] = (0, 0)
WIDTH, HEIGHT = 1300, 800
screen = None
clock  = None
_ck("MD_CHECKPOINT: 13 module-level OK — display deferred to init_display()")

async def init_display():
    """Gọi MỘT LẦN từ async main() ngay khi coroutine bắt đầu.
    Khởi tạo pygame, màn hình, clock, fonts, images — tất cả các thứ cần SDL.
    PHẢI là async vì pygbag yêu cầu ít nhất một await trước display.set_mode()
    để canvas trình duyệt kịp chuẩn bị."""
    global screen, clock, darkness_surface
    global font_big, font_med, font_small
    global clover_image, background_img, defeat_bg_img
    global DEFAULT_CHARACTER_IMG, character_img
    global icon_img, setting_img, setting_rect, img_vic_text
    if IS_WEB_BUILD:
        _ck("MD_CHECKPOINT: 13.0 waiting 3s real-time before first pygame.init()...")
        for _i in range(30):
            await asyncio.sleep(0.1)
    pygame.init()
    _ck(f"MD_CHECKPOINT: 13.1 pygame.init() done, display.get_init={pygame.display.get_init()}")
    await asyncio.sleep(0)
    try:
        if IS_WEB_BUILD:
            s = pygame.display.set_mode((WIDTH, HEIGHT))
        else:
            try:
                s = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE | pygame.SCALED)
            except pygame.error:
                s = pygame.display.set_mode((WIDTH, HEIGHT))
        screen = s
        pygame.display.set_caption("MathDrill 5.0")
        clock = pygame.time.Clock()
        _ck("MD_CHECKPOINT: 14 display.set_mode done")
    except Exception as _err:
        _ck(f"MD_CHECKPOINT: 14-ERROR: {_err}")
        raise
    # darkness_surface
    darkness_surface = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    darkness_surface.fill((0, 0, 0))
    # Fonts
    font_big   = load_font(50)
    font_med   = load_font(28)
    font_small = load_font(20)
    # Images
    clover_image = load_image("pixel_clover.png", (50, 50))
    if not clover_image:
        _ci = pygame.Surface((32, 32), pygame.SRCALPHA)
        pygame.draw.circle(_ci, (100, 220, 120), (16, 16), 16)
        clover_image = _ci
    background_img     = load_image("backround1.jpg", (WIDTH, HEIGHT))
    defeat_bg_img      = load_image("defeat.jpg",     (WIDTH, HEIGHT))
    DEFAULT_CHARACTER_IMG = load_image("main_character.png", (600, 600))
    character_img      = DEFAULT_CHARACTER_IMG
    icon_img           = load_image("Untitled_design.png")
    img_vic_text       = load_image("victory_text.png")
    _si_path = os.path.join(base_path, "setting.png")
    if os.path.exists(_si_path):
        setting_img = pygame.image.load(_si_path).convert_alpha()
    else:
        setting_img = pygame.Surface((50, 40), pygame.SRCALPHA)
    setting_img = pygame.transform.smoothscale(setting_img, (50, 40))
    setting_rect = setting_img.get_rect()
    setting_rect.topright = (WIDTH - 20, 60)
    if icon_img:
        pygame.display.set_icon(icon_img)
    _ck("MD_CHECKPOINT: 14b init_display() complete")
    return screen, clock
WHITE = (220, 220, 215); BLACK = (0,0,0); SHADOW = (120,120,120)
BLUE_BTN = (110, 150, 190); GREEN_BTN = (120, 180, 140); PURPLE_BTN = (160, 135, 180)
ORANGE_BTN = (200, 160, 120); YELLOW_BTN = (200, 180, 100); RED_BTN = (190, 110, 110)
ADMIN_USER = "admin"
darkness_surface = None  # tạo trong init_display()
# Mật khẩu admin mặc định KHÔNG còn hardcode dưới dạng văn bản thuần trong mã nguồn.
# Giáo viên/quản trị viên nên đặt biến môi trường MATHDRILL_ADMIN_PASSWORD trước khi
# chạy game lần đầu để tự chọn mật khẩu riêng; nếu không đặt, sẽ dùng giá trị mặc định
# (chỉ áp dụng cho lần khởi tạo tài khoản admin đầu tiên — sau đó chỉ có bản mã hoá
# (hash) được lưu lại trong file dữ liệu, không lưu văn bản thuần).
ADMIN_PASS = os.environ.get("MATHDRILL_ADMIN_PASSWORD", "admin123")

def hash_password(password, salt=None):
    """Băm mật khẩu bằng PBKDF2-HMAC-SHA256 (100.000 vòng lặp) kèm salt ngẫu nhiên.
    Không bao giờ lưu mật khẩu dạng văn bản thuần vào file dữ liệu người dùng."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2$sha256$100000${salt}${digest.hex()}"

def verify_password(password, stored):
    """So sánh mật khẩu nhập vào với bản băm đã lưu (an toàn trước timing-attack)."""
    try:
        algo, hashname, iterations, salt, hexdigest = stored.split("$")
        iterations = int(iterations)
        digest = hashlib.pbkdf2_hmac(hashname, password.encode("utf-8"), salt.encode("utf-8"), iterations)
        return secrets.compare_digest(digest.hex(), hexdigest)
    except (ValueError, AttributeError, TypeError):
        return False

def is_password_hashed(stored):
    return isinstance(stored, str) and stored.startswith("pbkdf2$")

GLOBAL_BRIGHTNESS = 1.0
GLOBAL_VOLUME = 1.0
GLOBAL_FULLSCREEN = False
achievement_popup = None
# Pre-calculated constants for optimization
SCREEN_DIAGONAL = math.sqrt((WIDTH // 2) ** 2 + (HEIGHT // 2) ** 2)
# =========================================================
# MANAGER OBJECTS - Using imported modules
# =========================================================
# Initialize global manager instances using imported modules
player = PlayerData()
game_manager = GameManager(WIDTH, HEIGHT)
# Initialize logging system
# BUG FIX (pygbag): init_logger ghi file game.log — trên web hệ thống file ảo
# có thể không hỗ trợ ghi file, gây crash. Dùng log_file=None trên web để chỉ
# ghi ra stdout (print), không tạo file.
logger = init_logger(log_file=None if IS_WEB_BUILD else "game.log")
_ck("MD_CHECKPOINT: 15 logger initialized")
# audio được init bởi init_audio_system() từ async main()
def get_required_exp(level):
    """Tính lượng EXP cần thiết để lên cấp tiếp theo một cách an toàn"""
    if level >= 1000: # Cấp độ Admin hoặc cực cao
        return 1000000
    # Công thức tăng trưởng: 100, 120, 144, ... nhưng giới hạn ở cấp 50
    # Sau đó tăng tuyến tính để tránh tràn số (Overflow)
    if level <= 50:
        return int(100 * (1.15 ** (level - 1)))
    else:
        base_50 = int(100 * (1.15 ** 49))
        return base_50 + (level - 50) * 500
def add_xp(amount):
    """Add XP using new manager system"""
    player.add_exp(amount, account_system, snd_levelup)
    account_system.save()
def add_gold(amount):
    """Add gold using new Manager system"""
    player.add_gold(amount, account_system)
    account_system.save()
    return player.gold
def reward_gold_for_result(mode_key, score, accuracy=0):
    """Tính thưởng vàng theo mode và điểm."""
    mode_bonus = {
        "lesson": 20,
        "time_attack": 25,
        "daily": 18,
        "mock_exam": 30,
        "achievement": 12,
        "other": 10,
    }
    base = mode_bonus.get(mode_key, mode_bonus["other"])
    score_part = max(0, int(score)) // 2
    acc_part = int(max(0, accuracy) // 10)
    total = base + score_part + acc_part
    add_gold(total)
    return total
def update_combo(is_correct, silent=False):
    """Update combo using new manager system"""
    # Get skill bonuses
    skill_bonuses = account_system.get_skill_bonuses()
    combo_bonus_threshold = skill_bonuses.get("combo_bonus", 0)
    if is_correct:
        player.increment_combo()
        if account_system.current_user:
            d = account_system.data()
            d["best_combo"] = max(int(d.get("best_combo", 0)), player.combo_streak)
        # Enhanced combo thresholds with skill bonuses
        effective_threshold_3 = max(0, 3 - combo_bonus_threshold)
        effective_threshold_5 = max(0, 5 - combo_bonus_threshold)
        effective_threshold_10 = max(0, 10 - combo_bonus_threshold)
        if player.combo_streak >= effective_threshold_10:
            player.combo_multiplier = 4.0  # Increased max multiplier
            trigger_shake(4, 0.3)  # Stronger shake for high combo (bị bỏ qua nếu REDUCE_MOTION)
        elif player.combo_streak >= effective_threshold_5:
            player.combo_multiplier = 3.0
            trigger_shake(3, 0.2)
        elif player.combo_streak >= effective_threshold_3:
            player.combo_multiplier = 2.0
            trigger_shake(2, 0.15)
        else:
            player.combo_multiplier = 1.5  # Start with 1.5x instead of 1.0x
        
        # Play combo sound based on tier
        if not silent:
            sound_mgr = get_sound_manager()
            if sound_mgr:
                sound_mgr.play_combo_sound(player.combo_streak)
    else:
        player.reset_combo()
def get_combo_color():
    """Get color based on combo level"""
    if player.combo_streak >= 10: return (255, 50, 50)      # Red for insane combo
    elif player.combo_streak >= 7: return (255, 150, 50)     # Orange for high combo
    elif player.combo_streak >= 5: return (255, 200, 50)     # Yellow for good combo
    elif player.combo_streak >= 3: return (100, 200, 255)   # Blue for combo
    else: return (200, 200, 200)                     # Gray for no combo
def get_combo_text():
    """Get combo text with style"""
    if player.combo_streak >= 20: return "🔥🔥🔥 INSANE COMBO! 🔥🔥🔥"
    elif player.combo_streak >= 15: return "⚡⚡ MEGA COMBO! ⚡⚡"
    elif player.combo_streak >= 10: return "💥💥 SUPER COMBO! 💥💥"
    elif player.combo_streak >= 7: return "🔥🔥 HIGH COMBO! 🔥🔥"
    elif player.combo_streak >= 5: return "⚡ GREAT COMBO! ⚡"
    elif player.combo_streak >= 3: return "✨ COMBO! ✨"
    else: return ""
def sync_player_stats():
    """Sync player data with AccountSystem using new manager"""
    if account_system.current_user:
        d = account_system.data()
        player.load_save_data(d)
# Accessibility: học sinh tiểu học, đặc biệt em nào nhạy cảm thị giác
# (rối loạn tiền đình, chóng mặt...) không nên bị rung màn hình.
# Mặc định TẮT hiệu ứng rung để đáp ứng chuẩn Accessibility cho phần mềm giáo dục.
# Có thể bật lại trong "Cài đặt" nếu phụ huynh/giáo viên xác nhận là an toàn.
REDUCE_MOTION = True
def trigger_shake(intensity, duration=0.3):
    """Trigger screen shake using new manager system.
    Tôn trọng cờ REDUCE_MOTION: nếu bật (mặc định), hiệu ứng rung sẽ bị bỏ qua
    hoàn toàn để tránh gây khó chịu/chóng mặt cho học sinh nhỏ tuổi."""
    if REDUCE_MOTION:
        return
    player.trigger_screen_shake(intensity, duration)
# =========================================================
# ADAPTIVE AI SYSTEM
# =========================================================
class AdaptiveDifficulty:
    """Hệ thống AI thích ứng nâng cao - Phân tích học tập và điều chỉnh độ khó thông minh"""
    def __init__(self):
        self.difficulty = 1  # 1=dễ, 2=trung bình, 3=khó, 4=rất khó, 5=siêu khó
        self.correct_streak = 0
        self.wrong_streak = 0
        self.total_correct = 0
        self.total_wrong = 0
        self.answer_times = []  # Thời gian trả lời (giây)
        self.last_answer_time = 0
        self.question_start_time = 0
        self._answers_since_adjust = 0
        # Enhanced analytics
        self.topic_performance = {}  # topic_id -> {"correct": int, "total": int, "avg_time": float}
        self.question_type_performance = {}  # type -> {"correct": int, "total": int}
        self.session_start_time = time.time()
        self.difficulty_history = []  # Track difficulty changes over time
        self.adjustment_reason = ""  # Why difficulty was adjusted
        # Learning patterns
        self.learning_rate = 0.0  # How quickly player is improving
        self.consistency_score = 0.0  # How consistent performance is
        self.struggle_topics = []  # Topics player struggles with
        self.mastery_topics = []  # Topics player has mastered
    def start_question(self):
        """Gọi khi bắt đầu câu hỏi mới"""
        self.question_start_time = time.time()
    def record_answer(self, is_correct, topic_id=None, question_type=None):
        """Ghi nhận kết quả trả lời và điều chỉnh độ khó nâng cao"""
        self.last_answer_time = time.time() - self.question_start_time
        self.answer_times.append(self.last_answer_time)
        self._answers_since_adjust += 1
        if is_correct:
            self.correct_streak += 1
            self.wrong_streak = 0
            self.total_correct += 1
        else:
            self.wrong_streak += 1
            self.correct_streak = 0
            self.total_wrong += 1
        # Track topic and question type performance
        if topic_id:
            if topic_id not in self.topic_performance:
                self.topic_performance[topic_id] = {"correct": 0, "total": 0, "avg_time": 0.0, "times": []}
            perf = self.topic_performance[topic_id]
            perf["total"] += 1
            if is_correct:
                perf["correct"] += 1
            perf["times"].append(self.last_answer_time)
            perf["avg_time"] = sum(perf["times"][-10:]) / len(perf["times"][-10:])  # Last 10 answers
        if question_type:
            if question_type not in self.question_type_performance:
                self.question_type_performance[question_type] = {"correct": 0, "total": 0}
            qt_perf = self.question_type_performance[question_type]
            qt_perf["total"] += 1
            if is_correct:
                qt_perf["correct"] += 1
        # Enhanced difficulty adjustment logic (increased from 3 to 5 for smoother transitions)
        if self._answers_since_adjust >= 5:  # More data points for better decisions
            old_difficulty = self.difficulty
            self._adjust_difficulty_smart()
            if old_difficulty != self.difficulty:
                self.difficulty_history.append({
                    "time": time.time(),
                    "from": old_difficulty,
                    "to": self.difficulty,
                    "reason": self.adjustment_reason
                })
                self._answers_since_adjust = 0
                self.correct_streak = 0
                self.wrong_streak = 0
        # Update learning analytics
        self._update_learning_patterns()
    def _adjust_difficulty_smart(self):
        """Intelligent difficulty adjustment based on multiple factors (smoothed with response time weighting)"""
        accuracy = self.total_correct / max(1, self.total_correct + self.total_wrong)
        avg_response_time = self.avg_time()
        # Calculate performance score (0-100)
        performance_score = accuracy * 60  # 60% weight on accuracy
        if avg_response_time > 0:
            # Faster responses = higher score (max 40 points), normalized by difficulty
            # Higher difficulty questions should allow more time
            difficulty_time_factor = 2.0 + (self.difficulty - 1) * 1.5
            time_score = max(0, 40 - (avg_response_time / difficulty_time_factor * 8))
            performance_score += time_score
        # Get skill bonuses
        skill_bonuses = account_system.get_skill_bonuses()
        # Advanced difficulty adjustment rules with smoother transitions
        if performance_score >= 85 and self.correct_streak >= 5:  # Increased streak requirement
            # Excellent performance - increase difficulty (smoothly with 0.5 increments)
            if self.difficulty < 5:
                self.difficulty = min(5, self.difficulty + 0.5)  # Smooth increment
                self.adjustment_reason = "Xuất sắc + Chuỗi đúng (↑0.5)"
        elif performance_score >= 70 and self.correct_streak >= 7:  # Increased streak requirement
            # Good performance with consistency
            if self.difficulty < 4:
                self.difficulty = min(4, self.difficulty + 0.5)  # Smooth increment
                self.adjustment_reason = "Tốt + Nhất quán (↑0.5)"
        elif performance_score <= 30 or self.wrong_streak >= 5:  # Increased wrong streak threshold
            # Poor performance - decrease difficulty smoothly
            if self.difficulty > 1:
                self.difficulty = max(1, self.difficulty - 0.5)  # Smooth decrement
                self.adjustment_reason = "Kém + Chuỗi sai (↓0.5)"
        elif performance_score <= 45 and avg_response_time > 8:
            # Slow responses - might need easier questions
            if self.difficulty > 1:
                self.difficulty = max(1, self.difficulty - 0.5)  # Smooth decrement
                self.adjustment_reason = "Chậm + Kém (↓0.5)"
        # Consider struggling topics
        if len(self.struggle_topics) >= 2 and self.difficulty > 2:
            self.difficulty = max(2, self.difficulty - 0.5)  # Smooth decrement
            self.adjustment_reason = "Nhiều chủ đề yếu (↓0.5)"
    def _update_learning_patterns(self):
        """Update learning analytics and patterns"""
        # Calculate learning rate (improvement over time)
        if len(self.answer_times) >= 10:
            recent_times = self.answer_times[-5:]
            older_times = self.answer_times[-10:-5]
            if older_times:
                recent_avg = sum(recent_times) / len(recent_times)
                older_avg = sum(older_times) / len(older_times)
                self.learning_rate = (older_avg - recent_avg) / older_avg if older_avg > 0 else 0
        # Calculate consistency score
        if len(self.answer_times) >= 5:
            recent_times = self.answer_times[-5:]
            avg_time = sum(recent_times) / len(recent_times)
            variance = sum((t - avg_time) ** 2 for t in recent_times) / len(recent_times)
            self.consistency_score = max(0, 1 - (variance / (avg_time ** 2)) if avg_time > 0 else 0)
        # Identify struggling and mastery topics
        self.struggle_topics = []
        self.mastery_topics = []
        for topic_id, perf in self.topic_performance.items():
            if perf["total"] >= 3:  # Enough data
                accuracy = perf["correct"] / perf["total"]
                if accuracy < 0.4:
                    self.struggle_topics.append(topic_id)
                elif accuracy > 0.8 and perf["avg_time"] < 5:
                    self.mastery_topics.append(topic_id)
    def get_recommended_focus_areas(self):
        """Get areas where player should focus"""
        recommendations = []
        # Focus on struggling topics
        for topic_id in self.struggle_topics[:3]:  # Top 3 struggling areas
            recommendations.append({
                "type": "practice",
                "topic": topic_id,
                "reason": "Cần cải thiện độ chính xác",
                "priority": "high"
            })
        # Speed improvement if slow
        if self.avg_time() > 6:
            recommendations.append({
                "type": "speed",
                "reason": "Cần trả lời nhanh hơn",
                "priority": "medium"
            })
        # Advanced topics if mastered basics
        if len(self.mastery_topics) >= 3 and self.difficulty < 4:
            recommendations.append({
                "type": "challenge",
                "reason": "Sẵn sàng cho thử thách khó hơn",
                "priority": "low"
            })
        return recommendations
    def get_learning_summary(self):
        """Get comprehensive learning analytics summary"""
        total_questions = self.total_correct + self.total_wrong
        accuracy = (self.total_correct / total_questions * 100) if total_questions > 0 else 0
        return {
            "accuracy": round(accuracy, 1),
            "avg_response_time": round(self.avg_time(), 1),
            "difficulty_level": self.difficulty,
            "learning_rate": round(self.learning_rate * 100, 1),
            "consistency": round(self.consistency_score * 100, 1),
            "struggle_topics_count": len(self.struggle_topics),
            "mastery_topics_count": len(self.mastery_topics),
            "session_duration": round(time.time() - self.session_start_time, 1),
            "adjustments_made": len(self.difficulty_history)
        }
    def avg_time(self):
        """Tính thời gian trả lời trung bình"""
        if not self.answer_times:
            return 5.0
        recent = self.answer_times[-5:]  # 5 câu gần nhất
        return sum(recent) / len(recent)
    def get_number_range(self, base_min, base_max):
        """Trả về khoảng số dựa trên độ khó"""
        multiplier = 1 + (self.difficulty - 1) * 0.5
        return int(base_min * multiplier), int(base_max * multiplier)
    def get_difficulty_label(self):
        """Trả về tên mức độ khó"""
        labels = {1: "Dễ", 2: "Trung bình", 3: "Khó", 4: "Rất khó", 5: "Siêu khó"}
        return labels.get(int(self.difficulty), "Trung bình")
    def get_difficulty_color(self):
        """Trả về màu tương ứng với mức độ khó"""
        colors = {1: (100, 200, 100), 2: (100, 180, 220), 3: (220, 180, 50), 4: (220, 130, 50), 5: (220, 80, 80)}
        return colors.get(int(self.difficulty), (200, 200, 200))
    def reset(self):
        """Reset lại hệ thống"""
        self.__init__()
# Instance toàn cục cho Adaptive AI
adaptive_ai = AdaptiveDifficulty()
# =========================================================
# ACHIEVEMENT SYSTEM
# =========================================================
ACHIEVEMENTS_DEF = load_achievements()
class AchievementPopup:
    """Popup hiệu ứng khi mở khóa achievement"""
    def __init__(self, achievement_key):
        ach = ACHIEVEMENTS_DEF.get(achievement_key, {})
        self.name = ach.get("name", "Achievement")
        self.desc = ach.get("desc", "")
        self.icon = ach.get("icon", "🏆")
        self.xp_reward = ach.get("xp", 0)
        self.timer = 0
        self.duration = 4.0  # Hiển thị 4 giây
        self.alpha = 0
        self.y_offset = 50  # Bắt đầu từ trên rơi xuống
        self.active = True
        self.particles = []
        self.popup_w, self.popup_h = 420, 100
        # Pre-render static popup background surface (optimization: avoid copying in draw loop)
        self._popup_bg_cached = None
        # Pre-create particle surfaces (performance optimization: avoid creating Surface in draw loop)
        self._particle_surfaces_cache = {}  # {(size, color_alpha): surface}
        
        # Tạo particles hiệu ứng (giới hạn global budget)
        for _ in range(ParticleBudget.request(8)):
            self.particles.append({
                "x": random.uniform(-80, 80),
                "y": random.uniform(-30, 30),
                "vx": random.uniform(-2, 2),
                "vy": random.uniform(-3, -0.5),
                "size": random.randint(3, 8),
                "color": random.choice([(200, 170, 80), (200, 160, 40), (200, 190, 90), (200, 140, 60)]),
                "life": random.uniform(0.5, 2.0),
                "active": True  # Object pool: track if particle is reusable
            })
        # Pre-render static text content to avoid font rendering per frame
        self._render_static_content()
    def update(self, dt):
        self.timer += dt
        # Fade in
        if self.timer < 0.5:
            self.alpha = min(255, int(self.timer * 510))
            self.y_offset = max(0, 50 - self.timer * 100)
        # Hiển thị
        elif self.timer < self.duration - 0.8:
            self.alpha = 255
            self.y_offset = 0
        # Fade out
        else:
            fade_progress = (self.timer - (self.duration - 0.8)) / 0.8
            self.alpha = max(0, int(255 * (1 - fade_progress)))
            self.y_offset = -30 * fade_progress
        # Cập nhật particles
        for p in self.particles:
            p["x"] += p["vx"]
            p["y"] += p["vy"]
            p["life"] -= dt
            if p["life"] <= 0:
                p["active"] = False  # Mark for reuse in object pool
        if self.timer >= self.duration:
            self.active = False
    def _render_static_content(self):
        """Pre-render static text elements to avoid per-frame font rendering"""
        icon_font = load_icon_font(36)
        self.icon_surf = render_cached_text(icon_font, self.icon, (255, 255, 255), supersample=False, _skip_emoji_check=True)
        name_font = load_font(22)
        self.name_surf = name_font.render(self.name, True, (200, 170, 80))
        desc_font = load_font(16)
        self.desc_surf = desc_font.render(self.desc, True, (200, 200, 200))
        self.xp_surf = desc_font.render(f"+{self.xp_reward} XP", True, (100, 255, 100))
    def draw(self, surface):
        if not self.active or self.alpha <= 0:
            return
        popup_x = WIDTH // 2 - self.popup_w // 2
        popup_y = int(30 + self.y_offset)

        # Dựng surface popup CHỈ MỘT LẦN DUY NHẤT trong toàn bộ vòng đời popup (4 giây),
        # thay vì mỗi khi self.alpha thay đổi — trước đây trong 2 pha fade-in/fade-out
        # (~1.3 giây, ~78 khung hình ở 60fps) surface bị vẽ lại (rect + text) MỖI KHUNG
        # HÌNH vì self._cached_alpha != alpha gần như luôn đúng khi đang fade. Độ mờ
        # tổng thể giờ chỉ cần set_alpha() trên surface đã dựng sẵn — một thao tác rẻ,
        # không cần vẽ lại pixel.
        if self._popup_bg_cached is None:
            popup_surf = pygame.Surface((self.popup_w, self.popup_h), pygame.SRCALPHA)
            pygame.draw.rect(popup_surf, (40, 40, 60, 230), (0, 0, self.popup_w, self.popup_h), border_radius=15)
            pygame.draw.rect(popup_surf, (200, 170, 80, 255), (0, 0, self.popup_w, self.popup_h), 3, border_radius=15)
            popup_surf.blit(self.icon_surf, (15, self.popup_h // 2 - self.icon_surf.get_height() // 2))
            popup_surf.blit(self.name_surf, (65, 15))
            popup_surf.blit(self.desc_surf, (65, 45))
            popup_surf.blit(self.xp_surf, (65, 70))
            self._popup_bg_cached = popup_surf

        popup_surf = self._popup_bg_cached
        popup_surf.set_alpha(self.alpha)
        surface.blit(popup_surf, (popup_x, popup_y))
        # Vẽ particles xung quanh popup (reuse pre-created surfaces)
        for p in self.particles:
            if p["life"] > 0:
                px = popup_x + self.popup_w // 2 + int(p["x"])
                py = popup_y + self.popup_h // 2 + int(p["y"])
                alpha_p = max(0, min(255, int(255 * (p["life"] / 2.0) * (self.alpha / 255))))
                if alpha_p > 0:
                    # Get or create cached particle surface (size-based)
                    size_key = p["size"]
                    if size_key not in self._particle_surfaces_cache:
                        # Create particle surface once and cache it
                        particle_surf = pygame.Surface((p["size"] * 2, p["size"] * 2), pygame.SRCALPHA)
                        pygame.draw.circle(particle_surf, p["color"] + (255,), (p["size"], p["size"]), p["size"])
                        self._particle_surfaces_cache[size_key] = particle_surf
                    
                    # Reuse cached surface and apply alpha
                    particle_surf = self._particle_surfaces_cache[size_key]
                    particle_surf.set_alpha(alpha_p)
                    surface.blit(particle_surf, (px - p["size"], py - p["size"]))
def check_and_unlock_achievement(key):
    """Kiểm tra và mở khóa achievement nếu chưa có"""
    global achievement_popup
    d = account_system.data()
    unlocked = d.setdefault("achievements", [])
    if key not in unlocked and key in ACHIEVEMENTS_DEF:
        unlocked.append(key)
        # Thưởng XP
        xp_reward = ACHIEVEMENTS_DEF[key].get("xp", 0)
        if xp_reward > 0:
            add_xp(xp_reward)
        reward_gold_for_result("achievement", xp_reward, 100)
        account_system.save()
        # Hiển thị popup
        achievement_popup = AchievementPopup(key)
        return True
    return False
# =========================================================
# SOUND SYSTEM — defer đến sau pygame.init() trong async main()
# =========================================================
sound_manager = None
snd_correct   = None
snd_wrong     = None
snd_levelup   = None
snd_victory   = None
snd_defeat    = None
_ck("MD_CHECKPOINT: 17-18 sound deferred to init_audio_system()")

async def init_audio_system():
    """Gọi từ async main() sau init_display(). Khởi tạo audio + sound bindings.
    PHẢI là async: trên web audio context chỉ khả dụng sau khi event loop đã chạy."""
    global sound_manager, snd_correct, snd_wrong, snd_levelup, snd_victory, snd_defeat
    # BUG FIX (pygbag): yield to browser before touching pygame.mixer so the
    # audio context is ready (avoids "AudioContext not allowed" silent failures).
    await asyncio.sleep(0)
    try:
        init_audio(base_path)
        _ck("MD_CHECKPOINT: 16 init_audio() done")
        sound_manager = get_sound_manager()
        _ck("MD_CHECKPOINT: 17 sound_manager created")
        snd_correct = sound_manager.core_sounds.get("correct")
        snd_wrong   = sound_manager.core_sounds.get("wrong")
        snd_levelup = sound_manager.core_sounds.get("levelup")
        snd_victory = sound_manager.core_sounds.get("victory")
        snd_defeat  = sound_manager.core_sounds.get("defeat")
        _ck("MD_CHECKPOINT: 18 core sounds resolved")
    except Exception as _e:
        _ck(f"MD_CHECKPOINT: audio init ERROR (non-fatal): {_e}")
class KnowledgeGraph:
    """Hệ thống bản đồ kiến thức - chia nhỏ bài học thành các kỹ năng"""
    def __init__(self):
        # Định nghĩa các kỹ năng cho từng lớp
        self.skills_by_grade = {
            1: {
                "addition_0_5": {"name": "Cộng số 0-5", "lessons": [1, 2], "prerequisites": []},
                "addition_6_10": {"name": "Cộng số 6-10", "lessons": [3, 4], "prerequisites": ["addition_0_5"]},
                "subtraction_0_5": {"name": "Trừ số 0-5", "lessons": [5, 6], "prerequisites": ["addition_0_5"]},
                "subtraction_6_10": {"name": "Trừ số 6-10", "lessons": [7, 8], "prerequisites": ["subtraction_0_5"]},
                "comparison": {"name": "So sánh số", "lessons": [4, 9], "prerequisites": ["addition_0_5"]},
                "ordering": {"name": "Sắp xếp số", "lessons": [10], "prerequisites": ["comparison"]},
                "word_problems": {"name": "Bài toán có lời", "lessons": [11, 12], "prerequisites": ["addition_0_5", "subtraction_0_5"]},
            },
            2: {
                "addition_10_20": {"name": "Cộng số 10-20", "lessons": [1, 2], "prerequisites": []},
                "subtraction_10_20": {"name": "Trừ số 10-20", "lessons": [3, 4], "prerequisites": ["addition_10_20"]},
                "addition_20_100": {"name": "Cộng số 20-100", "lessons": [5, 6], "prerequisites": ["addition_10_20"]},
                "subtraction_20_100": {"name": "Trừ số 20-100", "lessons": [7, 8], "prerequisites": ["subtraction_10_20"]},
                "multiplication": {"name": "Nhân số", "lessons": [9, 10], "prerequisites": ["addition_10_20"]},
                "division": {"name": "Chia số", "lessons": [11, 12], "prerequisites": ["multiplication"]},
            },
            3: {
                "addition_3digit": {"name": "Cộng 3 chữ số", "lessons": [1, 2], "prerequisites": []},
                "subtraction_3digit": {"name": "Trừ 3 chữ số", "lessons": [3, 4], "prerequisites": ["addition_3digit"]},
                "multiplication_table": {"name": "Bảng cửu chương", "lessons": [5, 6], "prerequisites": []},
                "division_basic": {"name": "Chia cơ bản", "lessons": [7, 8], "prerequisites": ["multiplication_table"]},
                "fractions": {"name": "Phân số", "lessons": [9, 10], "prerequisites": ["division_basic"]},
                "geometry": {"name": "Hình học cơ bản", "lessons": [11, 12], "prerequisites": []},
            },
            4: {
                "addition_large": {"name": "Cộng số lớn", "lessons": [1, 2], "prerequisites": []},
                "subtraction_large": {"name": "Trừ số lớn", "lessons": [3, 4], "prerequisites": ["addition_large"]},
                "multiplication_large": {"name": "Nhân số lớn", "lessons": [5, 6], "prerequisites": ["addition_large"]},
                "division_large": {"name": "Chia số lớn", "lessons": [7, 8], "prerequisites": ["multiplication_large"]},
                "fractions_advanced": {"name": "Phân số nâng cao", "lessons": [9, 10], "prerequisites": ["fractions"]},
                "decimals": {"name": "Số thập phân", "lessons": [11, 12], "prerequisites": ["addition_large"]},
            },
            5: {
                "operations_mixed": {"name": "Phép tính hỗn hợp", "lessons": [1, 2], "prerequisites": []},
                "fractions_operations": {"name": "Phép tính với phân số", "lessons": [3, 4], "prerequisites": ["fractions_advanced"]},
                "decimals_operations": {"name": "Phép tính với thập phân", "lessons": [5, 6], "prerequisites": ["decimals"]},
                "percentages": {"name": "Phần trăm", "lessons": [7, 8], "prerequisites": ["fractions_operations"]},
                "geometry_advanced": {"name": "Hình học nâng cao", "lessons": [9, 10], "prerequisites": ["geometry"]},
                "data_analysis": {"name": "Phân tích dữ liệu", "lessons": [11, 12], "prerequisites": []},
            }
        }
    def get_skills_for_grade(self, grade):
        """Lấy danh sách kỹ năng cho một lớp"""
        return self.skills_by_grade.get(grade, {})
    def get_skill_info(self, grade, skill_id):
        """Lấy thông tin chi tiết về một kỹ năng"""
        skills = self.get_skills_for_grade(grade)
        return skills.get(skill_id, None)
    def get_prerequisites(self, grade, skill_id):
        """Lấy danh sách các kỹ năng tiên quyết"""
        skill_info = self.get_skill_info(grade, skill_id)
        if skill_info:
            return skill_info.get("prerequisites", [])
        return []
    def is_skill_unlocked(self, grade, skill_id, user_level=1):
        """Kiểm tra xem kỹ năng có được mở khóa chưa dựa trên level"""
        skill_info = self.get_skill_info(grade, skill_id)
        if not skill_info:
            return True
        lessons = skill_info.get("lessons", [])
        if not lessons:
            return True
        # Tính level cần thiết: mỗi bài học cần 6 level
        # Bài 1: level 1, Bài 2: level 7, Bài 3: level 13, ...
        max_lesson_num = max(lessons)
        required_level = (max_lesson_num - 1) * 6 + 1
        return user_level >= required_level
    def get_lesson_skills(self, grade, lesson_number):
        """Lấy danh sách kỹ năng liên quan đến một bài học"""
        skills = self.get_skills_for_grade(grade)
        lesson_skills = []
        for skill_id, skill_info in skills.items():
            if lesson_number in skill_info.get("lessons", []):
                lesson_skills.append({
                    "id": skill_id,
                    "name": skill_info.get("name", ""),
                    "progress": 0  # Sẽ được tính toán sau
                })
        return lesson_skills
    def calculate_skill_progress(self, grade, skill_id, completed_lessons):
        """Tính toán tiến độ hoàn thành của một kỹ năng"""
        skill_info = self.get_skill_info(grade, skill_id)
        if not skill_info:
            return 0
        skill_lessons = skill_info.get("lessons", [])
        completed_count = 0
        for lesson_num in skill_lessons:
            lesson_key = f"Bài {lesson_num}"
            if lesson_key in completed_lessons:
                completed_count += 1
        if len(skill_lessons) == 0:
            return 0
        return (completed_count / len(skill_lessons)) * 100
knowledge_graph = KnowledgeGraph()
_ck("MD_CHECKPOINT: 19 knowledge_graph created")
class PetSystem:
    """Hệ thống linh vật đồng hành và tiến hóa"""
    def __init__(self):
        self.pet_types = load_pets()

    def reload_pets(self):
        """Tải lại từ data/pets.json (gọi sau khi sửa file JSON)."""
        self.pet_types = load_pets()
    def get_pet_info(self, pet_type, stage):
        """Lấy thông tin về một loại linh vật ở cấp độ cụ thể"""
        if pet_type not in self.pet_types:
            return None
        stages = self.pet_types[pet_type]["stages"]
        if stage < 0 or stage >= len(stages):
            return None
        return stages[stage]
    def get_max_stage(self, pet_type):
        """Lấy cấp độ tối đa của một loại linh vật"""
        if pet_type not in self.pet_types:
            return 0
        return len(self.pet_types[pet_type]["stages"]) - 1
    def can_evolve(self, pet_type, current_stage, current_xp):
        """Kiểm tra xem linh vật có thể tiến hóa không"""
        max_stage = self.get_max_stage(pet_type)
        if current_stage >= max_stage:
            return False
        next_stage_info = self.get_pet_info(pet_type, current_stage + 1)
        if not next_stage_info:
            return False
        return current_xp >= next_stage_info["xp_required"]
    def get_evolution_progress(self, pet_type, current_stage, current_xp):
        """Lấy tiến độ tiến hóa (0-100%)"""
        max_stage = self.get_max_stage(pet_type)
        if current_stage >= max_stage:
            return 100
        current_stage_info = self.get_pet_info(pet_type, current_stage)
        next_stage_info = self.get_pet_info(pet_type, current_stage + 1)
        if not current_stage_info or not next_stage_info:
            return 0
        xp_range = next_stage_info["xp_required"] - current_stage_info["xp_required"]
        xp_progress = current_xp - current_stage_info["xp_required"]
        if xp_range <= 0:
            return 100
        progress = min(100, max(0, (xp_progress / xp_range) * 100))
        return progress
    def get_pet_price(self, pet_type):
        if pet_type not in self.pet_types:
            return 0
        return int(self.pet_types[pet_type].get("price", 0))
pet_system = PetSystem()
_ck("MD_CHECKPOINT: 20 pet_system created")
# =========================================================
# SKIN SYSTEM - Visual Customization
# =========================================================
class SkinSystem:
    """Hệ thống trang bị (skins) cho phép tùy chỉnh giao diện và bút viết"""
    def __init__(self):
        self.skin_types = load_skins()

    def reload_skins(self):
        self.skin_types = load_skins()
    def get_skin_info(self, skin_key):
        """Lấy thông tin skin"""
        return self.skin_types.get(skin_key, {})  # type: ignore[union-attr]
    def get_skin_price(self, skin_key):
        """Lấy giá skin"""
        skin = self.skin_types.get(skin_key)  # type: ignore[union-attr]
        return int(skin.get("price", 0)) if skin else 0
    def get_skins_by_type(self, skin_type):
        """Lấy danh sách skin theo loại"""
        return {k: v for k, v in self.skin_types.items() if v.get("type") == skin_type}  # type: ignore[union-attr]
    def apply_skin_effect(self, surface, skin_key, x, y, text=""):
        """Áp dụng hiệu ứng skin khi viết"""
        skin = self.skin_types.get(skin_key, {})  # type: ignore[union-attr]
        effect = skin.get("effect")
        if effect == "sparkle":
            # Tạo hiệu ứng sparkle
            for _ in range(3):
                spark_x = x + random.randint(-10, 10)
                spark_y = y + random.randint(-10, 10)
                pygame.draw.circle(surface, (255, 255, 200), (spark_x, spark_y), random.randint(1, 3))
        elif effect == "laser":
            # Tạo hiệu ứng laser
            pygame.draw.line(surface, (255, 0, 0), (x-5, y), (x+5, y), 2)
        elif effect == "golden":
            # Tạo hiệu ứng vàng
            pygame.draw.circle(surface, (200, 170, 80), (x, y), 4)
        elif effect == "neon":
            # Tạo hiệu ứng neon
            for i in range(3):
                alpha = 100 - i * 30
                color = (*skin.get("color", (34, 197, 94)), alpha) if len(skin.get("color", (34, 197, 94))) == 3 else skin.get("color", (34, 197, 94))
                pygame.draw.circle(surface, color[:3], (x, y), 6 + i * 2, 1)
skin_system = SkinSystem()
_ck("MD_CHECKPOINT: 21 skin_system created")
# =========================================================
# SKILL TREE SYSTEM - XP-based Upgrades
# =========================================================
class SkillTreeSystem:
    """Hệ thống cây kỹ năng - dùng XP để mở khóa và nâng cấp buff"""
    def __init__(self):
        self.skills = load_skills()
        # Active effects tracking
        self.active_effects = {}  # skill_id -> {"end_time": float, "level": int}
    def get_skill_info(self, skill_id):
        """Lấy thông tin kỹ năng"""
        return self.skills.get(skill_id, {})
    def get_skills_by_category(self, category):
        """Lấy danh sách kỹ năng theo danh mục"""
        return {k: v for k, v in self.skills.items() if v.get("category") == category}
    def can_unlock_skill(self, skill_id, user_level, user_xp):
        """Kiểm tra có thể mở khóa kỹ năng không"""
        skill = self.skills.get(skill_id)
        if not skill:
            return False, "Kỹ năng không tồn tại."
        # Kiểm tra level tối thiểu (cần level 5 để bắt đầu)
        if user_level < 5:
            return False, "Cần đạt level 5 để mở khóa kỹ năng."
        # Kiểm tra kỹ năng yêu cầu
        for req_skill in skill.get("requires", []):
            if not self.is_skill_unlocked(req_skill):
                return False, f"Cần mở khóa '{self.skills[req_skill]['name']}' trước."
        return True, "Có thể mở khóa."
    def is_skill_unlocked(self, skill_id):
        """Kiểm tra kỹ năng đã mở khóa chưa"""
        return self.skills.get(skill_id, {}).get("unlocked", False)
    def unlock_skill(self, skill_id, user_xp):
        """Mở khóa kỹ năng với XP"""
        skill = self.skills.get(skill_id)
        if not skill:
            return False, "Kỹ năng không tồn tại."
        if skill.get("unlocked", False):
            return False, "Kỹ năng đã mở khóa."
        # Cần XP để mở khóa
        unlock_cost = 50  # Chi phí mở khóa cơ bản
        if user_xp < unlock_cost:
            return False, f"Cần {unlock_cost} XP để mở khóa."
        skill["unlocked"] = True
        return True, f"Mở khóa '{skill['name']}' thành công!"
    def upgrade_skill(self, skill_id, user_xp, current_level):
        """Nâng cấp kỹ năng"""
        skill = self.skills.get(skill_id)
        if not skill or not skill.get("unlocked", False):
            return False, "Kỹ năng chưa mở khóa."
        max_level = skill.get("max_level", 1)
        if current_level >= max_level:
            return False, "Đã đạt cấp độ tối đa."
        cost_list = skill.get("cost_per_level", [])
        if current_level >= len(cost_list):
            return False, "Không thể nâng cấp thêm."
        upgrade_cost = cost_list[current_level]
        if user_xp < upgrade_cost:
            return False, f"Cần {upgrade_cost} XP để nâng cấp."
        return True, f"Nâng cấp lên cấp {current_level + 1} thành công!"
    def activate_skill(self, skill_id, level):
        """Kích hoạt kỹ năng có thời hạn"""
        skill = self.skills.get(skill_id)
        if not skill or skill.get("effect_type") != "duration":
            return False, "Kỹ năng không thể kích hoạt."
        duration = skill.get("duration", 60)
        end_time = time.time() + duration
        self.active_effects[skill_id] = {"end_time": end_time, "level": level}
        return True, f"Kích hoạt '{skill['name']}' thành công!"
    def is_skill_active(self, skill_id):
        """Kiểm tra kỹ năng đang hoạt động"""
        if skill_id not in self.active_effects:
            return False, 0
        effect = self.active_effects[skill_id]
        if time.time() > effect["end_time"]:
            del self.active_effects[skill_id]
            return False, 0
        return True, effect["level"]
    def get_active_effects(self):
        """Lấy danh sách hiệu ứng đang hoạt động"""
        active = {}
        current_time = time.time()
        for skill_id, effect in list(self.active_effects.items()):
            if current_time <= effect["end_time"]:
                active[skill_id] = effect
            else:
                del self.active_effects[skill_id]
        return active
    def apply_skill_effects(self, base_value, effect_type):
        """Áp dụng hiệu ứng kỹ năng vào giá trị cơ bản"""
        total_multiplier = 1.0
        active_effects = self.get_active_effects()
        for skill_id, effect in active_effects.items():
            skill = self.skills.get(skill_id, {})
            if skill.get("effect_type") == "duration" and effect_type in skill.get("category", ""):
                level = effect["level"] - 1  # Convert to 0-based index
                multipliers = skill.get("multiplier", [])
                if level < len(multipliers):
                    total_multiplier *= multipliers[level]
        return base_value * total_multiplier
    def get_passive_bonuses(self, user_skills):
        """Lấy các bonus thụ động từ kỹ năng đã nâng cấp"""
        bonuses = {
            "gold_multiplier": 1.0,
            "xp_multiplier": 1.0,
            "time_bonus": 0,
            "combo_bonus": 0,
            "shield_count": 0,
            "retry_chance": 0.0,
            "lucky_chance": 0.0
        }
        for skill_id, level in user_skills.items():
            if level <= 0:
                continue
            skill = self.skills.get(skill_id, {})
            if skill.get("effect_type") != "passive":
                continue
            level_index = level - 1  # Convert to 0-based index
            if skill.get("category") == "gold":
                multipliers = skill.get("multiplier", [])
                if level_index < len(multipliers):
                    bonuses["gold_multiplier"] *= multipliers[level_index]
            elif skill.get("category") == "xp":
                multipliers = skill.get("multiplier", [])
                if level_index < len(multipliers):
                    bonuses["xp_multiplier"] *= multipliers[level_index]
            elif skill.get("category") == "time":
                bonus_times = skill.get("bonus_time", [])
                if level_index < len(bonus_times):
                    bonuses["time_bonus"] += bonus_times[level_index]
            elif skill.get("category") == "combo":
                thresholds = skill.get("combo_threshold", [])
                durations = skill.get("bonus_duration", [])
                if level_index < len(thresholds):
                    bonuses["combo_bonus"] += thresholds[level_index]
                if level_index < len(durations):
                    bonuses["combo_duration"] = bonuses.get("combo_duration", 0) + durations[level_index]
            elif skill.get("category") == "protection":
                shields = skill.get("shield_count", [])
                if level_index < len(shields):
                    bonuses["shield_count"] += shields[level_index]
            elif skill.get("category") == "special":
                retry_chances = skill.get("retry_chance", [])
                lucky_chances = skill.get("lucky_chance", [])
                if level_index < len(retry_chances):
                    bonuses["retry_chance"] = max(bonuses["retry_chance"], retry_chances[level_index])
                if level_index < len(lucky_chances):
                    bonuses["lucky_chance"] = max(bonuses["lucky_chance"], lucky_chances[level_index])
        return bonuses
skill_tree_system = SkillTreeSystem()
_ck("MD_CHECKPOINT: 22 skill_tree_system created")
class GachaSystem:
    """Hệ thống Gacha kiến thức - thu thập mảnh ghép để mở khóa thẻ bài/sự thật thú vị"""
    def __init__(self):
        self.card_types = load_gacha_cards()
        # Định nghĩa tỷ lệ rơi (rarity)
        self.rarity_rates = {
            "common": 60,      # 60%
            "rare": 30,         # 30%
            "legendary": 10    # 10%
        }
    def get_random_card(self):
        """Rút thẻ ngẫu nhiên dựa trên tỷ lệ rarity"""
        # Chọn rarity ngẫu nhiên
        rand = random.randint(1, 100)
        cumulative = 0
        selected_rarity = "common"
        for rarity, rate in self.rarity_rates.items():
            cumulative += rate
            if rand <= cumulative:
                selected_rarity = rarity
                break
        # Chọn thẻ từ rarity đã chọn
        cards_in_rarity = []
        for category, data in self.card_types.items():
            if data["rarity"] == selected_rarity:
                cards_in_rarity.extend(data["items"])
        if cards_in_rarity:
            return random.choice(cards_in_rarity)
        # Fallback: trả về thẻ common bất kỳ
        return random.choice(self.card_types["math_facts"]["items"])
    def get_card_by_id(self, card_id):
        """Lấy thông tin thẻ theo ID"""
        for category, data in self.card_types.items():
            for item in data["items"]:
                if item["id"] == card_id:
                    return item
        return None
    def get_all_cards(self):
        """Lấy tất cả các thẻ có thể thu thập"""
        all_cards = []
        for category, data in self.card_types.items():
            for item in data["items"]:
                all_cards.append({
                    "id": item["id"],
                    "title": item["title"],
                    "content": item["content"],
                    "icon": item["icon"],
                    "category": data["name"],
                    "rarity": data["rarity"]
                })
        return all_cards
gacha_system = GachaSystem()
_ck("MD_CHECKPOINT: 23 gacha_system created")

# =========================================================
# GACHA BANNER SYSTEM – HSR style weekly rotating banners
# =========================================================
class GachaBannerSystem:
    """
    Quản lý banner gacha theo tuần, giống Honkai: Star Rail.
    Tỉ lệ chính xác theo HSR:
      5★ base 0.6%  soft-pity từ pull 74, hard-pity 90
      4★ base 5.1%  guaranteed mỗi 10 pull
      3★ phần còn lại (~94.3%)
    50/50 system cho banner nhân vật / vũ khí.
    """
    POOL_5STAR = [
        {"title": "Thần Toán Archimedes",  "icon": "🏛️", "category": "5★ Huyền Thoại", "content": "Nhân đôi toàn bộ Vàng trong 5 phiên chơi!", "rarity": "5star", "effect_id": "gold_double"},
        {"title": "Rồng Số Học",            "icon": "🐉", "category": "5★ Huyền Thoại", "content": "Kích hoạt x3 điểm trong 50 câu tiếp theo.",  "rarity": "5star", "effect_id": "score_x3_10q"},
        {"title": "Nhà Thông Thái Lão Hạc", "icon": "👴", "category": "5★ Huyền Thoại", "content": "Nhân 2 điểm từ tất cả câu hỏi trong 5 phiên.", "rarity": "5star", "effect_id": "score_x2_session"},
        {"title": "Tia Sáng Pygame",        "icon": "🐍", "category": "5★ Huyền Thoại", "content": "Đóng băng thời gian đếm ngược 25 giây.",      "rarity": "5star", "effect_id": "freeze_timer_5s"},
        {"title": "Phượng Hoàng Đại Số",    "icon": "🦅", "category": "5★ Huyền Thoại", "content": "Hồi sinh tối đa 5 mạng khi thua trong phiên.", "rarity": "5star", "effect_id": "revive_1life"},
        {"title": "Thiên Tài Einstein Jr.", "icon": "🧬", "category": "5★ Huyền Thoại", "content": "Tất cả combo bonus tăng gấp đôi trong 5 phiên.","rarity": "5star", "effect_id": "combo_x2_session"},
    ]
    POOL_4STAR = [
        {"title": "Bảo Hộ Thales",   "icon": "📐", "category": "4★ Hiếm", "content": "Hiển thị gợi ý hình học trong phiên.",        "rarity": "4star", "effect_id": "geometry_boost"},
        {"title": "La Bàn Euler",     "icon": "🧭", "category": "4★ Hiếm", "content": "Gợi ý đặc biệt cho 5 câu khó tiếp theo.",     "rarity": "4star", "effect_id": "euler_hint"},
        {"title": "Định Lý Pythago",  "icon": "📏", "category": "4★ Hiếm", "content": "Hiển thị gợi ý tam giác vuông trong phiên.",  "rarity": "4star", "effect_id": "pythagoras_hint"},
        {"title": "Bộ Nhớ Siêu Cấp", "icon": "🧠", "category": "4★ Hiếm", "content": "Tăng 15% EXP nhận được trong phiên.",         "rarity": "4star", "effect_id": "xp_boost_15"},
        {"title": "Đồng Hồ Cát",     "icon": "⏳", "category": "4★ Hiếm", "content": "+3 giây mỗi câu trả lời đúng (Time Attack).","rarity": "4star", "effect_id": "time_bonus_3s"},
        {"title": "Cung Thủ Logic",   "icon": "🏹", "category": "4★ Hiếm", "content": "10% cơ hội mở câu hỏi thưởng sau khi đúng.", "rarity": "4star", "effect_id": "bonus_question_chance"},
        {"title": "Khiên Tri Thức",   "icon": "🛡️", "category": "4★ Hiếm", "content": "Chặn 1 lần mất mạng trong phiên này.",       "rarity": "4star", "effect_id": "shield_1life"},
    ]
    POOL_3STAR = [
        {"title": "Cộng Thần Tốc",   "icon": "➕", "category": "3★ Thường", "content": "+10% điểm câu hỏi phép cộng.",     "rarity": "3star", "effect_id": "speed_add_10"},
        {"title": "Trừ Chớp Nhoáng", "icon": "➖", "category": "3★ Thường", "content": "Giảm 5% thời gian suy nghĩ trừ.",  "rarity": "3star", "effect_id": "speed_sub_5"},
        {"title": "Nhân Vũ Bão",     "icon": "✖️", "category": "3★ Thường", "content": "+8% điểm câu hỏi phép nhân.",     "rarity": "3star", "effect_id": "mul_bonus"},
        {"title": "Chia Cắt Gió",    "icon": "➗", "category": "3★ Thường", "content": "Câu chia xuất hiện thêm 10%.",     "rarity": "3star", "effect_id": "div_more"},
        {"title": "Ghi Nhớ Nhanh",   "icon": "📝", "category": "3★ Thường", "content": "+5% tốc độ ghi nhớ công thức.",   "rarity": "3star", "effect_id": "memory_5"},
        {"title": "Tập Trung Cao",   "icon": "🎯", "category": "3★ Thường", "content": "Giảm 5% xác suất mất combo.",     "rarity": "3star", "effect_id": "focus_combo"},
    ]
    BANNER_DEFS = [
        {"id":"archimedes","name":"Thần Toán Archimedes","type":"character",
         "featured_5star":"Thần Toán Archimedes",
         "featured_4stars":["Bảo Hộ Thales","Cung Thủ Logic","Đồng Hồ Cát"],
         "color_main":(180,130,255),"color_accent":(230,200,255),"color_bg":(30,20,55),
         "icon":"🏛️","description":"Huyền thoại nền toán học cổ đại trở lại!"},
        {"id":"dragon","name":"Rồng Số Học","type":"character",
         "featured_5star":"Rồng Số Học",
         "featured_4stars":["Định Lý Pythago","Bộ Nhớ Siêu Cấp","La Bàn Euler"],
         "color_main":(255,120,60),"color_accent":(255,210,140),"color_bg":(40,15,10),
         "icon":"🐉","description":"Sức mạnh x3 điểm từ Rồng Số Học huyền thoại!"},
        {"id":"phoenix","name":"Phượng Hoàng Đại Số","type":"character",
         "featured_5star":"Phượng Hoàng Đại Số",
         "featured_4stars":["Khiên Tri Thức","Cung Thủ Logic","Đồng Hồ Cát"],
         "color_main":(255,200,50),"color_accent":(255,240,160),"color_bg":(40,30,5),
         "icon":"🦅","description":"Không bao giờ bỏ cuộc — hồi sinh từ tro tàn!"},
        {"id":"einstein","name":"Thiên Tài Einstein Jr.","type":"light_cone",
         "featured_5star":"Thiên Tài Einstein Jr.",
         "featured_4stars":["Bộ Nhớ Siêu Cấp","Bảo Hộ Thales","Định Lý Pythago"],
         "color_main":(80,200,255),"color_accent":(190,240,255),"color_bg":(10,25,50),
         "icon":"🧬","description":"Combo bonus x2 — thiên tài trong tầm tay!"},
    ]
    STANDARD_BANNER = {
        "id":"standard","name":"Triệu Hồi Chuẩn","type":"standard",
        "featured_5star":None,"featured_4stars":[],
        "color_main":(130,170,220),"color_accent":(190,220,255),"color_bg":(15,25,45),
        "icon":"🌌","description":"Banner thường — không có featured 50/50.",
    }
    BASE_5STAR = 0.006
    BASE_4STAR = 0.051
    SOFT_PITY_START = 74
    HARD_PITY = 90
    RARE_GUARANTEE = 10

    def __init__(self):
        self._cached_week = -1
        self._cached_banners = []

    def get_week_number(self):
        return datetime.datetime.now().isocalendar()[1]

    def get_active_banners(self):
        week = self.get_week_number()
        if week == self._cached_week:
            return self._cached_banners
        n = len(self.BANNER_DEFS)
        b1 = self.BANNER_DEFS[week % n]
        b2 = self.BANNER_DEFS[(week + 1) % n]
        self._cached_banners = [b1, b2, self.STANDARD_BANNER]
        self._cached_week = week
        return self._cached_banners

    def get_banner_by_id(self, bid):
        for b in self.get_active_banners():
            if b["id"] == bid:
                return b
        return self.STANDARD_BANNER

    def days_until_reset(self):
        today = datetime.datetime.now()
        return 7 - today.weekday()

    def _get_banner_pity(self, d, bid):
        bp = d.setdefault("banner_pity", {})
        if bid not in bp:
            bp[bid] = {"pull_count":0,"total_pulls":0,"rare_pity":0,"guaranteed":False}
        return bp[bid]

    def _calc_5star_prob(self, pull_count):
        if pull_count < self.SOFT_PITY_START:
            return self.BASE_5STAR
        elif pull_count < self.HARD_PITY:
            return min(1.0, self.BASE_5STAR + (pull_count - self.SOFT_PITY_START) * 0.06)
        return 1.0

    def pull(self, bid, count=1):
        d = account_system.data()
        pity = self._get_banner_pity(d, bid)
        banner = self.get_banner_by_id(bid)
        results = []
        has_4plus = False
        for i in range(count):
            card, rstar, is_new = self._single(d, pity, banner)
            if rstar in ("5star","4star"):
                has_4plus = True
            results.append((card, is_new, rstar))
        if count == 10 and not has_4plus:
            card, is_new = self._pick_4star(d, banner)
            pity["rare_pity"] = 0
            results[-1] = (card, is_new, "4star")
        account_system.save()
        return results

    def _single(self, d, pity, banner):
        pity["pull_count"]  += 1
        pity["total_pulls"] += 1
        pity["rare_pity"]   += 1
        p5 = self._calc_5star_prob(pity["pull_count"])
        roll = random.random()
        if roll < p5:
            pity["pull_count"] = 0
            pity["rare_pity"]  = 0
            card, is_new = self._pick_5star(d, pity, banner)
            return card, "5star", is_new
        elif pity["rare_pity"] >= self.RARE_GUARANTEE or roll < p5 + self.BASE_4STAR:
            pity["rare_pity"] = 0
            card, is_new = self._pick_4star(d, banner)
            return card, "4star", is_new
        else:
            card, is_new = self._pick_3star(d)
            return card, "3star", is_new

    def _pick_5star(self, d, pity, banner):
        featured = banner.get("featured_5star")
        if featured and banner["type"] != "standard":
            if pity.get("guaranteed") or random.random() < 0.5:
                pity["guaranteed"] = False
                pool = [c for c in self.POOL_5STAR if c["title"] == featured] or self.POOL_5STAR
            else:
                pity["guaranteed"] = True
                pool = [c for c in self.POOL_5STAR if c["title"] != featured] or self.POOL_5STAR
        else:
            pool = self.POOL_5STAR
        card = random.choice(pool).copy()
        inv = d.setdefault("inventory", [])
        is_new = card["title"] not in inv
        if is_new: inv.append(card["title"])
        # Add to bag
        bag = d.setdefault("bag", {})
        bag[card["title"]] = bag.get(card["title"], 0) + 1
        return card, is_new

    def _pick_4star(self, d, banner):
        feat4 = banner.get("featured_4stars", [])
        pool = ([c for c in self.POOL_4STAR if c["title"] in feat4]
                if feat4 and random.random() < 0.5 else self.POOL_4STAR)
        if not pool: pool = self.POOL_4STAR
        card = random.choice(pool).copy()
        inv = d.setdefault("inventory", [])
        is_new = card["title"] not in inv
        if is_new: inv.append(card["title"])
        bag = d.setdefault("bag", {})
        bag[card["title"]] = bag.get(card["title"], 0) + 1
        return card, is_new

    def _pick_3star(self, d):
        card = random.choice(self.POOL_3STAR).copy()
        inv = d.setdefault("inventory", [])
        is_new = card["title"] not in inv
        if is_new: inv.append(card["title"])
        bag = d.setdefault("bag", {})
        bag[card["title"]] = bag.get(card["title"], 0) + 1
        return card, is_new

    def grant_card_direct(self, title, rarity):
        """
        Cấp thẻ TRỰC TIẾP cho học sinh khi các em dùng Vàng để "đổi" thẻ
        trong Cửa Hàng Đổi Thẻ — KHÔNG có yếu tố ngẫu nhiên/may rủi.
        Đây là cơ chế thay thế hoàn toàn cho pull()/gacha cũ, phù hợp với
        môi trường giáo dục tiểu học (khuyến khích nỗ lực học tập, không
        khuyến khích cờ bạc/phụ thuộc may rủi).
        """
        d = account_system.data()
        inv = d.setdefault("inventory", [])
        is_new = title not in inv
        if is_new:
            inv.append(title)
        bag = d.setdefault("bag", {})
        bag[title] = bag.get(title, 0) + 1
        account_system.save()
        return is_new

    def get_pity_display(self, bid):
        d = account_system.data()
        p = self._get_banner_pity(d, bid)
        return {
            "pull_count":  p["pull_count"],
            "total_pulls": p["total_pulls"],
            "rare_pity":   p["rare_pity"],
            "guaranteed":  p["guaranteed"],
            "soft_active": p["pull_count"] >= self.SOFT_PITY_START,
            "to_hard":     max(0, self.HARD_PITY - p["pull_count"]),
            "to_rare":     max(0, self.RARE_GUARANTEE - p["rare_pity"]),
        }

banner_system = GachaBannerSystem()
_ck("MD_CHECKPOINT: 24 banner_system created")

# =========================================================
# ITEM EFFECT SYSTEM – Định nghĩa hiệu ứng thực tế của vật phẩm
# =========================================================
# Mỗi item trong pool có "effect_id". ItemEffectSystem biết cách
# áp dụng / kiểm tra / hết hạn từng effect đó.
#
# Active buffs lưu trong: d["active_buffs"] = {effect_id: {expires, value, ...}}
# Buffs theo phiên (hết khi thoát) có expires = None.

FIVE_STAR_DURATION_MULT = 5
FIVE_STAR_EFFECT_IDS = frozenset({
    "gold_double", "score_x3_10q", "score_x2_session",
    "freeze_timer_5s", "revive_1life", "combo_x2_session",
})

ITEM_DEFS = {
    # ── 5★ effects ───────────────────────────────────────────
    "gold_double": {
        "label": "Nhân đôi Vàng",
        "icon": "💰",
        "desc": "Nhân đôi toàn bộ Vàng nhận được trong 5 phiên chơi.",
        "type": "session",          # hết khi kết thúc phiên chơi
        "param": {"multiplier": 2},
    },
    "score_x3_10q": {
        "label": "x3 Điểm (50 câu)",
        "icon": "🔥",
        "desc": "Nhân x3 điểm trong 50 câu tiếp theo.",
        "type": "question_count",
        "param": {"multiplier": 3, "remaining": 10},
    },
    "score_x2_session": {
        "label": "x2 Điểm phiên",
        "icon": "⚡",
        "desc": "Nhân x2 điểm từ tất cả câu hỏi trong 5 phiên.",
        "type": "session",
        "param": {"multiplier": 2},
    },
    "freeze_timer_5s": {
        "label": "Đóng băng 25 giây",
        "icon": "❄️",
        "desc": "Đóng băng đồng hồ đếm ngược trong 25 giây.",
        "type": "timed",
        "param": {"seconds": 5},
    },
    "revive_1life": {
        "label": "Hồi sinh mạng",
        "icon": "💖",
        "desc": "Tự động hồi sinh tối đa 5 lần khi hết mạng trong phiên.",
        "type": "session",
        "param": {"revives": 1},
    },
    "combo_x2_session": {
        "label": "Combo x2",
        "icon": "✨",
        "desc": "Tất cả combo bonus tăng gấp đôi trong 5 phiên.",
        "type": "session",
        "param": {"combo_boost": 2},
    },
    # ── 4★ effects ───────────────────────────────────────────
    "geometry_boost": {
        "label": "Trợ lý Hình học",
        "icon": "📐",
        "desc": "Hiển thị gợi ý thêm cho câu hỏi hình học.",
        "type": "session",
        "param": {"hint_geometry": True},
    },
    "euler_hint": {
        "label": "Gợi ý Euler",
        "icon": "🧭",
        "desc": "Mở khóa gợi ý đặc biệt trong 5 câu hỏi khó.",
        "type": "question_count",
        "param": {"hint_hard": True, "remaining": 5},
    },
    "pythagoras_hint": {
        "label": "Gợi ý Pythago",
        "icon": "📏",
        "desc": "Hiển thị gợi ý tam giác vuông trong phiên.",
        "type": "session",
        "param": {"hint_triangle": True},
    },
    "xp_boost_15": {
        "label": "+15% EXP",
        "icon": "🧠",
        "desc": "Tăng 15% EXP nhận được trong phiên hiện tại.",
        "type": "session",
        "param": {"xp_multiplier": 1.15},
    },
    "time_bonus_3s": {
        "label": "+3s mỗi đúng",
        "icon": "⏳",
        "desc": "Cộng thêm 3 giây khi trả lời đúng (Time Attack).",
        "type": "session",
        "param": {"time_bonus": 3},
    },
    "bonus_question_chance": {
        "label": "Câu thưởng 10%",
        "icon": "🏹",
        "desc": "Mỗi lần đúng có 10% xác suất mở câu hỏi thưởng.",
        "type": "session",
        "param": {"bonus_q_chance": 0.10},
    },
    "shield_1life": {
        "label": "Khiên mạng",
        "icon": "🛡️",
        "desc": "Chặn 1 lần mất mạng trong phiên này.",
        "type": "session",
        "param": {"shield": 1},
    },
    # ── 3★ effects ───────────────────────────────────────────
    "speed_add_10": {
        "label": "+10% tốc độ",
        "icon": "➕",
        "desc": "Tăng nhẹ điểm cho câu hỏi cộng.",
        "type": "session",
        "param": {"add_bonus": 0.10},
    },
    "speed_sub_5": {
        "label": "Trừ nhanh hơn",
        "icon": "➖",
        "desc": "Giảm 5% thời gian suy nghĩ câu trừ.",
        "type": "session",
        "param": {"sub_speedup": 0.05},
    },
    "mul_bonus": {
        "label": "Nhân thêm điểm",
        "icon": "✖️",
        "desc": "Tăng điểm nhẹ khi đúng phép nhân.",
        "type": "session",
        "param": {"mul_bonus": 0.08},
    },
    "div_more": {
        "label": "Phép chia +10%",
        "icon": "➗",
        "desc": "Câu hỏi phép chia xuất hiện thêm 10%.",
        "type": "session",
        "param": {"div_more": 0.10},
    },
    "memory_5": {
        "label": "Ghi nhớ nhanh",
        "icon": "📝",
        "desc": "Tăng 5% tốc độ ghi nhớ công thức.",
        "type": "session",
        "param": {"mem_boost": 0.05},
    },
    "focus_combo": {
        "label": "Tập trung cao",
        "icon": "🎯",
        "desc": "Giảm 5% xác suất mất combo.",
        "type": "session",
        "param": {"combo_protect": 0.05},
    },
}

# Map: card title → effect_id
CARD_EFFECT_MAP = {
    "Thần Toán Archimedes":  "gold_double",
    "Rồng Số Học":           "score_x3_10q",
    "Nhà Thông Thái Lão Hạc":"score_x2_session",
    "Tia Sáng Pygame":       "freeze_timer_5s",
    "Phượng Hoàng Đại Số":   "revive_1life",
    "Thiên Tài Einstein Jr.":"combo_x2_session",
    "Bảo Hộ Thales":         "geometry_boost",
    "La Bàn Euler":          "euler_hint",
    "Định Lý Pythago":       "pythagoras_hint",
    "Bộ Nhớ Siêu Cấp":      "xp_boost_15",
    "Đồng Hồ Cát":           "time_bonus_3s",
    "Cung Thủ Logic":        "bonus_question_chance",
    "Khiên Tri Thức":        "shield_1life",
    "Cộng Thần Tốc":         "speed_add_10",
    "Trừ Chớp Nhoáng":       "speed_sub_5",
    "Nhân Vũ Bão":           "mul_bonus",
    "Chia Cắt Gió":          "div_more",
    "Ghi Nhớ Nhanh":         "memory_5",
    "Tập Trung Cao":         "focus_combo",
}

class ItemEffectSystem:
    """Quản lý active buffs từ vật phẩm gacha trong dữ liệu người chơi."""

    @staticmethod
    def _is_five_star(effect_id):
        return effect_id in FIVE_STAR_EFFECT_IDS

    @staticmethod
    def _scaled_amount(base, effect_id):
        if ItemEffectSystem._is_five_star(effect_id):
            return base * FIVE_STAR_DURATION_MULT
        return base

    def _apply_five_star_duration(self, effect_id, buff_data, defn):
        if not self._is_five_star(effect_id):
            return
        if "remaining" in buff_data:
            buff_data["remaining"] = self._scaled_amount(
                defn["param"].get("remaining", 1), effect_id
            )
        if defn["type"] == "timed":
            buff_data["timer_left"] = self._scaled_amount(
                defn["param"]["seconds"], effect_id
            )
        if defn["type"] == "session":
            buff_data["sessions_left"] = FIVE_STAR_DURATION_MULT
            if "revives" in buff_data:
                buff_data["revives"] = self._scaled_amount(
                    defn["param"].get("revives", 1), effect_id
                )

    def activate(self, card_title):
        """Kích hoạt hiệu ứng của thẻ. Trả về (ok, message)."""
        d = account_system.data()
        # Kiểm tra thẻ trong túi
        bag = d.setdefault("bag", {})
        qty = bag.get(card_title, 0)
        if qty <= 0:
            return False, "Không có thẻ này trong túi!"
        effect_id = CARD_EFFECT_MAP.get(card_title)
        if not effect_id:
            return False, "Thẻ này chưa có hiệu ứng."
        defn = ITEM_DEFS.get(effect_id, {})
        buffs = d.setdefault("active_buffs", {})
        # Nếu buff đã active → stack (tăng remaining hoặc reset)
        if effect_id in buffs:
            ex = buffs[effect_id]
            if "remaining" in ex:
                ex["remaining"] += self._scaled_amount(
                    defn["param"].get("remaining", 1), effect_id
                )
            elif "revives" in ex:
                ex["revives"] += self._scaled_amount(
                    defn["param"].get("revives", 1), effect_id
                )
            elif "sessions_left" in ex:
                ex["sessions_left"] += FIVE_STAR_DURATION_MULT
            elif defn["type"] == "timed":
                ex["timer_left"] = ex.get("timer_left", 0) + self._scaled_amount(
                    defn["param"]["seconds"], effect_id
                )
        else:
            import copy
            buffs[effect_id] = copy.deepcopy(defn["param"])
            if defn["type"] == "timed" and not self._is_five_star(effect_id):
                buffs[effect_id]["timer_left"] = defn["param"]["seconds"]
            self._apply_five_star_duration(effect_id, buffs[effect_id], defn)
        # Tiêu thụ 1 thẻ
        bag[card_title] -= 1
        if bag[card_title] <= 0:
            del bag[card_title]
        account_system.save()
        return True, f"✅ Kích hoạt: {defn['label']}!"

    def get_buff(self, effect_id):
        """Lấy buff đang active (hoặc None)."""
        d = account_system.data()
        return d.get("active_buffs", {}).get(effect_id)

    def consume_question_count(self, effect_id):
        """Giảm remaining của buff dạng question_count. Xoá khi hết."""
        d = account_system.data()
        buffs = d.get("active_buffs", {})
        if effect_id not in buffs:
            return
        b = buffs[effect_id]
        if "remaining" in b:
            b["remaining"] -= 1
            if b["remaining"] <= 0:
                del buffs[effect_id]
        account_system.save()

    def tick_timers(self, dt):
        """Gọi mỗi frame để đếm ngược timed buffs."""
        d = account_system.data()
        buffs = d.get("active_buffs", {})
        changed = False
        for eid in list(buffs.keys()):
            b = buffs[eid]
            if "timer_left" in b:
                b["timer_left"] -= dt
                if b["timer_left"] <= 0:
                    del buffs[eid]
                    changed = True
        if changed:
            account_system.save()

    def clear_session_buffs(self):
        """Xoá session buffs khi kết thúc phiên chơi."""
        d = account_system.data()
        buffs = d.get("active_buffs", {})
        to_del = []
        for eid, b in buffs.items():
            etype = ITEM_DEFS.get(eid, {}).get("type")
            if etype not in ("session", "question_count"):
                continue
            if self._is_five_star(eid):
                if etype == "session":
                    sessions_left = b.get("sessions_left", 1) - 1
                    if sessions_left <= 0:
                        to_del.append(eid)
                    else:
                        b["sessions_left"] = sessions_left
                elif etype == "question_count" and b.get("remaining", 0) <= 0:
                    to_del.append(eid)
                continue
            to_del.append(eid)
        for eid in to_del:
            del buffs[eid]
        account_system.save()

    def get_score_multiplier(self):
        """Tổng multiplier điểm số từ active buffs."""
        mult = 1.0
        b_x2 = self.get_buff("score_x2_session")
        if b_x2:
            mult *= b_x2.get("multiplier", 2)
        b_x3 = self.get_buff("score_x3_10q")
        if b_x3 and b_x3.get("remaining", 0) > 0:
            mult *= b_x3.get("multiplier", 3)
        return mult

    def get_gold_multiplier(self):
        b = self.get_buff("gold_double")
        return b.get("multiplier", 2) if b else 1.0

    def get_xp_multiplier(self):
        b = self.get_buff("xp_boost_15")
        return b.get("xp_multiplier", 1.15) if b else 1.0

    def get_time_bonus(self):
        b = self.get_buff("time_bonus_3s")
        return b.get("time_bonus", 0) if b else 0

    def has_freeze_timer(self):
        b = self.get_buff("freeze_timer_5s")
        return b is not None and b.get("timer_left", 0) > 0

    def has_revive(self):
        return self.get_buff("revive_1life") is not None

    def use_revive(self):
        d = account_system.data()
        buffs = d.get("active_buffs", {})
        if "revive_1life" in buffs:
            b = buffs["revive_1life"]
            revives = b.get("revives", 1) - 1
            if revives <= 0:
                del buffs["revive_1life"]
            else:
                b["revives"] = revives
            account_system.save()
            return True
        return False

    def has_shield(self):
        b = self.get_buff("shield_1life")
        return b is not None and b.get("shield", 0) > 0

    def use_shield(self):
        d = account_system.data()
        buffs = d.get("active_buffs", {})
        if "shield_1life" in buffs:
            del buffs["shield_1life"]
            account_system.save()
            return True
        return False

    def get_combo_boost(self):
        b = self.get_buff("combo_x2_session")
        return b.get("combo_boost", 1) if b else 1

    def add_to_bag(self, card_title, qty=1):
        """Thêm thẻ vào túi đồ (gọi sau khi kéo gacha)."""
        d = account_system.data()
        bag = d.setdefault("bag", {})
        bag[card_title] = bag.get(card_title, 0) + qty
        account_system.save()

    def get_bag(self):
        """Trả về dict {card_title: qty}."""
        return account_system.data().get("bag", {})

    def get_active_summary(self):
        """Trả về list[(icon, label, info)] để hiển thị HUD."""
        d = account_system.data()
        buffs = d.get("active_buffs", {})
        result = []
        for eid, b in buffs.items():
            defn = ITEM_DEFS.get(eid, {})
            icon = defn.get("icon", "✨")
            label = defn.get("label", eid)
            if "remaining" in b:
                info = f"×{b['remaining']} câu"
            elif "revives" in b and b.get("revives", 0) > 1:
                info = f"×{b['revives']} lần"
            elif "sessions_left" in b:
                info = f"{b['sessions_left']} phiên"
            elif "timer_left" in b:
                info = f"{b['timer_left']:.1f}s"
            else:
                info = "phiên này"
            result.append((icon, label, info))
        return result

item_fx = ItemEffectSystem()
_ck("MD_CHECKPOINT: 25 item_fx created")

# =========================================================
# LOAD RESOURCES
# =========================================================
base_path = os.path.dirname(os.path.abspath(__file__))

if getattr(sys, "frozen", False):
    writable_base = os.path.dirname(os.path.abspath(sys.executable))
else:
    writable_base = base_path

SESSION_FILE = os.path.join(writable_base, "session.json")

def load_image(name, size=None):
    """Load ảnh an toàn — trả None nếu file không tồn tại."""
    path = os.path.join(base_path, name)
    if not os.path.exists(path):
        return None
    try:
        img = pygame.image.load(path).convert_alpha()
        if size:
            img = pygame.transform.smoothscale(img, size)
        return img
    except Exception:
        return None

# Tất cả ảnh được khai báo None — load thật trong init_display()
clover_image          = None
background_img        = None
defeat_bg_img         = None
DEFAULT_CHARACTER_IMG = None
character_img         = None
icon_img              = None
setting_img           = None
setting_rect          = None
img_vic_text          = None

AVATAR_DIR = os.path.join(writable_base, "avatars")
if not IS_WEB_BUILD:
    try:
        os.makedirs(AVATAR_DIR, exist_ok=True)
    except (OSError, IOError):
        pass
def choose_local_image_file():
    """Mở hộp thoại chọn ảnh từ máy. Trả về đường dẫn hoặc None."""
    # BUG FIX (pygbag): tkinter không tồn tại trong Pyodide/WASM — trả None ngay.
    if IS_WEB_BUILD:
        return None
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.askopenfilename(
            title="Chọn ảnh avatar",
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.webp *.bmp"),
                ("All files", "*.*"),
            ],
        )
        root.destroy()
        return selected if selected else None
    except (ImportError, ModuleNotFoundError) as e:
        logger.warning(f"Không thể mở hộp thoại chọn ảnh (thiếu tkinter trên hệ thống này): {e}")
        return None
    except Exception as e:
        # tkinter.TclError và các lỗi hiển thị/GUI khác đều được ghi log để dễ chẩn đoán,
        # thay vì bị nuốt âm thầm như trước.
        logger.error(f"Lỗi khi mở hộp thoại chọn ảnh avatar: {e}")
        return None
def load_character_from_path(path, size=(600, 600)):
    if not path or not os.path.exists(path):
        return DEFAULT_CHARACTER_IMG
    try:
        loaded = pygame.image.load(path).convert_alpha()
        return pygame.transform.smoothscale(loaded, size)
    except (pygame.error, FileNotFoundError, OSError) as e:
        logger.warning(f"Không nạp được ảnh avatar từ '{path}': {e}")
        return DEFAULT_CHARACTER_IMG
def refresh_character_avatar():
    """Đồng bộ character_img theo avatar người dùng hiện tại."""
    global character_img
    
    # Kiểm tra xem account_system đã được khởi tạo và có user đăng nhập chưa
    if 'account_system' in globals() and account_system.current_user:
        d = account_system.data()
        avatar_path = d.get("avatar_path", "")
        
        if avatar_path and os.path.exists(avatar_path):
            character_img = load_character_from_path(avatar_path)
            return
            
    # Nếu không có avatar hoặc đường dẫn không hợp lệ, dùng ảnh mặc định
    character_img = DEFAULT_CHARACTER_IMG

# =========================================================
# LƯU Ý QUAN TRỌNG:
# Trong đoạn code trên của bạn, đối tượng `account_system` được sử dụng 
# rất nhiều lần (trong add_xp, add_gold, GachaBannerSystem...) nhưng 
# CHƯA ĐƯỢC IMPORT hoặc KHỞI TẠO. 
# Bạn cần thêm dòng này (tùy thuộc vào cấu trúc code của bạn):
# =========================================================
# from account_manager import AccountSystem
# account_system = AccountSystem()
# UI Design System - Fixed sizes and consistent styling
FONT_SIZES = {
    'title': 32,
    'subtitle': 24,
    'button': 18,
    'normal': 14,
    'small': 12
}
# UI Colors - Limited palette for professional look
COLORS = {
    'primary': (0, 188, 212),        # Cyan
    'success': (76, 175, 80),       # Green
    'danger': (244, 67, 54),        # Red
    'warning': (255, 152, 0),       # Orange
    'accent': (255, 215, 0),        # Gold/Yellow
    'secondary': (138, 43, 176),    # Purple
    'background': (13, 27, 42),     # Dark Blue
    'text': (255, 255, 255),        # White
    'text_secondary': (176, 190, 197), # Light Gray
    'card': (23, 43, 77),           # Dark Blue Card
    'shadow': (0, 0, 0, 80)         # Black with alpha
}
GREEN_BTN = COLORS['success']      # (76, 175, 80)
BLUE_BTN = COLORS['primary']       # (70, 130, 180)
RED_BTN = COLORS['danger']         # (244, 67, 54)
YELLOW_BTN = COLORS['accent']       # (255, 215, 0)
PURPLE_BTN = COLORS['secondary']    # (138, 43, 176)
ORANGE_BTN = COLORS['warning']      # (255, 152, 0)
SHADOW = (100, 100, 100)          # Softer shadow
# Spacing constants
MARGIN = 20
PADDING = 12
CARD_RADIUS = 20
BUTTON_RADIUS = 12
class Transition:
    """Smooth transition system for scene changes"""
    def __init__(self):
        self.alpha = 0
        self.target_alpha = 0
        self.fade_speed = 8
        self.active = False
        self.callback = None
    def start_fade_out(self, callback=None):
        """Start fade to black"""
        self.target_alpha = 255
        self.active = True
        self.callback = callback
    def start_fade_in(self):
        """Start fade from black"""
        self.target_alpha = 0
        self.active = True
    def update(self, dt):
        """Update transition animation"""
        if not self.active:
            return
        # Smooth alpha transition
        if self.alpha < self.target_alpha:
            self.alpha = min(self.target_alpha, self.alpha + self.fade_speed)
        elif self.alpha > self.target_alpha:
            self.alpha = max(self.target_alpha, self.alpha - self.fade_speed)
        # Check if transition complete
        if self.alpha == self.target_alpha:
            if self.alpha == 255 and self.callback:
                # Fade out complete, execute callback
                self.callback()
                self.callback = None
                self.start_fade_in()  # Auto start fade in
            elif self.alpha == 0:
                # Fade in complete
                self.active = False
    def draw(self, surface):
        """Draw transition overlay"""
        if self.alpha > 0:
            overlay = pygame.Surface((WIDTH, HEIGHT))
            overlay.set_alpha(self.alpha)
            overlay.fill((0, 0, 0))
            surface.blit(overlay, (0, 0))
    def is_active(self):
        """Check if transition is active"""
        return self.active
# Global transition system
transition = Transition()
_ck("MD_CHECKPOINT: 26 transition created")
class ComboPopup:
    """Animated combo popup with scale, fade, and movement"""
    def __init__(self, x, y, combo_count):
        self.x = x
        self.y = y
        self.start_y = y
        self.combo_count = combo_count
        self.scale = 0.5
        self.alpha = 255
        self.lifetime = 2.0
        self.velocity_y = -50  # Move upward
    def update(self, dt):
        # Move upward
        self.y += self.velocity_y * dt
        self.velocity_y *= 0.95  # Slow down
        # Scale animation
        if self.scale < 1.2:
            self.scale += 0.02
        # Fade out
        self.lifetime -= dt
        if self.lifetime < 0.5:
            self.alpha = int(255 * (self.lifetime / 0.5))
    def draw(self, surface):
        if self.alpha <= 0:
            return
        # Create text
        font = get_font('title')
        text = f"COMBO x{self.combo_count}!"
        # Render with current scale
        scaled_size = int(font.get_height() * self.scale)
        temp_font = pygame.font.Font(None, scaled_size)
        text_surf = temp_font.render(text, True, COLORS['accent'])
        text_surf.set_alpha(self.alpha)
        # Center at position
        text_rect = text_surf.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(text_surf, text_rect)
    def is_finished(self):
        return self.lifetime <= 0
class ComboPopupManager:
    """Manages multiple combo popups"""
    def __init__(self):
        self.popups = []
        self.max_popups = 5  # Limit for performance
    def add_combo(self, x, y, combo_count):
        """Add a new combo popup"""
        if len(self.popups) >= self.max_popups:
            # Remove oldest popup
            self.popups.pop(0)
        self.popups.append(ComboPopup(x, y, combo_count))
    def update(self, dt):
        """Update all popups"""
        self.popups = [p for p in self.popups if not p.is_finished()]
        for popup in self.popups:
            popup.update(dt)
    def draw(self, surface):
        """Draw all popups"""
        for popup in self.popups:
            popup.draw(surface)
# Global combo popup manager
combo_popup_manager = ComboPopupManager()
_ck("MD_CHECKPOINT: 27 combo_popup_manager created (entering big class-definition zone...)")
_TEXT_RENDER_CACHE = {}
_SCALED_BG_CACHE = {}
_FONT_CACHE = {}
_ICON_FONT_CACHE = {}
# Emoji/icon: luôn dùng Segoe UI Emoji.ttf
_EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001FAFF\U00002700-\U000027BF\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF\U00002600-\U000026FF\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FAFF\U0000231A-\U0000231B\U000023E9-\U000023F3"
    "\U000025FD-\U000025FE\U00002614-\U00002615\U00002648-\U00002653"
    "\U000026A1\U000026AA-\U000026AB\U000026BD-\U000026BE\U000026C4-\U000026C5"
    "\U000026CE\U000026D4\U000026EA\U000026F2-\U000026F3\U00002708-\U0000270D"
    "\U0000270F\U00002712\U00002714\U00002716\U00002728\U00002733-\U00002734"
    "\U00002744\U00002747\U0000274C\U0000274E\U00002753-\U00002755\U00002757"
    "\U00002795-\U00002797\U000027A1\U000027B0\U000027BF\U00002B50\U00002B55"
    "\U00003030\U0000303D\U00003297\U00003299\U0000FE0F\U0000200D"
    "\u2211\u03C0\u221A\u221E\u00B1\u00D7\u00F7"
    "]+",
    flags=re.UNICODE,
)

def contains_emoji(text):
    return bool(text and _EMOJI_PATTERN.search(text))

def _segment_text_emoji(text):
    if not text:
        return []
    segments = []
    pos = 0
    for match in _EMOJI_PATTERN.finditer(text):
        if match.start() > pos:
            segments.append(("text", text[pos:match.start()]))
        segments.append(("emoji", match.group()))
        pos = match.end()
    if pos < len(text):
        segments.append(("text", text[pos:]))
    return segments if segments else [("text", text)]

def load_icon_font(size):
    """Load icon/emoji font — chỉ dùng Segoe UI Emoji.ttf."""
    size = max(8, int(size))
    if size in _ICON_FONT_CACHE:
        return _ICON_FONT_CACHE[size]
    if os.path.isfile(SEGOE_EMOJI_TTF):
        f = pygame.font.Font(SEGOE_EMOJI_TTF, size)
    else:
        try:
            f = pygame.font.SysFont("Segoe UI Emoji", size)
        except pygame.error:
            f = pygame.font.SysFont(None, size)
    _ICON_FONT_CACHE[size] = f
    return f

def render_text_mixed(text, text_font, color, gap=2, icon_size=None):
    """Render chuỗi có cả chữ và emoji: emoji dùng Segoe UI Emoji.ttf."""
    segments = _segment_text_emoji(text)
    if len(segments) == 1 and segments[0][0] == "text":
        return render_cached_text(text_font, segments[0][1], color, supersample=True, _skip_emoji_check=True)
    isize = icon_size or text_font.get_height()
    icon_font = load_icon_font(isize)
    surfaces = []
    for kind, chunk in segments:
        if not chunk:
            continue
        if kind == "emoji":
            surfaces.append(render_cached_text(icon_font, chunk, color, supersample=False, _skip_emoji_check=True))
        else:
            surfaces.append(render_cached_text(text_font, chunk, color, supersample=True, _skip_emoji_check=True))
    if not surfaces:
        return pygame.Surface((1, 1), pygame.SRCALPHA)
    total_w = sum(s.get_width() for s in surfaces) + gap * (len(surfaces) - 1)
    total_h = max(s.get_height() for s in surfaces)
    out = pygame.Surface((max(1, total_w), max(1, total_h)), pygame.SRCALPHA)
    x = 0
    for surf in surfaces:
        out.blit(surf, (x, (total_h - surf.get_height()) // 2))
        x += surf.get_width() + gap
    return out

def get_font(size_name):
    """Get font by size name for consistent UI"""
    if size_name not in FONT_SIZES:
        size_name = 'normal'
    size = FONT_SIZES[size_name]
    key = (size_name, size)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    # Đường dẫn tuyệt đối đến file font
    path = os.path.join(base_path, "Quicksand-Bold.ttf")
    try:
        # Ưu tiên dùng Quicksand-Bold.ttf
        font = pygame.font.Font(path, size)
        _FONT_CACHE[key] = font
        return font
    except (pygame.error, FileNotFoundError, OSError) as e:
        # Fallback: dùng font hệ thống hỗ trợ emoji
        print(f"Không nạp được Quicksand: {e}")
        # Thử các font hỗ trợ emoji theo thứ tự ưu tiên
        emoji_fonts = ["Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "DejaVu Sans"]
        for font_name in emoji_fonts:
            try:
                font = pygame.font.SysFont(font_name, size, bold=True)
                _FONT_CACHE[key] = font
                return font
            except pygame.error:
                continue
        # Fallback cuối cùng: dùng font mặc định
        font = pygame.font.SysFont(None, size, bold=True)
        _FONT_CACHE[key] = font
        return font
def load_font(size):
    """Legacy function - use get_font() instead"""
    return get_font('normal' if size <= 18 else 'button' if size <= 24 else 'subtitle' if size <= 32 else 'title')
def _is_dynamic_text(text):
    """Detect if text is likely to change every frame (counters, scores, coordinates)"""
    # Skip supersampling for numbers, timers, coordinates
    if text.isdigit() or ':' in text and text.count(':') >= 1:
        return True
    # Likely coordinates or rapid-changing values
    if ',' in text and text.count(',') >= 1:
        return True
    # Very short text that might update frequently
    if len(text) <= 5:
        return True
    return False
def render_cached_text(font_obj, text, color, supersample=True, _skip_emoji_check=False):
    """Cache text surfaces with advanced anti-aliasing techniques."""
    if not text:
        return pygame.Surface((1, 1), pygame.SRCALPHA)
    
    # Lọc bỏ các ký tự Variation Selectors (\ufe00-\ufe0f) gây lỗi zero-width
    if any(u'\ufe00' <= c <= u'\ufe0f' for c in text):
        text = "".join(c for c in text if not (u'\ufe00' <= c <= u'\ufe0f'))
        if not text:
            return pygame.Surface((1, 1), pygame.SRCALPHA)

    # Defensive check for zero-width text
    try:
        if font_obj.size(text)[0] == 0:
            # Try to filter out non-printable/zero-width characters (like variation selectors)
            # If still zero, use a placeholder
            filtered_text = "".join(c for c in text if ord(c) > 32)
            if not filtered_text or font_obj.size(filtered_text)[0] == 0:
                # Log warning and use placeholder
                logger.warning(f"Text '{repr(text)}' has zero width in font. Using placeholder.")
                text = "?"
    except Exception as e:
        logger.error(f"Failed to measure text width for '{repr(text)}': {e}")
        return pygame.Surface((1, 1), pygame.SRCALPHA)

    if not _skip_emoji_check and contains_emoji(text):
        return render_text_mixed(text, font_obj, color)
    
    # Skip expensive supersampling for dynamic text (counters, scores, etc.)
    if supersample and _is_dynamic_text(text):
        supersample = False
    
    key = (id(font_obj), text, color, supersample)
    surf = _TEXT_RENDER_CACHE.get(key)
    if surf is not None:
        return surf
    if supersample and font_obj.get_height() >= 16:  # Only for readable text sizes
        # Supersampling technique: render at 2x size, then scale down
        original_size = font_obj.get_height()
        try:
            # Use Quicksand-Bold.ttf for consistent high-quality rendering
            super_font = pygame.font.Font(os.path.join(base_path, "Quicksand-Bold.ttf"), original_size * 2)
        except (pygame.error, FileNotFoundError, OSError):
            super_font = load_icon_font(original_size * 2)
        # Render at 2x size
        super_surf = super_font.render(text, True, color)
        # Scale down with high quality
        surf = pygame.transform.smoothscale(super_surf, (super_surf.get_width() // 2, super_surf.get_height() // 2))
    else:
        # Standard rendering for small text
        surf = font_obj.render(text, True, color)
    # Ensure alpha channel for better blending
    if (surf.get_flags() & pygame.SRCALPHA) == 0:
        surf = surf.convert_alpha()
    # LRU cache: remove oldest 500 entries when limit reached (use popitem for efficiency)
    if len(_TEXT_RENDER_CACHE) > 3000:
        for _ in range(500):
            try:
                # Remove oldest first (FIFO) - popitem doesn't accept args in Python 3.7+
                _TEXT_RENDER_CACHE.pop(next(iter(_TEXT_RENDER_CACHE)))
            except KeyError:
                break
    _TEXT_RENDER_CACHE[key] = surf
    return surf
def render_cached_text_enhanced(font_obj, text, color, aa=True, encoding='utf-8'):
    """Enhanced text rendering with better anti-aliasing and emoji support"""
    if not text:
        return pygame.Surface((1, 1), pygame.SRCALPHA)
    
    # Defensive check for zero-width text
    try:
        if font_obj.size(text)[0] == 0:
            logger.warning(f"Enhanced text '{repr(text)}' has zero width. Using placeholder.")
            text = "?"
    except pygame.error:
        return pygame.Surface((1, 1), pygame.SRCALPHA)

    if contains_emoji(text):
        return render_text_mixed(text, font_obj, color)
    cache_key = (id(font_obj), text, color, aa)
    if cache_key in _TEXT_RENDER_CACHE:
        return _TEXT_RENDER_CACHE[cache_key]
    # Enable anti-aliasing and proper encoding
    if aa:
        try:
            # Try rendering with Unicode support
            text_surface = font_obj.render(text, True, color)
        except (pygame.error, UnicodeError):
            # Fallback for problematic characters
            text_surface = font_obj.render(text.encode('ascii', 'ignore').decode('ascii'), True, color)
    else:
        text_surface = font_obj.render(text, False, color)
    _TEXT_RENDER_CACHE[cache_key] = text_surface
    return text_surface
def render_text_fitted(text, font, color, max_width, max_lines=2):
    """Render text that automatically fits within specified width with line breaks"""
    if not text:
        return [pygame.Surface((1, 1), pygame.SRCALPHA)]
        
    words = text.split(' ')
    lines = []
    current_line = []
    for word in words:
        # Test if adding this word would exceed max_width
        test_line = ' '.join(current_line + [word])
        test_surface = font.render(test_line, True, color)
        if test_surface.get_width() <= max_width:
            current_line.append(word)
        else:
            # Start new line
            if current_line:
                lines.append(' '.join(current_line))
                current_line = [word]
            else:
                # Word is too long, truncate it
                truncated = word
                while len(truncated) > 1:
                    test_surface = font.render(truncated + "...", True, color)
                    if test_surface.get_width() <= max_width:
                        break
                    truncated = truncated[:-1]
                lines.append(truncated + "...")
                current_line = []
    # Add remaining words
    if current_line:
        lines.append(' '.join(current_line))
    # Limit number of lines
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        if len(lines[-1]) > 3:
            lines[-1] = lines[-1][:-3] + "..."
    # Render lines
    line_surfaces = []
    for line in lines:
        line_surface = font.render(line, True, color)
        line_surfaces.append(line_surface)
    return line_surfaces
_SCALED_BG_CACHE_MAX = 6  # Ảnh nền full màn hình khá nặng (vài MB/ảnh) — giữ ít bản
                          # trong RAM để tránh tràn bộ nhớ trên máy cấu hình thấp.
def get_scaled_background(bg_img, size, alpha):
    if bg_img is None:
        return None
    # Không cache riêng theo từng giá trị alpha: alpha chỉ là một cờ có thể set động
    # trên cùng một surface đã scale (rẻ), khác với việc scale lại ảnh (đắt). Trước đây
    # mỗi (ảnh, kích thước, alpha) là MỘT bản sao ảnh riêng trong cache — dễ giữ hàng
    # chục ảnh nền lớn cùng lúc trong RAM. Giờ chỉ cache theo (ảnh, kích thước).
    key = (id(bg_img), size[0], size[1])
    surf = _SCALED_BG_CACHE.get(key)
    if surf is None:
        surf = pygame.transform.smoothscale(bg_img, size)
        if len(_SCALED_BG_CACHE) >= _SCALED_BG_CACHE_MAX:
            # Xóa mục cũ nhất (FIFO) — dict giữ thứ tự chèn trong Python 3.7+.
            oldest_key = next(iter(_SCALED_BG_CACHE))
            del _SCALED_BG_CACHE[oldest_key]
        _SCALED_BG_CACHE[key] = surf
    surf.set_alpha(alpha)
    return surf
font_big = None  # tạo trong init_display()
font_med = None
font_small = None
_LEADING_ICON_TOKENS = (
    "🔥", "💎", "⚡", "⭐", "⏱️", "🏆", "🎯", "🎉", "🧠", "🔒",
    "🌱", "🍀", "✨", "🌟", "👑", "☄️", "🌌", "💥", "📕", "📗",
    "🐾", "✏️", "🧮", "💰", "🔍", "👤", "🌳", "🎁", "📋", "🪄",
    "🔦", "🖊️", "🌈", "🪵", "💡", "🌊", "🍭", "⚠️", "💡", "⚡",
    "⬅️", "➡️", "🏠", "🔄", "🧐", "📖", "🌐", "✅", "❌", "🔓",
)
def _split_leading_icon(text):
    if not text:
        return None, ""
    for tok in _LEADING_ICON_TOKENS:
        if text.startswith(tok):
            rest = text[len(tok):]
            if rest.startswith(" "):
                return tok, rest[1:]
            return tok, rest
    return None, text
def render_text_with_leading_icon(text, text_font, icon_font, color, gap=6):
    icon, rest = _split_leading_icon(text)
    if not icon:
        if contains_emoji(text):
            return render_text_mixed(text, text_font, color, gap=gap)
        return render_cached_text(text_font, text, color)
    icon_font = load_icon_font(
        icon_font.get_height() if hasattr(icon_font, "get_height") else text_font.get_height()
    )
    icon_surf = render_cached_text(icon_font, icon, color, supersample=False, _skip_emoji_check=True)
    rest_surf = render_cached_text(text_font, rest, color) if rest else None
    w = icon_surf.get_width() + (gap + rest_surf.get_width() if rest_surf else 0)
    h = max(icon_surf.get_height(), rest_surf.get_height() if rest_surf else 0)
    surf = pygame.Surface((w, h), pygame.SRCALPHA)
    surf.blit(icon_surf, (0, (h - icon_surf.get_height()) // 2))
    if rest_surf:
        surf.blit(rest_surf, (icon_surf.get_width() + gap, (h - rest_surf.get_height()) // 2))
    return surf
class GameState:
    def enter(self): pass
    def handle_event(self, e): pass
    def update(self, dt): pass
    def draw(self, s): pass
# =========================================================
# UI COMPONENTS
# =========================================================
def draw_text_center(surface, text, font, color, x, y, enhanced=True):
    if contains_emoji(text):
        text_surf = render_text_mixed(text, font, color)
    elif enhanced and font.get_height() >= 12:
        text_surf = render_cached_text_enhanced(font, text, color)
    else:
        text_surf = render_cached_text(font, text, color)
    text_rect = text_surf.get_rect(center=(x, y))
    surface.blit(text_surf, text_rect)
def draw_text_shadow(surface, text, font, color, x, y, center=True, enhanced=True):
    # Enhanced shadow rendering with sub-pixel precision
    shadow_color = (color[0]//3, color[1]//3, color[2]//3) if len(color) == 3 else (50, 50, 50)
    if enhanced and font.get_height() >= 12:
        shadow_obj = render_cached_text_enhanced(font, text, shadow_color)
        text_obj = render_cached_text_enhanced(font, text, color)
    else:
        shadow_obj = render_cached_text(font, text, shadow_color)
        text_obj = render_cached_text(font, text, color)
    shadow_rect = shadow_obj.get_rect()
    text_rect = text_obj.get_rect()  # Create text_rect from text_obj
    if center:
        shadow_rect.center = (x + 1, y + 1)  # Reduced offset for sub-pixel
        text_rect.center = (x, y)
    else:
        shadow_rect.topleft = (x + 1, y + 1)
        text_rect.topleft = (x, y)
    surface.blit(shadow_obj, shadow_rect)
    surface.blit(text_obj, text_rect)
def draw_multiline_theory(surface, text, font, color, rect):
    words = text.split(' ')
    lines = []; current_line = ""
    for word in words:
        test_line = current_line + word + " "
        if font.size(test_line)[0] < rect.width: current_line = test_line
        else:
            lines.append(current_line)
            current_line = word + " "
    lines.append(current_line)
    y = rect.y
    for line in lines:
        text_surf = render_cached_text(font, line.strip(), color)
        surface.blit(text_surf, (rect.x, y))
        y += font.get_linesize() + 5
def draw_multiline_text(surface, text, font, color, rect):
    draw_multiline_theory(surface, text, font, color, rect)
# =========================================================
# FEEDBACK SYSTEM - Giải thích khi trả lời sai
# =========================================================
def generate_explanation(question, correct_answer, q_type):
    """Tạo lời giải thích đơn giản cho câu trả lời đúng"""
    ans = str(correct_answer)
    if q_type == "arithmetic":
        # Tìm phép tính trong câu hỏi
        for op_sym in ['+', '-', 'x', '×', '*']:
            if op_sym in question:
                return f"Đáp án đúng là {ans}. Ta tính từng bước theo thứ tự phép tính."
        return f"Đáp án đúng là {ans}."
    elif q_type == "compare":
        return f"Đáp án đúng là {ans}. So sánh hai số bằng cách nhìn giá trị của chúng."
    elif q_type == "geo":
        return f"Đáp án đúng là {ans}. Hãy nhớ đặc điểm của các hình học cơ bản."
    elif q_type == "measure":
        return f"Đáp án đúng là {ans}. Chú ý đơn vị đo lường."
    elif q_type == "clock":
        return f"Đáp án đúng là {ans}. Kim ngắn chỉ giờ, kim dài chỉ phút."
    elif q_type == "logic":
        return f"Đáp án đúng là {ans}. Đọc kỹ đề bài và suy luận từng bước."
    elif q_type == "split":
        return f"Đáp án đúng là {ans}. Tách hoặc gộp số theo cấu tạo."
    elif q_type == "days":
        return f"Đáp án đúng là {ans}. Nhớ thứ tự các ngày trong tuần."
    return f"Đáp án đúng là {ans}."

# =========================================================
# TAG-BASED KNOWLEDGE TRACING — phân rã câu hỏi thành các "thẻ" kỹ năng nhỏ
# (micro-skills) để AI biết chính xác học sinh yếu ở đâu, thay vì chỉ nhìn
# điểm số tổng của cả bài/chủ đề. Vì module sinh câu hỏi (smart_ai.py) không
# có sẵn để gắn thẻ ngay lúc sinh, các thẻ được SUY LUẬN NGƯỢC từ nội dung
# câu hỏi (self.q) đã sinh ra — không cần sửa smart_ai.py.
# =========================================================
_ARITH_OP_RE = re.compile(r'(\d+)\s*([\+\-x×\*:÷])\s*(\d+)')

SKILL_TAG_TIPS = {
    "co_nho": "Mẹo: khi cộng một cột mà tổng ≥ 10, viết chữ số hàng đơn vị và NHỚ 1 sang cột bên trái nhé!",
    "muon": "Mẹo: khi số bị trừ ở một cột nhỏ hơn số trừ, hãy MƯỢN 1 từ cột bên trái rồi trừ tiếp!",
    "bang_cuu_chuong": "Mẹo: ôn lại bảng cửu chương của số này để tính nhanh hơn nhé!",
    "phep_nhan_2_chu_so": "Mẹo: nhân lần lượt từng chữ số, nhớ đặt đúng cột trước khi cộng lại nhé!",
}

# Ma trận kiến thức: ánh xạ q_type (loại câu hỏi do SmartAI phân loại) sang thẻ
# kỹ năng tương ứng, để hệ thống báo cáo biết chính xác học sinh yếu ở MẢNG
# KIẾN THỨC nào (không chỉ "arithmetic" chung chung).
Q_TYPE_SKILL_TAGS = {
    "compare": "so_sanh",
    "geo": "hinh_hoc",
    "measure": "do_luong",
    "clock": "xem_gio",
    "logic": "toan_co_loi_van",
    "split": "cau_tao_so",
    "days": "ngay_thang",
}

def derive_skill_tags(question, q_type):
    """Suy ra danh sách thẻ kỹ năng (Ma trận kiến thức) từ một câu hỏi đã được
    sinh ra — bao gồm cả câu hỏi số học (phân tích chi tiết: co_nho, bang_cuu_chuong...)
    lẫn các mảng kiến thức khác (hình học, so sánh, toán có lời văn...). Trả về
    [] nếu không nhận diện được."""
    tags = []
    if not question:
        return tags
    if q_type != "arithmetic":
        # Các mảng kiến thức phi số học vẫn cần được gắn thẻ để báo cáo điểm yếu
        # theo đúng "Ma trận kiến thức" — không chỉ đánh giá Đúng/Sai chung chung.
        mapped = Q_TYPE_SKILL_TAGS.get(q_type)
        if mapped:
            tags.append(mapped)
        return tags
    m = _ARITH_OP_RE.search(question)
    if not m:
        return tags
    try:
        a, op_sym, b = int(m.group(1)), m.group(2), int(m.group(3))
    except ValueError:
        return tags
    if op_sym == '+':
        tags.append("phep_cong")
        sa, sb = str(a)[::-1], str(b)[::-1]
        carry, has_carry = 0, False
        for i in range(max(len(sa), len(sb))):
            da = int(sa[i]) if i < len(sa) else 0
            db = int(sb[i]) if i < len(sb) else 0
            if da + db + carry >= 10:
                has_carry, carry = True, 1
            else:
                carry = 0
        tags.append("co_nho" if has_carry else "khong_nho")
    elif op_sym == '-':
        tags.append("phep_tru")
        sa, sb = str(a)[::-1], str(b)[::-1]
        borrow, has_borrow = 0, False
        for i in range(max(len(sa), len(sb))):
            da = (int(sa[i]) if i < len(sa) else 0) - borrow
            db = int(sb[i]) if i < len(sb) else 0
            if da < db:
                has_borrow, borrow = True, 1
            else:
                borrow = 0
        tags.append("muon" if has_borrow else "khong_muon")
    elif op_sym in ('x', '×', '*'):
        tags.append("phep_nhan")
        if a <= 10 and b <= 10:
            tags.append("bang_cuu_chuong")
        elif a >= 10 and b >= 10:
            tags.append("phep_nhan_2_chu_so")
    elif op_sym in (':', '÷'):
        tags.append("phep_chia")
    max_digits = max(len(str(a)), len(str(b)))
    if max_digits <= 1:
        tags.append("mot_chu_so")
    elif max_digits == 2:
        tags.append("hai_chu_so")
    else:
        tags.append("ba_chu_so_tro_len")
    return tags

# =========================================================
# GUARDRAIL BÁM SÁT CHƯƠNG TRÌNH GDPT 2018 — chống "AI hallucination"
# (SmartAI có thể sinh ra đáp án âm hoặc số thập phân phức tạp không có trong
# chương trình tiểu học). Vì module sinh câu hỏi (smart_ai.py) không có sẵn để
# sửa trực tiếp, guardrail hoạt động như một TẦNG KIỂM DUYỆT sau khi câu hỏi đã
# được sinh ra: xác thực theo khối lớp, tự động yêu cầu sinh lại nếu vi phạm,
# và dùng bộ sinh câu hỏi DỰ PHÒNG cục bộ (luôn đúng chuẩn) nếu vẫn thất bại.
# =========================================================

# Phạm vi số hợp lệ theo từng khối lớp (theo chương trình Toán Tiểu học GDPT 2018).
GRADE_NUMBER_RANGE = {1: (0, 100), 2: (0, 1000), 3: (0, 100000), 4: (0, 1000000), 5: (0, 1000000)}
# Phép tính được phép theo khối lớp — lớp 1 CHƯA học nhân/chia chính thức.
GRADE_ALLOWED_OPS = {
    1: {'+', '-'},
    2: {'+', '-', 'x', '×', '*', ':', '÷'},
    3: {'+', '-', 'x', '×', '*', ':', '÷'},
    4: {'+', '-', 'x', '×', '*', ':', '÷'},
    5: {'+', '-', 'x', '×', '*', ':', '÷'},
}
# Số thập phân CHỈ được dạy chính thức từ lớp 5 trở đi trong chương trình 2018.
GRADE_ALLOW_DECIMAL = {1: False, 2: False, 3: False, 4: False, 5: True}
MAX_DECIMAL_PLACES = 2  # Giới hạn độ phức tạp ngay cả khi lớp 5 được phép dùng số thập phân

_NUM_RE = re.compile(r'-?\d+(?:[.,]\d+)?')

def _parse_number_token(tok):
    tok = tok.replace(',', '.')
    return float(tok) if '.' in tok else int(tok)

def validate_question_for_grade(question, answer, grade, q_type="arithmetic"):
    """
    Kiểm tra một câu hỏi/đáp án đã sinh ra có nằm trong chương trình GDPT 2018
    của khối lớp tương ứng hay không. Trả về (True, "") nếu hợp lệ, hoặc
    (False, lý do) nếu vi phạm — dùng để quyết định có cần sinh lại câu hỏi.
    """
    grade = max(1, min(5, int(grade or 1)))
    lo, hi = GRADE_NUMBER_RANGE.get(grade, (0, 1000000))
    try:
        values = [_parse_number_token(t) for t in _NUM_RE.findall(question or "")]
        if answer is not None and str(answer).strip() != "":
            values.append(_parse_number_token(str(answer).replace(',', '.')))
    except ValueError:
        return False, "Không đọc được số trong câu hỏi/đáp án"

    for v in values:
        # 1) Số âm KHÔNG có trong chương trình Toán Tiểu học (chỉ học từ lớp 6/THCS).
        if v < 0:
            return False, f"Số âm ({v}) ngoài chương trình tiểu học"
        # 2) Số thập phân: chỉ lớp 5 được phép, và giới hạn độ phức tạp.
        if isinstance(v, float) and not float(v).is_integer():
            if not GRADE_ALLOW_DECIMAL.get(grade, False):
                return False, f"Số thập phân ({v}) chưa phù hợp với lớp {grade}"
            decimals = str(v).split('.')[-1]
            if len(decimals) > MAX_DECIMAL_PLACES:
                return False, f"Số thập phân quá phức tạp ({v})"
        # 3) Phạm vi số theo khối lớp.
        if v > hi:
            return False, f"Số {v} vượt phạm vi chương trình lớp {grade} (tối đa {hi})"

    # 4) Loại phép tính phải phù hợp khối lớp (vd: lớp 1 chưa học nhân/chia).
    if q_type == "arithmetic":
        m = _ARITH_OP_RE.search(question or "")
        if m:
            op_sym = m.group(2)
            if op_sym not in GRADE_ALLOWED_OPS.get(grade, set()):
                return False, f"Phép tính '{op_sym}' chưa có trong chương trình lớp {grade}"
    return True, ""

def _generate_distractors(correct_ans, count=3):
    """Sinh các đáp án nhiễu (sai) hợp lý, không âm, không trùng đáp án đúng —
    dùng cho bộ câu hỏi dự phòng an toàn."""
    opts = set()
    tries = 0
    while len(opts) < count and tries < 30:
        tries += 1
        delta = random.choice([-5, -3, -2, -1, 1, 2, 3, 5])
        cand = correct_ans + delta
        if cand != correct_ans and cand >= 0:
            opts.add(cand)
    opts = list(opts)
    i = 1
    while len(opts) < count:
        cand = correct_ans + i
        if cand not in opts and cand != correct_ans:
            opts.append(cand)
        i += 1
    all_opts = opts[:count] + [correct_ans]
    random.shuffle(all_opts)
    return all_opts

def generate_safe_fallback_question(grade):
    """
    Câu hỏi DỰ PHÒNG sinh cục bộ, đảm bảo 100% đúng chuẩn GDPT 2018 — dùng khi
    SmartAI liên tục sinh ra câu hỏi vi phạm guardrail, để học sinh KHÔNG BAO
    GIỜ phải thấy một câu hỏi ngoài chương trình, kể cả khi module sinh câu hỏi
    gặp sự cố.
    """
    grade = max(1, min(5, int(grade or 1)))
    _, hi = GRADE_NUMBER_RANGE.get(grade, (0, 100))
    safe_hi = min(hi, 100 if grade == 1 else (1000 if grade == 2 else hi))
    allowed_ops = list(GRADE_ALLOWED_OPS.get(grade, {'+', '-'}))
    op = random.choice(allowed_ops)
    if op == '+':
        a, b = random.randint(0, safe_hi), random.randint(0, safe_hi)
        if a + b > safe_hi:
            b = random.randint(0, max(0, safe_hi - a))
        q, ans = f"{a} + {b} = ?", a + b
    elif op == '-':
        a, b = random.randint(0, safe_hi), random.randint(0, safe_hi)
        hi_op, lo_op = max(a, b), min(a, b)
        q, ans, op = f"{hi_op} - {lo_op} = ?", hi_op - lo_op, '-'
    elif op in ('x', '×', '*'):
        a, b = random.randint(1, 10), random.randint(1, 10)
        q, ans, op = f"{a} x {b} = ?", a * b, 'x'
    else:  # chia
        b = random.randint(1, 10)
        result = random.randint(1, 10)
        a = b * result
        q, ans, op = f"{a} : {b} = ?", result, ':'
    opts = _generate_distractors(ans, 3)
    return q, ans, opts, op

def safe_generate_question(grade, lesson_id, difficulty, user_id=None, q_type="arithmetic", max_retries=4):
    """
    Bọc quanh SmartAI.generate_question(): thử sinh câu hỏi tối đa `max_retries`
    lần, kiểm tra từng câu qua validate_question_for_grade(). Nếu tất cả các
    lần thử đều vi phạm chương trình GDPT 2018 (vd AI sinh ra số âm/thập phân
    sai lớp), tự động chuyển sang generate_safe_fallback_question() để đảm bảo
    học sinh không bao giờ thấy câu hỏi ngoài chương trình.
    """
    for attempt in range(max_retries):
        try:
            result = SmartAI.generate_question(grade, lesson_id, difficulty, user_id=user_id)
        except Exception as e:
            # SmartAI là module ngoài (smart_ai.py) không kiểm soát được lỗi cụ thể
            # sẽ phát sinh — bắt rộng ở ranh giới với thư viện ngoài là hợp lý,
            # miễn là luôn ghi log để chẩn đoán (khác với việc "nuốt lỗi mù").
            logger.warning(f"Lỗi khi gọi SmartAI.generate_question (lần {attempt+1}): {e}")
            continue
        if not result:
            continue
        q, ans, opts, op = result[0], result[1], result[2], result[3]
        ok, reason = validate_question_for_grade(q, ans, grade, q_type=q_type)
        if ok:
            return q, ans, opts, op
        logger.info(f"Guardrail GDPT 2018 chặn câu hỏi lớp {grade}: {reason} — sinh lại (lần {attempt+1}/{max_retries}).")
    logger.warning(f"Dùng câu hỏi dự phòng an toàn cho lớp {grade} sau {max_retries} lần thử không thành công.")
    return generate_safe_fallback_question(grade)
class FeedbackOverlay:
    """Overlay hiển thị feedback khi trả lời sai - dạy lại người chơi"""
    def __init__(self, question, correct_answer, user_answer, q_type, is_correct, is_ta=False, extra_tip=None):
        self.is_correct = is_correct
        self.question = question
        self.correct_answer = str(correct_answer)
        self.user_answer = str(user_answer)
        self.q_type = q_type
        self.explanation = generate_explanation(question, correct_answer, q_type)
        if extra_tip:
            # Gợi ý MIỄN PHÍ từ hệ thống phát hiện điểm yếu theo thẻ kỹ năng
            # (sai 2 lần liên tiếp cùng một thẻ) — không trừ Vàng, không cần
            # mua "Bình Gợi Ý" từ cửa hàng.
            self.explanation = f"{self.explanation} 💡 {extra_tip}"
        self.timer = 0
        self.duration = 3.5 if not is_correct else 1.2  # Sai: 3.5s, Đúng: 1.2s
        self.alpha = 0
        self.active = True
        self.dismissed = False
        # New Effects
        if is_correct:
            # Confetti at the center of the screen
            if confetti_sys:
                confetti_sys.explode(WIDTH // 2, HEIGHT // 2, count=60)
            trigger_shake(3, 0.2) # Subtle shake
            
            # In Time Attack mode, only play sound 1.mp3
            if is_ta:
                sound_mgr = get_sound_manager()
                if sound_mgr: sound_mgr.play_sfx("sound 1")
            else:
                # tra_loi_dung.ogg is no longer used for correct answers as it's replaced by combo sounds
                pass

            # Score bonus text
            bonus = int(20 * player.combo_multiplier)
            self.floating_text = f"+{bonus} XP"
            add_xp(bonus)
            update_combo(True, silent=is_ta)
        else:
            trigger_shake(10, 0.4) # Strong shake
            if not is_ta and snd_wrong: snd_wrong.play()
            update_combo(False, silent=is_ta)
            self.floating_text = ""
    def update(self, dt):
        self.timer += dt
        # Fade in nhanh
        if self.timer < 0.2:
            self.alpha = min(255, int(self.timer * 1275))
        else:
            self.alpha = 255
        # Tự động tắt sau duration
        if self.timer >= self.duration:
            self.dismissed = True
            self.active = False
    def dismiss(self):
        """Cho phép click để bỏ qua"""
        self.dismissed = True
        self.active = False
    def draw(self, surface):
        if not self.active or self.alpha <= 0:
            return
        # Red Flash for incorrect
        if not self.is_correct and self.timer < 0.3:
            flash_alpha = int(120 * (1 - self.timer / 0.3))
            flash_surf = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            flash_surf.fill((255, 0, 0, flash_alpha))
            surface.blit(flash_surf, (0, 0))
        # Overlay tối
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, min(160, self.alpha // 2)))
        surface.blit(overlay, (0, 0))
        # Card feedback
        card_w, card_h = 750, 320 if not self.is_correct else 200
        card_x = WIDTH // 2 - card_w // 2
        card_y = HEIGHT // 2 - card_h // 2
        card_surf = pygame.Surface((card_w, card_h), pygame.SRCALPHA)
        if self.is_correct:
            # Card xanh cho đúng (more rounded, softer look)
            pygame.draw.rect(card_surf, (35, 130, 60, min(240, self.alpha)), (0, 0, card_w, card_h), border_radius=25)
            pygame.draw.rect(card_surf, (120, 255, 120, self.alpha), (0, 0, card_w, card_h), 4, border_radius=25)
            # Floating score text above card
            score_font = load_font(42)
            score_surf = score_font.render(self.floating_text, True, (255, 255, 0))
            score_y = card_y - 60 - math.sin(self.timer * 5) * 15
            surface.blit(score_surf, (WIDTH // 2 - score_surf.get_width() // 2, score_y))
            # Enhanced Combo text with effects
            combo_text = get_combo_text()
            if combo_text:
                combo_color = get_combo_color()
                # Dynamic font size based on combo level
                font_size = 28 + min(player.combo_streak // 3, 12)  # Bigger font for higher combos
                combo_font = load_font(font_size)
                # Add pulsing effect for high combos
                if player.combo_streak >= 5:
                    pulse = math.sin(self.timer * 8) * 3
                    combo_font.set_italic(True)  # Italic for style
                else:
                    pulse = 0
                combo_surf = render_text_mixed(combo_text, combo_font, combo_color)
                combo_rect = combo_surf.get_rect(center=(WIDTH // 2, score_y + 40 + pulse))
                # Add glow effect for high combos
                if player.combo_streak >= 7:
                    glow_surf = render_text_mixed(combo_text, combo_font, combo_color)
                    for offset in [(2, 2), (-2, -2), (2, -2), (-2, 2)]:
                        surface.blit(glow_surf, (combo_rect.x + offset[0], combo_rect.y + offset[1]))
                surface.blit(combo_surf, combo_rect)
                # Add particles for insane combos
                if player.combo_streak >= 10:
                    for _ in range(3):
                        particle_x = WIDTH // 2 + random.randint(-100, 100)
                        particle_y = combo_rect.centery + random.randint(-30, 30)
                        pygame.draw.circle(surface, combo_color, (particle_x, particle_y), random.randint(2, 5))
        else:
            # Card đỏ cho sai
            pygame.draw.rect(card_surf, (140, 40, 40, min(240, self.alpha)), (0, 0, card_w, card_h), border_radius=25)
            pygame.draw.rect(card_surf, (255, 120, 120, self.alpha), (0, 0, card_w, card_h), 4, border_radius=25)
        surface.blit(card_surf, (card_x, card_y))
        if self.is_correct:
            # Feedback đúng - ngắn gọn
            title_font = load_font(42)
            title = render_cached_text(title_font, "Chính xác! ✨", (120, 255, 120))
            surface.blit(title, (WIDTH // 2 - title.get_width() // 2, card_y + 40))
            ans_font = load_font(32)
            ans_text = render_cached_text(ans_font, f"Đáp án: {self.correct_answer}", (220, 255, 220))
            surface.blit(ans_text, (WIDTH // 2 - ans_text.get_width() // 2, card_y + 110))
        else:
            # Feedback sai - chi tiết
            title_font = load_font(42)
            title = render_cached_text(title_font, "Sai rồi! ❌", (255, 120, 120))
            surface.blit(title, (WIDTH // 2 - title.get_width() // 2, card_y + 35))
            # Đáp án đúng
            ans_font = load_font(30)
            ans_text = render_cached_text(ans_font, f"Đáp án đúng: {self.correct_answer}", (255, 225, 0))
            surface.blit(ans_text, (WIDTH // 2 - ans_text.get_width() // 2, card_y + 100))
            # Lời giải thích
            explain_font = load_font(22)
            explain_rect = pygame.Rect(card_x + 50, card_y + 160, card_w - 100, 130)
            draw_multiline_theory(surface, self.explanation, explain_font, (240, 240, 240), explain_rect)
            # Hướng dẫn tiếp tục
            hint_font = load_font(18)
            hint = render_cached_text(hint_font, "Nhấn phím bất kỳ hoặc click để tiếp tục...", (200, 200, 200))
            surface.blit(hint, (WIDTH // 2 - hint.get_width() // 2, card_y + card_h - 40))
# =========================================================
# PROGRESS BAR HELPER
# =========================================================
def draw_progress_bar(surface, x, y, w, h, current, total, label=""):
    """Vẽ thanh tiến độ với % hoàn thành"""
    ratio = current / total if total > 0 else 0
    # Nền
    pygame.draw.rect(surface, (60, 60, 60), (x, y, w, h), border_radius=h // 2)
    # Fill
    fill_w = int(w * ratio)
    if fill_w > 0:
        if ratio >= 0.8:
            fill_color = (100, 220, 100)  # Xanh
        elif ratio >= 0.5:
            fill_color = (220, 200, 50)   # Vàng
        else:
            fill_color = (100, 180, 220)  # Xanh dương
        pygame.draw.rect(surface, fill_color, (x, y, fill_w, h), border_radius=h // 2)
    # Viền
    pygame.draw.rect(surface, WHITE, (x, y, w, h), 2, border_radius=h // 2)
    # Text
    pct_text = f"{int(ratio * 100)}%"
    if label:
        pct_text = f"{label} {current}/{total} ({int(ratio * 100)}%)"
    pct_font = load_font(max(14, h - 4))
    pct_surf = pct_font.render(pct_text, True, WHITE)
    surface.blit(pct_surf, (x + w // 2 - pct_surf.get_width() // 2, y + h // 2 - pct_surf.get_height() // 2))
def generate_hard_exam(grade):
    questions = []
    if grade == 1:
        # Đề thi chuyển lớp 1 lên 2 theo format thực tế
        # Bài 1: Đặt tính rồi tính (2 câu cộng, 2 câu trừ)
        for i in range(4):
            if i < 2:  # Phép cộng
                a = random.randint(20, 50)
                b = random.randint(20, 50)
                ans = a + b
            else:  # Phép trừ
                a = random.randint(40, 100)
                b = random.randint(10, 40)
                ans = a - b
            questions.append({
                "type": "input",
                "q": f"Bài 1.{i+1}: Đặt tính rồi tính: {a} {'+' if i < 2 else '-'} {b}",
                "correct": str(ans),
                "user_ans": ""
            })
        # Bài 2: Sắp xếp số
        nums = random.sample(range(10, 100), 4)
        questions.append({
            "type": "mcq",
            "q": f"Bài 2: Sắp xếp các số {', '.join(map(str, nums))} theo thứ tự tăng dần:",
            "opts": [
                ','.join(map(str, sorted(nums))),
                ','.join(map(str, sorted(nums, reverse=True))),
                ','.join(map(str, [nums[2], nums[0], nums[3], nums[1]])),
                ','.join(map(str, [nums[1], nums[3], nums[0], nums[2]]))
            ],
            "correct": ','.join(map(str, sorted(nums))),
            "user_ans": None
        })
        # Bài 3: So sánh số
        nums_compare = random.sample(range(20, 100), 4)
        questions.append({
            "type": "mcq",
            "q": f"Bài 3: Khoanh tròn vào số bé nhất trong các số: {', '.join(map(str, nums_compare))}",
            "opts": [str(min(nums_compare)), str(max(nums_compare)), str(nums_compare[1]), str(nums_compare[2])],
            "correct": str(min(nums_compare)),
            "user_ans": None
        })
        # Bài 4: Điền số thích hợp
        a = random.randint(40, 90)
        b = random.randint(10, 40)
        questions.append({
            "type": "input",
            "q": f"Bài 4: Điền số thích hợp vào chỗ chấm: {a} - ...... = {a - b}",
            "correct": str(b),
            "user_ans": ""
        })
        # Bài 5: Tính biểu thức có 3 số
        a = random.randint(10, 40)
        b = random.randint(10, 40)
        c = random.randint(5, 20)
        questions.append({
            "type": "input",
            "q": f"Bài 5: Tính: {a} + {b} - {c} = ",
            "correct": str(a + b - c),
            "user_ans": ""
        })
        # Bài 6: Đoạn thẳng
        questions.append({
            "type": "mcq",
            "q": "Bài 6: Hình dưới đây có bao nhiêu đoạn thẳng?\n(Tham khảo hình có 3-5 đoạn thẳng)",
            "opts": ["3", "4", "5", "6"],
            "correct": str(random.choice([3, 4, 5])),
            "user_ans": None
        })
        # Bài 7: Đề bài có lời văn
        total = random.randint(40, 80)
        part1 = random.randint(10, 30)
        questions.append({
            "type": "input",
            "q": f"Bài 7: An có {total} quả táo, An cho em {part1} quả. Hỏi An còn bao nhiêu quả táo?",
            "correct": str(total - part1),
            "user_ans": ""
        })
        # Bài 8: Đề bài phức tạp hơn
        chickens = random.choice([40, 50, 60])
        ducks = random.randint(10, 30)
        questions.append({
            "type": "input",
            "q": f"Bài 8: Nhà Lan nuôi {chickens + ducks} con gà và vịt, trong đó có {chickens//10} chục con gà. Hỏi nhà Lan nuôi bao nhiêu con vịt?",
            "correct": str(ducks),
            "user_ans": ""
        })
    elif grade == 2:
        # Đề thi chuyển lớp 2 lên 3 theo format thực tế
        # Phần I: Trắc nghiệm (4 điểm)
        # Câu 1: Đọc số hàng trăm
        hundreds = random.randint(1, 9)
        tens = random.randint(0, 9)
        ones = random.randint(0, 9)
        correct_num = hundreds * 100 + tens * 10 + ones
        opts = [correct_num,
                hundreds * 100 + ones * 10 + tens,
                tens * 100 + hundreds * 10 + ones,
                ones * 100 + tens * 10 + hundreds]
        random.shuffle(opts)
        questions.append({
            "type": "mcq",
            "q": f"Câu 1: Số gồm {hundreds} trăm, {tens} chục và {ones} đơn vị là:",
            "opts": [str(x) for x in opts],
            "correct": str(correct_num),
            "user_ans": None
        })
        # Câu 2: Đọc số có 0
        hundreds = random.randint(1, 5)
        ones = random.randint(1, 9)
        correct_num = hundreds * 100 + ones
        questions.append({
            "type": "mcq",
            "q": f"Câu 2: Số {correct_num} được đọc là:",
            "opts": [
                f"{hundreds} trăm linh {ones}",
                f"{hundreds} không {ones}",
                f"{hundreds} mươi {ones}",
                f"{hundreds} trăm không {ones}"
            ],
            "correct": f"{hundreds} trăm linh {ones}" if tens == 0 else f"{hundreds} trăm không {ones}",
            "user_ans": None
        })
        # Câu 3: Phép chia
        a = random.randint(10, 30)
        b = random.randint(2, 5)
        c = a // b
        questions.append({
            "type": "mcq",
            "q": f"Câu 3: Trong phép nhân {a} : {b} = {c}, số {c} được gọi là:",
            "opts": ["Thương", "Tổng", "Tích", "Số hạng"],
            "correct": "Thương",
            "user_ans": None
        })
        # Câu 4: So sánh số
        nums = random.sample(range(100, 999), 4)
        questions.append({
            "type": "mcq",
            "q": f"Câu 4: Số bé nhất trong các số {', '.join(map(str, nums))} là:",
            "opts": [str(min(nums)), str(max(nums)), str(nums[1]), str(nums[2])],
            "correct": str(min(nums)),
            "user_ans": None
        })
        # Câu 5: Cộng nhiều số
        a = random.randint(10, 30)
        b = random.randint(20, 40)
        c = random.randint(10, 30)
        total = a + b + c
        questions.append({
            "type": "mcq",
            "q": f"Câu 5: Tính {a}kg + {b}kg + {c}kg = .....kg",
            "opts": [str(total), str(total + 10), str(total - 5), str(total + 7)],
            "correct": str(total),
            "user_ans": None
        })
        # Câu 6: Nhận biết hình
        shapes = ["khối trụ", "khối lập phương", "khối cầu", "khối hộp chữ nhật"]
        correct_shape = random.choice(shapes)
        questions.append({
            "type": "mcq",
            "q": "Câu 6: Quả bóng có hình:",
            "opts": shapes,
            "correct": "khối cầu",
            "user_ans": None
        })
        # Câu 7: Đúng/Sai
        statements = [
            (f"{random.randint(100, 500)} + {random.randint(100, 500)} = {random.randint(200, 1000)}", "Đ"),
            (f"{random.randint(500, 900)} - {random.randint(100, 400)} = {random.randint(100, 800)}", "S"),
            (f"{random.randint(10, 50)} : {random.randint(2, 5)} + {random.randint(60, 80)} = {random.randint(70, 90)}", "S"),
            (f"{random.randint(100, 500)} < {random.randint(600, 999)}", "Đ")
        ]
        stmt, answer = random.choice(statements)
        questions.append({
            "type": "mcq",
            "q": f"Câu 7: Phép tính {stmt} là:",
            "opts": ["Đúng", "Sai"],
            "correct": answer,
            "user_ans": None
        })
        # Phần II: Tự luận (3.5 điểm)
        # Bài 8: Đặt tính rồi tính
        for i in range(2):
            if i < 2:  # Phép trừ
                a = random.randint(200, 500)
                b = random.randint(100, 300)
                ans = a - b
            else:  # Phép cộng
                a = random.randint(100, 400)
                b = random.randint(100, 400)
                ans = a + b
            questions.append({
                "type": "input",
                "q": f"Bài 8.{i+1}: Đặt tính rồi tính: {a} {'-' if i < 2 else '+'} {b}",
                "correct": str(ans),
                "user_ans": ""
            })
        # Bài 9: Đề bài có lời văn
        morning = random.randint(200, 400)
        more = random.randint(10, 50)
        questions.append({
            "type": "input",
            "q": f"Bài 9: Một cửa hàng buổi sáng bán được {morning} kg gạo, buổi chiều bán nhiều hơn buổi sáng {more} kg gạo. Hỏi buổi chiều bán được bao nhiêu ki-lô-gam gạo?",
            "correct": str(morning + more),
            "user_ans": ""
        })
        # Bài 10: Cân nặng
        weights = [random.randint(1, 5) * 100, random.randint(1, 3) * 100, random.randint(50, 200)]
        questions.append({
            "type": "input",
            "q": f"Bài 10: Quan sát hình ảnh và ghi số ki-lô-gram tương ứng: {weights[0]}g, {weights[1]}g, {weights[2]}g. Chuyển đổi sang kg?",
            "correct": f"{weights[0]/100}, {weights[1]/100}, {weights[2]/1000}",
            "user_ans": ""
        })
    elif grade == 3:
        # Đề thi chuyển lớp 3 lên 4 theo format thực tế
        # Phần I: Trắc nghiệm (3 điểm)
        # Câu 1: Số lớn nhất
        nums = random.sample(range(8000, 9000), 4)
        questions.append({
            "type": "mcq",
            "q": f"Câu 1: Số lớn nhất trong các số {', '.join(map(str, nums))} là:",
            "opts": [str(max(nums)), str(nums[0]), str(nums[1]), str(nums[2])],
            "correct": str(max(nums)),
            "user_ans": None
        })
        # Câu 2: Kiến thức hình học
        questions.append({
            "type": "mcq",
            "q": "Câu 2: Chọn khẳng định SAI trong các khẳng định sau:",
            "opts": [
                "Độ dài bán kính bằng một nửa độ dài đường kính",
                "Độ dài đường kính gấp đôi bán kính",
                "Độ dài các bán kính không bằng nhau",
                "Tâm của hình tròn là trung điểm của đường kính"
            ],
            "correct": "Độ dài các bán kính không bằng nhau",
            "user_ans": None
        })
        # Câu 3: Ngày tháng
        questions.append({
            "type": "mcq",
            "q": "Câu 3: Ngày 27 tháng 2 là ngày chủ nhật. Hỏi ngày 01 tháng 3 cùng năm là ngày:",
            "opts": ["Thứ sáu", "Thứ ba", "Thứ tư", "Thứ năm"],
            "correct": "Thứ tư",
            "user_ans": None
        })
        # Câu 4: Phân số
        total = random.randint(60, 100)
        fraction = random.choice([2, 3, 4])
        remaining = total - total // fraction
        questions.append({
            "type": "mcq",
            "q": f"Câu 4: Một cuộn vải dài {total} m, đã bán 1/{fraction} cuộn vải. Hỏi cuộn vải còn lại bao nhiêu m?",
            "opts": [str(remaining), str(total // fraction), str(total - fraction), str(total + fraction)],
            "correct": str(remaining),
            "user_ans": None
        })
        # Câu 5: Dãy số liên tiếp
        start = random.randint(1000, 5000)
        questions.append({
            "type": "mcq",
            "q": f"Câu 5: Viết số thích hợp vào chỗ chấm: {start}, {start+1}, ..., {start+3}",
            "opts": [str(start-1), str(start-2), str(start+2), str(start+4)],
            "correct": str(start+2),
            "user_ans": None
        })
        # Câu 6: Số bé nhất có 3 chữ số khác nhau
        questions.append({
            "type": "mcq",
            "q": "Câu 6: Số bé nhất có 3 chữ số khác nhau là:",
            "opts": ["100", "101", "102", "103"],
            "correct": "102",
            "user_ans": None
        })
        # Phần II: Tự luận (7 điểm)
        # Câu 1: So sánh số
        num1 = random.randint(1000, 5000)
        num2 = num1 + random.randint(1, 10)
        questions.append({
            "type": "mcq",
            "q": f"Câu 7: Điền dấu thích hợp: {num1} ... {num2}",
            "opts": [">", "<", "="],
            "correct": "<",
            "user_ans": None
        })
        # Câu 2a: Tìm x (phép trừ)
        x_val = random.randint(3000, 6000)
        sub_val = random.randint(1000, 2000)
        questions.append({
            "type": "input",
            "q": f"Câu 8: Tìm x biết: x - {sub_val} = {x_val - sub_val}",
            "correct": str(x_val),
            "user_ans": ""
        })
        # Câu 2b: Tìm x (phép nhân)
        x_val = random.randint(2000, 3000)
        mul_val = random.randint(2, 5)
        questions.append({
            "type": "input",
            "q": f"Câu 9: Tìm x biết: x × {mul_val} = {x_val * mul_val}",
            "correct": str(x_val),
            "user_ans": ""
        })
        # Câu 3: Bài toán thực tế (ô tô chạy xăng)
        km = random.randint(50, 150)
        liters = random.randint(5, 15)
        new_liters = random.randint(3, 8)
        km_per_liter = km // liters
        result = km_per_liter * new_liters
        questions.append({
            "type": "input",
            "q": f"Câu 10: Một ô tô chạy quãng đường dài {km} km hết {liters} lít xăng. Hỏi với cách chạy như thế, khi chạy hết {new_liters} lít xăng thì ô tô đó chạy được quãng đường bao nhiêu km?",
            "correct": str(result),
            "user_ans": ""
        })
    elif grade == 4:
        # Đề thi chuyển lớp 4 lên 5 theo format thực tế
        # Phần I: Trắc nghiệm (4 điểm)
        # Câu 1: Đọc số (triệu, nghìn)
        millions = random.randint(100, 999)
        thousands = random.randint(10, 99)
        units = random.randint(100, 999)
        correct_reading = f"{millions} triệu {thousands} nghìn {units}"
        questions.append({
            "type": "mcq",
            "q": f"Câu 1: Số {millions} {thousands:03d} {units:03d} đọc là:",
            "opts": [
                f"{millions} triệu {thousands} nghìn {units}",
                f"{millions} triệu không trăm {thousands} nghìn {units}",
                f"{millions} triệu {thousands} trăm {units}",
                f"{millions} triệu không {thousands} nghìn {units}"
            ],
            "correct": f"{millions} triệu {thousands} nghìn {units}",
            "user_ans": None
        })
        # Câu 2: Tổng hai số lớn
        a = random.randint(400000, 600000)
        b = random.randint(400000, 500000)
        total = a + b
        questions.append({
            "type": "mcq",
            "q": f"Câu 2: Tổng của hai số {a} và {b} là:",
            "opts": [str(total), str(total - 100), str(total + 100), str(total + 200)],
            "correct": str(total),
            "user_ans": None
        })
        # Câu 3: Tính chất giao hoán
        n1 = random.randint(2, 9)
        n2 = random.randint(100, 500)
        questions.append({
            "type": "mcq",
            "q": f"Câu 3: {n1} x {n2} = {n2} x ... Số thích hợp điền vào chỗ chấm là:",
            "opts": [str(n1), str(n2), str(n1 + 1), str(n2 + 1)],
            "correct": str(n1),
            "user_ans": None
        })
        # Câu 4: Thời gian thực tế
        questions.append({
            "type": "mcq",
            "q": "Câu 4: Thời gian đi máy bay từ Hà Nội đến TP.HCM khoảng bao lâu:",
            "opts": ["30 phút", "1 ngày", "1 tuần", "2 giờ"],
            "correct": "2 giờ",
            "user_ans": None
        })
        # Câu 5: Phân số lớn nhất
        fractions = [(1, 2), (3, 4), (2, 3), (5, 6)]
        frac = random.choice(fractions)
        questions.append({
            "type": "mcq",
            "q": f"Câu 5: Trong các phân số 1/2, 3/4, 2/3, 5/6, phân số nào là lớn nhất:",
            "opts": ["1/2", "3/4", "2/3", "5/6"],
            "correct": "5/6",
            "user_ans": None
        })
        # Câu 6: Trung bình cộng
        nums = [random.randint(140, 160), random.randint(140, 160), random.randint(140, 160)]
        avg = sum(nums) // len(nums)
        questions.append({
            "type": "mcq",
            "q": f"Câu 6: Trung bình cộng của các số {', '.join(map(str, nums))} là:",
            "opts": [str(avg), str(avg - 1), str(avg + 1), str(sum(nums))],
            "correct": str(avg),
            "user_ans": None
        })
        # Câu 7: Đúng/Sai (xác suất)
        red = random.randint(2, 5)
        blue = random.randint(1, 3)
        questions.append({
            "type": "mcq",
            "q": f"Câu 7: Túi có {red} viên bi đỏ, {blue} viên bi xanh. Lấy ngẫu nhiên 2 viên. Khẳng định 'Không thể lấy được 2 viên bi xanh' là:",
            "opts": ["Đúng", "Sai"],
            "correct": "Sai" if blue >= 2 else "Đúng",
            "user_ans": None
        })
        # Câu 8: Biểu thức có chữ
        a_val = random.randint(2, 5)
        result = 2514 * a_val + 2458
        questions.append({
            "type": "mcq",
            "q": f"Câu 8: Giá trị của biểu thức 2514 x a + 2458 với a = {a_val} là:",
            "opts": [str(result), str(result + 1000), str(result - 1000), str(result + 100)],
            "correct": str(result),
            "user_ans": None
        })
        # Phần II: Tự luận (6 điểm)
        # Câu 1: Đặt tính rồi tính
        for i in range(2):
            a = random.randint(10000, 50000)
            b = random.randint(10000, 50000)
            if i == 0:  # Cộng
                ans = a + b
                op = "+"
            else:  # Trừ
                a = max(a, b) + random.randint(1000, 5000)
                ans = a - b
                op = "-"
            questions.append({
                "type": "input",
                "q": f"Câu {9+i}: Đặt tính rồi tính: {a} {op} {b}",
                "correct": str(ans),
                "user_ans": ""
            })
        # Câu 2: Đổi đơn vị đo
        meters = random.randint(1, 9)
        cm2 = random.randint(10, 99)
        total_cm2 = meters * 10000 + cm2
        questions.append({
            "type": "input",
            "q": f"Câu 11: Điền số thích hợp: {meters}m{cm2}cm² = ..... cm²",
            "correct": str(total_cm2),
            "user_ans": ""
        })
        centuries = random.randint(1, 10)
        questions.append({
            "type": "input",
            "q": f"Câu 12: {centuries} thế kỉ = ..... năm",
            "correct": str(centuries * 100),
            "user_ans": ""
        })
        # Câu 3: Bài toán hình chữ nhật
        perimeter = random.randint(100, 200)
        diff = random.randint(10, 30)
        half_perim = perimeter // 2
        length = (half_perim + diff) // 2
        width = half_perim - length
        area = length * width
        questions.append({
            "type": "input",
            "q": f"Câu 13: Chu vi sân cỏ hình chữ nhật là {perimeter} m. Chiều dài hơn chiều rộng {diff} m. Tính diện tích sân cỏ?",
            "correct": str(area),
            "user_ans": ""
        })
    elif grade == 5:
        # Đề thi chuyển lớp 5 lên 6 theo format thực tế
        # Phần I: Trắc nghiệm (3.5 điểm)
        # Câu 1: Đường kính và bán kính
        questions.append({
            "type": "mcq",
            "q": "Câu 1: Phát biểu nào sau đây đúng?",
            "opts": [
                "Đường kính bằng bán kính",
                "Đường kính hơn bán kính 2 đơn vị",
                "Đường kính gấp 2 lần bán kính",
                "Bán kính gấp 2 lần đường kính"
            ],
            "correct": "Đường kính gấp 2 lần bán kính",
            "user_ans": None
        })
        # Câu 2: Phần trăm sang số thập phân
        pct = random.choice([157, 25, 50, 75, 125])
        decimal_val = pct / 100
        questions.append({
            "type": "mcq",
            "q": f"Câu 2: {pct}% = .........",
            "opts": [str(decimal_val), str(pct), str(decimal_val * 10), str(decimal_val / 10)],
            "correct": str(decimal_val),
            "user_ans": None
        })
        # Câu 3: Nhân số thập phân với 0.01, 0.1
        a = round(random.uniform(100, 500), random.randint(1, 2))
        factor = random.choice([0.01, 0.1, 10, 100])
        result = round(a * factor, 4)
        questions.append({
            "type": "mcq",
            "q": f"Câu 3: {a} x ....... = {result}. Số điền vào chỗ chấm là:",
            "opts": [str(factor), str(factor * 10), str(factor / 10), str(factor * 100)],
            "correct": str(factor),
            "user_ans": None
        })
        # Câu 4: Bất đẳng thức
        a = round(random.uniform(2, 5), 1)
        limit = round(random.uniform(15, 20), 1)
        max_y = int(limit // a)
        questions.append({
            "type": "mcq",
            "q": f"Câu 4: Có bao nhiêu số tự nhiên y thỏa mãn {a} x y < {limit}?",
            "opts": [str(max_y), str(max_y + 1), str(max_y - 1), str(max_y + 2)],
            "correct": str(max_y),
            "user_ans": None
        })
        # Câu 5: Vận tốc xuôi/ngược dòng
        downstream = round(random.uniform(12, 15), 1)
        upstream = round(random.uniform(6, 9), 1)
        water_speed = round((downstream - upstream) / 2, 1)
        questions.append({
            "type": "mcq",
            "q": f"Câu 5: Thuyền xuôi dòng {downstream} km/giờ, ngược dòng {upstream} km/giờ. Vận tốc dòng nước là:",
            "opts": [str(water_speed), str(water_speed * 2), str(water_speed + 1), str(water_speed - 1)],
            "correct": str(water_speed),
            "user_ans": None
        })
        # Câu 6: Đổi đơn vị thể tích
        m3 = random.randint(1, 9)
        cm3 = random.randint(10, 999)
        total_cm3 = m3 * 1000000 + cm3
        questions.append({
            "type": "mcq",
            "q": f"Câu 6: Số thích hợp để {m3}m³ {cm3}cm³ = ..... cm³ là:",
            "opts": [str(total_cm3), str(m3 * 1000 + cm3), str(m3 * 10000 + cm3), str(m3 * 100 + cm3)],
            "correct": str(total_cm3),
            "user_ans": None
        })
        # Câu 7: Diện tích hình tròn
        r = random.choice([5, 7, 10])
        area = round(3.14 * r * r, 1)
        questions.append({
            "type": "mcq",
            "q": f"Câu 7: Hình tròn có đường kính {r * 2} cm. Diện tích là:",
            "opts": [str(area), str(area / 2), str(area * 2), str(area + 10)],
            "correct": str(area),
            "user_ans": None
        })
        # Phần II: Tự luận (6.5 điểm)
        # Bài 1: Đổi đơn vị
        minutes = random.choice([135, 150, 180, 225])
        hours = minutes / 60
        questions.append({
            "type": "input",
            "q": f"Câu 8: {minutes} phút = ..... giờ",
            "correct": str(hours),
            "user_ans": ""
        })
        kg = random.randint(1, 100)
        g = random.randint(1, 99)
        total_kg = kg + g / 1000
        questions.append({
            "type": "input",
            "q": f"Câu 9: {kg}kg {g}g = ..... kg",
            "correct": str(total_kg),
            "user_ans": ""
        })
        # Bài 2: Đặt tính rồi tính
        a = round(random.uniform(10, 100), 1)
        b = round(random.uniform(2, 10), 1)
        result = round(a * b, 2)
        questions.append({
            "type": "input",
            "q": f"Câu 10: Đặt tính rồi tính: {a} x {b}",
            "correct": str(result),
            "user_ans": ""
        })
        # Bài 3: Bài toán vận tốc
        distance = random.choice([100, 120, 150])
        start_hour = random.randint(6, 8)
        end_hour = start_hour + random.randint(2, 3)
        rest_minutes = random.choice([15, 20, 30])
        actual_time = (end_hour - start_hour) * 60 - rest_minutes
        speed_car = distance / (actual_time / 60)
        speed_bike = speed_car * 0.6
        questions.append({
            "type": "input",
            "q": f"Câu 11: Quãng đường AB dài {distance} km. Ô tô đi từ A lúc {start_hour} giờ đến B lúc {end_hour} giờ, nghỉ {rest_minutes} phút. Xe máy đi với vận tốc bằng 60% vận tốc ô tô. Tính vận tốc xe máy?",
            "correct": str(int(speed_bike)),
            "user_ans": ""
        })
    else:
        # Giữ nguyên đề thi cho các lớp khác
        for i in range(7):
            a = random.randint(20 * grade, 100 * grade)
            b = random.randint(10, 50)
            op = random.choice(['+', '-'])
            ans = a + b if op == '+' else a - b
            opts = [ans, ans + 2, ans - 5, ans + 10]
            random.shuffle(opts)
            questions.append({
                "type": "mcq", "q": f"Câu {i+1}: Tính giá trị biểu thức: {a} {op} {b}",
                "opts": [str(x) for x in opts], "correct": str(ans), "user_ans": None
            })
        for i in range(3):
            n1 = random.randint(50, 150)
            n2 = random.randint(20, 40)
            questions.append({
                "type": "input",
                "q": f"Câu {i+8}: Một cửa hàng có {n1} mét vải, đã bán {n2} mét. Hỏi còn lại bao nhiêu mét vải?",
                "correct": str(n1 - n2), "user_ans": ""
            })
    return questions
# =========================================================
# LAYOUT & HUD HELPERS
# =========================================================
TOP_BAR_H = 70
BOTTOM_BAR_H = 100
def get_layout_rects():
    top_rect = pygame.Rect(0, 0, WIDTH, TOP_BAR_H)
    bottom_rect = pygame.Rect(0, HEIGHT - BOTTOM_BAR_H, WIDTH, BOTTOM_BAR_H)
    content_rect = pygame.Rect(0, TOP_BAR_H, WIDTH, HEIGHT - TOP_BAR_H - BOTTOM_BAR_H)
    return top_rect, content_rect, bottom_rect
def draw_gradient(surface, color1, color2):
    h = surface.get_height()
    w = surface.get_width()
    if h <= 1:
        surface.fill(color1)
        return
    for y in range(h):
        ratio = y / (h - 1)
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        pygame.draw.line(surface, (r, g, b), (0, y), (w, y))
def draw_badge(surface, x, y, text, bg_color, text_color, font_size=18):
    """Vẽ một badge tự động điều chỉnh kích thước theo nội dung"""
    f = load_font(font_size)
    txt_surf = render_cached_text(f, text, text_color)
    w = txt_surf.get_width() + 30
    h = txt_surf.get_height() + 10
    pygame.draw.rect(surface, bg_color, (x, y, w, h), border_radius=h//2)
    surface.blit(txt_surf, (x + 15, y + 5))
    return w # Trả về chiều rộng để tính toán vị trí tiếp theo
def draw_top_bar(surface):
    """Top bar kiểu game: Level + XP bar (+ user/grade) + Combo."""
    if not account_system.current_user:
        return
    top_rect, _, _ = get_layout_rects()
    bar_surf = pygame.Surface((top_rect.w, top_rect.h), pygame.SRCALPHA)
    # Gradient background for top bar
    for i in range(top_rect.h):
        alpha = int(220 * (1 - i / top_rect.h * 0.5))
        pygame.draw.line(bar_surf, (30, 35, 60, alpha), (0, i), (top_rect.w, i))
    pygame.draw.rect(bar_surf, (255, 255, 255, 40), bar_surf.get_rect(), 2)
    surface.blit(bar_surf, (0, 0))
    d = account_system.data()
    level = player.level
    xp = player.exp
    need = player.exp_to_next_level
    grade = d.get("grade", 1)
    gold = int(d.get("gold", 0))
    # Left: User & Level info with icon
    user = (account_system.current_user or "Player").upper()
    user_font = load_font(20)
    level_font = load_font(16)
    surface.blit(render_cached_text(user_font, f"👤 {user}", (240, 240, 255)), (20, 12))
    level_line = f"LEVEL {level} | Lớp {grade}"
    surface.blit(render_cached_text(level_font, level_line, (180, 200, 255)), (20, 40))
    gold_display = "Vàng: Vô hạn (Admin)" if account_system.current_user == ADMIN_USER else f"Vàng: {gold}"
    gold_key = ("top_gold", "admin") if account_system.current_user == ADMIN_USER else ("top_gold", gold)
    surface.blit(
        ui_surface_cache.get(
            gold_key,
            lambda: render_cached_text(level_font, gold_display, (255, 225, 120)),
        ),
        (220, 40),
    )
    # Center: Enhanced Combo Streak (if active)
    combo_text = get_combo_text()
    if combo_text:
        combo_color = get_combo_color()
        # Dynamic font size based on combo level
        font_size = 32 + min(player.combo_streak // 3, 16)
        combo_font = load_font(font_size)
        # Enhanced pulsing effect
        pulse = math.sin(time.time() * (8 + player.combo_streak // 2)) * (5 + player.combo_streak // 4)
        # Add glow for high combos
        if player.combo_streak >= 7:
            # Create glow effect
            glow_text = render_text_mixed(combo_text, combo_font, combo_color)
            for offset in [(3, 3), (-3, -3), (3, -3), (-3, 3)]:
                surface.blit(glow_text, (220 + offset[0], 40 + offset[1]))
        combo_surf = render_text_mixed(combo_text, combo_font, combo_color)
        surface.blit(combo_surf, (WIDTH // 2 - combo_surf.get_width() // 2, 15 + pulse))
    # Right: XP progress (Wider to avoid hidden content)
    bar_w = 450 # Increased from 380
    bar_h = 26
    x = WIDTH - bar_w - 20
    y = 22
    # XP bar background
    pygame.draw.rect(surface, (40, 40, 60), (x, y, bar_w, bar_h), border_radius=13)
    # Use smooth display XP for animation
    display_xp = player.display_exp
    fill_w = int(bar_w * max(0.0, min(1.0, display_xp / need)))
    if fill_w > 0:
        # Animated XP bar color with gradient effect
        pygame.draw.rect(surface, (100, 255, 120), (x, y, fill_w, bar_h), border_radius=13)
        # Highlight on top of bar
        pygame.draw.rect(surface, (255, 255, 255, 60), (x, y, fill_w, bar_h // 3), border_radius=13)
    pygame.draw.rect(surface, (255, 255, 255, 150), (x, y, bar_w, bar_h), 2, border_radius=13)
    xp_text = f"XP {xp} / {need}"
    xp_surf = ui_surface_cache.get(
        ("top_xp", xp, need),
        lambda: render_cached_text(load_font(14), xp_text, WHITE),
    )
    surface.blit(xp_surf, (x + bar_w // 2 - xp_surf.get_width() // 2, y + 5))

    # Active item buffs row (bottom of top bar)
    active = item_fx.get_active_summary()
    if active:
        bx = 20
        for icon, label, info in active[:6]:  # max 6 visible
            ic = render_cached_text(load_icon_font(18), icon, (160, 255, 200), supersample=False, _skip_emoji_check=True)
            surface.blit(ic, (bx, 58))
            ls = render_cached_text(load_font(11), f"{label}·{info}", (160, 255, 180))
            surface.blit(ls, (bx + ic.get_width() + 2, 62))
            bx += ic.get_width() + ls.get_width() + 14
            if bx > WIDTH - 200:
                break
def _today_iso():
    return datetime.date.today().isoformat()
def claim_daily_reward():
    """Nhận thưởng ngày (1 lần/ngày). Trả về dict thưởng hoặc None nếu đã nhận."""
    if not account_system.current_user:
        return None
    d = account_system.data()
    last = d.get("last_claim", "")
    today = _today_iso()
    if last == today:
        return None
    streak = int(d.get("daily_streak", 0))
    if last:
        try:
            last_dt = datetime.date.fromisoformat(last)
            if (datetime.date.today() - last_dt).days != 1:
                streak = 0
        except ValueError:
            streak = 0
    streak += 1
    reward_cfg = get_daily_reward_for_streak(streak)
    xp_reward = int(reward_cfg.get("xp", 50 + streak * 10))
    gold_reward = int(reward_cfg.get("gold", 0))
    d["daily_streak"] = streak
    d["last_claim"] = today
    add_xp(xp_reward)
    if gold_reward > 0:
        add_gold(gold_reward)
    account_system.save()
    return {
        "xp": xp_reward,
        "gold": gold_reward,
        "day": int(reward_cfg.get("day", ((streak - 1) % 7) + 1)),
        "streak": streak,
        "icon": reward_cfg.get("icon", "🎁"),
    }
def ensure_daily_tasks():
    """Tạo nhiệm vụ ngày nếu sang ngày mới."""
    if not account_system.current_user:
        return
    d = account_system.data()
    today = _today_iso()
    tasks = d.get("daily_tasks")
    if not isinstance(tasks, dict) or tasks.get("date") != today:
        d["daily_tasks"] = {
            "date": today,
            "tasks": [
                {"id": "correct_10", "desc": "Tra loi dung 10 cau", "target": 10, "progress": 0, "reward": 50, "claimed": False},
                {"id": "combo_5", "desc": "Dat combo 5", "target": 5, "progress": 0, "reward": 70, "claimed": False},
                {"id": "play_1", "desc": "Choi 1 tran", "target": 1, "progress": 0, "reward": 30, "claimed": False},
            ],
        }
        account_system.save()
def daily_task_progress(task_id, inc=1):
    if not account_system.current_user:
        return
    ensure_daily_tasks()
    d = account_system.data()
    for t in d.get("daily_tasks", {}).get("tasks", []):
        if t.get("id") == task_id and not t.get("claimed", False):
            t["progress"] = min(int(t.get("target", 0)), int(t.get("progress", 0)) + inc)
            break
def claim_task_rewards():
    """Auto-claim task rewards when completed. Returns total XP claimed."""
    if not account_system.current_user:
        return 0
    ensure_daily_tasks()
    d = account_system.data()
    total = 0
    changed = False
    for t in d.get("daily_tasks", {}).get("tasks", []):
        if t.get("claimed"):
            continue
        if int(t.get("progress", 0)) >= int(t.get("target", 0)) and int(t.get("target", 0)) > 0:
            t["claimed"] = True
            total += int(t.get("reward", 0))
            changed = True
    if total > 0:
        add_xp(total)
    if changed:
        account_system.save()
    return total
def draw_daily_tasks_panel(surface, x, y, w):
    """Panel nhỏ hiển thị nhiệm vụ ngày (menu/dashboard)."""
    if not account_system.current_user:
        return
    ensure_daily_tasks()
    tasks = account_system.data().get("daily_tasks", {}).get("tasks", [])
    panel_h = 190
    panel = pygame.Surface((w, panel_h), pygame.SRCALPHA)
    pygame.draw.rect(panel, (30, 30, 50, 170), (0, 0, w, panel_h), border_radius=16)
    pygame.draw.rect(panel, (255, 255, 255, 40), (0, 0, w, panel_h), 2, border_radius=16)
    panel.blit(load_font(18).render("NHIEM VU NGAY", True, (220, 220, 240)), (14, 12))
    yy = 44
    for t in tasks:
        desc = t.get("desc", "")
        prog = int(t.get("progress", 0))
        target = int(t.get("target", 1))
        claimed = bool(t.get("claimed", False))
        col = (100, 220, 120) if claimed else (220, 200, 50) if prog >= target else (200, 200, 220)
        panel.blit(load_font(14).render(desc, True, col), (14, yy))
        # mini bar
        bar_x = 14
        bar_y = yy + 18
        bar_w = w - 28
        bar_h = 12
        pygame.draw.rect(panel, (60, 60, 80), (bar_x, bar_y, bar_w, bar_h), border_radius=6)
        fill = int(bar_w * max(0.0, min(1.0, prog / max(1, target))))
        if fill > 0:
            pygame.draw.rect(panel, col, (bar_x, bar_y, fill, bar_h), border_radius=6)
        pygame.draw.rect(panel, (255, 255, 255, 30), (bar_x, bar_y, bar_w, bar_h), 1, border_radius=6)
        panel.blit(load_font(12).render(f"{prog}/{target}", True, (220, 220, 240)), (w - 60, yy - 1))
        yy += 46
    surface.blit(panel, (x, y))
class DailyRewardPopup:
    """Phần thưởng đăng nhập 7 ngày với animation."""
    def __init__(self, reward_info):
        self.info = reward_info or {}
        self.timer = 0.0
        self.duration = 4.5
        self.active = True
        self.claim_anim = 0.0
        self.sparkles = []
        for _ in range(ParticleBudget.request(12)):
            self.sparkles.append({
                "x": random.uniform(-120, 120),
                "y": random.uniform(-80, 80),
                "vx": random.uniform(-40, 40),
                "vy": random.uniform(-80, -20),
                "life": random.uniform(0.8, 2.2),
                "size": random.randint(2, 5),
            })
        self._card_cache = None

    def update(self, dt):
        self.timer += dt
        self.claim_anim = min(1.0, self.claim_anim + dt * 2.5)
        for sp in self.sparkles:
            sp["x"] += sp["vx"] * dt
            sp["y"] += sp["vy"] * dt
            sp["life"] -= dt
        if self.timer >= self.duration:
            self.active = False

    def dismiss(self):
        self.active = False

    def draw(self, s):
        if not self.active:
            return
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 140))
        s.blit(overlay, (0, 0))

        w, h = 720, 420
        cx, cy = WIDTH // 2, HEIGHT // 2
        scale = 0.85 + 0.15 * self.claim_anim
        rw, rh = int(w * scale), int(h * scale)
        x, y = cx - rw // 2, cy - rh // 2

        card = pygame.Surface((rw, rh), pygame.SRCALPHA)
        pygame.draw.rect(card, (35, 38, 65, 245), (0, 0, rw, rh), border_radius=24)
        pygame.draw.rect(card, (200, 170, 80, 220), (0, 0, rw, rh), 4, border_radius=24)

        title = render_cached_text(load_font(30), "PHẦN THƯỞNG HẰNG NGÀY", (255, 230, 120))
        card.blit(title, (rw // 2 - title.get_width() // 2, 18))

        streak = int(self.info.get("streak", 1))
        day = int(self.info.get("day", 1))
        rewards_cfg = load_daily_rewards().get("rewards", [])
        slot_w = min(82, (rw - 60) // 7)
        start_x = (rw - slot_w * 7 - 6 * 8) // 2
        for i, slot in enumerate(rewards_cfg[:7]):
            dnum = int(slot.get("day", i + 1))
            sx = start_x + i * (slot_w + 8)
            sy = 70
            is_today = dnum == day
            is_past = dnum < day or (dnum == day and self.claim_anim > 0.3)
            bg = (200, 170, 80) if is_today else ((80, 120, 90) if is_past else (50, 55, 80))
            pygame.draw.rect(card, bg, (sx, sy, slot_w, 100), border_radius=10)
            if is_today:
                pulse = int(180 + 75 * math.sin(self.timer * 6))
                pygame.draw.rect(card, (255, 255, 255, pulse), (sx, sy, slot_w, 100), 3, border_radius=10)
            icon = render_cached_text(load_icon_font(22), slot.get("icon", "🎁"), WHITE)
            card.blit(icon, (sx + slot_w // 2 - icon.get_width() // 2, sy + 8))
            card.blit(render_cached_text(load_font(13), f"Ngày {dnum}", WHITE), (sx + 8, sy + 38))
            card.blit(render_cached_text(load_font(11), f"+{slot.get('xp', 0)} XP", (200, 255, 200)), (sx + 6, sy + 58))
            g = int(slot.get("gold", 0))
            if g:
                card.blit(render_text_mixed(f"+{g}💰", load_font(11), (255, 220, 100)), (sx + 6, sy + 74))

        icon_big = render_cached_text(load_icon_font(48), self.info.get("icon", "🎁"), (255, 255, 255))
        bounce = int(8 * math.sin(self.timer * 5))
        card.blit(icon_big, (rw // 2 - icon_big.get_width() // 2, 188 + bounce))

        reward_lines = [f"+{self.info.get('xp', 0)} XP"]
        if self.info.get("gold"):
            reward_lines.append(f"+{self.info['gold']} Vàng")
        ry = 268
        for line in reward_lines:
            t = render_cached_text(load_font(28), line, (200, 170, 80))
            card.blit(t, (rw // 2 - t.get_width() // 2, ry))
            ry += 34

        hint = render_cached_text(load_font(15), "Nhấn để tiếp tục • Chuỗi ngày: {}".format(streak), (180, 180, 200))
        card.blit(hint, (rw // 2 - hint.get_width() // 2, rh - 36))

        for sp in self.sparkles:
            if sp["life"] > 0:
                px = rw // 2 + int(sp["x"] * self.claim_anim)
                py = 200 + int(sp["y"] * self.claim_anim)
                pygame.draw.circle(card, (255, 230, 100), (px, py), sp["size"])

        s.blit(card, (x, y))
def draw_xp_bar(surface):
    d = account_system.data(); l, xp = d["level"], d["xp"]; need = get_required_exp(l)
    pygame.draw.rect(surface,(200,200,200),(WIDTH-330,30,300,20),border_radius=10)
    pygame.draw.rect(surface,(100,220,120),(WIDTH-330,30,int(300*(xp/need)),20),border_radius=10)
    pygame.draw.rect(surface,WHITE,(WIDTH-330,30,300,20),2,border_radius=10)
    surface.blit(font_small.render(f"Level {l}",True,WHITE),(WIDTH-330,5))
class Button:
    def __init__(self, x, y, w, h, text, color):
        self.rect = pygame.Rect(x, y, w, h)
        self.text = text
        self.color = color
        self._hover_anim = 0.0  # Smooth hover animation 0->1 (using exponential ease-out Lerp)
        self._glow_phase = 0.0  # Animated glow border
        self._click_scale = 1.0  # Scale when clicked
        self._cached_text_surf = None  # Cache for text surface
        self._cached_text_key = None  # Key to check if cache is valid
        self.smart_resize() # Auto-adjust width if needed
    @staticmethod
    def _smooth_lerp(current, target, speed=0.15):
        """Smooth exponential Lerp for natural easing"""
        return current + (target - current) * speed
    @staticmethod
    def _lerp_brightness(color, factor):
        """Smoothly interpolate color brightness: 0->original, 1->brighter"""
        # Use smooth easing for natural color transitions
        brightness_boost = factor * 50  # Max +50 brightness boost
        return tuple(min(255, int(c + brightness_boost)) for c in color)
    def _get_hover_target(self):
        """Chỉ phóng to khi chuột thực sự nằm trên button."""
        global virtual_mouse_pos
        return 1.0 if self.rect.collidepoint(virtual_mouse_pos) else 0.0
    def smart_resize(self, padding=40):
        """Tự động mở rộng button nếu chữ quá dài"""
        # Load font để đo kích thước (sử dụng font_med làm chuẩn)
        try:
            f = load_font(28)
            # Render thử để đo width (xử lý cả icon nếu có)
            icon, rest = _split_leading_icon(self.text)
            tw = f.size(rest if rest else self.text)[0]
            if icon:
                # Ước lượng icon width (thường tương đương font height)
                tw += f.get_height() + 10
            # Nếu width thực tế + padding > width hiện tại thì update
            if tw + padding > self.rect.w:
                old_center = self.rect.center
                self.rect.w = tw + padding
                self.rect.center = old_center # Giữ nguyên vị trí trung tâm
        except (pygame.error, AttributeError):
            pass
    def draw(self, s):
        # Smooth hover animation with exponential ease-out
        target = self._get_hover_target()
        self._hover_anim = self._smooth_lerp(self._hover_anim, target, 0.20)
        self._glow_phase += 0.05
        # Click animation recovery with smooth Lerp
        if self._click_scale < 1.0:
            self._click_scale = self._smooth_lerp(self._click_scale, 1.0, 0.08)
        elif self._click_scale > 1.0:
            self._click_scale = self._smooth_lerp(self._click_scale, 1.0, 0.08)
        # Scale effect: càng gần chuột càng lớn, tối đa 25%.
        # Scale effect: chỉ phóng to khi chuột nằm trên button, tối đa 1%.
        scale_factor = (1.0 + self._hover_anim * 0.01) * self._click_scale
        draw_w = int(self.rect.w * scale_factor)
        draw_h = int(self.rect.h * scale_factor)
        draw_x = self.rect.centerx - draw_w // 2
        draw_y = self.rect.centery - draw_h // 2 - int(self._hover_anim * 8)
        draw_rect = pygame.Rect(draw_x, draw_y, draw_w, draw_h)
        # Smooth brightness interpolation using Lerp
        draw_color = self._lerp_brightness(self.color, self._hover_anim)
        # Shadow (grows smoothly with hover using Lerp)
        shadow_rect = self.rect.copy()
        shadow_offset = self._smooth_lerp(6.0, 10.0, self._hover_anim * 0.3)
        shadow_rect.y += int(shadow_offset)
        shadow_surf = pygame.Surface((shadow_rect.w + 10, shadow_rect.h + 10), pygame.SRCALPHA)
        # Smooth shadow alpha interpolation (70 at no-hover, 120 at hover)
        shadow_alpha = int(70 + self._hover_anim * 50)
        # Using larger border_radius for shadow
        pygame.draw.rect(shadow_surf, (0, 0, 0, shadow_alpha), (0, 0, shadow_rect.w + 10, shadow_rect.h + 10), border_radius=25)
        s.blit(shadow_surf, (shadow_rect.x - 5, shadow_rect.y - 5))
        # Button body with gradient look
        pygame.draw.rect(s, draw_color, draw_rect, border_radius=20)
        # Subtle Top highlight for 3D look (smooth opacity with Lerp)
        if draw_h > 10:
            highlight_rect = pygame.Rect(draw_x + 5, draw_y + 2, draw_w - 10, draw_h // 4)
            # Use variable alpha based on hover for smoother effect
            highlight_alpha = int(30 + self._hover_anim * 20)  # 30 to 50 on hover
            highlight_surf = pygame.Surface((highlight_rect.w, highlight_rect.h), pygame.SRCALPHA)
            pygame.draw.rect(highlight_surf, (255, 255, 255, highlight_alpha), (0, 0, highlight_rect.w, highlight_rect.h), border_radius=20)
            s.blit(highlight_surf, highlight_rect)
        # Glow border (animated on hover with smooth Lerp)
        if self._hover_anim > 0.1:
            glow_alpha = int(self._hover_anim * 180)
            glow_pulse = int(math.sin(self._glow_phase) * 40 + 40)
            glow_color = (255, 255, 255, min(255, glow_alpha + glow_pulse))
            glow_surf = pygame.Surface((draw_w + 6, draw_h + 6), pygame.SRCALPHA)
            pygame.draw.rect(glow_surf, glow_color, (0, 0, draw_w + 6, draw_h + 6), 4, border_radius=22)
            s.blit(glow_surf, (draw_x - 3, draw_y - 3))
        else:
            # Viền trắng mảnh khi không hover (smooth fade-in/out)
            border_alpha = int(80 * (1.0 - self._hover_anim * 0.5))  # Fade out white border on hover
            pygame.draw.rect(s, (255, 255, 255, border_alpha), draw_rect, 2, border_radius=20)
        # Text rendering with caching
        cache_key = (self.text, draw_rect.width)
        if self._cached_text_key != cache_key or self._cached_text_surf is None:
            # Re-render text only when it changes
            max_width = draw_rect.width * 0.92
            words = self.text.split(' ')
            lines = []; current_line = ""
            for word in words:
                test_line = current_line + " " + word if current_line else word
                if font_med.size(test_line)[0] < max_width: current_line = test_line
                else:
                    lines.append(current_line)
                    current_line = word
            lines.append(current_line)
            # Create cached surface for all text lines
            total_height = len(lines) * font_med.get_linesize()
            self._cached_text_surf = pygame.Surface((draw_rect.width, total_height), pygame.SRCALPHA)
            for i, line in enumerate(lines):
                txt_surf = render_text_with_leading_icon(
                    line,
                    text_font=font_med,
                    icon_font=load_icon_font(font_med.get_height()),
                    color=WHITE,
                    gap=6,
                )
                txt_rect = txt_surf.get_rect(center=(draw_rect.width // 2, i * font_med.get_linesize() + font_med.get_linesize()//2))
                self._cached_text_surf.blit(txt_surf, txt_rect)
            self._cached_text_key = cache_key
        # Blit cached text surface
        start_y = draw_rect.centery - self._cached_text_surf.get_height() // 2
        s.blit(self._cached_text_surf, (draw_rect.centerx - self._cached_text_surf.get_width() // 2, start_y))
    def clicked(self, pos):
        if self.rect.collidepoint(pos):
            self._click_scale = 0.9 # Shrink when clicked
            return True
        return False
# =========================================================
# CARD BUTTON - Nút dạng card với icon + title + description
# =========================================================
class CardButton:
    """Nút dạng card với icon, title, description và hiệu ứng hover"""
    def __init__(self, x, y, w, h, icon, title, desc, color, accent_color=None):
        self.rect = pygame.Rect(x, y, w, h)
        self.icon = icon
        self.title = title
        self.desc = desc
        self.color = color
        self.accent_color = accent_color or color
        self.hover_scale = 0.0  # 0.0 -> 1.0 animation
        self.glow_phase = 0.0  # Animated glow
        self.click_scale = 1.0
        self.smart_resize()
    def smart_resize(self, padding=60):
        """Đảm bảo card đủ rộng cho title và description"""
        try:
            f_title = load_font(24)
            f_desc = load_font(16)
            tw = f_title.size(self.title)[0]
            dw = f_desc.size(self.desc)[0] if self.desc else 0
            required_w = max(tw, dw) + padding
            if required_w > self.rect.w:
                self.rect.w = required_w
        except (pygame.error, AttributeError): pass
    def _get_hover_target(self):
        """Chỉ phóng to khi chuột thực sự nằm trên card."""
        global virtual_mouse_pos
        return 1.0 if self.rect.collidepoint(virtual_mouse_pos) else 0.0
    def update(self, dt):
        target = self._get_hover_target()
        self.hover_scale += (target - self.hover_scale) * min(1.0, dt * 10)
        self.glow_phase += dt * 3.0
        if self.click_scale < 1.0:
            self.click_scale += 0.05
    def draw(self, s):
        # Tính toán scale và offset cho hover, tối đa 1%.
        scale_factor = (1.0 + self.hover_scale * 0.01) * self.click_scale
        draw_w = int(self.rect.w * scale_factor)
        draw_h = int(self.rect.h * scale_factor)
        draw_x = self.rect.centerx - draw_w // 2
        draw_y = self.rect.centery - draw_h // 2 - int(self.hover_scale * 6)
        draw_rect = pygame.Rect(draw_x, draw_y, draw_w, draw_h)
        # Shadow (softer and larger)
        shadow_rect = draw_rect.copy()
        shadow_rect.y += 8 + int(self.hover_scale * 5)
        shadow_surf = pygame.Surface((shadow_rect.w + 10, shadow_rect.h + 10), pygame.SRCALPHA)
        shadow_alpha = 50 + int(self.hover_scale * 40)
        pygame.draw.rect(shadow_surf, (0, 0, 0, shadow_alpha), (0, 0, shadow_rect.w + 10, shadow_rect.h + 10), border_radius=30)
        s.blit(shadow_surf, (shadow_rect.x - 5, shadow_rect.y - 5))
        # Card background với gradient effect
        card_surf = pygame.Surface((draw_w, draw_h), pygame.SRCALPHA)
        base_color = [min(255, c + int(self.hover_scale * 30)) for c in self.color]
        pygame.draw.rect(card_surf, (*base_color, 245), (0, 0, draw_w, draw_h), border_radius=25)
        # Gradient overlay (Sửa "vạch trắng" bằng cách dùng alpha thấp hơn)
        if draw_h > 10:
            gradient_surf = pygame.Surface((draw_w - 10, draw_h // 3), pygame.SRCALPHA)
            pygame.draw.rect(gradient_surf, (255, 255, 255, 25 + int(self.hover_scale * 15)), (0, 0, draw_w - 10, draw_h // 3), border_radius=20)
            card_surf.blit(gradient_surf, (5, 2))
        # Glow border khi hover
        if self.hover_scale > 0.1:
            glow_alpha = int(self.hover_scale * 210)
            glow_intensity = int(math.sin(self.glow_phase) * 40 + 40)
            border_color = (*self.accent_color, min(255, glow_alpha + glow_intensity))
            pygame.draw.rect(card_surf, border_color, (0, 0, draw_w, draw_h), 4, border_radius=25)
        else:
            pygame.draw.rect(card_surf, (255, 255, 255, 70), (0, 0, draw_w, draw_h), 2, border_radius=25)
        s.blit(card_surf, (draw_x, draw_y))
        # Icon
        icon_size = min(42, draw_h - 20)
        icon_font = load_icon_font(icon_size)
        icon_surf = render_cached_text(icon_font, self.icon, WHITE, supersample=False, _skip_emoji_check=True)
        s.blit(icon_surf, (draw_x + 20, draw_y + draw_h // 2 - icon_surf.get_height() // 2))
        # Title
        title_font = load_font(min(24, draw_h // 3))
        title_surf = render_cached_text(title_font, self.title, WHITE)
        title_x = draw_x + 75
        title_y = draw_y + 15 if self.desc else draw_y + draw_h // 2 - title_surf.get_height() // 2
        s.blit(title_surf, (title_x, title_y))
        # Description
        if self.desc:
            desc_font = load_font(min(16, draw_h // 5))
            desc_surf = render_cached_text(desc_font, self.desc, (240, 240, 240, 210))
            s.blit(desc_surf, (title_x, title_y + title_surf.get_height() + 6))
    def clicked(self, pos):
        if self.rect.collidepoint(pos):
            self.click_scale = 0.92
            return True
        return False
# =========================================================
# MATH PARTICLE SYSTEM - Background động
# =========================================================
class MathParticle:
    """Particle bay nhẹ trên background (số, toán tử)"""
    SYMBOLS = ['+', '-', 'x', '=', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
               '%', '>', '<', '?', '∑', 'π', '√', '∞']
    def __init__(self, layer=1):
        self.layer = layer # 1=far, 2=mid, 3=near
        self.reset(True)
    def reset(self, initial=False):
        self.x = random.uniform(0, WIDTH)
        self.y = random.uniform(0, HEIGHT) if initial else HEIGHT + 50
        # Parallax speed based on layer
        base_speed = random.uniform(-0.3, -0.8)
        self.vy = base_speed * self.layer
        self.vx = random.uniform(-0.2, 0.2) * self.layer
        self.symbol = random.choice(self.SYMBOLS)
        self.size = random.randint(12, 24) * self.layer
        self.alpha = random.randint(20, 50) // (4 - self.layer)
        self.rotation = random.uniform(0, 360)
        self.rot_speed = random.uniform(-0.5, 0.5)
        self.life = random.uniform(10, 25)
    def update(self, dt):
        self.x += self.vx
        self.y += self.vy
        self.rotation += self.rot_speed
        self.life -= dt
        if self.life <= 0 or self.y < -50:
            self.reset()
    def draw(self, surface):
        f = load_font(self.size)
        txt = render_cached_text(f, self.symbol, (255, 255, 255))
        txt.set_alpha(self.alpha)
        # Simple rotation effect via slight position offset
        ox = math.sin(self.rotation * 0.05) * 3
        surface.blit(txt, (int(self.x + ox), int(self.y)))
class MathParticleSystem:
    """Hệ thống particle toán học đa lớp với object pool tối ưu cho parallax effect"""
    def __init__(self, count=30):
        self.particles = []
        self.pool_size = count
        # Pre-allocate object pool to avoid runtime allocation
        # Layer 1: Far (slow, small)
        for _ in range(count // 2): 
            self.particles.append(MathParticle(layer=1))
        # Layer 2: Mid
        for _ in range(count // 3): 
            self.particles.append(MathParticle(layer=2))
        # Layer 3: Near (fast, large)
        for _ in range(count // 6): 
            self.particles.append(MathParticle(layer=3))
        # Mark all particles as inactive initially
        for p in self.particles:
            p.active = True
    def update(self, dt):
        for p in self.particles:
            p.update(dt)
    def draw(self, surface):
        for p in self.particles:
            p.draw(surface)
class LightEffect:
    """Hiệu ứng ánh sáng chuyển động nhẹ nhàng"""
    def __init__(self):
        self.time = 0
    def update(self, dt):
        self.time += dt
    def draw(self, surface):
        # Tạo các vùng sáng mờ ảo
        glow_x = WIDTH // 2 + math.sin(self.time * 0.5) * 100
        glow_y = HEIGHT // 2 + math.cos(self.time * 0.7) * 80
        glow_surf = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        # Vùng sáng trung tâm
        for r in range(400, 100, -50):
            alpha = int(20 * (1 - r/400))
            pygame.draw.circle(glow_surf, (150, 200, 255, alpha), (int(glow_x), int(glow_y)), r)
        surface.blit(glow_surf, (0, 0), special_flags=pygame.BLEND_ADD)
class InputBox:
    def __init__(self,x,y,w,h,placeholder="",password=False):
        self.rect = pygame.Rect(x,y,w,h); self.text = ""; self.placeholder = placeholder
        self.active = False; self.password = password
    def handle_event(self,event):
        if event.type == pygame.MOUSEBUTTONDOWN: self.active = self.rect.collidepoint(event.pos)
        if event.type == pygame.KEYDOWN and self.active:
            if event.key == pygame.K_BACKSPACE: self.text = self.text[:-1]
            elif event.key == pygame.K_RETURN: return "ENTER"
            else: self.text += event.unicode
    def update(self): pass
    def draw(self,surface):
        pygame.draw.rect(surface,(230,230,230),self.rect,border_radius=12)
        pygame.draw.rect(surface, (120,170,220) if self.active else (200,200,200), self.rect, 2, border_radius=12)
        display = "*"*len(self.text) if self.password else self.text
        txt = font_med.render(self.placeholder if display == "" else display, True, (160,160,160) if display == "" else (60,60,60))
        surface.blit(txt,(self.rect.x+15,self.rect.y+12))
class CloverParticle:
    def __init__(self):
        self.reset()
    def reset(self):
        self.x = random.randint(0, WIDTH)
        self.y = random.randint(-HEIGHT, 0)
        self.speed = random.uniform(1, 3)
        self.rotation = random.uniform(0, 360)
        self.rot_speed = random.uniform(-2, 2)
        self.size = random.uniform(0.6, 1.0)
    def update(self, dt):
        self.y += self.speed * dt * 60
        self.rotation += self.rot_speed * dt * 60
        if self.y > HEIGHT: self.reset()
    def draw(self, surface):
        # Tự động vẽ hình tròn xanh nếu không tìm thấy file ảnh
        try:
            img = pygame.transform.smoothscale(clover_image, (int(32*self.size), int(32*self.size)))  # type: ignore[arg-type]
            rotated = pygame.transform.rotate(img, self.rotation)
            surface.blit(rotated, rotated.get_rect(center=(int(self.x), int(self.y))))
        except (pygame.error, AttributeError, TypeError):
            pygame.draw.circle(surface, (100, 200, 100), (int(self.x), int(self.y)), 5)
class GlobalCloverManager:
    def __init__(self, num_clovers):
        self.clovers = [CloverParticle() for _ in range(num_clovers)]
    def update(self, dt):
        for clover in self.clovers:
            clover.update(dt)
    def draw(self, surface):
        for clover in self.clovers:
            clover.draw(surface)
class FallingCloverEffect:
    """Hiệu ứng rơi cỏ ba lá với object pool để tối ưu bộ nhớ"""
    def __init__(self, num_clovers):
        # Limit clover count for better performance
        self.num_clovers = min(num_clovers, 15)  # Max 15 clovers
        # Pre-allocate clover pool for reuse (avoid runtime allocation)
        self.clovers = [CloverParticle() for _ in range(self.num_clovers)]
        self.surface = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        self.active = True
        self.direction = 0
        self.alpha = 255
    def is_active(self): 
        return self.active
    def start(self): 
        self.active = True
        self.direction = 1
        self.alpha = 0
        # Reset all clovers when effect starts (object pool reuse)
        for clover in self.clovers:
            clover.reset()
    def update(self, dt=None):
        if self.active:
            self.alpha += 15 * self.direction
            if self.alpha >= 255: self.alpha = 255
            if self.alpha <= 0: self.alpha = 0; self.active = False
        if dt is not None:
            for clover in self.clovers:
                clover.update(dt)
    def draw(self, s):
        if self.is_active() or self.alpha > 0:
            self.surface.fill((0, 0, 0, 0))  # Clear surface for reuse
            for clover in self.clovers:
                clover.draw(self.surface)
            self.surface.set_alpha(self.alpha)
            s.blit(self.surface, (0, 0))
class HSRWarpEffect:
    """Hiệu ứng warp với object pool tối ưu - tái sử dụng particles thay vì xóa/tạo mới"""
    def __init__(self, count=120):
        self.particles = []
        self.pool_size = count
        # Pre-allocate all particles upfront (object pool)
        for _ in range(count):
            self.particles.append(self._create_particle(initial=True))
    def _create_particle(self, initial=False):
        """Factory method for creating/resetting particles"""
        angle = random.uniform(0, 2 * math.pi)
        dist = random.uniform(0, 1) if initial else 0.05
        speed = random.uniform(15, 30)
        color = random.choice([(200, 230, 255), (255, 255, 255), (150, 200, 250)])
        return {"angle": angle, "dist": dist, "speed": speed, "color": color, "len": random.uniform(20, 100)}
    def reset_particle(self, initial=False):
        """Reset existing particle instead of creating new one"""
        if self.particles:
            idx = random.randint(0, len(self.particles) - 1)
            self.particles[idx] = self._create_particle(initial)
    def update(self, dt, progress):
        speed_mult = 1.0 + progress * 5.0
        # Reuse particles by resetting those that go out of bounds
        for i in range(len(self.particles)):
            p = self.particles[i]
            p["dist"] += p["speed"] * dt * 0.001 * speed_mult
            if p["dist"] > 1.5:
                # Reuse particle instead of creating new one (object pool optimization)
                self.particles[i] = self._create_particle()
    def draw(self, surface):
        cx, cy = WIDTH // 2, HEIGHT // 2
        max_r = SCREEN_DIAGONAL
        for p in self.particles:
            start_dist = p["dist"] * max_r
            end_dist = (p["dist"] + p["len"]/1000) * max_r
            start_pos = (cx + math.cos(p["angle"]) * start_dist, cy + math.sin(p["angle"]) * start_dist)
            end_pos = (cx + math.cos(p["angle"]) * end_dist, cy + math.sin(p["angle"]) * end_dist)
            thickness = int(1 + p["dist"] * 4)
            pygame.draw.line(surface, p["color"], start_pos, end_pos, thickness)
# =========================================================
# CORE SYSTEMS
# =========================================================
class RealisticBook:
    def __init__(self, x, y, w, h):
        self.rect = pygame.Rect(x, y, w, h)
        self.is_flipping = False
        self.page_w = (w - 40) // 2
        # Transition animation state for page flip effect
        self.flip_progress = 0.0  # 0->1 for transition
        self.flip_active = False
        self.flip_type = "none"  # "slide_left", "slide_right", "none"
    def update(self, dt):
        """Update page flip animation"""
        if self.flip_active:
            self.flip_progress += dt * 3.0  # Transition speed (completes in ~0.33s)
            if self.flip_progress >= 1.0:
                self.flip_progress = 1.0
                self.flip_active = False
    def _draw_page_with_curl(self, surface, page_rect, page_func, flip_progress, is_old_page=False):
        """Draw a page with fake 3D page curl effect during transition
        
        Args:
            surface: Target surface to draw on
            page_rect: Rectangle for page bounds
            page_func: Function to draw page content (called with surface and rect)
            flip_progress: 0->1 transition progress
            is_old_page: True if this is the page being flipped away
        """
        if flip_progress < 0 or flip_progress > 1:
            flip_progress = max(0, min(1, flip_progress))
        
        # Calculate scale factor: old page shrinks from 1.0->0.7, new page expands from 0.7->1.0
        if is_old_page:
            # Shrink towards spine (left edge stays fixed)
            scale = 1.0 - flip_progress * 0.3  # 1.0 -> 0.7
            width_reduction = int(page_rect.width * (1.0 - scale))
            adjusted_rect = pygame.Rect(page_rect.x, page_rect.y, 
                                       int(page_rect.width * scale), page_rect.height)
        else:
            # Expand from spine outward (right edge expands)
            scale = 0.7 + flip_progress * 0.3  # 0.7 -> 1.0
            adjusted_rect = pygame.Rect(int(page_rect.x + page_rect.width * (1.0 - scale)), 
                                       page_rect.y,
                                       int(page_rect.width * scale), page_rect.height)
        
        # Draw page content
        page_func(surface, adjusted_rect)
        
        # Draw shadow strip for 3D page curl effect
        shadow_alpha_start = int(100 * (1.0 - flip_progress))  # Fade from 100 -> 0
        if shadow_alpha_start > 0:
            shadow_width = 8 + int(flip_progress * 4)  # Shadow width 8->12
            if is_old_page:
                # Shadow on right edge of shrinking page
                shadow_x = adjusted_rect.right
            else:
                # Shadow on left edge of expanding page
                shadow_x = adjusted_rect.left - shadow_width
            
            # Create shadow gradient
            shadow_surf = pygame.Surface((shadow_width, adjusted_rect.height), pygame.SRCALPHA)
            # Gradient from dark to transparent
            for i in range(shadow_width):
                alpha = int(shadow_alpha_start * (1.0 - i / shadow_width))
                pygame.draw.line(shadow_surf, (0, 0, 0, alpha), 
                               (i, 0), (i, adjusted_rect.height))
            
            surface.blit(shadow_surf, (shadow_x, adjusted_rect.y))
    def draw(self, surface, left_func, right_func, with_transition=False):
        x, y, w, h = self.rect
        # Draw book cover/spine
        pygame.draw.rect(surface, (80, 50, 20), (x-12, y-10, w+24, h+20), border_radius=15)
        pygame.draw.rect(surface, (101, 67, 33), (x-8, y-8, w+16, h+16), border_radius=12)
        pygame.draw.rect(surface, (150, 150, 150), (x + self.page_w, y + 10, 40, h - 20), border_radius=5)
        
        trang_trai_rect = pygame.Rect(x, y, self.page_w, h)
        pygame.draw.rect(surface, (253, 246, 227), trang_trai_rect, border_top_left_radius=10, border_bottom_left_radius=10)
        
        trang_phai_rect = pygame.Rect(x + self.page_w + 40, y, self.page_w, h)
        pygame.draw.rect(surface, (253, 246, 227), trang_phai_rect, border_top_right_radius=10, border_bottom_right_radius=10)
        
        # Draw pages with optional 3D flip transition
        if with_transition and self.flip_active:
            if self.flip_type == "slide_left":
                # Left page shrinks, right page expands
                self._draw_page_with_curl(surface, trang_trai_rect, left_func, self.flip_progress, is_old_page=True)
                self._draw_page_with_curl(surface, trang_phai_rect, right_func, self.flip_progress, is_old_page=False)
            elif self.flip_type == "slide_right":
                # Right page shrinks, left page expands
                self._draw_page_with_curl(surface, trang_phai_rect, right_func, self.flip_progress, is_old_page=True)
                self._draw_page_with_curl(surface, trang_trai_rect, left_func, self.flip_progress, is_old_page=False)
            else:
                # No transition, draw normally
                left_func(surface, trang_trai_rect)
                right_func(surface, trang_phai_rect)
        else:
            # Draw normally without transition
            left_func(surface, trang_trai_rect)
            right_func(surface, trang_phai_rect)
    def start_flip(self, flip_type="slide_left"):
        """Start page flip transition animation
        
        Args:
            flip_type: "slide_left" or "slide_right"
        """
        self.flip_active = True
        self.flip_progress = 0.0
        self.flip_type = flip_type
_ck("MD_CHECKPOINT: 28 reached AccountSystem class definition (all prior class defs OK)")
class AccountSystem:
    """
    Quản lý tài khoản nhiều học sinh trên cùng một máy tính.

    TRƯỚC ĐÂY: toàn bộ dữ liệu của mọi học sinh được lưu chung vào MỘT file
    JSON dạng văn bản thuần (user_data.json) — bất kỳ em nào cũng có thể mở
    bằng Notepad để xem/sửa điểm số, Vàng... của bạn khác, và một lần ghi lỗi
    giữa chừng (mất điện, tắt máy đột ngột) có thể làm hỏng dữ liệu của TẤT CẢ
    học sinh cùng lúc.

    BÂY GIỜ: dữ liệu được lưu trong SQLite (user_data.db) — mỗi lần lưu là
    MỘT GIAO DỊCH (transaction) nguyên tử: hoặc ghi thành công trọn vẹn, hoặc
    giữ nguyên dữ liệu cũ, không có trạng thái "ghi dở". File .db cũng không
    mở được trực tiếp bằng Notepad như JSON, giảm rủi ro học sinh xem/sửa
    trộm dữ liệu của bạn khác. Dữ liệu JSON cũ (nếu có từ phiên bản trước) sẽ
    được TỰ ĐỘNG DI TRÚ sang SQLite trong lần chạy đầu tiên.
    """
    def __init__(self):
        # Dùng writable_base thay vì tên file tương đối: đảm bảo save game luôn
        # đọc/ghi cạnh file .exe thật, bất kể game được khởi chạy từ thư mục nào
        # (ví dụ từ shortcut có "Start in" khác thư mục chứa main.exe).
        self.file = os.path.join(writable_base, "user_data.json")      # chỉ dùng để di trú dữ liệu cũ (không còn ghi mới)
        self.db_file = os.path.join(writable_base, "user_data.db")
        self.accounts = self.load()
        self.current_user = None
    def _db_connect(self):
        if not sqlite3:
            raise RuntimeError("sqlite3 không khả dụng trên web")
        conn = sqlite3.connect(self.db_file)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS game_data ("
            "id INTEGER PRIMARY KEY CHECK (id = 1), "
            "accounts_json TEXT NOT NULL)"
        )
        return conn
    def _db_write(self, accounts_dict):
        """Ghi TOÀN BỘ self.accounts vào SQLite trong một transaction — thành công
        trọn vẹn hoặc không thay đổi gì, không bao giờ để lại dữ liệu ghi dở.
        TRÊN WEB: bỏ qua hoàn toàn — khoá file kiểu SQLite không đáng tin cậy
        trong hệ thống file ảo của trình duyệt (Emscripten/Pyodide), có thể gây
        treo. Dữ liệu web vốn dĩ cũng không lưu bền vững qua lần tải lại trang
        (thiếu BrowserFS) nên chỉ giữ trong bộ nhớ (self.accounts) là đủ."""
        if IS_WEB_BUILD:
            return
        payload = json.dumps(accounts_dict, ensure_ascii=False)
        conn = self._db_connect()
        try:
            with conn:
                conn.execute(
                    "INSERT INTO game_data (id, accounts_json) VALUES (1, ?) "
                    "ON CONFLICT(id) DO UPDATE SET accounts_json = excluded.accounts_json",
                    (payload,),
                )
        finally:
            conn.close()
    def load(self):
        default_data = {ADMIN_USER: {"password": hash_password(ADMIN_PASS), "data": {"grade":1, "xp":0, "level":1}}}

        if IS_WEB_BUILD:
            # Không chạm vào SQLite/file trên web — chỉ dùng dữ liệu mặc định
            # trong bộ nhớ. Tránh nguy cơ treo do khoá file SQLite không hoạt
            # động đúng trong hệ thống file ảo của trình duyệt.
            return default_data

        # 1) Ưu tiên đọc từ SQLite — nơi lưu trữ chính hiện tại.
        try:
            conn = self._db_connect()
            row = conn.execute("SELECT accounts_json FROM game_data WHERE id = 1").fetchone()
            conn.close()
            if row and row[0]:
                return json.loads(row[0])
        except (sqlite3.Error, json.JSONDecodeError) as e:
            log_error(f"Không đọc được database SQLite, thử khôi phục từ dữ liệu cũ: {e}")

        # 2) Chưa có SQLite (lần đầu nâng cấp) — di trú dữ liệu cũ từ JSON phẳng nếu có.
        for legacy_path in (self.file, self.file + ".bak"):
            if os.path.exists(legacy_path) and os.path.getsize(legacy_path) > 0:
                try:
                    with open(legacy_path, "r", encoding='utf-8') as f:
                        data = json.load(f)
                    self._db_write(data)
                    log_info(f"Đã di trú dữ liệu từ '{legacy_path}' sang SQLite (user_data.db).")
                    return data
                except (json.JSONDecodeError, IOError, sqlite3.Error) as e2:
                    log_error(f"File dữ liệu cũ '{legacy_path}' bị lỗi, không thể di trú: {e2}")
        return default_data
    def save(self):
        if not self.current_user:
            return
        try:
            self._db_write(self.accounts)
        except Exception as e:
            try:
                log_error(f"Lỗi ghi dữ liệu: {e}")
            except Exception:
                pass
    def data(self):
        if not self.current_user:
            return {}
        d = self.accounts[self.current_user].setdefault("data", {
            "grade":1,
            "xp":0,
            "level":1,
            "history":[],
            "completed_lessons":[],
            "mastery_levels": {},
            "recent_answers": [],
            "streak": 0,
            "max_streak": 0,
            "energy": 0,
            "fever_mode": False,
            "flagged_topics": [],
            "pet": {"type": "clover", "stage": 0, "name": "Cỏ Non"},  # Linh vật mặc định
            "collected_cards": [],  # Danh sách thẻ bài đã thu thập
            "avatar_path": "",
            "gold": 0,
            "unlocked_pets": ["clover"],
        })
        if "pet" not in d:
            d["pet"] = {"type": "clover", "stage": 0, "name": "Cỏ Non"}
        if "collected_cards" not in d:
            d["collected_cards"] = []
        if "avatar_path" not in d:
            d["avatar_path"] = ""
        if "gold" not in d:
            d["gold"] = 0
        if "unlocked_pets" not in d:
            d["unlocked_pets"] = ["clover"]
        if "history" not in d:
            d["history"] = []
        if "completed_lessons" not in d:
            d["completed_lessons"] = []
        if "mastery_levels" not in d:
            d["mastery_levels"] = {}
        return d
    def login(self, u, p):
        if u in self.accounts:
            user_obj = self.accounts[u]
            if user_obj.get("status") == "locked":
                return False, f"Tài khoản đã bị khóa vào {user_obj.get('lock_date')}.\nLiên hệ Admin để mở."
            stored = user_obj.get("password", "")
            if is_password_hashed(stored):
                ok = verify_password(p, stored)
            else:
                # Dữ liệu cũ còn lưu mật khẩu dạng văn bản thuần (trước bản vá này).
                # Xác thực bằng so sánh trực tiếp lần cuối, sau đó NÂNG CẤP ngay
                # thành bản mã hoá để không còn văn bản thuần trong file dữ liệu.
                ok = (stored == p)
                if ok:
                    user_obj["password"] = hash_password(p)
                    self.save()
            if ok:
                self.current_user = u
                if u == ADMIN_USER: self.set_max(u)
                self.data()
                return True, "Thành công"
        return False, "Sai tài khoản/mật khẩu"
    def lock_user(self, username):
        self.accounts[username]["status"] = "locked"
        self.accounts[username]["lock_date"] = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
        self.save()
    def reset_user(self, username):
        self.accounts[username]["data"] = {"grade": 1, "level": 1, "xp": 0}
        self.save()
    def change_grade(self, username, new_grade):
        if username in self.accounts and 1 <= new_grade <= 5:
            if "data" not in self.accounts[username]:
                self.accounts[username]["data"] = {}
            self.accounts[username]["data"]["grade"] = new_grade
            self.save()
    def set_max(self, username):
        d = self.accounts[username].setdefault("data", {})
        d["level"], d["xp"] = 9999, 9800
        self.save()
    def add_score(self, lesson, score):
        d = self.data()
        entry = {"date": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), "lesson": lesson, "score": score}
        if "history" not in d: d["history"] = []
        d["history"].insert(0, entry)
        if lesson not in d.get("completed_lessons", []):
            d.setdefault("completed_lessons", []).append(lesson)
            daily_task_progress("play_1", 1)  # Hoàn thành nhiệm vụ khi hoàn thành bài học
        self.save()
    def log_history(self, username, lesson, score):
        d = self.accounts[username]["data"]
        entry = {"date": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), "lesson": lesson, "score": score}
        if "history" not in d: d["history"] = []
        d["history"].insert(0, entry)
        if lesson not in d.get("completed_lessons", []):
            d.setdefault("completed_lessons", []).append(lesson)
        self.save()
    def register(self, username, password, grade=1):
        if not username or not password: return False, "Không được để trống!"
        if username in self.accounts: return False, "Tài khoản đã tồn tại!"
        self.accounts[username] = {
            "password": hash_password(password), "status": "active",
            "data": {
                "grade": grade, "xp": 0, "level": 1, "history": [], "completed_lessons": [],
                "mastery_levels": {}, "recent_answers": [], "streak": 0, "max_streak": 0,
                "energy": 0, "fever_mode": False, "flagged_topics": [],
                "pet": {"type": "clover", "stage": 0, "name": "Cỏ Non"},
                "collected_cards": [],
                "avatar_path": "",
                "gold": 0,
                "unlocked_pets": ["clover"],
            }
        }
        self.save()
        return True, "Đăng ký thành công!"
    def update_mastery(self, topic_id, is_correct, response_time=None):
        """Cập nhật độ thông thạo cho một chủ đề theo SRS, có xem xét thời gian phản hồi
        
        Args:
            topic_id: ID của chủ đề
            is_correct: Câu trả lời có đúng không
            response_time: Thời gian phản hồi (giây) - nếu không được cung cấp sẽ không áp dụng penalty
        """
        d = self.data()
        mastery = d["mastery_levels"].get(topic_id, {"strength": 0.5, "ease_factor": 2.5, "interval": 1, "last_practiced": None})
        
        # Determine expected response time based on grade (học sinh lớp 1 chỉ mất 5-8 giây cho phép tính đơn giản)
        grade = d.get("grade", 1)
        expected_time = 4.0 + (grade - 1) * 1.5  # ~4s for grade 1, ~5.5s for grade 2, etc
        max_acceptable_time = expected_time + 6.0  # Cho phép 6 giây thêm
        
        if is_correct:
            mastery["strength"] = min(1.0, mastery["strength"] + 0.1)
            mastery["ease_factor"] = min(3.0, mastery["ease_factor"] + 0.1)
            mastery["interval"] = int(mastery["interval"] * mastery["ease_factor"])
            
            # Penalty if response time is too long (người học chưa thực sự thành thạo)
            if response_time is not None and response_time > max_acceptable_time:
                # Slow correct answer = incomplete mastery
                # Reduce interval gain and ease_factor improvement
                time_penalty = min(0.5, (response_time - max_acceptable_time) / (max_acceptable_time * 2))
                mastery["interval"] = int(mastery["interval"] * (1.0 - time_penalty * 0.4))  # Reduce interval gain
                mastery["ease_factor"] = max(1.3, mastery["ease_factor"] - time_penalty * 0.2)  # Reduce ease gain
                log_info(f"Chập: {topic_id} đúng nhưng mất {response_time:.1f}s (kỳ vọng: {expected_time:.1f}s) - Điều chỉnh interval")
        else:
            mastery["strength"] = max(0.0, mastery["strength"] - 0.2)
            mastery["ease_factor"] = max(1.3, mastery["ease_factor"] - 0.2)
            mastery["interval"] = max(1, mastery["interval"] // 2)
        
        mastery["last_practiced"] = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
        d["mastery_levels"][topic_id] = mastery
        self.save()
        return mastery
    def update_skill_mastery(self, tags, is_correct, used_hint=False):
        """
        Cập nhật độ thông thạo cho từng THẺ KỸ NĂNG NHỎ (micro-skill, vd: "co_nho",
        "bang_cuu_chuong"...) bằng công thức Trung bình động lũy thừa (EMA):
            M_new = (1 - alpha) * M_old + alpha * S
        alpha = 0.3 (hệ số học tập), S = 1 nếu đúng, 0.5 nếu đúng nhờ gợi ý, 0 nếu sai.

        Đồng thời áp dụng "Chiến lược can thiệp Sư phạm":
        - Sai 1 lần một thẻ: bỏ qua, coi như bất cẩn.
        - Sai 2 lần LIÊN TIẾP cùng một thẻ: trả về can thiệp ("hint", tag) để game
          hiển thị gợi ý trực quan MIỄN PHÍ (không trừ Vàng).
        - Sai 3 lần trở lên: trả về can thiệp ("simplify", tag) để game tạm thời
          giảm độ khó, khôi phục sự tự tin trước khi quay lại thẻ đó.
        Trả về danh sách các can thiệp (tag, loại) cần xử lý ở phía UI.
        """
        if not tags:
            return []
        d = self.data()
        mastery = d.setdefault("skill_mastery", {})
        miss_streak = d.setdefault("skill_miss_streak", {})
        alpha = 0.3
        if is_correct and not used_hint:
            score = 1.0
        elif is_correct and used_hint:
            score = 0.5
        else:
            score = 0.0
        interventions = []
        for tag in tags:
            old_m = mastery.get(tag, 0.5)
            mastery[tag] = round((1 - alpha) * old_m + alpha * score, 3)
            if is_correct:
                miss_streak[tag] = 0
            else:
                miss_streak[tag] = miss_streak.get(tag, 0) + 1
                if miss_streak[tag] == 2:
                    interventions.append((tag, "hint"))
                elif miss_streak[tag] >= 3:
                    interventions.append((tag, "simplify"))
        self.save()
        return interventions
    def analyze_skill_weaknesses(self, threshold=0.4):
        """Trả về danh sách các thẻ kỹ năng học sinh đang yếu (độ thông thạo < threshold)."""
        d = self.data()
        mastery = d.get("skill_mastery", {})
        return [tag for tag, m in mastery.items() if m < threshold]
    def update_recent_answers(self, is_correct):
        """Cập nhật danh sách câu trả lời gần nhất (giữ 10 câu gần nhất)"""
        d = self.data()
        if "recent_answers" not in d:
            d["recent_answers"] = []
        d["recent_answers"].append(is_correct)
        if len(d["recent_answers"]) > 10:
            d["recent_answers"] = d["recent_answers"][-10:]
        self.save()
    def update_streak(self, is_correct):
        """Cập nhật chuỗi trả lời đúng"""
        d = self.data()
        if "streak" not in d:
            d["streak"] = 0
        if "max_streak" not in d:
            d["max_streak"] = 0
        if is_correct:
            d["streak"] += 1
            d["max_streak"] = max(d["max_streak"], d["streak"])
        else:
            d["streak"] = 0
        self.save()
    def update_energy(self, is_correct):
        """Cập nhật năng lượng kiến thức và kích hoạt Fever Mode"""
        d = self.data()
        if "energy" not in d:
            d["energy"] = 0
        if "fever_mode" not in d:
            d["fever_mode"] = False
        if is_correct:
            d["energy"] = min(100, d["energy"] + 10)
            if d["energy"] >= 100:
                d["fever_mode"] = True
        else:
            d["energy"] = max(0, d["energy"] - 5)
            if d["energy"] < 50:
                d["fever_mode"] = False
        self.save()
    def flag_topic(self, topic_id):
        """Đánh dấu chủ đề cần ôn tập (Targeted Practice)"""
        d = self.data()
        if "flagged_topics" not in d:
            d["flagged_topics"] = []
        if topic_id not in d["flagged_topics"]:
            d["flagged_topics"].append(topic_id)
        self.save()
    def unflag_topic(self, topic_id):
        """Bỏ đánh dấu chủ đề khi đã làm đúng"""
        d = self.data()
        if "flagged_topics" in d and topic_id in d["flagged_topics"]:
            d["flagged_topics"].remove(topic_id)
        self.save()
    def get_difficulty_adjustment(self):
        """Điều chỉnh độ khó dựa trên tỷ lệ trả lời đúng 10 câu gần nhất"""
        d = self.data()
        if not d.get("recent_answers"):
            return 0  # Không điều chỉnh
        correct_count = sum(d["recent_answers"])
        accuracy = correct_count / len(d["recent_answers"])
        if accuracy > 0.9:
            return 1  # Tăng độ khó
        elif accuracy > 0.7:
            return 0  # Giữ nguyên
        else:
            return -1  # Giảm độ khó
    def should_review(self, topic_id):
        """Kiểm tra xem chủ đề có cần ôn tập không"""
        d = self.data()
        mastery = d.get("mastery_levels", {}).get(topic_id)
        if not mastery:
            return True  # Chưa bao giờ học, cần học
        if mastery["strength"] < 0.5:
            return True  # Độ thông thạo thấp, cần ôn tập
        if topic_id in d.get("flagged_topics", []):
            return True  # Đã bị đánh dấu cần ôn tập
        # Kiểm tra thời gian ôn tập
        if mastery["last_practiced"]:
            last_time = datetime.datetime.strptime(mastery["last_practiced"], "%d/%m/%Y %H:%M")
            days_since = (datetime.datetime.now() - last_time).days
            if days_since >= mastery["interval"]:
                return True  # Đến lúc ôn tập theo SRS
        return False
    def get_learning_flow_questions(self, current_grade, current_lesson, total_questions=15):
        """Trả về danh sách câu hỏi theo Learning Flow: 20% ôn cũ, 60% dạy mới, 20% thử thách"""
        d = self.data()
        flow = []
        # 20% Ôn cũ - lấy từ flagged_topics và mastery thấp
        review_count = int(total_questions * 0.2)
        review_topics = d.get("flagged_topics", [])[:review_count]
        # 60% Dạy mới - câu hỏi từ bài học hiện tại
        new_count = int(total_questions * 0.6)
        # 20% Thử thách - câu hỏi từ bài tiếp theo hoặc lớp trên
        challenge_count = total_questions - review_count - new_count
        return {
            "review": {"count": review_count, "topics": review_topics},
            "new": {"count": new_count, "lesson": current_lesson},
            "challenge": {"count": challenge_count, "grade": current_grade}
        }
    def update_skill_progress(self, lesson_title):
        """Cập nhật tiến độ kỹ năng khi hoàn thành bài học"""
        d = self.data()
        grade = d.get("grade", 1)
        # Lấy số bài học từ tiêu đề
        try:
            lesson_num = int(lesson_title.split(".")[0].replace("Bài", "").strip())
        except (ValueError, AttributeError):
            lesson_num = 1
        # Lấy danh sách kỹ năng liên quan đến bài học
        skills = knowledge_graph.get_lesson_skills(grade, lesson_num)
        # Khởi tạo skill_progress nếu chưa có
        if "skill_progress" not in d:
            d["skill_progress"] = {}
        # Cập nhật tiến độ cho từng kỹ năng
        for skill in skills:
            skill_id = skill["id"]
            if skill_id not in d["skill_progress"]:
                d["skill_progress"][skill_id] = {
                    "name": skill["name"],
                    "completed_lessons": [],
                    "progress": 0
                }
            # Thêm bài học vào danh sách đã hoàn thành nếu chưa có
            if lesson_num not in d["skill_progress"][skill_id]["completed_lessons"]:
                d["skill_progress"][skill_id]["completed_lessons"].append(lesson_num)
            # Tính toán tiến độ
            skill_info = knowledge_graph.get_skill_info(grade, skill_id)
            if skill_info:
                total_lessons = len(skill_info.get("lessons", []))
                completed = len(d["skill_progress"][skill_id]["completed_lessons"])
                d["skill_progress"][skill_id]["progress"] = (completed / total_lessons) * 100 if total_lessons > 0 else 0
        self.save()
        return d["skill_progress"]
    def get_skill_progress(self):
        """Lấy tiến độ kỹ năng hiện tại"""
        d = self.data()
        return d.get("skill_progress", {})
    def get_unlocked_skills(self):
        """Lấy danh sách kỹ năng đã mở khóa"""
        d = self.data()
        grade = d.get("grade", 1)
        user_level = d.get("level", 1)
        completed_lessons = d.get("completed_lessons", [])
        skills = knowledge_graph.get_skills_for_grade(grade)
        unlocked = []
        for skill_id, skill_info in skills.items():
            if knowledge_graph.is_skill_unlocked(grade, skill_id, user_level):
                skill_progress = self.get_skill_progress()
                progress = skill_progress.get(skill_id, {}).get("progress", 0)
                unlocked.append({
                    "id": skill_id,
                    "name": skill_info["name"],
                    "progress": progress,
                    "lessons": skill_info["lessons"]
                })
        return unlocked
    def get_lessons_needing_review(self):
        """Lấy danh sách bài học cần ôn tập (nứt vỡ)"""
        d = self.data()
        grade = d.get("grade", 1)
        completed_lessons = d.get("completed_lessons", [])
        mastery_levels = d.get("mastery_levels", {})
        lessons_needing_review = []
        for lesson in completed_lessons:
            topic_id = f"{grade}_{lesson}"
            # Kiểm tra xem bài học có cần ôn tập không
            mastery = mastery_levels.get(topic_id)
            needs_review = False
            if mastery:
                # Kiểm tra độ thông thạo thấp
                if mastery.get("strength", 0) < 0.5:
                    needs_review = True
                # Kiểm tra thời gian ôn tập
                if mastery.get("last_practiced"):
                    try:
                        last_time = datetime.datetime.strptime(mastery["last_practiced"], "%d/%m/%Y %H:%M")
                        days_since = (datetime.datetime.now() - last_time).days
                        interval = mastery.get("interval", 1)
                        if days_since >= interval:
                            needs_review = True
                    except (ValueError, TypeError):
                        needs_review = True
            else:
                # Không có dữ liệu mastery, cần ôn tập
                needs_review = True
            if needs_review:
                lessons_needing_review.append(lesson)
        return lessons_needing_review
    def get_pet(self):
        """Lấy thông tin linh vật hiện tại"""
        d = self.data()
        return d.get("pet", {"type": "clover", "stage": 0, "name": "Cỏ Non"})
    def can_evolve_pet(self):
        """Kiểm tra xem linh vật có thể tiến hóa không"""
        d = self.data()
        pet = d.get("pet", {"type": "clover", "stage": 0, "name": "Cỏ Non"})
        current_xp = d.get("xp", 0)
        return pet_system.can_evolve(pet["type"], pet["stage"], current_xp)
    def evolve_pet(self):
        """Tiến hóa linh vật"""
        d = self.data()
        pet = d.get("pet", {"type": "clover", "stage": 0, "name": "Cỏ Non"})
        current_xp = d.get("xp", 0)
        if not self.can_evolve_pet():
            return False
        # Tăng cấp độ
        new_stage = pet["stage"] + 1
        pet_info = pet_system.get_pet_info(pet["type"], new_stage)
        if pet_info:
            pet["stage"] = new_stage
            pet["name"] = pet_info["name"]
            d["pet"] = pet
            self.save()
            return True
        return False
    def change_pet_type(self, new_pet_type):
        """Đổi loại linh vật"""
        d = self.data()
        if new_pet_type not in pet_system.pet_types:
            return False
        unlocked = d.get("unlocked_pets", ["clover"])
        if new_pet_type not in unlocked:
            return False
        pet_info = pet_system.get_pet_info(new_pet_type, 0)
        if pet_info:
            d["pet"] = {
                "type": new_pet_type,
                "stage": 0,
                "name": pet_info["name"]
            }
            self.save()
            return True
        return False
    def purchase_pet(self, pet_type):
        """Mua thú cưng bằng vàng."""
        d = self.data()
        if pet_type not in pet_system.pet_types:
            return False, "Thú cưng không tồn tại."
        unlocked = d.setdefault("unlocked_pets", ["clover"])
        if pet_type in unlocked:
            return False, "Đã sở hữu thú cưng này."
        price = pet_system.get_pet_price(pet_type)
        gold = int(d.get("gold", 0))
        if self.current_user != ADMIN_USER:
            if gold < price:
                return False, "Không đủ vàng để mua."
            d["gold"] = gold - price
        unlocked.append(pet_type)
        self.save()
        return True, f"Mua thành công ({price} vàng)."
    def set_avatar_from_file(self, source_path):
        """Lưu avatar từ file local vào thư mục game và cập nhật tài khoản."""
        # BUG FIX (pygbag): không có hệ thống file thật trên web.
        if IS_WEB_BUILD:
            return False, "Đổi avatar không được hỗ trợ trên web."
        if not source_path or not os.path.exists(source_path):
            return False, "Không tìm thấy ảnh đã chọn."
        ext = os.path.splitext(source_path)[1].lower()
        if ext not in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
            return False, "Định dạng ảnh không hỗ trợ."
        try:
            safe_name = f"{self.current_user}_{int(time.time())}{ext}"
            target_path = os.path.join(AVATAR_DIR, safe_name)
            if shutil:
                shutil.copy2(source_path, target_path)
            else:
                with open(source_path,"rb") as _fi:
                    with open(target_path,"wb") as _fo: _fo.write(_fi.read())
            d = self.data()
            d["avatar_path"] = target_path
            self.save()
            refresh_character_avatar()
            return True, "Đổi avatar thành công."
        except (OSError, IOError, Exception) as e:
            logger.error(f"Không thể lưu avatar cho '{self.current_user}': {e}")
            return False, "Không thể cập nhật avatar."
    def get_collected_cards(self):
        """Lấy danh sách thẻ bài đã thu thập"""
        d = self.data()
        return d.get("collected_cards", [])
    def add_card(self, card_id):
        """Thêm thẻ bài vào danh sách đã thu thập"""
        d = self.data()
        if "collected_cards" not in d:
            d["collected_cards"] = []
        if card_id not in d["collected_cards"]:
            d["collected_cards"].append(card_id)
            self.save()
    def purchase_skin(self, skin_key):
        """Mua skin bằng vàng."""
        d = self.data()
        if skin_key not in skin_system.skin_types:
            return False, "Skin không tồn tại."
        unlocked = d.setdefault("unlocked_skins", ["pen_basic", "board_wood"])
        if skin_key in unlocked:
            return False, "Đã sở hữu skin này."
        price = skin_system.get_skin_price(skin_key)
        gold = int(d.get("gold", 0))
        if self.current_user != ADMIN_USER:
            if gold < price:
                return False, "Không đủ vàng để mua."
            d["gold"] = gold - price
        unlocked.append(skin_key)
        self.save()
        return True, f"Mua skin thành công ({price} vàng)."
    def equip_skin(self, skin_key):
        """Trang bị skin."""
        d = self.data()
        if skin_key not in skin_system.skin_types:
            return False, "Skin không tồn tại."
        unlocked = d.get("unlocked_skins", ["pen_basic", "board_wood"])
        if skin_key not in unlocked:
            return False, "Chưa sở hữu skin này."
        skin_type = skin_system.skin_types[skin_key].get("type")
        if skin_type == "pen":
            d["equipped_pen"] = skin_key
        elif skin_type == "board":
            d["equipped_board"] = skin_key
        self.save()
        return True, "Trang bị skin thành công."
    def get_equipped_skins(self):
        """Lấy skin đang trang bị."""
        d = self.data()
        return {
            "pen": d.get("equipped_pen", "pen_basic"),
            "board": d.get("equipped_board", "board_wood")
        }
    def get_unlocked_skins(self):
        """Lấy danh sách skin đã mở khóa."""
        d = self.data()
        return d.get("unlocked_skins", ["pen_basic", "board_wood"])
    def get_skill_levels(self):
        """Lấy cấp độ kỹ năng của người chơi"""
        d = self.data()
        return d.get("skill_levels", {})
    def unlock_skill(self, skill_id):
        """Mở khóa kỹ năng"""
        d = self.data()
        user_level = d.get("level", 1)
        user_xp = d.get("xp", 0)
        can_unlock, msg = skill_tree_system.can_unlock_skill(skill_id, user_level, user_xp)
        if not can_unlock:
            return False, msg
        # Trừ XP mở khóa
        unlock_cost = 50
        if user_xp < unlock_cost:
            return False, "Không đủ XP để mở khóa."
        d["xp"] = user_xp - unlock_cost
        skill_levels = d.setdefault("skill_levels", {})
        skill_levels[skill_id] = 1  # Cấp độ 1 khi mở khóa
        # Đánh dấu kỹ năng đã mở khóa trong hệ thống
        skill_tree_system.skills[skill_id]["unlocked"] = True
        self.save()
        return True, f"Mở khóa kỹ năng thành công! (-{unlock_cost} XP)"
    def upgrade_skill(self, skill_id):
        """Nâng cấp kỹ năng"""
        d = self.data()
        skill_levels = d.setdefault("skill_levels", {})
        current_level = skill_levels.get(skill_id, 0)
        user_xp = d.get("xp", 0)
        success, msg = skill_tree_system.upgrade_skill(skill_id, user_xp, current_level)
        if not success:
            return False, msg
        # Trừ XP và tăng cấp
        cost_list = skill_tree_system.skills[skill_id].get("cost_per_level", [])
        if current_level < len(cost_list):
            upgrade_cost = cost_list[current_level]
            d["xp"] = user_xp - upgrade_cost
            skill_levels[skill_id] = current_level + 1
        self.save()
        return True, msg
    def activate_skill(self, skill_id):
        """Kích hoạt kỹ năng có thời hạn"""
        d = self.data()
        skill_levels = d.get("skill_levels", {})
        level = skill_levels.get(skill_id, 0)
        if level <= 0:
            return False, "Kỹ năng chưa mở khóa."
        return skill_tree_system.activate_skill(skill_id, level)
    def get_skill_bonuses(self):
        """Lấy tất cả bonus từ kỹ năng"""
        skill_levels = self.get_skill_levels()
        return skill_tree_system.get_passive_bonuses(skill_levels)
    def spend_skill_shield(self):
        """Sử dụng khiên bảo vệ"""
        d = self.data()
        shields = d.get("active_shields", 0)
        if shields <= 0:
            return False
        d["active_shields"] = shields - 1
        self.save()
        return True
    def add_card_to_collection(self, card_id):
        """Thêm thẻ bài vào bộ sưu tập"""
        d = self.data()
        if "collected_cards" not in d:
            d["collected_cards"] = []
        if card_id not in d["collected_cards"]:
            d["collected_cards"].append(card_id)
            self.save()
            return True  # Thẻ mới
        return False  # Đã có thẻ này
    def has_card(self, card_id):
        """Kiểm tra xem đã thu thập thẻ chưa"""
        collected_cards = self.get_collected_cards()
        return card_id in collected_cards

    # ── Ticket (Vé Quay) Management ────────────────────────
    def get_tickets(self):
        """Trả về số vé hiện có: {"standard": int, "special": int}"""
        d = self.data()
        return {
            "standard": int(d.get("ticket_standard", 0)),   # Vé thường (3★→4★ banner)
            "special":  int(d.get("ticket_special",  0)),   # Vé đặc biệt (banner nhân vật/vũ khí)
        }

    def add_tickets(self, standard=0, special=0):
        d = self.data()
        d["ticket_standard"] = int(d.get("ticket_standard", 0)) + standard
        d["ticket_special"]  = int(d.get("ticket_special",  0)) + special
        self.save()

    def spend_tickets(self, ticket_type="standard", count=1):
        """
        Trừ vé. ticket_type: "standard" | "special".
        Trả về True nếu đủ vé, False nếu thiếu.
        Admin không cần vé.
        """
        if self.current_user == ADMIN_USER:
            return True
        d = self.data()
        key = "ticket_standard" if ticket_type == "standard" else "ticket_special"
        have = int(d.get(key, 0))
        if have < count:
            return False
        d[key] = have - count
        self.save()
        return True
    # -------------------------------------------------------
    GACHA_POOL = {
        "common": [
            {"title": "Cộng Thần Tốc",    "icon": "➕", "category": "Thường",      "content": "Tăng 10% tốc độ tính nhẩm phép cộng."},
            {"title": "Trừ Chớp Nhoáng",  "icon": "➖", "category": "Thường",      "content": "Giảm 5% thời gian suy nghĩ phép trừ."},
            {"title": "Nhân Vũ Bão",       "icon": "✖️", "category": "Thường",      "content": "Tăng nhẹ điểm khi trả lời đúng phép nhân."},
            {"title": "Chia Cắt Gió",      "icon": "➗", "category": "Thường",      "content": "Câu hỏi phép chia xuất hiện nhiều hơn 10%."},
            {"title": "Ghi Nhớ Nhanh",     "icon": "📝", "category": "Thường",      "content": "Tăng 5% tốc độ ghi nhớ công thức."},
        ],
        "rare": [
            {"title": "Bảo Hộ Thales",    "icon": "📐", "category": "Hiếm",        "content": "Tăng tỉ lệ chính xác khi làm toán hình học."},
            {"title": "La Bàn Euler",      "icon": "🧭", "category": "Hiếm",        "content": "Mở khóa gợi ý đường thẳng Euler trong bài khó."},
            {"title": "Định Lý Pythago",   "icon": "📏", "category": "Hiếm",        "content": "Câu hỏi tam giác vuông sẽ hiển thị thêm gợi ý."},
            {"title": "Bộ Nhớ Siêu Cấp",  "icon": "🧠", "category": "Hiếm",        "content": "Tăng EXP nhận được 15% trong phiên hiện tại."},
            {"title": "Đồng Hồ Cát",       "icon": "⏳", "category": "Hiếm",        "content": "Cộng thêm 3 giây cho mỗi câu trả lời đúng."},
        ],
        "legendary": [
            {"title": "Nhà Thông Thái Lão Hạc", "icon": "👴", "category": "Huyền Thoại", "content": "Nhân 2 điểm thưởng nhận được từ các câu hỏi Văn học!"},
            {"title": "Tia Sáng Pygame",         "icon": "🐍", "category": "Huyền Thoại", "content": "Đóng băng thời gian đếm ngược của câu hỏi trong 5 giây."},
            {"title": "Thần Toán Archimedes",    "icon": "🏛️", "category": "Huyền Thoại", "content": "Nhân đôi toàn bộ Vàng nhận được trong 1 phiên chơi!"},
            {"title": "Rồng Số Học",             "icon": "🐉", "category": "Huyền Thoại", "content": "Kích hoạt chế độ x3 điểm trong 10 câu hỏi tiếp theo."},
        ],
    }
    # Tỉ lệ cơ bản
    GACHA_BASE_RATES = {"common": 0.943, "rare": 0.051, "legendary": 0.006}
    # Soft pity bắt đầu từ pull thứ 74, hard pity tại pull 90 (giống HSR)
    GACHA_SOFT_PITY_START = 74
    GACHA_HARD_PITY = 90
    # Guaranteed 50/50: lần legendary đầu 50% là featured, lần tiếp chắc chắn featured
    # (trong game này dùng guaranteed = mỗi 2 legendary sẽ có 1 guaranteed)

    def _get_gacha_state(self):
        """Lấy trạng thái pity từ dữ liệu người chơi (tạo nếu chưa có)."""
        d = self.data()
        if "gacha_state" not in d:
            d["gacha_state"] = {
                "pull_count": 0,          # Số pull từ legendary gần nhất
                "total_pulls": 0,         # Tổng pull từ trước đến nay
                "guaranteed_legendary": False,  # Guaranteed 50/50 tiếp theo
                "rare_pity": 0,           # Pull count từ rare gần nhất (đảm bảo rare mỗi 10)
            }
        return d["gacha_state"]

    def _calc_legendary_prob(self, pull_count):
        """Tính xác suất legendary có soft pity (giống HSR)."""
        if pull_count < self.GACHA_SOFT_PITY_START:
            return self.GACHA_BASE_RATES["legendary"]
        elif pull_count < self.GACHA_HARD_PITY:
            # Tăng dần từ 0.6% lên ~100% trong vòng soft→hard pity
            extra = (pull_count - self.GACHA_SOFT_PITY_START) * 0.06
            return min(1.0, self.GACHA_BASE_RATES["legendary"] + extra)
        else:
            return 1.0  # Hard pity đảm bảo legendary

    def _single_pull(self, gacha_state):
        """Thực hiện 1 lần kéo, trả về (card, rarity, is_new)."""
        gacha_state["pull_count"] += 1
        gacha_state["total_pulls"] += 1
        gacha_state["rare_pity"] += 1

        # Tính xác suất legendary với pity
        p_legendary = self._calc_legendary_prob(gacha_state["pull_count"])
        roll = random.random()

        if roll < p_legendary:
            rarity = "legendary"
            gacha_state["pull_count"] = 0   # Reset pity
            gacha_state["rare_pity"] = 0
        elif gacha_state["rare_pity"] >= 10 or roll < p_legendary + self.GACHA_BASE_RATES["rare"]:
            rarity = "rare"
            gacha_state["rare_pity"] = 0    # Reset rare pity
        else:
            rarity = "common"

        card = random.choice(self.GACHA_POOL[rarity]).copy()
        card["rarity"] = rarity

        # Cập nhật inventory
        d = self.data()
        inventory = d.setdefault("inventory", [])
        is_new = card["title"] not in inventory
        if is_new:
            inventory.append(card["title"])

        return card, rarity, is_new

    def pull_gacha(self, banner_type="normal", count=1):
        """
        Kéo gacha theo chuẩn HSR.
        - count=1  → quay 1 lần
        - count=10 → quay 10 lần (đảm bảo ít nhất 1 rare)
        - banner_type="gold" → tỷ lệ rare/legendary cao hơn (không áp dụng pity riêng)
        Trả về: list[(card, is_new)]
        """
        d = self.data()
        gacha_state = self._get_gacha_state()

        results = []
        has_rare_or_higher = False

        for i in range(count):
            card, rarity, is_new = self._single_pull(gacha_state)

            # Gold banner: boost rare/legendary (re-roll common → rare với 50%)
            if banner_type == "gold" and rarity == "common":
                if random.random() < 0.50:
                    card, rarity, is_new = self._single_pull_override_rare(gacha_state, d)

            if rarity in ("rare", "legendary"):
                has_rare_or_higher = True

            results.append((card, is_new))

        # 10-pull guarantee: nếu không có rare trở lên → đổi pull cuối thành rare
        if count == 10 and not has_rare_or_higher:
            forced = random.choice(self.GACHA_POOL["rare"]).copy()
            forced["rarity"] = "rare"
            inventory = d.setdefault("inventory", [])
            is_new_f = forced["title"] not in inventory
            if is_new_f:
                inventory.append(forced["title"])
            results[-1] = (forced, is_new_f)

        self.save()

        # Tương thích ngược: nếu count=1 trả về (card, is_new)
        if count == 1:
            return results[0]
        return results

    def _single_pull_override_rare(self, gacha_state, d):
        """Kéo forced rare (dùng cho gold banner boost)."""
        card = random.choice(self.GACHA_POOL["rare"]).copy()
        card["rarity"] = "rare"
        gacha_state["rare_pity"] = 0
        inventory = d.setdefault("inventory", [])
        is_new = card["title"] not in inventory
        if is_new:
            inventory.append(card["title"])
        return card, "rare", is_new

    def get_pity_info(self):
        """Trả về thông tin pity hiển thị trên UI."""
        state = self._get_gacha_state()
        count = state.get("pull_count", 0)
        total = state.get("total_pulls", 0)
        guaranteed = state.get("guaranteed_legendary", False)
        soft_pity_active = count >= self.GACHA_SOFT_PITY_START
        return {
            "pull_count": count,
            "total_pulls": total,
            "hard_pity": self.GACHA_HARD_PITY,
            "soft_pity_start": self.GACHA_SOFT_PITY_START,
            "soft_pity_active": soft_pity_active,
            "guaranteed": guaranteed,
            "pulls_to_hard": max(0, self.GACHA_HARD_PITY - count),
        }
account_system = AccountSystem()
_ck("MD_CHECKPOINT: 29 account_system created — game_init.py finished!")
def save_session_user(username):
    if IS_WEB_BUILD:
        return
    try:
        if not username:
            if os.path.exists(SESSION_FILE):
                os.remove(SESSION_FILE)
            return
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump({"last_user": username}, f, ensure_ascii=False, indent=2)
    except (OSError, IOError) as e:
        logger.error(f"Không thể lưu session cho '{username}': {e}")
def load_session_user():
    if IS_WEB_BUILD:
        return None
    try:
        if not os.path.exists(SESSION_FILE):
            return None
        with open(SESSION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        u = data.get("last_user")
        return u if isinstance(u, str) and u.strip() else None
    except (OSError, IOError, json.JSONDecodeError, AttributeError) as e:
        logger.warning(f"Không đọc được session file, coi như chưa đăng nhập: {e}")
        return None
def can_play_daily():
    d = account_system.data()
    today = time.strftime("%Y-%m-%d")
    if "daily" not in d: d["daily"] = {"date": "", "played": False}
    if d["daily"]["date"] != today:
        d["daily"].update({"date":today, "played":False})
        account_system.save()
    return not d["daily"]["played"]
def finish_daily():
    account_system.data()["daily"]["played"] = True; add_xp(150); account_system.save()