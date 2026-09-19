# =========================================================
# ADAPTIVE AI SYSTEM - Separated and optimized
# =========================================================

import time
import random
from typing import Dict, List, Tuple

class PerformanceTracker:
    """Tracks player performance metrics"""
    def __init__(self, max_history=100):
        self.max_history = max_history
        self.answer_times = []
        self.correct_answers = 0
        self.total_answers = 0
        self.topic_performance = {}
        self.question_type_performance = {}
        
    def record_answer(self, is_correct, answer_time, topic_id=None, question_type=None):
        """Record a new answer"""
        self.answer_times.append(answer_time)
        
        # Limit history size
        if len(self.answer_times) > self.max_history:
            self.answer_times.pop(0)
            
        if is_correct:
            self.correct_answers += 1
        self.total_answers += 1
        
        # Track topic performance
        if topic_id:
            if topic_id not in self.topic_performance:
                self.topic_performance[topic_id] = {"correct": 0, "total": 0, "times": []}
            
            perf = self.topic_performance[topic_id]
            perf["total"] += 1
            if is_correct:
                perf["correct"] += 1
            perf["times"].append(answer_time)
            
            # Keep only recent times
            if len(perf["times"]) > 10:
                perf["times"] = perf["times"][-10:]
                
        # Track question type performance
        if question_type:
            if question_type not in self.question_type_performance:
                self.question_type_performance[question_type] = {"correct": 0, "total": 0}
                
            qt_perf = self.question_type_performance[question_type]
            qt_perf["total"] += 1
            if is_correct:
                qt_perf["correct"] += 1
                
    def get_accuracy(self):
        """Get current accuracy"""
        if self.total_answers == 0:
            return 0.5
        return self.correct_answers / self.total_answers
        
    def get_avg_time(self):
        """Get average answer time"""
        if not self.answer_times:
            return 5.0
        return sum(self.answer_times) / len(self.answer_times)
        
    def get_topic_accuracy(self, topic_id):
        """Get accuracy for specific topic"""
        if topic_id not in self.topic_performance:
            return 0.5
        perf = self.topic_performance[topic_id]
        return perf["correct"] / max(1, perf["total"])

class DifficultyManager:
    """Manages difficulty adjustments"""
    def __init__(self):
        self.current_difficulty = 1
        self.difficulty_history = []
        self.adjustment_cooldown = 0
        self.min_difficulty = 1
        self.max_difficulty = 5
        
    def adjust_difficulty(self, accuracy, avg_time, performance_score):
        """Adjust difficulty based on performance"""
        if self.adjustment_cooldown > 0:
            self.adjustment_cooldown -= 1
            return
            
        old_difficulty = self.current_difficulty
        
        # Calculate adjustment
        if performance_score > 80:
            # Player is doing well, increase difficulty
            if self.current_difficulty < self.max_difficulty:
                self.current_difficulty += 1
        elif performance_score < 40:
            # Player is struggling, decrease difficulty
            if self.current_difficulty > self.min_difficulty:
                self.current_difficulty -= 1
                
        # Record change
        if old_difficulty != self.current_difficulty:
            self.difficulty_history.append({
                "time": time.time(),
                "from": old_difficulty,
                "to": self.current_difficulty,
                "reason": f"Performance: {performance_score:.1f}%"
            })
            
            # Set cooldown to prevent rapid changes
            self.adjustment_cooldown = 5  # 5 questions buffer
            
    def get_difficulty_params(self):
        """Get parameters for current difficulty"""
        params = {
            1: {"time_limit": 30, "hint_available": True, "error_margin": 0.1},
            2: {"time_limit": 25, "hint_available": True, "error_margin": 0.05},
            3: {"time_limit": 20, "hint_available": False, "error_margin": 0.02},
            4: {"time_limit": 15, "hint_available": False, "error_margin": 0.01},
            5: {"time_limit": 10, "hint_available": False, "error_margin": 0.005}
        }
        return params.get(self.current_difficulty, params[1])

class AdaptiveAI:
    """Main adaptive AI system"""
    def __init__(self):
        self.performance_tracker = PerformanceTracker()
        self.difficulty_manager = DifficultyManager()
        self.session_start_time = time.time()
        self.recommendations = []
        
    def process_answer(self, is_correct, answer_time, topic_id=None, question_type=None):
        """Process a new answer and adjust difficulty"""
        # Record performance
        self.performance_tracker.record_answer(is_correct, answer_time, topic_id, question_type)
        
        # Calculate performance score
        accuracy = self.performance_tracker.get_accuracy()
        avg_time = self.performance_tracker.get_avg_time()
        
        # Performance score (0-100)
        performance_score = accuracy * 60  # 60% weight on accuracy
        performance_score += max(0, (30 - avg_time) * 2)  # 40% weight on speed
        performance_score = min(100, performance_score)
        
        # Adjust difficulty
        self.difficulty_manager.adjust_difficulty(accuracy, avg_time, performance_score)
        
        # Generate recommendations
        self._generate_recommendations()
        
    def _generate_recommendations(self):
        """Generate learning recommendations"""
        self.recommendations = []
        
        # Find weak topics
        for topic_id, perf in self.performance_tracker.topic_performance.items():
            accuracy = perf["correct"] / max(1, perf["total"])
            if accuracy < 0.6:
                self.recommendations.append({
                    "type": "practice_topic",
                    "topic": topic_id,
                    "reason": f"Accuracy: {accuracy:.1%}"
                })
                
        # Time-based recommendations
        avg_time = self.performance_tracker.get_avg_time()
        if avg_time > 20:
            self.recommendations.append({
                "type": "speed_practice",
                "reason": f"Average time: {avg_time:.1f}s"
            })
            
    def get_current_difficulty(self):
        """Get current difficulty level"""
        return self.difficulty_manager.current_difficulty
        
    def get_difficulty_params(self):
        """Get current difficulty parameters"""
        return self.difficulty_manager.get_difficulty_params()
        
    def get_recommendations(self):
        """Get current recommendations"""
        return self.recommendations
        
    def get_session_stats(self):
        """Get session statistics"""
        session_time = time.time() - self.session_start_time
        return {
            "session_time": session_time,
            "accuracy": self.performance_tracker.get_accuracy(),
            "avg_time": self.performance_tracker.get_avg_time(),
            "total_answers": self.performance_tracker.total_answers,
            "current_difficulty": self.current_difficulty,
            "difficulty_changes": len(self.difficulty_manager.difficulty_history)
        }

# Global AI instance
adaptive_ai = AdaptiveAI()
