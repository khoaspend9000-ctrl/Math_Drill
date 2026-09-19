"""
Logging system for MathDrill 5.0
Provides centralized logging with different levels and file output
"""

import logging
import os
import sys
from datetime import datetime
from typing import Optional


class GameLogger:
    """Enhanced logging system for the game"""
    
    def __init__(self, log_level=logging.INFO, log_file: Optional[str] = None):
        self.log_level = log_level
        self.log_file = log_file or "game.log"
        self.logger = None
        self.setup_logging()
    
    def setup_logging(self):
        """Setup logging configuration"""
        # Create logger
        self.logger = logging.getLogger("MathDrill")
        self.logger.setLevel(self.log_level)
        
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # Create formatters
        detailed_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
        )
        
        simple_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.WARNING)  # Only warnings and errors to console
        console_handler.setFormatter(simple_formatter)
        self.logger.addHandler(console_handler)
        
        # File handler
        try:
            log_dir = os.path.dirname(self.log_file) if os.path.dirname(self.log_file) else "logs"
            if not os.path.exists(log_dir):
                os.makedirs(log_dir)
            
            file_path = os.path.join(log_dir, os.path.basename(self.log_file))
            file_handler = logging.FileHandler(file_path, encoding='utf-8')
            file_handler.setLevel(self.log_level)
            file_handler.setFormatter(detailed_formatter)
            self.logger.addHandler(file_handler)
            
        except Exception as e:
            # Fallback to current directory if log directory creation fails
            try:
                file_handler = logging.FileHandler(self.log_file, encoding='utf-8')
                file_handler.setLevel(self.log_level)
                file_handler.setFormatter(detailed_formatter)
                self.logger.addHandler(file_handler)
            except Exception as fallback_error:
                print(f"Warning: Could not setup file logging: {fallback_error}")
    
    def debug(self, message: str, **kwargs):
        """Log debug message"""
        self.logger.debug(message, extra=kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message"""
        self.logger.info(message, extra=kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message"""
        self.logger.warning(message, extra=kwargs)
    
    def error(self, message: str, exception: Optional[Exception] = None, **kwargs):
        """Log error message with optional exception details"""
        if exception:
            self.logger.error(f"{message}: {str(exception)}", exc_info=True, extra=kwargs)
        else:
            self.logger.error(message, extra=kwargs)
    
    def critical(self, message: str, exception: Optional[Exception] = None, **kwargs):
        """Log critical error message"""
        if exception:
            self.logger.critical(f"{message}: {str(exception)}", exc_info=True, extra=kwargs)
        else:
            self.logger.critical(message, extra=kwargs)
    
    def log_game_event(self, event_type: str, details: dict = None):
        """Log game-specific events"""
        message = f"Game Event: {event_type}"
        if details:
            message += f" - {details}"
        self.info(message)
    
    def log_performance(self, operation: str, duration: float, **metrics):
        """Log performance metrics"""
        message = f"Performance: {operation} took {duration:.3f}s"
        if metrics:
            message += f" - {metrics}"
        self.info(message)
    
    def log_user_action(self, action: str, user: Optional[str] = None, **context):
        """Log user actions"""
        message = f"User Action: {action}"
        if user:
            message += f" by {user}"
        if context:
            message += f" - {context}"
        self.info(message)
    
    def set_level(self, level):
        """Change logging level"""
        self.log_level = level
        self.logger.setLevel(level)
        
        # Update handler levels
        for handler in self.logger.handlers:
            if isinstance(handler, logging.StreamHandler) and not isinstance(handler, logging.FileHandler):
                handler.setLevel(max(level, logging.WARNING))  # Console minimum WARNING
            else:
                handler.setLevel(level)
    
    def get_log_stats(self):
        """Get logging statistics"""
        return {
            "log_level": self.log_level,
            "handlers": len(self.logger.handlers),
            "log_file": self.log_file
        }


# Global logger instance
_game_logger: Optional[GameLogger] = None

def init_logger(log_level=logging.INFO, log_file: Optional[str] = None) -> GameLogger:
    """Initialize the global game logger"""
    global _game_logger
    _game_logger = GameLogger(log_level, log_file)
    return _game_logger

def get_logger() -> GameLogger:
    """Get the global game logger instance"""
    global _game_logger
    if _game_logger is None:
        _game_logger = init_logger()
    return _game_logger

def log_debug(message: str, **kwargs):
    """Convenience function for debug logging"""
    get_logger().debug(message, **kwargs)

def log_info(message: str, **kwargs):
    """Convenience function for info logging"""
    get_logger().info(message, **kwargs)

def log_warning(message: str, **kwargs):
    """Convenience function for warning logging"""
    get_logger().warning(message, **kwargs)

def log_error(message: str, exception: Optional[Exception] = None, **kwargs):
    """Convenience function for error logging"""
    get_logger().error(message, exception, **kwargs)

def log_critical(message: str, exception: Optional[Exception] = None, **kwargs):
    """Convenience function for critical logging"""
    get_logger().critical(message, exception, **kwargs)

def log_game_event(event_type: str, details: dict = None):
    """Convenience function for game event logging"""
    get_logger().log_game_event(event_type, details)

def log_performance(operation: str, duration: float, **metrics):
    """Convenience function for performance logging"""
    get_logger().log_performance(operation, duration, **metrics)

def log_user_action(action: str, user: Optional[str] = None, **context):
    """Convenience function for user action logging"""
    get_logger().log_user_action(action, user, **context)

# Configure standard library logging to use our logger
def setup_stdlib_logging():
    """Setup standard library logging to redirect to our logger"""
    # Redirect pygame and other library logs
    pygame_logger = logging.getLogger('pygame')
    pygame_logger.addHandler(logging.StreamHandler())
    pygame_logger.setLevel(logging.WARNING)

# Context manager for performance logging
class PerformanceLogger:
    """Context manager for timing operations"""
    
    def __init__(self, operation: str, **metrics):
        self.operation = operation
        self.metrics = metrics
        self.start_time = None
    
    def __enter__(self):
        import time
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        import time
        if self.start_time:
            duration = time.time() - self.start_time
            log_performance(self.operation, duration, **self.metrics)

# Decorator for function performance logging
def log_function_performance(operation_name: Optional[str] = None):
    """Decorator to log function execution time"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            import time
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                op_name = operation_name or f"{func.__module__}.{func.__name__}"
                log_performance(op_name, duration)
        return wrapper
    return decorator
