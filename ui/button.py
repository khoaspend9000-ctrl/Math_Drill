# =========================================================
# UI BUTTON COMPONENT - Optimized and reusable
# =========================================================

import pygame
# Handle both package and direct execution
try:
    from ..config import *
    from ..asset_manager import asset_manager
    from ..game_state import game_state
except ImportError:
    # Direct execution fallback
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from config import *
    from asset_manager import asset_manager
    from game_state import game_state

class Button:
    """Enhanced button component with hover effects and caching"""
    def __init__(self, x, y, width, height, text, color, text_color=WHITE, font_size=20):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.color = color
        self.text_color = text_color
        self.font_size = font_size
        
        # State
        self.hovered = False
        self.clicked = False
        self.enabled = True
        
        # Cache key for text rendering
        self._cache_key = None
        self._text_surface = None
        self._hover_surface = None
        
        # Load font once
        self.font = asset_manager.load_font(font_size)
        
    def update(self, mouse_pos, mouse_click):
        """Update button state"""
        if not self.enabled:
            self.hovered = False
            self.clicked = False
            return False
            
        was_hovered = self.hovered
        self.hovered = self.rect.collidepoint(mouse_pos)
        
        # Handle click
        self.clicked = False
        if self.hovered and mouse_click and not was_hovered:
            self.clicked = True
            return True
            
        return False
        
    def draw(self, surface):
        """Draw button with optimized rendering"""
        if not self.enabled:
            color = SHADOW
        elif self.hovered:
            color = tuple(min(255, c + 30) for c in self.color)
        else:
            color = self.color
            
        # Draw button background
        pygame.draw.rect(surface, color, self.rect, border_radius=8)
        pygame.draw.rect(surface, WHITE, self.rect, 2, border_radius=8)
        
        # Draw text with caching
        self._draw_cached_text(surface)
        
    def _draw_cached_text(self, surface):
        """Draw text with caching optimization"""
        cache_key = (self.text, self.text_color, self.font_size)
        
        if self._cache_key != cache_key:
            self._text_surface = asset_manager.render_text(self.font, self.text, self.text_color)
            self._cache_key = cache_key
            
        if self._text_surface:
            text_rect = self._text_surface.get_rect(center=self.rect.center)
            surface.blit(self._text_surface, text_rect)
            
    def set_enabled(self, enabled):
        """Enable/disable button"""
        self.enabled = enabled
        
    def set_text(self, text):
        """Update button text"""
        if self.text != text:
            self.text = text
            self._cache_key = None  # Force cache refresh

class CardButton(Button):
    """Enhanced button for cards with icon support"""
    def __init__(self, x, y, width, height, icon, title, subtitle, color, accent_color):
        super().__init__(x, y, width, height, "", color)
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.accent_color = accent_color
        
        # Load icon font
        self.icon_font = asset_manager.load_font(24)
        
    def draw(self, surface):
        """Draw card button with icon and text"""
        if not self.enabled:
            color = SHADOW
            accent = SHADOW
        elif self.hovered:
            color = tuple(min(255, c + 30) for c in self.color)
            accent = tuple(min(255, c + 50) for c in self.accent_color)
        else:
            color = self.color
            accent = self.accent_color
            
        # Draw card background
        pygame.draw.rect(surface, color, self.rect, border_radius=12)
        pygame.draw.rect(surface, accent, self.rect, 3, border_radius=12)
        
        # Draw icon
        if self.icon:
            icon_surface = asset_manager.render_text(self.icon_font, self.icon, WHITE)
            icon_rect = icon_surface.get_rect(midleft=(self.rect.x + 15, self.rect.centery))
            surface.blit(icon_surface, icon_rect)
            
        # Draw title
        title_surface = asset_manager.render_text(self.font, self.title, WHITE)
        title_rect = title_surface.get_rect(midleft=(self.rect.x + 50, self.rect.centery - 10))
        surface.blit(title_surface, title_rect)
        
        # Draw subtitle
        if self.subtitle:
            subtitle_font = asset_manager.load_font(16)
            subtitle_surface = asset_manager.render_text(subtitle_font, self.subtitle, (200, 200, 200))
            subtitle_rect = subtitle_surface.get_rect(midleft=(self.rect.x + 50, self.rect.centery + 10))
            surface.blit(subtitle_surface, subtitle_rect)

class IconButton(Button):
    """Button with icon support"""
    def __init__(self, x, y, size, icon, tooltip="", color=GRAY):
        super().__init__(x, y, size, size, "", color)
        self.icon = icon
        self.tooltip = tooltip
        self.icon_font = asset_manager.load_font(size // 2)
        
    def draw(self, surface):
        """Draw icon button"""
        if not self.enabled:
            color = SHADOW
        elif self.hovered:
            color = tuple(min(255, c + 50) for c in self.color)
        else:
            color = self.color
            
        # Draw circular button
        pygame.draw.circle(surface, color, self.rect.center, self.rect.width // 2)
        pygame.draw.circle(surface, WHITE, self.rect.center, self.rect.width // 2, 2)
        
        # Draw icon
        if self.icon:
            icon_surface = asset_manager.render_text(self.icon_font, self.icon, WHITE)
            icon_rect = icon_surface.get_rect(center=self.rect.center)
            surface.blit(icon_surface, icon_rect)
            
        # Draw tooltip on hover
        if self.hovered and self.tooltip:
            self._draw_tooltip(surface)
            
    def _draw_tooltip(self, surface):
        """Draw tooltip text"""
        tooltip_font = asset_manager.load_font(14)
        tooltip_surface = asset_manager.render_text(tooltip_font, self.tooltip, BLACK)
        
        # Background
        padding = 8
        tooltip_rect = tooltip_surface.get_rect()
        tooltip_rect.inflate_ip(padding * 2, padding * 2)
        tooltip_rect.midtop = (self.rect.centerx, self.rect.bottom + 5)
        
        # Draw tooltip
        pygame.draw.rect(surface, WHITE, tooltip_rect, border_radius=4)
        pygame.draw.rect(surface, BLACK, tooltip_rect, 1, border_radius=4)
        surface.blit(tooltip_surface, tooltip_surface.get_rect(center=tooltip_rect.center))
