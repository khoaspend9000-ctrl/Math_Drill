"""
Player data management module for MathDrill 5.0
Handles player stats, experience, gold, combos, and visual effects
"""

import time
import math


def get_required_exp(level):
    """Tính lượng EXP cần thiết để lên cấp tiếp theo một cách an toàn"""
    if level <= 0:
        return 100
    
    # Giới hạn level tối đa để tránh overflow
    if level >= 1000:  # Cấp độ Admin hoặc cực cao
        return 1000000
    
    # Công thức tăng trưởng an toàn: 100, 120, 144, ... nhưng giới hạn ở cấp 50
    # Sau đó tăng tuyến tính để tránh tràn số (Overflow)
    if level <= 50:
        return int(100 * (1.15 ** (level - 1)))
    else:
        base_50 = int(100 * (1.15 ** 49))
        return base_50 + (level - 50) * 500


class PlayerData:
    """Centralized player data management"""

    def __init__(self):
        self.level = 1
        self.exp = 0
        self.exp_to_next_level = 100
        self.combo_streak = 0
        self.combo_multiplier = 1.0
        self.gold = 0
        self.lives = 3
        
        # Visual effects
        self.screen_shake_time = 0
        self.screen_shake_intensity = 0
        
        # Smooth animations
        self.display_exp = 0.0  # Smooth XP display
        self.display_gold = 0.0  # Smooth gold display
        
        # Audio settings
        self.volume = 1.0
        self.brightness = 1.0
        self.fullscreen = False

    def add_exp(self, amount, account_system=None, snd_levelup=None):
        """Add experience and handle level ups"""
        self.exp += amount
        
        # Sync with account system
        if account_system and account_system.current_user:
            d = account_system.data()
            d["xp"] = self.exp
            d["level"] = self.level        
        
        while self.exp >= self.exp_to_next_level:
            self.exp -= self.exp_to_next_level
            self.level += 1
            self.exp_to_next_level = get_required_exp(self.level)
            if snd_levelup: 
                snd_levelup.play()
            
            # Update account system again for level up
            if account_system and account_system.current_user:
                d = account_system.data()
                d["xp"] = self.exp
                d["level"] = self.level

    def add_gold(self, amount, account_system=None):
        """Add gold to player"""
        self.gold += amount
        
        # Sync with account system
        if account_system and account_system.current_user:
            d = account_system.data()
            d["gold"] = self.gold
    
    def reset_combo(self):
        """Reset combo system"""
        self.combo_streak = 0
        self.combo_multiplier = 1.0
    
    def increment_combo(self):
        """Increment combo and update multiplier"""
        self.combo_streak += 1
        
        # Update multiplier based on streak
        if self.combo_streak >= 5:
            self.combo_multiplier = 2.0
        elif self.combo_streak >= 3:
            self.combo_multiplier = 1.5
        else:
            self.combo_multiplier = 1.0
    
    def trigger_screen_shake(self, intensity=5.0, duration=0.3):
        """Trigger screen shake effect"""
        self.screen_shake_time = duration
        self.screen_shake_intensity = intensity
    
    def update_screen_shake(self, dt):
        """Update screen shake effect"""
        if self.screen_shake_time > 0:
            self.screen_shake_time -= dt
            if self.screen_shake_time <= 0:
                self.screen_shake_intensity = 0.0
    
    def update_animations(self, dt):
        """Update smooth animations for UI elements"""
        # Smooth XP animation
        self.display_exp += (self.exp - self.display_exp) * 0.08
        
        # Smooth gold animation  
        self.display_gold += (self.gold - self.display_gold) * 0.1
    
    def get_screen_offset(self):
        """Get screen shake offset with smooth sine wave motion"""
        if self.screen_shake_intensity > 0:
            # Use sine waves for smoother shake motion
            current_time = time.time()
            offset_x = math.sin(current_time * 40) * self.screen_shake_intensity
            offset_y = math.cos(current_time * 35) * self.screen_shake_intensity * 0.7  # Slightly less vertical movement
            
            return (int(offset_x), int(offset_y))
        return (0, 0)
    
    def set_volume(self, volume):
        """Set audio volume"""
        self.volume = max(0.0, min(1.0, volume))
    
    def set_brightness(self, brightness):
        """Set screen brightness"""
        self.brightness = max(0.0, min(2.0, brightness))
    
    def set_fullscreen(self, fullscreen):
        """Set fullscreen mode"""
        self.fullscreen = fullscreen
    
    def get_save_data(self):
        """Get data for saving"""
        return {
            'level': self.level,
            'exp': self.exp,
            'gold': self.gold,
            'volume': self.volume,
            'brightness': self.brightness,
            'fullscreen': self.fullscreen
        }
    
    def load_save_data(self, data):
        """Load data from save"""
        self.level = data.get('level', 1)
        self.exp = data.get('exp', 0)
        self.gold = data.get('gold', 0)
        self.volume = data.get('volume', 1.0)
        self.brightness = data.get('brightness', 1.0)
        self.fullscreen = data.get('fullscreen', False)
        self.exp_to_next_level = get_required_exp(self.level)
