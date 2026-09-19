# =========================================================
# effects.py — Hiệu ứng hình ảnh dùng chung trong toàn bộ game
# (particles, pháo hoa, chuyển cảnh giữa các màn hình).
# =========================================================
# Được TÁCH RIÊNG khỏi game_main.py (bước đầu tiên của việc module hoá) vì các
# class trong file này KHÔNG phụ thuộc vào bất kỳ GameState nào khác — chúng
# không gọi manager.change(), không tham chiếu chéo tới màn hình khác, nên an
# toàn để tách thành file độc lập mà không gặp rủi ro circular import.
#
# game_main.py import ngược lại từ đây:
#   from effects import (ConfettiParticle, ConfettiSystem, confetti_sys,
#                         FireworkParticle, Firework, StarParticle,
#                         SparkParticle, WrongParticle, AnswerEffectSystem,
#                         answer_effects, TransitionEffect, transition_effect)
# =========================================================
import random
import math
import pygame

from game_init import WIDTH, HEIGHT
from performance_utils import GLOBAL_MAX_PARTICLES, ParticleBudget


class ConfettiParticle:
    """Hạt giấy nổ khi trả lời đúng"""
    # Cache surface GỐC (chưa xoay) dùng CHUNG cho mọi hạt cùng (size, color) —
    # trước đây mỗi hạt tự tạo pygame.Surface() + vẽ rect MỚI ở MỌI khung hình,
    # dù chỉ có tối đa vài chục tổ hợp (size, color) khác nhau trong cả game.
    # Giờ chỉ tạo 1 lần/tổ hợp, các khung hình sau chỉ set_alpha() + xoay (rẻ hơn nhiều).
    _BASE_SURF_CACHE = {}
    def __init__(self, x, y):
        self.reset(x, y)
    def reset(self, x, y):
        self.x = x; self.y = y
        self.vx = random.uniform(-200, 200)
        self.vy = random.uniform(-300, -100)
        self.color = random.choice([(255,0,0), (0,255,0), (0,0,255), (255,255,0), (255,165,0)])
        self.size = random.randint(3, 8)
        self.lifetime = random.uniform(1.5, 3.0)
        self.life = self.lifetime
        self.rotation = random.uniform(-720, 720)
        self.gravity = 500
        self.active = True
    def update(self, dt):
        self.x += self.vx * dt; self.y += self.vy * dt
        self.vy += self.gravity * dt; self.lifetime -= dt; self.life = self.lifetime
        self.rotation += self.rotation * dt
        if self.lifetime <= 0: self.active = False
    @classmethod
    def _get_base_surface(cls, size, color):
        key = (size, color)
        surf = cls._BASE_SURF_CACHE.get(key)
        if surf is None:
            try:
                surf = pygame.Surface((size, size), pygame.SRCALPHA)
                pygame.draw.rect(surf, (*color, 255), (0, 0, size, size))
                cls._BASE_SURF_CACHE[key] = surf
            except Exception:
                return None
        return surf
    def draw(self, surface):
        if not self.active: return
        alpha = max(0, min(255, int(255 * (self.lifetime / 3.0))))
        size = self.size * 2
        base = self._get_base_surface(size, self.color)
        if base is None: return
        base.set_alpha(alpha)
        rotated = pygame.transform.rotate(base, self.rotation)
        rect = rotated.get_rect(center=(int(self.x), int(self.y)))
        surface.blit(rotated, rect)
class ConfettiSystem:
    MAX_PARTICLES = GLOBAL_MAX_PARTICLES
    def __init__(self):
        self.particles = []; self.inactive_particles = []
    def explode(self, x, y, count=30):
        available_slots = min(self.MAX_PARTICLES - len(self.particles), ParticleBudget.available())
        if available_slots <= 0: return
        count = min(count, available_slots)
        ParticleBudget.request(count)
        for _ in range(count):
            if self.inactive_particles:
                particle = self.inactive_particles.pop()
                particle.reset(x, y); self.particles.append(particle)
            else:
                self.particles.append(ConfettiParticle(x, y))
    def update(self, dt):
        i = 0
        while i < len(self.particles):
            particle = self.particles[i]; particle.update(dt)
            if particle.lifetime <= 0:
                self.particles.pop(i); self.inactive_particles.append(particle)
                ParticleBudget.release(1)
            else: i += 1
    def draw(self, surface):
        for p in self.particles: p.draw(surface)
    def clear(self):
        n = len(self.particles)
        self.particles.clear(); self.inactive_particles.clear()
        if n: ParticleBudget.release(n)
confetti_sys = ConfettiSystem()
# Sync sang game_init để FeedbackOverlay dùng chung instance
try:
    import game_init
    game_init.confetti_sys = confetti_sys
except Exception:
    pass


class FireworkParticle:
    """Hạt pháo hoa cho Victory screen"""
    def __init__(self, x, y, color):
        self.x = x
        self.y = y
        self.color = color
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(2, 6)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.life = random.uniform(1.0, 2.0)
        self.lifetime = self.life # Thêm alias để tương thích
        self.gravity = 0.1
        self.size = random.randint(2, 4)
    def update(self, dt):
        self.x += self.vx
        self.y += self.vy
        self.vy += self.gravity
        self.life -= dt
        self.lifetime = self.life # Đồng bộ hai thuộc tính
    def draw(self, surface):
        if self.life > 0:
            alpha = int(min(255, self.life * 255))
            pygame.draw.circle(surface, (*self.color, alpha), (int(self.x), int(self.y)), self.size)
class Firework:
    def __init__(self, x, y):
        self.particles = []
        color = random.choice([(255, 50, 50), (50, 255, 50), (50, 50, 255), (255, 255, 50), (255, 255, 255), (255, 100, 255)])
        for _ in range(40):
            self.particles.append(FireworkParticle(x, y, color))
    def update(self, dt):
        for p in self.particles[:]:
            p.update(dt)
            # Defensive checking: sử dụng cả hai thuộc tính và kiểm tra tồn tại
            remaining = getattr(p, 'lifetime', getattr(p, 'life', 0))
            if remaining <= 0:
                self.particles.remove(p)
    def draw(self, surface):
        for p in self.particles:
            p.draw(surface)
class StarParticle:
    """Ngôi sao bay ra khi trả lời đúng"""
    def __init__(self, x, y):
        self.x = x
        self.y = y
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(3, 8)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.color = random.choice([(200, 200, 0), (200, 160, 0), (200, 120, 0), (200, 200, 80)])
        self.size = random.randint(5, 12)
        self.life = random.uniform(0.8, 1.5)
        self.lifetime = self.life # Thêm alias để tương thích
        self.rotation = random.uniform(0, 360)
        self.rot_speed = random.uniform(-5, 5)
        self.gravity = 0.15
    def update(self, dt):
        self.x += self.vx * dt * 60
        self.y += self.vy * dt * 60
        self.vy += self.gravity * dt * 60
        self.life -= dt
        self.lifetime = self.life # Đồng bộ
        self.rotation += self.rot_speed * dt * 60
    def draw(self, surface):
        if self.life > 0:
            alpha = int(min(255, self.life * 300))
            star_surf = pygame.Surface((self.size * 2, self.size * 2), pygame.SRCALPHA)
            # Vẽ ngôi sao
            points = []
            for i in range(10):
                angle = (i * 36 + self.rotation) * math.pi / 180
                radius = self.size if i % 2 == 0 else self.size / 2
                px = self.size + math.cos(angle) * radius
                py = self.size + math.sin(angle) * radius
                points.append((px, py))
            pygame.draw.polygon(star_surf, (*self.color, alpha), points)
            surface.blit(star_surf, (int(self.x - self.size), int(self.y - self.size)))
class SparkParticle:
    """Tia lửa khi trả lời đúng (hiệu ứng bùng nổ)"""
    def __init__(self, x, y):
        self.x = x
        self.y = y
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(5, 12)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.color = random.choice([(255, 255, 255), (255, 200, 100), (255, 150, 50)])
        self.size = random.randint(2, 5)
        self.life = random.uniform(0.3, 0.8)
        self.lifetime = self.life # Thêm alias để tương thích
        self.gravity = 0.3
    def update(self, dt):
        self.x += self.vx * dt * 60
        self.y += self.vy * dt * 60
        self.vy += self.gravity * dt * 60
        self.life -= dt
        self.lifetime = self.life # Đồng bộ
    def draw(self, surface):
        if self.life > 0:
            alpha = int(min(255, self.life * 400))
            spark_surf = pygame.Surface((self.size * 2, self.size * 2), pygame.SRCALPHA)
            pygame.draw.circle(spark_surf, (*self.color, alpha), (self.size, self.size), self.size)
            surface.blit(spark_surf, (int(self.x - self.size), int(self.y - self.size)))
class WrongParticle:
    """Hiệu ứng X đỏ khi trả lời sai"""
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.size = 0
        self.max_size = 60
        self.life = 0.5
        self.lifetime = self.life # Thêm alias
        self.color = (255, 50, 50)
        self.thickness = 5
    def update(self, dt):
        self.size = min(self.max_size, self.size + dt * 200)
        self.life -= dt
        self.lifetime = self.life # Đồng bộ
    def draw(self, surface):
        if self.life > 0:
            alpha = int(min(255, self.life * 500))
            surf = pygame.Surface((self.max_size * 2, self.max_size * 2), pygame.SRCALPHA)
            center = self.max_size
            # Vẽ dấu X
            line_length = self.size * 0.7
            pygame.draw.line(surf, (*self.color, alpha),
                           (center - line_length, center - line_length),
                           (center + line_length, center + line_length),
                           self.thickness)
            pygame.draw.line(surf, (*self.color, alpha),
                           (center + line_length, center - line_length),
                           (center - line_length, center + line_length),
                           self.thickness)
            surface.blit(surf, (int(self.x - self.max_size), int(self.y - self.max_size)))
class AnswerEffectSystem:
    """Hệ thống hiệu ứng khi trả lời câu hỏi"""
    MAX_PARTICLES = min(80, GLOBAL_MAX_PARTICLES // 2)
    def __init__(self):
        self.particles = []
        self.active = False
    def trigger_correct(self, x, y):
        """Kích hoạt hiệu ứng khi trả lời đúng"""
        # Giới hạn số lượng particle mới
        available_slots = self.MAX_PARTICLES - len(self.particles)
        if available_slots <= 0:
            return
        # Thêm các ngôi sao (giới hạn theo available slots)
        star_count = min(15, available_slots // 3)
        for _ in range(star_count):
            self.particles.append(StarParticle(x, y))
        # Thêm các tia lửa
        spark_count = min(20, available_slots // 2)
        for _ in range(spark_count):
            self.particles.append(SparkParticle(x, y))
        # Thêm confetti
        confetti_count = min(10, available_slots - star_count - spark_count)
        for _ in range(confetti_count):
            self.particles.append(ConfettiParticle(x, y))
        self.active = True
    def trigger_wrong(self, x, y):
        """Kích hoạt hiệu ứng khi trả lời sai"""
        available_slots = self.MAX_PARTICLES - len(self.particles)
        wrong_count = min(3, available_slots)
        for _ in range(wrong_count):
            self.particles.append(WrongParticle(x, y))
        self.active = True
    def update(self, dt):
        for p in self.particles[:]:
            p.update(dt)
            # Handle both 'life' and 'lifetime' attributes
            life_value = getattr(p, 'life', getattr(p, 'lifetime', 1))
            if life_value <= 0:
                self.particles.remove(p)
        if not self.particles:
            self.active = False
    def draw(self, surface):
        for p in self.particles:
            p.draw(surface)
answer_effects = AnswerEffectSystem()
class TransitionEffect:
    """Hệ thống hiệu ứng chuyển cảnh giữa các màn hình"""
    def __init__(self, effect_type="fade"):
        self.effect_type = effect_type  # "fade", "slide_left", "slide_right", "blur"
        self.progress = 0.0
        self.duration = 0.5  # seconds
        self.active = False
        self.from_surface = None
        self.to_surface = None
    def start(self, from_surface, to_surface):
        """Bắt đầu hiệu ứng chuyển cảnh"""
        self.from_surface = from_surface.copy()
        self.to_surface = to_surface.copy()
        self.progress = 0.0
        self.active = True
    def update(self, dt):
        if self.active:
            self.progress += dt / self.duration
            if self.progress >= 1.0:
                self.progress = 1.0
                self.active = False
    def draw(self, surface):
        if not self.active:
            return
        if self.effect_type == "fade":
            # Fade out from surface, fade in to surface
            alpha = int(self.progress * 255)
            surface.blit(self.to_surface, (0, 0))
            fade_surf = self.from_surface.copy()  # type: ignore[union-attr]
            fade_surf.set_alpha(255 - alpha)
            surface.blit(fade_surf, (0, 0))
        elif self.effect_type == "slide_left":
            # Slide from surface đi sang trái, to surface trượt vào từ phải
            offset = int(WIDTH * (1 - self.progress))
            surface.blit(self.to_surface, (offset - WIDTH, 0))
            surface.blit(self.from_surface, (offset, 0))
        elif self.effect_type == "slide_right":
            # Slide from surface đi sang phải, to surface trượt vào từ trái
            offset = int(WIDTH * (1 - self.progress))
            surface.blit(self.to_surface, (WIDTH - offset, 0))
            surface.blit(self.from_surface, (-offset, 0))
        elif self.effect_type == "blur":
            # Blur effect - chuyển từ mờ đến rõ
            blur_amount = int(10 * (1 - self.progress))
            if blur_amount > 0:
                # Apply blur to from surface
                blurred = pygame.transform.smoothscale(self.from_surface,  # type: ignore[arg-type]
                                                     (WIDTH // (blur_amount + 1), HEIGHT // (blur_amount + 1)))
                blurred = pygame.transform.smoothscale(blurred, (WIDTH, HEIGHT))
                surface.blit(blurred, (0, 0))
            else:
                surface.blit(self.to_surface, (0, 0))
transition_effect = TransitionEffect("fade")
