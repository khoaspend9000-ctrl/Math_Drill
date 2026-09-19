"""
Question Generator Module for Math Learning Game
Chương trình Kết nối tri thức - Lớp 1 (Đầy đủ 40 Bài)
"""

import random
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class QuestionType(Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    FILL_BLANK = "fill_blank"
    COMPARISON = "comparison"
    TRUE_FALSE = "true_false"
    SORTING = "sorting"
    SEARCH = "search"
    REFLEX = "reflex"

class Difficulty(Enum):
    EASY = 1
    MEDIUM = 2
    HARD = 3

@dataclass
class Question:
    question_text: str
    options: Optional[List[str]]
    correct_answer: str
    hint: str
    question_type: QuestionType
    difficulty: Difficulty
    grade: int
    lesson_id: int

class AdaptiveDifficulty:
    """Hệ thống điều chỉnh độ khó dựa trên trình độ người dùng"""
    def __init__(self):
        self.user_stats = {}
        self.base_difficulty = 0.5
    
    def update_user_performance(self, user_id: str, correct: bool, lesson_id: int):
        if user_id not in self.user_stats:
            self.user_stats[user_id] = {
                "total": 0,
                "correct": 0,
                "recent_streak": 0,
                "lesson_performance": {}
            }
        
        stats = self.user_stats[user_id]
        stats["total"] += 1
        if correct:
            stats["correct"] += 1
            stats["recent_streak"] += 1
        else:
            stats["recent_streak"] = 0
        
        if lesson_id not in stats["lesson_performance"]:
            stats["lesson_performance"][lesson_id] = {"correct": 0, "total": 0}
        stats["lesson_performance"][lesson_id]["total"] += 1
        if correct:
            stats["lesson_performance"][lesson_id]["correct"] += 1
    
    def get_user_difficulty(self, user_id: str, lesson_id: int = None) -> float:
        if user_id not in self.user_stats:
            return self.base_difficulty
        
        stats = self.user_stats[user_id]
        if stats["total"] == 0:
            return self.base_difficulty
        
        overall_accuracy = stats["correct"] / stats["total"]
        
        if lesson_id and lesson_id in stats["lesson_performance"]:
            lesson_stats = stats["lesson_performance"][lesson_id]
            if lesson_stats["total"] >= 3:
                lesson_accuracy = lesson_stats["correct"] / lesson_stats["total"]
                combined_accuracy = 0.7 * lesson_accuracy + 0.3 * overall_accuracy
            else:
                combined_accuracy = overall_accuracy
        else:
            combined_accuracy = overall_accuracy
        
        streak_bonus = min(0.1, stats["recent_streak"] * 0.01)
        difficulty = combined_accuracy + streak_bonus
        return min(1.0, max(0.0, difficulty))
    
    def should_increase_difficulty(self, user_id: str) -> bool:
        if user_id not in self.user_stats:
            return False
        stats = self.user_stats[user_id]
        return stats["recent_streak"] >= 5 and (stats["correct"] / stats["total"]) > 0.8

adaptive_difficulty = AdaptiveDifficulty()

class QuestionGenerator:
    """Module tạo câu hỏi tự động bám sát 100% SGK Toán 1 Kết nối tri thức"""
    
    def __init__(self):
        self.objects = ["quả cam", "con mèo", "con thỏ", "quả táo", "bông hoa", "viên bi", "cái kẹo", "quyển vở", "chiếc lá", "chiếc bút"]
        self.names = ["Lan", "Nam", "Mai", "Hoa", "Tuấn", "Minh", "Việt", "Mi", "Rô-bốt"]
        self.question_cache = {}
        
        self.lesson_structure = {
            1: {
                "count": 40,
                "topics": {
                    # TẬP 1
                    1: "Các số 0, 1, 2, 3, 4, 5",
                    2: "Các số 6, 7, 8, 9, 10",
                    3: "Nhiều hơn, ít hơn, bằng nhau",
                    4: "So sánh số",
                    5: "Mấy và mấy",
                    6: "Luyện tập chung",
                    7: "Hình vuông, hình tròn, hình tam giác, hình chữ nhật",
                    8: "Thực hành lắp ghép, xếp hình",
                    9: "Luyện tập chung",
                    10: "Phép cộng trong phạm vi 10",
                    11: "Phép trừ trong phạm vi 10",
                    12: "Bảng cộng, bảng trừ trong phạm vi 10",
                    13: "Luyện tập chung",
                    14: "Khối lập phương, khối hộp chữ nhật",
                    15: "Vị trí, định hướng trong không gian",
                    16: "Luyện tập chung",
                    17: "Ôn tập các số trong phạm vi 10",
                    18: "Ôn tập phép cộng, phép trừ trong phạm vi 10",
                    19: "Ôn tập hình học",
                    20: "Ôn tập chung học kì 1",
                    # TẬP 2
                    21: "Số có hai chữ số",
                    22: "So sánh số có hai chữ số",
                    23: "Bảng các số từ 1 đến 100",
                    24: "Luyện tập chung",
                    25: "Dài hơn, ngắn hơn",
                    26: "Đơn vị đo độ dài (cm)",
                    27: "Luyện tập chung",
                    28: "Phép cộng (không nhớ) trong phạm vi 100",
                    29: "Phép trừ (không nhớ) trong phạm vi 100",
                    30: "Phép cộng, trừ (không nhớ) trong phạm vi 100",
                    31: "Luyện tập chung",
                    32: "Xem đồng hồ, thời gian",
                    33: "Các ngày trong tuần",
                    34: "Xem lịch",
                    35: "Luyện tập chung",
                    36: "Ôn tập các số trong phạm vi 100",
                    37: "Ôn tập phép cộng, phép trừ",
                    38: "Ôn tập hình học và đo lường",
                    39: "Luyện tập chung",
                    40: "Ôn tập cuối năm"
                }
            }
        }
    
    def get_lesson_info(self, grade: int, lesson_id: int) -> Optional[Dict]:
        if grade not in self.lesson_structure: return None
        structure = self.lesson_structure[grade]
        if lesson_id < 1 or lesson_id > structure["count"]: return None
        return {
            "grade": grade, "lesson_id": lesson_id,
            "topic": structure["topics"].get(lesson_id, f"Bài {lesson_id}"),
            "total_lessons": structure["count"]
        }

    def _mix_options(self, correct_ans: str, w1: str, w2: str, w3: str) -> List[str]:
        opts = {str(correct_ans)}
        for w in [w1, w2, w3]:
            cand = str(w)
            while cand in opts or cand == "":
                if cand.isdigit() or (cand.startswith('-') and cand[1:].isdigit()):
                    cand = str(int(cand) + 1)
                else:
                    cand += " "
            opts.add(cand)
        final_list = list(opts)
        random.shuffle(final_list)
        return final_list
    
    def generate_question(self, grade: int, lesson_id: int, difficulty: Difficulty = Difficulty.MEDIUM, user_id: str = None) -> Question:
        if user_id:
            user_difficulty = adaptive_difficulty.get_user_difficulty(user_id, lesson_id)
            if user_difficulty < 0.33:
                difficulty = Difficulty.EASY
            elif user_difficulty < 0.66:
                difficulty = Difficulty.MEDIUM
            else:
                difficulty = Difficulty.HARD
        
        cache_key = f"{grade}_{lesson_id}_{difficulty}"
        if cache_key not in self.question_cache:
            self.question_cache[cache_key] = []
        
        max_attempts = 5
        for attempt in range(max_attempts):
            if grade == 1:
                q = self._generate_grade_1_question(lesson_id, difficulty)
            elif grade == 2:
                q = self._generate_grade_2_question(lesson_id, difficulty)
            elif grade == 3:
                q = self._generate_grade_3_question(lesson_id, difficulty)
            elif grade == 4:
                q = self._generate_grade_4_question(lesson_id, difficulty)
            elif grade == 5:
                q = self._generate_grade_5_question(lesson_id, difficulty)
            else:
                q = Question("1 + 1 = ?", ["1", "2", "3", "4"], "2", "Tính tổng", QuestionType.MULTIPLE_CHOICE, difficulty, grade, lesson_id)
            
            q_signature = f"{q.question_text}_{q.correct_answer}"
            recent_questions = self.question_cache[cache_key][-5:]
            
            if q_signature not in [f"{q.question_text}_{q.correct_answer}" for q in recent_questions]:
                self.question_cache[cache_key].append(q)
                if len(self.question_cache[cache_key]) > 20:
                    self.question_cache[cache_key].pop(0)
                return q
        
        if self.question_cache[cache_key]:
            return random.choice(self.question_cache[cache_key])
        
        if grade == 1:
            return self._generate_grade_1_question(lesson_id, difficulty)
        return Question("1 + 1 = ?", ["1", "2", "3", "4"], "2", "Tính tổng", QuestionType.MULTIPLE_CHOICE, difficulty, grade, lesson_id)
    
    def record_answer(self, user_id: str, lesson_id: int, correct: bool):
        adaptive_difficulty.update_user_performance(user_id, correct, lesson_id)
    
    def _generate_grade_1_question(self, lesson_id: int, difficulty: Difficulty) -> Question:
        """Sinh câu hỏi Lớp 1 chi tiết từng bài (1-41) - SGK Kết nối tri thức"""
        obj = random.choice(["quả táo", "con thỏ", "bông hoa", "viên bi", "quyển vở", "cái kẹo"])
        name = random.choice(["Lan", "Nam", "Mai", "Việt", "Mi", "Rô-bốt"])
        q, ans, hint = "", "", ""
        w1, w2, w3 = "", "", ""

        # ==========================================
        # HỌC KÌ 1 (Bài 1 - 20)
        # ==========================================
        if lesson_id in [1, 2, 6]: 
            n = random.randint(2, 8)
            q = f"Số nào đứng ngay trước số {n} khi ta đếm số?"
            ans = str(n - 1)
            w1, w2, w3 = str(n + 1), str(n), "0"
            hint = "Đếm ngược lại 1 số."

        elif lesson_id == 3: # Nhiều hơn, ít hơn, bằng nhau
            q = "Nhóm 5 con thỏ và nhóm 3 củ cà rốt. Nhóm nào nhiều hơn?"
            ans = "Nhóm con thỏ"
            w1, w2, w3 = "Nhóm củ cà rốt", "Bằng nhau", "Không biết"
            hint = "5 lớn hơn 3 nên nhóm thỏ nhiều hơn."

        elif lesson_id == 4: # So sánh số
            a, b = random.randint(0, 10), random.randint(0, 10)
            while a == b: b = random.randint(0, 10)
            q = f"Điền dấu thích hợp: {a} ... {b}"
            ans = ">" if a > b else "<"
            w1, w2, w3 = "<" if a > b else ">", "=", "+"
            hint = "Số đếm sau lớn hơn số đếm trước."

        elif lesson_id == 5: # Mấy và mấy (Tách - Gộp)
            a = random.randint(1, 5)
            b = random.randint(1, 4)
            q = f"Gộp {a} và {b} được mấy?"
            ans = str(a + b)
            w1, w2, w3 = str(a + b + 1), str(abs(a - b)), str(a + b - 1)
            hint = "Đếm tổng cả hai nhóm lại với nhau."

        elif lesson_id in [7, 8, 9]:
            q = "Hình nào có 4 cạnh bằng nhau và 4 góc vuông?"
            ans = "Hình vuông"
            w1, w2, w3 = "Hình tam giác", "Hình tròn", "Hình chữ nhật"
            hint = "Các cạnh của nó dài bằng nhau."

        elif lesson_id == 10: # Phép cộng trong phạm vi 10
            a = random.randint(1, 6)
            b = random.randint(1, 9 - a)
            q = f"Tính: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = str(a + b + 1), str(abs(a - b)), str(a + b - 1)
            hint = f"Đưa ra {a} ngón tay, bung thêm {b} ngón tay."

        elif lesson_id == 11: # Phép trừ trong phạm vi 10
            a = random.randint(5, 10)
            b = random.randint(1, a - 1)
            q = f"Tính: {a} - {b} = ?"
            ans = str(a - b)
            w1, w2, w3 = str(a - b + 1), str(a - b - 1), str(a + b)
            hint = f"Có {a}, cất đi {b} thì còn lại mấy?"

        elif lesson_id == 12: # Bảng cộng, trừ trong phạm vi 10
            a = random.randint(3, 8)
            q = f"Điền số thích hợp: {a} + ... = 10"
            ans = str(10 - a)
            w1, w2, w3 = str(10 - a + 1), str(10 - a - 1), str(a)
            hint = f"Đếm tiếp từ {a} đến 10 xem cần mấy ngón tay."

        elif lesson_id == 13: # Luyện tập chung (+, -)
            a = random.randint(6, 10)
            b = random.randint(1, a - 2)
            q = f"{name} có {a} cái kẹo, ăn mất {b} cái. {name} còn lại mấy cái kẹo?"
            ans = str(a - b)
            w1, w2, w3 = str(a + b), str(a - b + 1), str(a - b - 1)
            hint = "Ăn mất nghĩa là bớt đi, ta làm phép trừ."

        elif lesson_id == 14: # Khối lập phương, khối hộp chữ nhật
            q = "Cục Rubik là đồ vật có dạng khối gì?"
            ans = "Khối lập phương"
            w1, w2, w3 = "Khối hộp chữ nhật", "Khối cầu", "Khối trụ"
            hint = "Tất cả các mặt của cục Rubik đều là hình vuông."

        elif lesson_id == 15:
            q = "Khi đi bộ trên đường, chúng ta nên đi ở phía bên nào?"
            ans = "Bên phải"
            w1, w2, w3 = "Bên trái", "Ở giữa đường", "Phía sau"
            hint = "Đây là quy định an toàn giao thông."

        elif lesson_id == 16: # Luyện tập vị trí
            q = "Nếu cầm đũa bằng tay phải, thì bát cơm thường được cầm bằng tay nào?"
            ans = "Tay trái"
            w1, w2, w3 = "Tay phải", "Cả hai tay", "Không dùng tay"
            hint = "Một tay gắp thức ăn, tay còn lại đỡ bát cơm."

        elif lesson_id == 17: # Ôn tập các số phạm vi 10
            n = random.randint(1, 8)
            q = f"Các số được sắp xếp theo thứ tự từ bé đến lớn: {n}, {n+1}, ..., {n+3}. Số bị thiếu là?"
            ans = str(n + 2)
            w1, w2, w3 = str(n), str(n + 4), str(n - 1)
            hint = f"Đếm tiến lên: {n}, {n+1} rồi đến số mấy?"

        elif lesson_id == 18: # Ôn tập cộng trừ phạm vi 10
            a, b = random.randint(1, 5), random.randint(1, 4)
            q = f"Tính nhẩm: {a} + {b} - 1 = ?"
            ans = str(a + b - 1)
            w1, w2, w3 = str(a + b), str(a + b + 1), str(a + b - 2)
            hint = "Tính từ trái sang phải."

        elif lesson_id == 19: # Ôn tập hình học
            q = "Quyển sách Toán lớp 1 có mặt trước dạng hình gì?"
            ans = "Hình chữ nhật"
            w1, w2, w3 = "Hình vuông", "Hình tam giác", "Hình tròn"
            hint = "Sách có hai cạnh dài và hai cạnh ngắn."

        elif lesson_id == 20: # Ôn tập chung học kì 1
            a, b = random.randint(5, 9), random.randint(1, 4)
            q = f"Kết quả của phép tính {a} - {b} là:"
            ans = str(a - b)
            w1, w2, w3 = str(a - b + 1), str(a + b), str(a - b - 1)
            hint = "Đây là bài kiểm tra cuối kì, hãy tính cẩn thận."

        # ==========================================
        # HỌC KÌ 2 (Bài 21 - 41)
        # ==========================================
        elif lesson_id == 21: # Số có hai chữ số (11-20, tròn chục)
            chuc = random.randint(2, 9)
            q = f"Số gồm {chuc} chục và 0 đơn vị viết là:"
            ans = f"{chuc}0"
            w1, w2, w3 = f"{chuc}", f"{chuc}1", f"1{chuc}"
            hint = "Viết chữ số hàng chục rồi thêm số 0 ở hàng đơn vị."

        elif lesson_id == 22: # So sánh số có hai chữ số
            a = random.randint(20, 50)
            b = random.randint(60, 99)
            q = f"Điền dấu: {a} ... {b}"
            ans = "<"
            w1, w2, w3 = ">", "=", "+"
            hint = "So sánh chữ số hàng chục trước."

        elif lesson_id == 23: # Bảng các số từ 1 đến 100
            n = random.randint(40, 80)
            q = f"Số liền trước của {n} là:"
            ans = str(n - 1)
            w1, w2, w3 = str(n + 1), str(n - 10), str(n + 10)
            hint = "Đếm lùi lại 1 đơn vị."

        elif lesson_id == 24: # Luyện tập chung (Số đến 100)
            q = "Số lớn nhất có 2 chữ số là số nào?"
            ans = "99"
            w1, w2, w3 = "100", "98", "90"
            hint = "Đó là số ngay trước số 100."

        elif lesson_id == 25: # Dài hơn, ngắn hơn
            q = "Cái bút chì của em so với quyển vở thì như thế nào?"
            ans = "Ngắn hơn"
            w1, w2, w3 = "Dài hơn", "Bằng nhau", "Cao hơn"
            hint = "Em thường để lọt bút chì vào trong hộp bút hoặc vở."

        elif lesson_id == 26: # Đơn vị đo độ dài cm
            a = random.randint(3, 10)
            q = f"Băng giấy dài {a} cm. Cắt đi 2 cm thì còn lại mấy xăng-ti-mét?"
            ans = f"{a - 2} cm"
            w1, w2, w3 = f"{a + 2} cm", f"{a} cm", f"{a - 1} cm"
            hint = "Cắt đi nghĩa là làm phép trừ."

        elif lesson_id == 27: # Luyện tập đo lường
            q = "Dụng cụ nào dùng để kẻ đoạn thẳng dài 5 cm?"
            ans = "Thước có chia vạch cm"
            w1, w2, w3 = "Com-pa", "Cái cân", "Đồng hồ"
            hint = "Cần thước có các vạch số."

        elif lesson_id == 28: # Phép cộng KHÔNG NHỚ trong phạm vi 100
            # a_ones + b_ones < 10
            ao = random.randint(1, 5); at = random.randint(1, 7)
            bo = random.randint(1, 9 - ao); bt = random.randint(1, 8 - at)
            a = at * 10 + ao; b = bt * 10 + bo
            q = f"Tính: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = str(a + b + 10), str(a + b - 10), str(a + b + 1)
            hint = "Cộng đơn vị với đơn vị, chục với chục."

        elif lesson_id == 29: # Phép trừ KHÔNG NHỚ trong phạm vi 100
            # ao >= bo
            at = random.randint(3, 9); ao = random.randint(3, 9)
            bt = random.randint(1, at - 1); bo = random.randint(1, ao)
            a = at * 10 + ao; b = bt * 10 + bo
            q = f"Tính: {a} - {b} = ?"
            ans = str(a - b)
            w1, w2, w3 = str(a - b + 10), str(a - b - 10), str(a - b + 1)
            hint = "Trừ đơn vị cho đơn vị, chục cho chục."

        elif lesson_id == 30: # Luyện tập cộng trừ
            # Phép tính với số tròn chục
            a = random.randint(2, 5) * 10; b = random.randint(1, 4) * 10
            q = f"Tính nhẩm: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = str(a + b + 10), str(abs(a - b)), str(a + b - 10)
            hint = f"Lấy {a//10} chục cộng {b//10} chục."

        elif lesson_id == 31: # Luyện tập chung tính toán
            ao = random.randint(2, 8); bo = random.randint(1, 9 - ao)
            a = 30 + ao; b = 20 + bo
            q = f"Kết quả của {a} + {b} là:"
            ans = str(a + b)
            w1, w2, w3 = str(a + b + 1), str(a + b - 10), str(a + b + 10)
            hint = "Đặt tính thẳng cột rồi tính."

        elif lesson_id == 32: # Xem đồng hồ
            h = random.randint(1, 12)
            q = f"Kim ngắn chỉ số {h}, kim dài chỉ số 12. Bây giờ là mấy giờ?"
            ans = f"{h} giờ"
            w1, w2, w3 = f"{h+1} giờ", "12 giờ", f"{h-1} giờ" if h>1 else "11 giờ"
            hint = "Kim ngắn (kim giờ) chỉ vào số nào thì là giờ đó."

        elif lesson_id == 33: # Các ngày trong tuần
            q = "Hôm nay là Thứ Tư. Ngày mai là thứ mấy?"
            ans = "Thứ Năm"
            w1, w2, w3 = "Thứ Ba", "Thứ Sáu", "Thứ Hai"
            hint = "Sau Thứ Tư là ngày nào?"

        elif lesson_id == 34: # Xem lịch
            q = "Các ngày nghỉ cuối tuần thường là ngày nào?"
            ans = "Thứ Bảy, Chủ Nhật"
            w1, w2, w3 = "Thứ Hai, Thứ Ba", "Thứ Sáu, Thứ Bảy", "Chủ Nhật, Thứ Hai"
            hint = "Ngày em không phải đi học."

        elif lesson_id == 35: # Luyện tập chung thời gian
            q = "Lúc 12 giờ trưa, hai kim đồng hồ (kim giờ và kim phút) nằm ở đâu?"
            ans = "Cùng chỉ vào số 12"
            w1, w2, w3 = "Chỉ số 6 và 12", "Chỉ số 3 và 9", "Chỉ số 1 và 12"
            hint = "12 giờ đúng thì kim dài và kim ngắn chập lại."

        elif lesson_id == 36: # Ôn tập các số phạm vi 100
            n = random.randint(50, 90)
            q = f"Số {n} gồm mấy chục và mấy đơn vị?"
            ans = f"{n//10} chục và {n%10} đơn vị"
            w1, w2, w3 = f"{n%10} chục và {n//10} đơn vị", f"{n//10} chục", f"{n} chục"
            hint = "Phân tích cấu tạo số từ trái qua phải."

        elif lesson_id == 37: # Ôn tập phép cộng, phép trừ
            a = random.randint(40, 80); b = random.randint(1, 9)
            q = f"Tính nhẩm: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = str(a + b + 10), str(a + b - 1), str(a)
            hint = "Cộng số đơn vị vào nhau."

        elif lesson_id == 38: # Ôn tập hình học và đo lường
            q = "Vật nào sau đây dùng để xem giờ?"
            ans = "Đồng hồ"
            w1, w2, w3 = "Cái cân", "Thước kẻ", "Quyển sách"
            hint = "Vật có kim chỉ số hoặc hiện số giờ."

        elif lesson_id in [39, 40]: # Luyện tập chung cuối năm
            ao = random.randint(5, 9); at = random.randint(5, 9)
            b = random.randint(1, ao)
            a = at * 10 + ao
            q = f"Ôn tập: {a} - {b} = ?"
            ans = str(a - b)
            w1, w2, w3 = str(a - b + 10), str(a - b - 10), str(a + b)
            hint = "Tính cẩn thận không có nhớ."

        elif lesson_id == 41: # Ôn tập cuối năm (Bài cuối cùng)
            n = random.randint(20, 80)
            q = f"Bài thi cuối kì: Số liền sau của {n} lớn hơn số liền trước của {n} mấy đơn vị?"
            ans = "2 đơn vị"
            w1, w2, w3 = "1 đơn vị", "3 đơn vị", "Bằng nhau"
            hint = f"Số liền sau là {n+1}, số liền trước là {n-1}. Lấy {n+1} trừ đi {n-1}."

        # Đề phòng lỗi (fallback)
        else:
            q = f"Tính nhanh: {lesson_id} - 1 = ?"
            ans = str(lesson_id - 1)
            w1, w2, w3 = str(lesson_id), str(lesson_id + 1), "0"
            hint = "Lùi lại 1 đơn vị."

        opts = self._mix_options(ans, w1, w2, w3)
        return Question(q, opts[:4], ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 1, lesson_id)
        
    def to_json(self, question: Question) -> Dict:
        return {
            "question_text": question.question_text,
            "options": question.options,
            "correct_answer": question.correct_answer,
            "hint": question.hint,
            "question_type": question.question_type.value,
            "difficulty": question.difficulty.value,
            "grade": question.grade,
            "lesson_id": question.lesson_id
        }

    def _generate_grade_2_question(self, lesson_id: int, difficulty: Difficulty) -> Question:
        """Sinh câu hỏi Lớp 2 bám sát SGK Kết nối tri thức (Đầy đủ 75 Bài)"""
        obj = random.choice(self.objects)
        name = random.choice(self.names)
        
        q, ans, hint = "", "", ""
        w1, w2, w3 = "", "", ""
        
        # ==========================================
        # CHỦ ĐỀ 1: ÔN TẬP VÀ BỔ SUNG (Bài 1 - 6)
        # ==========================================
        if lesson_id == 1: # Ôn tập các số đến 100
            val = random.randint(20, 99)
            if random.choice([True, False]):
                q = f"Số {val} gồm mấy chục và mấy đơn vị?"
                ans = f"{val//10} chục {val%10} đơn vị"
                w1, w2, w3 = f"{val%10} chục {val//10} đơn vị", f"{val//10} chục", f"{val%10} đơn vị"
                hint = "Chữ số phía trước là hàng chục, phía sau là hàng đơn vị."
            else:
                q = f"Số gồm {val//10} chục và {val%10} đơn vị được viết là:"
                ans = str(val)
                w1, w2, w3 = f"{val%10}{val//10}", str(val+10), str(val-10)
                hint = "Ghép chữ số hàng chục và hàng đơn vị lại với nhau."

        elif lesson_id == 2: # Tia số. Số liền trước, số liền sau
            n = random.randint(10, 90)
            if random.choice([True, False]):
                q = f"Trên tia số, số liền sau của {n} là số nào?"; ans = str(n + 1)
            else:
                q = f"Trên tia số, số liền trước của {n} là số nào?"; ans = str(n - 1)
            w1, w2, w3 = str(n), str(n+2), str(n-2)
            hint = "Số liền trước trừ đi 1, số liền sau cộng thêm 1."

        elif lesson_id == 3: # Các thành phần của phép cộng, phép trừ
            a, b = random.randint(10, 40), random.randint(10, 40)
            if random.choice([True, False]):
                q = f"Trong phép tính {a} + {b} = {a+b}, số {a} được gọi là gì?"; ans = "Số hạng"
                w1, w2, w3 = "Tổng", "Số bị trừ", "Hiệu"
            else:
                while a < b: a, b = b, a
                q = f"Trong phép tính {a} - {b} = {a-b}, số {a} được gọi là gì?"; ans = "Số bị trừ"
                w1, w2, w3 = "Số trừ", "Hiệu", "Số hạng"
            hint = "Phép cộng có 'Số hạng' và 'Tổng'. Phép trừ có 'Số bị trừ', 'Số trừ' và 'Hiệu'."

        elif lesson_id == 4: # Hơn, kém nhau bao nhiêu
            a = random.randint(20, 50); b = random.randint(5, 15)
            q = f"Lớp 2A có {a} bạn, lớp 2B có {a-b} bạn. Lớp 2A nhiều hơn lớp 2B bao nhiêu bạn?"
            ans = f"{b} bạn"
            w1, w2, w3 = f"{b+2} bạn", f"{b-2} bạn", f"{a} bạn"
            hint = "Lấy số lớn trừ đi số bé để tìm phần hơn kém."

        elif lesson_id in [5, 6]: # Luyện tập phép cộng, trừ không nhớ
            a = random.randint(2, 8)*10 + random.randint(5, 9)
            b = random.randint(1, a//10)*10 + random.randint(1, a%10)
            if random.choice([True, False]):
                val = random.randint(1, 9 - a%10)
                q = f"Tính nhẩm: {a} + {val} = ?"; ans = str(a + val)
            else:
                q = f"Tính: {a} - {b} = ?"; ans = str(a - b)
            w1, w2, w3 = str(int(ans)+10), str(int(ans)-10), str(int(ans)+1)
            hint = "Cộng/trừ hàng đơn vị với đơn vị, chục với chục."

        # ==========================================
        # CHỦ ĐỀ 2: PHÉP CỘNG, PHÉP TRỪ (QUA 10) TRONG PHẠM VI 20
        # ==========================================
        elif lesson_id in [7, 8, 10]: # Phép cộng (qua 10) / Bảng cộng
            a = random.randint(5, 9); b = random.randint(11-a, 9)
            ans = str(a + b)
            q = f"Tính: {a} + {b} = ?"
            w1, w2, w3 = str(int(ans)+1), str(int(ans)-1), str(int(ans)+10)
            hint = f"Tách {b} thành ({10-a}) và {b-(10-a)} để tạo thành 10 rồi cộng phần còn lại."

        elif lesson_id == 9: # Bài toán về thêm, bớt một số đơn vị
            a = random.randint(5, 15); b = random.randint(2, 8)
            if random.choice([True, False]):
                q = f"Trên sân có {a} bạn, thêm {b} bạn chạy tới. Có tất cả bao nhiêu bạn?"; ans = str(a+b)
            else:
                q = f"Trong rổ có {a+b} {obj}, lấy ra {b} {obj}. Còn lại mấy {obj}?"; ans = str(a)
            w1, w2, w3 = str(int(ans)+1), str(max(0, int(ans)-1)), str(int(ans)+2)
            hint = "Thêm vào thì dùng phép cộng, bớt đi thì dùng phép trừ."

        elif lesson_id in [11, 12, 14]: # Phép trừ (qua 10) / Bảng trừ
            a = random.randint(11, 18); b = random.randint(a%10 + 1, 9)
            ans = str(a - b)
            q = f"Tính: {a} - {b} = ?"
            w1, w2, w3 = str(int(ans)+1), str(int(ans)-1), str(int(ans)+10)
            hint = "Trừ để được 10 rồi trừ tiếp phần còn lại."

        elif lesson_id == 13: # Bài toán về nhiều hơn, ít hơn một số đơn vị
            a = random.randint(15, 30); b = random.randint(5, 12)
            if random.choice([True, False]):
                q = f"{name} có {a} viên bi, Rô-bốt có nhiều hơn {name} {b} viên. Hỏi Rô-bốt có bao nhiêu viên bi?"
                ans = str(a + b)
            else:
                q = f"Thùng đỏ có {a} lít nước, thùng xanh có ít hơn thùng đỏ {b} lít. Thùng xanh có bao nhiêu lít?"
                ans = str(a - b)
            w1, w2, w3 = str(int(ans)+b), str(int(ans)-b), str(a)
            hint = "Nhiều hơn dùng phép cộng, ít hơn dùng phép trừ."

        # ==========================================
        # CHỦ ĐỀ 3: KHỐI LƯỢNG, DUNG TÍCH (Bài 15 - 18)
        # ==========================================
        elif lesson_id == 15: # Ki-lô-gam
            a, b = random.randint(5, 30), random.randint(2, 10)
            q = f"Bao gạo nặng {a} kg, túi đường nặng {b} kg. Cả hai nặng bao nhiêu?"
            ans = f"{a+b} kg"
            w1, w2, w3 = f"{a-b} kg", f"{a+b+1} kg", f"{a+b} lít"
            hint = "Cộng các số đo khối lượng lại với nhau."

        elif lesson_id == 16: # Lít
            a, b = random.randint(10, 40), random.randint(5, 20)
            q = f"Can to chứa {a} l nước, dùng hết {b} l. Còn lại bao nhiêu?"
            ans = f"{a-b} l"
            w1, w2, w3 = f"{a+b} l", f"{a-b+1} l", f"{a-b} kg"
            hint = "Trừ đi phần nước đã sử dụng."

        elif lesson_id in [17, 18]: # Thực hành / Luyện tập đo lường
            if random.choice([True, False]):
                q = "Đơn vị nào dùng để đo lượng nước trong chai?"; ans = "lít (l)"
                w1, w2, w3 = "ki-lô-gam (kg)", "xăng-ti-mét (cm)", "giờ"
            else:
                q = "Đơn vị nào dùng để cân quả dưa hấu?"; ans = "ki-lô-gam (kg)"
                w1, w2, w3 = "lít (l)", "mét (m)", "ngày"
            hint = "Chất lỏng đo bằng lít, vật nặng đo bằng ki-lô-gam."

        # ==========================================
        # CHỦ ĐỀ 4: CỘNG TRỪ CÓ NHỚ PHẠM VI 100 (Bài 19 - 24)
        # ==========================================
        elif lesson_id in [19, 20, 21]: # Phép cộng có nhớ
            a = random.randint(15, 75); b = random.randint(5, 89-a)
            while (a%10 + b%10) < 10: b = random.randint(5, 89-a) # Ép buộc có nhớ
            ans = str(a + b)
            q = f"Đặt tính rồi tính: {a} + {b} = ?"
            w1, w2, w3 = str(int(ans)-10), str(int(ans)+10), str(int(ans)+1)
            hint = "Cộng hàng đơn vị, nếu bằng 10 trở lên thì viết đơn vị, nhớ 1 sang hàng chục."

        elif lesson_id in [22, 23, 24]: # Phép trừ có nhớ
            a = random.randint(30, 95); b = random.randint(8, a-1)
            while (a%10) >= (b%10): b = random.randint(8, a-1) # Ép buộc có mượn
            ans = str(a - b)
            q = f"Tìm hiệu của {a} và {b}:"
            w1, w2, w3 = str(int(ans)+10), str(int(ans)-10), str(int(ans)-1)
            hint = "Hàng đơn vị không trừ được, mượn 1 chục rồi trừ, sau đó nhớ trả 1 vào hàng chục của số trừ."

        # ==========================================
        # CHỦ ĐỀ 5 & 6: HÌNH PHẲNG VÀ THỜI GIAN (Bài 25 - 32)
        # ==========================================
        elif lesson_id == 25: # Điểm, đoạn thẳng, ba điểm thẳng hàng
            q = "Ba điểm cùng nằm trên một đường thẳng được gọi là gì?"
            ans = "Ba điểm thẳng hàng"
            w1, w2, w3 = "Ba điểm cong", "Ba điểm tam giác", "Ba điểm bất kì"
            hint = "Hãy nhớ lại hình ảnh dùng thước kẻ vạch một đường thẳng qua 3 điểm."

        elif lesson_id == 26: # Đường gấp khúc. Hình tứ giác
            a, b, c = random.randint(2,5), random.randint(2,5), random.randint(2,5)
            q = f"Đường gấp khúc gồm 3 đoạn thẳng dài {a}cm, {b}cm, {c}cm. Độ dài đường gấp khúc là?"
            ans = f"{a+b+c} cm"
            w1, w2, w3 = f"{a+b} cm", f"{b+c} cm", f"{a+b+c+1} cm"
            hint = "Độ dài đường gấp khúc bằng tổng độ dài các đoạn thẳng cộng lại."

        elif lesson_id in [27, 28]: # Thực hành hình học
            q = "Hình nào có 4 cạnh và 4 đỉnh?"
            ans = "Hình tứ giác"
            w1, w2, w3 = "Hình tam giác", "Hình tròn", "Đường gấp khúc"
            hint = "Tứ nghĩa là 4."

        elif lesson_id == 29: # Ngày-giờ, giờ-phút
            if random.choice([True,False]):
                q = "Một ngày có bao nhiêu giờ?"; ans = "24 giờ"
                w1, w2, w3 = "12 giờ", "60 giờ", "7 ngày"
            else:
                q = "1 giờ bằng bao nhiêu phút?"; ans = "60 phút"
                w1, w2, w3 = "30 phút", "24 phút", "100 phút"
            hint = "Ghi nhớ quy tắc thời gian trên mặt đồng hồ."

        elif lesson_id in [30, 31, 32]: # Ngày tháng, xem lịch
            m = random.randint(1, 12)
            q = f"Tháng {m} có bao nhiêu ngày?"
            if m in [1,3,5,7,8,10,12]: ans = "31 ngày"
            elif m == 2: ans = "28 hoặc 29 ngày"
            else: ans = "30 ngày"
            w1, w2, w3 = "31 ngày", "30 ngày", "28 hoặc 29 ngày"
            if ans == w1: w1 = "32 ngày"
            if ans == w2: w2 = "27 ngày"
            if ans == w3: w3 = "25 ngày"
            hint = "Sử dụng quy tắc nắm tay để tính số ngày trong tháng."
            
        # ==========================================
        # CHỦ ĐỀ 7: ÔN TẬP HỌC KÌ 1 (Bài 33 - 36)
        # ==========================================
        elif lesson_id in range(33, 37):
            t = random.choice(["tinhtoan", "hinhhoc", "thoigian"])
            if t == "tinhtoan":
                a = random.randint(30, 90); b = random.randint(15, 25)
                q = f"Ôn tập: {a} - {b} = ?"; ans = str(a-b)
                w1, w2, w3 = str(int(ans)+10), str(int(ans)-10), str(int(ans)+1)
            elif t == "hinhhoc":
                q = "Hình có 3 cạnh gọi là hình gì?"; ans = "Hình tam giác"
                w1, w2, w3 = "Hình tứ giác", "Hình vuông", "Hình chữ nhật"
            else:
                q = "Đơn vị đo khối lượng là gì?"; ans = "kg"
                w1, w2, w3 = "lít", "cm", "giờ"
            hint = "Đọc kỹ câu hỏi để nhớ lại kiến thức Học kì 1."
            
        # ==========================================
        # CHỦ ĐỀ 8: PHÉP NHÂN, PHÉP CHIA (Bài 37 - 45)
        # ==========================================
        elif lesson_id == 37: # Phép nhân
            a = random.randint(2, 5); b = random.randint(2, 4)
            tong = " + ".join([str(a)] * b)
            q = f"Chuyển tổng sau thành phép nhân: {tong} = ?"
            ans = f"{a} x {b}"
            w1, w2, w3 = f"{a} x {b+1}", f"{b} x {a}", f"{a} + {b}"
            hint = f"Số {a} được lấy {b} lần."
            
        elif lesson_id == 38: # Thừa số, Tích
            a, b = random.choice([2, 5]), random.randint(1, 10)
            q = f"Trong phép tính {a} x {b} = {a*b}, số {a*b} được gọi là gì?"
            ans = "Tích"
            w1, w2, w3 = "Thừa số", "Tổng", "Số bị chia"
            hint = "Kết quả của phép nhân gọi là Tích."
            
        elif lesson_id == 39: # Bảng nhân 2
            b = random.randint(1, 10)
            q = f"Tính nhẩm: 2 x {b} = ?"
            ans = str(2 * b)
            w1, w2, w3 = str(int(ans)+2), str(int(ans)-2), str(int(ans)+1)
            hint = "Đếm thêm 2 hoặc cộng 2 nhiều lần."
            
        elif lesson_id == 40: # Bảng nhân 5
            b = random.randint(1, 10)
            q = f"Mỗi bàn tay có 5 ngón tay. Hỏi {b} bàn tay có bao nhiêu ngón tay?"
            ans = str(5 * b)
            w1, w2, w3 = str(int(ans)+5), str(int(ans)-5), "10"
            hint = "Sử dụng bảng nhân 5: đếm thêm 5."
            
        elif lesson_id == 41: # Phép chia
            a = random.choice([2, 5]); b = random.randint(1, 5)
            q = f"Có {a * b} quả cam chia đều vào {a} đĩa. Mỗi đĩa có mấy quả?"
            ans = str(b)
            w1, w2, w3 = str(b+1), str(b+2), str(a)
            hint = "Dựa vào phép nhân tương ứng để tìm kết quả phép chia."
            
        elif lesson_id == 42: # Số bị chia, Số chia, Thương
            q = "Trong phép tính 10 : 2 = 5, số 2 được gọi là gì?"
            ans = "Số chia"
            w1, w2, w3 = "Số bị chia", "Thương", "Số hạng"
            hint = "Số bị chia đứng trước, số chia đứng sau dấu chia."
            
        elif lesson_id == 43: # Bảng chia 2
            b = random.randint(1, 10)
            q = f"Tính: {2 * b} : 2 = ?"
            ans = str(b)
            w1, w2, w3 = str(b+1), str(abs(b-1)), "2"
            hint = "Nhẩm xem 2 nhân mấy thì bằng Số bị chia."
            
        elif lesson_id == 44: # Bảng chia 5
            b = random.randint(1, 10)
            q = f"Tính: {5 * b} : 5 = ?"
            ans = str(b)
            w1, w2, w3 = str(b+1), str(abs(b-1)), "5"
            hint = "Nhẩm xem 5 nhân mấy thì bằng Số bị chia."
            
        elif lesson_id == 45: # Luyện tập chung - nhân chia
            if random.choice([True, False]):
                a = random.choice([2, 5]); b = random.randint(1, 10)
                q = f"Tính: {a} x {b} = ?"; ans = str(a * b)
            else:
                a = random.choice([2, 5]); b = random.randint(1, 10)
                q = f"Tính: {a * b} : {a} = ?"; ans = str(b)
            w1, w2, w3 = str(int(ans)+1), str(abs(int(ans)-1)), str(int(ans)+2)
            hint = "Ôn tập mối quan hệ giữa phép nhân và phép chia."

        # ==========================================
        # CHỦ ĐỀ 9: HÌNH KHỐI (Bài 46 - 47)
        # ==========================================
        elif lesson_id == 46: # Khối trụ, khối cầu
            items = {"Hộp sữa đặc": "Khối trụ", "Quả bóng đá": "Khối cầu", "Lon nước ngọt": "Khối trụ", "Viên bi": "Khối cầu"}
            item = random.choice(list(items.keys()))
            ans = items[item]
            q = f"Vật '{item}' có dạng hình khối nào?"
            w1, w2, w3 = "Khối lập phương", "Khối hộp chữ nhật", "Hình tròn"
            hint = "Khối trụ có hai mặt đáy hình tròn, khối cầu thì tròn xoe lăn được."
            
        elif lesson_id == 47: # Luyện tập chung - hình khối
            q = "Khối nào có hai mặt phẳng ở hai đầu hình tròn?"
            ans = "Khối trụ"
            w1, w2, w3 = "Khối cầu", "Khối lập phương", "Khối hộp chữ nhật"
            hint = "Nhớ lại hình dáng của một chiếc cột hoặc hộp sữa."
            
        # ==========================================
        # CHỦ ĐỀ 10: CÁC SỐ ĐẾN 1000 (Bài 48 - 53)
        # ==========================================
        elif lesson_id == 48: # Đơn vị, chục, trăm, nghìn
            q = "10 trăm bằng bao nhiêu?"
            ans = "1 nghìn"
            w1, w2, w3 = "1 trăm", "10 chục", "10 nghìn"
            hint = "Quy luật: 10 đơn vị = 1 chục, 10 chục = 1 trăm, 10 trăm = ..."

        elif lesson_id in [49, 50, 51]: # Các số có 3 chữ số
            tram = random.randint(1, 9); chuc = random.randint(0, 9); donvi = random.randint(0, 9)
            val = tram*100 + chuc*10 + donvi
            q = f"Số gồm {tram} trăm, {chuc} chục và {donvi} đơn vị là số nào?"
            ans = str(val)
            w1, w2, w3 = f"{chuc}{tram}{donvi}", f"{tram}{donvi}{chuc}", str(val+10)
            hint = "Ghép lần lượt hàng trăm, hàng chục, hàng đơn vị."

        elif lesson_id in [52, 53]: # Viết số thành tổng, so sánh
            a, b = random.randint(100, 999), random.randint(100, 999)
            while a == b: b = random.randint(100, 999)
            ans = ">" if a > b else "<"
            q = f"Điền dấu thích hợp: {a} ... {b}"
            w1, w2, w3 = ">", "<", "="
            hint = "So sánh từ hàng trăm, rồi đến hàng chục, hàng đơn vị."

        # ==========================================
        # CHỦ ĐỀ 11: ĐO LƯỜNG (Bài 54 - 59)
        # ==========================================
        elif lesson_id == 54: # Mét (m)
            q = "1 mét bằng bao nhiêu xăng-ti-mét?"
            ans = "100 cm"
            w1, w2, w3 = "10 cm", "1000 cm", "50 cm"
            hint = "1 m = 100 cm."
            
        elif lesson_id == 55: # Kilômét (km)
            q = "1 kilômét bằng bao nhiêu mét?"
            ans = "1000 m"
            w1, w2, w3 = "100 m", "10000 m", "10 m"
            hint = "1 km = 1000 m."
            
        elif lesson_id == 56: # Milimét (mm)
            q = "1 xăng-ti-mét bằng bao nhiêu mi-li-mét?"
            ans = "10 mm"
            w1, w2, w3 = "100 mm", "1 mm", "5 mm"
            hint = "1 cm = 10 mm."
            
        elif lesson_id in [57, 58, 59]: # Luyện tập chung - đo lường
            q = "Trong các đơn vị đo độ dài sau, đơn vị nào lớn nhất?"
            ans = "km"
            w1, w2, w3 = "m", "cm", "mm"
            hint = "Sắp xếp: mm < cm < m < km."
            
        # ==========================================
        # CHỦ ĐỀ 12: PHÉP TÍNH TRONG PHẠM VI 1000 (Bài 60 - 65)
        # ==========================================
        elif lesson_id in [60, 61]: # Phép cộng, trừ không nhớ
            a = random.randint(1, 8)*100 + random.randint(1, 8)*10 + random.randint(1, 8)
            b = random.randint(1, 9 - a//100)*100 + random.randint(1, 9 - (a%100)//10)*10 + random.randint(1, 9 - a%10)
            q = f"Tính: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = str(a+b+10), str(a+b-100), str(a+b+1)
            hint = "Cộng lần lượt hàng đơn vị, hàng chục, hàng trăm."
            
        elif lesson_id in [62, 63, 64, 65]: # Phép cộng, trừ có nhớ
            a = random.randint(100, 900); b = random.randint(10, 100)
            if random.choice([True, False]):
                while (a%10 + b%10) < 10: b = random.randint(10, 100) # Ép có nhớ
                q = f"Tính: {a} + {b} = ?"; ans = str(a + b)
            else:
                while (a%10) >= (b%10): b = random.randint(10, 100) # Ép có mượn
                q = f"Tính: {a} - {b} = ?"; ans = str(a - b)
            w1, w2, w3 = str(int(ans)+10), str(int(ans)-10), str(int(ans)+100)
            hint = "Chú ý việc nhớ/mượn sang hàng tiếp theo bên trái."
            
        # ==========================================
        # CHỦ ĐỀ 13: THỐNG KÊ VÀ XÁC SUẤT (Bài 66 - 70)
        # ==========================================
        elif lesson_id in [66, 67, 68]: # Thu thập, kiểm đếm, biểu đồ tranh
            q = "Đâu là cách ghi chép số lượng thường dùng khi kiểm đếm nhanh?"
            ans = "Gạch chéo hoặc dùng vạch đánh dấu"
            w1, w2, w3 = "Dùng máy tính", "Vẽ hình chi tiết", "Đo bằng thước kẻ"
            hint = "Nhớ lại cách ta đếm số lượng xe cộ hoặc con vật bằng vạch."

        elif lesson_id in [69, 70]: # Chắc chắn, có thể, không thể
            t = random.choice(["chắc chắn", "có thể", "không thể"])
            if t == "chắc chắn":
                q = "Mặt trời mọc ở hướng Đông là hiện tượng..."; ans = "Chắc chắn"
            elif t == "có thể":
                q = "Hôm nay trời đổ mưa là hiện tượng..."; ans = "Có thể"
            else:
                q = "Con lợn biết bay là hiện tượng..."; ans = "Không thể"
            w1, w2, w3 = "Chắc chắn", "Có thể", "Không thể"
            if ans == w1: w1 = "Không biết"
            hint = "Đánh giá mức độ thực tế của sự việc."
            
        # ==========================================
        # CHỦ ĐỀ 14: ÔN TẬP CUỐI NĂM (Bài 71 - 75)
        # ==========================================
        else: # Từ bài 71 đến 75
            t = random.choice(["so", "tinhtoan", "hinhhoc"])
            if t == "so":
                n = random.randint(100, 999)
                q = f"Số {n} có mấy chữ số?"; ans = "3 chữ số"
                w1, w2, w3 = "2 chữ số", "4 chữ số", "1 chữ số"
            elif t == "tinhtoan":
                a, b = random.randint(100, 500), random.randint(100, 400)
                q = f"Tính: {a} + {b} = ?"; ans = str(a + b)
                w1, w2, w3 = str(a+b+100), str(a+b-100), str(a+b+10)
            else:
                q = "Khối nào có thể lăn được dễ dàng trên mặt đất?"
                ans = "Khối cầu"
                w1, w2, w3 = "Khối lập phương", "Khối trụ", "Khối hộp chữ nhật"
            hint = "Ôn tập tổng hợp kiến thức toán lớp 2."

        opts = self._mix_options(ans, w1, w2, w3)
        return Question(q, opts[:4], ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 2, lesson_id)
    def _generate_grade_3_question(self, lesson_id: int, difficulty: Difficulty) -> Question:
        """Sinh câu hỏi Lớp 3 chi tiết cho toàn bộ 76 bài - SGK Kết nối tri thức"""
        obj = random.choice(self.objects)
        name = random.choice(self.names)
        q, ans, hint = "", "", ""
        w1, w2, w3 = "", "", ""

        # ==========================================
        # CHỦ ĐỀ 1: ÔN TẬP VÀ BỔ SUNG
        # ==========================================
        if lesson_id == 1: # Ôn tập các số đến 1000
            val = random.randint(100, 999)
            q = f"Số {val} được phân tích thành:"
            ans = f"{val//100*100} + {val%100//10*10} + {val%10}"
            w1 = f"{val//100} + {val%100//10} + {val%10}"
            w2 = f"{val//100*100} + {val%100}"
            w3 = f"{val} + 0 + 0"
            hint = "Phân tích theo giá trị của hàng trăm, hàng chục và hàng đơn vị."

        elif lesson_id == 2: # Ôn tập phép cộng, phép trừ trong phạm vi 1000
            a, b = random.randint(100, 500), random.randint(100, 400)
            q = f"Đặt tính rồi tính: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = str(a + b + 10), str(a + b - 10), str(a + b + 100)
            hint = "Cộng lần lượt từ hàng đơn vị sang trái."

        elif lesson_id == 3: # Tìm thành phần trong phép cộng, phép trừ
            a = random.randint(50, 100); b = random.randint(10, 40)
            q = f"Tìm x biết: x - {b} = {a}"
            ans = str(a + b)
            w1, w2, w3 = str(a - b), str(a), str(b)
            hint = "Muốn tìm số bị trừ, ta lấy hiệu cộng với số trừ."

        elif lesson_id == 4: # Ôn tập bảng nhân 2, 5; bảng chia 2, 5
            a = random.choice([2, 5]); b = random.randint(1, 10)
            q = f"Tính nhẩm: {a} x {b} = ?"
            ans = str(a * b)
            w1, w2, w3 = str(a * b + a), str(a * b - a), str(a + b)
            hint = f"Nhớ lại bảng nhân {a} đã học ở lớp 2."

        elif lesson_id == 5: # Ôn tập hình học và đo lường
            q = "Dụng cụ nào sau đây dùng để đo độ dài?"
            ans = "Thước kẻ"
            w1, w2, w3 = "Cái cân", "Đồng hồ", "Nhiệt kế"
            hint = "Độ dài được đo bằng các đơn vị như cm, m."

        # ==========================================
        # CHỦ ĐỀ 2: BẢNG NHÂN, BẢNG CHIA 6, 7, 8, 9
        # ==========================================
        elif lesson_id == 6: # Bảng nhân 6
            b = random.randint(1, 10)
            q = f"Mỗi hộp có 6 cái bút. Hỏi {b} hộp có bao nhiêu cái bút?"
            ans = str(6 * b)
            w1, w2, w3 = str(6 * b + 6), str(6 * b - 6), str(b + 6)
            hint = "Sử dụng bảng nhân 6."

        elif lesson_id == 7: # Bảng chia 6
            b = random.randint(1, 10); prod = 6 * b
            q = f"Có {prod} {obj} chia đều cho 6 bạn. Mỗi bạn được mấy {obj}?"
            ans = str(b)
            w1, w2, w3 = str(b + 1), str(abs(b - 1)), "6"
            hint = "Nhẩm xem 6 nhân mấy bằng " + str(prod) + "."

        elif lesson_id == 8: # Nhân số có hai chữ số với số có một chữ số
            a = random.randint(11, 24); b = random.randint(2, 4)
            q = f"Tính: {a} x {b} = ?"
            ans = str(a * b)
            w1, w2, w3 = str(a * b + 10), str(a * b - 10), str(a + b)
            hint = "Nhân từ hàng đơn vị rồi đến hàng chục."

        elif lesson_id == 9: # Bảng nhân 7
            b = random.randint(1, 10)
            q = f"Tính nhẩm: 7 x {b} = ?"
            ans = str(7 * b)
            w1, w2, w3 = str(7 * b + 7), str(7 * b - 7), str(b + 7)
            hint = "Sử dụng bảng nhân 7."

        elif lesson_id == 10: # Bảng chia 7
            b = random.randint(1, 10); prod = 7 * b
            q = f"Tính: {prod} : 7 = ?"
            ans = str(b)
            w1, w2, w3 = str(b + 1), str(abs(b - 1)), "7"
            hint = "Dựa vào bảng nhân 7 để tính."

        elif lesson_id == 11: # Bảng nhân 8
            b = random.randint(1, 10)
            q = f"Một con cua có 8 cẳng. Hỏi {b} con cua có bao nhiêu cẳng?"
            ans = str(8 * b)
            w1, w2, w3 = str(8 * b + 8), str(8 * b - 8), str(b + 8)
            hint = "Sử dụng bảng nhân 8."

        elif lesson_id == 12: # Bảng chia 8
            b = random.randint(1, 10); prod = 8 * b
            q = f"Tính: {prod} : 8 = ?"
            ans = str(b)
            w1, w2, w3 = str(b + 1), str(abs(b - 1)), "8"
            hint = "Nhẩm xem 8 nhân mấy thì bằng " + str(prod) + "."

        elif lesson_id == 13: # Bảng nhân 9
            b = random.randint(1, 10)
            q = f"Tính nhẩm: 9 x {b} = ?"
            ans = str(9 * b)
            w1, w2, w3 = str(9 * b + 9), str(9 * b - 9), "90"
            hint = "Tổng các chữ số của kết quả trong bảng nhân 9 luôn bằng 9."

        elif lesson_id == 14: # Bảng chia 9
            b = random.randint(1, 10); prod = 9 * b
            q = f"Tính: {prod} : 9 = ?"
            ans = str(b)
            w1, w2, w3 = str(b + 1), str(abs(b - 1)), "9"
            hint = "Dựa vào bảng nhân 9."

        elif lesson_id == 15: # Luyện tập chung (Nhân chia 6-9)
            a = random.choice([6, 7, 8, 9]); b = random.randint(2, 9)
            if random.choice([True, False]):
                q = f"Ôn tập: {a} x {b} = ?"; ans = str(a * b)
            else:
                prod = a * b
                q = f"Ôn tập: {prod} : {a} = ?"; ans = str(b)
            w1, w2, w3 = str(int(ans) + 1), str(abs(int(ans) - 1)), str(int(ans) + 2)
            hint = "Ôn lại các bảng nhân, chia đã học."

        # ==========================================
        # CHỦ ĐỀ 3: HÌNH HỌC VÀ ĐO LƯỜNG
        # ==========================================
        elif lesson_id == 16: # Điểm ở giữa, trung điểm đoạn thẳng
            q = "Điểm M là trung điểm của đoạn thẳng AB dài 8cm. Độ dài AM là:"
            ans = "4 cm"
            w1, w2, w3 = "8 cm", "2 cm", "16 cm"
            hint = "Trung điểm chia đoạn thẳng làm hai phần bằng nhau."

        elif lesson_id == 17: # Hình tròn, tâm, bán kính, đường kính
            r = random.randint(2, 10)
            q = f"Hình tròn có bán kính {r}cm. Đường kính của hình tròn là:"
            ans = f"{r * 2} cm"
            w1, w2, w3 = f"{r} cm", f"{r + 2} cm", f"{r * 3} cm"
            hint = "Đường kính dài gấp 2 lần bán kính."

        elif lesson_id == 18: # Góc nhọn, góc vuông, góc tù, góc bẹt
            q = "Góc nào sau đây có độ mở lớn nhất?"
            ans = "Góc bẹt"
            w1, w2, w3 = "Góc tù", "Góc vuông", "Góc nhọn"
            hint = "Góc bẹt là một đường thẳng."

        elif lesson_id == 19: # Nhiệt độ
            q = "Nhiệt độ của nước đang sôi là khoảng bao nhiêu độ C?"
            ans = "100 độ C"
            w1, w2, w3 = "0 độ C", "37 độ C", "50 độ C"
            hint = "Đây là kiến thức khoa học cơ bản."

        elif lesson_id == 20: # Luyện tập hình học
            q = "Để vẽ một hình tròn thật chuẩn, ta dùng dụng cụ gì?"
            ans = "Com-pa"
            w1, w2, w3 = "Ê-ke", "Thước thẳng", "Thước dây"
            hint = "Dụng cụ này có một đầu nhọn làm tâm và một đầu gắn bút chì."

        elif lesson_id == 21: # Khối lập phương, khối hộp chữ nhật
            q = "Khối hộp chữ nhật có bao nhiêu mặt?"
            ans = "6 mặt"
            w1, w2, w3 = "4 mặt", "8 mặt", "12 mặt"
            hint = "Hãy đếm số mặt của một viên gạch."

        elif lesson_id == 22: # Luyện tập chung hình khối
            q = "Mặt của khối lập phương là hình gì?"
            ans = "Hình vuông"
            w1, w2, w3 = "Hình chữ nhật", "Hình tròn", "Hình tam giác"
            hint = "Các mặt của khối lập phương đều bằng nhau."

        # ==========================================
        # CHỦ ĐỀ 4: PHÉP NHÂN, CHIA TRONG PHẠM VI 100
        # ==========================================
        elif lesson_id == 23: # Nhân số có hai chữ số với số có một chữ số
            a = random.randint(12, 34); b = random.randint(2, 3)
            q = f"Đặt tính rồi tính: {a} x {b} = ?"
            ans = str(a * b)
            w1, w2, w3 = str(a * b + 10), str(a * b - 10), str(a + b)
            hint = "Nhân từ hàng đơn vị trước."

        elif lesson_id == 24: # Gấp một số lên nhiều lần
            a = random.randint(5, 12); b = random.randint(3, 5)
            q = f"Gấp số {a} lên {b} lần ta được bao nhiêu?"
            ans = str(a * b)
            w1, w2, w3 = str(a + b), str(a * b + 1), str(a * b - 1)
            hint = "Gấp lên nhiều lần là thực hiện phép nhân."

        elif lesson_id == 25: # Phép chia hết và phép chia có dư
            a = 14; b = 4
            q = f"Phép chia {a} : {b} có số dư là bao nhiêu?"
            ans = "2"
            w1, w2, w3 = "1", "3", "0"
            hint = "14 = 4 x 3 + 2."

        elif lesson_id == 26: # Chia số có hai chữ số cho số có một chữ số
            a = random.choice([48, 64, 72]); b = random.choice([4, 8])
            q = f"Tính: {a} : {b} = ?"
            ans = str(a // b)
            w1, w2, w3 = str(a // b + 1), str(a // b - 1), str(a // b + 10)
            hint = "Thực hiện phép chia bình thường."

        elif lesson_id == 27: # Giảm một số đi một số lần
            a = 30; b = 5
            q = f"Giảm số {a} đi {b} lần ta được bao nhiêu?"
            ans = str(a // b)
            w1, w2, w3 = str(a - b), str(a * b), str(a + b)
            hint = "Giảm đi một số lần là thực hiện phép chia."

        elif lesson_id == 28: # Bài toán giải bằng hai bước tính
            q = f"{name} có 5 viên bi. Hùng có số bi gấp đôi {name}. Cả hai có tất cả bao nhiêu viên bi?"
            ans = "15"
            w1, w2, w3 = "10", "20", "25"
            hint = "Bước 1: Tính số bi của Hùng. Bước 2: Tính tổng số bi."

        elif lesson_id == 29: # Luyện tập chung (Nhân chia)
            a = random.randint(20, 40); b = 2
            q = f"Tính nhanh: {a} x {b} = ?"
            ans = str(a * b)
            w1, w2, w3 = str(a * b + 10), str(a * b - 10), str(a + b)
            hint = "Nhân nhẩm hàng chục rồi đến hàng đơn vị."

        # ==========================================
        # CHỦ ĐỀ 5: ĐO LƯỜNG (Tiếp theo)
        # ==========================================
        elif lesson_id == 30: # Mi-li-lít
            q = "1 lít (l) bằng bao nhiêu mi-li-lít (ml)?"
            ans = "1000 ml"
            w1, w2, w3 = "100 ml", "10 ml", "10000 ml"
            hint = "1 l = 1000 ml."

        elif lesson_id == 31: # Gam
            q = "Đơn vị nào sau đây dùng để đo khối lượng (độ nặng) của một vật nhỏ?"
            ans = "Gam (g)"
            w1, w2, w3 = "Mililít (ml)", "Xăng-ti-mét (cm)", "Độ C"
            hint = "Gam nhỏ hơn Kilôgam."

        elif lesson_id == 32: # Mi-li-mét
            q = "1 xăng-ti-mét (cm) bằng bao nhiêu mi-li-mét (mm)?"
            ans = "10 mm"
            w1, w2, w3 = "100 mm", "1000 mm", "1 mm"
            hint = "Hãy nhìn các vạch chia nhỏ nhất trên thước kẻ của em."

        elif lesson_id == 33: # Luyện tập đo lường
            q = "Quả táo thường nặng khoảng bao nhiêu?"
            ans = "150 g"
            w1, w2, w3 = "150 kg", "150 l", "150 mm"
            hint = "Dùng đơn vị Gam cho vật có khối lượng vừa phải."

        elif lesson_id == 34: # Xem đồng hồ
            q = "Khi kim dài (kim phút) chỉ vào số 9 thì là bao nhiêu phút?"
            ans = "45 phút"
            w1, w2, w3 = "9 phút", "30 phút", "50 phút"
            hint = "Lấy số trên đồng hồ nhân với 5."

        elif lesson_id == 35: # Luyện tập chung đo lường và thời gian
            q = "Nửa giờ bằng bao nhiêu phút?"
            ans = "30 phút"
            w1, w2, w3 = "60 phút", "15 phút", "45 phút"
            hint = "1 giờ = 60 phút."

        # ==========================================
        # CHỦ ĐỀ 6: NHÂN, CHIA SỐ CÓ BA CHỮ SỐ
        # ==========================================
        elif lesson_id == 36: # Nhân số có ba chữ số với số có một chữ số
            a = random.randint(100, 300); b = random.randint(2, 3)
            q = f"Tính: {a} x {b} = ?"
            ans = str(a * b)
            w1, w2, w3 = str(a * b + 10), str(a * b - 10), str(a * b + 100)
            hint = "Nhân lần lượt từ phải sang trái."

        elif lesson_id == 37: # Chia số có ba chữ số cho số có một chữ số
            a = random.choice([246, 369, 488]); b = 2
            q = f"Tính: {a} : {b} = ?"
            ans = str(a // b)
            w1, w2, w3 = str(a // b + 10), str(a // b - 10), str(a // b + 1)
            hint = "Chia từ trái sang phải (bắt đầu từ hàng trăm)."

        elif lesson_id == 38: # Biểu thức số. Tính giá trị biểu thức
            a, b, c = 10, 5, 2
            q = f"Tính giá trị biểu thức: {a} + {b} x {c} = ?"
            ans = str(a + b * c)
            w1, w2, w3 = str((a + b) * c), str(a + b + c), str(a * b * c)
            hint = "Nhân chia trước, cộng trừ sau."

        elif lesson_id == 39: # So sánh số lớn gấp mấy lần số bé
            a = 24; b = 6
            q = f"Số {a} gấp số {b} mấy lần?"
            ans = str(a // b) + " lần"
            w1, w2, w3 = str(a - b) + " lần", str(a * b) + " lần", str((a // b) + 1) + " lần"
            hint = "Lấy số lớn chia cho số bé."

        elif lesson_id == 40: # Luyện tập chung (HK1)
            q = "Biểu thức 20 : 2 x 3 có giá trị là bao nhiêu?"
            ans = "30"
            w1, w2, w3 = "60", "10", "15"
            hint = "Thực hiện lần lượt từ trái sang phải."

        elif lesson_id in [41, 42, 43, 44]: # Ôn tập học kì 1
            t = random.choice(["tinhtoan", "gapan", "hinhhoc"])
            if t == "tinhtoan":
                a, b = random.randint(100, 200), random.choice([2, 3])
                q = f"Ôn tập HK1: {a} x {b} = ?"; ans = str(a * b)
                w1, w2, w3 = str(a*b+10), str(a*b-10), str(a+b)
            elif t == "gapan":
                q = "Đoạn dây 10m gấp đoạn dây 2m mấy lần?"; ans = "5 lần"
                w1, w2, w3 = "8 lần", "12 lần", "20 lần"
            else:
                q = "1 kg = ... g. Số cần điền là:"; ans = "1000"
                w1, w2, w3 = "100", "10", "10000"
            hint = "Tổng ôn kiến thức học kì 1."

        # ==========================================
        # CHỦ ĐỀ 7: CÁC SỐ ĐẾN 10.000 VÀ 100.000
        # ==========================================
        elif lesson_id == 45: # Các số có bốn chữ số (Số đến 10.000)
            n = random.randint(1000, 9999)
            q = f"Số liền sau của {n} là số nào?"
            ans = str(n + 1)
            w1, w2, w3 = str(n - 1), str(n + 10), str(n + 100)
            hint = "Số liền sau thì cộng thêm 1."

        elif lesson_id == 46: # So sánh các số trong phạm vi 10.000
            a, b = 4567, 4576
            q = f"Điền dấu thích hợp: {a} ... {b}"
            ans = "<"
            w1, w2, w3 = ">", "=", "+"
            hint = "So sánh từ hàng nghìn, hàng trăm, rồi đến hàng chục."

        elif lesson_id == 47: # Làm tròn số đến hàng nghìn, hàng chục nghìn
            q = "Làm tròn số 3400 đến hàng nghìn ta được số nào?"
            ans = "3000"
            w1, w2, w3 = "4000", "3500", "3400"
            hint = "Chữ số hàng trăm là 4 (nhỏ hơn 5) nên ta làm tròn xuống."

        elif lesson_id == 48: # Luyện tập chung (Số đến 10.000)
            q = "Số lớn nhất có 4 chữ số là số nào?"
            ans = "9999"
            w1, w2, w3 = "1000", "8999", "9000"
            hint = "Mỗi chữ số đều phải là số lớn nhất (số 9)."

        # ==========================================
        # CHỦ ĐỀ 8: CHU VI VÀ DIỆN TÍCH
        # ==========================================
        elif lesson_id == 49: # Chu vi hình tam giác, tứ giác
            a, b, c = 4, 5, 6
            q = f"Hình tam giác có độ dài các cạnh là {a}cm, {b}cm, {c}cm. Chu vi là:"
            ans = f"{a+b+c} cm"
            w1, w2, w3 = f"{a+b+c+1} cm", f"{a+b} cm", f"{b+c} cm"
            hint = "Chu vi là tổng độ dài các cạnh bao quanh."

        elif lesson_id == 50: # Chu vi hình chữ nhật, hình vuông
            c = 5
            q = f"Hình vuông có cạnh là {c}cm. Chu vi của hình vuông đó là:"
            ans = f"{c * 4} cm"
            w1, w2, w3 = f"{c * c} cm", f"{c * 2} cm", f"{c * 4 + 1} cm"
            hint = "Chu vi hình vuông = Cạnh x 4."

        elif lesson_id == 51: # Diện tích của một hình
            q = "Khi nói về độ rộng của bề mặt một hình, ta dùng khái niệm gì?"
            ans = "Diện tích"
            w1, w2, w3 = "Chu vi", "Độ dài", "Khối lượng"
            hint = "Chu vi là đường bao quanh, còn bề mặt bên trong là diện tích."

        elif lesson_id == 52: # Diện tích hình chữ nhật
            d, r = 6, 3
            q = f"Hình chữ nhật có chiều dài {d}cm, chiều rộng {r}cm. Diện tích là:"
            ans = f"{d * r} cm2"
            w1, w2, w3 = f"{(d+r)*2} cm2", f"{d+r} cm2", "18 cm"
            hint = "Diện tích hình chữ nhật = Chiều dài x Chiều rộng."

        elif lesson_id == 53: # Diện tích hình vuông
            c = 4
            q = f"Hình vuông có cạnh {c}cm. Diện tích là:"
            ans = f"{c * c} cm2"
            w1, w2, w3 = f"{c * 4} cm2", "16 cm", f"{c + c} cm2"
            hint = "Diện tích hình vuông = Cạnh x Cạnh."

        # ==========================================
        # CHỦ ĐỀ 9: PHÉP TÍNH PHẠM VI 10.000 & 100.000
        # ==========================================
        elif lesson_id == 54: # Phép cộng phạm vi 10.000
            a, b = random.randint(1000, 5000), random.randint(1000, 4000)
            q = f"Tính: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = str(a+b+100), str(a+b-100), str(a+b+10)
            hint = "Cộng lần lượt từ hàng đơn vị sang trái."

        elif lesson_id == 55: # Phép trừ phạm vi 10.000
            a, b = random.randint(5000, 9999), random.randint(1000, 4000)
            q = f"Tính: {a} - {b} = ?"
            ans = str(a - b)
            w1, w2, w3 = str(a-b+100), str(a-b-100), str(a-b+10)
            hint = "Trừ lần lượt từ hàng đơn vị sang trái."

        elif lesson_id == 56: # Luyện tập chung (+, - đến 10.000)
            a, b, c = 1500, 2000, 500
            q = f"Tính giá trị: {a} + {b} - {c} = ?"
            ans = str(a + b - c)
            w1, w2, w3 = str(a + b + c), str(a - b + c), str(a + b)
            hint = "Thực hiện phép tính từ trái sang phải."

        elif lesson_id == 57: # Phép nhân phạm vi 10.000
            a, b = random.randint(1000, 3000), random.randint(2, 3)
            q = f"Tính: {a} x {b} = ?"
            ans = str(a * b)
            w1, w2, w3 = str(a*b+100), str(a*b-100), str(a+b)
            hint = "Nhân lần lượt từ hàng đơn vị."

        elif lesson_id == 58: # Phép chia phạm vi 10.000
            a = random.choice([2468, 3690, 4800]); b = 2
            q = f"Tính: {a} : {b} = ?"
            ans = str(a // b)
            w1, w2, w3 = str(a//b+100), str(a//b-100), str(a//b+10)
            hint = "Chia lần lượt từ hàng nghìn sang phải."

        elif lesson_id == 59: # Luyện tập chung (x, : đến 10.000)
            q = "Tìm x biết: x : 3 = 1500"
            ans = "4500"
            w1, w2, w3 = "500", "450", "3000"
            hint = "Muốn tìm số bị chia, ta lấy thương nhân với số chia."

        elif lesson_id == 60: # Các số đến 100.000
            n = random.randint(10000, 99999)
            q = f"Số liền trước của {n} là số nào?"
            ans = str(n - 1)
            w1, w2, w3 = str(n + 1), str(n - 10), str(n + 10)
            hint = "Trừ đi 1 để tìm số liền trước."

        elif lesson_id == 61: # So sánh các số trong phạm vi 100.000
            a, b = 45678, 45768
            q = f"So sánh {a} và {b}:"
            ans = "<"
            w1, w2, w3 = ">", "=", "Không biết"
            hint = "So sánh bắt đầu từ hàng chục nghìn."

        elif lesson_id == 62: # Luyện tập chung (Số đến 100.000)
            q = "Số lớn nhất có 5 chữ số là số nào?"
            ans = "99999"
            w1, w2, w3 = "100000", "90000", "10000"
            hint = "Mọi chữ số đều là số 9."

        elif lesson_id == 63: # Phép cộng phạm vi 100.000
            a, b = 25000, 35000
            q = f"Tính: {a} + {b} = ?"
            ans = str(a + b)
            w1, w2, w3 = "50000", "65000", "70000"
            hint = "Cộng bình thường như các số nhỏ."

        elif lesson_id == 64: # Phép trừ phạm vi 100.000
            a, b = 80000, 25000
            q = f"Tính: {a} - {b} = ?"
            ans = str(a - b)
            w1, w2, w3 = "50000", "65000", "45000"
            hint = "Trừ bình thường như các số nhỏ."

        elif lesson_id == 65: # Phép nhân phạm vi 100.000
            a, b = 12000, 4
            q = f"Tính: {a} x {b} = ?"
            ans = str(a * b)
            w1, w2, w3 = "4800", "36000", "480000"
            hint = "Lấy 12 x 4 rồi thêm 3 số 0."

        elif lesson_id == 66: # Phép chia phạm vi 100.000
            a, b = 45000, 5
            q = f"Tính: {a} : {b} = ?"
            ans = str(a // b)
            w1, w2, w3 = "900", "90000", "8000"
            hint = "Lấy 45 : 5 rồi thêm 3 số 0."

        elif lesson_id == 67: # Luyện tập chung (+, -, x, : đến 100.000)
            q = "Tính: 100000 - 20000 x 2 = ?"
            ans = "60000"
            w1, w2, w3 = "160000", "80000", "40000"
            hint = "Nhân chia trước, cộng trừ sau."

        # ==========================================
        # CHỦ ĐỀ 10: TIỀN VN, THỐNG KÊ, ÔN TẬP
        # ==========================================
        elif lesson_id == 68: # Tiền Việt Nam
            q = "Mẹ có 1 tờ 20.000 đồng và 2 tờ 10.000 đồng. Tổng số tiền là:"
            ans = "40.000 đồng"
            w1, w2, w3 = "30.000 đồng", "50.000 đồng", "20.000 đồng"
            hint = "Cộng tổng giá trị các tờ tiền lại."

        elif lesson_id == 69: # Luyện tập chung (Tiền Việt Nam)
            q = "Quyển truyện giá 15.000 đồng. Em đưa cô bán hàng 20.000 đồng, cô trả lại em bao nhiêu?"
            ans = "5.000 đồng"
            w1, w2, w3 = "10.000 đồng", "15.000 đồng", "35.000 đồng"
            hint = "Lấy số tiền em có trừ đi giá quyển truyện."

        elif lesson_id == 70: # Tháng, năm
            q = "Tháng 2 của năm không nhuận có bao nhiêu ngày?"
            ans = "28 ngày"
            w1, w2, w3 = "29 ngày", "30 ngày", "31 ngày"
            hint = "Tháng 2 là tháng đặc biệt có ít ngày nhất."

        elif lesson_id == 71: # Khả năng xảy ra (Chắc chắn, có thể, không thể)
            q = "Trong hộp chỉ có bi đỏ. Nhắm mắt lấy 1 viên bi, khả năng lấy được bi xanh là:"
            ans = "Không thể"
            w1, w2, w3 = "Chắc chắn", "Có thể", "Rất khó"
            hint = "Vì trong hộp không có viên bi xanh nào cả."

        elif lesson_id == 72: # Thu thập, phân loại, ghi chép số liệu
            q = "Bảng số liệu dùng để làm gì?"
            ans = "Tóm tắt và trình bày thông tin"
            w1, w2, w3 = "Để vẽ tranh", "Để tính chu vi", "Để đo độ dài"
            hint = "Bảng giúp ta dễ dàng nhìn thấy và so sánh các con số."

        elif lesson_id in [73, 74, 75, 76]: # Ôn tập cuối năm
            t = random.choice(["tinhtoan", "hinhhoc", "thucte"])
            if t == "tinhtoan":
                a, b = random.randint(10000, 40000), random.randint(10000, 30000)
                q = f"Ôn tập cuối năm: {a} + {b} = ?"; ans = str(a + b)
                w1, w2, w3 = str(a+b+100), str(a+b-100), str(a+b+1000)
            elif t == "hinhhoc":
                q = "Hình chữ nhật có chiều dài 10cm, chiều rộng 5cm. Diện tích là:"; ans = "50 cm2"
                w1, w2, w3 = "30 cm", "15 cm2", "50 cm"
            else:
                q = "1 kg bông và 1 kg sắt, cái nào nặng hơn?"; ans = "Bằng nhau"
                w1, w2, w3 = "Sắt nặng hơn", "Bông nặng hơn", "Không biết"
            hint = "Ôn tập tổng hợp kiến thức cả năm lớp 3."

        # Đề phòng lỗi (fallback)
        else:
            q = f"Tính: {lesson_id} + 1 = ?"
            ans = str(lesson_id + 1)
            w1, w2, w3 = str(lesson_id), str(lesson_id + 2), "10"
            hint = "Thực hiện phép tính cộng."

        opts = self._mix_options(ans, w1, w2, w3)
        return Question(q, opts[:4], ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 3, lesson_id)

    def _generate_grade_4_question(self, lesson_id: int, difficulty: Difficulty) -> Question:
        """Sinh câu hỏi Lớp 4 - SGK Kết nối tri thức (73 bài)"""
        obj = random.choice(self.objects); name = random.choice(self.names)
        q, ans, hint = "", "", ""; w1, w2, w3 = "", "", ""
        if lesson_id == 1:
            val = random.randint(10000, 99999); q = f"Số {val} có mấy chữ số?"; ans = "5 chữ số"; w1, w2, w3 = "4 chữ số", "6 chữ số", "3 chữ số"; hint = "Đếm số chữ số."
        elif lesson_id == 2:
            a, b = random.randint(10000, 50000), random.randint(1000, 30000); q = f"Tính: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+100), str(a+b-100), str(a+b+1000); hint = "Cộng từ phải sang trái."
        elif lesson_id == 3:
            a, b = random.randint(1000, 9000), random.randint(2, 9); q = f"Tính: {a} x {b} = ?"; ans = str(a*b); w1, w2, w3 = str(a*b+100), str(a*b-100), str(a+b); hint = "Nhân lần lượt từng hàng."
        elif lesson_id == 4:
            a = random.randint(10, 50); q = f"Cho a = {a}. Tính a + 15 = ?"; ans = str(a+15); w1, w2, w3 = str(a+5), str(a+25), str(a-15); hint = "Thay a bằng số rồi tính."
        elif lesson_id == 5:
            a, b, c = random.randint(10, 30), random.randint(2, 5), random.randint(5, 20); q = f"{name} mua {a} vở giá {b} nghìn và {c} bút giá 5 nghìn. Tất cả bao nhiêu nghìn?"; ans = str(a*b+c*5); w1, w2, w3 = str(a*b+c), str(a+b*5), str(a*b); hint = "B1: Tiền vở. B2: Tiền bút. B3: Cộng."
        elif lesson_id == 6:
            a, b = random.randint(10000, 50000), random.randint(5000, 20000); q = f"Tính: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+1000), str(a+b-1000), str(a+b+100); hint = "Cộng từng hàng."
        elif lesson_id in [7, 8]:
            val = random.randint(100000, 999999); q = f"Số {val} thuộc lớp nào?"; ans = "Lớp nghìn"; w1, w2, w3 = "Lớp đơn vị", "Lớp triệu", "Lớp trăm"; hint = "Số 6 chữ số thuộc lớp nghìn."
        elif lesson_id == 9:
            a, b = random.randint(10000, 99999), random.randint(1000, 9999); q = f"So sánh: {a} ... {b}"; ans = ">"; w1, w2, w3 = "<", "=", "+"; hint = "Nhiều chữ số hơn thì lớn hơn."
        elif lesson_id == 10:
            val = random.choice([i*10 for i in range(1,100)] + [i*100 for i in range(1,100)] + [i*1000 for i in range(1,100)]); t = "tròn nghìn" if val%1000==0 else ("tròn trăm" if val%100==0 else "tròn chục"); q = f"Số {val} là số gì?"; ans = f"Số {t}"; w1, w2, w3 = "Số lẻ", "Số tự nhiên", "Số nguyên"; hint = "Tròn chục tận 0, tròn trăm tận 00."
        elif lesson_id == 11:
            val = random.randint(1000, 9999); rounded = (val//1000)*1000 if val%1000<500 else (val//1000+1)*1000; q = f"Làm tròn {val} đến hàng nghìn:"; ans = str(rounded); w1, w2, w3 = str(rounded-1000), str(rounded+1000), str(val); hint = "Hàng trăm ≥5 tròn lên, <5 tròn xuống."
        elif lesson_id in [12, 13]:
            val = random.randint(1000000, 9999999); q = f"Số {val} có mấy chữ số?"; ans = "7 chữ số"; w1, w2, w3 = "6 chữ số", "8 chữ số", "5 chữ số"; hint = "Đếm số chữ số."
        elif lesson_id == 14:
            a, b = random.randint(100000, 999999), random.randint(100000, 999999)
            while a == b: b = random.randint(100000, 999999)
            q = f"Điền dấu: {a} ... {b}"; ans = ">" if a>b else "<"; w1, w2, w3 = "<" if a>b else ">", "=", "+"; hint = "So sánh từ trái sang phải."
        elif lesson_id in [15, 16]:
            val = random.randint(100000, 999999); q = f"Số liền sau của {val}:"; ans = str(val+1); w1, w2, w3 = str(val-1), str(val+10), str(val+100); hint = "Liền sau = +1."
        elif lesson_id == 17:
            a = random.randint(1, 5); q = f"{a} tấn bằng bao nhiêu kg?"; ans = f"{a*1000} kg"; w1, w2, w3 = f"{a*100} kg", f"{a*10} kg", f"{a*10000} kg"; hint = "1 tấn = 1000 kg."
        elif lesson_id in [18, 19]:
            q = "1 thế kỷ bằng bao nhiêu năm?"; ans = "100 năm"; w1, w2, w3 = "10 năm", "50 năm", "1000 năm"; hint = "1 thế kỷ = 100 năm."
        elif lesson_id == 20:
            a = random.randint(2, 8); q = f"{a} tạ bằng bao nhiêu yến?"; ans = f"{a*10} yến"; w1, w2, w3 = f"{a*100} yến", f"{a*5} yến", f"{a} yến"; hint = "1 tạ = 10 yến."
        elif lesson_id == 21:
            a, b = random.randint(100000, 500000), random.randint(100000, 400000); q = f"Tính: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+1000), str(a+b-1000), str(a+b+100); hint = "Cộng từ phải sang trái."
        elif lesson_id == 22:
            a, b = random.randint(500000, 999999), random.randint(100000, 400000); q = f"Tính: {a} - {b} = ?"; ans = str(a-b); w1, w2, w3 = str(a-b+1000), str(a-b-1000), str(a-b+100); hint = "Trừ từ phải sang trái."
        elif lesson_id == 23:
            a, b = random.randint(10, 50), random.randint(10, 50); q = f"Giao hoán: {a} + {b} = {b} + ?"; ans = str(a); w1, w2, w3 = str(a+b), str(b), str(a-b); hint = "a + b = b + a."
        elif lesson_id == 24:
            tong, hieu = random.randint(20, 60), random.randint(2, 20)
            while tong<=hieu or (tong+hieu)%2!=0: tong, hieu = random.randint(20, 60), random.randint(2, 20)
            lon = (tong+hieu)//2; q = f"Tổng hai số là {tong}, hiệu là {hieu}. Số lớn:"; ans = str(lon); w1, w2, w3 = str(tong-lon), str(tong), str(hieu); hint = "Số lớn = (Tổng + Hiệu) : 2."
        elif lesson_id in [25, 26]:
            a, b = random.randint(10000, 99999), random.randint(1000, 9999); q = f"Tính: {a} - {b} = ?"; ans = str(a-b); w1, w2, w3 = str(a-b+100), str(a-b-100), str(a+b); hint = "Đặt tính thẳng cột."
        elif lesson_id == 27:
            q = "Hai đường vuông góc tạo mấy góc vuông?"; ans = "4 góc vuông"; w1, w2, w3 = "2 góc vuông", "1 góc vuông", "Không có"; hint = "Vuông góc tạo 4 góc vuông."
        elif lesson_id == 28:
            q = "Hai đường song song có đặc điểm gì?"; ans = "Không bao giờ cắt nhau"; w1, w2, w3 = "Cắt tại 1 điểm", "Vuông góc", "Trùng nhau"; hint = "Song song = không cắt nhau."
        elif lesson_id == 29:
            q = "Đường cao tam giác là gì?"; ans = "Đoạn từ đỉnh hạ vuông góc xuống đáy"; w1, w2, w3 = "Đoạn nối hai đỉnh", "Trung tuyến", "Cạnh bên"; hint = "Đường cao vuông góc với đáy."
        elif lesson_id in [30, 31]:
            q = "Hình bình hành có đặc điểm gì?"; ans = "Hai cặp cạnh đối song song và bằng nhau"; w1, w2, w3 = "Bốn cạnh bằng nhau", "Bốn góc vuông", "Hai đường chéo vuông góc"; hint = "Cạnh đối song song và bằng nhau."
        elif lesson_id == 32:
            q = "Hình thoi có đặc điểm gì?"; ans = "Bốn cạnh bằng nhau, hai cặp cạnh đối song song"; w1, w2, w3 = "Bốn góc vuông", "Chỉ hai cạnh bằng nhau", "Không có cạnh song song"; hint = "Thoi: cả 4 cạnh bằng nhau."
        elif lesson_id in [33, 34]:
            q = "Góc nhọn so với góc vuông thì sao?"; ans = "Nhỏ hơn góc vuông"; w1, w2, w3 = "Lớn hơn góc vuông", "Bằng góc vuông", "Bằng góc bẹt"; hint = "Nhọn < Vuông < Tù < Bẹt."
        elif lesson_id == 35:
            q = "Góc bẹt bằng bao nhiêu độ?"; ans = "180 độ"; w1, w2, w3 = "90 độ", "360 độ", "270 độ"; hint = "Góc bẹt = 2 góc vuông."
        elif lesson_id in [36, 37]:
            a, b = random.randint(10000, 50000), random.randint(5000, 30000); q = f"Ôn tập HK1: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+1000), str(a+b-1000), str(a*b); hint = "Ôn lại đặt tính."
        elif 38 <= lesson_id <= 73:
            a, b = random.randint(1000, 9999), random.randint(2, 9)
            if random.choice([True, False]): q = f"Tính: {a} x {b} = ?"; ans = str(a*b); w1, w2, w3 = str(a*b+100), str(a*b-100), str(a+b); hint = "Nhân/chia số lớn."
            else: q = f"Tính: {a*b} : {b} = ?"; ans = str(a); w1, w2, w3 = str(a+1), str(a-1), str(a+10); hint = "Chia - Nhân - Trừ."
        else:
            a, b = random.randint(10, 99), random.randint(1, 9); q = f"Tính: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+1), str(a+b-1), str(a+b+10); hint = "Thực hiện phép tính."
        opts = self._mix_options(ans, w1, w2, w3)
        return Question(q, opts[:4], ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 4, lesson_id)

    def _generate_grade_5_question(self, lesson_id: int, difficulty: Difficulty) -> Question:
        """Sinh câu hỏi Lớp 5 - SGK Kết nối tri thức (75 bài)"""
        obj = random.choice(self.objects); name = random.choice(self.names)
        q, ans, hint = "", "", ""; w1, w2, w3 = "", "", ""
        if lesson_id == 1:
            val = random.randint(100000, 999999); q = f"Viết số {val} thành tổng theo lớp:"; ans = f"{val//1000*1000} + {val%1000}"; w1, w2, w3 = f"{val//100} + {val%100}", f"{val//10} + {val%10}", str(val+1000); hint = "Tách lớp nghìn và đơn vị."
        elif lesson_id == 2:
            a, b = random.randint(100000, 500000), random.randint(100000, 400000); q = f"Tính: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+1000), str(a+b-1000), str(a+b+100); hint = "Cộng từ phải sang trái."
        elif lesson_id == 3:
            a, b = random.randint(500000, 999999), random.randint(100000, 400000); q = f"Tính: {a} - {b} = ?"; ans = str(a-b); w1, w2, w3 = str(a-b+1000), str(a-b-1000), str(a-b+100); hint = "Trừ từ phải sang trái."
        elif lesson_id in [4, 5]:
            a, b = random.randint(1000, 9999), random.randint(2, 9); q = f"Tính: {a} x {b} = ?"; ans = str(a*b); w1, w2, w3 = str(a*b+100), str(a*b-100), str(a+b); hint = "Nhân lần lượt."
        elif lesson_id == 6:
            b = random.randint(2, 9); a = b*random.randint(100, 1000); q = f"Tính: {a} : {b} = ?"; ans = str(a//b); w1, w2, w3 = str(a//b+1), str(a//b-1), str(a//b+10); hint = "Chia - Nhân - Trừ."
        elif lesson_id == 7:
            a, b, c = random.randint(10, 50), random.randint(10, 50), random.randint(10, 50); q = f"Tính: ({a} + {b}) x {c} = ?"; ans = str((a+b)*c); w1, w2, w3 = str(a+b*c), str(a*b+c), str((a+b)*c+10); hint = "Tính ngoặc trước."
        elif lesson_id == 8:
            tong, hieu = random.randint(30, 80), random.randint(2, 20)
            while tong<=hieu or (tong+hieu)%2!=0: tong, hieu = random.randint(30, 80), random.randint(2, 20)
            lon = (tong+hieu)//2; q = f"Tổng {tong}, hiệu {hieu}. Số lớn:"; ans = str(lon); w1, w2, w3 = str(tong-lon), str(tong), str(hieu); hint = "Số lớn = (Tổng + Hiệu) : 2."
        elif lesson_id == 9:
            a, b = random.randint(2, 5), random.randint(1, a-1); tong = (a+b)*random.randint(5, 15); q = f"Tổng {tong}, tỉ {a}:{b}. Số lớn:"; ans = str(tong*a//(a+b)); w1, w2, w3 = str(tong*b//(a+b)), str(tong), str(a+b); hint = "Số lớn = Tổng x Tỉ lớn / Tổng tỉ."
        elif lesson_id in [10, 11]:
            a, b = random.randint(10000, 50000), random.randint(1000, 9000); q = f"Tìm x: x + {b} = {a+b}"; ans = str(a); w1, w2, w3 = str(a+1), str(a-1), str(a+b); hint = "x = Tổng - Số hạng."
        elif lesson_id in [12, 13]:
            a, b = random.randint(100, 999), random.randint(11, 49); q = f"Luyện: {a} x {b} = ?"; ans = str(a*b); w1, w2, w3 = str(a*b+100), str(a*b-100), str(a+b); hint = "Ôn nhân số lớn."
        elif lesson_id == 14:
            q = "Phân số gồm hai phần là gì?"; ans = "Tử số và mẫu số"; w1, w2, w3 = "Hàng và lớp", "Chục và đơn vị", "Số lớn và số bé"; hint = "Phân số = Tử/Mẫu."
        elif lesson_id == 15:
            a, b, k = random.randint(1, 5), random.randint(2, 9), random.randint(2, 4); q = f"Rút gọn {a*k}/{b*k}:"; ans = f"{a}/{b}"; w1, w2, w3 = f"{a+1}/{b}", f"{a}/{b+1}", f"{a*k}/{b}"; hint = "Chia tử và mẫu cho cùng số."
        elif lesson_id in [16, 17]:
            a, b, m = random.randint(1, 5), random.randint(1, 5), random.randint(2, 9); q = f"Tính: {a}/{m} + {b}/{m} = ?"; ans = f"{a+b}/{m}"; w1, w2, w3 = f"{a+b}/{2*m}", f"{a+b+1}/{m}", f"{a*b}/{m}"; hint = "Cộng tử, giữ mẫu."
        elif lesson_id == 18:
            a, b, m = random.randint(4, 9), random.randint(1, 3), random.randint(2, 9); q = f"Tính: {a}/{m} - {b}/{m} = ?"; ans = f"{a-b}/{m}"; w1, w2, w3 = f"{a+b}/{m}", f"{a-b-1}/{m}", f"{a-b}/{2*m}"; hint = "Trừ tử, giữ mẫu."
        elif lesson_id in [19, 20]:
            a, b, m1, m2 = random.randint(1, 5), random.randint(1, 5), random.randint(2, 9), random.randint(2, 9); q = f"Tính: {a}/{m1} x {b}/{m2} = ?"; ans = f"{a*b}/{m1*m2}"; w1, w2, w3 = f"{a+b}/{m1*m2}", f"{a*b}/{m1+m2}", f"{a*b+1}/{m1*m2}"; hint = "Tử nhân tử, mẫu nhân mẫu."
        elif lesson_id == 21:
            a, b, m1, m2 = random.randint(1, 5), random.randint(1, 5), random.randint(2, 9), random.randint(2, 9); q = f"Tính: {a}/{m1} : {b}/{m2} = ?"; ans = f"{a*m2}/{m1*b}"; w1, w2, w3 = f"{a*b}/{m1*m2}", f"{a*m2+1}/{m1*b}", f"{a+m2}/{m1+b}"; hint = "Chia = nhân nghịch đảo."
        elif lesson_id in [22, 23]:
            a, b, m = random.randint(1, 5), random.randint(1, 5), random.randint(2, 9); q = f"Luyện: {a}/{m} x {b}/{m} = ?"; ans = f"{a*b}/{m*m}"; w1, w2, w3 = f"{a+b}/{m*m}", f"{a*b}/{m}", f"{a*b+1}/{m*m}"; hint = "Ôn nhân chia phân số."
        elif lesson_id == 24:
            a, b, m = random.randint(2, 9), random.randint(1, 5), random.randint(2, 9); val = a*m; q = f"Tìm {b}/{m} của {val}:"; ans = str(a*b); w1, w2, w3 = str(a*b+1), str(a*m//b), str(a+b); hint = "Lấy số nhân phân số."
        elif lesson_id in [25, 26]:
            a, b, m = random.randint(100, 500), random.randint(1, 3), random.randint(2, 5); q = f"Kho có {a} kg, bán {b}/{m}. Còn lại?"; ans = str(a-a*b//m); w1, w2, w3 = str(a*b//m), str(a//m), str(a-a*b//m+10); hint = "Tổng trừ phần đã bán."
        elif lesson_id in [27, 28]:
            q = "Viết 3/10 dưới dạng số thập phân:"; ans = "0,3"; w1, w2, w3 = "3,0", "0,03", "0,1"; hint = "3/10 = 0,3."
        elif lesson_id == 29:
            q = "Viết 25/100 dưới dạng số thập phân:"; ans = "0,25"; w1, w2, w3 = "2,5", "0,025", "25"; hint = "25/100 = 0,25."
        elif lesson_id == 30:
            a = random.randint(1, 8); q = f"So sánh: 0,{a} ... 0,{a+1}"; ans = "<"; w1, w2, w3 = ">", "=", "+"; hint = "So sánh từng chữ số sau dấu phẩy."
        elif lesson_id in [31, 32]:
            a = round(random.uniform(1.1, 9.9), 1); b = round(random.uniform(1.1, 9.9), 1); q = f"Tính: {a} + {b} = ?"; ans = str(round(a+b, 1)); w1, w2, w3 = str(round(a+b+0.1, 1)), str(round(a+b-0.1, 1)), str(round(a*b, 1)); hint = "Thẳng cột dấu phẩy."
        elif lesson_id == 33:
            a = round(random.uniform(5.0, 9.9), 1); b = round(random.uniform(1.0, 4.9), 1); q = f"Tính: {a} - {b} = ?"; ans = str(round(a-b, 1)); w1, w2, w3 = str(round(a-b+0.1, 1)), str(round(a-b-0.1, 1)), str(round(a+b, 1)); hint = "Thẳng cột dấu phẩy."
        elif lesson_id == 34:
            a = round(random.uniform(1.1, 9.9), 1); b = random.randint(2, 5); q = f"Tính: {a} x {b} = ?"; ans = str(round(a*b, 1)); w1, w2, w3 = str(round(a*b+1, 1)), str(round(a*b-1, 1)), str(round(a+b, 1)); hint = "Nhân như số tự nhiên."
        elif lesson_id == 35:
            a, b = random.randint(10000, 50000), random.randint(5000, 30000); q = f"Ôn HK1: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+1000), str(a+b-1000), str(a*b); hint = "Ôn đặt tính."
        elif lesson_id == 36:
            d, h = random.randint(4, 10), random.randint(3, 8); q = f"Tam giác đáy {d}cm, cao {h}cm. Diện tích:"; ans = f"{d*h//2} cm2"; w1, w2, w3 = f"{d*h} cm2", f"{d+h} cm2", f"{d*h//2+1} cm2"; hint = "S = (Đáy x Cao) : 2."
        elif lesson_id == 37:
            a, b, h = random.randint(4, 8), random.randint(2, 5), random.randint(3, 6); q = f"Thang đáy lớn {a}, đáy bé {b}, cao {h}. Diện tích:"; ans = f"{(a+b)*h//2} cm2"; w1, w2, w3 = f"{(a+b)*h} cm2", f"{a*b*h//2} cm2", f"{(a+b)*h//2+1} cm2"; hint = "S = (Đáy lớn + Đáy bé) x Cao : 2."
        elif lesson_id == 38:
            r = random.randint(2, 7); q = f"Hình tròn bán kính {r}cm. Chu vi (π=3,14):"; ans = f"{round(2*3.14*r, 2)} cm"; w1, w2, w3 = f"{round(3.14*r*r, 2)} cm", f"{r*2} cm", f"{round(3.14*r, 2)} cm"; hint = "C = 2 x π x r."
        elif lesson_id == 39:
            r = random.randint(2, 5); q = f"Hình tròn bán kính {r}cm. Diện tích (π=3,14):"; ans = f"{round(3.14*r*r, 2)} cm2"; w1, w2, w3 = f"{round(2*3.14*r, 2)} cm2", f"{r*r} cm2", f"{round(3.14*r, 2)} cm2"; hint = "S = π x r x r."
        elif lesson_id in [40, 41]:
            q = "Hình hộp chữ nhật có mấy mặt?"; ans = "6 mặt"; w1, w2, w3 = "4 mặt", "8 mặt", "12 mặt"; hint = "6 mặt hình chữ nhật."
        elif lesson_id == 42:
            d, r, h = random.randint(3, 8), random.randint(2, 5), random.randint(2, 6); q = f"Hộp {d}x{r}x{h} cm. Sxq:"; ans = f"{2*(d+r)*h} cm2"; w1, w2, w3 = f"{d*r*h} cm2", f"{2*d*r+2*r*h} cm2", f"{(d+r)*h} cm2"; hint = "Sxq = Chu vi đáy x Cao."
        elif lesson_id == 43:
            c = random.randint(3, 7); q = f"Lập phương cạnh {c}cm. Stp:"; ans = f"{c*c*6} cm2"; w1, w2, w3 = f"{c*c*4} cm2", f"{c*c*2} cm2", f"{c*c*8} cm2"; hint = "Stp = Cạnh x Cạnh x 6."
        elif lesson_id in [44, 45]:
            q = "Hình trụ có mấy mặt cong?"; ans = "1 mặt cong"; w1, w2, w3 = "2 mặt cong", "Không có", "3 mặt cong"; hint = "1 mặt cong, 2 mặt phẳng."
        elif lesson_id == 46:
            d, r, h = random.randint(3, 8), random.randint(2, 5), random.randint(2, 6); q = f"Hộp {d}x{r}x{h} cm. Thể tích:"; ans = f"{d*r*h} cm3"; w1, w2, w3 = f"{2*(d+r)*h} cm3", f"{d*r+h} cm3", f"{(d+r)*h} cm3"; hint = "V = Dài x Rộng x Cao."
        elif lesson_id == 47:
            c = random.randint(3, 7); q = f"Lập phương cạnh {c}cm. Thể tích:"; ans = f"{c**3} cm3"; w1, w2, w3 = f"{c*c*6} cm3", f"{c*c*4} cm3", f"{c*c*2} cm3"; hint = "V = Cạnh^3."
        elif lesson_id in [48, 49]:
            q = "1 dm3 bằng bao nhiêu cm3?"; ans = "1000 cm3"; w1, w2, w3 = "100 cm3", "10 cm3", "10000 cm3"; hint = "1 dm3 = 1000 cm3."
        elif lesson_id == 50:
            q = "1 m3 bằng bao nhiêu dm3?"; ans = "1000 dm3"; w1, w2, w3 = "100 dm3", "10 dm3", "10000 dm3"; hint = "1 m3 = 1000 dm3."
        elif lesson_id in [51, 52]:
            d, r, h = random.randint(3, 8), random.randint(2, 5), random.randint(2, 6); q = f"Luyện: V hộp {d}x{r}x{h} cm = ?"; ans = f"{d*r*h} cm3"; w1, w2, w3 = f"{d*r*h+10} cm3", f"{2*(d+r)*h} cm3", f"{d+r+h} cm3"; hint = "V = Dài x Rộng x Cao."
        elif lesson_id in [53, 54]:
            v = random.randint(30, 90); t = random.randint(2, 5); q = f"Vận tốc {v} km/h, thời gian {t} giờ. Quãng đường:"; ans = f"{v*t} km"; w1, w2, w3 = f"{v+t} km", f"{v//t} km", f"{v*t+10} km"; hint = "s = v x t."
        elif lesson_id in [55, 56]:
            v = random.randint(30, 90); t = random.randint(2, 5); s = v*t; q = f"Quãng đường {s} km, thởi gian {t} giờ. Vận tốc:"; ans = f"{v} km/h"; w1, w2, w3 = f"{s+t} km/h", f"{s//t+10} km/h", f"{s-t} km/h"; hint = "v = s : t."
        elif lesson_id == 57:
            v1, v2 = random.randint(30, 50), random.randint(30, 50); q = f"Ngược chiều: {v1} km/h và {v2} km/h. Vận tốc gần:"; ans = f"{v1+v2} km/h"; w1, w2, w3 = f"{v1*v2} km/h", f"{abs(v1-v2)} km/h", f"{v1+v2+10} km/h"; hint = "Ngược chiều: cộng vận tốc."
        elif lesson_id == 58:
            v = random.randint(30, 90); s = v*random.randint(2, 5); t = s//v; q = f"Quãng đường {s} km, vận tốc {v} km/h. Thời gian:"; ans = f"{t} giờ"; w1, w2, w3 = f"{t+1} giờ", f"{t-1} giờ", f"{s+v} giờ"; hint = "t = s : v."
        elif lesson_id == 61:
            v1, v2 = random.randint(30, 50), random.randint(20, 29); q = f"Cùng chiều: {v1} km/h và {v2} km/h. Vận tốc gần:"; ans = f"{v1-v2} km/h"; w1, w2, w3 = f"{v1+v2} km/h", f"{v1*v2} km/h", f"{v1-v2+5} km/h"; hint = "Cùng chiều: trừ vận tốc."
        elif lesson_id in [62, 63]:
            q = "Biểu đồ hình quạt biểu diễn gì?"; ans = "Tỉ lệ phần trăm"; w1, w2, w3 = "Số lượng", "Thời gian", "Độ dài"; hint = "Biểu đồ quạt biểu diễn %."
        elif lesson_id in [64, 65]:
            a = random.randint(100, 500); pct = random.choice([10, 20, 25, 50]); q = f"{pct}% của {a} là:"; ans = str(a*pct//100); w1, w2, w3 = str(a*pct//100+10), str(a//pct), str(a+pct); hint = "Nhân số với tỉ %."
        elif lesson_id in [66, 67]:
            a = random.randint(100, 500); pct = random.choice([10, 20, 25]); q = f"Giảm {pct}%, giá gốc {a}. Giá sau giảm:"; ans = str(a-a*pct//100); w1, w2, w3 = str(a*pct//100), str(a+a*pct//100), str(a-a*pct//100+10); hint = "Giá gốc - Phần giảm."
        elif lesson_id in [68, 69]:
            a, b = random.randint(100, 999), random.randint(11, 49); q = f"Ôn: {a} x {b} = ?"; ans = str(a*b); w1, w2, w3 = str(a*b+1000), str(a*b-1000), str(a+b); hint = "Ôn nhân số lớn."
        elif lesson_id == 70:
            a, b = random.randint(2, 5), random.randint(1, a-1); tong = (a+b)*random.randint(5, 15); q = f"Ôn tỉ: Tổng {tong}, tỉ {a}:{b}. Số lớn:"; ans = str(tong*a//(a+b)); w1, w2, w3 = str(tong*b//(a+b)), str(tong), str(a+b); hint = "Tổng x Tỉ lớn / Tổng tỉ."
        elif lesson_id == 71:
            r = random.randint(2, 5); q = f"Ôn: Hình tròn r={r}cm. S (π=3,14):"; ans = f"{round(3.14*r*r,2)} cm2"; w1, w2, w3 = f"{round(2*3.14*r,2)} cm2", f"{r*r} cm2", f"{round(3.14*r,2)} cm2"; hint = "S = π x r x r."
        elif lesson_id == 72:
            d, r, h = random.randint(3, 8), random.randint(2, 5), random.randint(2, 6); q = f"Ôn: V hộp {d}x{r}x{h} = ?"; ans = f"{d*r*h} cm3"; w1, w2, w3 = f"{2*(d+r)*h} cm3", f"{d*r+h} cm3", f"{d*r*h+10} cm3"; hint = "V = D x R x C."
        elif lesson_id in [73, 74]:
            v = random.randint(30, 60); t = random.randint(2, 4); q = f"Ôn: v={v} km/h, t={t} giờ. s = ?"; ans = f"{v*t} km"; w1, w2, w3 = f"{v+t} km", f"{v//t} km", f"{v*t+10} km"; hint = "s = v x t."
        elif lesson_id == 75:
            a, b = random.randint(10000, 50000), random.randint(5000, 30000); q = f"Ôn cuối năm: {a} - {b} = ?"; ans = str(a-b); w1, w2, w3 = str(a-b+1000), str(a-b-1000), str(a+b); hint = "Ôn phép trừ."
        else:
            a, b = random.randint(10, 99), random.randint(1, 9); q = f"Tính: {a} + {b} = ?"; ans = str(a+b); w1, w2, w3 = str(a+b+1), str(a+b-1), str(a+b+10); hint = "Thực hiện phép tính."
        opts = self._mix_options(ans, w1, w2, w3)
        return Question(q, opts[:4], ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 5, lesson_id)