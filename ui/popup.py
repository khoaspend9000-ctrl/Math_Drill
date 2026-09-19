# =========================================================
# UI POPUP COMPONENT - Optimized popup system
# =========================================================

import pygame
import math
import time
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from config import *
    from asset_manager import asset_manager
    from game_state import game_state
    from particle_system import particle_system
    from popup_manager import popup_manager
except ImportError:
    # Direct execution fallback
    from config import *
    from asset_manager import asset_manager
    from game_state import game_state
    from particle_system import particle_system
    from popup_manager import popup_manager

class Popup:
    """Base popup class with animations"""
    def __init__(self, width, height, title=""):
        self.width = width
        self.height = height
        self.title = title
        
        # Position (centered)
        self.x = WIDTH // 2 - width // 2
        self.y = HEIGHT // 2 - height // 2
        self.rect = pygame.Rect(self.x, self.y, width, height)
        
        # Animation state
        self.alpha = 0
        self.scale = 0.5
        self.opening = True
        self.closing = False
        self.active = True
        
        # Timing
        self.open_time = 0.3
        self.close_time = 0.2
        self.timer = 0
        
        # Cache surfaces
        self._background_surface = None
        self._title_surface = None
        
    def update(self, dt):
        """Update popup animation"""
        self.timer += dt
        
        if self.opening:
            # Opening animation
            progress = min(1.0, self.timer / self.open_time)
            self.alpha = int(255 * progress)
            self.scale = 0.5 + 0.5 * progress
            
            if progress >= 1.0:
                self.opening = False
                
        elif self.closing:
            # Closing animation
            progress = min(1.0, self.timer / self.close_time)
            self.alpha = int(255 * (1 - progress))
            self.scale = 1.0 - 0.5 * progress
            
            if progress >= 1.0:
                self.active = False
                
    def draw(self, surface):
        """Draw popup with effects"""
        if not self.active or self.alpha <= 0:
            return
            
        # Create scaled surface
        popup_surface = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        
        # Draw background
        self._draw_background(popup_surface)
        
        # Draw title
        if self.title:
            self._draw_title(popup_surface)
            
        # Draw content
        self._draw_content(popup_surface)
        
        # Apply scale and alpha
        if self.scale != 1.0:
            scaled_width = int(self.width * self.scale)
            scaled_height = int(self.height * self.scale)
            popup_surface = pygame.transform.smoothscale(popup_surface, (scaled_width, scaled_height))
            
        popup_surface.set_alpha(self.alpha)
        
        # Draw to main surface
        popup_rect = popup_surface.get_rect(center=(WIDTH // 2, HEIGHT // 2))
        surface.blit(popup_surface, popup_rect)
        
    def _draw_background(self, surface):
        """Draw popup background"""
        # Main background
        pygame.draw.rect(surface, WHITE, (0, 0, self.width, self.height), border_radius=15)
        pygame.draw.rect(surface, BLACK, (0, 0, self.width, self.height), 3, border_radius=15)
        
        # Title bar
        pygame.draw.rect(surface, (100, 100, 200), (0, 0, self.width, 40), border_radius=15)
        pygame.draw.rect(surface, BLACK, (0, 0, self.width, 40), 2, border_radius=15)
        
    def _draw_title(self, surface):
        """Draw popup title"""
        title_font = asset_manager.load_font(24)
        title_surface = asset_manager.render_text(title_font, self.title, WHITE)
        title_rect = title_surface.get_rect(center=(self.width // 2, 20))
        surface.blit(title_surface, title_rect)
        
    def _draw_content(self, surface):
        """Override in subclasses"""
        pass
        
    def close(self):
        """Start closing animation"""
        if not self.closing:
            self.closing = True
            self.timer = 0

class AchievementPopup(Popup):
    """Achievement unlock popup with effects"""
    def __init__(self, achievement_key, achievement_data):
        super().__init__(400, 200, achievement_data.get("name", "Achievement"))
        self.achievement_key = achievement_key
        self.achievement_data = achievement_data
        self.particle_timer = 0
        
    def _draw_content(self, surface):
        """Draw achievement content"""
        # Icon
        icon_font = asset_manager.load_font(48)
        icon_text = self.achievement_data.get("icon", "🏆")
        icon_surface = asset_manager.render_text(icon_font, icon_text, (255, 215, 0))
        icon_rect = icon_surface.get_rect(center=(self.width // 2, 80))
        surface.blit(icon_surface, icon_rect)
        
        # Description
        desc_font = asset_manager.load_font(18)
        desc_text = self.achievement_data.get("desc", "")
        if len(desc_text) > 40:
            desc_text = desc_text[:37] + "..."
        desc_surface = asset_manager.render_text(desc_font, desc_text, BLACK)
        desc_rect = desc_surface.get_rect(center=(self.width // 2, 140))
        surface.blit(desc_surface, desc_rect)
        
        # XP reward
        xp_reward = self.achievement_data.get("xp", 0)
        if xp_reward > 0:
            xp_font = asset_manager.load_font(16)
            xp_text = f"+{xp_reward} XP"
            xp_surface = asset_manager.render_text(xp_font, xp_text, (0, 200, 0))
            xp_rect = xp_surface.get_rect(center=(self.width // 2, 170))
            surface.blit(xp_surface, xp_rect)
            
    def update(self, dt):
        """Update with particle effects"""
        super().update(dt)
        
        # Emit particles periodically
        self.particle_timer += dt
        if self.particle_timer > 0.1 and not self.closing:
            particle_system.emit("confetti", WIDTH // 2, HEIGHT // 2, count=2)
            self.particle_timer = 0

class ConfirmationPopup(Popup):
    """Yes/No confirmation popup"""
    def __init__(self, message, callback_yes=None, callback_no=None):
        super().__init__(350, 150, "Xác nhận")
        self.message = message
        self.callback_yes = callback_yes
        self.callback_no = callback_no
        
        # Buttons
        button_width = 100
        button_height = 35
        button_spacing = 20
        start_x = (self.width - (button_width * 2 + button_spacing)) // 2
        
        self.yes_button = Button(
            start_x, self.height - 50, button_width, button_height,
            "Có", GREEN_BTN
        )
        self.no_button = Button(
            start_x + button_width + button_spacing, self.height - 50,
            button_width, button_height, "Không", RED_BTN
        )
        
    def _draw_content(self, surface):
        """Draw confirmation message"""
        # Message
        msg_font = asset_manager.load_font(18)
        msg_surface = asset_manager.render_text(msg_font, self.message, BLACK)
        msg_rect = msg_surface.get_rect(center=(self.width // 2, 70))
        surface.blit(msg_surface, msg_rect)
        
        # Buttons
        self.yes_button.draw(surface)
        self.no_button.draw(surface)
        
    def handle_event(self, event):
        """Handle button clicks"""
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.yes_button.update(event.pos, True):
                self.close()
                if self.callback_yes:
                    self.callback_yes()
                return True
            elif self.no_button.update(event.pos, True):
                self.close()
                if self.callback_no:
                    self.callback_no()
                return True
        elif event.type == pygame.MOUSEMOTION:
            self.yes_button.update(event.pos, False)
            self.no_button.update(event.pos, False)
            
        return False

class InfoPopup(Popup):
    """Information popup with auto-close"""
    def __init__(self, title, message, duration=3.0):
        super().__init__(400, 150, title)
        self.message = message
        self.duration = duration
        self.auto_close = True
        
    def _draw_content(self, surface):
        """Draw info message"""
        msg_font = asset_manager.load_font(18)
        
        # Word wrap for long messages
        words = self.message.split(' ')
        lines = []
        current_line = ""
        
        for word in words:
            test_line = current_line + word + " "
            if msg_font.size(test_line)[0] < self.width - 40:
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word + " "
        lines.append(current_line)
        
        # Draw lines
        y_offset = 70
        for line in lines:
            line_surface = asset_manager.render_text(msg_font, line.strip(), BLACK)
            line_rect = line_surface.get_rect(center=(self.width // 2, y_offset))
            surface.blit(line_surface, line_rect)
            y_offset += 25
            
    def update(self, dt):
        """Update with auto-close"""
        super().update(dt)
        
        if self.auto_close and not self.opening and not self.closing:
            self.duration -= dt
            if self.duration <= 0:
                self.close()
