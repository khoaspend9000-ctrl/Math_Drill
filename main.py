# =========================================================
# game_main.py – PHẦN 2: Game States & Game Loop
# =========================================================
# Chứa:
#   • Tất cả GameState classes (Login → Gacha → Exam…)
#   • StateManager + admin_panel.inject()
#   • Main game loop (while running)
#
# Chạy game: python game_main.py
# =========================================================
# pylint: disable=line-too-long
# Ghi chú: các truy cập gi.character_img / gi.achievement_popup bên dưới dùng
# tham chiếu module `game_init` (import ở dưới) thay vì tên import trực tiếp,
# để tránh lỗi "stale binding" — cùng lý do effects.py đã làm với confetti_sys
# (xem game_init.confetti_sys = confetti_sys trong effects.py) và game_main.py
# tự làm với virtual_mouse_pos (xem phía dưới, trong vòng lặp chính).
def _ck(msg):
    """Ghi mốc debug ra CẢ print() LẪN console.log() của trình duyệt qua cầu nối
    JS của Pyodide (chắc chắn hiện ở F12 Console, không phụ thuộc terminal ẩn)."""
    print(msg, flush=True)
    try:
        import js
        js.console.log(msg)
    except Exception:
        pass
_ck("MD_CHECKPOINT: 30 main.py started, about to import game_init...")
from game_init import (
    ACHIEVEMENTS_DEF, ADMIN_PASS, ADMIN_USER, AVATAR_DIR, AccountSystem,
    AchievementPopup, AdaptiveDifficulty, BLACK, BLUE_BTN, BOTTOM_BAR_H,
    BUTTON_RADIUS, Button, CARD_EFFECT_MAP, CARD_RADIUS, COLORS, CardButton,
    CloverParticle, ComboPopup, ComboPopupManager, DEFAULT_CHARACTER_IMG,
    DailyRewardPopup, FONT_SIZES, FallingCloverEffect, FeedbackOverlay,
    GLOBAL_BRIGHTNESS, GLOBAL_FULLSCREEN, GLOBAL_VOLUME, GLOBAL_RENDER_QUALITY, GREEN_BTN,
    GachaBannerSystem, GachaSystem, GameState, GlobalCloverManager,
    HSRWarpEffect, ITEM_DEFS, InputBox, ItemEffectSystem, KnowledgeGraph,
    LightEffect, MARGIN, MathParticle, MathParticleSystem, ORANGE_BTN,
    PADDING, PURPLE_BTN, PetSystem, RED_BTN, RealisticBook, SCREEN_DIAGONAL,
    SEGOE_EMOJI_TTF, SESSION_FILE, SHADOW, SkillTreeSystem, SkinSystem,
    TOP_BAR_H, Transition, WHITE, YELLOW_BTN, account_system,
    adaptive_ai, add_gold, add_xp, background_img,
    banner_system, base_path, can_play_daily,
    check_and_unlock_achievement, choose_local_image_file,
    claim_daily_reward, claim_task_rewards, clock, clover_image,
    combo_popup_manager, contains_emoji, daily_task_progress,
    darkness_surface, defeat_bg_img, draw_badge, draw_daily_tasks_panel,
    draw_gradient, draw_multiline_text, draw_multiline_theory,
    draw_progress_bar, draw_text_center, draw_text_shadow, draw_top_bar,
    draw_xp_bar, ensure_daily_tasks, finish_daily, font_big, font_med,
    font_path, font_small, gacha_system, game_manager, generate_explanation,
    derive_skill_tags, SKILL_TAG_TIPS, is_young_learner, tts_is_available, speak_text, IS_WEB_BUILD,
    generate_hard_exam, get_combo_color, get_combo_text, get_font,
    get_layout_rects, get_required_exp, get_scaled_background, icon_img,
    img_vic_text, item_fx, knowledge_graph, load_character_from_path,
    load_font, load_icon_font, load_image, load_session_user, logger,
    pet_system, player, refresh_character_avatar,
    render_cached_text, render_cached_text_enhanced, render_text_fitted,
    render_text_mixed, render_text_with_leading_icon, reward_gold_for_result,
    save_session_user, screen, setting_img, setting_rect, skill_tree_system,
    skin_system, snd_correct, snd_defeat, snd_levelup, snd_victory,
    snd_wrong, sound_manager, sync_player_stats, transition, trigger_shake,
    update_combo, virtual_mouse_pos,
)

# === Explicit imports for Pylance static analysis ===
import sys
import random
import math
import time
import datetime
import webbrowser
import os
import pygame
import asyncio
from performance_utils import ParticleBudget
from data_manager import LessonData, get_lessons_for_grade, theory_data
from game_content_loader import load_daily_rewards
from ui.shop_enhanced import collect_shop_catalog, filter_shop_items

from game_init import (
    WIDTH, HEIGHT, WHITE, BLACK, SHADOW,
    BLUE_BTN, GREEN_BTN, PURPLE_BTN, ORANGE_BTN, YELLOW_BTN, RED_BTN,
    ADMIN_USER, ADMIN_PASS, ACHIEVEMENTS_DEF,
    Button, CardButton, InputBox, RealisticBook,
    FallingCloverEffect, LightEffect, MathParticleSystem, FeedbackOverlay,
    GameState, PlayerData, SmartAI, safe_generate_question,
    load_font, load_icon_font,
    draw_gradient, draw_text_center, draw_multiline_text, draw_multiline_theory,
    draw_progress_bar, draw_badge, draw_top_bar, draw_daily_tasks_panel,
    render_cached_text, render_cached_text_enhanced, render_text_mixed,
    render_text_with_leading_icon, get_scaled_background,
    render_text_fitted,
    get_combo_text, get_combo_color, update_combo,
    background_img, setting_img, defeat_bg_img,
    font_big, font_med, font_small,
    player, screen, clock, sound_manager, adaptive_ai,
    account_system, pet_system, skin_system,
    skill_tree_system, banner_system, ITEM_DEFS,
    darkness_surface,
    snd_correct, snd_wrong, snd_levelup, snd_victory,
    transition, combo_popup_manager, item_fx,
    daily_task_progress,
    add_xp, add_gold, reward_gold_for_result,
    load_session_user, save_session_user,
    refresh_character_avatar, sync_player_stats,
    ensure_daily_tasks, claim_daily_reward, claim_task_rewards,
    choose_local_image_file, load_image,
    get_sound_manager, COLORS,
    HSRWarpEffect, DailyRewardPopup, generate_hard_exam,
    can_play_daily, base_path, SCREEN_DIAGONAL,
)

# Redefine ConfettiParticle and ConfettiSystem here since game_init.py
# uses them at compile time but they're only available after import
from effects import (
    ConfettiParticle, ConfettiSystem, confetti_sys,
    FireworkParticle, Firework, StarParticle, SparkParticle, WrongParticle,
    AnswerEffectSystem, answer_effects, TransitionEffect, transition_effect,
)
import game_init
gi = game_init  # Alias ngắn dùng cho các truy cập gi.character_img / gi.achievement_popup
_ck("MD_CHECKPOINT: 31 game_init + effects imported into main.py OK")
# =========================================================
# MENUS & GAME STATES
# =========================================================
class LoadingState(GameState):
    def __init__(self, next_state_factory=None):
        self.progress = 0.0
        self.tips = [
            "Meo: Hoc moi ngay de tang XP nhanh!",
            "Meo: Combo cao giup diem nhieu hon!",
            "Meo: Dung voi, hay tinh can than!",
            "Meo: Time Attack se tang do kho theo ban.",
        ]
        self.tip = random.choice(self.tips)
        def default_next():
            u = load_session_user()
            if u and u in account_system.accounts:
                user_obj = account_system.accounts.get(u, {})
                if user_obj.get("status") != "locked":
                    # Remember user but still require password: prefill username only.
                    return LoginState(prefill_user=u)
            return LoginState(prefill_user=u if u else "")
        self.next_state_factory = next_state_factory or default_next
        self._done = False
    def enter(self):
        self.progress = 0.0
        self.tip = random.choice(self.tips)
        self._done = False
    def handle_event(self, e):
        if e.type in (pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN):
            self.progress = 1.0
    def update(self, dt):
        if self._done:
            return
        # Fake loading to feel smooth (0.8–1.5s typical)
        self.progress = min(1.0, self.progress + dt * 0.75)
        if self.progress >= 1.0:
            self._done = True
            manager.change(self.next_state_factory(), transition_type="HERTA")
    def draw(self, s):
        # Xóa sạch surface trước khi vẽ
        s.fill((20, 30, 55))
        draw_gradient(s, (20, 30, 55), (70, 120, 190))
        if background_img:
            bg = get_scaled_background(background_img, (WIDTH, HEIGHT), 45)
            s.blit(bg, (0, 0))
        title = load_font(54).render("MATHDRILL", True, WHITE)
        s.blit(title, (WIDTH // 2 - title.get_width() // 2, HEIGHT // 2 - 170))
        # Loading bar
        w = 520
        h = 28
        x = WIDTH // 2 - w // 2
        y = HEIGHT // 2 - 20
        pygame.draw.rect(s, (40, 40, 60), (x, y, w, h), border_radius=14)
        fill = int(w * max(0.0, min(1.0, self.progress)))
        if fill > 0:
            pygame.draw.rect(s, (100, 200, 255), (x, y, fill, h), border_radius=14)
        pygame.draw.rect(s, (255, 255, 255), (x, y, w, h), 2, border_radius=14)
        pct = load_font(18).render(f"Dang tai... {int(self.progress * 100)}%", True, (230, 230, 245))
        s.blit(pct, (WIDTH // 2 - pct.get_width() // 2, y - 36))
        tip = load_font(18).render(self.tip, True, (230, 230, 245))
        s.blit(tip, (WIDTH // 2 - tip.get_width() // 2, y + 60))
class LoginState(GameState):
    def __init__(self, prefill_user=""):
        center_x = WIDTH // 2
        self.user_input = (prefill_user or "").strip()
        self.pass_input = ""
        self.active_field = "pass" if self.user_input else "user"
        self.user_rect = pygame.Rect(center_x - 200, 410, 400, 50)
        self.pass_rect = pygame.Rect(center_x - 200, 490, 400, 50)
        self.login_btn = Button(center_x - 200, 580, 400, 60, "🔑 Đăng Nhập", (165, 214, 167))
        self.reg_btn = Button(center_x - 200, 660, 400, 60, "📝 Đăng Ký Mới", (158, 198, 229))
        self.clover_effect = FallingCloverEffect(30)
        self.error_msg = ""; self.error_timer = 0.0
        self.idle_timer = 0  # Timer for idle detection (15s timeout)
    def handle_event(self, e):
        self.idle_timer = 0  # Reset idle timer on any interaction
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.user_rect.collidepoint(e.pos): self.active_field = "user"
            elif self.pass_rect.collidepoint(e.pos): self.active_field = "pass"
            if self.login_btn.clicked(e.pos): self.login_action()
            if self.reg_btn.clicked(e.pos): manager.change(RegisterState())
        if e.type == pygame.KEYDOWN:
            if e.key == pygame.K_BACKSPACE:
                if self.active_field == "user": self.user_input = self.user_input[:-1]
                else: self.pass_input = self.pass_input[:-1]
            elif e.key == pygame.K_TAB:
                self.active_field = "pass" if self.active_field == "user" else "user"
            elif e.key == pygame.K_RETURN: self.login_action()
            elif e.unicode.isprintable() and len(self.user_input if self.active_field == "user" else self.pass_input) < 20:
                if self.active_field == "user": self.user_input += e.unicode
                else: self.pass_input += e.unicode
    def login_action(self):
        username = self.user_input.strip(); password = self.pass_input.strip()
        if not username or not password:
            self.error_msg = "Vui lòng nhập đầy đủ thông tin!"; self.error_timer = 3.0
            return
        # Đăng nhập admin cũng đi qua account_system.login() như tài khoản thường
        # (mật khẩu được so sánh dưới dạng đã băm, không còn so sánh văn bản thuần ở đây).
        success, msg = account_system.login(username, password)
        if success:
            save_session_user(username)
            refresh_character_avatar()
            sync_player_stats() # Đồng bộ stats ngay sau khi login
            manager.change(MenuState(), transition_type="PAGE")
        else: self.error_msg = msg; self.error_timer = 3.0
    def update(self, dt):
        self.clover_effect.update(dt)
        if self.error_timer > 0: self.error_timer -= dt
        self.idle_timer += dt
        if self.idle_timer >= 15.0:
            manager.change(IdleGifState())
    def draw(self, s):
        if background_img: s.blit(background_img, (0, 0))
        else: s.fill((255, 255, 255))
        self.clover_effect.draw(s)
        title_surf = font_big.render("MATHDRILL LOGIN", True, (120, 144, 156))
        s.blit(title_surf, (WIDTH//2 - title_surf.get_width()//2, 250))
        u_color = (220, 220, 220)
        pygame.draw.rect(s, u_color, self.user_rect, border_radius=10)
        if self.active_field == "user": pygame.draw.rect(s, (150, 150, 150), self.user_rect, 2, border_radius=10)
        if not self.user_input: s.blit(font_med.render("Tên đăng nhập", True, (170, 170, 170)), (self.user_rect.x + 15, self.user_rect.y + 10))
        else: s.blit(font_med.render(self.user_input, True, (80, 80, 80)), (self.user_rect.x + 15, self.user_rect.y + 10))
        pygame.draw.rect(s, u_color, self.pass_rect, border_radius=10)
        if self.active_field == "pass": pygame.draw.rect(s, (150, 150, 150), self.pass_rect, 2, border_radius=10)
        if not self.pass_input: s.blit(font_med.render("Password", True, (170, 170, 170)), (self.pass_rect.x + 15, self.pass_rect.y + 10))
        else: s.blit(font_med.render("*" * len(self.pass_input), True, (80, 80, 80)), (self.pass_rect.x + 15, self.pass_rect.y + 10))
        self.login_btn.draw(s); self.reg_btn.draw(s)
        if self.error_msg and self.error_timer > 0:
            txt = pygame.font.SysFont("segoe ui", 22, italic=True).render(self.error_msg, True, (200, 0, 0))
            s.blit(txt, txt.get_rect(center=(WIDTH//2, 750)))
class IdleGifState(GameState):
    # Giới hạn số frame tối đa được nạp vào RAM. Mỗi frame là một surface RGBA đầy
    # màn hình (WIDTH x HEIGHT, ~4MB ở độ phân giải 1300x800) — nạp "không giới hạn"
    # như trước có thể tốn hàng trăm MB đến vài GB RAM nếu GIF có nhiều frame, rủi ro
    # thật trên máy phòng lab cấu hình vừa phải (~12GB RAM). 45 frame (~1.5 giây ở
    # 30fps, lặp lại mượt mà) chỉ tốn ~180MB — đủ mượt cho hoạt ảnh chờ (idle) mà vẫn
    # giữ bộ nhớ ở mức an toàn, có thể đoán trước.
    MAX_GIF_FRAMES = 45
    def __init__(self):
        self.frames = []
        self.current_frame = 0
        self.frame_timer = 0
        self.frame_duration = 0.033  # 30 FPS for smoother animation
        self.loaded = False
        self.loading = False
    def enter(self):
        if not self.loaded and not self.loading:
            self.loading = True
            if IS_WEB_BUILD:
                # Trình duyệt KHÔNG hỗ trợ tạo thread Python thật (threading.Thread
                # chạy trong Pyodide/WASM có thể không bao giờ thực thi phần thân,
                # hoặc gây lỗi) — tải trực tiếp (đồng bộ) thay vì dùng thread.
                # An toàn vì đây chỉ chạy một lần và GIF đã giới hạn 45 frame.
                self.load_gif()
            else:
                try:
                    import threading as _threading
                except ImportError:
                    _threading = None
                if _threading:
                    self.load_thread = _threading.Thread(target=self.load_gif)
                    self.load_thread.daemon = True
                    self.load_thread.start()
                else:
                    self.load_gif()
    def load_gif(self):
        try:
            from PIL import Image
            img = Image.open(os.path.join(base_path, "gt2.gif"))
            # Load all frames without limit
            try:
                from PIL import ImageSequence
                # Đếm tổng số frame trước để quyết định có cần lấy mẫu (subsample) hay không.
                total_frames = getattr(img, "n_frames", None)
                if total_frames is None:
                    total_frames = sum(1 for _ in ImageSequence.Iterator(img))
                    img.seek(0)
                if total_frames > self.MAX_GIF_FRAMES:
                    # Lấy mẫu ĐỀU trên toàn bộ vòng lặp (thay vì cắt cụt ở cuối) để
                    # animation vẫn mượt và trọn vẹn cảm giác chuyển động, chỉ giảm
                    # độ phân giải thời gian — giữ bộ nhớ trong giới hạn an toàn.
                    step = total_frames / self.MAX_GIF_FRAMES
                    keep_indices = {int(i * step) for i in range(self.MAX_GIF_FRAMES)}
                else:
                    keep_indices = set(range(total_frames))
                frame_count = 0
                for idx, frame in enumerate(ImageSequence.Iterator(img)):
                    if idx not in keep_indices:
                        continue
                    frame = frame.convert("RGBA")
                    frame = frame.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
                    frame_surface = pygame.image.frombuffer(frame.tobytes(), frame.size, frame.mode)  # type: ignore[arg-type]
                    self.frames.append(frame_surface)
                    frame_count += 1
                print(f"Loaded {frame_count}/{total_frames} frames from GIF (giới hạn {self.MAX_GIF_FRAMES} frame để tiết kiệm RAM)")
            except (OSError, IOError, ValueError) as gif_err:
                print(f"Lỗi đọc frame GIF, dùng frame đầu tiên: {gif_err}")
                # Fallback: load first frame only
                img.seek(0)
                frame = img.convert("RGBA")
                frame = frame.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
                frame_surface = pygame.image.frombuffer(frame.tobytes(), frame.size, frame.mode)  # type: ignore[arg-type]
                self.frames.append(frame_surface)
                print("Loaded first frame only (fallback)")
            if not self.frames:
                raise Exception("No frames loaded")
            self.loaded = True
            self.loading = False
        except ImportError as e:
            print(f"PIL not installed: {e}")
            self.frames.append(pygame.Surface((WIDTH, HEIGHT)))
            self.loaded = True
            self.loading = False
        except FileNotFoundError:
            print("File gt2.gif not found")
            self.frames.append(pygame.Surface((WIDTH, HEIGHT)))
            self.loaded = True
            self.loading = False
        except Exception as e:
            print(f"Error loading gt2.gif: {e}")
            import traceback
            traceback.print_exc()
            self.frames.append(pygame.Surface((WIDTH, HEIGHT)))
            self.loaded = True
            self.loading = False
    def handle_event(self, e):
        if e.type in (pygame.MOUSEBUTTONDOWN, pygame.KEYDOWN):
            manager.change(LoginState())
    def update(self, dt):
        if self.frames:
            self.frame_timer += dt
            if self.frame_timer >= self.frame_duration:
                self.frame_timer = 0
                self.current_frame = (self.current_frame + 1) % len(self.frames)
    def draw(self, s):
        if self.frames and self.loaded:
            s.blit(self.frames[self.current_frame], (0, 0))
        else:
            s.fill((30, 40, 60))
            # Show loading indicator
            loading = font_med.render("Đang tải GIF...", True, WHITE)
            s.blit(loading, (WIDTH // 2 - loading.get_width() // 2, HEIGHT // 2))
        hint = font_med.render("Click để quay lại đăng nhập", True, WHITE)
        s.blit(hint, (WIDTH // 2 - hint.get_width() // 2, HEIGHT - 100))
class RegisterState(GameState):
    def __init__(self):
        self.clover_effect = FallingCloverEffect(25)
    def enter(self):
        self.u = InputBox(450,280,400,50,"Tên đăng nhập")
        self.p = InputBox(450,350,400,50,"Mật khẩu",True)
        self.char_small = pygame.transform.smoothscale(gi.character_img, (400, 400)) if gi.character_img else None
        self.selected_grade = 1
        self.grade_buttons = []
        for i in range(1, 6):
            btn = Button(450 + (i-1)*90, 420, 80, 50, f"🏫 Lớp {i}", PURPLE_BTN if i == 1 else ORANGE_BTN)
            self.grade_buttons.append((btn, i))
        self.c_btn = Button(450,500,400,70,"✅ TẠO TÀI KHOẢN",GREEN_BTN)
        self.b_btn = Button(450,590,400,70,"⬅️ QUAY LẠI",RED_BTN)
        self.msg = ""
    def handle_event(self,e):
        self.u.handle_event(e); self.p.handle_event(e)
        if e.type == pygame.MOUSEBUTTONDOWN:
            for btn, grade in self.grade_buttons:
                if btn.clicked(e.pos):
                    self.selected_grade = grade
                    # Update button colors
                    for b, g in self.grade_buttons:
                        b.color = PURPLE_BTN if g == grade else ORANGE_BTN
            if self.c_btn.clicked(e.pos):
                ok, self.msg = account_system.register(self.u.text, self.p.text, self.selected_grade)
                if ok: manager.change(LoginState())
            if self.b_btn.clicked(e.pos): manager.change(LoginState())
    def update(self, dt):
        self.clover_effect.update(dt)
    def draw(self,s):
        s.blit(background_img,(0,0)) if background_img else s.fill((30,40,60))
        self.clover_effect.draw(s)
        if self.char_small:
            # Use pre-scaled sprite to avoid per-frame scaling.
            s.blit(self.char_small,(50, 250))
        s.blit(font_big.render("Đăng Ký",True,WHITE), (450,200))
        self.u.draw(s); self.p.draw(s)
        # Draw grade selection label
        s.blit(font_med.render("Chọn lớp:", True, WHITE), (450, 390))
        # Draw grade buttons
        for btn, grade in self.grade_buttons:
            btn.draw(s)
        self.c_btn.draw(s); self.b_btn.draw(s)
        # Display message with a bit more style
        if self.msg:
            msg_color = GREEN_BTN if "thành công" in self.msg else RED_BTN
            draw_text_center(s, self.msg, font_small, msg_color, WIDTH // 2 + 50, 680)
class MenuState(GameState):
    def __init__(self):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.math_particles = MathParticleSystem(35) # Increased count
        self.light_effect = LightEffect() # Added light effect
        self.fade_in = 0.0  # Fade-in animation timer
        self.daily_popup = None
        self.char_idle_time = 0 # For idle animation
        self.clover_effect = FallingCloverEffect(20)
        # Chuyển nhạc nền menu
        sound_manager.set_bgm("menu")
        # === CARD BUTTONS (thay vì flat buttons) ===
        # Row 1: Main game modes (2 cards)
        card_y1 = 155
        card_w, card_h = 240, 90 # Slightly larger
        card_gap = 25 # Increased gap
        card_x_start = 680 # Shifted slightly left for right page
        self.cards = [
            CardButton(card_x_start, card_y1, card_w, card_h,
                       "🎓", "Bài Học", "Luyện tập theo chương", BLUE_BTN, (100, 200, 255)),
            CardButton(card_x_start + card_w + card_gap, card_y1, card_w, card_h,
                       "⏱️", "Time Attack", "Chơi nhanh ghi điểm", ORANGE_BTN, (255, 180, 80)),
        ]
        # Row 2
        card_y2 = card_y1 + card_h + 20 # Increased vertical gap
        self.cards += [
            CardButton(card_x_start, card_y2, card_w, card_h,
                       "🔥", "Thử Thách", "Bài tập hằng ngày", YELLOW_BTN, (255, 230, 80)),
            CardButton(card_x_start + card_w + card_gap, card_y2, card_w, card_h,
                       "📝", "Thi Chuyển Lớp", "Kiểm tra tổng hợp", (180, 130, 200), (200, 150, 255)),
        ]
        # Row 3: Secondary (Dynamic positioning to avoid overlap)
        card_y3 = card_y2 + card_h + 20
        card_w2 = 140 # Smaller base width
        row3_gap = 15
        # Create buttons for row 3
        btn_ach = CardButton(card_x_start, card_y3, card_w2, 65,
                            "🏆", "Thành Tích", "", GREEN_BTN, (100, 255, 150))
        btn_profile = CardButton(btn_ach.rect.right + row3_gap, card_y3, card_w2, 65,
                                "👤", "Hồ Sơ", "", PURPLE_BTN, (200, 150, 255))
        btn_settings = CardButton(btn_profile.rect.right + row3_gap, card_y3, card_w2, 65,
                                 "⚙️", "Cài Đặt", "", SHADOW, (180, 180, 200))
        self.cards += [btn_ach, btn_profile, btn_settings]
        # Row 4: Logout - Adjust positions to fit better
        card_y4 = card_y3 + 65 + 20
        row4_x = card_x_start - 50
        self.logout_btn = CardButton(row4_x, card_y4, 110, 55, "🚪", "Thoát", "", RED_BTN, (255, 100, 100))
        self.shop_btn = CardButton(row4_x + 120, card_y4, 110, 55, "🛒", "Shop", "", GREEN_BTN, (120, 220, 150))
        self.skill_btn = CardButton(row4_x + 240, card_y4, 110, 55, "🌳", "K.Năng", "", PURPLE_BTN, (200, 150, 255))
        self.gacha_normal_btn = CardButton(row4_x + 360, card_y4, 140, 55, "🏪", "Đổi Thẻ", "", (130, 80, 220), (190, 130, 255))
        self.bag_btn = CardButton(row4_x + 510, card_y4, 110, 55, "🎒", "Túi Đồ", "", (80, 140, 200), (120, 190, 255))
        self.admin_btn = Button(1080, 20, 120, 40, "🔑 ADMIN", SHADOW)
        # Username button in top right
        self.user_btn = Button(WIDTH - 250, 20, 230, 45, "", (200, 220, 240))
        # Achievement preview data
        self._ach_preview = []
        self.exam_msg = ""
        self.exam_msg_timer = 0.0
    def enter(self):
        sync_player_stats() # Đảm bảo stats luôn đúng khi vào Menu
        ensure_daily_tasks()
        reward_info = claim_daily_reward()
        self.daily_popup = DailyRewardPopup(reward_info) if reward_info else None
    def _get_achievement_preview(self):
        """Lay 3 achievement gan nhat de hien thi"""
        d = account_system.data()
        unlocked = d.get("achievements", [])
        preview = []
        for key, ach in ACHIEVEMENTS_DEF.items():
            is_done = key in unlocked
            preview.append((ach["icon"], ach["name"], is_done))
        # Sort: incomplete first, then complete
        preview.sort(key=lambda x: (x[2], x[1]))
        return preview[:3]
    def update(self, dt):
        self.book.update(dt)
        self.math_particles.update(dt)
        self.light_effect.update(dt)
        self.char_idle_time += dt
        self.fade_in = min(1.0, self.fade_in + dt * 2.5)
        self.clover_effect.update(dt)
        for card in self.cards:
            card.update(dt)
        self.logout_btn.update(dt)
        self.shop_btn.update(dt)
        self.skill_btn.update(dt)
        self.gacha_normal_btn.update(dt)
        self.bag_btn.update(dt)
        if self.daily_popup and self.daily_popup.active:
            self.daily_popup.update(dt)
        claim_task_rewards()
        if self.exam_msg_timer > 0:
            self.exam_msg_timer = max(0.0, self.exam_msg_timer - dt)
    def draw_left(self, s, rect):
        # === DASHBOARD LEFT PAGE ===
        # Greeting + username (Shifted up slightly)
        user_name = account_system.current_user.upper() if account_system.current_user else "BẠN"
        hour = datetime.datetime.now().hour
        if hour < 12: greeting = "Chào buổi sáng,"
        elif hour < 18: greeting = "Chào buổi chiều,"
        else: greeting = "Chào buổi tối,"
        greeting_surf = font_med.render(greeting, True, (80, 80, 80))
        s.blit(greeting_surf, (rect.x + 40, rect.y + 35))
        name_surf = font_big.render(user_name, True, (40, 40, 40))
        s.blit(name_surf, (rect.x + 40, rect.y + 70))
        # === XP BAR + LEVEL (Dashboard style) ===
        d = account_system.data()
        level = player.level
        xp = player.exp
        xp_need = player.exp_to_next_level
        grade = d.get("grade", 1)
        grade_labels = {1: "Lớp 1", 2: "Lớp 2", 3: "Lớp 3", 4: "Lớp 4", 5: "Lớp 5"}
        # Level & Grade badges with auto-size
        badge_y = rect.y + 130
        w1 = draw_badge(s, rect.x + 40, badge_y, f"Level {level}", (230, 245, 230), (45, 120, 45))
        w2 = draw_badge(s, rect.x + 40 + w1 + 15, badge_y, grade_labels.get(grade, f"Lớp {grade}"), (230, 235, 250), (45, 80, 160))
        # XP progress bar (Wider for long numbers)
        draw_progress_bar(s, rect.x + 40, badge_y + 45, rect.width - 80, 22, xp, xp_need, "EXP")
        gold_display = "Vàng: Vô hạn (Admin)" if account_system.current_user == ADMIN_USER else f"Vàng: {d.get('gold', 0)}"
        draw_badge(s, rect.x + 40, badge_y + 78, gold_display, (255, 247, 215), (180, 140, 30), font_size=15)
# === DIFFICULTY + STREAK BADGES ===
        badge_y2 = badge_y + 85
        diff_label = adaptive_ai.get_difficulty_label()
        diff_color = adaptive_ai.get_difficulty_color()
        # Difficulty badge
        diff_badge_font = load_font(14)
        diff_surf = diff_badge_font.render(f"Độ khó: {diff_label}", True, diff_color)
        dbg_w = diff_surf.get_width() + 16
        pygame.draw.rect(s, (*diff_color, 40), (rect.x + 40, badge_y2, dbg_w, 28), border_radius=8)
        pygame.draw.rect(s, (*diff_color, 120), (rect.x + 40, badge_y2, dbg_w, 28), 1, border_radius=8)
        s.blit(diff_surf, (rect.x + 48, badge_y2 + 6))
        # Streak badge
        if adaptive_ai.correct_streak >= 2:
            streak_text = f"Chuỗi: {adaptive_ai.correct_streak}!"
            streak_surf = diff_badge_font.render(streak_text, True, (255, 150, 50))
            sbg_w = streak_surf.get_width() + 16
            pygame.draw.rect(s, (255, 150, 50, 40), (rect.x + 40 + dbg_w + 10, badge_y2, sbg_w, 28), border_radius=8)
            pygame.draw.rect(s, (255, 150, 50, 120), (rect.x + 40 + dbg_w + 10, badge_y2, sbg_w, 28), 1, border_radius=8)
            s.blit(streak_surf, (rect.x + 48 + dbg_w + 10, badge_y2 + 6))
        # === PET + ACHIEVEMENT PREVIEW (2-column layout to avoid overlap) ===
        info_top = badge_y2 + 45
        left_col_x = rect.x + 40
        right_col_x = rect.x + rect.width // 2 + 10
        col_w = rect.width // 2 - 55
        # Pet block (left column)
        pet = account_system.get_pet()
        pet_info = pet_system.get_pet_info(pet["type"], pet["stage"])
        if pet_info:
            pet_y = info_top + 8
            pet_icon_font = load_icon_font(42)
            pet_icon = render_cached_text_enhanced(pet_icon_font, pet_info["icon"], (50, 50, 50))
            s.blit(pet_icon, (left_col_x, pet_y))
            pet_name_font = load_font(18)
            pet_name_text = pet_info["name"]
            while pet_name_text and pet_name_font.size(pet_name_text)[0] > col_w - 56:
                pet_name_text = pet_name_text[:-1]
            if pet_name_text != pet_info["name"]:
                pet_name_text = pet_name_text.rstrip() + "..."
            pet_name = pet_name_font.render(pet_name_text, True, (80, 80, 80))
            s.blit(pet_name, (left_col_x + 54, pet_y + 6))
            # Evolution progress bar (only in left column width)
            d = account_system.data()
            current_xp = d.get("xp", 0)
            evolution_progress = pet_system.get_evolution_progress(pet["type"], pet["stage"], current_xp)
            bar_w = max(120, col_w)
            if evolution_progress < 100:
                draw_progress_bar(s, left_col_x, pet_y + 38, bar_w, 16, evolution_progress, 100, "Tiến hóa")
            else:
                evolve_text = pet_name_font.render("Có thể tiến hóa!", True, (50, 150, 50))
                s.blit(evolve_text, (left_col_x, pet_y + 36))
        # Achievement block (right column)
        ach_title_font = load_font(14)
        s.blit(ach_title_font.render("Thành tích gần đây:", True, (100, 100, 100)), (right_col_x, info_top))
        ach_y = info_top + 22
        preview = self._get_achievement_preview()
        ach_item_font = load_font(13)
        ach_icon_font = load_icon_font(14)
        for icon, name, is_done in preview:
            status_color = (100, 200, 100) if is_done else (160, 160, 160)
            status_mark = "✓" if is_done else "..."
            line = f"{icon} {name} [{status_mark}]"
            while line and ach_item_font.size(line)[0] > col_w:
                line = line[:-1]
            if line != f"{icon} {name} [{status_mark}]":
                line = line.rstrip(". ") + "..."
            line_surf = render_text_with_leading_icon(
                line,
                text_font=ach_item_font,
                icon_font=ach_icon_font,
                color=status_color,
                gap=4,
            )
            s.blit(line_surf, (right_col_x, ach_y))
            ach_y += 20
        # Avatar area + character with idle animation (Repositioned to not overlap tasks)
        if gi.character_img:
            idle_off_y = math.sin(self.char_idle_time * 2.0) * 8
            idle_scale = 1.0 + math.sin(self.char_idle_time * 1.5) * 0.02
            char_w = int(210 * idle_scale) # Smaller character
            char_h = int(210 * idle_scale)
            char_draw = pygame.transform.smoothscale(gi.character_img, (char_w, char_h))
            # Positioned just above the tasks panel to minimize overlap
            char_rect = char_draw.get_rect(midbottom=(rect.centerx, rect.bottom - 220 + int(idle_off_y)))
            s.blit(char_draw, char_rect)
        # Daily tasks panel
        draw_daily_tasks_panel(s, rect.x + 24, rect.bottom - 215, rect.width - 48)
    def draw_right(self, s, rect):
        # === DASHBOARD RIGHT PAGE - Card buttons ===
        # Section title
        section_font = load_font(18)
        s.blit(section_font.render("Chọn chế độ chơi:", True, (80, 80, 80)), (rect.x + 50, 130))
        for card in self.cards:
            card.draw(s)
        self.logout_btn.draw(s)
        self.shop_btn.draw(s)
        self.skill_btn.draw(s)
        self.gacha_normal_btn.draw(s)
        self.bag_btn.draw(s)
        if is_young_learner(account_system.data().get("grade", 1)):
            # Tối ưu tải nhận thức cho lớp 1-2: phủ mờ + khoá các tính năng nâng
            # cao (Cây Kỹ Năng, Đổi Thẻ) để tránh gây xao nhãng, chỉ mở khóa dần
            # khi lên lớp 3 trở lên.
            for locked_btn in (self.skill_btn, self.gacha_normal_btn):
                overlay = pygame.Surface((locked_btn.rect.w, locked_btn.rect.h), pygame.SRCALPHA)
                overlay.fill((20, 20, 30, 150))
                s.blit(overlay, locked_btn.rect.topleft)
                lock_icon = render_cached_text(load_icon_font(22), "🔒", (255, 255, 255))
                s.blit(lock_icon, (locked_btn.rect.centerx - lock_icon.get_width() // 2,
                                    locked_btn.rect.centery - lock_icon.get_height() // 2))
        if account_system.current_user == ADMIN_USER:
            self.admin_btn.draw(s)
        # Username button in top right - enhanced icon rendering
        user_name = account_system.current_user.upper() if account_system.current_user else "BẠN"
        # Draw button background
        pygame.draw.rect(s, (200, 220, 240), self.user_btn.rect, border_radius=8)
        pygame.draw.rect(s, WHITE, self.user_btn.rect, 2, border_radius=8)
        # Render icon and text separately
        icon_font = load_icon_font(20)
        text_font = load_font(18)
        icon_surf = render_cached_text_enhanced(icon_font, "👤", BLACK)
        text_surf = text_font.render(user_name, True, BLACK)
        # Position icon and text
        icon_x = self.user_btn.rect.x + 8
        text_x = icon_x + icon_surf.get_width() + 5
        icon_y = self.user_btn.rect.centery - icon_surf.get_height() // 2
        text_y = self.user_btn.rect.centery - text_surf.get_height() // 2
        s.blit(icon_surf, (icon_x, icon_y))
        s.blit(text_surf, (text_x, text_y))
    def handle_event(self, e):
        if self.daily_popup and self.daily_popup.active:
            if e.type == pygame.MOUSEBUTTONDOWN:
                self.daily_popup.dismiss()
            return
        if e.type == pygame.MOUSEBUTTONDOWN and not self.book.is_flipping:
            def trigger_transition(next_state_obj):
                # Sử dụng hiệu ứng lật trang sách
                manager.change(next_state_obj, transition_type="PAGE")
            # Card 0: Bài Học
            if self.cards[0].clicked(e.pos):
                trigger_transition(LessonSelectState())
            # Card 1: Time Attack
            elif self.cards[1].clicked(e.pos):
                trigger_transition(TimeAttackState())
            # Card 2: Thử Thách Hàng Ngày
            elif self.cards[2].clicked(e.pos):
                if can_play_daily():
                    trigger_transition(DailyState())
                else: pass  # Đã làm rồi
            # Card 3: Thi Chuyển Lớp (Final Exam)
            elif self.cards[3].clicked(e.pos):
                # Kiểm tra xem đã mở khóa tất cả bài học chưa (dựa trên level)
                d = account_system.data()
                grade = d.get("grade", 1)
                all_lessons = get_lessons_for_grade(grade)
                user_level = d.get("level", 1)
                # Tính số bài học đã mở khóa dựa trên level: mỗi bài học cần 6 level
                max_unlocked_lesson = (user_level - 1) // 6 + 1
                if max_unlocked_lesson >= len(all_lessons):
                    # Đã mở khóa tất cả bài học, cho phép thi
                    manager.change(ExamTransitionState(), transition_type="PAGE")
                else:
                    # Chưa mở khóa hết, hiển thị thông báo
                    remaining = len(all_lessons) - max_unlocked_lesson
                    self.exam_msg = f"Cần mở khóa thêm {remaining} bài học để thi chuyển lớp!"
                    self.exam_msg_timer = 3.0
            # Card 4: Thành Tích
            elif self.cards[4].clicked(e.pos): trigger_transition(AchievementViewState())
            # Card 5: Hồ Sơ
            elif self.cards[5].clicked(e.pos): trigger_transition(ProfileState())
            # Card 6: Cài Đặt
            elif self.cards[6].clicked(e.pos): trigger_transition(SettingsState())
            # Logout
            elif self.logout_btn.clicked(e.pos):
                account_system.current_user = None
                refresh_character_avatar()
                gi.achievement_popup = None  # Tránh rò rỉ thông báo của học sinh trước sang phiên sau
                trigger_transition(LoginState(prefill_user=load_session_user() or ""))
            elif self.shop_btn.clicked(e.pos):
                trigger_transition(ShopState())
            elif self.skill_btn.clicked(e.pos):
                if is_young_learner(account_system.data().get("grade", 1)):
                    self.exam_msg = "Tính năng này sẽ mở khóa khi con lên lớp 3 nhé! 🌱"
                    self.exam_msg_timer = 2.5
                else:
                    trigger_transition(SkillTreeState())
            elif self.gacha_normal_btn.clicked(e.pos):
                if is_young_learner(account_system.data().get("grade", 1)):
                    self.exam_msg = "Tính năng này sẽ mở khóa khi con lên lớp 3 nhé! 🌱"
                    self.exam_msg_timer = 2.5
                else:
                    trigger_transition(CardShopState())
            elif self.bag_btn.clicked(e.pos):
                trigger_transition(BagState())
            elif self.user_btn.clicked(e.pos):
                trigger_transition(ProfileState())
            # Admin
            if account_system.current_user == ADMIN_USER and self.admin_btn.clicked(e.pos):
                trigger_transition(AdminPanelState())
    def draw(self, s):
        # Xóa sạch surface trước khi vẽ
        s.fill((25, 35, 65))
        # === DYNAMIC BACKGROUND (gradient depth) ===
        draw_gradient(s, (25, 35, 65), (95, 155, 220))
        if background_img:
            bg = get_scaled_background(background_img, (WIDTH, HEIGHT), 60)
            s.blit(bg, (0, 0))
        # Math particles on background
        self.math_particles.draw(s)
        # Clover effect
        self.clover_effect.draw(s)
        # Book on top
        self.book.draw(s, self.draw_left, self.draw_right)
        if self.daily_popup and self.daily_popup.active:
            self.daily_popup.draw(s)
        # Hiển thị thông báo thi chuyển lớp
        if self.exam_msg_timer > 0 and self.exam_msg:
            draw_text_center(s, self.exam_msg, load_font(20), (200, 80, 80), WIDTH // 2, 725)
class SettingsState(GameState):
    def __init__(self):
        super().__init__()
        self.book = RealisticBook(50, 50, 1200, 700)
        self.clover_effect = FallingCloverEffect(15)
        center_right_x = 960 - 150
        self.buttons = {
            "brightness": Button(center_right_x, 150, 300, 60, "", BLUE_BTN),
            "volume": Button(center_right_x, 250, 300, 60, "", GREEN_BTN),
            "fullscreen": Button(center_right_x, 350, 300, 60, "", PURPLE_BTN),
            "quality": Button(center_right_x, 450, 300, 60, "", (90, 170, 160)),
            "password": Button(center_right_x, 550, 300, 60, "🔑 Đổi mật khẩu", ORANGE_BTN),
            "avatar": Button(center_right_x, 650, 300, 60, "🖼️ Đổi avatar", YELLOW_BTN),
            "back": Button(center_right_x, 730, 300, 50, "⬅️ Quay lại menu", RED_BTN),
        }
        # Nút đổi lớp - CHỈ dành riêng cho tài khoản admin. Người chơi thường
        # chọn lớp một lần duy nhất lúc đăng ký nên không cần nút này.
        if account_system.current_user == ADMIN_USER:
            self.buttons["grade"] = Button(center_right_x, 50, 300, 60, "", (150, 100, 220))
        self.msg = ""
        self.msg_timer = 0.0
        self.update_text()
    def update_text(self):
        self.buttons["brightness"].text = f"☀️ Độ sáng: {int(GLOBAL_BRIGHTNESS*100)}%"
        self.buttons["volume"].text = f"🔊 Âm lượng: {int(GLOBAL_VOLUME*100)}%"
        self.buttons["fullscreen"].text = f"📺 Toàn màn hình: {'BẬT' if GLOBAL_FULLSCREEN else 'TẮT'}"
        quality_labels = {"0": "Thấp (máy yếu)", "1": "Vừa (khuyên dùng)", "2": "Cao (máy khỏe)"}
        self.buttons["quality"].text = f"🖥️ Đồ họa: {quality_labels.get(GLOBAL_RENDER_QUALITY, 'Vừa')}"
        if "grade" in self.buttons:
            current_grade = account_system.data().get("grade", 1)
            self.buttons["grade"].text = f"🏫 Lớp (Admin): {current_grade}"
        if IS_WEB_BUILD:
            self.buttons["avatar"].text = "🖼️ Đổi avatar (chỉ trên máy tính)"
    def handle_event(self, e):
        global GLOBAL_BRIGHTNESS, GLOBAL_VOLUME, GLOBAL_FULLSCREEN, GLOBAL_RENDER_QUALITY, screen
        if e.type != pygame.MOUSEBUTTONDOWN: return
        pos = e.pos
        if self.buttons["back"].clicked(pos):
            manager.change(MenuState())
        elif "grade" in self.buttons and self.buttons["grade"].clicked(pos):
            # Cho phép admin tự đổi lớp của chính tài khoản mình, xoay vòng 1→2→3→4→5→1
            current_grade = account_system.data().get("grade", 1)
            new_grade = current_grade + 1 if current_grade < 5 else 1
            account_system.change_grade(account_system.current_user, new_grade)
            self.update_text()
        elif self.buttons["brightness"].clicked(pos):
            GLOBAL_BRIGHTNESS = 1.0 if GLOBAL_BRIGHTNESS < 0.3 else GLOBAL_BRIGHTNESS - 0.2
            self.update_text()
        elif self.buttons["volume"].clicked(pos):
            GLOBAL_VOLUME = 1.0 if GLOBAL_VOLUME <= 0.0 else GLOBAL_VOLUME - 0.5
            pygame.mixer.music.set_volume(GLOBAL_VOLUME)
            if snd_correct: snd_correct.set_volume(GLOBAL_VOLUME)
            if snd_wrong: snd_wrong.set_volume(GLOBAL_VOLUME)
            if snd_levelup: snd_levelup.set_volume(GLOBAL_VOLUME)
            self.update_text()
        elif self.buttons["fullscreen"].clicked(pos):
            if IS_WEB_BUILD:
                # Đổi chế độ màn hình (tạo lại SDL display mode) trên web có
                # nguy cơ treo tương tự lỗi RESIZABLE|SCALED đã gặp lúc khởi
                # động — chưa kiểm chứng an toàn nên tạm khoá trên web, dùng
                # nút toàn màn hình CÓ SẴN của chính trình duyệt (F11) thay thế.
                self.msg = "Dùng phím F11 của trình duyệt để bật toàn màn hình nhé!"
                self.msg_timer = 3.0
                return
            GLOBAL_FULLSCREEN = not GLOBAL_FULLSCREEN
            if GLOBAL_FULLSCREEN:
                screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
            else:
                screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
                pygame.display.set_caption("MathDrill")
            self.update_text()
        elif self.buttons["quality"].clicked(pos):
            if IS_WEB_BUILD:
                self.msg = "Chỉnh chất lượng đồ họa chỉ dùng được trên bản cài đặt máy tính."
                self.msg_timer = 3.0
                return
            # Đổi lọc chất lượng render SDL (0=Thấp/nhanh, 1=Vừa, 2=Cao/nặng nhất).
            # Cần TẠO LẠI display để SDL đọc lại hint mới — giống cách toggle
            # fullscreen ở trên đã làm.
            order = ["0", "1", "2"]
            idx = (order.index(GLOBAL_RENDER_QUALITY) + 1) % len(order) if GLOBAL_RENDER_QUALITY in order else 1
            GLOBAL_RENDER_QUALITY = order[idx]
            os.environ['SDL_RENDER_SCALE_QUALITY'] = GLOBAL_RENDER_QUALITY
            if GLOBAL_FULLSCREEN:
                screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN | pygame.SCALED)
            else:
                screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE | pygame.SCALED)
                pygame.display.set_caption("MathDrill")
            self.update_text()
        elif self.buttons["password"].clicked(pos):
            # Chuyển đến trang đổi mật khẩu
            manager.change(PasswordChangeState())
        elif self.buttons["avatar"].clicked(pos):
            if IS_WEB_BUILD:
                # tkinter (hộp thoại chọn file) không chạy được trên trình duyệt.
                self.msg = "Tính năng đổi avatar chỉ dùng được trên bản cài đặt máy tính."
                self.msg_timer = 3.0
                return
            selected = choose_local_image_file()
            if not selected:
                self.msg = "Bạn chưa chọn ảnh."
            else:
                ok, msg = account_system.set_avatar_from_file(selected)
                self.msg = msg if msg else ("Đổi avatar thành công." if ok else "Đổi avatar thất bại.")
            self.msg_timer = 3.0
    def update(self, dt):
        self.book.update(dt)
        self.clover_effect.update(dt)
        if self.msg_timer > 0:
            self.msg_timer = max(0.0, self.msg_timer - dt)
    def draw(self, s):
        s.fill((165, 214, 167))
        self.clover_effect.draw(s)
        self.book.draw(s, lambda s,r: None, lambda s,r: None)
        draw_text_center(s, "CÀI ĐẶT", font_big, BLACK, 340, 200)
        draw_text_center(s, "HỆ THỐNG", font_big, BLACK, 340, 260)
        if setting_img:
            big_setting = pygame.transform.smoothscale(setting_img, (200, 150))
            s.blit(big_setting, (340 - 75, 350))
        for btn in self.buttons.values(): btn.draw(s)
        if self.msg_timer > 0 and self.msg:
            msg_color = (40, 150, 70) if ("thành công" in self.msg.lower()) else (170, 80, 70)
            draw_text_center(s, self.msg, load_font(20), msg_color, WIDTH // 2, 725)
class PasswordChangeState(GameState):
    def __init__(self):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.clover_effect = FallingCloverEffect(15)
        self.current_pass = InputBox(450, 200, 400, 50, "Mật khẩu hiện tại", True)
        self.new_pass = InputBox(450, 280, 400, 50, "Mật khẩu mới", True)
        self.confirm_pass = InputBox(450, 360, 400, 50, "Xác nhận mật khẩu", True)
        self.change_btn = Button(450, 450, 400, 70, "🔑 ĐỔI MẬT KHẨU", GREEN_BTN)
        self.back_btn = Button(450, 540, 400, 70, "⬅️ QUAY LẠI", RED_BTN)
        self.msg = ""
    def handle_event(self, e):
        self.current_pass.handle_event(e)
        self.new_pass.handle_event(e)
        self.confirm_pass.handle_event(e)
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.back_btn.clicked(e.pos):
                manager.change(SettingsState())
            if self.change_btn.clicked(e.pos):
                if not self.current_pass.text or not self.new_pass.text or not self.confirm_pass.text:
                    self.msg = "Vui lòng nhập đầy đủ thông tin!"
                    return
                if self.new_pass.text != self.confirm_pass.text:
                    self.msg = "Mật khẩu xác nhận không khớp!"
                    return
                success, msg = account_system.change_password(account_system.current_user, self.current_pass.text, self.new_pass.text)  # type: ignore[attr-defined]
                if success:
                    self.msg = "Đổi mật khẩu thành công!"
                    self.current_pass.text = ""
                    self.new_pass.text = ""
                    self.confirm_pass.text = ""
                else:
                    self.msg = msg
    def update(self, dt):
        self.book.update(dt)
        self.clover_effect.update(dt)
    def draw(self, s):
        s.fill((165, 214, 167))
        self.clover_effect.draw(s)
        self.book.draw(s, lambda s,r: None, lambda s,r: None)
        s.blit(font_big.render("ĐỔI MẬT KHẨU", True, BLACK), (WIDTH//2 - font_big.size("ĐỔI MẬT KHẨU")[0]//2, 150))
        self.current_pass.draw(s)
        self.new_pass.draw(s)
        self.confirm_pass.draw(s)
        self.change_btn.draw(s)
        self.back_btn.draw(s)
        if self.msg:
            msg_color = GREEN_BTN if "thành công" in self.msg else RED_BTN
            draw_text_center(s, self.msg, font_small, msg_color, WIDTH//2, 630)
class LessonSelectState(GameState):
    def __init__(self, page=0):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.clover_effect = FallingCloverEffect(15)
        self.grade = account_system.data()["grade"]
        self.all_lessons = get_lessons_for_grade(self.grade)
        self.items_per_page = 8
        self.current_page = page
        self.total_pages = max(1, (len(self.all_lessons) - 1) // self.items_per_page + 1)
        self.back_btn = Button(80, 650, 150, 50, "⬅️ QUAY LẠI", RED_BTN)
        self.prev_btn = Button(720, 650, 150, 50, "⬅️ TRƯỚC", BLUE_BTN)
        self.next_btn = Button(1030, 650, 150, 50, "SAU ➡️", BLUE_BTN)
        self.is_completed_all = False
        self.setup_page()
    def setup_page(self):
        self.lesson_btns = []
        start_idx = self.current_page * self.items_per_page
        user_level = account_system.data().get("level", 1)
        # Tính số bài học có thể mở khóa dựa trên level: mỗi bài học cần 6 level
        max_unlocked_lesson = (user_level - 1) // 6 + 1
        # Lấy danh sách bài học cần ôn tập (nứt vỡ)
        lessons_needing_review = account_system.get_lessons_needing_review()
        for i, lesson in enumerate(self.all_lessons[start_idx : start_idx + self.items_per_page]):
            global_idx = start_idx + i
            lesson_num = global_idx + 1  # Bài học bắt đầu từ 1
            is_unlocked = lesson_num <= max_unlocked_lesson
            display_text = (lesson if len(lesson) < 32 else lesson[:29] + "...")
            if not is_unlocked: display_text = "🔒 " + display_text
            elif lesson in lessons_needing_review: display_text = "💔 " + display_text  # Biểu tượng nứt vỡ
            btn = Button(100 if i < 4 else 720, 150 + (i % 4) * 110, 480, 80, display_text, (PURPLE_BTN if i % 2 == 0 else ORANGE_BTN) if is_unlocked else SHADOW)
            btn.original_title = lesson; btn.is_unlocked = is_unlocked  # type: ignore[attr-defined]
            self.lesson_btns.append(btn)
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.back_btn.clicked(e.pos): manager.change(MenuState())
            if self.next_btn.clicked(e.pos) and self.current_page < self.total_pages - 1: manager.change(LessonSelectState(self.current_page + 1))
            if self.prev_btn.clicked(e.pos) and self.current_page > 0: manager.change(LessonSelectState(self.current_page - 1))
            for btn in self.lesson_btns:
                if btn.clicked(e.pos) and btn.is_unlocked: manager.change(TheoryState(btn.original_title))
    def update(self, dt):
        self.book.update(dt)
        self.clover_effect.update(dt)
    def draw_left_page(self, s, rect):
        for i in range(min(4, len(self.lesson_btns))): self.lesson_btns[i].draw(s)
    def draw_right_page(self, s, rect):
        for i in range(4, len(self.lesson_btns)): self.lesson_btns[i].draw(s)
    def draw(self, s):
        s.fill((165, 214, 167))
        self.clover_effect.draw(s)
        self.book.draw(s, self.draw_left_page, self.draw_right_page)
        title = font_big.render(f"KHỐI LỚP {self.grade}", True, BLACK)
        s.blit(title, (WIDTH//2 - title.get_width()//2, 80))
        self.back_btn.draw(s)
        if self.current_page > 0: self.prev_btn.draw(s)
        if self.current_page < self.total_pages - 1: self.next_btn.draw(s)
class TheoryState(GameState):
    def __init__(self, title):
        self.book = RealisticBook(50, 50, 1200, 700); self.title = title
        self.grade = account_system.data().get("grade", 1)
        self.clover_effect = FallingCloverEffect(15)
        try: self.content = theory_data.get(self.grade, {}).get(self.title, "Nội dung đang được cập nhật...")
        except NameError: self.content = "Nội dung đang được cập nhật..."
        self.start_btn = Button(810, 300, 300, 70, "📖 BẮT ĐẦU HỌC", GREEN_BTN)
        self.open_sgk_btn = Button(810, 400, 300, 70, "🌐 Mở SGK", BLUE_BTN)
        self.back_btn = Button(810, 500, 300, 70, "⬅️ QUAY LẠI", RED_BTN)
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN and not self.book.is_flipping:
            if self.start_btn.clicked(e.pos): manager.change(LessonState(self.title))
            if self.back_btn.clicked(e.pos): manager.change(LessonSelectState())
            if self.open_sgk_btn.clicked(e.pos):
                links = {1: "https://hanhtrangso.nxbgd.vn/", 2: "https://hanhtrangso.nxbgd.vn/", 3: "https://hanhtrangso.nxbgd.vn/"}
                (None if IS_WEB_BUILD else webbrowser.open(links.get(self.grade, "https://hanhtrangso.nxbgd.vn/")))
    def update(self, dt):
        self.book.update(dt)
        self.clover_effect.update(dt)
    def draw(self, s):
        s.fill((165, 214, 167))
        self.clover_effect.draw(s)
        self.book.draw(s, lambda s,r: None, lambda s,r: None)
        draw_multiline_text(s, self.title, font_med, BLACK, pygame.Rect(70, 80, 540, 100))
        draw_multiline_theory(s, self.content, font_small, (50, 50, 50), pygame.Rect(80, 180, 520, 480))
        if gi.character_img: s.blit(pygame.transform.smoothscale(gi.character_img, (200, 200)), (860, 80))
        self.start_btn.draw(s); self.open_sgk_btn.draw(s); self.back_btn.draw(s)
class DefeatState(GameState):
    """
    Màn hình "Thử lại" khi chưa đạt yêu cầu (dưới 60% số câu đúng).
    Thiết kế lại theo hướng ĐỘNG VIÊN thay vì trừng phạt — phù hợp học sinh
    lớp 1-5: không dùng gam màu đỏ/tối đáng sợ, không coi đây là "thua cuộc",
    luôn nhắc các em có thể xem lại lỗi và làm lại ngay, không giới hạn số lần.
    """
    def __init__(self, title, correct, total, lesson_title, stats=None):
        self.title = title; self.correct = correct; self.total = total
        self.lesson_title = lesson_title; self.stats = stats or {}
        self.timer = 0; self.show_ui = False
        self.btn_retry = Button(WIDTH//2 - 260, HEIGHT - 120, 250, 60, "🔄 LÀM LẠI", ORANGE_BTN)
        self.btn_home = Button(WIDTH//2 + 10, HEIGHT - 120, 250, 60, "🏠 VỀ MENU", RED_BTN)
        self.btn_review = Button(WIDTH//2 - 125, HEIGHT - 200, 250, 60, "🧐 XEM LỖI", PURPLE_BTN)
        self.bg_scale = 1.0
        self.clover_effect = FallingCloverEffect(15)
        # Chuyển sang nhạc nền trung tính, nhẹ nhàng (không dùng nhạc "defeat" gây áp lực)
        sound_manager.set_bgm("defeat")
    def enter(self):
        # Không phát âm thanh "defeat" nặng nề — chỉ một tiếng nhắc nhẹ nhàng
        pass
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.btn_retry.clicked(e.pos):
                if self.lesson_title == "Thử Thách": manager.change(DailyState())
                else: manager.change(LessonState(self.lesson_title))
            elif self.btn_home.clicked(e.pos):
                manager.change(MenuState())
            elif self.btn_review.clicked(e.pos):
                # Hiển thị màn hình phân tích lỗi
                wrong_answers = self.stats.get("wrong_answers", [])
                def on_review_continue():
                    manager.change(MenuState())
                manager.change(ReviewState(wrong_answers, self.lesson_title, on_review_continue))
    def update(self, dt):
        self.timer += dt
        self.bg_scale += dt * 0.05 # Slow zoom
        self.clover_effect.update(dt)
        if self.timer > 0.5: self.show_ui = True
    def draw(self, s):
        # Xóa sạch surface trước khi vẽ — nền ấm áp, không dùng đỏ/tối đáng sợ
        s.fill((30, 35, 55))
        # Zoomed background
        if defeat_bg_img:
            w, h = int(WIDTH * self.bg_scale), int(HEIGHT * self.bg_scale)
            bg = pygame.transform.smoothscale(defeat_bg_img, (w, h))
            s.blit(bg, bg.get_rect(center=(WIDTH//2, HEIGHT//2)))
        # Overlay nhẹ hơn (không làm tối om màn hình)
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((20, 25, 45, 110))
        s.blit(overlay, (0, 0))
        self.clover_effect.draw(s)
        if self.show_ui:
            # Panel — tông ấm áp, thân thiện thay vì đỏ cảnh báo
            panel_w, panel_h = 600, 400
            panel_x, panel_y = WIDTH//2 - panel_w//2, HEIGHT//2 - 150
            pygame.draw.rect(s, (45, 48, 68, 210), (panel_x, panel_y, panel_w, panel_h), border_radius=30)
            pygame.draw.rect(s, (255, 180, 90), (panel_x, panel_y, panel_w, panel_h), 4, border_radius=30)
            draw_text_center(s, self.title, font_big, (255, 200, 110), WIDTH//2, panel_y + 60)
            acc = int((self.correct/self.total)*100) if self.total > 0 else 0
            draw_text_center(s, f"Đúng: {self.correct}/{self.total} câu ({acc}%)", font_med, WHITE, WIDTH//2, panel_y + 130)
            draw_text_center(s, "Cần đạt 60% để vượt qua — làm lại để tiến bộ hơn nhé!", font_small, (210, 210, 220), WIDTH//2, panel_y + 180)
            # Stats
            if self.stats:
                avg_t = self.stats.get("avg_time", 0)
                stat_font = load_font(22)
                y_stat = panel_y + 230
                stats_lines = [
                    (f"Số câu cần xem lại: {self.total - self.correct}", (255, 195, 150)),
                    (f"Tốc độ trung bình: {avg_t:.1f}s/câu", (180, 200, 255)),
                ]
                for i, (txt, col) in enumerate(stats_lines):
                    draw_text_center(s, txt, stat_font, col, WIDTH//2, y_stat + i * 40)
            self.btn_review.draw(s)
            self.btn_retry.draw(s)
            self.btn_home.draw(s)
class VictoryState(GameState):
    def __init__(self, title, score, lesson_title=None, stats=None):
        self.timer = 0; self.title = title; self.score = score; self.lesson_title = lesson_title; self.show_ui = False
        self.stats = stats or {}
        self.img_vic = load_image("victory_text.png")
        self.vic_scale = 2.0; self.vic_alpha = 0
        self.btn_continue = Button(WIDTH//2 - 125, HEIGHT - 120, 250, 60, "➡️ TIẾP TỤC", GREEN_BTN)
        self.btn_review = Button(WIDTH//2 - 125, HEIGHT - 200, 250, 60, "🧐 XEM LỖI", ORANGE_BTN)
        self.fireworks = []
        self.firework_timer = 0.0
        self.clover_effect = FallingCloverEffect(15)
        # Chuyển nhạc nền victory
        sound_manager.set_bgm("victory")
        sound_manager.play_sfx("victory")
        # XP Animation
        self.xp_earned = stats.get("correct", 0) * 20 if stats else 0
        self.xp_current = 0
        self.xp_anim_done = False
        self.gold_earned = 0
        # Rank logic
        acc = stats.get("accuracy", 0) if stats else 0
        if acc >= 100: self.rank = "S"
        elif acc >= 90: self.rank = "A"
        elif acc >= 80: self.rank = "B"
        else: self.rank = "C"
    def enter(self):
        try:
            if snd_victory: snd_victory.play(0)
        except pygame.error:
            pass
        # Reset combo khi hoàn thành bài học
        player.reset_combo()
        if self.lesson_title and self.lesson_title != "Thử Thách":
            account_system.add_score(self.lesson_title, self.score)
            # Cập nhật tiến độ kỹ năng
            account_system.update_skill_progress(self.lesson_title)
        # Add XP once
        add_xp(self.xp_earned)
        mode_key = "lesson"
        if self.lesson_title == "Time Attack":
            mode_key = "time_attack"
        elif self.lesson_title == "Thử Thách":
            mode_key = "daily"
        # Apply item buff: XP multiplier
        xp_mult = item_fx.get_xp_multiplier()
        if xp_mult > 1.0:
            bonus_xp = int(self.xp_earned * (xp_mult - 1.0))
            add_xp(bonus_xp)
            self.xp_earned += bonus_xp
        raw_gold = reward_gold_for_result(mode_key, self.score, self.stats.get("accuracy", 0))
        # Apply item buff: Gold multiplier
        gold_mult = item_fx.get_gold_multiplier()
        if gold_mult > 1.0:
            bonus_gold = int(raw_gold * (gold_mult - 1.0))
            add_gold(bonus_gold)
            raw_gold += bonus_gold
        self.gold_earned = raw_gold
        # Clear session buffs after session ends
        item_fx.clear_session_buffs()
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.btn_continue.clicked(e.pos):
                manager.change(MenuState())
            elif self.btn_review.clicked(e.pos):
                # Hiển thị màn hình phân tích lỗi
                wrong_answers = self.stats.get("wrong_answers", [])
                def on_review_continue():
                    manager.change(MenuState())
                manager.change(ReviewState(wrong_answers, self.lesson_title, on_review_continue))
    def update(self, dt):
        self.timer += dt
        self.clover_effect.update(dt)
        if self.vic_scale > 1.0: self.vic_scale = max(1.0, self.vic_scale - 4 * dt)
        self.vic_alpha = min(255, self.vic_alpha + 200 * dt)
        # Fireworks logic
        self.firework_timer -= dt
        if self.firework_timer <= 0:
            self.fireworks.append(Firework(random.randint(100, WIDTH-100), random.randint(100, HEIGHT-300)))
            self.firework_timer = random.uniform(0.5, 1.5)
        for fw in self.fireworks[:]:
            fw.update(dt)
            if not fw.particles:
                self.fireworks.remove(fw)
        # XP animation
        if self.timer > 1.0 and not self.xp_anim_done:
            self.xp_current = min(self.xp_earned, self.xp_current + dt * 50)
            if self.xp_current >= self.xp_earned:
                self.xp_current = self.xp_earned
                self.xp_anim_done = True
        if self.timer > 0.5: self.show_ui = True
    def draw(self, s):
        # Xóa sạch surface trước khi vẽ
        s.fill((30, 80, 40))
        # Background gradient
        draw_gradient(s, (30, 80, 40), (80, 180, 100))
        self.clover_effect.draw(s)
        # Fireworks
        for fw in self.fireworks:
            fw.draw(s)
        if self.img_vic:
            w, h = int(self.img_vic.get_width() * self.vic_scale), int(self.img_vic.get_height() * self.vic_scale)
            scaled_vic = pygame.transform.smoothscale(self.img_vic, (w, h))
            scaled_vic.set_alpha(self.vic_alpha)
            s.blit(scaled_vic, scaled_vic.get_rect(center=(WIDTH//2, HEIGHT//2 - 180)))
        if self.show_ui:
            # Main panel
            panel_w, panel_h = 600, 350
            panel_x, panel_y = WIDTH//2 - panel_w//2, HEIGHT//2 - 80
            pygame.draw.rect(s, (255, 255, 255, 230), (panel_x, panel_y, panel_w, panel_h), border_radius=30)
            pygame.draw.rect(s, (200, 170, 80), (panel_x, panel_y, panel_w, panel_h), 5, border_radius=30)
            # Rank Display
            rank_font = load_font(100)
            rank_col = (200, 170, 80) if self.rank == "S" else (200, 200, 200)
            rank_surf = rank_font.render(self.rank, True, rank_col)
            s.blit(rank_surf, (panel_x + panel_w - 120, panel_y + 30))
            draw_text_center(s, self.title, font_med, (40, 40, 40), WIDTH//2, panel_y + 50)
            draw_text_center(s, f"Điểm số: {self.score}", font_med, (60, 60, 60), WIDTH//2, panel_y + 100)
            # XP Bar Animation
            xp_y = panel_y + 150
            draw_progress_bar(s, panel_x + 100, xp_y, 400, 30, self.xp_current, self.xp_earned, f"+{self.xp_current} XP")
            gold_text = load_font(24).render(f"+{self.gold_earned} vàng", True, (180, 140, 40))
            s.blit(gold_text, (WIDTH // 2 - gold_text.get_width() // 2, xp_y + 44))
            # Stats
            if self.stats:
                correct = self.stats.get("correct", 0)
                total = self.stats.get("total", 0)
                acc = self.stats.get("accuracy", 0)
                avg_t = self.stats.get("avg_time", 0)
                stat_font = load_font(22)
                y_stat = panel_y + 210
                stats_lines = [
                    (f"Độ chính xác: {int(acc)}%", (40, 100, 40)),
                    (f"Số câu đúng: {correct}/{total}", (40, 100, 40)),
                    (f"Tốc độ trung bình: {avg_t:.1f}s/câu", (60, 60, 120)),
                ]
                for i, (txt, col) in enumerate(stats_lines):
                    draw_text_center(s, txt, stat_font, col, WIDTH//2, y_stat + i * 35)
            self.btn_review.draw(s)
            self.btn_continue.draw(s)
class PracticeState(GameState):
    """Màn hình luyện tập lại các câu sai"""
    def __init__(self, wrong_answers, lesson_title, on_complete):
        self.wrong_answers = wrong_answers[:3]  # Chỉ luyện tập tối đa 3 câu sai
        self.lesson_title = lesson_title
        self.on_complete = on_complete
        self.current_index = 0
        self.correct_count = 0
        self.feedback = None
        self.pending_advance = False
        # Khởi tạo câu hỏi đầu tiên
        self._load_current_question()
        self.bb = Button(20, HEIGHT - 80, 200, 60, "❌ HỦY", RED_BTN)
    def _load_current_question(self):
        """Tải câu hỏi hiện tại từ danh sách câu sai"""
        if self.current_index < len(self.wrong_answers):
            wrong = self.wrong_answers[self.current_index]
            self.q = wrong['question']
            self.ans = wrong['correct_answer']
            # Tạo các lựa chọn từ câu trả lời đúng và các lựa chọn sai giả định
            opts = [self.ans]
            # Thêm một số lựa chọn sai (giả định)
            try:
                ans_num = float(self.ans)
                for i in range(3):
                    opts.append(str(ans_num + (i+1) * random.choice([-1, 1])))
            except (ValueError, TypeError):
                opts.extend(["A", "B", "C"])
            random.shuffle(opts)
        else:
            self.q = "Đã hoàn thành luyện tập!"
            self.ans = None
            opts = []
        self.btns = [(Button(WIDTH // 2 - 230 + (i%2)*240, 440+(i//2)*110, 220, 90, str(o), PURPLE_BTN), o) for i, o in enumerate(opts)]
    def handle_event(self, e):
        if self.feedback and self.feedback.active:
            if e.type == pygame.MOUSEBUTTONDOWN or (e.type == pygame.KEYDOWN and e.key == pygame.K_SPACE):
                self.feedback.dismiss()
                self.pending_advance = False
                self._advance_question()
            return
        if e.type == pygame.MOUSEBUTTONDOWN:
            for b, v in self.btns:
                if b.clicked(e.pos):
                    is_correct = str(v) == str(self.ans)
                    if is_correct:
                        self.correct_count += 1
                        answer_effects.trigger_correct(e.pos[0], e.pos[1])
                        # Correct sound is now handled by update_combo via FeedbackOverlay
                    else:
                        answer_effects.trigger_wrong(e.pos[0], e.pos[1])
                        sound_manager.play_sfx("wrong")
                    self.feedback = FeedbackOverlay(self.q, self.ans, str(v), "practice", is_correct)
                    self.pending_advance = True
                    break
            if self.bb.clicked(e.pos):
                self.on_complete()
    def _advance_question(self):
        self.current_index += 1
        if self.current_index >= len(self.wrong_answers):
            # Hoàn thành luyện tập
            def on_practice_complete():
                self.on_complete()
            manager.change(VictoryState("HOÀN THÀNH LUYỆN TẬP!", self.correct_count * 10, self.lesson_title, {"correct": self.correct_count, "total": len(self.wrong_answers), "accuracy": (self.correct_count / len(self.wrong_answers)) * 100 if self.wrong_answers else 100}))
        else:
            self._load_current_question()
    def update(self, dt):
        if self.feedback and self.feedback.active:
            self.feedback.update(dt)
            if self.feedback.dismissed and self.pending_advance:
                self.pending_advance = False
                self._advance_question()
        answer_effects.update(dt)
    def draw(self, s):
        # Background
        s.fill((245, 245, 250))
        # Title
        title_surf = font_big.render("LUYỆN TẬP LẠI", True, (50, 50, 80))
        s.blit(title_surf, (WIDTH//2 - title_surf.get_width()//2, 80))
        # Progress
        progress_text = font_med.render(f"Câu {self.current_index + 1}/{len(self.wrong_answers)}", True, (100, 100, 120))
        s.blit(progress_text, (WIDTH//2 - progress_text.get_width()//2, 150))
        # Question card
        if self.current_index < len(self.wrong_answers):
            card_w, card_h = 800, 200
            card_x = WIDTH//2 - card_w//2
            card_y = 220
            pygame.draw.rect(s, (255, 255, 255), (card_x, card_y, card_w, card_h), border_radius=20)
            pygame.draw.rect(s, (100, 150, 200), (card_x, card_y, card_w, card_h), 3, border_radius=20)
            # Question text
            q_surf = font_big.render(self.q, True, (40, 40, 40))
            s.blit(q_surf, (card_x + 30, card_y + 30))
            # Buttons
            for b, _ in self.btns: b.draw(s)
        else:
            # Completed message
            complete_surf = font_med.render("Bạn đã hoàn thành luyện tập!", True, (50, 150, 50))
            s.blit(complete_surf, (WIDTH//2 - complete_surf.get_width()//2, 300))
        self.bb.draw(s)
        # Feedback
        if self.feedback and self.feedback.active:
            self.feedback.draw(s)
        # Answer effects
        answer_effects.draw(s)
class ReviewState(GameState):
    """Màn hình phân tích lỗi sai sau bài học"""
    def __init__(self, wrong_answers, lesson_title, on_continue):
        self.wrong_answers = wrong_answers
        self.lesson_title = lesson_title
        self.on_continue = on_continue  # Callback khi người dùng nhấn tiếp tục
        self.btn_continue = Button(WIDTH//2 - 125, HEIGHT - 120, 250, 60, "➡️ TIẾP TỤC", GREEN_BTN)
        self.btn_review = Button(WIDTH//2 - 125, HEIGHT - 200, 250, 60, "🔄 LUYỆN TẬP LẠI", BLUE_BTN)
        self.clover_effect = FallingCloverEffect(15)
        # Phân tích lỗi sai
        self.error_patterns = self._analyze_errors()
    def _analyze_errors(self):
        """Phân tích các mẫu lỗi sai"""
        patterns = {
            "operation_errors": {},  # Lỗi theo phép tính
            "common_mistakes": [],  # Các lỗi phổ biến
            "suggestions": []  # Gợi ý cải thiện
        }
        if not self.wrong_answers:
            return patterns
        # Phân tích theo phép tính
        for wrong in self.wrong_answers:
            op = wrong.get("operation", "unknown")
            if op not in patterns["operation_errors"]:
                patterns["operation_errors"][op] = 0
            patterns["operation_errors"][op] += 1
        # Tìm lỗi phổ biến nhất
        if patterns["operation_errors"]:
            most_common_op = max(patterns["operation_errors"].items(), key=lambda x: x[1])
            patterns["common_mistakes"].append(f"Bạn thường nhầm lẫn với {most_common_op[0]}")
            patterns["suggestions"].append(f"Hãy luyện tập thêm các bài {most_common_op[0]} để cải thiện")
        # Gợi ý dựa trên số lượng lỗi
        error_count = len(self.wrong_answers)
        if error_count >= 5:
            patterns["suggestions"].append("Bạn cần ôn lại kiến thức cơ bản trước khi tiếp tục")
        elif error_count >= 3:
            patterns["suggestions"].append("Hãy xem lại các câu sai và hiểu rõ cách giải")
        else:
            patterns["suggestions"].append("Bạn làm khá tốt, chỉ cần chú ý một chút nữa")
        return patterns
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.btn_continue.clicked(e.pos):
                self.on_continue()
            elif self.btn_review.clicked(e.pos) and self.wrong_answers:
                # Chuyển đến chế độ luyện tập lại
                def on_practice_complete():
                    self.on_continue()
                manager.change(PracticeState(self.wrong_answers, self.lesson_title, on_practice_complete))
    def update(self, dt):
        self.clover_effect.update(dt)
    def draw(self, s):
        self.clover_effect.draw(s)
        s.fill((245, 245, 250))
        # Tiêu đề
        title_surf = font_big.render("PHÂN TÍCH LỖI SAI", True, (50, 50, 80))
        s.blit(title_surf, (WIDTH//2 - title_surf.get_width()//2, 80))
        # Phân tích lỗi
        if not self.wrong_answers:
            no_error_surf = font_med.render("Tuyệt vời! Bạn không có câu sai nào!", True, (50, 150, 50))
            s.blit(no_error_surf, (WIDTH//2 - no_error_surf.get_width()//2, 200))
        else:
            # Hiển thị số câu sai
            error_count_surf = font_med.render(f"Số câu sai: {len(self.wrong_answers)}", True, (200, 50, 50))
            s.blit(error_count_surf, (WIDTH//2 - error_count_surf.get_width()//2, 150))
            # Hiển thị các lỗi phổ biến
            y_offset = 220
            patterns = self.error_patterns
            if patterns["common_mistakes"]:
                for mistake in patterns["common_mistakes"]:
                    mistake_surf = render_text_mixed(f"⚠️ {mistake}", font_small, (200, 100, 0))
                    s.blit(mistake_surf, (WIDTH//2 - mistake_surf.get_width()//2, y_offset))
                    y_offset += 40
            # Hiển thị gợi ý
            y_offset += 20
            for suggestion in patterns["suggestions"]:
                suggest_surf = render_text_mixed(f"💡 {suggestion}", font_small, (50, 100, 150))
                s.blit(suggest_surf, (WIDTH//2 - suggest_surf.get_width()//2, y_offset))
                y_offset += 35
            # Hiển thị 3 câu sai đầu tiên
            y_offset += 30
            review_title = font_med.render("Các câu sai cần ôn tập:", True, (80, 80, 100))
            s.blit(review_title, (WIDTH//2 - review_title.get_width()//2, y_offset))
            y_offset += 40
            for i, wrong in enumerate(self.wrong_answers[:3]):
                question_text = font_small.render(f"{i+1}. {wrong['question']}", True, (60, 60, 60))
                s.blit(question_text, (150, y_offset))
                answer_text = font_small.render(f"Bạn trả lời: {wrong['user_answer']} | Đáp án đúng: {wrong['correct_answer']}", True, (200, 50, 50))
                s.blit(answer_text, (150, y_offset + 25))
                y_offset += 60
        # Buttons
        self.btn_continue.draw(s)
        if self.wrong_answers:
            self.btn_review.draw(s)
class LessonState(GameState):
    def __init__(self, title):
        self.title = title
        self.grade = account_system.data().get("grade", 1)
        self.sc = 0; self.cc = 0; self.tc = 15
        self.correct_count = 0
        self.feedback = None
        self.pending_advance = False
        self.answer_times = []
        self.card_scale = 0.0 # Question card animation
        self.card_timer = 0
        self.clover_effect = FallingCloverEffect(15)
        adaptive_ai.reset()
        # Theo dõi câu trả lời sai để phân tích lỗi
        self.wrong_answers = []  # List of (question, user_answer, correct_answer, question_type)
        # Chuyển nhạc nền bài học
        sound_manager.set_bgm("lesson")
        # Learning Flow: 20% ôn cũ, 60% dạy mới, 20% thử thách
        self.learning_flow = account_system.get_learning_flow_questions(self.grade, self.title, self.tc)
        self.flow_queue = []
        self._build_flow_queue()
        self.next_q()
        self.bb = Button(20, HEIGHT - 80, 200, 60, "⬅️ QUAY LẠI", RED_BTN)
        # Hỗ trợ đọc to (TTS) — điểm cộng Accessibility cho học sinh lớp 1-2 chưa
        # đọc thạo. Tự ẩn nếu máy không hỗ trợ (không có pyttsx3/driver giọng đọc).
        self.speak_btn = Button(WIDTH // 2 + 420, 270, 70, 70, "🔊", (90, 150, 200)) if tts_is_available() else None
    def _build_flow_queue(self):
        """Xây dựng hàng đợi câu hỏi theo Learning Flow"""
        flow = self.learning_flow
        # 20% Ôn cũ - thêm câu hỏi từ flagged topics
        for topic in flow["review"]["topics"]:
            self.flow_queue.append(("review", topic))
        # 60% Dạy mới - câu hỏi từ bài học hiện tại
        for _ in range(flow["new"]["count"]):
            self.flow_queue.append(("new", flow["new"]["lesson"]))
        # 20% Thử thách - câu hỏi từ bài tiếp theo hoặc lớp trên
        for _ in range(flow["challenge"]["count"]):
            self.flow_queue.append(("challenge", flow["challenge"]["grade"]))
    def next_q(self):
        try: lesson_id = int(self.title.split(".")[0].replace("Bài", "").strip())
        except (ValueError, AttributeError): lesson_id = 1
        # Lấy loại câu hỏi từ flow queue
        if self.flow_queue:
            q_type, q_param = self.flow_queue.pop(0)
        else:
            q_type = "new"
            q_param = lesson_id
        # Điều chỉnh độ khó dựa trên loại câu hỏi
        if q_type == "review":
            difficulty = max(1, adaptive_ai.difficulty - 1)  # Giảm độ khó cho ôn cũ
        elif q_type == "challenge":
            difficulty = min(10, adaptive_ai.difficulty + 1)  # Tăng độ khó cho thử thách
        else:
            difficulty = adaptive_ai.difficulty
        # Sinh câu hỏi với adaptive difficulty
        user_id = account_system.current_user
        if q_type == "new":
            self.q, self.ans, opts, self.op = safe_generate_question(self.grade, lesson_id, difficulty, user_id=user_id)
        elif q_type == "challenge":
            next_lesson = lesson_id + 1
            self.q, self.ans, opts, self.op = safe_generate_question(self.grade, next_lesson, difficulty, user_id=user_id)
        else:  # review
            # Sinh câu hỏi từ topic đã đánh dấu
            self.q, self.ans, opts, self.op = safe_generate_question(self.grade, lesson_id, difficulty, user_id=user_id)
        # Điều chỉnh vị trí button để không bị che bởi khung câu hỏi lớn hơn
        # Tối ưu tải nhận thức: học sinh lớp 1-2 cần nút bấm TO HƠN, dễ bấm hơn.
        if is_young_learner(self.grade):
            btn_w, btn_h, gap_x, gap_y = 260, 110, 280, 130
        else:
            btn_w, btn_h, gap_x, gap_y = 220, 90, 240, 110
        self.btns = [(Button(WIDTH // 2 - gap_x // 2 - btn_w // 2 + (i % 2) * gap_x, 440 + (i // 2) * gap_y, btn_w, btn_h, str(o), PURPLE_BTN), o) for i, o in enumerate(opts or [])]
        self.card_scale = 0.0 # Reset animation
        adaptive_ai.start_question()
    def _advance_question(self):
        self.cc += 1
        if self.cc >= self.tc:
            correct_answers = self.correct_count
            accuracy = (correct_answers / self.tc) * 100
            stats = {
                "correct": correct_answers, "total": self.tc,
                "accuracy": accuracy, "avg_time": adaptive_ai.avg_time(),
                "wrong_answers": self.wrong_answers  # Thêm danh sách câu sai
            }
            if accuracy >= 60:
                manager.change(VictoryState("HOÀN THÀNH BÀI HỌC!", self.sc, self.title, stats))
            else:
                manager.change(DefeatState("CỐ LÊN NÀO! LÀM LẠI NHÉ 💪", correct_answers, self.tc, self.title, stats))
        else:
            self.next_q()
    def handle_event(self, e):
        if self.feedback and self.feedback.active:
            if e.type == pygame.MOUSEBUTTONDOWN or (e.type == pygame.KEYDOWN and e.key == pygame.K_SPACE):
                self.feedback.dismiss()
                self.pending_advance = False
                self._advance_question()
            return
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.speak_btn and self.speak_btn.clicked(e.pos):
                speak_text(self.q)
                return
            for b, v in self.btns:
                if b.clicked(e.pos):
                    is_correct = str(v) == str(self.ans)
                    # Kích hoạt hiệu ứng particle
                    if is_correct:
                        answer_effects.trigger_correct(e.pos[0], e.pos[1])
                        # Correct sound is now handled by update_combo via FeedbackOverlay
                    else:
                        answer_effects.trigger_wrong(e.pos[0], e.pos[1])
                        # Kích hoạt Camera Shake khi trả lời sai
                        trigger_shake(8, 0.5)  # Độ rung 8, Rung trong 0.5 giây (bỏ qua nếu REDUCE_MOTION)
                        sound_manager.play_sfx("wrong")
                    # Tích hợp các cơ chế học tập mới
                    topic_id = f"{self.grade}_{self.title}"
                    # Ghi lại câu trả lời sai để phân tích
                    if not is_correct:
                        self.wrong_answers.append({
                            "question": self.q,
                            "user_answer": str(v),
                            "correct_answer": self.ans,
                            "operation": self.op if hasattr(self, 'op') else "unknown",
                            "lesson": self.title
                        })
                    # Cập nhật độ thông thạo (SRS) với thời gian phản hồi
                    response_time = time.time() - adaptive_ai.question_start_time
                    account_system.update_mastery(topic_id, is_correct, response_time=response_time)
                    # Tag-based Knowledge Tracing: cập nhật độ thông thạo theo từng
                    # thẻ kỹ năng nhỏ (vd: "co_nho", "bang_cuu_chuong"...) và lấy về
                    # các can thiệp sư phạm cần áp dụng (gợi ý miễn phí / giảm độ khó tạm thời)
                    skill_tags = derive_skill_tags(self.q, self.op if hasattr(self, 'op') else "")
                    skill_interventions = account_system.update_skill_mastery(skill_tags, is_correct)
                    extra_tip = None
                    for tag, kind in skill_interventions:
                        if kind == "hint" and tag in SKILL_TAG_TIPS and extra_tip is None:
                            extra_tip = SKILL_TAG_TIPS[tag]
                        elif kind == "simplify":
                            # Sai 3 lần liên tiếp cùng một thẻ: tạm thời giảm độ khó để
                            # học sinh lấy lại tự tin trước khi quay lại kỹ năng đó.
                            adaptive_ai.difficulty = max(1, adaptive_ai.difficulty - 1)
                    # Cập nhật danh sách câu trả lời gần nhất
                    account_system.update_recent_answers(is_correct)
                    # Cập nhật chuỗi trả lời đúng
                    account_system.update_streak(is_correct)
                    # Cập nhật năng lượng kiến thức
                    account_system.update_energy(is_correct)
                    # Kiểm tra Fever Mode trước và sau khi cập nhật
                    d = account_system.data()
                    was_fever = d.get("fever_mode", False)
                    # Targeted Practice - đánh dấu chủ đề nếu sai
                    if not is_correct:
                        account_system.flag_topic(topic_id)
                    else:
                        account_system.unflag_topic(topic_id)
                    # Kiểm tra Fever Mode sau cập nhật
                    is_fever = d.get("fever_mode", False)
                    if is_fever and not was_fever:
                        sound_manager.activate_fever_mode()
                    elif not is_fever and was_fever:
                        sound_manager.deactivate_fever_mode()
                    if is_correct:
                        # Fever Mode - x2 XP khi kích hoạt
                        d = account_system.data()
                        xp_gain = int(10 * player.combo_multiplier)
                        if d.get("fever_mode", False):
                            xp_gain *= 2
                        # Item buff: combo boost
                        combo_boost = item_fx.get_combo_boost()
                        if combo_boost > 1:
                            xp_gain = int(xp_gain * combo_boost)
                        # Item buff: score multiplier
                        score_mult = item_fx.get_score_multiplier()
                        self.sc += int(xp_gain * score_mult)
                        # Consume question-count buffs
                        item_fx.consume_question_count("score_x3_10q")
                        item_fx.consume_question_count("euler_hint")
                        self.correct_count += 1
                        daily_task_progress("correct_10", 1)
                        if player.combo_streak >= 5: daily_task_progress("combo_5", 5)
                    else:
                        # Shield: block life loss
                        if item_fx.has_shield():
                            item_fx.use_shield()
                            # Don't reduce lives (no lives system in LessonState)
                    # Điều chỉnh độ khó dựa trên tỷ lệ trả lời đúng (70/30 logic)
                    diff_adjustment = account_system.get_difficulty_adjustment()
                    if diff_adjustment == 1:
                        adaptive_ai.difficulty = min(10, adaptive_ai.difficulty + 1)
                    elif diff_adjustment == -1:
                        adaptive_ai.difficulty = max(1, adaptive_ai.difficulty - 1)
                    # Enhanced AI tracking with topic and question type
                    topic_id = f"{self.grade}_{self.title}"
                    question_type = "lesson"
                    adaptive_ai.record_answer(is_correct, topic_id, question_type)
                    self.feedback = FeedbackOverlay(self.q, self.ans, str(v), self.op, is_correct, extra_tip=extra_tip)
                    self.pending_advance = True
                    break
            if self.bb.clicked(e.pos): manager.change(MenuState())
    def update(self, dt):
        self.clover_effect.update(dt)
        player.update_screen_shake(dt)
        # Question card pop-in
        if self.card_scale < 1.0:
            self.card_scale = min(1.0, self.card_scale + dt * 5)
        if self.feedback and self.feedback.active:
            self.feedback.update(dt)
            if self.feedback.dismissed and self.pending_advance:
                self.pending_advance = False
                self._advance_question()
        if confetti_sys: confetti_sys.update(dt)
        answer_effects.update(dt)
    def draw(self, s):
        self.clover_effect.draw(s)
        # Apply screen shake using manager
        off_x, off_y = player.get_screen_offset()
        # Drawing everything to a temporary surface for the shake effect
        temp = pygame.Surface((WIDTH, HEIGHT))
        temp.blit(background_img, (0, 0)) if background_img else temp.fill((30, 40, 60))
        # UI Top
        draw_top_bar(temp)
        # Question Page Title with enhanced rendering
        title_surf = render_cached_text_enhanced(font_big, "MathDrill 5.0", BLACK)
        title_rect = title_surf.get_rect(center=(WIDTH//2, 40))
        s.blit(title_surf, title_rect)
        # Progress info
        draw_progress_bar(temp, WIDTH // 2 - 250, 150, 500, 24, self.cc, self.tc, f"Câu {self.cc + 1}/{self.tc}")
        # Energy Bar (Năng lượng kiến thức)
        d = account_system.data()
        energy = d.get("energy", 0)
        fever_mode = d.get("fever_mode", False)
        energy_bar_x = WIDTH // 2 - 200
        energy_bar_y = 185
        energy_bar_w = 400
        energy_bar_h = 16
        # Energy bar background
        pygame.draw.rect(temp, (50, 50, 70), (energy_bar_x, energy_bar_y, energy_bar_w, energy_bar_h), border_radius=8)
        # Energy bar fill
        energy_fill_w = int(energy_bar_w * (energy / 100))
        energy_color = (200, 80, 80) if fever_mode else (80, 180, 230)
        pygame.draw.rect(temp, energy_color, (energy_bar_x, energy_bar_y, energy_fill_w, energy_bar_h), border_radius=8)
        # Energy label
        energy_label = render_text_mixed(f"⚡ {energy}%", font_small, energy_color)
        temp.blit(energy_label, (energy_bar_x + energy_bar_w + 10, energy_bar_y))
        # Fever Mode indicator
        if fever_mode:
            fever_text = render_text_mixed("🔥 FEVER MODE! x2 XP", font_med, (200, 80, 80))
            temp.blit(fever_text, (energy_bar_x, energy_bar_y - 25))
        # Question Card with Scale Animation - Tăng kích thước để chứa đủ nội dung
        card_w, card_h = 800, 200  # Tăng từ 600x160 lên 800x200
        sc = self.card_scale
        # Elastic scale effect
        if sc < 1.0:
            draw_sc = sc * 1.1 if sc > 0.8 else sc
        else:
            draw_sc = 1.0
        draw_w, draw_h = int(card_w * draw_sc), int(card_h * draw_sc)
        qr = pygame.Rect(WIDTH // 2 - draw_w // 2, 200 + (card_h - draw_h) // 2, draw_w, draw_h)  # Dịch lên một chút
        # Shadow
        pygame.draw.rect(temp, (0, 0, 0, 60), (qr.x + 5, qr.y + 8, qr.w, qr.h), border_radius=30)
        # Card Body
        pygame.draw.rect(temp, WHITE, qr, border_radius=30)
        # Border
        pygame.draw.rect(temp, (80, 150, 255), qr, 5, border_radius=30)
        if sc > 0.5:
            # Tự động wrap text cho câu hỏi dài
            max_width = card_w - 60  # Để lại margin
            lines = []
            words = self.q.split()
            current_line = []
            for word in words:
                test_line = ' '.join(current_line + [word])
                if font_big.size(test_line)[0] <= max_width:
                    current_line.append(word)
                else:
                    if current_line:
                        lines.append(' '.join(current_line))
                        current_line = [word]
                    else:
                        lines.append(word)
            if current_line:
                lines.append(' '.join(current_line))
            # Render từng dòng
            line_height = font_big.get_height()
            total_height = len(lines) * line_height
            start_y = qr.centery - total_height // 2
            for i, line in enumerate(lines):
                line_surf = font_big.render(line, True, (40, 40, 40))
                line_rect = line_surf.get_rect(centerx=qr.centerx, y=start_y + i * line_height)
                temp.blit(line_surf, line_rect)
        # Difficulty & Score below card
        diff_label = adaptive_ai.get_difficulty_label()
        diff_color = adaptive_ai.get_difficulty_color()
        diff_surf = font_small.render(f"Độ khó: {diff_label}", True, diff_color)
        temp.blit(diff_surf, (WIDTH // 2 - 280, 390))
        score_surf = font_small.render(f"Điểm bài tập: {self.sc}", True, (255, 225, 100))
        temp.blit(score_surf, (WIDTH // 2 + 100, 390))
        # Buttons
        for b, _ in self.btns: b.draw(temp)
        self.bb.draw(temp)
        if self.speak_btn:
            self.speak_btn.draw(temp)
        # Answer effects (particles)
        answer_effects.draw(temp)
        # Confetti
        if confetti_sys: confetti_sys.draw(temp)
        # Enhanced Combo Display
        combo_text = get_combo_text()
        if combo_text:
            combo_color = get_combo_color()
            font_size = 28 + min(player.combo_streak // 3, 12)
            combo_font = load_font(font_size)
            pulse = math.sin(time.time() * (6 + player.combo_streak // 3)) * (3 + player.combo_streak // 5)
            combo_surf = render_text_mixed(combo_text, combo_font, combo_color)
            combo_rect = combo_surf.get_rect(center=(WIDTH // 2, 450 + pulse))
            # Add glow for high combos
            if player.combo_streak >= 5:
                glow_surf = render_text_mixed(combo_text, combo_font, combo_color)
                for offset in [(2, 2), (-2, -2), (2, -2), (-2, 2)]:
                    temp.blit(glow_surf, (combo_rect.x + offset[0], combo_rect.y + offset[1]))
            temp.blit(combo_surf, combo_rect)
        # Feedback overlay
        if self.feedback and self.feedback.active:
            self.feedback.draw(temp)
        # Final blit with shake
        s.blit(temp, (off_x, off_y))
# =========================================================
# TIME ATTACK MODE - 60 giây, combo multiplier
# =========================================================
class TimeAttackState(GameState):
    def __init__(self):
        self.grade = account_system.data().get("grade", 1)
        self.title = "Time Attack" # Thêm thuộc tính title bị thiếu
        self.score = 0
        self.time_left = 60.0
        self.total_correct = 0
        self.total_answered = 0
        self.game_over = False
        self.feedback = None
        self.pending_advance = False
        self.card_scale = 0.0
        self.clover_effect = FallingCloverEffect(15)
        adaptive_ai.reset()
        update_combo(False) # Reset global combo streak

        self.next_q()
        self.back_btn = Button(20, HEIGHT - 75, 200, 60, "🚪 THOÁT", RED_BTN)
    def next_q(self):
        # Lấy bài ngẫu nhiên theo khối lớp với adaptive difficulty
        rid = random.randint(1, 40) if self.grade == 1 else random.randint(1, 60)
        user_id = account_system.current_user
        self.q, self.ans, opts, self.op = safe_generate_question(
            self.grade, rid, adaptive_ai.difficulty, user_id=user_id)
        # Màu nút thay đổi theo multiplier (combo)
        btn_col = (220, 150, 50) if player.combo_multiplier > 1.5 else PURPLE_BTN

        # Calculate dynamic button width to fit all options
        max_tw = 0
        test_font = load_font(28)
        for o in (opts or []):
            tw = test_font.size(str(o))[0]
            if tw > max_tw: max_tw = tw

        btn_w = max(240, max_tw + 80) # Dynamic width with padding
        spacing_x = 40
        spacing_y = 110
        start_x = WIDTH // 2 - (btn_w * 2 + spacing_x) // 2

        self.btns = []
        for i, o in enumerate(opts or []):
            bx = start_x + (i % 2) * (btn_w + spacing_x)
            by = 420 + (i // 2) * spacing_y
            self.btns.append((Button(bx, by, btn_w, 90, str(o), btn_col), o))

        self.card_scale = 0.0
        adaptive_ai.start_question()
    def handle_event(self, e):
        if self.game_over:
            # Result screen handling (already handled by VictoryState)
            return
        if self.feedback and self.feedback.active:
            if e.type == pygame.MOUSEBUTTONDOWN or (e.type == pygame.KEYDOWN and e.key == pygame.K_SPACE):
                self.feedback.dismiss()
                self.pending_advance = False
                self.next_q()
            return
        if e.type == pygame.MOUSEBUTTONDOWN:
            for b, v in self.btns:
                if b.clicked(e.pos):
                    is_correct = str(v) == str(self.ans)
                    self.total_answered += 1
                    if is_correct:
                        self.total_correct += 1
                        points = int(20 * player.combo_multiplier)
                        # Item buff: score multiplier
                        points = int(points * item_fx.get_score_multiplier())
                        item_fx.consume_question_count("score_x3_10q")
                        self.score += points
                        # Item buff: time bonus per correct answer
                        time_add = 1.0 + item_fx.get_time_bonus()
                        self.time_left = min(60, self.time_left + time_add)
                    # Enhanced AI tracking with topic and question type
                    # Defensive checking to prevent AttributeError
                    current_grade = getattr(self, 'grade', 1)
                    current_title = getattr(self, 'title', 'Unknown')
                    topic_id = f"{current_grade}_{current_title}"
                    question_type = "lesson"
                    adaptive_ai.record_answer(is_correct, topic_id, question_type)
                    skill_tags = derive_skill_tags(self.q, self.op if hasattr(self, 'op') else "")
                    skill_interventions = account_system.update_skill_mastery(skill_tags, is_correct)
                    extra_tip = None
                    for tag, kind in skill_interventions:
                        if kind == "hint" and tag in SKILL_TAG_TIPS and extra_tip is None:
                            extra_tip = SKILL_TAG_TIPS[tag]
                        elif kind == "simplify":
                            adaptive_ai.difficulty = max(1, adaptive_ai.difficulty - 1)
                    self.feedback = FeedbackOverlay(self.q, self.ans, str(v), self.op, is_correct, is_ta=True, extra_tip=extra_tip)
                    self.pending_advance = True
                    break
            if self.back_btn.clicked(e.pos):
                # Resume background music when exiting Time Attack
                try:
                    sound_mgr = get_sound_manager()
                    if sound_mgr: sound_mgr.set_bgm("menu")
                except (pygame.error, AttributeError):
                    pass
                manager.change(MenuState())
    def update(self, dt):
        self.clover_effect.update(dt)
        item_fx.tick_timers(dt)
        if not self.game_over and not (self.feedback and self.feedback.active):
            # Item buff: freeze timer
            if not item_fx.has_freeze_timer():
                self.time_left -= dt
            if self.time_left <= 0:
                self.time_left = 0
                self.game_over = True
                stats = {
                    "correct": self.total_correct,
                    "total": self.total_answered,
                    "accuracy": (self.total_correct/max(1, self.total_answered))*100,
                    "avg_time": adaptive_ai.avg_time()
                }
                manager.change(VictoryState("HẾT GIỜ!", self.score, "Time Attack", stats))
        if self.card_scale < 1.0:
            self.card_scale = min(1.0, self.card_scale + dt * 6)
        if self.feedback and self.feedback.active:
            self.feedback.update(dt)
        if confetti_sys: confetti_sys.update(dt)
    def draw(self, s):
        self.clover_effect.draw(s)
        # Draw everything to a temporary surface for consistency
        temp = pygame.Surface((WIDTH, HEIGHT))
        temp.blit(background_img, (0, 0)) if background_img else temp.fill((30, 40, 60))
        draw_top_bar(temp)
        # Timer display (center top)
        timer_col = (200, 80, 80) if self.time_left < 10 else WHITE
        timer_surf = render_text_mixed(f"⏱️ {int(self.time_left)}s", font_big, timer_col)
        temp.blit(timer_surf, (WIDTH // 2 - timer_surf.get_width() // 2, 80))
        # Question Card with scale animation - Tăng kích thước để chứa đủ nội dung
        card_w, card_h = 800, 200  # Tăng từ 600x160 lên 800x200
        sc = self.card_scale
        draw_w, draw_h = int(card_w * sc), int(card_h * sc)
        qr = pygame.Rect(WIDTH // 2 - draw_w // 2, 220 + (card_h - draw_h) // 2, draw_w, draw_h)
        # Shadow
        pygame.draw.rect(temp, (0, 0, 0, 60), (qr.x + 5, qr.y + 8, qr.w, qr.h), border_radius=30)
        # Card body
        pygame.draw.rect(temp, WHITE, qr, border_radius=30)
        pygame.draw.rect(temp, (255, 150, 50), qr, 5, border_radius=30)
        if sc > 0.5:
            # Wrap text cho câu hỏi dài
            max_width = card_w - 60
            lines = []
            words = self.q.split()
            current_line = []
            for word in words:
                test_line = ' '.join(current_line + [word])
                if font_big.size(test_line)[0] <= max_width:
                    current_line.append(word)
                else:
                    if current_line:
                        lines.append(' '.join(current_line))
                        current_line = [word]
                    else:
                        lines.append(word)
            if current_line:
                lines.append(' '.join(current_line))
            # Render từng dòng
            line_height = font_big.get_height()
            total_height = len(lines) * line_height
            start_y = qr.centery - total_height // 2
            for i, line in enumerate(lines):
                line_surf = font_big.render(line, True, (40, 40, 40))
                line_rect = line_surf.get_rect(centerx=qr.centerx, y=start_y + i * line_height)
                temp.blit(line_surf, line_rect)
        # Current score display
        score_surf = font_med.render(f"ĐIỂM HIỆN TẠI: {self.score}", True, (255, 225, 100))
        temp.blit(score_surf, (WIDTH // 2 - score_surf.get_width() // 2, 390))
        # Buttons
        for b, _ in self.btns:
            b.draw(temp)
        self.back_btn.draw(temp)
        # Confetti
        if confetti_sys: confetti_sys.draw(temp)
        # Feedback overlay
        if self.feedback and self.feedback.active:
            self.feedback.draw(temp)
        s.blit(temp, (0, 0))
# =========================================================
# ACHIEVEMENT VIEW STATE - Xem thành tích
# =========================================================
class AchievementViewState(GameState):
    def enter(self):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.back_btn = Button(810, 600, 300, 60, "⬅️ QUAY LẠI", RED_BTN)
        self.scroll_y = 0
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN and not self.book.is_flipping:
            if self.back_btn.clicked(e.pos):
                manager.change(MenuState(), transition_type="PAGE")
        if e.type == pygame.MOUSEWHEEL:
            self.scroll_y = min(0, self.scroll_y + e.y * 30)
    def update(self, dt):
        self.book.update(dt)
    def draw(self, s):
        s.fill((165, 214, 167))
        self.book.draw(s, lambda s, r: None, lambda s, r: None)
        # Tiêu đề
        title_surf = render_text_with_leading_icon(
            "🏆 THÀNH TÍCH",
            text_font=font_big,
            icon_font=load_icon_font(font_big.get_height()),
            color=(255, 215, 0),
            gap=8,
        )
        s.blit(title_surf, (WIDTH // 2 - title_surf.get_width() // 2, 90 - title_surf.get_height() // 2))
        # Lấy achievements đã mở khóa
        d = account_system.data()
        unlocked = d.get("achievements", [])
        # Hiển thị tổng quan
        total = len(ACHIEVEMENTS_DEF)
        got = len(unlocked)
        draw_text_center(s, f"Đã đạt: {got}/{total}", font_med, WHITE, WIDTH // 2, 130)
        # Vẽ từng achievement
        y_start = 170 + self.scroll_y
        col_w = 540
        for i, (key, ach) in enumerate(ACHIEVEMENTS_DEF.items()):
            is_unlocked = key in unlocked
            col = 0 if i % 2 == 0 else 1
            row = i // 2
            x = 100 + col * (col_w + 30)
            y = y_start + row * 90
            if y < 150 or y > HEIGHT - 100:
                continue
            # Card background
            card_rect = pygame.Rect(x, y, col_w, 80)
            card_color = (60, 60, 80) if is_unlocked else (40, 40, 50)
            card_surf = pygame.Surface((col_w, 80), pygame.SRCALPHA)
            pygame.draw.rect(card_surf, (*card_color, 200), (0, 0, col_w, 80), border_radius=12)
            if is_unlocked:
                # Viền vàng cho đã mở khóa
                pygame.draw.rect(card_surf, (200, 170, 80, 200), (0, 0, col_w, 80), 2, border_radius=12)
            else:
                pygame.draw.rect(card_surf, (100, 100, 100, 150), (0, 0, col_w, 80), 2, border_radius=12)
            s.blit(card_surf, (x, y))
            # Icon
            icon_text = ach["icon"] if is_unlocked else "🔒"
            icon_font = load_icon_font(30)
            icon_surf = render_cached_text(icon_font, icon_text, WHITE, supersample=False, _skip_emoji_check=True)
            s.blit(icon_surf, (x + 15, y + 25))
            # Tên
            name_color = (200, 170, 80) if is_unlocked else (120, 120, 120)
            name_surf = font_med.render(ach["name"], True, name_color)
            s.blit(name_surf, (x + 60, y + 10))
            # Mô tả
            desc_color = (180, 180, 180) if is_unlocked else (90, 90, 90)
            desc_font = load_font(16)
            desc_surf = desc_font.render(ach["desc"], True, desc_color)
            s.blit(desc_surf, (x + 60, y + 45))
            # XP reward
            if is_unlocked:
                xp_surf = render_cached_text(desc_font, f"+{ach['xp']} XP ✓", (100, 255, 100))
            else:
                xp_surf = render_cached_text(desc_font, f"+{ach['xp']} XP", (100, 100, 100))
            s.blit(xp_surf, (x + col_w - 100, y + 45))
        self.back_btn.draw(s)
class DailyState(GameState):
    def enter(self):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.gr = account_system.data().get("grade", 1)  # Add grade attribute
        self.title = "Thử Thách"  # Add title attribute
        self.sc = 0; self.cc = 0; self.tc = 10
        self.feedback = None  # FeedbackOverlay
        self.pending_advance = False
        self.answer_times = []
        adaptive_ai.reset()
        self.back_btn = Button(810, 600, 300, 60, "🚪 THOÁT", RED_BTN)
        self.speak_btn = Button(1120, 130, 70, 60, "🔊", (90, 150, 200)) if tts_is_available() else None
        self.next_q()
    def next_q(self):
        rid = random.randint(1, 40) if self.gr == 1 else random.randint(1, 60)
        user_id = account_system.current_user
        self.q, self.ans, opts, self.op = safe_generate_question(self.gr, rid, adaptive_ai.difficulty, user_id=user_id)
        self.btns = [(Button(810, 200 + i * 85, 300, 65, str(o), ORANGE_BTN), o) for i, o in enumerate(opts or [])]
        adaptive_ai.start_question()
    def _advance_question(self):
        self.cc += 1
        if self.cc >= self.tc:
            correct_answers = self.sc // 10
            accuracy = (correct_answers / self.tc) * 100
            stats = {
                "correct": correct_answers, "total": self.tc,
                "accuracy": accuracy, "avg_time": adaptive_ai.avg_time(),
                "answer_times": self.answer_times
            }
            if accuracy >= 60:
                xp_earned = correct_answers * 20
                add_xp(xp_earned)
                manager.change(VictoryState("HOÀN THÀNH THỬ THÁCH!", self.sc, "Thử Thách", stats))
            else:
                manager.change(DefeatState("CỐ LÊN NÀO! LÀM LẠI NHÉ 💪", correct_answers, self.tc, "Thử Thách", stats))
        else: self.next_q()
    def handle_event(self, e):
        # Nếu đang hiển thị feedback, click để bỏ qua
        if self.feedback and self.feedback.active:
            if e.type == pygame.MOUSEBUTTONDOWN:
                self.feedback.dismiss()
                self.pending_advance = False
                self._advance_question()
            return
        if e.type == pygame.MOUSEBUTTONDOWN and not self.book.is_flipping:
            if self.back_btn.clicked(e.pos): manager.change(MenuState())
            if self.speak_btn and self.speak_btn.clicked(e.pos):
                speak_text(self.q)
                return
            for b, v in self.btns:
                if b.clicked(e.pos):
                    is_correct = str(v) == str(self.ans)
                    self.answer_times.append(time.time() - adaptive_ai.question_start_time)
                    if is_correct:
                        # Correct sound is now handled by update_combo via FeedbackOverlay
                        self.sc += 10
                    else:
                        if snd_wrong: snd_wrong.play()
                    # Enhanced AI tracking with topic and question type
                    topic_id = f"{self.gr}_{self.title}"
                    question_type = "lesson"
                    adaptive_ai.record_answer(is_correct, topic_id, question_type)
                    skill_tags = derive_skill_tags(self.q, self.op if hasattr(self, 'op') else "")
                    skill_interventions = account_system.update_skill_mastery(skill_tags, is_correct)
                    extra_tip = None
                    for tag, kind in skill_interventions:
                        if kind == "hint" and tag in SKILL_TAG_TIPS and extra_tip is None:
                            extra_tip = SKILL_TAG_TIPS[tag]
                        elif kind == "simplify":
                            adaptive_ai.difficulty = max(1, adaptive_ai.difficulty - 1)
                    # Tạo feedback overlay
                    self.feedback = FeedbackOverlay(self.q, self.ans, str(v), self.op, is_correct, extra_tip=extra_tip)
                    self.pending_advance = True
                    break
    def update(self, dt):
        self.book.update(dt)
        if self.feedback and self.feedback.active:
            self.feedback.update(dt)
            if self.feedback.dismissed and self.pending_advance:
                self.pending_advance = False
                self._advance_question()
    def draw(self, s):
        s.fill((165, 214, 167)); self.book.draw(s, lambda s,r: None, lambda s,r: None)
        board_rect = pygame.Rect(80, 120, 520, 480)
        pygame.draw.rect(s, (101, 67, 33), (board_rect.x-10, board_rect.y-10, board_rect.w+20, board_rect.h+20), border_radius=15)
        pygame.draw.rect(s, (20, 50, 20), board_rect, border_radius=10)
        draw_text_center(s, "THỬ THÁCH", font_med, YELLOW_BTN, 340, 180)
        draw_text_center(s, "HẰNG NGÀY", font_med, YELLOW_BTN, 340, 220)
        # === THANH TIẾN ĐỘ ===
        draw_progress_bar(s, 110, 270, 460, 20, self.cc, self.tc, "Câu")
        draw_text_center(s, f"Điểm: {self.sc}  |  Độ khó: {adaptive_ai.get_difficulty_label()}", font_small, WHITE, 340, 300)
        if hasattr(self, 'q'): draw_multiline_text(s, self.q, font_med, WHITE, pygame.Rect(110, 330, 460, 200))
        for b, _ in self.btns: b.draw(s)
        self.back_btn.draw(s)
        if self.speak_btn:
            self.speak_btn.draw(s)
        if self.feedback and self.feedback.active:
            self.feedback.draw(s)
def compute_profile_stats(user_data):
    """Tổng hợp thống kê người chơi từ dữ liệu đã lưu."""
    history = user_data.get("history", [])
    total_q = int(user_data.get("total_answered", 0))
    total_ok = int(user_data.get("total_correct", 0))
    if total_q <= 0 and history:
        total_q = len(history) * 10
        total_ok = sum(1 for h in history if int(h.get("score", 0)) >= 50)
    accuracy = (total_ok / total_q * 100) if total_q > 0 else 0.0
    if accuracy <= 0 and hasattr(adaptive_ai, "total_correct"):
        t = adaptive_ai.total_correct + adaptive_ai.total_wrong
        if t > 0:
            accuracy = adaptive_ai.total_correct / t * 100
    play_sec = int(user_data.get("play_time_seconds", 0))
    hours, rem = divmod(play_sec, 3600)
    minutes, seconds = divmod(rem, 60)
    if hours:
        play_str = f"{hours}g {minutes}p"
    elif minutes:
        play_str = f"{minutes}p {seconds}s"
    else:
        play_str = f"{seconds}s"
    return {
        "accuracy": round(accuracy, 1),
        "best_combo": int(user_data.get("best_combo", 0)),
        "play_time": play_str,
        "achievements": len(user_data.get("achievements", [])),
    }


class ProfileState(GameState):
    def enter(self):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.bb = Button(810, 600, 300, 60, "⬅️ QUAY LẠI", RED_BTN)
        self.skill_map_btn = Button(810, 520, 300, 60, "📊 Bản Đồ Điểm Yếu", (90, 150, 170))

    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN and not self.book.is_flipping:
            if self.bb.clicked(e.pos):
                manager.change(MenuState(), transition_type="PAGE")
            elif self.skill_map_btn.clicked(e.pos):
                manager.change(SkillMapState(), transition_type="PAGE")

    def update(self, dt):
        self.book.update(dt)

    def draw(self, s):
        s.fill((165, 214, 167))
        self.book.draw(s, lambda surf, r: None, lambda surf, r: None)
        draw_text_center(s, "HỒ SƠ NGƯỜI CHƠI", font_big, BLACK, WIDTH // 2, 95)

        user_name = account_system.current_user or "Player"
        user_data = account_system.data()
        stats = compute_profile_stats(user_data)
        pet = account_system.get_pet()
        pet_info = pet_system.get_pet_info(pet.get("type", "clover"), pet.get("stage", 0)) or {"icon": "🍀"}

        avatar_rect = pygame.Rect(120, 160, 200, 200)
        pygame.draw.rect(s, WHITE, avatar_rect, border_radius=20)
        pygame.draw.rect(s, PURPLE_BTN, avatar_rect, 4, border_radius=20)
        if gi.character_img:
            char = pygame.transform.smoothscale(gi.character_img, (180, 180))
            s.blit(char, (avatar_rect.centerx - 90, avatar_rect.centery - 90))
        else:
            av_icon = render_cached_text(load_icon_font(72), pet_info.get("icon", "👤"), (80, 80, 80))
            s.blit(av_icon, (avatar_rect.centerx - av_icon.get_width() // 2, avatar_rect.centery - 40))
        name_surf = render_cached_text(font_med, user_name, BLACK)
        s.blit(name_surf, (avatar_rect.centerx - name_surf.get_width() // 2, avatar_rect.bottom + 12))

        card_rect = pygame.Rect(380, 150, 820, 480)
        pygame.draw.rect(s, WHITE, card_rect, border_radius=20)
        pygame.draw.rect(s, PURPLE_BTN, card_rect, 5, border_radius=20)

        gold_value = "Vô hạn (Admin)" if account_system.current_user == ADMIN_USER else str(user_data.get("gold", 0))
        rows = [
            ("⭐ Level", str(user_data.get("level", 1))),
            ("✨ XP", str(user_data.get("xp", 0))),
            ("💰 Gold", gold_value),
            ("🎯 Độ chính xác", f"{stats['accuracy']}%"),
            ("🔥 Best Combo", str(stats["best_combo"])),
            ("⏱ Thời gian chơi", stats["play_time"]),
            ("📚 Lớp", str(user_data.get("grade", 1))),
            ("🏆 Thành tích", f"{stats['achievements']}/{len(ACHIEVEMENTS_DEF)}"),
        ]
        y_offset = card_rect.y + 35
        for label, value in rows:
            s.blit(render_text_mixed(label, load_font(20), (90, 90, 110)), (card_rect.x + 28, y_offset))
            s.blit(render_cached_text(font_med, value, (40, 40, 60)), (card_rect.x + 280, y_offset))
            y_offset += 52
        self.bb.draw(s)
        self.skill_map_btn.draw(s)
class SkillMapState(GameState):
    """
    "Bản Đồ Điểm Yếu" — hiển thị trực quan độ thông thạo theo từng thẻ kỹ năng
    nhỏ (micro-skill) cho phụ huynh/giáo viên xem, dựa trên hệ thống Tag-based
    Knowledge Tracing (skill_mastery, cập nhật bằng công thức EMA).
    """
    TAG_LABELS = {
        "phep_cong": "Phép cộng",
        "phep_tru": "Phép trừ",
        "phep_nhan": "Phép nhân",
        "phep_chia": "Phép chia",
        "co_nho": "Cộng có nhớ",
        "khong_nho": "Cộng không nhớ",
        "muon": "Trừ có mượn",
        "khong_muon": "Trừ không mượn",
        "bang_cuu_chuong": "Bảng cửu chương",
        "phep_nhan_2_chu_so": "Nhân số có 2 chữ số",
        "mot_chu_so": "Số có 1 chữ số",
        "hai_chu_so": "Số có 2 chữ số",
        "ba_chu_so_tro_len": "Số có 3 chữ số trở lên",
        "so_sanh": "So sánh số",
        "hinh_hoc": "Hình học",
        "do_luong": "Đo lường",
        "xem_gio": "Xem giờ",
        "toan_co_loi_van": "Toán có lời văn",
        "cau_tao_so": "Cấu tạo số",
        "ngay_thang": "Ngày tháng",
    }
    def enter(self):
        self.back_btn = Button(30, HEIGHT - 70, 160, 50, "⬅️ Quay lại", RED_BTN)
        self._rebuild()
    def _rebuild(self):
        d = account_system.data()
        mastery = d.get("skill_mastery", {})
        # Yếu nhất hiển thị trước để phụ huynh/giáo viên biết cần hỗ trợ gì trước.
        self.rows = sorted(mastery.items(), key=lambda kv: kv[1])
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN and self.back_btn.clicked(e.pos):
            manager.change(ProfileState(), transition_type="PAGE")
    def update(self, dt):
        pass
    def _bar_color(self, m):
        if m < 0.4:
            return (220, 90, 90)     # yếu — cần hỗ trợ thêm
        elif m < 0.7:
            return (230, 180, 70)   # đang tiến bộ
        else:
            return (90, 190, 120)   # đã thành thạo
    def draw(self, s):
        s.fill((28, 32, 48))
        draw_text_center(s, "📊 BẢN ĐỒ ĐIỂM YẾU", font_big, (255, 230, 150), WIDTH // 2, 55)
        sub = "Dành cho phụ huynh/giáo viên — mức độ thông thạo theo từng kỹ năng nhỏ"
        s.blit(render_cached_text(load_font(16), sub, (180, 185, 205)), (WIDTH // 2 - 300, 95))
        if not self.rows:
            draw_text_center(s, "Học sinh chưa làm đủ bài để có dữ liệu.", font_med, (170, 175, 195), WIDTH // 2, HEIGHT // 2)
            draw_text_center(s, "Hãy làm vài bài luyện tập rồi quay lại xem nhé!", font_small, (150, 155, 175), WIDTH // 2, HEIGHT // 2 + 45)
        else:
            bar_x, bar_w = 340, 560
            y = 150
            row_h = 56
            legend_y = HEIGHT - 130
            for tag, m in self.rows:
                if y > legend_y - 20:
                    break  # tránh vẽ đè lên phần chú thích/nút quay lại nếu quá nhiều thẻ
                label = self.TAG_LABELS.get(tag, tag)
                pct = max(0.0, min(1.0, m))
                col = self._bar_color(m)
                s.blit(render_cached_text(load_font(18), label, WHITE), (60, y))
                pygame.draw.rect(s, (55, 58, 78), (bar_x, y, bar_w, 28), border_radius=8)
                pygame.draw.rect(s, col, (bar_x, y, int(bar_w * pct), 28), border_radius=8)
                pct_txt = render_cached_text(load_font(16), f"{int(pct*100)}%", WHITE)
                s.blit(pct_txt, (bar_x + bar_w + 15, y + 4))
                y += row_h
            # Chú thích màu sắc
            legend = [((220, 90, 90), "Cần hỗ trợ thêm (<40%)"), ((230, 180, 70), "Đang tiến bộ (40–70%)"), ((90, 190, 120), "Đã thành thạo (>70%)")]
            lx = 60
            for col, txt in legend:
                pygame.draw.rect(s, col, (lx, legend_y, 22, 22), border_radius=5)
                t = render_cached_text(load_font(15), txt, (200, 205, 220))
                s.blit(t, (lx + 30, legend_y + 2))
                lx += t.get_width() + 70
        self.back_btn.draw(s)
class ShopState(GameState):
    def enter(self):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.back_btn = Button(810, 600, 300, 60, "⬅️ QUAY LẠI", RED_BTN)
        self.status_msg = ""
        self.status_timer = 0.0
        self.purchase_animation = None
        self.success_particles = []
        self.shop_filter = "all"
        self.preview_item = None
        self.scroll_y = 0
        self.search_box = InputBox(70, 132, 300, 36, "Tìm vật phẩm...")
        self.catalog = collect_shop_catalog(pet_system, skin_system)
        self.item_buttons = []
        self.filter_buttons = []
        filters = [("all", "Tất cả", PURPLE_BTN), ("pen", "Bút", BLUE_BTN), ("board", "Bảng", GREEN_BTN), ("pet", "Pet", ORANGE_BTN)]
        fx = 400
        for key, label, col in filters:
            self.filter_buttons.append((key, Button(fx, 132, 88, 36, label, col)))
            fx += 96
        self._rebuild_shop_list()

    def _rebuild_shop_list(self):
        self.item_buttons = []
        items = filter_shop_items(self.catalog, self.shop_filter, self.search_box.text)
        cols, btn_w, btn_h, gap = 2, 200, 72, 12
        list_x, list_y = 70, 190
        for idx, it in enumerate(items):
            row, col = idx // cols, idx % cols
            x = list_x + col * (btn_w + gap)
            y = list_y + row * (btn_h + gap) + self.scroll_y
            if y > HEIGHT - 120 or y < 175:
                continue
            color = PURPLE_BTN if it["category"] == "pet" else (BLUE_BTN if it["category"] == "pen" else GREEN_BTN)
            self.item_buttons.append((it, Button(x, y, btn_w, btn_h, "", color)))
        if self.preview_item is None and items:
            self.preview_item = items[0]
        elif self.preview_item and not any(self.preview_item["key"] == it["key"] and self.preview_item["category"] == it["category"] for it in items):
            self.preview_item = items[0] if items else None

    def _shop_act_on_item(self, it):
        d = account_system.data()
        cat, key = it["category"], it["key"]
        if cat == "pet":
            unlocked = d.get("unlocked_pets", ["clover"])
            current = account_system.get_pet().get("type", "clover")
            if key in unlocked:
                if key == current:
                    self.status_msg = "Đang dùng thú cưng này."
                else:
                    ok = account_system.change_pet_type(key)
                    self.status_msg = "Đổi thú cưng thành công!" if ok else "Không thể đổi thú cưng."
            else:
                ok, self.status_msg = account_system.purchase_pet(key)
                if ok:
                    self.trigger_purchase_success(WIDTH // 2, HEIGHT // 2, "pet")
        else:
            unlocked_skins = d.get("unlocked_skins", ["pen_basic", "board_wood"])
            equipped = account_system.get_equipped_skins()
            slot = "pen" if cat == "pen" else "board"
            current = equipped[slot]
            if key in unlocked_skins:
                if key == current:
                    self.status_msg = f"Đang dùng {'bút' if cat == 'pen' else 'bảng'} này."
                else:
                    ok, self.status_msg = account_system.equip_skin(key)
            else:
                ok, self.status_msg = account_system.purchase_skin(key)
                if ok:
                    self.trigger_purchase_success(WIDTH // 2, HEIGHT // 2, cat)
        self.status_timer = 3.0

    def _draw_shop_preview(self, s):
        panel = pygame.Rect(940, 175, 300, 400)
        pygame.draw.rect(s, (40, 45, 70, 220), panel, border_radius=16)
        pygame.draw.rect(s, (255, 215, 0), panel, 2, border_radius=16)
        s.blit(render_cached_text(load_font(18), "PREVIEW", (255, 230, 120)), (panel.x + 16, panel.y + 12))
        if not self.preview_item:
            s.blit(render_cached_text(load_font(16), "Chọn vật phẩm", (180, 180, 200)), (panel.x + 40, panel.y + 180))
            return
        it = self.preview_item
        icon = render_cached_text(load_icon_font(56), it.get("icon", "?"), WHITE)
        s.blit(icon, (panel.centerx - icon.get_width() // 2, panel.y + 50))
        s.blit(render_cached_text(load_font(22), it.get("name", ""), WHITE), (panel.x + 16, panel.y + 130))
        desc = it.get("description", "")[:80]
        if len(it.get("description", "")) > 80:
            desc += "..."
        s.blit(render_cached_text(load_font(14), desc, (200, 200, 220)), (panel.x + 16, panel.y + 165))
        if it["category"] == "board" and it.get("bg_color"):
            pr = pygame.Rect(panel.x + 16, panel.y + 220, 120, 70)
            pygame.draw.rect(s, it["bg_color"], pr, border_radius=8)
            pygame.draw.rect(s, it.get("border_color", WHITE), pr, 2, border_radius=8)
        elif it["category"] == "pen" and it.get("color"):
            pygame.draw.circle(s, it["color"], (panel.centerx, panel.y + 255), 14)
            if it.get("effect") == "neon":
                for i in range(3):
                    pygame.draw.circle(s, it["color"], (panel.centerx, panel.y + 255), 14 + i * 4, 1)
        price = it.get("price", 0)
        s.blit(render_text_mixed(f"Giá: {price} 💰", load_font(18), (255, 215, 0)), (panel.x + 16, panel.y + 310))
        buy_btn = Button(panel.x + 40, panel.y + 345, 220, 42, "🛒 MUA / TRANG BỊ", GREEN_BTN)
        buy_btn.draw(s)
        self._preview_buy_rect = buy_btn.rect

    def _draw_shop_list(self, s):
        search_label = render_cached_text(load_icon_font(18), "🔍", (60, 60, 80))
        s.blit(search_label, (self.search_box.rect.x - 28, self.search_box.rect.y + 8))
        self.search_box.draw(s)
        for fkey, btn in self.filter_buttons:
            col = WHITE if self.shop_filter == fkey else btn.color
            txt_col = BLACK if self.shop_filter == fkey else WHITE
            pygame.draw.rect(s, col, btn.rect, border_radius=8)
            pygame.draw.rect(s, BLACK if self.shop_filter == fkey else btn.color, btn.rect, 2, border_radius=8)
            t = render_cached_text(load_font(14), btn.text, txt_col)
            s.blit(t, (btn.rect.centerx - t.get_width() // 2, btn.rect.centery - t.get_height() // 2))
        d = account_system.data()
        unlocked_pets = d.get("unlocked_pets", ["clover"])
        unlocked_skins = d.get("unlocked_skins", ["pen_basic", "board_wood"])
        equipped = account_system.get_equipped_skins()
        cur_pet = account_system.get_pet().get("type", "clover")
        for it, btn in self.item_buttons:
            sel = self.preview_item and it["key"] == self.preview_item["key"] and it["category"] == self.preview_item["category"]
            owned = (it["category"] == "pet" and it["key"] in unlocked_pets) or (it["key"] in unlocked_skins)
            using = (it["category"] == "pet" and it["key"] == cur_pet) or (it["category"] == "pen" and it["key"] == equipped["pen"]) or (it["category"] == "board" and it["key"] == equipped["board"])
            bg = GREEN_BTN if using else (btn.color if owned else SHADOW)
            pygame.draw.rect(s, bg, btn.rect, border_radius=10)
            border = (255, 215, 0) if sel else WHITE
            pygame.draw.rect(s, border, btn.rect, 3 if sel else 1, border_radius=10)
            s.blit(render_cached_text(load_icon_font(26), it.get("icon", "?"), WHITE), (btn.rect.x + 10, btn.rect.centery - 14))
            s.blit(render_cached_text(load_font(14), it.get("name", "")[:14], WHITE), (btn.rect.x + 48, btn.rect.y + 12))
            st = "Đang dùng" if using else ("Đã có" if owned else f"{it.get('price', 0)}💰")
            st_surf = render_text_mixed(st, load_font(12), (220, 220, 220)) if "💰" in st else render_cached_text(load_font(12), st, (220, 220, 220))
            s.blit(st_surf, (btn.rect.x + 48, btn.rect.y + 38))
    def trigger_purchase_success(self, x, y, item_type="item"):
        """Kích hoạt hiệu ứng khi mua thành công"""
        self.purchase_animation = {
            'x': x, 'y': y,
            'scale': 0.5,
            'alpha': 255,
            'text': f"MUA {item_type.upper()} THÀNH CÔNG!",
            'lifetime': 2.0
        }
        # Thêm particles vàng bay ra
        for _ in range(ParticleBudget.request(8)):
            self.success_particles.append({
                'x': x + random.randint(-30, 30),
                'y': y + random.randint(-30, 30),
                'vx': random.uniform(-100, 100),
                'vy': random.uniform(-200, -50),
                'lifetime': random.uniform(1.0, 2.0),
                'size': random.randint(2, 5),
                'color': COLORS['accent']
            })
        # Kích hoạt confetti
        if confetti_sys: confetti_sys.explode(x, y, count=20)
        # Screen shake nhẹ
        trigger_shake(3.0, 0.2)
        # Phát âm thanh
        sound_manager.play_sound("purchase")
    def handle_event(self, e):
        if self.book.is_flipping:
            return
        self.search_box.handle_event(e)
        if e.type == pygame.KEYDOWN and self.search_box.active:
            self._rebuild_shop_list()
        if e.type == pygame.MOUSEWHEEL:
            self.scroll_y = min(0, self.scroll_y + e.y * 24)
            self._rebuild_shop_list()
        if e.type != pygame.MOUSEBUTTONDOWN:
            return
        if self.back_btn.clicked(e.pos):
            manager.change(MenuState(), transition_type="PAGE")
            return
        for fkey, btn in self.filter_buttons:
            if btn.clicked(e.pos):
                self.shop_filter = fkey
                self._rebuild_shop_list()
                return
        if hasattr(self, "_preview_buy_rect") and self.preview_item and self._preview_buy_rect.collidepoint(e.pos):
            self._shop_act_on_item(self.preview_item)
            return
        for it, btn in self.item_buttons:
            if btn.clicked(e.pos):
                self.preview_item = it
                self._shop_act_on_item(it)
                return
    def update(self, dt):
        self.book.update(dt)
        if self.status_timer > 0:
            self.status_timer -= dt
    def draw(self, s):
        s.fill((165, 214, 167))
        self.book.draw(s, lambda surf, r: None, lambda surf, r: None)
        draw_text_center(s, "CỬA HÀNG SIÊU CẤP", font_big, BLACK, WIDTH // 2, 80)
        d = account_system.data()
        gold = d.get("gold", 0)
        gold_display = "Vàng: Vô hạn (Admin)" if account_system.current_user == ADMIN_USER else f"Vàng: {gold}"
        s.blit(render_cached_text(load_icon_font(28), "💰", (180, 140, 40)), (WIDTH - 280, 48))
        s.blit(render_cached_text(load_font(24), gold_display, (180, 140, 40)), (WIDTH - 245, 50))
        self._draw_shop_list(s)
        self._draw_shop_preview(s)
        if self.status_timer > 0 and self.status_msg:
            msg_color = (40, 150, 70) if "thành công" in self.status_msg.lower() else (170, 80, 70)
            draw_text_center(s, self.status_msg, font_small, msg_color, WIDTH // 2, HEIGHT - 160)
        self.back_btn.draw(s)
class SkillTreeState(GameState):
    def enter(self):
        self.book = RealisticBook(50, 50, 1200, 700)
        self.back_btn = Button(810, 600, 300, 60, "⬅️ QUAY LẠI", RED_BTN)
        self.status_msg = ""
        self.status_timer = 0.0
        self.selected_skill = None
        self.skill_buttons = []
        # Create skill buttons organized by category
        categories = ["gold", "time", "xp", "protection", "combo", "special"]
        category_colors = {
            "gold": (255, 215, 0),
            "time": (100, 150, 255),
            "xp": (147, 51, 234),
            "protection": (50, 200, 50),
            "combo": (255, 100, 50),
            "special": (255, 50, 150)
        }
        y_offset = 200
        for category in categories:
            # Category header
            skills = skill_tree_system.get_skills_by_category(category)
            if not skills:
                continue
            x_start = 100
            y_pos = y_offset
            for skill_id, skill_data in skills.items():
                btn = Button(x_start, y_pos, 240, 90, "", category_colors[category])
                self.skill_buttons.append((skill_id, btn))
                x_start += 260  # Giảm khoảng cách giữa các nút
                if x_start > 950:  # Xuống hàng sớm hơn
                    x_start = 100
                    y_pos += 100  # Giảm khoảng cách dọc
            y_offset += len(skills) * 100 + 30  # Giảm khoảng cách giữa các danh mục
    def handle_event(self, e):
        if e.type != pygame.MOUSEBUTTONDOWN or self.book.is_flipping:
            return
        if self.back_btn.clicked(e.pos):
            manager.change(MenuState())
            return
        d = account_system.data()
        user_level = d.get("level", 1)
        user_xp = d.get("xp", 0)
        skill_levels = account_system.get_skill_levels()
        for skill_id, btn in self.skill_buttons:
            if not btn.clicked(e.pos):
                continue
            skill_info = skill_tree_system.get_skill_info(skill_id)
            current_level = skill_levels.get(skill_id, 0)
            # If skill is not unlocked
            if current_level == 0:
                success, msg = account_system.unlock_skill(skill_id)
                self.status_msg = msg
                self.status_timer = 3.0
            # If skill can be upgraded
            elif current_level < skill_info.get("max_level", 1):
                success, msg = account_system.upgrade_skill(skill_id)
                self.status_msg = msg
                self.status_timer = 3.0
            # If skill is duration-based and can be activated
            elif skill_info.get("effect_type") == "duration":
                success, msg = account_system.activate_skill(skill_id)
                self.status_msg = msg
                self.status_timer = 3.0
            else:
                self.status_msg = "Kỹ năng đã đạt cấp tối đa!"
                self.status_timer = 3.0
    def update(self, dt):
        self.book.update(dt)
        if self.status_timer > 0:
            self.status_timer -= dt
    def draw(self, s):
        s.fill((165, 214, 167))
        self.book.draw(s, lambda s, r: None, lambda s, r: None)
        # Title with icon - separate rendering for better icon display
        title_font = load_font(50)
        icon_font = load_icon_font(50)
        # Render icon separately
        icon_surf = render_cached_text_enhanced(icon_font, "🌳", BLACK)
        text_surf = render_cached_text_enhanced(title_font, " CÂY KỸ NĂNG", BLACK)
        # Calculate positions
        total_width = icon_surf.get_width() + text_surf.get_width()
        icon_x = WIDTH//2 - total_width // 2
        text_x = icon_x + icon_surf.get_width()
        # Blit both parts
        s.blit(icon_surf, (icon_x, 80 - icon_surf.get_height()//2))
        s.blit(text_surf, (text_x, 80 - text_surf.get_height()//2))
        # User stats
        d = account_system.data()
        user_level = d.get("level", 1)
        user_xp = d.get("xp", 0)
        level_text = font_med.render(f"Level: {user_level}", True, BLACK)
        s.blit(level_text, (WIDTH - 150, 50))
        xp_text = font_med.render(f"XP: {user_xp}", True, (147, 51, 234))
        s.blit(xp_text, (WIDTH - 250, 80))
        # Level requirement notice
        if user_level < 5:
            notice_text = font_small.render("Cần level 5 để mở khóa kỹ năng!", True, (200, 50, 50))
            s.blit(notice_text, (WIDTH//2 - notice_text.get_width()//2, 120))
        # Draw skill buttons
        skill_levels = account_system.get_skill_levels()
        active_effects = skill_tree_system.get_active_effects()
        for skill_id, btn in self.skill_buttons:
            skill_info = skill_tree_system.get_skill_info(skill_id)
            current_level = skill_levels.get(skill_id, 0)
            is_active = skill_id in active_effects
            # Determine button color based on state
            if current_level == 0:
                # Not unlocked - check if can unlock
                can_unlock, _ = skill_tree_system.can_unlock_skill(skill_id, user_level, user_xp)
                btn_color = (100, 200, 100) if can_unlock and user_level >= 5 else SHADOW
            elif current_level >= skill_info.get("max_level", 1):
                btn_color = GREEN_BTN
            elif is_active:
                btn_color = (255, 255, 100)  # Yellow for active
            else:
                btn_color = btn.color
            # Draw button
            pygame.draw.rect(s, btn_color, btn.rect, border_radius=12)
            pygame.draw.rect(s, WHITE, btn.rect, 2, border_radius=12)
            # Icon - Enhanced rendering for better visibility
            icon_font = load_icon_font(32)  # Slightly larger for better visibility
            icon_text = skill_info.get("icon", "⭐")
            # Use enhanced rendering for icons
            icon_surf = render_cached_text_enhanced(icon_font, icon_text, WHITE)
            s.blit(icon_surf, (btn.rect.x + 6, btn.rect.y + 6))
            # Name and level - auto-fit text within button width
            name_text = skill_info.get("name", "Unknown")
            if current_level > 0:
                name_text += f" (Lv.{current_level})"
            # Use auto-fit text function
            name_font = load_font(12)  # Smaller font for better fit
            max_text_width = btn.rect.width - 55  # Account for icon and padding
            name_lines = render_text_fitted(name_text, name_font, WHITE, max_text_width, max_lines=2)
            # Render each line
            y_offset = btn.rect.y + 10
            for i, line_surf in enumerate(name_lines):
                if i >= 2:  # Max 2 lines
                    break
                s.blit(line_surf, (btn.rect.x + 45, y_offset))
                y_offset += line_surf.get_height() + 2
            # Description - auto-fit text within button width
            desc_text = skill_info.get("description", "")
            desc_font = load_font(8)  # Even smaller font for description
            max_desc_width = btn.rect.width - 55  # Same width as name
            desc_lines = render_text_fitted(desc_text, desc_font, (220, 220, 220), max_desc_width, max_lines=1)
            # Description positioned below name
            if desc_lines:
                desc_y = btn.rect.y + 35 if len(name_lines) == 1 else btn.rect.y + 45
                s.blit(desc_lines[0], (btn.rect.x + 45, desc_y))
            # Status/Cost - ngắn gọn với font nhỏ hơn
            if current_level == 0:
                if user_level >= 5:
                    status_text = "Mở khóa (50)"
                    status_color = (100, 255, 100)
                else:
                    status_text = f"Cần Lv.5"
                    status_color = (255, 100, 100)
            elif current_level < skill_info.get("max_level", 1):
                cost_list = skill_info.get("cost_per_level", [])
                if current_level < len(cost_list):
                    status_text = f"Nâng cấp ({cost_list[current_level]})"
                    status_color = (255, 255, 100)
                else:
                    status_text = "Đã tối đa"
                    status_color = (200, 200, 200)
            else:
                status_text = "Đã tối đa"
                status_color = (200, 200, 200)
            status_font = load_font(9)  # Smaller font for status
            status_surf = status_font.render(status_text, True, status_color)
            s.blit(status_surf, (btn.rect.x + 45, btn.rect.y + 65))
            # Progress bar for skills with levels
            if current_level > 0:
                max_level = skill_info.get("max_level", 1)
                progress_width = 170  # Giảm width cho button nhỏ hơn
                progress_height = 3
                progress_x = btn.rect.x + 45
                progress_y = btn.rect.y + 78
                # Background
                pygame.draw.rect(s, (50, 50, 50), (progress_x, progress_y, progress_width, progress_height))
                # Progress
                progress_fill = int((current_level / max_level) * progress_width)
                pygame.draw.rect(s, (100, 255, 100), (progress_x, progress_y, progress_fill, progress_height))
        # Status message
        if self.status_timer > 0 and self.status_msg:
            msg_color = (40, 150, 70) if "thành công" in self.status_msg.lower() else (170, 80, 70)
            draw_text_center(s, self.status_msg, font_small, msg_color, WIDTH//2, HEIGHT - 160)
        self.back_btn.draw(s)

# =========================================================
# BAG STATE – Túi đồ, xem và sử dụng vật phẩm từ gacha
# =========================================================
class BagState(GameState):
    """
    Túi đồ hiển thị tất cả thẻ đã thu thập.
    - Mỗi ô = 1 loại thẻ, số lượng hiển thị ở góc.
    - Click = chọn thẻ → xem chi tiết → nút "Sử Dụng".
    - Sau khi dùng: thẻ biến mất khỏi túi (tiêu thụ 1 cái).
    - Panel phải hiển thị Active Buffs đang chạy.
    Layout: left panel (items grid) | right panel (detail + active buffs).
    """
    RARITY_COLORS = {
        "5star": (255, 215,   0),
        "4star": (200, 130, 255),
        "3star": (130, 190, 255),
    }
    RARITY_BG = {
        "5star": (50, 40, 15),
        "4star": (40, 25, 60),
        "3star": (20, 35, 55),
    }

    def __init__(self):
        self.back_btn    = Button(30, HEIGHT - 65, 160, 50, "← Quay lại", RED_BTN)
        self.use_btn     = Button(0, 0, 200, 52, "⚡ Sử Dụng", (80, 180, 80))
        self.selected    = None   # card title currently selected
        self.msg         = ""
        self.msg_timer   = 0.0
        self.msg_ok      = True
        self.anim_timer  = 0.0
        self.scroll_y    = 0
        self.item_rects  = []     # list of (title, rect) for click detection

        # Build all card definitions lookup
        self._all_cards  = {}
        for pool in [banner_system.POOL_5STAR, banner_system.POOL_4STAR, banner_system.POOL_3STAR]:
            for c in pool:
                self._all_cards[c["title"]] = c

    def _get_bag_sorted(self):
        """Bag sorted 5★ first, then 4★, then 3★, alphabetical within."""
        bag = item_fx.get_bag()
        order = {"5star": 0, "4star": 1, "3star": 2}
        items = []
        for title, qty in bag.items():
            card_def = self._all_cards.get(title, {})
            rarity = card_def.get("rarity", "3star")
            items.append((title, qty, rarity, card_def))
        items.sort(key=lambda x: (order.get(x[2], 3), x[0]))
        return items

    def handle_event(self, e):
        if e.type == pygame.MOUSEWHEEL:
            self.scroll_y = max(-600, min(0, self.scroll_y + e.y * 30))
        if e.type != pygame.MOUSEBUTTONDOWN:
            return
        p = e.pos
        if self.back_btn.clicked(p):
            manager.change(MenuState(), transition_type="PAGE")
            return
        # Item grid click
        for title, rect in self.item_rects:
            if rect.collidepoint(p):
                self.selected = title
                return
        # Use button
        if self.selected and self.use_btn.rect.collidepoint(p):
            ok, msg = item_fx.activate(self.selected)
            self.msg = msg
            self.msg_ok = ok
            self.msg_timer = 3.0
            # If no more of this item, deselect
            if item_fx.get_bag().get(self.selected, 0) == 0:
                self.selected = None

    def update(self, dt):
        self.anim_timer += dt
        if self.msg_timer > 0:
            self.msg_timer = max(0, self.msg_timer - dt)
        item_fx.tick_timers(dt)

    def _draw_item_card(self, s, title, qty, rarity, card_def, rect, selected):
        color  = self.RARITY_COLORS.get(rarity, (180, 180, 180))
        bg     = self.RARITY_BG.get(rarity, (25, 30, 50))
        t      = self.anim_timer

        # Glow for selected
        if selected:
            gw = rect.inflate(14, 14)
            gs = pygame.Surface((gw.w, gw.h), pygame.SRCALPHA)
            rc = (int(127+127*math.sin(t*3)), int(127+127*math.sin(t*3+2.1)), int(127+127*math.sin(t*3+4.2)))
            pygame.draw.rect(gs, (*rc, 160), (0, 0, gw.w, gw.h), border_radius=18)
            s.blit(gs, (gw.x, gw.y))

        pygame.draw.rect(s, bg, rect, border_radius=14)
        pygame.draw.rect(s, color, rect, 3 if selected else 1, border_radius=14)

        # Icon using Segoe UI Emoji
        icon_str = card_def.get("icon", "✨")
        icon_f = load_icon_font(44)
        icon_s = render_cached_text_enhanced(icon_f, icon_str, color)
        s.blit(icon_s, (rect.centerx - icon_s.get_width()//2, rect.y + 10))

        # Title (truncated)
        tf = load_font(12)
        name = title
        while tf.size(name)[0] > rect.w - 8 and len(name) > 3:
            name = name[:-1]
        if name != title:
            name = name[:-1] + "…"
        ts = tf.render(name, True, (220, 220, 220))
        s.blit(ts, (rect.centerx - ts.get_width()//2, rect.y + 62))

        # Qty badge
        if qty > 1:
            badge_r = pygame.Rect(rect.right - 24, rect.y + 2, 22, 20)
            pygame.draw.rect(s, (220, 60, 60), badge_r, border_radius=6)
            qs = load_font(12).render(str(qty), True, WHITE)
            s.blit(qs, (badge_r.centerx - qs.get_width()//2, badge_r.y + 3))

        # Rarity stars
        stars = {"5star":"★★★★★","4star":"★★★★","3star":"★★★"}.get(rarity,"★★★")
        sf = load_font(10).render(stars, True, color)
        s.blit(sf, (rect.centerx - sf.get_width()//2, rect.y + 76))

    def draw(self, s):
        s.fill((8, 12, 24))
        # Background grid lines
        for gx in range(0, WIDTH, 60):
            pygame.draw.line(s, (18, 22, 38), (gx, 0), (gx, HEIGHT))
        for gy in range(0, HEIGHT, 60):
            pygame.draw.line(s, (18, 22, 38), (0, gy), (WIDTH, gy))

        # ── Left panel: item grid ──────────────────────────
        panel_w = 760
        pygame.draw.rect(s, (12, 16, 30), (0, 0, panel_w, HEIGHT))
        pygame.draw.line(s, (60, 80, 120), (panel_w, 0), (panel_w, HEIGHT), 2)

        # Title
        title_s = render_cached_text(load_font(28), "🎒 Túi Đồ", (210, 220, 255))
        s.blit(render_cached_text(load_icon_font(28), "🎒", (210,220,255)),
               (30, 18))
        title_t = render_cached_text(load_font(28), "Túi Đồ", (210, 220, 255))
        s.blit(title_t, (78, 20))

        bag_items = self._get_bag_sorted()
        total = len(bag_items)

        if total == 0:
            empty_s = render_cached_text(load_font(22), "Túi đồ trống — hãy ghé Cửa Hàng Đổi Thẻ!", (120, 130, 160))
            s.blit(empty_s, (panel_w//2 - empty_s.get_width()//2, HEIGHT//2 - 20))
        else:
            # Grid: 6 columns
            cols    = 6
            item_w  = 110
            item_h  = 95
            gap_x   = 14
            gap_y   = 16
            start_x = 28
            start_y = 70 + self.scroll_y

            self.item_rects = []
            for idx, (title, qty, rarity, card_def) in enumerate(bag_items):
                col = idx % cols
                row = idx // cols
                rx  = start_x + col * (item_w + gap_x)
                ry  = start_y + row * (item_h + gap_y)
                rect = pygame.Rect(rx, ry, item_w, item_h)
                # Clip to panel
                if ry + item_h < 55 or ry > HEIGHT - 10:
                    self.item_rects.append((title, rect))
                    continue
                self.item_rects.append((title, rect))
                self._draw_item_card(s, title, qty, rarity, card_def, rect, title == self.selected)

        # Total count
        ct_s = render_cached_text(load_font(14), f"Tổng: {total} loại vật phẩm", (140, 150, 180))
        s.blit(ct_s, (30, HEIGHT - 62))

        # ── Right panel: detail + active buffs ─────────────
        rx0 = panel_w + 10
        rw  = WIDTH - panel_w - 10

        # ── Detail panel ───────────────────────────────────
        detail_h = 350
        detail_r  = pygame.Rect(rx0, 10, rw, detail_h)
        pygame.draw.rect(s, (16, 20, 38), detail_r, border_radius=16)
        pygame.draw.rect(s, (80, 100, 160), detail_r, 2, border_radius=16)

        if self.selected and self.selected in self._all_cards:
            card_def = self._all_cards[self.selected]
            rarity   = card_def.get("rarity", "3star")
            color    = self.RARITY_COLORS.get(rarity, (180, 180, 180))
            effect_id= card_def.get("effect_id","")
            defn     = ITEM_DEFS.get(effect_id, {})
            t        = self.anim_timer

            # Rainbow border for 5★
            if rarity == "5star":
                rc = (int(127+127*math.sin(t*2)), int(127+127*math.sin(t*2+2.1)), int(127+127*math.sin(t*2+4.2)))
                pygame.draw.rect(s, rc, detail_r, 3, border_radius=16)

            # Big icon
            big_icon_f = load_icon_font(72)
            bi = render_cached_text(big_icon_f, card_def.get("icon","✨"), color, supersample=False, _skip_emoji_check=True)
            s.blit(bi, (detail_r.centerx - bi.get_width()//2, detail_r.y + 14))

            # Title + rarity
            nm = render_cached_text(load_font(22), self.selected, color)
            s.blit(nm, (detail_r.centerx - nm.get_width()//2, detail_r.y + 100))
            stars = {"5star":"★★★★★  HUYỀN THOẠI","4star":"★★★★  HIẾM","3star":"★★★  THƯỜNG"}.get(rarity,"")
            ss = render_cached_text(load_font(14), stars, (200, 200, 210))
            s.blit(ss, (detail_r.centerx - ss.get_width()//2, detail_r.y + 130))

            # Effect info
            eff_s = render_cached_text(load_font(14), f"Hiệu ứng: {defn.get('label','?')}", (150,220,150))
            s.blit(eff_s, (detail_r.x + 16, detail_r.y + 158))

            # Description wrapped
            draw_multiline_text(s, defn.get("desc", card_def.get("content","")),
                                load_font(14), (200, 200, 220),
                                pygame.Rect(detail_r.x+16, detail_r.y+182, rw-32, 80))

            # Qty in bag
            qty   = item_fx.get_bag().get(self.selected, 0)
            qty_s = render_cached_text(load_font(17), f"Số lượng trong túi: {qty}", (220, 220, 120))
            s.blit(qty_s, (detail_r.x + 16, detail_r.y + 270))

            # Use button
            self.use_btn.rect = pygame.Rect(detail_r.centerx - 100, detail_r.y + 298, 200, 42)
            self.use_btn.draw(s)
        else:
            hint_s = render_cached_text(load_font(17), "← Chọn vật phẩm để xem chi tiết", (130, 140, 170))
            s.blit(hint_s, (detail_r.centerx - hint_s.get_width()//2, detail_r.centery - 10))

        # ── Active Buffs panel ──────────────────────────────
        buf_y0 = detail_r.bottom + 14
        buf_r  = pygame.Rect(rx0, buf_y0, rw, HEIGHT - buf_y0 - 70)
        pygame.draw.rect(s, (16, 20, 38), buf_r, border_radius=16)
        pygame.draw.rect(s, (80, 160, 100), buf_r, 2, border_radius=16)

        buf_title_icon = render_cached_text(load_icon_font(18), "⚡", (160,255,180))
        s.blit(buf_title_icon, (buf_r.x + 14, buf_r.y + 12))
        buf_title_text = render_cached_text(load_font(18), "Buffs đang hoạt động", (160,255,180))
        s.blit(buf_title_text, (buf_r.x + 40, buf_r.y + 14))

        active = item_fx.get_active_summary()
        if not active:
            no_s = render_cached_text(load_font(14), "Không có buff nào đang hoạt động.", (120, 130, 150))
            s.blit(no_s, (buf_r.centerx - no_s.get_width()//2, buf_r.y + 50))
        else:
            by = buf_r.y + 44
            for icon, label, info in active:
                # Icon
                ic = render_cached_text(load_icon_font(22), icon, (200,255,200), supersample=False, _skip_emoji_check=True)
                s.blit(ic, (buf_r.x + 14, by))
                # Label + info
                ls = render_cached_text(load_font(15), label, (200, 255, 200))
                s.blit(ls, (buf_r.x + 44, by + 2))
                inf_s = render_cached_text(load_font(13), info, (160, 200, 160))
                s.blit(inf_s, (buf_r.x + 44, by + 20))
                by += 44
                if by > buf_r.bottom - 20:
                    break

        # ── Message ─────────────────────────────────────────
        if self.msg_timer > 0 and self.msg:
            mc = (80, 220, 100) if self.msg_ok else (220, 80, 80)
            ms = render_cached_text(load_font(18), self.msg, mc)
            s.blit(ms, (WIDTH//2 - ms.get_width()//2, HEIGHT - 100))

        # ── Back button ─────────────────────────────────────
        self.back_btn.draw(s)
        hint_s = render_cached_text(load_font(13), "💡 Dùng vật phẩm trước khi vào chơi để kích hoạt buff", (140, 150, 170))
        s.blit(hint_s, (WIDTH//2 - hint_s.get_width()//2, HEIGHT - 40))

# =========================================================
# GACHA PORTAL STATE – Banner lobby giống Honkai Star Rail
# =========================================================
class CardShopState(GameState):
    """
    Cửa Hàng Đổi Thẻ — thay thế hoàn toàn cơ chế Gacha/quay may rủi cũ.
    Học sinh dùng Vàng kiếm được từ việc học (làm đúng bài, hoàn thành
    nhiệm vụ...) để ĐỔI TRỰC TIẾP thẻ kỹ năng mình muốn. Không có xác suất,
    không "pity", không "50/50" — mọi lượt đổi đều chắc chắn thành công
    nếu đủ Vàng, để khuyến khích các em nỗ lực học tập thay vì trông chờ
    may rủi (phù hợp quy định của trường đối với học sinh lớp 1-5).
    """
    RARITY_INFO = {
        "3star": {"label": "Thường",    "color": (130, 190, 255), "price": 80},
        "4star": {"label": "Hiếm",      "color": (200, 130, 255), "price": 250},
        "5star": {"label": "Đặc Biệt",  "color": (255, 215, 0),   "price": 600},
    }

    def __init__(self):
        self.back_btn = Button(30, HEIGHT - 70, 160, 50, "⬅️ Quay lại", RED_BTN)
        self.filter = "all"
        self.filter_buttons = []
        filters = [("all", "Tất cả", PURPLE_BTN), ("3star", "Thường", BLUE_BTN),
                   ("4star", "Hiếm", PURPLE_BTN), ("5star", "Đặc Biệt", ORANGE_BTN)]
        fx = 210
        for key, label, col in filters:
            self.filter_buttons.append((key, Button(fx, HEIGHT - 70, 140, 50, label, col)))
            fx += 150
        self.msg = ""
        self.msg_timer = 0.0
        self.msg_ok = True
        self.scroll_y = 0
        self.card_buttons = []
        self._rebuild()

    def _all_cards(self):
        cards = []
        for rarity, pool in (("3star", banner_system.POOL_3STAR),
                             ("4star", banner_system.POOL_4STAR),
                             ("5star", banner_system.POOL_5STAR)):
            for c in pool:
                card = dict(c)
                card["rarity"] = rarity
                cards.append(card)
        return cards

    def _rebuild(self):
        cards = self._all_cards()
        if self.filter != "all":
            cards = [c for c in cards if c["rarity"] == self.filter]
        self.card_buttons = []
        cols, w, h, gap = 3, 320, 130, 16
        x0, y0 = 40, 130
        for idx, c in enumerate(cards):
            row, col = idx // cols, idx % cols
            x = x0 + col * (w + gap)
            y = y0 + row * (h + gap) + self.scroll_y
            self.card_buttons.append((c, pygame.Rect(x, y, w, h)))

    def handle_event(self, e):
        if e.type == pygame.MOUSEWHEEL:
            self.scroll_y = min(0, self.scroll_y + e.y * 30)
            self._rebuild()
        if e.type != pygame.MOUSEBUTTONDOWN:
            return
        if self.back_btn.clicked(e.pos):
            manager.change(MenuState(), transition_type="PAGE")
            return
        for key, btn in self.filter_buttons:
            if btn.clicked(e.pos):
                self.filter = key
                self.scroll_y = 0
                self._rebuild()
                return
        for c, rect in self.card_buttons:
            if rect.collidepoint(e.pos):
                self._buy(c)
                return

    def _buy(self, card):
        info = self.RARITY_INFO[card["rarity"]]
        price = info["price"]
        d = account_system.data()
        gold = int(d.get("gold", 0))
        is_admin = account_system.current_user == ADMIN_USER
        if not is_admin and gold < price:
            self.msg = f"Chưa đủ Vàng! Cần {price} Vàng, bạn có {gold}. Cố lên, học thêm để kiếm Vàng nhé!"
            self.msg_ok = False
            self.msg_timer = 2.8
            return
        if not is_admin:
            d["gold"] = gold - price
        banner_system.grant_card_direct(card["title"], card["rarity"])
        self.msg = f"Đã đổi thẻ '{card['title']}' thành công!"
        self.msg_ok = True
        self.msg_timer = 2.5
        trigger_shake(2, 0.15)  # bỏ qua nếu REDUCE_MOTION
        if confetti_sys:
            confetti_sys.explode(WIDTH // 2, HEIGHT // 2, count=16)
        sound_manager.play_sound("purchase")

    def update(self, dt):
        if self.msg_timer > 0:
            self.msg_timer = max(0, self.msg_timer - dt)

    def draw(self, s):
        s.fill((18, 20, 34))
        draw_text_center(s, "🏪 CỬA HÀNG ĐỔI THẺ", font_big, (255, 230, 150), WIDTH // 2, 55)
        sub = "Dùng Vàng học tập được để đổi thẻ mình thích — không may rủi!"
        s.blit(render_cached_text(load_font(16), sub, (190, 190, 210)), (WIDTH // 2 - 270, 95))
        d = account_system.data()
        gold = d.get("gold", 0)
        gold_display = "Vàng: Vô hạn (Admin)" if account_system.current_user == ADMIN_USER else f"Vàng: {gold}"
        s.blit(render_cached_text(load_icon_font(26), "💰", (255, 215, 80)), (WIDTH - 260, 40))
        s.blit(render_cached_text(load_font(20), gold_display, (255, 215, 80)), (WIDTH - 225, 44))
        for key, btn in self.filter_buttons:
            col = WHITE if self.filter == key else btn.color
            pygame.draw.rect(s, col, btn.rect, border_radius=8)
            txt = render_cached_text(load_font(14), btn.text, BLACK if self.filter == key else WHITE)
            s.blit(txt, (btn.rect.centerx - txt.get_width() // 2, btn.rect.centery - txt.get_height() // 2))
        d2 = account_system.data()
        bag = d2.get("bag", {})
        for c, rect in self.card_buttons:
            if rect.bottom < 120 or rect.top > HEIGHT - 90:
                continue
            info = self.RARITY_INFO[c["rarity"]]
            owned = bag.get(c["title"], 0)
            pygame.draw.rect(s, (35, 38, 58), rect, border_radius=14)
            pygame.draw.rect(s, info["color"], rect, 2, border_radius=14)
            icon = render_cached_text(load_icon_font(30), c.get("icon", "?"), info["color"])
            s.blit(icon, (rect.x + 14, rect.y + 14))
            s.blit(render_cached_text(load_font(16), c["title"][:20], WHITE), (rect.x + 58, rect.y + 14))
            desc = c.get("content", "")
            if len(desc) > 44:
                desc = desc[:44] + "..."
            s.blit(render_cached_text(load_font(12), desc, (190, 190, 205)), (rect.x + 14, rect.y + 52))
            s.blit(render_cached_text(load_font(12), info["label"], info["color"]), (rect.x + 14, rect.y + 78))
            price_txt = render_text_mixed(f"{info['price']} 💰", load_font(14), (255, 215, 80))
            s.blit(price_txt, (rect.right - 90, rect.y + 78))
            if owned:
                own_s = render_cached_text(load_font(12), f"Đã có: {owned}", (140, 220, 150))
                s.blit(own_s, (rect.right - 90, rect.y + 52))
        self.back_btn.draw(s)
        if self.msg_timer > 0 and self.msg:
            mc = (60, 200, 100) if self.msg_ok else (220, 80, 80)
            draw_text_center(s, self.msg, font_small, mc, WIDTH // 2, HEIGHT - 45)

class ExamTransitionState(GameState):
    def __init__(self):
        self.timer = 0
        self.duration = 2.5
        self.book_w = 1200
        self.book_h = 700
        self.book_x = WIDTH // 2
        self.book_y = HEIGHT // 2
        self.paper_y = HEIGHT + 100
        self.paper_alpha = 0
        self.paper_rotation = 15.0
    def update(self, dt):
        self.timer += dt
        prog = min(self.timer / self.duration, 1.0)
        if prog <= 0.4:
            p1 = prog / 0.4
            self.book_w = int(max(40, 1200 * (1 - p1)))
        elif prog <= 0.65:
            p2 = (prog - 0.4) / 0.25
            self.book_x = int((WIDTH // 2) - (WIDTH * p2))
        if prog > 0.6:
            p3 = (prog - 0.6) / 0.4
            target_y = HEIGHT // 2
            self.paper_y = int(HEIGHT - (HEIGHT - target_y) * p3)
            self.paper_alpha = int(255 * p3)
            self.paper_rotation = 15.0 * (1 - p3)
        if prog >= 1.0:
            manager.change(FinalExamState())
    def draw(self, s):
        s.fill((165, 214, 167))
        if self.book_x > -300:
            book_rect = pygame.Rect(0, 0, self.book_w, self.book_h)
            book_rect.center = (self.book_x, self.book_y)
            pygame.draw.rect(s, (101, 67, 33), book_rect, border_radius=10)
            gay_sach_w = max(15, self.book_w // 10)
            pygame.draw.rect(s, (60, 40, 20), (book_rect.centerx - gay_sach_w//2, book_rect.y, gay_sach_w, self.book_h), border_radius=5)
        if self.paper_alpha > 0:
            paper_w, paper_h = 850, 700
            paper_surf = pygame.Surface((paper_w, paper_h), pygame.SRCALPHA)
            pygame.draw.rect(paper_surf, (255, 255, 255, self.paper_alpha), (0, 0, paper_w, paper_h), border_radius=5)
            pygame.draw.rect(paper_surf, (0, 0, 0, self.paper_alpha), (0, 0, paper_w, paper_h), 2, border_radius=5)
            for i in range(1, 15):
                line_y = 100 + i * 40
                pygame.draw.line(paper_surf, (220, 230, 255, self.paper_alpha // 2), (50, line_y), (paper_w - 50, line_y), 1)
            rotated_paper = pygame.transform.rotate(paper_surf, self.paper_rotation)
            rect = rotated_paper.get_rect(center=(WIDTH // 2, self.paper_y))
            s.blit(rotated_paper, rect)


class FinalExamState(GameState):
    def __init__(self):
        self.grade = account_system.data().get("grade", 1)
        self.questions = generate_hard_exam(self.grade)
        self.current_q = 0
        self.score = 0
        self.finished = False
        self.input_text = ""
        self.back_btn = Button(20, HEIGHT - 75, 200, 60, "🚪 THOÁT", RED_BTN)
        self.submit_btn = Button(WIDTH//2 - 125, HEIGHT - 120, 250, 60, "📝 NỘP BÀI", GREEN_BTN)
        self.next_btn = Button(WIDTH - 250, HEIGHT - 120, 200, 60, "CÂU SAU ➡️", BLUE_BTN)
        self.prev_btn = Button(50, HEIGHT - 120, 200, 60, "⬅️ CÂU TRƯỚC", BLUE_BTN)
    def handle_event(self, e):
        if self.finished: return
        q = self.questions[self.current_q]
        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.back_btn.clicked(e.pos):
                manager.change(MenuState())
                return
            if self.submit_btn.clicked(e.pos):
                self._calculate_score()
                manager.change(ExamResultState(self.score))
                return
            if self.next_btn.clicked(e.pos) and self.current_q < len(self.questions) - 1:
                if q["type"] == "input":
                    q["user_ans"] = self.input_text
                self.current_q += 1
                self.input_text = self.questions[self.current_q].get("user_ans", "") if self.questions[self.current_q]["type"] == "input" else ""
                return
            if self.prev_btn.clicked(e.pos) and self.current_q > 0:
                if q["type"] == "input":
                    q["user_ans"] = self.input_text
                self.current_q -= 1
                self.input_text = self.questions[self.current_q].get("user_ans", "") if self.questions[self.current_q]["type"] == "input" else ""
                return
            # MCQ Buttons
            if q["type"] == "mcq":
                for i, opt in enumerate(q["opts"]):
                    btn_rect = pygame.Rect(WIDTH//2 - 250 + (i%2)*260, 350 + (i//2)*80, 240, 60)
                    if btn_rect.collidepoint(e.pos):
                        q["user_ans"] = opt
                        break
        if e.type == pygame.KEYDOWN and q["type"] == "input":
            if e.key == pygame.K_BACKSPACE:
                self.input_text = self.input_text[:-1]
            elif e.key == pygame.K_RETURN:
                q["user_ans"] = self.input_text
            elif e.unicode.isdigit() or e.unicode == '-':
                if len(self.input_text) < 10:
                    self.input_text += e.unicode
    def _calculate_score(self):
        self.score = 0
        for q in self.questions:
            if q["type"] == "mcq":
                if q.get("user_ans") == q["correct"]:
                    self.score += 1
            else:
                if str(q.get("user_ans", "")).strip() == q["correct"]:
                    self.score += 1
        self.finished = True
    def update(self, dt): pass
    def draw(self, s):
        s.fill((253, 246, 227))
        # Paper background
        paper_rect = pygame.Rect(100, 50, WIDTH - 200, HEIGHT - 200)
        pygame.draw.rect(s, WHITE, paper_rect)
        pygame.draw.rect(s, BLACK, paper_rect, 3)
        # Header
        draw_text_center(s, f"BÀI THI CHUYỂN LỚP - LỚP {self.grade}", font_big, (139, 69, 19), WIDTH//2, 100)
        draw_text_center(s, f"Câu {self.current_q + 1}/{len(self.questions)}", font_med, BLACK, WIDTH//2, 160)
        q = self.questions[self.current_q]
        # Question
        q_rect = pygame.Rect(150, 200, WIDTH - 300, 120)
        draw_multiline_text(s, q["q"], font_med, BLACK, q_rect)
        if q["type"] == "mcq":
            for i, opt in enumerate(q["opts"]):
                btn_rect = pygame.Rect(WIDTH//2 - 250 + (i%2)*260, 350 + (i//2)*80, 240, 60)
                is_selected = q.get("user_ans") == opt
                color = GREEN_BTN if is_selected else BLUE_BTN
                pygame.draw.rect(s, color, btn_rect, border_radius=12)
                pygame.draw.rect(s, BLACK, btn_rect, 2, border_radius=12)
                draw_text_center(s, str(opt), font_med, WHITE, btn_rect.centerx, btn_rect.centery)
        else:
            # Input box
            input_rect = pygame.Rect(WIDTH//2 - 200, 400, 400, 60)
            pygame.draw.rect(s, WHITE, input_rect)
            pygame.draw.rect(s, BLACK, input_rect, 3)
            input_surf = font_big.render(self.input_text, True, BLACK)
            s.blit(input_surf, (input_rect.x + 20, input_rect.y + 10))
            draw_text_center(s, "Nhập đáp án của bạn vào ô trên", font_small, (100, 100, 100), WIDTH//2, 480)
        self.back_btn.draw(s)
        self.submit_btn.draw(s)
        if self.current_q < len(self.questions) - 1: self.next_btn.draw(s)
        if self.current_q > 0: self.prev_btn.draw(s)
class ExamResultState(GameState):
    def __init__(self, score):
        self.score = score
        self.back_btn = Button(WIDTH//2 - 150, HEIGHT - 100, 300, 60, "🏠 VỀ MENU", GREEN_BTN)
        self._processed_result = False
        self.exam_gold = 0
    def enter(self):
        if self._processed_result:
            return
        self._processed_result = True
        self.exam_gold = reward_gold_for_result("mock_exam", self.score * 10, self.score * 10)
        if self.score >= 6:
            d = account_system.data()
            d["grade"] = min(3, d.get("grade", 1) + 1)
            d["completed_lessons"] = []
            d["xp"] = 0  # Reset exp về 0 sau khi chuyển lớp thành công
            account_system.save()
    def draw(self, s):
        s.fill((44, 62, 80))
        cert = pygame.Rect(WIDTH//2 - 500, 100, 1000, 500)
        pygame.draw.rect(s, (253, 245, 230), cert)
        pygame.draw.rect(s, (212, 175, 55), cert, 15)
        if self.score >= 6:
            t1 = font_big.render("GIẤY CHỨNG NHẬN", True, (139, 69, 19))
            t2 = font_med.render(f"Chúc mừng: {account_system.current_user}", True, BLACK)
            t3 = font_small.render(f"Hoàn thành xuất sắc chương trình! Điểm: {self.score}/10", True, BLACK)
            s.blit(t1, (WIDTH//2-t1.get_width()//2, 180)); s.blit(t2, (WIDTH//2-t2.get_width()//2, 280))
            s.blit(t3, (WIDTH//2-t3.get_width()//2, 380))
            pygame.draw.circle(s, (180, 0, 0), (850, 500), 60, 4)
            s.blit(font_small.render("ĐÃ DUYỆT", True, (180, 0, 0)), (800, 485))
        else:
            msg = font_med.render(f"Bạn cần cố gắng hơn! Điểm của bạn: {self.score}/10", True, (180,0,0))
            s.blit(msg, (WIDTH//2 - msg.get_width()//2, 300))
        gold_msg = load_font(26).render(f"Thưởng: +{self.exam_gold} vàng", True, (170, 130, 30))
        s.blit(gold_msg, (WIDTH // 2 - gold_msg.get_width() // 2, 560))
        self.back_btn.draw(s)
    def handle_event(self, e):
        if e.type == pygame.MOUSEBUTTONDOWN and self.back_btn.clicked(e.pos): manager.change(MenuState())
try:
    import admin_panel
    AdminPanelState = admin_panel.AdminPanelState  # type: ignore[misc]
except ImportError:
    # Fallback if admin_panel is not available
    class AdminPanelState(GameState):
        def draw(self, s):
            draw_text_center(s, "Admin Panel không khả dụng", font_big, RED_BTN, WIDTH//2, HEIGHT//2)
        def handle_event(self, e):
            if e.type == pygame.MOUSEBUTTONDOWN:
                manager.change(MenuState())

# =========================================================
# STATE ENGINE MANAGER
# =========================================================
class StateManager:
    def __init__(self, initial_state):
        self.state: 'GameState' = initial_state
        self.state.enter()
        self.next_state: 'GameState | None' = None
        self.is_transitioning = False
        self.transition_progress = 0.0
        self.transition_type = "PAGE"
        self.warp_fx = HSRWarpEffect()

    def _require_next_state(self) -> 'GameState':
        if self.next_state is None:
            raise RuntimeError("next_state is required during transition")
        return self.next_state

    def process_events(self, event):
        # Chuyển tiếp event cho pygame_gui xử lý
        # Thêm logic xử lý phím bấm riêng của bạn ở đây
        if isinstance(self.state, DefeatState):
            if event.type == pygame.KEYDOWN and event.key == pygame.K_r:
                # Logic reset game khi bấm R (không còn hệ thống "mạng"/lives —
                # học sinh luôn được làm lại thoải mái, không bị trừng phạt)
                self.change(MenuState())
    def handle_event(self, event):
        if not self.is_transitioning and self.state: self.state.handle_event(event)
    def change(self, new_state, transition_type=None):
        pending: 'GameState' = new_state
        # Sử dụng TransitionEffect mới thay vì hệ thống cũ
        if transition_type in ("PAGE", "WARP", "HERTA"):
            # Giữ lại các hiệu ứng cũ cho các trường hợp đặc biệt
            self.transition_type = transition_type
            self.next_state = pending
            pending.enter()
            self.is_transitioning = True
            self.transition_progress = 0.0
        else:
            # Sử dụng TransitionEffect mới cho các chuyển cảnh thông thường
            self.next_state = pending
            pending.enter()
            # Chọn loại hiệu ứng chuyển cảnh
            if isinstance(new_state, LessonState) or isinstance(self.state, LessonState):
                effect_type = "slide_left"  # Slide khi vào bài học
            elif isinstance(new_state, MenuState) or isinstance(self.state, MenuState):
                effect_type = "fade"  # Fade khi vào menu
            else:
                effect_type = "fade"  # Fade mặc định
            # Tạo snapshot của màn hình hiện tại
            current_surface = pygame.Surface((WIDTH, HEIGHT))
            self.state.draw(current_surface)
            # Tạo snapshot của màn hình mới
            next_surface = pygame.Surface((WIDTH, HEIGHT))
            pending.draw(next_surface)
            # Bắt đầu hiệu ứng chuyển cảnh
            transition_effect.effect_type = effect_type
            transition_effect.start(current_surface, next_surface)
            # Chuyển state ngay lập tức (hiệu ứng sẽ được vẽ trên top)
            self.state = pending
            self.next_state = None
    def update(self, dt):
        if self.is_transitioning:
            speed = 1.8 if self.transition_type == "WARP" else 2.5
            self.transition_progress += dt * speed
            if self.transition_progress >= 1.0:
                next_state = self.next_state
                if next_state is not None:
                    self.state = next_state
                self.is_transitioning = False
                self.next_state = None
        else:
            self.state.update(dt)
        # Cập nhật transition_effect
        transition_effect.update(dt)
    def draw(self, surface):
        temp_surf = pygame.Surface((WIDTH, HEIGHT))
        # Vẽ transition effect nếu active
        if transition_effect.active:
            self.state.draw(temp_surf)
            transition_effect.draw(temp_surf)
        elif self.is_transitioning and self.next_state:
            # Sử dụng hệ thống cũ cho các hiệu ứng đặc biệt
            if self.transition_type == "WARP": self._draw_warp_transition(temp_surf)
            elif self.transition_type == "HERTA": self._draw_herta_transition(temp_surf)
            else: self._draw_page_transition(temp_surf)
        else:
            self.state.draw(temp_surf)
        # Global HUD overlay (top bar) for "in game" states
        if account_system.current_user and not isinstance(self.state, (LoginState, RegisterState)):
            draw_top_bar(temp_surf)
        surface.blit(temp_surf, (0, 0))
    def _draw_warp_transition(self, surface):
        p = self.transition_progress; eased_p = p ** 3
        surface.fill((5, 10, 25))
        self.warp_fx.update(16, p)
        self.warp_fx.draw(surface)
        if p < 0.8:
            old_surf = pygame.Surface((WIDTH, HEIGHT))
            self.state.draw(old_surf)
            old_scale = 1.0 - (eased_p * 0.8)
            ow, oh = int(WIDTH * old_scale), int(HEIGHT * old_scale)
            if ow > 1 and oh > 1:
                for i in range(2):
                    blur_scale = old_scale + (i * 0.05)
                    bw, bh = int(WIDTH * blur_scale), int(HEIGHT * blur_scale)
                    b_img = pygame.transform.smoothscale(old_surf, (bw, bh))
                    b_img.set_alpha(int(100 * (1-p)))
                    surface.blit(b_img, (WIDTH//2 - bw//2, HEIGHT//2 - bh//2))
        if p > 0.4:
            new_surf = pygame.Surface((WIDTH, HEIGHT))
            self._require_next_state().draw(new_surf)
            new_p = (p - 0.4) / 0.6
            new_scale = 0.5 + (new_p * 0.5)
            nw, nh = int(WIDTH * new_scale), int(HEIGHT * new_scale)
            new_img = pygame.transform.smoothscale(new_surf, (nw, nh))
            new_img.set_alpha(int(255 * new_p))
            surface.blit(new_img, (WIDTH//2 - nw//2, HEIGHT//2 - nh//2))
        if 0.6 < p < 0.95:
            flash_alpha = (p - 0.6) * 5 * 255 if p < 0.8 else (1 - (p - 0.8) * 6.6) * 255
            flash = pygame.Surface((WIDTH, HEIGHT))
            flash.fill((255, 255, 255))
            flash.set_alpha(max(0, min(255, int(flash_alpha))))
            surface.blit(flash, (0, 0))
    def _draw_herta_transition(self, surface):
        # "Simulated Universe" vibe: star-warp + portal rings + chroma shift + vignette.
        p = self.transition_progress
        eased_in = p ** 2.2
        eased_out = 1 - (1 - p) ** 2.2
        # Base space background + star streaks
        surface.fill((4, 8, 18))
        self.warp_fx.update(16, p)
        self.warp_fx.draw(surface)
        # Render old/new scenes
        old_surf = pygame.Surface((WIDTH, HEIGHT))
        self.state.draw(old_surf)
        new_surf = pygame.Surface((WIDTH, HEIGHT))
        self._require_next_state().draw(new_surf)
        # Old scene collapses into portal
        old_scale = 1.0 - eased_in * 0.55
        ow, oh = int(WIDTH * old_scale), int(HEIGHT * old_scale)
        if ow > 2 and oh > 2:
            old_img = pygame.transform.smoothscale(old_surf, (ow, oh))
            old_img.set_alpha(int(255 * (1 - eased_in)))
            surface.blit(old_img, (WIDTH // 2 - ow // 2, HEIGHT // 2 - oh // 2))
        # New scene emerges from portal
        if p > 0.25:
            np = (p - 0.25) / 0.75
            np = max(0.0, min(1.0, np))
            new_scale = 0.82 + (np ** 1.6) * 0.18
            nw, nh = int(WIDTH * new_scale), int(HEIGHT * new_scale)
            if nw > 2 and nh > 2:
                new_img = pygame.transform.smoothscale(new_surf, (nw, nh))
                new_img.set_alpha(int(255 * np))
                surface.blit(new_img, (WIDTH // 2 - nw // 2, HEIGHT // 2 - nh // 2))
        # Portal rings (additive)
        cx, cy = WIDTH // 2, HEIGHT // 2
        portal = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        base_r = int(min(WIDTH, HEIGHT) * (0.10 + 0.35 * eased_out))
        ring_count = 6
        spin = time.time() * 1.2
        for i in range(ring_count):
            t = i / max(1, ring_count - 1)
            r = int(base_r * (1.0 + t * 1.8))
            a = int(220 * (1 - t) * (0.2 + 0.8 * eased_out))
            col = (80 + int(120 * (1 - t)), 255, 220, max(0, min(255, a)))
            # Slight wobble for "HSR tech" feel
            wob = int(10 * math.sin(spin + i * 1.7) * eased_out)
            pygame.draw.circle(portal, col, (cx + wob, cy), r, width=max(1, int(3 - 2 * t)))
        # Inner glow
        pygame.draw.circle(portal, (120, 255, 240, int(120 * eased_out)), (cx, cy), int(base_r * 0.75))
        surface.blit(portal, (0, 0), special_flags=pygame.BLEND_ADD)
        # Scanlines/glitch streaks
        if p > 0.15:
            streaks = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            num_lines = int(12 + 20 * eased_out)
            for _ in range(num_lines):
                ly = random.randint(0, HEIGHT)
                lw = random.randint(int(WIDTH * 0.4), WIDTH)
                lx = random.randint(-int(WIDTH * 0.2), int(WIDTH * 0.2))
                alpha = random.randint(25, 90)
                pygame.draw.rect(streaks, (0, 255, 220, alpha), (lx, ly, lw, random.randint(2, 5)))
            surface.blit(streaks, (0, 0), special_flags=pygame.BLEND_ADD)
        # Vignette (dark corners) + center emphasis
        vig = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        vig.fill((0, 0, 0, 0))
        # Fake radial by multiple circles
        max_r = int(SCREEN_DIAGONAL)
        steps = 8
        for i in range(steps):
            t = i / (steps - 1)
            r = int(max_r * (0.65 + 0.45 * t))
            alpha = int((40 + 140 * t) * (0.35 + 0.65 * eased_out))
            pygame.draw.circle(vig, (0, 0, 0, min(220, alpha)), (cx, cy), r, width=0)
        surface.blit(vig, (0, 0), special_flags=pygame.BLEND_RGBA_SUB)
        # Final white/teal flash near completion
        if p > 0.86:
            fp = (p - 0.86) / 0.14
            fp = max(0.0, min(1.0, fp))
            flash = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            flash.fill((210, 255, 255, int(180 * fp)))
            surface.blit(flash, (0, 0), special_flags=pygame.BLEND_ADD)
    def _draw_page_transition(self, surface):
        p = self.transition_progress
        old_surf = pygame.Surface((WIDTH, HEIGHT))
        self.state.draw(old_surf)
        new_surf = pygame.Surface((WIDTH, HEIGHT))
        self._require_next_state().draw(new_surf)
        bx, by, bh = 50, 50, 700
        page_w = 580; gap = 40
        left_rect = pygame.Rect(bx, by, page_w, bh)
        right_rect = pygame.Rect(bx + page_w + gap, by, page_w, bh)
        base_surf = old_surf.copy()
        new_right_page = new_surf.subsurface(right_rect).copy()
        base_surf.blit(new_right_page, right_rect.topleft)
        surface.blit(base_surf, (0, 0))
        if p < 0.5:
            local_p = p * 2
            curr_w = int(max(1, page_w * (1 - local_p)))
            turning_page = old_surf.subsurface(right_rect).copy()
            scaled_page = pygame.transform.smoothscale(turning_page, (curr_w, bh))
            draw_x = right_rect.x
            surface.blit(scaled_page, (draw_x, by))
            shadow_w = int(60 * local_p)
            if shadow_w > 0:
                shadow = pygame.Surface((shadow_w, bh), pygame.SRCALPHA)
                for i in range(shadow_w):
                    alpha = int(120 * (1 - i/shadow_w) * local_p)
                    pygame.draw.line(shadow, (0,0,0,alpha), (i, 0), (i, bh))
                surface.blit(shadow, (draw_x + curr_w, by))
            page_shadow = pygame.Surface((curr_w, bh), pygame.SRCALPHA)
            page_shadow.fill((0, 0, 0, int(90 * local_p)))
            surface.blit(page_shadow, (draw_x, by))
        else:
            local_p = (p - 0.5) * 2
            curr_w = int(max(1, page_w * local_p))
            turning_page = new_surf.subsurface(left_rect).copy()
            scaled_page = pygame.transform.smoothscale(turning_page, (curr_w, bh))
            draw_x = left_rect.right - curr_w
            surface.blit(scaled_page, (draw_x, by))
            shadow_w = int(60 * (1 - local_p))
            if shadow_w > 0:
                shadow = pygame.Surface((shadow_w, bh), pygame.SRCALPHA)
                for i in range(shadow_w):
                    alpha = int(120 * (i/shadow_w) * (1 - local_p))
                    pygame.draw.line(shadow, (0,0,0,alpha), (i, 0), (i, bh))
                surface.blit(shadow, (draw_x - shadow_w, by))
            page_shadow = pygame.Surface((curr_w, bh), pygame.SRCALPHA)
            page_shadow.fill((0, 0, 0, int(90 * (1 - local_p))))
            surface.blit(page_shadow, (draw_x, by))

# =========================================================
# MAIN LOOP — stubs, thật sự khởi tạo bên trong async main()
# =========================================================
virtual_surface      = None
manager              = None
global_clover_effect = None
virtual_mouse_pos: tuple[int, int] = (0, 0)

# =========================================================
# VÒNG LẶP CHÍNH — dạng ASYNC để tương thích khi đóng gói lên web bằng pygbag
# (pygame chạy trong trình duyệt qua WebAssembly/Pyodide). "await asyncio.sleep(0)"
# ở cuối mỗi khung hình là bắt buộc: nó nhường quyền điều khiển lại cho vòng lặp
# sự kiện của trình duyệt, nếu thiếu dòng này tab trình duyệt sẽ bị treo/đứng hình.
# Trên desktop (không đóng gói web), asyncio.run(main()) vẫn chạy y hệt vòng lặp
# while cũ — không có gì thay đổi về hành vi hay tốc độ khi chơi trên máy tính.
# =========================================================
async def main():
    global running, screen, GLOBAL_FULLSCREEN, virtual_mouse_pos
    global virtual_surface, manager, global_clover_effect, clock
    global font_big, font_med, font_small, darkness_surface
    global sound_manager, snd_correct, snd_wrong, snd_levelup, snd_victory, snd_defeat
    global background_img, defeat_bg_img, clover_image, setting_img, setting_rect
    global character_img, DEFAULT_CHARACTER_IMG

    _ck("MD_CHECKPOINT: 32 async main() started")
    await asyncio.sleep(0)
    _ck("MD_CHECKPOINT: 32a calling gi.init_display()...")
    try:
        await gi.init_display()
    except Exception as _e:
        _ck(f"MD_CHECKPOINT: 32-ERROR: {_e}")
        raise
    screen         = gi.screen
    clock          = gi.clock
    darkness_surface   = gi.darkness_surface
    font_big       = gi.font_big
    font_med       = gi.font_med
    font_small     = gi.font_small
    background_img     = gi.background_img
    defeat_bg_img      = gi.defeat_bg_img
    clover_image       = gi.clover_image
    setting_img        = gi.setting_img
    setting_rect       = gi.setting_rect
    character_img      = gi.character_img
    DEFAULT_CHARACTER_IMG = gi.DEFAULT_CHARACTER_IMG
    _ck("MD_CHECKPOINT: 32b init_display() done")

    # BƯỚC 2 — init_audio + sound_manager
    _ck("MD_CHECKPOINT: 32c calling gi.init_audio_system()...")
    await gi.init_audio_system()
    sound_manager  = gi.sound_manager
    snd_correct    = gi.snd_correct
    snd_wrong      = gi.snd_wrong
    snd_levelup    = gi.snd_levelup
    snd_victory    = gi.snd_victory
    snd_defeat     = gi.snd_defeat
    _ck("MD_CHECKPOINT: 32d audio done")

    # BƯỚC 3 — virtual_surface, manager, clover effect
    virtual_surface      = pygame.Surface((gi.WIDTH, gi.HEIGHT))
    manager              = StateManager(LoadingState())
    global_clover_effect = FallingCloverEffect(20)
    _ck("MD_CHECKPOINT: 32e StateManager + surfaces created")

    # BƯỚC 4 — inject admin_panel (font_med đã sẵn sàng)
    try:
        admin_panel.inject(  # type: ignore[name-defined]
            account_system=gi.account_system,
            manager=manager,
            MenuState=MenuState,
            font_med=font_med,
            Button=gi.Button,
            GameState=gi.GameState,
            ADMIN_USER=gi.ADMIN_USER,
            ADMIN_PASS=gi.ADMIN_PASS,
            WIDTH=gi.WIDTH,
            YELLOW_BTN=gi.YELLOW_BTN,
            GREEN_BTN=gi.GREEN_BTN,
            ORANGE_BTN=gi.ORANGE_BTN,
            RED_BTN=gi.RED_BTN,
            SHADOW=gi.SHADOW,
            WHITE=gi.WHITE,
        )
        _ck("MD_CHECKPOINT: 32f admin_panel.inject done")
    except Exception as _e:
        _ck(f"MD_CHECKPOINT: 32f admin_panel.inject ERROR (non-fatal): {_e}")

    running = True
    web_audio_unlocked = not IS_WEB_BUILD
    _first_frame = True
    # BUG FIX (pygbag): set_allowed chỉ cần gọi MỘT LẦN trước vòng lặp, không phải
    # mỗi frame — gọi trong loop gây tốn chi phí không cần thiết và có thể gây
    # vấn đề với event queue trên web. pygame.VIDEORESIZE có thể không tồn tại
    # trên một số bản pygame-ce của pygbag nên lấy động bằng getattr.
    _allowed_events = [
        pygame.QUIT, pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN,
        pygame.MOUSEBUTTONUP, pygame.MOUSEMOTION, pygame.MOUSEWHEEL,
    ]
    _videoresize = getattr(pygame, "VIDEORESIZE", None)
    if _videoresize is not None:
        _allowed_events.append(_videoresize)
    pygame.event.set_allowed(_allowed_events)
    while running:
        dt = clock.tick(60) / 1000.0
        if _first_frame:
            _ck("MD_CHECKPOINT: 33 first loop iteration reached")
        # 1. XỬ LÝ SỰ KIỆN (EVENTS)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            # Trên web: chỉ được phép phát nhạc/âm thanh SAU khi có tương tác
            # thật đầu tiên của người dùng (yêu cầu bắt buộc của trình duyệt).
            # Kích hoạt đúng MỘT LẦN ở đây, ngay khi phát hiện tương tác đầu tiên.
            if not web_audio_unlocked and event.type in (pygame.MOUSEBUTTONDOWN, pygame.KEYDOWN):
                web_audio_unlocked = True
                sound_manager.set_bgm("menu")
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_F11 and not IS_WEB_BUILD:
                    GLOBAL_FULLSCREEN = not GLOBAL_FULLSCREEN
                    if GLOBAL_FULLSCREEN:
                        screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.FULLSCREEN | pygame.SCALED)
                    else:
                        screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE | pygame.SCALED)
                        pygame.display.set_caption("MathDrill 5.0")
                    gi.screen = screen
            # Tính toán chuột ảo (Virtual Mouse)
            if event.type in (pygame.MOUSEBUTTONDOWN, pygame.MOUSEBUTTONUP, pygame.MOUSEMOTION):
                sw, sh = screen.get_size()
                scale = min(sw/WIDTH, sh/HEIGHT)
                offset_x = (sw - WIDTH * scale) / 2
                offset_y = (sh - HEIGHT * scale) / 2
                if scale > 0:
                    rx, ry = event.pos
                    vx = max(0, min(WIDTH, (rx - offset_x) / scale))
                    vy = max(0, min(HEIGHT, (ry - offset_y) / scale))
                    # Cập nhật vị trí chuột ảo cho event
                    new_dict = event.dict.copy()
                    if 'pos' in new_dict: new_dict['pos'] = (vx, vy)
                    event = pygame.event.Event(event.type, new_dict)
                    virtual_mouse_pos = (vx, vy)
                    # QUAN TRỌNG: phải gán trực tiếp vào module game_init,
                    # vì Button/CardButton dùng "global virtual_mouse_pos" để đọc
                    # biến trong namespace của game_init, không phải game_main.
                    # Nếu chỉ gán "virtual_mouse_pos = (vx, vy)" ở đây thì chỉ tạo
                    # biến local trong game_main, không cập nhật được giá trị mà
                    # Button thực sự đang đọc -> hiệu ứng hover phóng to/nhỏ sẽ
                    # không hoạt động đúng (đặc biệt khi chuột chưa từng ở (0,0)).
                    game_init.virtual_mouse_pos = (vx, vy)
            manager.handle_event(event)
        # 2. CẬP NHẬT LOGIC (UPDATE) - Chỉ gọi 1 lần
        manager.update(dt)
        if account_system.current_user:
            d = account_system.data()
            d["play_time_seconds"] = int(d.get("play_time_seconds", 0)) + int(dt)
        global_clover_effect.update(dt)
        confetti_sys.update(dt)
        player.update_screen_shake(dt)
        player.update_animations(dt)
        transition.update(dt)
        combo_popup_manager.update(dt)
        # 3. VẼ MÀN HÌNH (DRAWING) - Luôn vẽ lên virtual_surface
        virtual_surface.fill((165, 214, 167))
        manager.draw(virtual_surface)
        confetti_sys.draw(virtual_surface)
        global_clover_effect.draw(virtual_surface)
        # 4. CÁC HIỆU ỨNG ĐẨY LÊN TRÊN (OVERLAYS)
        if gi.achievement_popup:
            gi.achievement_popup.update(dt)
            gi.achievement_popup.draw(virtual_surface)
        # 5. COMBO POPUPS
        combo_popup_manager.draw(virtual_surface)
        # 6. TRANSITION EFFECTS
        transition.draw(virtual_surface)
        # 5. HIỆU ỨNG ĐỘ SÁNG (BRIGHTNESS)
        if GLOBAL_BRIGHTNESS < 1.0:
            darkness_surface.set_alpha(int(255 * (1.0 - GLOBAL_BRIGHTNESS)))
            virtual_surface.blit(darkness_surface, (0, 0))
        # 6. ÁP DỤNG SCREEN SHAKE
        off_x, off_y = player.get_screen_offset()
        # 7. CO GIÃN MÀN HÌNH (SCALING) - Hardware scaling handled by pygame.SCALED
        screen.fill(BLACK)
        screen.blit(virtual_surface, (off_x, off_y))
        pygame.display.flip()
        if _first_frame:
            _ck("MD_CHECKPOINT: 34 first frame RENDERED to screen successfully!")
            _first_frame = False
        # BẮT BUỘC cho web (pygbag): nhường quyền điều khiển lại cho trình duyệt
        # mỗi khung hình. Trên desktop dòng này gần như không tốn chi phí gì.
        await asyncio.sleep(0)
    pygame.quit()

# BUG FIX (pygbag) QUAN TRỌNG: trên web, __name__ KHÔNG phải "__main__" —
# nếu đặt asyncio.run() trong if __name__ == "__main__" thì game sẽ KHÔNG BAO GIỜ
# khởi động trên trình duyệt. Phải gọi ở module level không điều kiện.
# Trên desktop, asyncio.run() hoạt động bình thường theo cách này.
asyncio.run(main())