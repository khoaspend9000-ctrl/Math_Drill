# admin_panel.py
# =========================================================
# MODULE ADMIN – Tách riêng khỏi file chính
# Import file này trong game_main.py:
#   from admin_panel import AdminPanelState, is_admin, admin_login
# =========================================================
# Các symbol cần từ file chính (được inject khi import):
#   account_system, manager, MenuState, font_med,
#   Button, GameState, pygame,
#   ADMIN_USER, ADMIN_PASS, WIDTH, YELLOW_BTN, GREEN_BTN,
#   ORANGE_BTN, RED_BTN, SHADOW, WHITE
# =========================================================
"""
admin_panel.py – Toàn bộ logic Admin của MathDrill 5.0.

Chức năng:
  - is_admin()            : kiểm tra user hiện tại có phải admin
  - admin_login()         : xác thực đăng nhập admin (dùng trong LoginState)
  - AdminPanelState       : màn hình quản lý người chơi
  - AdminAccountMixin     : các method admin trên AccountSystem
                            (lock_user, reset_user, set_max, change_grade)

Cách tích hợp:
  1. Đặt file này cùng thư mục với file game chính.
  2. Thêm ở đầu file chính:
       from admin_panel import (AdminPanelState, is_admin,
                                admin_login, AdminAccountMixin)
  3. Xoá class AdminPanelState khỏi file chính.
  4. Trong AccountSystem thêm AdminAccountMixin vào kế thừa:
       class AccountSystem(AdminAccountMixin): ...
     rồi xoá các method lock_user, reset_user, set_max, change_grade
     khỏi AccountSystem gốc.
"""

from __future__ import annotations
import datetime
import pygame

# ── Các symbol được inject từ file chính ──────────────────
# (sẽ được gán tự động khi module này được import sau khi
#  file chính đã khởi tạo xong)
_ctx: dict = {}          # {"account_system":…, "manager":…, …}

def _g(name):
    """Lấy symbol từ context (tránh import vòng)."""
    return _ctx[name]

def inject(**kwargs):
    """
    Gọi một lần ở cuối file chính, sau khi mọi singleton đã sẵn sàng:
        import admin_panel
        admin_panel.inject(
            account_system=account_system,
            manager=manager,
            MenuState=MenuState,
            font_med=font_med,
            Button=Button,
            GameState=GameState,
            ADMIN_USER=ADMIN_USER,
            ADMIN_PASS=ADMIN_PASS,
            WIDTH=WIDTH,
            YELLOW_BTN=YELLOW_BTN,
            GREEN_BTN=GREEN_BTN,
            ORANGE_BTN=ORANGE_BTN,
            RED_BTN=RED_BTN,
            SHADOW=SHADOW,
            WHITE=WHITE,
        )
    """
    _ctx.update(kwargs)


# =========================================================
# HELPERS
# =========================================================

def is_admin() -> bool:
    """Trả về True nếu user hiện tại là Admin."""
    return _g("account_system").current_user == _g("ADMIN_USER")


def admin_login(username: str, password: str) -> bool:
    """
    Kiểm tra thông tin đăng nhập admin.
    Trả về True nếu đúng, False nếu không phải admin hoặc sai mật khẩu.
    Dùng trong LoginState.login_action().
    """
    return username == _g("ADMIN_USER") and password == _g("ADMIN_PASS")


# =========================================================
# ADMIN MIXIN – thêm vào AccountSystem
# =========================================================

class AdminAccountMixin:
    """
    Mixin chứa các method quản trị của AccountSystem.
    Thêm vào kế thừa:  class AccountSystem(AdminAccountMixin): ...
    """

    def lock_user(self, username: str) -> None:
        """Khóa tài khoản người dùng."""
        self.accounts[username]["status"]    = "locked"
        self.accounts[username]["lock_date"] = (
            datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
        )
        self.save()

    def reset_user(self, username: str) -> None:
        """Reset dữ liệu người dùng về mặc định."""
        self.accounts[username]["data"] = {"grade": 1, "level": 1, "xp": 0}
        self.save()

    def change_grade(self, username: str, new_grade: int) -> None:
        """Thay đổi lớp học của người dùng (1–5)."""
        if username in self.accounts and 1 <= new_grade <= 5:
            self.accounts[username].setdefault("data", {})["grade"] = new_grade
            self.save()

    def set_max(self, username: str) -> None:
        """Set level/XP tối đa cho người dùng."""
        d = self.accounts[username].setdefault("data", {})
        d["level"], d["xp"] = 9999, 9800
        self.save()


# =========================================================
# ADMIN PANEL STATE
# =========================================================

class AdminPanelState:
    """
    Màn hình quản lý người chơi dành cho Admin.

    Chức năng:
      - Xem danh sách tất cả người dùng (tên, lớp, cấp, XP)
      - Nút ⭐ MAX  : set level/XP tối đa cho user
      - Nút 🔒 KHÓA: khóa tài khoản user
      - Nút 🔄 RESET: reset dữ liệu user về mặc định
      - Scroll danh sách bằng chuột
    """

    def __init__(self) -> None:
        Button    = _g("Button")
        RED_BTN   = _g("RED_BTN")
        self.back_btn   = Button(20, 20, 150, 50, "⬅️ QUAY LẠI", RED_BTN)
        self.scroll_y   = 0
        self.action_btns: list = []

    def enter(self) -> None:
        """Khởi tạo khi vào màn hình Admin."""
        self.scroll_y = 0
        self.action_btns = []

    # ── Events ──────────────────────────────────────────────
    def handle_event(self, e: pygame.event.Event) -> None:
        account_system = _g("account_system")
        manager        = _g("manager")
        MenuState      = _g("MenuState")

        if e.type == pygame.MOUSEWHEEL:
            self.scroll_y = min(0, self.scroll_y + e.y * 30)

        if e.type == pygame.MOUSEBUTTONDOWN:
            if self.back_btn.clicked(e.pos):
                manager.change(MenuState())
                return
            for btn, action, username in self.action_btns:
                if btn.clicked(e.pos):
                    if action == "lock":
                        account_system.lock_user(username)
                    elif action == "max":
                        account_system.set_max(username)
                    elif action == "reset":
                        account_system.reset_user(username)

    def update(self, dt: float) -> None:
        pass

    # ── Draw ────────────────────────────────────────────────
    def draw(self, s: pygame.Surface) -> None:
        account_system = _g("account_system")
        ADMIN_USER  = _g("ADMIN_USER")
        font_med    = _g("font_med")
        Button      = _g("Button")
        WIDTH       = _g("WIDTH")
        YELLOW_BTN  = _g("YELLOW_BTN")
        GREEN_BTN   = _g("GREEN_BTN")
        ORANGE_BTN  = _g("ORANGE_BTN")
        RED_BTN     = _g("RED_BTN")
        SHADOW      = _g("SHADOW")
        WHITE       = _g("WHITE")

        s.fill((30, 30, 50))
        self.back_btn.draw(s)

        # Header
        headers = [
            ("Người chơi", 100),
            ("Lớp",        500),
            ("Cấp",        700),
            ("XP",         900),
        ]
        for text, x in headers:
            s.blit(font_med.render(text, True, YELLOW_BTN), (x, 100))
        pygame.draw.line(s, WHITE, (50, 140), (WIDTH - 50, 140), 2)

        # User rows
        self.action_btns = []
        y = 160 + self.scroll_y
        for username, user_obj in account_system.accounts.items():
            if username == ADMIN_USER:
                continue
            u_data = user_obj.get("data", {})
            s.blit(font_med.render(str(username),                    True, WHITE),      (120, y))
            s.blit(font_med.render(str(u_data.get("grade",  1)),     True, WHITE),      (510, y))
            s.blit(font_med.render(str(u_data.get("level",  1)),     True, GREEN_BTN),  (710, y))
            s.blit(font_med.render(str(u_data.get("xp",     0)),     True, YELLOW_BTN), (910, y))

            btns_cfg = [
                (1050, "⭐ MAX",   ORANGE_BTN, "max"),
                (1110, "🔒 KHÓA", RED_BTN,    "lock"),
                (1170, "🔄 RESET", SHADOW,     "reset"),
            ]
            for bx, txt, col, act in btns_cfg:
                b = Button(bx, y - 5, 50, 35, txt, col)
                b.draw(s)
                self.action_btns.append((b, act, username))

            pygame.draw.line(s, SHADOW, (100, y + 45), (WIDTH - 100, y + 45))
            y += 60
