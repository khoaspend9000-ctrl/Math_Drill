"""
Audio management module for MathDrill 5.0
Handles sound effects, background music, and audio settings
"""

import pygame
import os
import logging
import sys

# Initialize logging
logger = logging.getLogger(__name__)

# pygbag (đóng gói pygame chạy trên web qua WebAssembly/Pyodide) đặt sys.platform
# thành "emscripten". Không import IS_WEB_BUILD từ game_init.py ở đây vì sẽ tạo
# vòng import (game_init.py import module audio.py này) — nên kiểm tra lại trực
# tiếp, chỉ tốn 1 dòng.
IS_WEB_BUILD = sys.platform in ("emscripten", "wasi")

# Global mixer state
mixer_works = False
base_path = ""

# Sound file cache
_sound_cache = {}

def _resolve_audio_file(filename, use_base_path=True):
    """
    Tìm file âm thanh thực tế trên đĩa, ƯU TIÊN bản .ogg trước bản gốc được
    truyền vào (thường là .mp3). Lý do: khi đóng gói game lên web bằng pygbag,
    trình duyệt xử lý MP3 không ổn định/pygbag từ chối đóng gói MP3, nên dự án
    đang chuyển dần sang OGG. Hàm này giúp code gọi "xxx.mp3" như cũ vẫn tự
    động dùng "xxx.ogg" nếu file đó đã tồn tại — không cần sửa từng nơi gọi.
    Nếu chưa kịp chuyển đổi (chỉ có .mp3), vẫn dùng lại bản .mp3 như trước,
    không hề crash hay ảnh hưởng máy desktop trong giai đoạn chuyển tiếp.
    """
    base, ext = os.path.splitext(filename)
    candidates = [filename]
    if ext.lower() != ".ogg":
        candidates.insert(0, base + ".ogg")
    for candidate in candidates:
        check_path = os.path.join(base_path, candidate) if (use_base_path and base_path) else candidate
        if os.path.exists(check_path):
            return candidate
    return filename  # Không tìm thấy gì — trả về tên gốc để log lỗi rõ ràng như cũ

def init_audio(base_path_value=""):
    """Initialize the audio system"""
    global mixer_works, base_path
    base_path = base_path_value
    
    try:
        if not pygame.mixer.get_init():
            pygame.mixer.init()
        mixer_works = True
        logger.info("Audio system initialized successfully")
        return True
    except pygame.error as e:
        logger.warning(f"Could not initialize audio system: {e}")
        mixer_works = False
        return False

def load_sound(name):
    """Load sound file with caching. Tự động ưu tiên bản .ogg nếu có (xem
    _resolve_audio_file) để tương thích khi chạy trên web qua pygbag."""
    if not mixer_works:
        return None
    
    # Check cache first
    if name in _sound_cache:
        return _sound_cache[name]
    
    try:
        resolved_name = _resolve_audio_file(name)
        sound_path = os.path.join(base_path, resolved_name)
        if os.path.exists(sound_path):
            sound = pygame.mixer.Sound(sound_path)
            _sound_cache[name] = sound  # cache theo tên GỐC được gọi, tránh nạp lại
            return sound
        else:
            logger.warning(f"Sound file not found: {sound_path}")
            return None
    except (pygame.error, OSError) as e:
        logger.error(f"Error loading sound {name}: {e}")
        return None

def load_background_music():
    """Load and start background music"""
    if not mixer_works:
        return False
    
    try:
        music_file = _resolve_audio_file("nhac_nen.mp3", use_base_path=False)
        pygame.mixer.music.load(music_file)
        pygame.mixer.music.set_volume(0.3)
        pygame.mixer.music.play(-1)
        logger.info("Background music loaded successfully")
        return True
    except (pygame.error, OSError) as e:
        logger.error(f"Could not load background music: {e}")
        return False

class SoundManager:
    """Enhanced audio management with proper error handling and logging"""
    
    def __init__(self):
        self.bgm_volume = 0.3
        self.sfx_volume = 0.7
        self.current_bgm = "menu"  # menu, lesson, quiz, victory, defeat
        self.fever_mode_active = False
        self._bgm_playing_file = None
        
        # BGM file mappings - chỉ dùng một file xuyên suốt
        self.bgm_files = {
            "menu": "nhac_nen.mp3",
            "lesson": "nhac_nen.mp3",
            "quiz": "nhac_nen.mp3",
            "victory": "nhac_nen.mp3",
            "defeat": "nhac_nen.mp3"
        }
        
        # Load additional sounds with error handling
        self.sounds = {
            "xp_gain": load_sound("xp_gain.mp3"),
            "combo": load_sound("combo.mp3"),
            "fever": load_sound("fever_mode.mp3"),
            "button": load_sound("button_click.mp3")
        }
        
        # Preload combo tier sounds for optimal performance
        self.combo_sounds = {
            1: load_sound("sound 1.mp3"),
            2: load_sound("sound 2.mp3"),
            3: load_sound("sound 3.mp3"),
            4: load_sound("sound 4.mp3"),
            5: load_sound("sound 5.mp3"),
            6: load_sound("sound 6.mp3")
        }
        
        # Core sounds (loaded globally) — load_sound() tự ưu tiên .ogg nếu có
        self.core_sounds = {
            "correct": load_sound("tra_loi_dung.ogg"),
            "wrong": load_sound("tra_loi_sai.ogg"),
            "levelup": load_sound("level_up.mp3"),
            "victory": load_sound("victory.mp3"),
            "defeat": load_sound("defeat.mp3")
        }
        
        logger.info("SoundManager initialized")
        if not IS_WEB_BUILD:
            self.set_bgm("menu")
        else:
            # QUAN TRỌNG: KHÔNG tự phát nhạc nền ngay ở đây trên web. Trình duyệt
            # yêu cầu AudioContext phải được "mở khóa" bằng một thao tác thật của
            # người dùng (click/phím) trước khi cho phép phát âm thanh — gọi
            # play() ngay từ lúc script khởi động (chưa ai tương tác) khiến toàn
            # bộ luồng thực thi Python bị TREO VÔ THỜI HẠN ở đây, không bao giờ
            # tới được vòng lặp game để vẽ màn hình (đây chính là nguyên nhân
            # màn hình đen/trắng không hiện gì). main.py sẽ tự gọi set_bgm("menu")
            # một lần duy nhất ngay sau sự kiện tương tác đầu tiên của người dùng.
            logger.info("Web build: hoãn phát nhạc nền tới khi có tương tác đầu tiên của người dùng.")
    
    def _get_bgm_volume(self, bgm_type):
        volume_multiplier = {
            "menu": 0.5,
            "lesson": 0.6,
            "quiz": 0.8,
            "victory": 0.7,
            "defeat": 0.5
        }.get(bgm_type, 0.5)
        return self.bgm_volume * volume_multiplier
    
    def set_bgm(self, bgm_type):
        """Change background music based on game state without restarting same track."""
        self.current_bgm = bgm_type
        
        if not mixer_works:
            return
        
        music_file = self.bgm_files.get(bgm_type, "nhac_nen.mp3")
        music_file = _resolve_audio_file(music_file, use_base_path=False)
        if not os.path.exists(music_file):
            music_file = _resolve_audio_file("nhac_nen.mp3", use_base_path=False)
        
        volume = self._get_bgm_volume(bgm_type)
        
        # Same file already playing – only adjust volume, keep playback position
        if music_file == self._bgm_playing_file and pygame.mixer.music.get_busy():
            try:
                pygame.mixer.music.set_volume(volume)
                logger.debug(f"BGM volume adjusted for: {bgm_type}")
            except Exception as e:
                logger.error(f"Could not adjust BGM volume for {bgm_type}: {e}")
            return
        
        try:
            pygame.mixer.music.load(music_file)
            pygame.mixer.music.set_volume(volume)
            pygame.mixer.music.play(-1)
            self._bgm_playing_file = music_file
            logger.info(f"Background music started: {bgm_type}")
        except Exception as e:
            logger.error(f"Could not load background music {bgm_type}: {e}")
            try:
                fallback_file = _resolve_audio_file("nhac_nen.mp3", use_base_path=False)
                pygame.mixer.music.load(fallback_file)
                pygame.mixer.music.set_volume(self.bgm_volume)
                pygame.mixer.music.play(-1)
                self._bgm_playing_file = fallback_file
            except Exception as fallback_error:
                logger.error(f"Fallback music also failed: {fallback_error}")
    
    def play_sfx(self, sound_name):
        """Play sound effect with proper error handling"""
        if not mixer_works:
            return
        
        try:
            # Check core sounds first
            if sound_name in self.core_sounds and self.core_sounds[sound_name]:
                volume = self.sfx_volume
                if sound_name == "button":
                    volume *= 0.5  # Button sounds are quieter
                
                self.core_sounds[sound_name].set_volume(volume)
                self.core_sounds[sound_name].play()
                logger.debug(f"Played core sound: {sound_name}")
                
            # Check additional sounds
            elif sound_name in self.sounds and self.sounds[sound_name]:
                volume = self.sfx_volume
                if sound_name == "xp_gain":
                    volume *= 0.8  # XP gain sounds are slightly quieter
                
                self.sounds[sound_name].set_volume(volume)
                self.sounds[sound_name].play()
                logger.debug(f"Played additional sound: {sound_name}")
            else:
                # Try to load sound dynamically if not in dicts
                dynamic_sound = load_sound(f"{sound_name}.mp3") or \
                               load_sound(f"{sound_name}.ogg") or \
                               load_sound(f"{sound_name}.wav")
                if dynamic_sound:
                    dynamic_sound.set_volume(self.sfx_volume)
                    dynamic_sound.play()
                    logger.info(f"Played dynamic sound: {sound_name}")
                else:
                    logger.warning(f"Sound not found: {sound_name}")
                
        except Exception as e:
            logger.error(f"Error playing sound {sound_name}: {e}")

    def play_combo_sound(self, combo_value):
        """Play combo sound based on combo value tiers with error handling
        
        Tiers:
        1-4: sound 1.mp3
        5-9: sound 2.mp3
        10-14: sound 3.mp3
        15-19: sound 4.mp3
        20-24: sound 5.mp3
        25+: sound 6.mp3
        """
        if not mixer_works:
            return
        
        try:
            # Determine which tier sound to play
            if combo_value >= 25:
                tier = 6
            elif combo_value >= 20:
                tier = 5
            elif combo_value >= 15:
                tier = 4
            elif combo_value >= 10:
                tier = 3
            elif combo_value >= 5:
                tier = 2
            elif combo_value >= 1:
                tier = 1
            else:
                # Combo reset or 0, no sound
                return
            
            # Get the sound from cache
            sound = self.combo_sounds.get(tier)
            
            if sound:
                # Adjust volume slightly for higher tiers to feel more impactful
                volume_multiplier = 1.0 + (tier * 0.1)  # 1.1x to 1.6x
                sound.set_volume(self.sfx_volume * min(volume_multiplier, 1.6))
                sound.play()
                logger.debug(f"Played combo sound tier {tier} for combo {combo_value}")
            else:
                # Fallback to default combo sound if tier sound not found
                if "combo" in self.sounds and self.sounds["combo"]:
                    self.sounds["combo"].set_volume(self.sfx_volume)
                    self.sounds["combo"].play()
                    logger.warning(f"Combo tier {tier} sound not found, using fallback")
                else:
                    logger.warning(f"Combo tier {tier} sound and fallback not found")
                    
        except Exception as e:
            logger.error(f"Error playing combo sound for {combo_value}: {e}")
    
    def play_sound(self, sound_name):
        """Alias for play_sfx with extra defensive check"""
        try:
            self.play_sfx(sound_name)
        except AttributeError as e:
            logger.error(f"AttributeError in play_sound: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in play_sound for {sound_name}: {e}")
    
    def activate_fever_mode(self):
        """Activate fever mode audio effects"""
        self.fever_mode_active = True
        self.play_sfx("fever")
        
        # Increase BGM volume during fever mode
        if mixer_works:
            try:
                pygame.mixer.music.set_volume(self.bgm_volume * 0.9)
                logger.info("Fever mode activated - BGM volume increased")
            except Exception as e:
                logger.error(f"Error increasing BGM volume for fever mode: {e}")
    
    def deactivate_fever_mode(self):
        """Deactivate fever mode audio effects"""
        self.fever_mode_active = False
        
        # Restore normal BGM volume
        if mixer_works:
            try:
                pygame.mixer.music.set_volume(self._get_bgm_volume(self.current_bgm))
                logger.info("Fever mode deactivated - BGM volume restored")
            except Exception as e:
                logger.error(f"Error restoring BGM volume: {e}")
    
    def set_master_volume(self, volume):
        """Set master volume for all audio"""
        # Clamp volume between 0.0 and 1.0
        volume = max(0.0, min(1.0, volume))
        
        self.bgm_volume = volume * 0.5
        self.sfx_volume = volume
        
        # Update current audio volumes
        if mixer_works:
            try:
                pygame.mixer.music.set_volume(self.bgm_volume)
                
                # Update core sound volumes
                for sound in self.core_sounds.values():
                    if sound:
                        sound.set_volume(self.sfx_volume)
                        
                logger.info(f"Master volume set to: {volume}")
            except Exception as e:
                logger.error(f"Error setting master volume: {e}")
    
    def stop_all_audio(self):
        """Stop all audio playback"""
        if mixer_works:
            try:
                pygame.mixer.music.stop()
                pygame.mixer.stop()
                logger.info("All audio stopped")
            except Exception as e:
                logger.error(f"Error stopping audio: {e}")
    
    def get_audio_status(self):
        """Get current audio system status"""
        return {
            "mixer_works": mixer_works,
            "bgm_volume": self.bgm_volume,
            "sfx_volume": self.sfx_volume,
            "current_bgm": self.current_bgm,
            "fever_mode_active": self.fever_mode_active,
            "loaded_sounds": len([s for s in self.core_sounds.values() if s]) + 
                           len([s for s in self.sounds.values() if s])
        }

# Global sound manager instance
sound_manager = None

def get_sound_manager():
    """Get the global sound manager instance"""
    global sound_manager
    if sound_manager is None:
        sound_manager = SoundManager()
    return sound_manager

def cleanup_audio():
    """Clean up audio resources"""
    global sound_manager, _sound_cache, mixer_works
    
    if sound_manager:
        sound_manager.stop_all_audio()
    
    _sound_cache.clear()
    
    if mixer_works:
        try:
            pygame.mixer.quit()
        except pygame.error:
            pass
    
    mixer_works = False
    logger.info("Audio system cleaned up")
