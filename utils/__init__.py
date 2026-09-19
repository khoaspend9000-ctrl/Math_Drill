"""
Utils package for MathDrill 5.0
Contains utility modules for logging, resource management, etc.
"""

from .logger import (
    init_logger,
    get_logger,
    log_debug,
    log_info,
    log_warning,
    log_error,
    log_critical,
    log_game_event,
    log_performance,
    log_user_action,
    PerformanceLogger,
    log_function_performance
)

__all__ = [
    'init_logger',
    'get_logger',
    'log_debug',
    'log_info',
    'log_warning',
    'log_error',
    'log_critical',
    'log_game_event',
    'log_performance',
    'log_user_action',
    'PerformanceLogger',
    'log_function_performance'
]
