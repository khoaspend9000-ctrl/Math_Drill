"""
Game state management module for MathDrill 5.0
Handles game states, transitions, and overall game coordination
"""

import math
from player import PlayerData


class GameManager:
    """Centralized game state management"""

    def __init__(self, width=1300, height=800):
        self.player = PlayerData()
        self.current_state = None
        self.paused = False
        self.achievement_popup = None
        
        # Game settings
        self.admin_pass = "admin123"
        
        # Screen dimensions
        self.width = width
        self.height = height
        
        # Pre-calculated constants
        self.screen_diagonal = math.sqrt((width // 2) ** 2 + (height // 2) ** 2)
    
    def update(self, dt):
        """Update all game systems"""
        self.player.update_screen_shake(dt)
        
        # Update current state
        if self.current_state and hasattr(self.current_state, 'update'):
            self.current_state.update(dt)
    
    def handle_event(self, event):
        """Handle events through current state"""
        if self.current_state and hasattr(self.current_state, 'handle_event'):
            return self.current_state.handle_event(event)
        return False
    
    def change_state(self, new_state):
        """Change game state"""
        if hasattr(self.current_state, 'exit'):
            self.current_state.exit()
        
        self.current_state = new_state
        
        if hasattr(new_state, 'enter'):
            new_state.enter()
    
    def get_screen_offset(self):
        """Get combined screen effects offset"""
        return self.player.get_screen_offset()
    
    def toggle_pause(self):
        """Toggle pause state"""
        self.paused = not self.paused
    
    def set_achievement_popup(self, popup):
        """Set achievement popup"""
        self.achievement_popup = popup
    
    def update_screen_dimensions(self, width, height):
        """Update screen dimensions and recalculate constants"""
        self.width = width
        self.height = height
        self.screen_diagonal = math.sqrt((width // 2) ** 2 + (height // 2) ** 2)
    
    def get_game_info(self):
        """Get current game information"""
        return {
            'level': self.player.level,
            'exp': self.player.exp,
            'gold': self.player.gold,
            'combo_streak': self.player.combo_streak,
            'combo_multiplier': self.player.combo_multiplier,
            'lives': self.player.lives,
            'paused': self.paused,
            'current_state': type(self.current_state).__name__ if self.current_state else None
        }
