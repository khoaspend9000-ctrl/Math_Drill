# -*- coding: utf-8 -*-
"""Load game content (pets, achievements, skills, etc.) from JSON files."""
import json
import os

_BASE = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR = os.path.join(_BASE, "data")


def _data_path(filename):
    return os.path.join(_DATA_DIR, filename)


def _load_json(filename, default=None):
    path = _data_path(filename)
    if not os.path.isfile(path):
        return default if default is not None else {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _tupleize_colors(obj):
    """Convert [r,g,b] lists in skin data to tuples for pygame."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in ("color", "bg_color", "border_color") and isinstance(v, list) and len(v) >= 3:
                out[k] = tuple(v[:3])
            else:
                out[k] = _tupleize_colors(v)
        return out
    if isinstance(obj, list):
        return [_tupleize_colors(x) for x in obj]
    return obj


def load_achievements():
    return _load_json("achievements.json", {})


def load_pets():
    return _load_json("pets.json", {})


def load_skins():
    return _tupleize_colors(_load_json("skins.json", {}))


def load_skills():
    return _load_json("skills.json", {})


def load_gacha_cards():
    return _load_json("gacha_cards.json", {})


def load_daily_rewards():
    data = _load_json("daily_rewards.json", {})
    if not data.get("rewards"):
        data = {
            "cycle_days": 7,
            "rewards": [
                {"day": i, "xp": 50 + i * 15, "gold": i * 10, "icon": "🎁"}
                for i in range(1, 8)
            ],
        }
    return data


def get_daily_reward_for_streak(streak):
    """Return reward dict for current streak day (1-7 cycle)."""
    cfg = load_daily_rewards()
    rewards = cfg.get("rewards", [])
    if not rewards:
        return {"day": 1, "xp": 50 + streak * 10, "gold": 0, "icon": "🎁"}
    cycle = int(cfg.get("cycle_days", 7))
    day_index = (max(1, streak) - 1) % cycle
    if day_index < len(rewards):
        return dict(rewards[day_index])
    return dict(rewards[-1])
