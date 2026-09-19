# -*- coding: utf-8 -*-
"""Performance helpers: particle budget, surface cache."""
import pygame

GLOBAL_MAX_PARTICLES = 200


class ParticleBudget:
    """Global cap so confetti + effects don't tank FPS."""
    _count = 0

    @classmethod
    def available(cls):
        return max(0, GLOBAL_MAX_PARTICLES - cls._count)

    @classmethod
    def request(cls, wanted):
        granted = min(wanted, cls.available())
        cls._count += granted
        return granted

    @classmethod
    def release(cls, n=1):
        cls._count = max(0, cls._count - n)

    @classmethod
    def reset_frame(cls):
        """Optional: call if tracking per-frame spawn only."""
        pass


class SurfaceCache:
    """Cache pygame surfaces that would otherwise be rebuilt every frame."""

    def __init__(self, max_entries=128):
        self._cache = {}
        self._max = max_entries

    def get(self, key, factory):
        if key in self._cache:
            return self._cache[key]
        surf = factory()
        if len(self._cache) >= self._max:
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = surf
        return surf

    def clear(self):
        self._cache.clear()


ui_surface_cache = SurfaceCache()
