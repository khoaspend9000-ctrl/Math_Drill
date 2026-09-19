# game_init_pygbag.py - Phiên bản tối ưu cho pygbag
import pygame
import sys
import os

def _ck(msg):
    print(msg, flush=True)
    try:
        import js
        js.console.log(msg)
    except:
        pass

_ck("MD_CHECKPOINT: 01 START PYGBAG VERSION")

IS_WEB_BUILD = True  # Buộc web mode

pygame.init()
WIDTH, HEIGHT = 1300, 800
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("MathDrill 5.0 - Pygbag")

_ck("MD_CHECKPOINT: 13 pygame display OK")

# AccountSystem đơn giản cho web
class AccountSystem:
    def __init__(self):
        self.current_user = "admin"
    def data(self):
        return {"grade":1, "xp":0, "level":1, "gold":9999}
    def login(self, u, p):
        return True, "OK"

account_system = AccountSystem()

_ck("MD_CHECKPOINT: 29 AccountSystem OK")

# TODO: Thêm các class khác sau khi core chạy được

print("Game init thành công! Bây giờ copy sang main.py")