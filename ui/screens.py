# =========================================================
# SCREEN CLASSES - Base classes for all game screens
# =========================================================

import pygame
from abc import ABC, abstractmethod
# Handle both package and direct execution
try:
    from ..config import *
    from ..asset_manager import asset_manager
    from ..game_state import game_state
    from ..particle_system import particle_system
    from ..popup_manager import popup_manager
    from ..screen_manager import Screen
    from .button import Button, CardButton, IconButton
except ImportError:
    # Direct execution fallback
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from config import *
    from asset_manager import asset_manager
    from game_state import game_state
    from particle_system import particle_system
    from popup_manager import popup_manager
    from screen_manager import Screen
    from ui.button import Button, CardButton, IconButton

class BaseScreen(Screen):
    """Base screen with common functionality"""
    def __init__(self, screen_manager):
        super().__init__(screen_manager)
        
        # Common UI elements
        self.back_button = None
        self.title = ""
        self.background_color = (165, 214, 167)
        
        # Animation state
        self.transition_alpha = 0
        self.transitioning_in = True
        
    def enter(self):
        """Called when screen becomes active"""
        self.transitioning_in = True
        self.transition_alpha = 0
        
    def exit(self):
        """Called when screen becomes inactive"""
        pass
        
    def update(self, dt):
        """Update screen logic and animations"""
        # Handle transition animation
        if self.transitioning_in:
            self.transition_alpha = min(255, self.transition_alpha + dt * 500)
            if self.transition_alpha >= 255:
                self.transitioning_in = False
                
        # Update popups
        popup_manager.update(dt)
        
    def draw(self, surface):
        """Draw screen with transition effects"""
        # Draw background
        surface.fill(self.background_color)
        
        # Draw screen content
        self._draw_content(surface)
        
        # Draw common UI elements
        self._draw_common_ui(surface)
        
        # Draw popups
        popup_manager.draw(surface)
        
        # Apply transition effect
        if self.transition_alpha < 255:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((0, 0, 0, 255 - self.transition_alpha))
            surface.blit(overlay, (0, 0))
            
    def _draw_content(self, surface):
        """Override in subclasses"""
        pass
        
    def _draw_common_ui(self, surface):
        """Draw common UI elements"""
        # Draw title
        if self.title:
            title_font = asset_manager.load_font(36)
            title_surface = asset_manager.render_text(title_font, self.title, BLACK)
            title_rect = title_surface.get_rect(center=(WIDTH // 2, 50))
            surface.blit(title_surface, title_rect)
            
        # Draw back button
        if self.back_button:
            self.back_button.draw(surface)
            
    def handle_event(self, event):
        """Handle input events"""
        # Handle popups first
        if popup_manager.handle_event(event):
            return True
            
        # Handle back button
        if self.back_button and event.type == pygame.MOUSEBUTTONDOWN:
            if self.back_button.update(event.pos, True):
                self._handle_back()
                return True
                
        return False
        
    def _handle_back(self):
        """Handle back button click"""
        self.screen_manager.change_screen("menu")

class MenuScreen(BaseScreen):
    """Main menu screen"""
    def __init__(self, screen_manager):
        super().__init__(screen_manager)
        self.title = "MATHDRILL 5.0"
        self.background_color = (100, 150, 200)
        
        # Menu buttons
        button_width = 300
        button_height = 60
        button_spacing = 20
        start_y = 200
        
        self.play_button = Button(
            WIDTH // 2 - button_width // 2, start_y,
            button_width, button_height,
            "CHƠI ĐẤU", GREEN_BTN
        )
        
        self.lesson_button = Button(
            WIDTH // 2 - button_width // 2, start_y + button_height + button_spacing,
            button_width, button_height,
            "HỌC BÀI", BLUE_BTN
        )
        
        self.shop_button = Button(
            WIDTH // 2 - button_width // 2, start_y + (button_height + button_spacing) * 2,
            button_width, button_height,
            "CỬA HÀNG", PURPLE_BTN
        )
        
        self.profile_button = Button(
            WIDTH // 2 - button_width // 2, start_y + (button_height + button_spacing) * 3,
            button_width, button_height,
            "HỒ SƠ", YELLOW_BTN
        )
        
        self.settings_button = Button(
            WIDTH // 2 - button_width // 2, start_y + (button_height + button_spacing) * 4,
            button_width, button_height,
            "CÀI ĐẶT", GRAY
        )
        
    def _draw_content(self, surface):
        """Draw menu content"""
        # Draw decorative elements
        self._draw_decorations(surface)
        
        # Draw buttons
        self.play_button.draw(surface)
        self.lesson_button.draw(surface)
        self.shop_button.draw(surface)
        self.profile_button.draw(surface)
        self.settings_button.draw(surface)
        
        # Draw player stats
        self._draw_player_stats(surface)
        
    def _draw_decorations(self, surface):
        """Draw decorative elements"""
        # Draw floating math symbols
        symbols = ["+", "-", "×", "÷", "√", "π"]
        symbol_font = asset_manager.load_font(24)
        
        for i, symbol in enumerate(symbols):
            x = 100 + (i * 200)
            y = 100 + int(pygame.time.get_ticks() / 1000 + i * 100) % 50
            alpha = 100 + int(pygame.time.get_ticks() / 100 + i * 50) % 155
            
            symbol_surface = asset_manager.render_text(symbol_font, symbol, (*BLACK, alpha))
            surface.blit(symbol_surface, (x, y))
            
    def _draw_player_stats(self, surface):
        """Draw player statistics"""
        stats_font = asset_manager.load_font(18)
        
        # Create stats panel
        panel_rect = pygame.Rect(WIDTH - 250, 20, 230, 120)
        pygame.draw.rect(surface, WHITE, panel_rect, border_radius=10)
        pygame.draw.rect(surface, BLACK, panel_rect, 2, border_radius=10)
        
        # Draw stats
        stats = [
            f"Level: {game_state.player_level}",
            f"XP: {game_state.player_exp}/{game_state.exp_to_next_level}",
            f"Gold: {game_state.gold}",
            f"Combo: {game_state.combo_streak}x{game_state.combo_multiplier:.1f}"
        ]
        
        y_offset = 35
        for stat in stats:
            stat_surface = asset_manager.render_text(stats_font, stat, BLACK)
            surface.blit(stat_surface, (panel_rect.x + 15, y_offset))
            y_offset += 25
            
    def handle_event(self, event):
        """Handle menu events"""
        # Handle popups first
        if popup_manager.handle_event(event):
            return True
            
        if event.type == pygame.MOUSEBUTTONDOWN:
            mouse_pos = event.pos
            
            if self.play_button.update(mouse_pos, True):
                self.screen_manager.change_screen("play")
            elif self.lesson_button.update(mouse_pos, True):
                self.screen_manager.change_screen("lesson")
            elif self.shop_button.update(mouse_pos, True):
                self.screen_manager.change_screen("shop")
            elif self.profile_button.update(mouse_pos, True):
                self.screen_manager.change_screen("profile")
            elif self.settings_button.update(mouse_pos, True):
                self.screen_manager.change_screen("settings")
                
        elif event.type == pygame.MOUSEMOTION:
            mouse_pos = event.pos
            self.play_button.update(mouse_pos, False)
            self.lesson_button.update(mouse_pos, False)
            self.shop_button.update(mouse_pos, False)
            self.profile_button.update(mouse_pos, False)
            self.settings_button.update(mouse_pos, False)
            
        return True

class LessonScreen(BaseScreen):
    """Lesson selection screen"""
    def __init__(self, screen_manager):
        super().__init__(screen_manager)
        self.title = "CHỌN BÀI HỌC"
        self.selected_grade = game_state.player_level
        
        # Grade buttons
        self.grade_buttons = []
        self._create_grade_buttons()
        
    def _create_grade_buttons(self):
        """Create grade selection buttons"""
        button_width = 120
        button_height = 80
        spacing = 20
        start_x = (WIDTH - (5 * button_width + 4 * spacing)) // 2
        
        for grade in range(1, 6):
            x = start_x + (grade - 1) * (button_width + spacing)
            y = 200
            
            btn = Button(x, y, button_width, button_height, f"Lớp {grade}", BLUE_BTN)
            if grade == self.selected_grade:
                btn.color = GREEN_BTN
            self.grade_buttons.append((grade, btn))
            
    def _draw_content(self, surface):
        """Draw lesson content"""
        # Draw grade buttons
        for grade, button in self.grade_buttons:
            button.draw(surface)
            
        # Draw lesson info
        self._draw_lesson_info(surface)
        
    def _draw_lesson_info(self, surface):
        """Draw information about selected grade"""
        info_font = asset_manager.load_font(20)
        
        # Create info panel
        info_rect = pygame.Rect(100, 350, WIDTH - 200, 250)
        pygame.draw.rect(surface, WHITE, info_rect, border_radius=15)
        pygame.draw.rect(surface, BLACK, info_rect, 3, border_radius=15)
        
        # Draw grade information
        info_text = [
            f"Lớp {self.selected_grade} - Toán học",
            "",
            "Nội dung học tập:",
            "• Số và phép tính",
            "• Hình học cơ bản", 
            "• Đo lường và thời gian",
            "• Bài tập vận dụng"
        ]
        
        y_offset = 380
        for line in info_text:
            if line.startswith("•"):
                text_surface = asset_manager.render_text(info_font, line, (50, 150, 50))
            else:
                text_surface = asset_manager.render_text(info_font, line, BLACK)
            surface.blit(text_surface, (info_rect.x + 20, y_offset))
            y_offset += 30
            
        # Start button
        start_button = Button(
            info_rect.centerx - 100, info_rect.bottom - 60,
            200, 50, "BẮT ĐẦU", GREEN_BTN
        )
        start_button.draw(surface)
        
    def handle_event(self, event):
        """Handle lesson screen events"""
        # Handle popups first
        if popup_manager.handle_event(event):
            return True
            
        if event.type == pygame.MOUSEBUTTONDOWN:
            mouse_pos = event.pos
            
            # Check grade buttons
            for grade, button in self.grade_buttons:
                if button.update(mouse_pos, True):
                    self.selected_grade = grade
                    self._create_grade_buttons()  # Recreate to update selection
                    return True
                    
        elif event.type == pygame.MOUSEMOTION:
            mouse_pos = event.pos
            for grade, button in self.grade_buttons:
                button.update(mouse_pos, False)
                
        return True

class ShopScreen(BaseScreen):
    """Shop screen for pets, skins, etc."""
    def __init__(self, screen_manager):
        super().__init__(screen_manager)
        self.title = "CỬA HÀNG"
        self.current_tab = "pets"
        self.tab_buttons = []
        self._create_tab_buttons()
        
    def _create_tab_buttons(self):
        """Create tab buttons"""
        tab_width = 120
        tab_height = 40
        spacing = 10
        start_x = WIDTH // 2 - (3 * tab_width + 2 * spacing) // 2
        
        self.tab_buttons = [
            ("pets", Button(start_x, 120, tab_width, tab_height, "🐾 Thú Cưng", PURPLE_BTN)),
            ("skins", Button(start_x + tab_width + spacing, 120, tab_width, tab_height, "✏️ Trang Phục", BLUE_BTN)),
            ("items", Button(start_x + 2 * (tab_width + spacing), 120, tab_width, tab_height, "💎 Vật Phẩm", YELLOW_BTN))
        ]
        
    def _draw_content(self, surface):
        """Draw shop content"""
        # Draw tab buttons
        for tab_name, button in self.tab_buttons:
            if tab_name == self.current_tab:
                button.color = GREEN_BTN
            else:
                button.color = PURPLE_BTN if tab_name == "pets" else (BLUE_BTN if tab_name == "skins" else YELLOW_BTN)
            button.draw(surface)
            
        # Draw tab content
        self._draw_tab_content(surface)
        
        # Draw gold display
        self._draw_gold_display(surface)
        
    def _draw_tab_content(self, surface):
        """Draw content for current tab"""
        content_font = asset_manager.load_font(18)
        
        # Create content area
        content_rect = pygame.Rect(50, 180, WIDTH - 100, HEIGHT - 280)
        pygame.draw.rect(surface, WHITE, content_rect, border_radius=15)
        pygame.draw.rect(surface, BLACK, content_rect, 2, border_radius=15)
        
        # Draw placeholder content
        if self.current_tab == "pets":
            text = "Thú cưng đang phát triển..."
        elif self.current_tab == "skins":
            text = "Trang phục đang phát triển..."
        else:
            text = "Vật phẩm đang phát triển..."
            
        text_surface = asset_manager.render_text(content_font, text, BLACK)
        text_rect = text_surface.get_rect(center=content_rect.center)
        surface.blit(text_surface, text_rect)
        
    def _draw_gold_display(self, surface):
        """Draw player gold"""
        gold_font = asset_manager.load_font(24)
        gold_text = f"💰 {game_state.gold}"
        gold_surface = asset_manager.render_text(gold_font, gold_text, (255, 215, 0))
        gold_rect = gold_surface.get_rect(topright=(WIDTH - 20, 20))
        surface.blit(gold_surface, gold_rect)
        
    def handle_event(self, event):
        """Handle shop events"""
        # Handle popups first
        if popup_manager.handle_event(event):
            return True
            
        if event.type == pygame.MOUSEBUTTONDOWN:
            mouse_pos = event.pos
            
            # Check tab buttons
            for tab_name, button in self.tab_buttons:
                if button.update(mouse_pos, True):
                    self.current_tab = tab_name
                    return True
                    
        elif event.type == pygame.MOUSEMOTION:
            mouse_pos = event.pos
            for tab_name, button in self.tab_buttons:
                button.update(mouse_pos, False)
                
        return True
