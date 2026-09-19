import random
import json
import os
import math
import time
class SmartAI:
    _data_cache = None
    _question_generator = None
    _used_questions = {}  # Lưu câu hỏi đã sử dụng để tránh lặp lại

    @staticmethod
    def load_data():
        if SmartAI._data_cache is None:
            if os.path.exists("math_lessons.json"):
                try:
                    with open("math_lessons.json", "r", encoding="utf-8") as f:
                        SmartAI._data_cache = json.load(f)
                except: SmartAI._data_cache = {}
            else: SmartAI._data_cache = {}
        return SmartAI._data_cache

    @staticmethod
    def get_question_generator():
        """Khởi tạo hoặc lấy instance của QuestionGenerator"""
        if SmartAI._question_generator is None:
            try:
                from question_generator import QuestionGenerator, Difficulty
                SmartAI._question_generator = QuestionGenerator()
            except ImportError:
                print("Warning: question_generator.py not found, using fallback logic")
                SmartAI._question_generator = None
        return SmartAI._question_generator

    @staticmethod
    def get_used_questions_key(grade, lesson_id, difficulty):
        """Tạo key cho việc theo dõi câu hỏi đã sử dụng"""
        return f"grade_{grade}_lesson_{lesson_id}_diff_{difficulty}"

    @staticmethod
    def is_question_used(question_text, grade, lesson_id, difficulty):
        """Kiểm tra câu hỏi đã được sử dụng chưa"""
        key = SmartAI.get_used_questions_key(grade, lesson_id, difficulty)
        if key not in SmartAI._used_questions:
            SmartAI._used_questions[key] = []
        return question_text in SmartAI._used_questions[key]

    @staticmethod
    def mark_question_used(question_text, grade, lesson_id, difficulty):
        """Đánh dấu câu hỏi đã sử dụng"""
        key = SmartAI.get_used_questions_key(grade, lesson_id, difficulty)
        if key not in SmartAI._used_questions:
            SmartAI._used_questions[key] = []
        SmartAI._used_questions[key].append(question_text)
        
        # Giới hạn số câu hỏi lưu trữ để tránh quá tải bộ nhớ
        if len(SmartAI._used_questions[key]) > 50:
            SmartAI._used_questions[key] = SmartAI._used_questions[key][-25:]

    @staticmethod
    def generate_unique_question(grade, lesson_id, difficulty=None, max_attempts=10, user_id=None):
        """Tạo câu hỏi độc nhất, không trùng lặp với adaptive difficulty"""
        generator = SmartAI.get_question_generator()
        
        if generator is None:
            # Fallback về logic cũ nếu không có module
            return SmartAI._fallback_generate(grade, lesson_id, difficulty)
        
        # Chuyển đổi difficulty
        from question_generator import Difficulty as QGDifficulty
        if difficulty is None:
            diff = QGDifficulty.MEDIUM
        elif difficulty <= 1:
            diff = QGDifficulty.EASY
        elif difficulty >= 3:
            diff = QGDifficulty.HARD
        else:
            diff = QGDifficulty.MEDIUM
        
        # Thử tạo câu hỏi không trùng lặp với adaptive difficulty
        for attempt in range(max_attempts):
            try:
                # Sử dụng generate_question với user_id để áp dụng adaptive difficulty
                question = generator.generate_question(grade, lesson_id, diff, user_id)
                
                # Kiểm tra xem câu hỏi đã được sử dụng chưa
                if not SmartAI.is_question_used(question.question_text, grade, lesson_id, difficulty):
                    SmartAI.mark_question_used(question.question_text, grade, lesson_id, difficulty)
                    return question.question_text, question.correct_answer, question.options, question.question_type.value
                elif attempt == max_attempts - 1:
                    # Nếu đã thử max_attempts lần mà vẫn trùng, trả về câu hỏi cuối cùng
                    return question.question_text, question.correct_answer, question.options, question.question_type.value
            except Exception as e:
                print(f"Error generating question: {e}")
                continue
        
        # Fallback nếu không thể tạo câu hỏi
        return SmartAI._fallback_generate(grade, lesson_id, difficulty)

    @staticmethod
    def _fallback_generate(grade, lesson_id, difficulty=None):
        """Logic dự phòng khi không có question_generator"""
        if str(grade) == "1": 
            return SmartAI.grade_1_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "2": 
            return SmartAI.grade_2_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "3": 
            return SmartAI.grade_3_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "4": 
            return SmartAI.grade_4_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "5": 
            return SmartAI.grade_5_logic(int(lesson_id), difficulty=difficulty)
        return SmartAI.fallback_logic()

    @staticmethod
    def _generate_distractors(correct_ans, q_type="numeric"):
        distractors = set()
        if q_type == "compare":
            if correct_ans in [">", "<", "="]: return [">", "<", "=", "+"]
            else: return ["Dài hơn", "Ngắn hơn", "Bằng nhau", "Không biết"]
        if q_type == "geo":
            if "Khối" in str(correct_ans): return ["Khối lập phương", "Khối hộp chữ nhật", "Khối cầu", "Hình trụ"]
            elif "Bên" in str(correct_ans) or "Phía" in str(correct_ans): return ["Bên phải", "Bên trái", "Phía trên", "Phía dưới"]
            elif correct_ans in ["Hình tròn", "Hình vuông", "Hình tam giác", "Hình chữ nhật"]: return ["Hình tròn", "Hình vuông", "Hình tam giác", "Hình chữ nhật"]
            else: return [str(correct_ans), "10", "4", "Vô số"]
        if q_type == "clock":
            try:
                h = int(str(correct_ans).split()[0])
                return [f"{h} giờ", f"{h+1} giờ", "12 giờ", "6 giờ"]
            except: return [str(correct_ans), "12 giờ", "6 giờ", "9 giờ"]
        if q_type == "measure":
            try:
                parts = str(correct_ans).split()
                val = int(parts[0])
                unit = parts[1] if len(parts) > 1 else ""
                return [f"{val} {unit}".strip(), f"{val+1} {unit}".strip(), f"{abs(val-1)} {unit}".strip(), f"{val+10} {unit}".strip()]
            except: pass
        if q_type == "days":
            days = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
            wrong = [d for d in days if d != correct_ans]
            random.shuffle(wrong)
            opts = [correct_ans] + wrong[:3]
            random.shuffle(opts)
            return opts

        try:
            ans_val = int(correct_ans)
            distractors.add(ans_val + 1)
            distractors.add(abs(ans_val - 1))
            distractors.add(ans_val + 10)
            if ans_val >= 10: distractors.add(ans_val - 10)
            if 10 <= ans_val <= 99:
                distractors.add(int(str(ans_val)[::-1]))
            wrong_list = [d for d in distractors if d != ans_val]
            while len(wrong_list) < 3:
                new_distractor = ans_val + random.randint(2, 6)
                if new_distractor not in wrong_list and new_distractor != ans_val:
                    wrong_list.append(new_distractor)
            random.shuffle(wrong_list)
            options = [str(ans_val)] + [str(x) for x in wrong_list[:3]]
            random.shuffle(options)
            return options
        except ValueError:
            return [str(correct_ans), "Đáp án A", "Đáp án B", "Đáp án C"]

    @staticmethod
    def generate_question(grade, lesson_id, difficulty=None, user_id=None):
        """Tạo câu hỏi với độ khó thích ứng từ AdaptiveDifficulty"""
        # Sử dụng hệ thống tạo câu hỏi độc nhất mới với user_id
        q, ans, opts, q_type = SmartAI.generate_unique_question(grade, lesson_id, difficulty, user_id=user_id)
        
        # Áp dụng Adaptive Difficulty nếu có
        if difficulty and difficulty >= 3:
            try:
                ans_val = int(ans)
                # Tăng độ khó bằng cách thêm số lớn hơn vào distractors  
                bonus = (difficulty - 1) * 5
                new_opts = [str(ans_val)]
                new_opts.append(str(ans_val + random.randint(1, 3 + bonus)))
                new_opts.append(str(abs(ans_val - random.randint(1, 2 + bonus))))
                new_opts.append(str(ans_val + random.randint(4, 8 + bonus)))
                random.shuffle(new_opts)
                opts = new_opts
            except (ValueError, TypeError):
                pass
        
        return q, ans, opts, q_type

    @staticmethod
    def _difficulty_multiplier(difficulty):
        try:
            d = int(difficulty) if difficulty is not None else 1
        except:
            d = 1
        d = max(1, min(5, d))
        return 1.0 + (d - 1) * 0.5

    @staticmethod
    def _base_generate(grade, lesson_id, difficulty=None):
        if str(grade) == "1": return SmartAI.grade_1_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "2": return SmartAI.grade_2_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "3": return SmartAI.grade_3_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "4": return SmartAI.grade_4_logic(int(lesson_id), difficulty=difficulty)
        elif str(grade) == "5": return SmartAI.grade_5_logic(int(lesson_id), difficulty=difficulty)
        return SmartAI.fallback_logic()

    # --- LỚP 1 LOGIC - THEO SGK KẾT NỐI TRI THỨC (40 bài) ---
    @staticmethod
    def grade_1_logic(lid, difficulty=None):
        # Đối tượng và tên trong SGK Kết nối tri thức
        objs = ["quả cam", "quả táo", "viên bi", "cái kẹo", "quyển vở", "bông hoa", "chiếc bút", "con tem", "con gà", "con vịt", "quyển sách", "cái thước", "bàn tay", "ngón tay"]
        names = ["Việt", "Mi", "Nam", "Mai", "Tuấn", "Lan", "An", "Bình"]
        obj = random.choice(objs); name1 = random.choice(names); name2 = random.choice([n for n in names if n != name1])
        mult = SmartAI._difficulty_multiplier(difficulty)
        
        def rint(a, b):
            return random.randint(a, max(a, int(b * mult)))

        def get_logic(lid):
            # Bài 1: Các số 0, 1, 2, 3, 4, 5
            if lid == 1:
                n = random.randint(0, 5)
                templates = [
                    {"q": f"Trong hình có {n} {obj}. Hỏi có bao nhiêu {obj}?", "a": n},
                    {"q": f"Bé đếm số {obj} trong hình. Có {n} {obj}. Hỏi số {obj} là số mấy?", "a": n},
                    {"q": f"Số {n} được viết như thế nào?", "a": n}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic"
            
            # Bài 2: Các số 6, 7, 8, 9, 10
            elif lid == 2:
                n = random.randint(6, 10)
                templates = [
                    {"q": f"Có {n} {obj}. Số đó là số mấy?", "a": n},
                    {"q": f"Số liền trước của {n} là số nào?", "a": n-1},
                    {"q": f"Số {n} gồm 5 và mấy?", "a": n-5}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic"
            
            # Bài 3: Nhiều hơn, ít hơn, bằng nhau
            elif lid == 3:
                a, b = random.randint(1, 10), random.randint(1, 10)
                while a == b: b = random.randint(1, 10)
                if a > b:
                    q = f"Nhóm A có {a} {obj}, nhóm B có {b} {obj}. Nhóm nào có nhiều hơn?"
                    ans = "Nhóm A"
                else:
                    q = f"Nhóm A có {a} {obj}, nhóm B có {b} {obj}. Nhóm nào có ít hơn?"
                    ans = "Nhóm A"
                return q, ans, ["Nhóm A", "Nhóm B", "Bằng nhau", "Không biết"], "compare"
            
            # Bài 4: So sánh số
            elif lid == 4:
                a, b = random.randint(0, 10), random.randint(0, 10)
                if random.random() > 0.5:
                    q = f"Điền dấu thích hợp: {a} ... {b}"
                    ans = ">" if a > b else "<" if a < b else "="
                    opts = [">", "<", "="]
                else:
                    q = f"Số lớn hơn trong hai số {a} và {b} là số mấy?"
                    ans = max(a, b)
                    opts = SmartAI._generate_distractors(ans, "numeric")
                return q, str(ans), opts, "compare"
            
            # Bài 5: Mấy và mấy
            elif lid == 5:
                n = random.randint(2, 10); p1 = random.randint(1, n-1); p2 = n - p1
                templates = [
                    {"q": f"Số {n} gồm {p1} và mấy?", "a": p2},
                    {"q": f"{p1} và {p2} hợp thành số mấy?", "a": n},
                    {"q": f"Điền số còn thiếu: {p1} + ... = {n}", "a": p2}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "split"
            
            # Bài 6: Luyện tập chung
            elif lid == 6:
                nums = random.sample(range(11), 3)
                if random.random() > 0.5:
                    q = f"Sắp xếp các số {nums[0]}, {nums[1]}, {nums[2]} theo thứ tự từ bé đến lớn."
                    ans = ", ".join(map(str, sorted(nums)))
                else:
                    q = f"Sắp xếp các số {nums[0]}, {nums[1]}, {nums[2]} theo thứ tự từ lớn đến bé."
                    ans = ", ".join(map(str, sorted(nums, reverse=True)))
                return q, ans, [ans, ", ".join(map(str, nums)), ", ".join(map(str, reversed(nums))), "0, 1, 2"], "logic"
            
            # Bài 7: Hình phẳng (Tròn, tam giác, vuông, chữ nhật)
            elif lid == 7:
                shapes = ["hình tròn", "hình tam giác", "hình vuông", "hình chữ nhật"]
                ans = random.choice(shapes)
                items = {
                    "hình tròn": ["Ông mặt trời", "Cái đĩa", "Bánh xe"],
                    "hình tam giác": ["Mái nhà", "Khăn quàng", "Ê-ke"],
                    "hình vuông": ["Viên gạch men", "Mặt xúc xắc", "Khung cửa sổ vuông"],
                    "hình chữ nhật": ["Quyển vở", "Cái bảng", "Cánh cửa"]
                }
                item = random.choice(items[ans])
                return f"{item} thường có dạng hình gì?", ans, shapes, "geo"
            
            # Bài 8: Vị trí, định hướng trong không gian
            elif lid == 8:
                pos = ["trên", "dưới", "trái", "phải"]
                ans = random.choice(pos)
                if ans == "trên": q = "Mắt nằm ở phía nào so với miệng?"
                elif ans == "dưới": q = "Cái bàn nằm ở phía nào so với quyển sách đặt trên nó?"
                elif ans == "trái": q = "Tay nào thường cầm vở khi tay phải cầm bút?"
                else: q = "Tay nào thường cầm bút khi tay trái cầm vở?"
                return q, ans, ["trên", "dưới", "trái", "phải"], "geo"
            
            # Bài 9: Luyện tập chung (Hình học)
            elif lid == 9:
                return "Hình nào có 4 cạnh bằng nhau?", "hình vuông", ["hình vuông", "hình tròn", "hình tam giác", "hình chữ nhật"], "geo"

            # Bài 10: Phép cộng trong phạm vi 10
            elif lid == 10:
                a = random.randint(1, 5); b = random.randint(0, 5)
                ans = a + b
                templates = [
                    {"q": f"{a} + {b} = ?", "a": ans},
                    {"q": f"{name1} có {a} {obj}, {name2} cho thêm {b} {obj}. Hỏi có tất cả bao nhiêu?", "a": ans}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"

            # Bài 11: Phép trừ trong phạm vi 10
            elif lid == 11:
                a = random.randint(5, 10); b = random.randint(0, a)
                ans = a - b
                templates = [
                    {"q": f"{a} - {b} = ?", "a": ans},
                    {"q": f"Có {a} {obj}, bớt đi {b} {obj}. Còn lại bao nhiêu?", "a": ans}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"

            # Bài 12: Bảng cộng, bảng trừ trong phạm vi 10
            elif lid == 12:
                if random.random() > 0.5:
                    a = random.randint(1, 9); b = random.randint(1, 10-a)
                    return f"Điền số: {a} + ... = {a+b}", str(b), SmartAI._generate_distractors(b, "numeric"), "arithmetic"
                else:
                    a = random.randint(1, 10); b = random.randint(0, a)
                    return f"Điền số: {a} - ... = {a-b}", str(b), SmartAI._generate_distractors(b, "numeric"), "arithmetic"

            # Bài 13: Luyện tập chung
            elif lid == 13:
                a = random.randint(1, 5); b = random.randint(1, 3); c = random.randint(1, 2)
                ans = a + b - c
                return f"Tính: {a} + {b} - {c} = ?", str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic"

            # Bài 14: Khối lập phương, khối hộp chữ nhật
            elif lid == 14:
                shapes = ["khối lập phương", "khối hộp chữ nhật"]
                ans = random.choice(shapes)
                items = {
                    "khối lập phương": ["Khối Rubik", "Con xúc xắc"],
                    "khối hộp chữ nhật": ["Bao diêm", "Viên gạch", "Hộp sữa"]
                }
                item = random.choice(items[ans])
                return f"{item} có dạng khối gì?", ans, shapes + ["khối cầu", "khối trụ"], "geo"

            # Bài 15: Vị trí, định hướng trong không gian (tiếp)
            elif lid == 15:
                pos = ["trước", "sau", "ở giữa"]
                ans = random.choice(pos)
                if ans == "trước": q = "Xe đạp đi trước xe máy, vậy xe máy ở đâu?"
                elif ans == "sau": q = "Bạn An đứng sau bạn Nam, vậy bạn Nam đứng ở đâu?"
                else: q = "Số 2 đứng ở đâu so với số 1 và số 3?"
                return q, ans, ["trước", "sau", "ở giữa", "bên cạnh"], "geo"

            # Bài 16: Luyện tập chung
            elif lid == 16:
                n = random.randint(1, 10)
                return f"{n} cộng với số nào thì bằng chính nó?", "0", ["0", "1", str(n), "10"], "logic"

            # Bài 17: Ôn tập các số trong phạm vi 10
            elif lid == 17:
                n = random.randint(0, 10)
                return f"Số liền sau của {n} là số nào?" if n < 10 else f"Số liền trước của {n} là số nào?", str(n+1) if n < 10 else str(n-1), SmartAI._generate_distractors(n+1 if n < 10 else n-1, "numeric"), "logic"

            # Bài 18: Ôn tập phép cộng, phép trừ trong phạm vi 10
            elif lid == 18:
                a = random.randint(1, 9); b = random.randint(1, 10-a)
                return f"Tính nhẩm: {a} + {b} = ?", str(a+b), SmartAI._generate_distractors(a+b, "numeric"), "arithmetic"

            # Bài 19: Ôn tập hình học
            elif lid == 19:
                return "Hình nào không có cạnh và không có góc?", "hình tròn", ["hình tròn", "hình vuông", "hình tam giác", "hình chữ nhật"], "geo"

            # Bài 20: Ôn tập chung học kì 1
            elif lid == 20:
                return "Số bé nhất có hai chữ số là số nào?", "10", ["0", "1", "10", "9"], "logic"

            # Bài 21: Số có hai chữ số
            elif lid == 21:
                n = random.randint(10, 99)
                return f"Số {n} gồm mấy chục và mấy đơn vị?", f"{n//10} chục và {n%10} đơn vị", [f"{n//10} chục và {n%10} đơn vị", f"{n%10} chục và {n//10} đơn vị", "1 chục", "0 đơn vị"], "logic"

            # Bài 22: So sánh số có hai chữ số
            elif lid == 22:
                a, b = random.randint(10, 99), random.randint(10, 99)
                while a == b: b = random.randint(10, 99)
                q = f"So sánh: {a} ... {b}"
                ans = ">" if a > b else "<"
                return q, ans, [">", "<", "="], "compare"

            # Bài 23: Bảng các số từ 1 đến 100
            elif lid == 23:
                n = random.randint(1, 100)
                return f"Số nào đứng ngay sau số {n-1}?" if n > 1 else f"Số nào đứng ngay trước số {n+1}?", str(n), SmartAI._generate_distractors(n, "numeric"), "logic"

            # Bài 24: Luyện tập chung
            elif lid == 24:
                return "Số tròn chục lớn nhất là bao nhiêu?", "90", ["100", "90", "80", "10"], "logic"

            # Bài 25: Dài hơn, ngắn hơn
            elif lid == 25:
                return "Bút chì 12cm, thước kẻ 15cm. Cái nào dài hơn?", "thước kẻ", ["thước kẻ", "bút chì", "bằng nhau", "không biết"], "compare"

            # Bài 26: Đơn vị đo độ dài (cm)
            elif lid == 26:
                a = random.randint(10, 20); b = random.randint(1, 9)
                return f"{a}cm - {b}cm = ? cm", f"{a-b}cm", [f"{a-b}cm", f"{a-b}", f"{a+b}cm", "10cm"], "measure"

            # Bài 27: Luyện tập chung
            elif lid == 27:
                return "1 chục cm còn được gọi là gì?", "10 cm", ["1 cm", "10 cm", "100 cm", "1000 cm"], "measure"

            # Bài 28: Phép cộng (không nhớ) trong phạm vi 100
            elif lid == 28:
                a = random.randint(1, 4) * 10 + random.randint(1, 5); b = random.randint(1, 4)
                return f"Tính: {a} + {b} = ?", str(a+b), SmartAI._generate_distractors(a+b, "numeric"), "arithmetic"

            # Bài 29: Phép trừ (không nhớ) trong phạm vi 100
            elif lid == 29:
                a = random.randint(5, 9) * 10 + random.randint(5, 9); b = random.randint(1, 4)
                return f"Tính: {a} - {b} = ?", str(a-b), SmartAI._generate_distractors(a-b, "numeric"), "arithmetic"

            # Bài 30: Phép cộng, trừ (không nhớ) trong phạm vi 100
            elif lid == 30:
                a = random.randint(1, 4) * 10; b = random.randint(1, 4) * 10
                return f"Tính nhẩm: {a} + {b} = ?", str(a+b), SmartAI._generate_distractors(a+b, "numeric"), "arithmetic"

            # Bài 31: Luyện tập chung
            elif lid == 31:
                a = random.randint(50, 90); b = random.randint(10, 40)
                return f"Tính nhẩm: {a} - {b} = ?", str(a-b), SmartAI._generate_distractors(a-b, "numeric"), "arithmetic"

            # Bài 32: Xem đồng hồ, thời gian
            elif lid == 32:
                h = random.randint(1, 12)
                return f"Kim ngắn chỉ số {h}, kim dài chỉ số 12. Đồng hồ chỉ mấy giờ?", f"{h} giờ", [f"{h} giờ", f"{h+1} giờ", "12 giờ", "6 giờ"], "clock"

            # Bài 33: Các ngày trong tuần
            elif lid == 33:
                return "Một tuần lễ có bao nhiêu ngày?", "7 ngày", ["5 ngày", "6 ngày", "7 ngày", "8 ngày"], "logic"

            # Bài 34: Xem lịch
            elif lid == 34:
                days = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
                today = random.choice(days[:6])
                idx = days.index(today)
                return f"Nếu hôm nay là {today}, thì ngày mai là thứ mấy?", days[idx+1], [days[idx+1], days[idx-1], "Chủ Nhật", "Thứ Hai"], "logic"

            # Bài 35: Luyện tập chung
            elif lid == 35:
                h = random.randint(1, 5)
                return f"Việt đi học lúc 7 giờ, về nhà lúc 11 giờ. Việt đi học trong mấy giờ?", f"{11-7} giờ", ["3 giờ", "4 giờ", "5 giờ", "11 giờ"], "clock"

            # Bài 36: Ôn tập các số trong phạm vi 100
            elif lid == 36:
                return "Số lớn nhất có hai chữ số là số nào?", "99", ["90", "99", "100", "10"], "logic"

            # Bài 37: Ôn tập phép cộng, phép trừ
            elif lid == 37:
                a = random.randint(10, 90); b = 100 - a
                return f"Điền số: {a} + ... = 100", str(b), SmartAI._generate_distractors(b, "numeric"), "arithmetic"

            # Bài 38: Ôn tập hình học và đo lường
            elif lid == 38:
                return "Đơn vị đo độ dài em đã học là gì?", "xăng-ti-mét", ["xăng-ti-mét", "ki-lô-gam", "lít", "giờ"], "measure"

            # Bài 39: Luyện tập chung
            elif lid == 39:
                a = random.randint(10, 50); b = random.randint(10, 40)
                return f"Tính: {a} + {b} = ?", str(a+b), SmartAI._generate_distractors(a+b, "numeric"), "arithmetic"

            # Bài 40: Ôn tập cuối năm
            elif lid == 40:
                return "Một chục và 5 đơn vị là số mấy?", "15", ["10", "5", "15", "51"], "logic"

            else:
                return SmartAI.fallback_logic()


        q_text, answer, distractors, raw_type = get_logic(lid)
        return q_text, str(answer), distractors, raw_type


    @staticmethod
    def fallback_logic():
        a, b = random.randint(1, 10), random.randint(1, 10)
        ans = a + b
        opts = SmartAI._generate_distractors(ans, "numeric")
        return f"Tính: {a} + {b} = ?", str(ans), opts, "logic"

    # --- LOPS 4 LOGIC - THEO SGK KNTT (73 bài) ---
    @staticmethod
    def grade_4_logic(lid, difficulty=None):
        names = ["An", "Bình", "Chi", "Dung", "Em", "Giang", "Hà", "Hùng", "Lan", "Mai", "Nam", "Quân", "Tú", "Vy"]
        objs = ["quyern sách", "cái bút", "viên bi", "cái kexy", "bông hoa", "quà táo", "chiéc xe", "quà bóng"]
        mult = SmartAI._difficulty_multiplier(difficulty)
        
        def rint(a, b):
            return random.randint(a, max(a, int(b * mult)))
        
        # TAP 1: Bài 1-36
        if lid == 1:  # Ôn tap các sô dên 100000
            val = rint(10000, 99999)
            templates = [
                {"q": f"Doc sô {val}", "a": f"{val//10000} chuc nghìn {val%10000//1000} nghìn {val%1000//100} tram {val%100//10} chuc {val%10} dôn vi", "hint": "Phân tích sô theo hàng"},
                {"q": f"Viêt sô có {val//10000} chuc nghìn {val%10000//1000} nghìn {val%1000//100} tram {val%100//10} chuc {val%10} dôn vi", "a": val, "hint": "Ghép các chû sô theo thû tû"},
                {"q": f"Sô {val} có bao nhiêu chuc nghìn?", "a": val//10000, "hint": "Chuc nghìn là hàng dâu tiên"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 2:  # Ôn tap phép công, phép trù trong pham vi 100000
            a = rint(10000, 50000); b = rint(5000, 30000)
            if random.random() > 0.5:
                ans = a + b
                q = f"Tính: {a} + {b} = ?"
            else:
                ans = a - b if a > b else b - a
                q = f"Tính: {max(a, b)} - {min(a, b)} = ?"
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Công/trù theo hàng"
        
        elif lid == 3:  # Ôn tap phép nhân, phép chia trong pham vi 100000
            a = rint(1000, 10000); b = rint(2, 9)
            if random.random() > 0.5:
                ans = a * b
                q = f"Tính: {a} × {b} = ?"
            else:
                a = b * rint(1000, 10000)
                ans = a // b
                q = f"Tính: {a} ÷ {b} = ?"
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Nhân/chia theo quy tac"
        
        elif lid == 4:  # Biêu thuc chû
            a = rint(10, 50); b = rint(5, 20)
            if random.random() > 0.5:
                q = f"Neu a = {a}, tinh gia tri cua a + {b}"
                ans = a + b
            else:
                q = f"Neu a = {a}, tinh gia tri cua a × {b}"
                ans = a * b
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Thay a = gia tri cho"
        
        elif lid == 5:  # Giai bài toán có ba buôc tính
            a = rint(10, 50); b = rint(2, 9); c = rint(5, 20)
            ans = (a * b) + c
            q = f"{random.choice(names)} có {a} cái bút, mõi cái có {b} ngàn dông, và thêm {c} ngàn dông tiên. Tong sô tiên là bao nhiêu?"
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Nhân trông công, rôngi tiêp"
        
        elif lid == 6:  # Luyên tap chung
            operations = [
                lambda: (f"{rint(10000, 50000)} + {rint(5000, 30000)} = ?", str(rint(15000, 80000)), "arithmetic"),
                lambda: (f"{rint(20000, 60000)} - {rint(5000, 20000)} = ?", str(rint(15000, 55000)), "arithmetic"),
                lambda: (f"{rint(1000, 10000)} × {rint(2, 9)} = ?", str(rint(2000, 90000)), "arithmetic"),
                lambda: (f"{rint(2000, 20000)} ÷ {rint(2, 9)} = ?", str(rint(500, 10000)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap các phép tính"
        
        elif lid == 7:  # Các sô có sáu chû sô. Hàng và lôp
            val = rint(100000, 999999)
            templates = [
                {"q": f"Sô {val} có bao nhiêu chuc nghìn?", "a": val//10000 % 10, "hint": "Chuc nghìn là hàng thû 2 tính tu phai"},
                {"q": f"Sô {val} có bao nhiêu tram nghìn?", "a": val//100000 % 10, "hint": "Tram nghìn là hàng thû 3 tính tu phai"},
                {"q": f"Sô {val} thuôc lôp nào?", "a": "Lôp triêu" if val >= 1000000 else "Lôp nghìn", "hint": "Sô >= 1000000 thuôc lôp triêu"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 8:  # Tong quat vê sô tu nhiên
            templates = [
                {"q": "Dãy sô tu nhiên bât dâu tu sô nào?", "a": "0", "hint": "Dãy sô tu nhiên: 0, 1, 2, 3, ..."},
                {"q": "Có sô tu nhiên lon nhât không?", "a": "Không", "hint": "Dãy sô tu nhiên vô han"},
                {"q": "Sô 0 có phai sô tu nhiên không?", "a": "Có", "hint": "0 là sô tu nhiên dâu tiên"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 9:  # So sánh các sô có nhiêu chû sô
            a = rint(10000, 99999); b = rint(1000, 9999)
            comp = ">" if a > b else "<"
            templates = [
                {"q": f"So sánh: {a} ... {b}", "a": comp, "hint": f"Sô {len(str(a))} chû sô lon hôn sô {len(str(b))} chû sô"},
                {"q": f"Sô nào lon hôn: {a} hay {b}?", "a": f"{a}" if a > b else f"{b}", "hint": "So sánh sô chû sô truôc"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "compare"), "arithmetic", t.get("hint", "")
        
        elif lid == 10:  # Sô tròn chuc, tròn tram, tròn nghìn, tròn chuc nghìn
            types = [
                ("tròn chuc", rint(10, 99) * 10),
                ("tròn tram", rint(10, 99) * 100),
                ("tròn nghìn", rint(10, 99) * 1000),
                ("tròn chuc nghìn", rint(10, 99) * 10000)
            ]
            type_name, val = random.choice(types)
            templates = [
                {"q": f"Sô {val} là sô gì?", "a": f"Sô {type_name}", "hint": f"Sô có tan cuôi là {'0' if 'chuc' in type_name else '00' if 'tram' in type_name else '000' if 'nghìn' in type_name else '00000'}"},
                {"q": f"Viêt môt sô {type_name}?", "a": val, "hint": f"Sô {type_name} có tan cuôi là {'0' if 'chuc' in type_name else '00' if 'tram' in type_name else '000' if 'nghìn' in type_name else '00000'}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 11:  # Làm tròn sô dên hàng nghìn, chuc nghìn, tram nghìn
            val = rint(10000, 999999)
            targets = ["nghìn", "chuc nghìn", "tram nghìn"]
            target = random.choice(targets)
            if target == "nghìn":
                rounded = (val // 1000) * 1000
            elif target == "chuc nghìn":
                rounded = (val // 10000) * 10000
            else:
                rounded = (val // 100000) * 100000
            templates = [
                {"q": f"Làm tròn sô {val} dên hàng {target}", "a": rounded, "hint": f"Giû lai hàng {target} và thay các hàng bên phai bâng 0"},
                {"q": f"Sô {val} làm tròn dên hàng {target} bâng bao nhiêu?", "a": rounded, "hint": f"Xem chû sô hàng bên phai {target} dê quyêt dînh"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 12:  # Các sô trong pham vi lôp Triêu
            val = rint(1000000, 9999999)
            templates = [
                {"q": f"Doc sô {val}", "a": f"{val//1000000} triêu {val%1000000//100000} chuc triêu {val%100000//10000} tram triêu {val%10000//1000} chuc nghìn {val%1000//100} tram {val%100//10} chuc {val%10}", "hint": "Phân tích theo hàng triêu"},
                {"q": f"Sô {val} có bao nhiêu triêu?", "a": val//1000000, "hint": "Hàng triêu là hàng dâu tiên"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 13:  # Làm tròn sô dên hàng triêu
            val = rint(1000000, 9999999)
            rounded = (val // 1000000) * 1000000
            templates = [
                {"q": f"Làm tròn sô {val} dên hàng triêu", "a": rounded, "hint": f"Giû lai hàng triêu, các hàng còn lai bâng 0"},
                {"q": f"Sô {val} làm tròn dên hàng triêu bâng bao nhiêu?", "a": rounded, "hint": f"Xem chû sô hàng chuc triêu dê quyêt dînh"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 14:  # So sánh các sô trong pham vi lôp Triêu
            a = rint(1000000, 9999999); b = rint(100000, 999999)
            comp = ">" if a > b else "<"
            templates = [
                {"q": f"So sánh: {a} ... {b}", "a": comp, "hint": f"Sô {len(str(a))} chû sô lon hôn sô {len(str(b))} chû sô"},
                {"q": f"Sô nào lon hôn: {a} hay {b}?", "a": f"{a}" if a > b else f"{b}", "hint": "So sánh sô chû sô truôc"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "compare"), "arithmetic", t.get("hint", "")
        
        elif lid == 15:  # Luyên tap chung
            operations = [
                lambda: (f"Làm tròn {rint(10000, 999999)} dên hàng nghìn", str((rint(10000, 999999)//1000)*1000), "logic"),
                lambda: (f"Làm tròn {rint(1000000, 9999999)} dên hàng triêu", str((rint(1000000, 9999999)//1000000)*1000000), "logic"),
                lambda: (f"So sánh {rint(100000, 999999)} ... {rint(10000, 99999)}", ">" if rint(100000, 999999) > rint(10000, 99999) else "<", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap sô lôn"
        
        elif lid == 16:  # Luyên tap chung (tiêp)
            a = rint(100000, 999999); b = rint(10000, 99999); c = rint(1000, 9999)
            if random.random() > 0.5:
                q = f"Sâp xép các sô {a}, {b}, {c} theo thû tû tang dân"
                ans_list = sorted([a, b, c])
                ans = f"{ans_list[0]}, {ans_list[1]}, {ans_list[2]}"
            else:
                q = f"Sâp xép các sô {a}, {b}, {c} theo thû tû giam dân"
                ans_list = sorted([a, b, c], reverse=True)
                ans = f"{ans_list[0]}, {ans_list[1]}, {ans_list[2]}"
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), "logic", "So sánh và sâp xép"
        
        elif lid == 17:  # Yên, tza, tân
            conversions = [
                ("yên", "kg", 100),
                ("tza", "kg", 1000),
                ("tân", "kg", 10000)
            ]
            unit, base_unit, factor = random.choice(conversions)
            val = rint(1, 10)
            kg_val = val * factor
            templates = [
                {"q": f"{val} {unit} = ? kg", "a": kg_val, "hint": f"1 {unit} = {factor} kg"},
                {"q": f"{kg_val} kg = ? {unit}", "a": val, "hint": f"{kg_val} kg = {kg_val//factor} {unit}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        elif lid == 18:  # Giây, thê ky
            conversions = [
                ("phút", "giây", 60),
                ("giô", "phút", 60),
                ("ngày", "giô", 24),
                ("thê ky", "nâm", 100)
            ]
            unit, target_unit, factor = random.choice(conversions)
            val = rint(2, 10)
            target_val = val * factor
            templates = [
                {"q": f"{val} {unit} = ? {target_unit}", "a": target_val, "hint": f"1 {unit} = {factor} {target_unit}"},
                {"q": f"{target_val} {target_unit} = ? {unit}", "a": val, "hint": f"{target_val} {target_unit} = {target_val//factor} {unit}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        elif lid == 19:  # Giây, thê ky (tiêp theo)
            val = rint(1900, 2100)
            century = (val - 1) // 100 + 1
            templates = [
                {"q": f"Nâm {val} thuôc thê ky bao nhiêu?", "a": f"Thê ky {century}", "hint": f"Thê ky = (nâm - 1) ÷ 100 + 1"},
                {"q": f"Thê ky {century} bât dâu tu nâm nào?", "a": f"{(century-1)*100 + 1}", "hint": f"Nâm dâu tiên cua thê ky = (thê ky - 1) × 100 + 1"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        elif lid == 20:  # Thûc hành và trai nghiêm sû dung môt sô dôn vi dô
            scenarios = [
                (f"Môt chiêc xe tai chûa {rint(1, 5)} tân hàng. Biêt 1 tân = 1000 kg. Xe tai chûa bao nhiêu kg?", "kg", 1000),
                (f"Môt bô phim diên trong {rint(2, 3)} giô. Biêt 1 giô = 60 phút. Bô phim diên trong bao nhiêu phút?", "phút", 60),
                (f"Mô thêi ky có bao nhiêu nâm?", "nâm", 100)
            ]
            q, unit, factor = random.choice(scenarios)
            if "Môt chiêc xe tai" in q:
                val = rint(1, 5)
                ans = val * factor
                q = f"Môt chiêc xe tai chûa {val} tân hàng. Biêt 1 tân = 1000 kg. Xe tai chûa bao nhiêu kg?"
            elif "Môt bô phim" in q:
                val = rint(2, 3)
                ans = val * factor
                q = f"Môt bô phim diên trong {val} giô. Biêt 1 giô = 60 phút. Bô phim diên trong bao nhiêu phút?"
            else:
                ans = factor
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure", "Quy dôi các dôn vi dô lôn"
        
        elif lid == 21:  # Luyên tap chung
            conversions = [
                (f"{rint(1, 5)} tân = ? kg", rint(1, 5) * 1000),
                (f"{rint(1000, 5000)} kg = ? tân", rint(1000, 5000) // 1000),
                (f"{rint(2, 5)} giô = ? phút", rint(2, 5) * 60),
                (f"{rint(120, 300)} phút = ? giô", rint(120, 300) // 60),
                (f"Nâm {rint(1900, 2100)} thuôc thê ky?", f"Thê ky {(rint(1900, 2100)-1)//100 + 1}")
            ]
            q, ans = random.choice(conversions)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure", "Quy dôi và sô lôn"
        
        elif lid == 22:  # Phép công các sô có nhiêu chû sô
            a = rint(100000, 999999); b = rint(10000, 99999)
            ans = a + b
            templates = [
                {"q": f"Tính: {a} + {b} = ?", "a": ans, "hint": "Công theo hàng tu phai sang trai"},
                {"q": f"{random.choice(names)} có {a} dông, {random.choice(names)} có {b} dông. Tong hai nguôi có bao nhiêu dông?", "a": ans, "hint": f"Tông = {a} + {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 23:  # Phép trù các sô có nhiêu chû sô
            a = rint(200000, 999999); b = rint(10000, 199999)
            ans = a - b
            templates = [
                {"q": f"Tính: {a} - {b} = ?", "a": ans, "hint": "Trù theo hàng tu phai sang trai"},
                {"q": f"{random.choice(names)} có {a} dông, tiêu dî {b} dông. Còn lai bao nhiêu?", "a": ans, "hint": f"Còn lai = {a} - {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 24:  # Tính chât giao hoan và kêt hôi cua phép công
            a = rint(100, 500); b = rint(100, 500); c = rint(100, 500)
            if random.random() > 0.5:
                q = f"Kiêm tra tính chât giao hoan: {a} + {b} = {b} + {a}"
                ans = "Dúng"
            else:
                q = f"Tính ({a} + {b}) + {c} và {a} + ({b} + {c})"
                ans = f"Câu hai = {a + b + c}"
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Tính chât giao hoan, kêt hôi"
        
        elif lid == 25:  # Tìm hai sô khi biêt tông và hiêu cua hai sô dô
            total = rint(100, 500); diff = rint(10, 100)
            num1 = (total + diff) // 2; num2 = total - num1
            templates = [
                {"q": f"Tông cua hai sô là {total}, hiêu là {diff}. Tìm hai sô dô", "a": f"{num1} và {num2}", "hint": f"Sô lôn = ({total} + {diff}) ÷ 2 = {num1}, Sô bé = ({total} - {diff}) ÷ 2 = {num2}"},
                {"q": f"Hai sô có tông {total} và chênh lênh {diff}. Hai sô dô là gì?", "a": f"{num1} và {num2}", "hint": "Sû dung công thûc tìm hai sô khi biêt tông và hiêu"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 26:  # Luyên tap chung
            a = rint(100000, 500000); b = rint(50000, 200000)
            operations = [
                (f"Tông cua hai sô là {a+b}, hiêu là {abs(a-b)}. Tìm hai sô", f"{max(a,b)} và {min(a,b)}"),
                (f"{a} + {b} = ?", str(a+b)),
                (f"{max(a,b)} - {min(a,b)} = ?", str(abs(a-b)))
            ]
            q, ans = random.choice(operations)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Tông - hiêu và phép tính"
        
        elif lid == 27:  # Hai duông thang vuông góc. Vê hai duong thang vuông góc
            templates = [
                {"q": "Hai duong thang vuông góc tao thành bao nhiêu góc vuông?", "a": "4", "hint": "Hai duong thang vuông góc cat nhau tao thành 4 góc vuông"},
                {"q": "Khi hai duong thang cat nhau và tao thành 4 góc vuông, hai duong thang dô có quan hê gì?", "a": "Vuông góc", "hint": "Hai duong thang vuông góc khi cat nhau tao thành 4 góc vuông"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 28:  # Hai duong thang song song. Vê hai duong thang song song
            templates = [
                {"q": "Hai duong thang song song có cat nhau không?", "a": "Không", "hint": "Hai duong thang song song không bao giò cat nhau dù kéo dài mãi"},
                {"q": "Dâu là dâu hiêu cua hai duong thang song song?", "a": "Không bao giò cat nhau", "hint": "Hai duong thang song song luôn giûa khoang cách không dôi"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 29:  # Duong cao cua hình tam giác
            a = rint(5, 20); h = rint(3, 15)
            templates = [
                {"q": f"Duong cao cua hình tam giác là doan thang nào?", "a": f"Doan thang hâu vuông góc tû dînh xuông côt dôi diên", "hint": "Duong cao luôn vuông góc vôi côt dôi diên"},
                {"q": f"Hình tam giác có côt dôi diên dài {a}m và duong cao {h}m. Diên tích là bao nhiêu m²?", "a": (a*h)//2, "hint": f"S = (côt dôi diên × duong cao) ÷ 2 = ({a} × {h}) ÷ 2 = {(a*h)//2}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 30:  # Thûc hành và trai nghiêm vê hai duong thang song song
            templates = [
                {"q": "Dê vê hai duong thang song song, ta câm thuong và ê-ke?", "a": "Câm thuong và ê-ke", "hint": "Dùng ê-ke dê duong thang, dùng thuong dê song song"},
                {"q": "Khi vê hai duong thang song song, hai duong thang phai có khoang cách?", "a": "Không dôi", "hint": "Hai duong thang song song luôn giûa khoang cách không dôi"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 31:  # Hình bình hành
            a = rint(5, 20); b = rint(3, 15)
            templates = [
                {"q": "Hình bình hành có dâu dâu biêu?", "a": "Hai côt dôi diên song song và bâng nhau", "hint": "Hình bình hành là hình có hai côt dôi diên song song và bâng nhau"},
                {"q": f"Hình bình hành có côt dài {a}m và côt ngan {b}m. Chu vi là bao nhiêu mét?", "a": 2*(a+b), "hint": f"P = 2 × (côt dài + côt ngan) = 2 × ({a} + {b}) = {2*(a+b)}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 32:  # Hình thoi
            a = rint(5, 20)
            templates = [
                {"q": "Hình thoi có dâu dâu biêu?", "a": "Bôn côt bâng nhau và hai côt dôi diên song song", "hint": "Hình thoi là hình có bôn côt bâng nhau và hai côt dôi diên song song"},
                {"q": f"Hình thoi có côt dài {a}m. Chu vi là bao nhiêu mét?", "a": 4*a, "hint": f"P = 4 × côt = 4 × {a} = {4*a}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 33:  # Luyên tap chung
            shapes = [
                ("Hình bình hành", "hai côt dôi diên song song và bâng nhau"),
                ("Hình thoi", "bôn côt bâng nhau và hai côt dôi diên song song"),
                ("Hình tam giác", "ba côt"),
                ("Hình chû nhât", "bôn góc vuông và hai côt dôi diên song song")
            ]
            shape, feature = random.choice(shapes)
            templates = [
                {"q": f"Dâu là dâu biêu cua {shape}?", "a": feature, "hint": f"{shape} có dâu biêu: {feature}"},
                {"q": f"Hình nào có {feature}?", "a": shape, "hint": f"{shape} là hình có {feature}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 34:  # Ba góc: góc nhon, góc tù, góc bêt
            angles = [
                ("góc nhon", "< 90°"),
                ("góc tù", "> 90° và < 180°"),
                ("góc bêt", "= 180°"),
                ("góc vuông", "= 90°")
            ]
            angle_type, measure = random.choice(angles)
            templates = [
                {"q": f"{angle_type} có dô lôn bao nhiêu?", "a": measure, "hint": f"{angle_type} có dô lôn {measure}"},
                {"q": f"Góc có dô lôn {measure} là góc gì?", "a": angle_type, "hint": f"Dô lôn {measure} thuôc {angle_type}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 35:  # Luyên tap chung
            angle_degrees = [30, 45, 60, 90, 120, 150, 180]
            deg = random.choice(angle_degrees)
            if deg < 90:
                angle_type = "góc nhon"
            elif deg == 90:
                angle_type = "góc vuông"
            elif deg < 180:
                angle_type = "góc tù"
            else:
                angle_type = "góc bêt"
            templates = [
                {"q": f"Góc {deg}° là góc gì?", "a": angle_type, "hint": f"Dô lôn {deg}° thuôc {angle_type}"},
                {"q": f"Môt góc có dô lôn {deg}°. Góc dô là góc gì?", "a": angle_type, "hint": f"Dô lôn {deg}° thuôc {angle_type}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 36:  # Ôn tap hoc ky 1
            operations = [
                lambda: (f"{rint(100000, 500000)} + {rint(50000, 200000)} = ?", str(rint(150000, 700000)), "arithmetic"),
                lambda: (f"{rint(200000, 600000)} - {rint(50000, 150000)} = ?", str(rint(150000, 550000)), "arithmetic"),
                lambda: (f"Làm tròn {rint(10000, 999999)} dên hàng nghìn", str((rint(10000, 999999)//1000)*1000), "logic"),
                lambda: (f"{rint(1, 5)} tân = ? kg", str(rint(1, 5) * 1000), "measure"),
                lambda: ("Hai duong thang song song có cat nhau không?", "Không", "geo")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap HK1"
        
        elif lid == 37:  # Ôn tap chung
            total = rint(200, 800); diff = rint(50, 200)
            num1 = (total + diff) // 2; num2 = total - num1
            templates = [
                {"q": f"Tông cua hai sô là {total}, hiêu là {diff}. Hai sô dô là gì?", "a": f"{num1} và {num2}", "hint": f"Sô lôn = ({total} + {diff}) ÷ 2, Sô bé = ({total} - {diff}) ÷ 2"},
                {"q": f"Hai sô {num1} và {num2} có tông và hiêu là bao nhiêu?", "a": f"Tông = {total}, Hiêu = {diff}", "hint": f"Tông = {num1} + {num2} = {total}, Hiêu = {num1} - {num2} = {diff}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # TAP 2: Bài 38-73
        elif lid == 38:  # Nhân vôi sô có môt chû sô
            a = rint(1000, 99999); b = rint(2, 9)
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Nhân mõi hàng cua {a} vôi {b}, có nhô khi cân"},
                {"q": f"{random.choice(names)} có {a} dông, mõi ngày tiêu dî {b} dông. Sau bao nhiêu ngày tiêu hêt?", "a": ans, "hint": f"Sô ngày = {a} ÷ {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 39:  # Nhân vôi 10, 100, 1000...
            a = rint(100, 9999); multipliers = [10, 100, 1000, 10000]
            b = random.choice(multipliers)
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Nhân vôi {b} là thêm {len(str(b))-1} sô 0 vào cuôi {a}"},
                {"q": f"{a} nhân vôi {b} bâng bao nhiêu?", "a": ans, "hint": f"{a} × {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 40:  # Tính chât giao hoan và kêt hôi cua phép nhân
            a = rint(10, 50); b = rint(10, 50); c = rint(10, 50)
            if random.random() > 0.5:
                q = f"Kiêm tra tính chât giao hoan: {a} × {b} = {b} × {a}"
                ans = "Dúng"
            else:
                q = f"Tính ({a} × {b}) × {c} và {a} × ({b} × {c})"
                ans = f"Câu hai = {a * b * c}"
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Tính chât giao hoan, kêt hôi"
        
        elif lid == 41:  # Nhân vôi sô có hai chû sô
            a = rint(1000, 99999); b = rint(10, 99)
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Nhân {a} vôi hàng dôn vi cua {b} rôngi lùi 1 côt, nhân vôi hàng chuc rôngi công"},
                {"q": f"{a} nhân vôi {b} bâng bao nhiêu?", "a": ans, "hint": "Dùng công thûc nhân sô có hai chû sô"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 42:  # Luyên tap chung
            a = rint(1000, 50000); b = rint(10, 99)
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": a*b, "hint": "Nhân theo hàng"},
                {"q": f"{random.choice(names)} có {a} cái bút, môi cái giá {b} dông. Tong gia tri là bao nhiêu?", "a": a*b, "hint": f"Tông = {a} × {b} = {a*b}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 43:  # Chia cho sô có môt chû sô
            a = rint(1000, 99999); b = rint(2, 9)
            ans = a // b
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans, "hint": f"Chia {a} cho {b} theo hàng tu trai sang phai"},
                {"q": f"{a} cái bút chia dêu cho {b} hoc sinh. Môi hoc sinh dâu bao nhiêu cái?", "a": ans, "hint": f"Môi nguôi dâu {a} ÷ {b} = {ans} cái"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 44:  # Chia cho 10, 100, 1000...
            a = rint(1000, 999999); divisors = [10, 100, 1000, 10000]
            b = random.choice(divisors)
            ans = a // b
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans, "hint": f"Chia cho {b} là bôt {len(str(b))-1} sô 0 o cuôi {a}"},
                {"q": f"{a} chia cho {b} bâng bao nhiêu?", "a": ans, "hint": f"{a} ÷ {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 45:  # Thûc hiên phép chia cho sô có hai chû sô
            a = rint(1000, 99999); b = rint(10, 99)
            ans = a // b
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans, "hint": f"Chia {a} cho {b}, lây {b} sô dâu tiên cua {a} dê uring luong thuong"},
                {"q": f"{a} chia cho {b} dâu bao nhiêu?", "a": ans, "hint": "Dùng phép chia có hai chû sô"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 46:  # Luyên tap chung
            a = rint(1000, 50000); b = rint(10, 99)
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": a//b, "hint": "Chia theo hàng"},
                {"q": f"{a} cái bút chia dêu cho {b} hoc sinh. Môi hoc sinh dâu bao nhiêu?", "a": a//b, "hint": f"Môi nguôi dâu {a} ÷ {b} = {a//b} cái"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 47:  # Luyên tap chung (tông hôi)
            operations = [
                lambda: (f"{rint(1000, 50000)} × {rint(10, 99)} = ?", str(rint(1000, 50000) * rint(10, 99)), "arithmetic"),
                lambda: (f"{rint(1000, 50000)} ÷ {rint(10, 99)} = ?", str(rint(1000, 50000) // rint(10, 99)), "arithmetic"),
                lambda: (f"{rint(1000, 99999)} × {rint(2, 9)} = ?", str(rint(1000, 99999) * rint(2, 9)), "arithmetic"),
                lambda: (f"{rint(1000, 99999)} ÷ {rint(2, 9)} = ?", str(rint(1000, 99999) // rint(2, 9)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap nhân chia"
        
        elif lid == 48:  # Phân sô và phép chia sô tu nhiên
            a = rint(2, 20); b = rint(2, 9)
            templates = [
                {"q": f"Phân sô {a}/{b} có thê coi là thuong cua phép chia nào?", "a": f"{a} ÷ {b}", "hint": f"Phân sô a/b = thuong cua a ÷ b"},
                {"q": f"Viêt phân sô {a}/{b} dâng dâu phép chia?", "a": f"{a} ÷ {b}", "hint": f"{a}/{b} = {a} ÷ {b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 49:  # Phân sô bâng nhau
            a = rint(2, 10); b = rint(2, 10); k = rint(2, 5)
            templates = [
                {"q": f"Phân sô {a*k}/{b*k} có bâng vôi phân sô {a}/{b} không?", "a": "Bâng nhau", "hint": f"{a*k}/{b*k} = {a}/{b} vi nhân và chia cûa tu và mâu bâng k"},
                {"q": f"Phân sô {a}/{b} và {a*k}/{b*k} có quan hê gì?", "a": "Bâng nhau", "hint": f"Hai phân sô bâng nhau vi {a*k}/{b*k} = {a}/{b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 50:  # Rút gôn phân sô
            a = rint(4, 20); b = rint(4, 20); k = rint(2, 5)
            while a % k != 0 or b % k != 0:
                a = rint(4, 20); b = rint(4, 20); k = rint(2, 5)
            simplified_a = a // k; simplified_b = b // k
            templates = [
                {"q": f"Rút gôn phân sô {a*k}/{b*k}", "a": f"{simplified_a}/{simplified_b}", "hint": f"Chia tu và mâu cho UCLN = {k}"},
                {"q": f"Phân sô rút gôn cua {a*k}/{b*k} là gì?", "a": f"{simplified_a}/{simplified_b}", "hint": f"({a*k}÷{k})/({b*k}÷{k}) = {simplified_a}/{simplified_b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 51:  # Quy dông mâu sô các phân sô
            a1 = rint(2, 10); b1 = rint(3, 11); a2 = rint(2, 10); b2 = rint(3, 11)
            while b1 == b2:
                b2 = rint(3, 11)
            lcm = b1 * b2  # Giân dôn, nhân mâu sô
            templates = [
                {"q": f"Quy dông mâu sô phân sô {a1}/{b1} và {a2}/{b2}", "a": f"{a1*b2}/{lcm}, {a2*b1}/{lcm}", "hint": f"Mâu sô chung = {b1} × {b2} = {lcm}"},
                {"q": f"Viêt {a1}/{b1} và {a2}/{b2} vôi mâu sô chung", "a": f"{a1*b2}/{lcm} và {a2*b1}/{lcm}", "hint": f"Nhân tu và mâu dê có cùng mâu sô"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 52:  # So sánh hai phân sô cùng mâu sô
            a1 = rint(1, 10); a2 = rint(1, 10); b = rint(3, 11)
            while a1 == a2:
                a2 = rint(1, 10)
            comp = ">" if a1 > a2 else "<"
            templates = [
                {"q": f"So sánh: {a1}/{b} ... {a2}/{b}", "a": comp, "hint": f"Cùng mâu sô, so sánh tu sô: {a1} {comp} {a2}"},
                {"q": f"Phân sô nào lon hôn: {a1}/{b} hay {a2}/{b}?", "a": f"{a1}/{b}" if a1 > a2 else f"{a2}/{b}", "hint": "Cùng mâu sô, tu nào lon hôn phân sô dâu lon hôn"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "compare"), "arithmetic", t.get("hint", "")
        
        elif lid == 53:  # So sánh hai phân sô khác mâu sô
            a1 = rint(1, 10); b1 = rint(3, 11); a2 = rint(1, 10); b2 = rint(3, 11)
            lcm = b1 * b2
            new_a1 = a1 * b2; new_a2 = a2 * b1
            comp = ">" if new_a1 > new_a2 else "<"
            templates = [
                {"q": f"So sánh: {a1}/{b1} ... {a2}/{b2}", "a": comp, "hint": f"Quy dông mâu: {new_a1}/{lcm} {comp} {new_a2}/{lcm}"},
                {"q": f"Phân sô nào lon hôn: {a1}/{b1} hay {a2}/{b2}?", "a": f"{a1}/{b1}" if new_a1 > new_a2 else f"{a2}/{b2}", "hint": "Quy dông mâu sô rôngi so sánh"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "compare"), "arithmetic", t.get("hint", "")
        
        elif lid == 54:  # Luyên tap chung
            operations = [
                lambda: (f"Rút gôn {rint(4,20)*rint(2,5)}/{rint(4,20)*rint(2,5)}", f"{rint(4,20)}/{rint(4,20)}", "arithmetic"),
                lambda: (f"So sánh {rint(1,10)}/{rint(3,11)} ... {rint(1,10)}/{rint(3,11)}", ">" if rint(1,10) > rint(1,10) else "<", "arithmetic"),
                lambda: (f"{rint(2,10)}/{rint(3,11)} có thê coi là thuong cua phép chia nào?", f"{rint(2,10)} ÷ {rint(3,11)}", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap phân sô"
        
        elif lid == 55:  # Phép công phân sô
            a1 = rint(1, 10); b1 = rint(3, 11); a2 = rint(1, 10); b2 = rint(3, 11)
            if b1 == b2:
                ans_num = a1 + a2
                ans = f"{ans_num}/{b1}"
                hint = f"Cùng mâu sô, công tu sô: {a1} + {a2} = {ans_num}, giû lai mâu sô {b1}"
            else:
                lcm = b1 * b2
                ans_num = a1 * b2 + a2 * b1
                ans = f"{ans_num}/{lcm}"
                hint = f"Quy dông mâu: {a1*b2}/{lcm} + {a2*b1}/{lcm} = {ans_num}/{lcm}"
            templates = [
                {"q": f"Tính: {a1}/{b1} + {a2}/{b2} = ?", "a": ans, "hint": hint},
                {"q": f"{random.choice(names)} có {a1}/{b1} cái bánh, {random.choice(names)} có {a2}/{b2} cái bánh. Tong là bao nhiêu?", "a": ans, "hint": hint}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 56:  # Phép trù phân sô
            a1 = rint(5, 10); b1 = rint(3, 11); a2 = rint(1, 8); b2 = rint(3, 11)
            if b1 == b2:
                ans_num = a1 - a2
                ans = f"{ans_num}/{b1}"
                hint = f"Cùng mâu sô, trù tu sô: {a1} - {a2} = {ans_num}, giû lai mâu sô {b1}"
            else:
                lcm = b1 * b2
                ans_num = a1 * b2 - a2 * b1
                ans = f"{ans_num}/{lcm}"
                hint = f"Quy dông mâu: {a1*b2}/{lcm} - {a2*b1}/{lcm} = {ans_num}/{lcm}"
            templates = [
                {"q": f"Tính: {a1}/{b1} - {a2}/{b2} = ?", "a": ans, "hint": hint},
                {"q": f"{random.choice(names)} có {a1}/{b1} cái bánh, cho dî {a2}/{b2} cái bánh. Còn lai bao nhiêu?", "a": ans, "hint": hint}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 57:  # Luyên tap chung
            a1 = rint(1, 10); b1 = rint(3, 11); a2 = rint(1, 10); b2 = rint(3, 11)
            if random.random() > 0.5:
                if b1 == b2:
                    ans_num = a1 + a2
                    ans = f"{ans_num}/{b1}"
                else:
                    lcm = b1 * b2
                    ans_num = a1 * b2 + a2 * b1
                    ans = f"{ans_num}/{lcm}"
                q = f"Tính: {a1}/{b1} + {a2}/{b2} = ?"
            else:
                if b1 == b2:
                    ans_num = a1 - a2
                    ans = f"{ans_num}/{b1}"
                else:
                    lcm = b1 * b2
                    ans_num = a1 * b2 - a2 * b1
                    ans = f"{ans_num}/{lcm}"
                q = f"Tính: {a1}/{b1} - {a2}/{b2} = ?"
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Công/trù phân sô"
        
        elif lid == 58:  # Phép nhân phân sô
            a1 = rint(1, 10); b1 = rint(2, 11); a2 = rint(1, 10); b2 = rint(2, 11)
            ans_num = a1 * a2; ans_den = b1 * b2
            templates = [
                {"q": f"Tính: {a1}/{b1} × {a2}/{b2} = ?", "a": f"{ans_num}/{ans_den}", "hint": f"Nhân tu vôi tu, mâu vôi mâu: {a1}×{a2}/{b1}×{b2} = {ans_num}/{ans_den}"},
                {"q": f"Mûn {a1}/{b1} cái bánh, mûn {a2}/{b2} cái bánh. Lây {a2}/{b2} sô {a1}/{b1} là bao nhiêu?", "a": f"{ans_num}/{ans_den}", "hint": f"{a1}/{b1} × {a2}/{b2} = {ans_num}/{ans_den}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 59:  # Phép chia phân sô
            a1 = rint(1, 10); b1 = rint(2, 11); a2 = rint(1, 10); b2 = rint(2, 11)
            ans_num = a1 * b2; ans_den = b1 * a2
            templates = [
                {"q": f"Tính: {a1}/{b1} ÷ {a2}/{b2} = ?", "a": f"{ans_num}/{ans_den}", "hint": f"Nhân vôi phân sô dâo ngâu: {a1}/{b1} × {b2}/{a2} = {ans_num}/{ans_den}"},
                {"q": f"{a1}/{b1} cái bánh chia dêu cho {a2}/{b2} nguôi. Môi nguôi dâu bao nhiêu?", "a": f"{ans_num}/{ans_den}", "hint": f"{a1}/{b1} ÷ {a2}/{b2} = {a1}/{b1} × {b2}/{a2} = {ans_num}/{ans_den}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 60:  # Luyên tap chung
            a1 = rint(1, 10); b1 = rint(2, 11); a2 = rint(1, 10); b2 = rint(2, 11)
            operations = [
                (f"{a1}/{b1} × {a2}/{b2} = ?", f"{a1*a2}/{b1*b2}"),
                (f"{a1}/{b1} ÷ {a2}/{b2} = ?", f"{a1*b2}/{b1*a2}")
            ]
            q, ans = random.choice(operations)
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Nhân/chia phân sô"
        
        elif lid == 61:  # Luyên tap chung (tông hôi)
            a1 = rint(1, 10); b1 = rint(2, 11); a2 = rint(1, 10); b2 = rint(2, 11)
            ops = [
                (f"{a1}/{b1} + {a2}/{b2}", "công"),
                (f"{a1}/{b1} - {a2}/{b2}", "trù"),
                (f"{a1}/{b1} × {a2}/{b2}", "nhân"),
                (f"{a1}/{b1} ÷ {a2}/{b2}", "chia")
            ]
            expr, op_name = random.choice(ops)
            if op_name == "công":
                if b1 == b2:
                    ans = f"{a1+a2}/{b1}"
                else:
                    ans = f"{a1*b2+a2*b1}/{b1*b2}"
            elif op_name == "trù":
                if b1 == b2:
                    ans = f"{a1-a2}/{b1}"
                else:
                    ans = f"{a1*b2-a2*b1}/{b1*b2}"
            elif op_name == "nhân":
                ans = f"{a1*a2}/{b1*b2}"
            else:
                ans = f"{a1*b2}/{b1*a2}"
            return f"Tính: {expr} = ?", ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", f"Phép {op_name} phân sô"
        
        elif lid == 62:  # Tìm phân sô cua môt sô
            a = rint(2, 10); b = rint(2, 10); m = rint(10, 100)
            ans_num = a * m; ans = f"{ans_num}/{b}"
            templates = [
                {"q": f"Tìm {a}/{b} cua {m}", "a": ans, "hint": f"{a}/{b} cua {m} = {m} × {a}/{b} = {ans_num}/{b}"},
                {"q": f"{a}/{b} sô {m} bâng bao nhiêu?", "a": ans, "hint": f"{m} × {a}/{b} = {ans_num}/{b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 63:  # Giai bài toán có lôi van liên quan dên phân sô
            a = rint(2, 10); b = rint(2, 10); total = rint(20, 100)
            part_val = (total * a) // b
            templates = [
                {"q": f"{random.choice(names)} có {total} cái bánh. {random.choice(names)} lây {a}/{b} sô bánh. {random.choice(names)} lây bao nhiêu cái bánh?", "a": part_val, "hint": f"{a}/{b} cua {total} = {total} × {a}/{b} = {part_val}"},
                {"q": f"Môt lôp có {total} hoc sinh, trong dô {a}/{b} sô hoc sinh là hoc sinh gioni. Hoi có bao nhiêu hoc sinh gioni?", "a": part_val, "hint": f"{a}/{b} cua {total} = {total} × {a}/{b} = {part_val}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 64:  # Lâp biêu dô tranh
            data = [rint(10, 50), rint(10, 50), rint(10, 50)]
            icons = ["quà cam", "quà táo", "quà chuôi"]
            templates = [
                {"q": f"Lâp biêu dô tranh cho sô liêu: {icons[0]}: {data[0]}, {icons[1]}: {data[1]}, {icons[2]}: {data[2]}", "a": "Biêu dô tranh dã lâp", "hint": "Sû dung hình ânh dê biêu diên sô liêu"},
                {"q": f"Sô liêu: {icons[0]}: {data[0]}, {icons[1]}: {data[1]}, {icons[2]}: {data[2]}. Lâp biêu dô phù hôi?", "a": "Biêu dô tranh", "hint": "Biêu dô tranh dùng hình ânh"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 65:  # Biêu dô côt
            data = [rint(20, 100), rint(20, 100), rint(20, 100)]
            labels = ["Lôp 4A", "Lôp 4B", "Lôp 4C"]
            templates = [
                {"q": f"Lâp biêu dô côt cho sô liêu: {labels[0]}: {data[0]} hoc sinh, {labels[1]}: {data[1]} hoc sinh, {labels[2]}: {data[2]} hoc sinh", "a": "Biêu dô côt dã lâp", "hint": "Sû dung các côt có cao khác nhau dê biêu diên sô liêu"},
                {"q": f"Sô hoc sinh các lôp: {labels[0]}: {data[0]}, {labels[1]}: {data[1]}, {labels[2]}: {data[2]}. Lâp biêu dô gì?", "a": "Biêu dô côt", "hint": "Biêu dô côt dùng các côt"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 66:  # Trung bình công
            nums = [rint(10, 50), rint(10, 50), rint(10, 50), rint(10, 50)]
            avg = sum(nums) // len(nums)
            templates = [
                {"q": f"Trung bình công cua các sô {', '.join(map(str, nums))} là bao nhiêu?", "a": avg, "hint": f"Trung bình = ({' + '.join(map(str, nums))}) ÷ {len(nums)} = {avg}"},
                {"q": f"Tính trung bình công: {nums[0]}, {nums[1]}, {nums[2]}, {nums[3]}", "a": avg, "hint": f"Công các sô rôngi chia cho sô luong"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 67:  # Tìm hai sô khi biêt tông và tî sô cua hai sô dô
            total = rint(50, 200); ratio_a = rint(2, 5); ratio_b = rint(2, 5)
            total_parts = ratio_a + ratio_b
            part_value = total // total_parts
            num1 = part_value * ratio_a; num2 = part_value * ratio_b
            templates = [
                {"q": f"Tông cua hai sô là {total}, tî sô là {ratio_a}:{ratio_b}. Tìm hai sô dô", "a": f"{num1} và {num2}", "hint": f"Tông sô phan = {ratio_a} + {ratio_b} = {total_parts}, Giá tri 1 phan = {total} ÷ {total_parts} = {part_value}"},
                {"q": f"Hai sô có tông {total} và tî sô {ratio_a}:{ratio_b}. Hai sô dô là gì?", "a": f"{num1} và {num2}", "hint": "Dùng tî sô dê chia tông"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 68:  # Tìm hai sô khi biêt hiêu và tî sô cua hai sô dô
            diff = rint(20, 100); ratio_a = rint(3, 8); ratio_b = rint(2, 5)
            while ratio_a <= ratio_b:
                ratio_b = rint(2, 5)
            diff_parts = ratio_a - ratio_b
            part_value = diff // diff_parts
            num1 = part_value * ratio_a; num2 = part_value * ratio_b
            templates = [
                {"q": f"Hiêu cua hai sô là {diff}, tî sô là {ratio_a}:{ratio_b}. Tìm hai sô dô", "a": f"{num1} và {num2}", "hint": f"Hiêu sô phan = {ratio_a} - {ratio_b} = {diff_parts}, Giá tri 1 phan = {diff} ÷ {diff_parts} = {part_value}"},
                {"q": f"Hai sô có chênh lênh {diff} và tî sô {ratio_a}:{ratio_b}. Hai sô dô là gì?", "a": f"{num1} và {num2}", "hint": "Dùng tî sô dê chia hiêu"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 69:  # Luyên tap chung
            scenarios = [
                (f"Tông cua hai sô là {rint(50, 200)}, tî sô là {rint(2, 5)}:{rint(2, 5)}. Tìm hai sô", "Dùng tî sô"),
                (f"Hiêu cua hai sô là {rint(20, 100)}, tî sô là {rint(3, 8)}:{rint(2, 5)}. Tìm hai sô", "Dùng tî sô"),
                (f"Trung bình công cua {rint(10, 50)}, {rint(10, 50)}, {rint(10, 50)} là bao nhiêu?", str((rint(10, 50) + rint(10, 50) + rint(10, 50)) // 3))
            ]
            q, ans = random.choice(scenarios)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Tông, hiêu, tî sô, trung bình"
        
        elif lid == 70:  # Ôn tap sô tu nhiên và các phép tính
            operations = [
                lambda: (f"{rint(100000, 500000)} + {rint(50000, 200000)} = ?", str(rint(150000, 700000)), "arithmetic"),
                lambda: (f"{rint(200000, 600000)} - {rint(50000, 150000)} = ?", str(rint(150000, 550000)), "arithmetic"),
                lambda: (f"{rint(1000, 50000)} × {rint(10, 99)} = ?", str(rint(1000, 50000) * rint(10, 99)), "arithmetic"),
                lambda: (f"{rint(1000, 50000)} ÷ {rint(10, 99)} = ?", str(rint(1000, 50000) // rint(10, 99)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap sô và phép tính"
        
        elif lid == 71:  # Ôn tap phân sô và các phép tính
            a1 = rint(1, 10); b1 = rint(2, 11); a2 = rint(1, 10); b2 = rint(2, 11)
            ops = [
                (f"{a1}/{b1} + {a2}/{b2}", "công"),
                (f"{a1}/{b1} - {a2}/{b2}", "trù"),
                (f"{a1}/{b1} × {a2}/{b2}", "nhân"),
                (f"{a1}/{b1} ÷ {a2}/{b2}", "chia")
            ]
            expr, op_name = random.choice(ops)
            if op_name == "công":
                if b1 == b2:
                    ans = f"{a1+a2}/{b1}"
                else:
                    ans = f"{a1*b2+a2*b1}/{b1*b2}"
            elif op_name == "trù":
                if b1 == b2:
                    ans = f"{a1-a2}/{b1}"
                else:
                    ans = f"{a1*b2-a2*b1}/{b1*b2}"
            elif op_name == "nhân":
                ans = f"{a1*a2}/{b1*b2}"
            else:
                ans = f"{a1*b2}/{b1*a2}"
            return f"Tính: {expr} = ?", ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", f"Ôn tap {op_name} phân sô"
        
        elif lid == 72:  # Ôn tap hình hoc và dô luong
            shapes = [
                ("Hình bình hành", "hai côt dôi diên song song và bâng nhau", 2*(rint(5,20)+rint(3,15))),
                ("Hình thoi", "bôn côt bâng nhau", 4*rint(5,20)),
                ("Hình tam giác", "ba côt", (rint(5,20)*rint(3,15))//2),
                ("Hình chû nhât", "bôn góc vuông", 2*(rint(5,20)+rint(3,15)))
            ]
            shape, feature, perimeter = random.choice(shapes)
            templates = [
                {"q": f"Dâu là dâu biêu cua {shape}?", "a": feature, "hint": f"{shape} có dâu biêu: {feature}"},
                {"q": f"Chu vi {shape} là bao nhiêu?", "a": perimeter, "hint": f"Chu vi = {perimeter}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 73:  # Ôn tap chung
            operations = [
                lambda: (f"{rint(100000, 500000)} + {rint(50000, 200000)} = ?", str(rint(150000, 700000)), "arithmetic"),
                lambda: (f"{rint(1,10)}/{rint(2,11)} + {rint(1,10)}/{rint(2,11)} = ?", f"{rint(1,10)+rint(1,10)}/{rint(2,11)}", "arithmetic"),
                lambda: ("Hai duong thang song song có cat nhau không?", "Không", "geo"),
                lambda: (f"{rint(1,5)} tân = ? kg", str(rint(1,5) * 10000), "measure")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap cuôi nâm lôp 4"
        
        # Mâc dînh cho các bài không xâc dînh
        else:
            a = rint(1000, 10000); b = rint(1000, 10000)
            ans = a + b
            return f"Tính: {a} + {b} = ?", str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Bài tap luyên"

    # --- LOPS 5 LOGIC - THEO SGK KNTT (75 bài) ---
    @staticmethod
    def grade_5_logic(lid, difficulty=None):
        names = ["An", "Bình", "Chi", "Dung", "Em", "Giang", "Hà", "Hùng", "Lan", "Mai", "Nam", "Quân", "Tú", "Vy"]
        objs = ["quyern sách", "cái bút", "viên bi", "cái kexy", "bông hoa", "quà táo", "chiéc xe", "quà bóng"]
        mult = SmartAI._difficulty_multiplier(difficulty)
        
        def rint(a, b):
            return random.randint(a, max(a, int(b * mult)))
        
        # TAP 1: Bài 1-35
        if lid == 1:  # Ôn tap sô tu nhiên
            val = rint(100000, 999999)
            templates = [
                {"q": f"Doc sô {val}", "a": f"{val//100000} tram nghìn {val%100000//10000} chuc nghìn {val%10000//1000} nghìn {val%1000//100} tram {val%100//10} chuc {val%10}", "hint": "Phân tích sô theo hàng"},
                {"q": f"Sô {val} có bao nhiêu chuc nghìn?", "a": val//10000 % 10, "hint": "Chuc nghìn là hàng thû 2 tính tu phai"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 2:  # Ôn tap các phép tính vôi sô tu nhiên
            a = rint(100000, 500000); b = rint(50000, 200000)
            if random.random() > 0.5:
                ans = a + b
                q = f"Tính: {a} + {b} = ?"
            else:
                ans = a - b if a > b else b - a
                q = f"Tính: {max(a, b)} - {min(a, b)} = ?"
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Công/trù theo hàng"
        
        elif lid == 3:  # Ôn tap phân sô
            a = rint(2, 10); b = rint(3, 11); c = rint(2, 10); d = rint(3, 11)
            if random.random() > 0.5:
                if b == d:
                    ans = f"{a+c}/{b}"
                    q = f"Tính: {a}/{b} + {c}/{d} = ?"
                else:
                    ans = f"{a*d+c*b}/{b*d}"
                    q = f"Tính: {a}/{b} + {c}/{d} = ?"
            else:
                if b == d:
                    ans = f"{a-c}/{b}"
                    q = f"Tính: {a}/{b} - {c}/{d} = ?"
                else:
                    ans = f"{a*d-c*b}/{b*d}"
                    q = f"Tính: {a}/{b} - {c}/{d} = ?"
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Phép tính phân sô"
        
        elif lid == 4:  # Phân sô thâp phân
            a = rint(1, 9); b = rint(1, 9)
            templates = [
                {"q": f"Viêt phân sô {a}/{b*10} duoi dang sô thâp phân", "a": f"0,{a}", "hint": f"{a}/{b*10} = {a/b} × 1/10 = 0,{a}"},
                {"q": f"Sô thâp phân 0,{a} viêt duoi dang phân sô", "a": f"{a}/{10}", "hint": f"0,{a} = {a}/10"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 5:  # Ôn tap các phép tính vôi phân sô
            a1 = rint(1, 10); b1 = rint(2, 11); a2 = rint(1, 10); b2 = rint(2, 11)
            ops = [
                (f"{a1}/{b1} + {a2}/{b2}", "công"),
                (f"{a1}/{b1} - {a2}/{b2}", "trù"),
                (f"{a1}/{b1} × {a2}/{b2}", "nhân"),
                (f"{a1}/{b1} ÷ {a2}/{b2}", "chia")
            ]
            expr, op_name = random.choice(ops)
            if op_name == "công":
                if b1 == b2:
                    ans = f"{a1+a2}/{b1}"
                else:
                    ans = f"{a1*b2+a2*b1}/{b1*b2}"
            elif op_name == "trù":
                if b1 == b2:
                    ans = f"{a1-a2}/{b1}"
                else:
                    ans = f"{a1*b2-a2*b1}/{b1*b2}"
            elif op_name == "nhân":
                ans = f"{a1*a2}/{b1*b2}"
            else:
                ans = f"{a1*b2}/{b1*a2}"
            return f"Tính: {expr} = ?", ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", f"Phép {op_name} phân sô"
        
        elif lid == 6:  # Công, trù hai phân sô khác mâu sô
            a1 = rint(1, 10); b1 = rint(3, 11); a2 = rint(1, 10); b2 = rint(3, 11)
            if random.random() > 0.5:
                lcm = b1 * b2
                ans_num = a1 * b2 + a2 * b1
                ans = f"{ans_num}/{lcm}"
                q = f"Tính: {a1}/{b1} + {a2}/{b2} = ?"
                hint = f"Quy dông mâu: {a1*b2}/{lcm} + {a2*b1}/{lcm} = {ans_num}/{lcm}"
            else:
                lcm = b1 * b2
                ans_num = a1 * b2 - a2 * b1
                ans = f"{ans_num}/{lcm}"
                q = f"Tính: {a1}/{b1} - {a2}/{b2} = ?"
                hint = f"Quy dông mâu: {a1*b2}/{lcm} - {a2*b1}/{lcm} = {ans_num}/{lcm}"
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), "arithmetic", hint
        
        elif lid == 7:  # Hôn sô
            a = rint(1, 9); b = rint(1, 9)
            templates = [
                {"q": f"Viêt hôn sô {a} và {b}", "a": f"{a} và {b}/{10}", "hint": f"{a} và {b}/{10} = {a} + {b}/{10}"},
                {"q": f"Hôn sô {a} và {b}/{10} viêt duoi dang phân sô", "a": f"{a*10+b}/{10}", "hint": f"{a} và {b}/{10} = ({a}×10+{b})/10 = {a*10+b}/{10}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 8:  # Ôn tap hình hoc và dô luong
            shapes = [
                ("Hình vuông", "côt bâng nhau", 4*rint(5,20)),
                ("Hình chû nhât", "hai côt dôi diên song song", 2*(rint(5,20)+rint(3,15))),
                ("Hình tam giác", "ba côt", (rint(5,20)*rint(3,15))//2)
            ]
            shape, feature, perimeter = random.choice(shapes)
            templates = [
                {"q": f"Dâu là dâu biêu cua {shape}?", "a": feature, "hint": f"{shape} có dâu biêu: {feature}"},
                {"q": f"Chu vi {shape} là bao nhiêu?", "a": perimeter, "hint": f"Chu vi = {perimeter}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 9:  # Luyên tap chung
            operations = [
                lambda: (f"{rint(100000, 500000)} + {rint(50000, 200000)} = ?", str(rint(150000, 700000)), "arithmetic"),
                lambda: (f"Rút gôn {rint(4,20)*rint(2,5)}/{rint(4,20)*rint(2,5)}", f"{rint(4,20)}/{rint(4,20)}", "arithmetic"),
                lambda: (f"Viêt 3 và 7/10 duoi dang phân sô", "37/10", "arithmetic"),
                lambda: ("Chu vi hình vuông côt 5cm là bao nhiêu?", "20", "geo")
            ]
            op = random.choice(operations)
            result = op()  # Call the lambda function to get the tuple
            return result[0], result[1], SmartAI._generate_distractors(result[1], "numeric"), result[2], "Luyên tap chung"
        
        elif lid == 10:  # Khái niêm sô thâp phân
            a = rint(1, 9); b = rint(1, 9)
            templates = [
                {"q": f"Sô thâp phân 0,{a} có thê viêt duoi dang phân sô nào?", "a": f"{a}/{10}", "hint": f"0,{a} = {a}/10"},
                {"q": f"Phân sô {a}/{10} duoi dang sô thâp phân là gì?", "a": f"0,{a}", "hint": f"{a}/{10} = 0,{a}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 11:  # Hàng cua sô thâp phân. Doc, viêt sô thâp phân
            val = rint(1, 9); decimal = rint(1, 9)
            templates = [
                {"q": f"Sô thâp phân {val}.{decimal} có phan nguyên và phan thâp phân là bao nhiêu?", "a": f"{val} và {decimal}", "hint": f"Phan nguyên = {val}, Phan thâp phân = {decimal}"},
                {"q": f"Viêt sô có phan nguyên {val} và phan thâp phân {decimal} duoi dang sô thâp phân", "a": f"{val}.{decimal}", "hint": f"{val}.{decimal} = {val} và {decimal}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 12:  # Viêt sô dô dâi luong duoi dang sô thâp phân
            conversions = [
                (f"{rint(1, 9)}m {rint(1, 9)}dm", f"{rint(1, 9)}.{rint(1, 9)}m"),
                (f"{rint(1, 9)}kg {rint(1, 9)}hg", f"{rint(1, 9)}.{rint(1, 9)}kg"),
                (f"{rint(1, 9)}l {rint(1, 9)}dl", f"{rint(1, 9)}.{rint(1, 9)}l")
            ]
            q, ans = random.choice(conversions)
            return f"Viêt {q} duoi dang sô thâp phân", ans, SmartAI._generate_distractors(ans, "numeric"), "measure", "Chuyên dôi dôn vi"
        
        elif lid == 13:  # Làm tròn sô thâp phân
            val = rint(100, 999) / 100  # Tao sô thâp phân có 2 chû sô
            targets = ["dôn vi", "phan muroi"]
            target = random.choice(targets)
            if target == "dôn vi":
                rounded = round(val, 0)
            else:
                rounded = round(val, 1)
            templates = [
                {"q": f"Làm tròn sô {val} dên hàng {target}", "a": rounded, "hint": f"Giû lai hàng {target} và làm tròn"},
                {"q": f"Sô {val} làm tròn dên hàng {target} bâng bao nhiêu?", "a": rounded, "hint": f"Làm tròn dên hàng {target}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        elif lid == 14:  # So sánh hai sô thâp phân
            a = rint(1, 9); b = rint(1, 9); c = rint(1, 9); d = rint(1, 9)
            val1 = a + b/10; val2 = c + d/10
            comp = ">" if val1 > val2 else "<" if val1 < val2 else "="
            templates = [
                {"q": f"So sánh: {a}.{b} ... {c}.{d}", "a": comp, "hint": f"So sánh phan nguyên truôc, rôngi phan thâp phân"},
                {"q": f"Sô nào lon hôn: {a}.{b} hay {c}.{d}?", "a": f"{a}.{b}" if val1 > val2 else f"{c}.{d}", "hint": "So sánh tûng hàng"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "compare"), "arithmetic", t.get("hint", "")
        
        elif lid == 15:  # Luyên tap chung
            operations = [
                lambda: (f"Làm tròn {rint(1,9)}.{rint(1,9)} dên hàng dôn vi", str(round(rint(1,9) + rint(1,9)/10, 0)), "logic"),
                lambda: (f"So sánh {rint(1,9)}.{rint(1,9)} ... {rint(1,9)}.{rint(1,9)}", ">" if rint(1,9) + rint(1,9)/10 > rint(1,9) + rint(1,9)/10 else "<", "arithmetic"),
                lambda: (f"Viêt 2 và 3/10 duoi dang sô thâp phân", "2.3", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap sô thâp phân"
        
        elif lid == 16:  # Phép công sô thâp phân
            a = rint(1, 9); b = rint(1, 9); c = rint(1, 9); d = rint(1, 9)
            val1 = a + b/10; val2 = c + d/10
            ans = round(val1 + val2, 2)
            templates = [
                {"q": f"Tính: {a}.{b} + {c}.{d} = ?", "a": ans, "hint": f"Công phan nguyên vôi phan nguyên, phan thâp phân vôi phan thâp phân"},
                {"q": f"{random.choice(names)} có {a}.{b}kg cam, {c}.{d}kg táo. Tong là bao nhiêu kg?", "a": ans, "hint": f"Tông = {a}.{b} + {c}.{d} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 17:  # Phép trù sô thâp phân
            a = rint(5, 9); b = rint(1, 9); c = rint(1, 9); d = rint(1, 9)
            val1 = a + b/10; val2 = c + d/10
            ans = round(val1 - val2, 2)
            templates = [
                {"q": f"Tính: {a}.{b} - {c}.{d} = ?", "a": ans, "hint": f"Trù phan nguyên vôi phan nguyên, phan thâp phân vôi phan thâp phân"},
                {"q": f"{random.choice(names)} có {a}.{b}kg gao, tiêu dî {c}.{d}kg. Còn lai bao nhiêu?", "a": ans, "hint": f"Còn lai = {a}.{b} - {c}.{d} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 18:  # Luyên tap chung
            a = rint(1, 9); b = rint(1, 9); c = rint(1, 9); d = rint(1, 9)
            operations = [
                (f"Tính: {a}.{b} + {c}.{d} = ?", str(round(a + b/10 + c + d/10, 2))),
                (f"Tính: {a}.{b} - {c}.{d} = ?", str(round(a + b/10 - (c + d/10), 2)))
            ]
            q, ans = random.choice(operations)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Công/trù sô thâp phân"
        
        elif lid == 19:  # Nhân môt sô thâp phân vôi môt sô tu nhiên
            a = rint(1, 9); b = rint(1, 9); c = rint(2, 9)
            val = a + b/10
            ans = round(val * c, 2)
            templates = [
                {"q": f"Tính: {a}.{b} × {c} = ?", "a": ans, "hint": f"Nhân {a}.{b} vôi {c} = {val} × {c} = {ans}"},
                {"q": f"{random.choice(names)} mua {c} cái bánh, mõi cái giá {a}.{b} ngàn dông. Tong bao nhiêu?", "a": ans, "hint": f"Tông = {a}.{b} × {c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 20:  # Nhân môt sô thâp phân vôi 10, 100, 1000...
            a = rint(1, 9); b = rint(1, 9); multipliers = [10, 100, 1000]
            c = random.choice(multipliers)
            val = a + b/10
            ans = round(val * c, 2)
            templates = [
                {"q": f"Tính: {a}.{b} × {c} = ?", "a": ans, "hint": f"Nhân vôi {c} là di chuyên dâu phây sang phai {len(str(c))} chû sô"},
                {"q": f"{a}.{b} nhân vôi {c} bâng bao nhiêu?", "a": ans, "hint": f"{a}.{b} × {c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 21:  # Nhân hai sô thâp phân
            a = rint(1, 9); b = rint(1, 9); c = rint(1, 9); d = rint(1, 9)
            val1 = a + b/10; val2 = c + d/10
            ans = round(val1 * val2, 2)
            templates = [
                {"q": f"Tính: {a}.{b} × {c}.{d} = ?", "a": ans, "hint": f"Nhân hai sô thâp phân, rôngi làm tròn kêt quâ"},
                {"q": f"Môt cái vât dài {a}.{b}m, rông {c}.{d}m. Diên tích là bao nhiêu m²?", "a": ans, "hint": f"S = dài × rông = {a}.{b} × {c}.{d} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 22:  # Luyên tap chung
            operations = [
                lambda: (f"{rint(1,9)}.{rint(1,9)} × {rint(2,9)} = ?", str(round(rint(1,9) + rint(1,9)/10, 2) * rint(2,9)), "arithmetic"),
                lambda: (f"{rint(1,9)}.{rint(1,9)} × {rint(10,100)} = ?", str(round(rint(1,9) + rint(1,9)/10, 2) * rint(10,100)), "arithmetic"),
                lambda: (f"{rint(1,9)}.{rint(1,9)} × {rint(1,9)}.{rint(1,9)} = ?", str(round((rint(1,9) + rint(1,9)/10) * (rint(1,9) + rint(1,9)/10), 2)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap nhân sô thâp phân"
        
        elif lid == 23:  # Chia môt sô thâp phân cho môt sô tu nhiên
            a = rint(2, 9); b = rint(1, 9); c = rint(2, 9)
            val = a + b/10
            ans = round(val / c, 2)
            templates = [
                {"q": f"Tính: {a}.{b} ÷ {c} = ?", "a": ans, "hint": f"Chia {a}.{b} cho {c} = {val} ÷ {c} = {ans}"},
                {"q": f"{a}.{b}kg gao chia dêu cho {c} nguôi. Môi nguôi dâu bao nhiêu kg?", "a": ans, "hint": f"Môi nguôi dâu {a}.{b} ÷ {c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 24:  # Chia môt sô tu nhiên cho môt sô tu nhiên mà thuong là sô thâp phân
            a = rint(10, 99); b = rint(2, 9)
            ans = round(a / b, 2)
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans, "hint": f"{a} ÷ {b} = {ans}"},
                {"q": f"{a} cái bút chia dêu cho {b} hoc sinh. Môi hoc sinh dâu bao nhiêu cái?", "a": ans, "hint": f"Môi hoc sinh dâu {a} ÷ {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 25:  # Chia môt sô tu nhiên cho môt sô thâp phân
            a = rint(10, 99); b = rint(1, 9); c = rint(1, 9)
            divisor = b + c/10
            ans = round(a / divisor, 2)
            templates = [
                {"q": f"Tính: {a} ÷ {b}.{c} = ?", "a": ans, "hint": f"{a} ÷ {b}.{c} = {a} ÷ {divisor} = {ans}"},
                {"q": f"{a} cái bánh chia dêu cho các nhóm {b}.{c} cái. Môi nhóm dâu bao nhiêu?", "a": ans, "hint": f"Môi nhóm dâu {a} ÷ {b}.{c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 26:  # Chia hai sô thâp phân
            a = rint(2, 9); b = rint(1, 9); c = rint(1, 9); d = rint(1, 9)
            val1 = a + b/10; val2 = c + d/10
            ans = round(val1 / val2, 2)
            templates = [
                {"q": f"Tính: {a}.{b} ÷ {c}.{d} = ?", "a": ans, "hint": f"Chia hai sô thâp phân, rôngi làm tròn kêt quâ"},
                {"q": f"{a}.{b}m dây chia cho {c}.{d}m dây. Duoc bao nhiêu mân dây?", "a": ans, "hint": f"Sô mân = {a}.{b} ÷ {c}.{d} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 27:  # Luyên tap chung
            operations = [
                lambda: (f"{rint(2,9)}.{rint(1,9)} ÷ {rint(2,9)} = ?", str(round((rint(2,9) + rint(1,9)/10) / rint(2,9), 2)), "arithmetic"),
                lambda: (f"{rint(10,99)} ÷ {rint(2,9)}.{rint(1,9)} = ?", str(round(rint(10,99) / (rint(2,9) + rint(1,9)/10), 2)), "arithmetic"),
                lambda: (f"{rint(2,9)}.{rint(1,9)} ÷ {rint(2,9)}.{rint(1,9)} = ?", str(round((rint(2,9) + rint(1,9)/10) / (rint(2,9) + rint(1,9)/10), 2)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap chia sô thâp phân"
        
        elif lid == 28:  # Thang nhiêt dô Xen-xi-út. Thang nhiêt dô Farenhai
            temps = [
                (f"{rint(0, 100)}°C = ?°F", lambda c: round(c * 9/5 + 32, 1)),
                (f"{rint(32, 212)}°F = ?°C", lambda f: round((f - 32) * 5/9, 1))
            ]
            q, calc = random.choice(temps)
            ans = calc(int(q.split()[0]))
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure", "Chuyên dôi nhiêt dô"
        
        elif lid == 29:  # Tî sô phan trâm
            a = rint(1, 100)
            templates = [
                {"q": f"Viêt {a}% duoi dang phân sô", "a": f"{a}/100", "hint": f"{a}% = {a}/100"},
                {"q": f"{a}/100 duoi dang tî sô phan trâm là gì?", "a": f"{a}%", "hint": f"{a}/100 = {a}%"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 30:  # Giai toán vê tî sô phan trâm
            total = rint(100, 1000); percent = rint(5, 50)
            value = (total * percent) // 100
            templates = [
                {"q": f"Tìm {percent}% cua {total}", "a": value, "hint": f"{percent}% cua {total} = {total} × {percent}/100 = {value}"},
                {"q": f"{random.choice(names)} có {total} cái bút, lây dî {percent}%. Còn lai bao nhiêu?", "a": total - value, "hint": f"Còn lai = {total} - {value} = {total - value}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 31:  # Giai toán vê tî sô phan trâm (tiêp theo)
            a = rint(50, 500); b = rint(20, 200)
            percent = round((a / b) * 100, 1)
            templates = [
                {"q": f"{a} là bao nhiêu phan trâm cua {b}?", "a": f"{percent}%", "hint": f"{a}/{b} × 100% = {percent}%"},
                {"q": f"{random.choice(names)} dâu {a} diêm trong tông sô {b} diêm. Tî sô phan trâm là bao nhiêu?", "a": f"{percent}%", "hint": f"Tî sô = ({a}/{b}) × 100% = {percent}%"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 32:  # Luyên tap chung
            scenarios = [
                (f"Tìm {rint(5, 50)}% cua {rint(100, 1000)}", str((rint(100, 1000) * rint(5, 50)) // 100)),
                (f"{rint(50, 500)} là bao nhiêu phan trâm cua {rint(200, 1000)}?", f"{round((rint(50, 500) / rint(200, 1000)) * 100, 1)}%"),
                (f"Viêt {rint(1, 100)}% duoi dang phân sô", f"{rint(1, 100)}/100")
            ]
            q, ans = random.choice(scenarios)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Luyên tap tî sô phan trâm"
        
        elif lid == 33:  # Ôn tap hoc ky 1
            operations = [
                lambda: (f"{rint(100000, 500000)} + {rint(50000, 200000)} = ?", str(rint(150000, 700000)), "arithmetic"),
                lambda: (f"{rint(2,9)}.{rint(1,9)} + {rint(2,9)}.{rint(1,9)} = ?", str(round(rint(2,9) + rint(1,9)/10 + rint(2,9) + rint(1,9)/10, 2)), "arithmetic"),
                lambda: (f"{rint(2,9)}.{rint(1,9)} × {rint(2,9)} = ?", str(round((rint(2,9) + rint(1,9)/10) * rint(2,9), 2)), "arithmetic"),
                lambda: (f"Tìm {rint(5, 50)}% cua {rint(100, 1000)}", str((rint(100, 1000) * rint(5, 50)) // 100), "arithmetic"),
                lambda: ("Chu vi hình vuông côt 6cm là bao nhiêu?", "24", "geo")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap HK1"
        
        elif lid == 34:  # Ôn tap hình hoc và dô luong hoc ky 1
            shapes = [
                ("Hình tam giác", "ba côt", (rint(5,20)*rint(3,15))//2),
                ("Hình chû nhât", "bôn góc vuông", 2*(rint(5,20)+rint(3,15)))
            ]
            shape, feature, area = random.choice(shapes)
            templates = [
                {"q": f"Diên tích {shape} có côt {rint(5,20)}m và {rint(3,15)}m là bao nhiêu?", "a": area, "hint": f"S = {area} m²"},
                {"q": f"Dâu là dâu biêu cua {shape}?", "a": feature, "hint": f"{shape} có {feature}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 35:  # Ôn tap chung
            operations = [
                lambda: (f"{rint(100000, 500000)} - {rint(50000, 200000)} = ?", str(rint(150000, 550000)), "arithmetic"),
                lambda: (f"{rint(2,9)}.{rint(1,9)} × {rint(2,9)}.{rint(1,9)} = ?", str(round((rint(2,9) + rint(1,9)/10) * (rint(2,9) + rint(1,9)/10), 2)), "arithmetic"),
                lambda: (f"{rint(50, 500)} là bao nhiêu phan trâm cua {rint(200, 1000)}?", f"{round((rint(50, 500) / rint(200, 1000)) * 100, 1)}%", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap chung HK1"
        
        # TAP 2: Bài 36-75
        elif lid == 36:  # Hình tam giác. Diên tích hình tam giác
            base = rint(5, 20); height = rint(3, 15)
            area = (base * height) // 2
            templates = [
                {"q": f"Hình tam giác có côt dôi diên dài {base}m và duong cao {height}m. Diên tích là bao nhiêu m²?", "a": area, "hint": f"S = (côt dôi diên × duong cao) ÷ 2 = ({base} × {height}) ÷ 2 = {area}"},
                {"q": f"Công thûc diên tích hình tam giác là gì?", "a": "S = (dài × cao) ÷ 2", "hint": "Diên tích hình tam giác = nua tích côt dôi diên và duong cao"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 37:  # Hình thang. Diên tích hình thang
            base1 = rint(5, 20); base2 = rint(3, 15); height = rint(4, 12)
            area = (base1 + base2) * height // 2
            templates = [
                {"q": f"Hình thang có côt dôi diên dài {base1}m, côt ngan {base2}m và cao {height}m. Diên tích là bao nhiêu m²?", "a": area, "hint": f"S = (côt dài + côt ngan) × cao ÷ 2 = ({base1} + {base2}) × {height} ÷ 2 = {area}"},
                {"q": f"Công thûc diên tích hình thang là gì?", "a": "S = (a + b) × h ÷ 2", "hint": "Diên tích hình thang = trung binh công hai côt nhân vôi cao"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 38:  # Hình tròn. Chu vi và diên tích hình tròn
            radius = rint(2, 10)
            circumference = round(2 * 3.14 * radius, 2)
            area = round(3.14 * radius * radius, 2)
            templates = [
                {"q": f"Hình tròn có bán kính {radius}cm. Chu vi là bao nhiêu cm?", "a": circumference, "hint": f"C = 2 × 3,14 × {radius} = {circumference}"},
                {"q": f"Hình tròn có bán kính {radius}cm. Diên tích là bao nhiêu cm²?", "a": area, "hint": f"S = 3,14 × {radius}² = {area}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 39:  # Luyên tap chung
            operations = [
                lambda: (f"Hình tam giác côt dôi diên {rint(5,20)}m, cao {rint(3,15)}m. Diên tích?", str((rint(5,20)*rint(3,15))//2), "geo"),
                lambda: (f"Hình thang côt dài {rint(5,20)}m, côt ngan {rint(3,15)}m, cao {rint(4,12)}m. Diên tích?", str((rint(5,20)+rint(3,15))*rint(4,12)//2), "geo"),
                lambda: (f"Hình tròn bán kính {rint(2,10)}cm. Diên tích?", str(round(3.14 * rint(2,10) * rint(2,10), 2)), "geo")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap diên tích"
        
        elif lid == 40:  # Hinh hôp chû nhât. Hinh lap phuong
            length = rint(3, 10); width = rint(2, 8); height = rint(2, 8)
            templates = [
                {"q": f"Hinh hôp chû nhât có các kích thuôc {length}cm × {width}cm × {height}cm. Có bao nhiêu dînh?", "a": 8, "hint": "Hinh hôp chû nhât có 8 dînh"},
                {"q": f"Hinh lap phuong có các côt {length}cm. Có bao nhiêu dînh?", "a": 8, "hint": "Hinh lap phuong có 8 dînh"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 41:  # Diên tích xung quanh và diên tích toàn phan hình hôp chû nhât
            length = rint(3, 10); width = rint(2, 8); height = rint(2, 8)
            surface_area = 2 * (length * width + length * height + width * height)
            lateral_area = 2 * height * (length + width)
            templates = [
                {"q": f"Hinh hôp chû nhât {length}×{width}×{height} (cm). Diên tích toàn phan là bao nhiêu cm²?", "a": surface_area, "hint": f"Stp = 2(ab + ah + bh) = {surface_area}"},
                {"q": f"Hinh hôp chû nhât {length}×{width}×{height} (cm). Diên tích xung quanh là bao nhiêu cm²?", "a": lateral_area, "hint": f"Sxq = 2h(a + b) = {lateral_area}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 42:  # Diên tích xung quanh và diên tích toàn phan hình lap phuong
            edge = rint(3, 10)
            surface_area = 6 * edge * edge
            lateral_area = 4 * edge * edge
            templates = [
                {"q": f"Hinh lap phuong côt {edge}cm. Diên tích toàn phan là bao nhiêu cm²?", "a": surface_area, "hint": f"Stp = 6a² = 6 × {edge}² = {surface_area}"},
                {"q": f"Hinh lap phuong côt {edge}cm. Diên tích xung quanh là bao nhiêu cm²?", "a": lateral_area, "hint": f"Sxq = 4a² = 4 × {edge}² = {lateral_area}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 43:  # Luyên tap chung
            operations = [
                lambda: (f"Hinh hôp chû nhât {rint(3,10)}×{rint(2,8)}×{rint(2,8)} (cm). Stp?", str(2 * (rint(3,10)*rint(2,8) + rint(3,10)*rint(2,8) + rint(2,8)*rint(2,8))), "geo"),
                lambda: (f"Hinh lap phuong côt {rint(3,10)}cm. Sxq?", str(4 * rint(3,10) * rint(3,10)), "geo")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap diên tích hình khôi"
        
        elif lid == 44:  # Hinh trû. Hinh câù
            templates = [
                {"q": "Hinh trû có bao nhiêu mât?", "a": "3", "hint": "Hinh trû có 2 mât dôi diên hình tròn và 1 mât cong"},
                {"q": "Hinh câù có bao nhiêu mât?", "a": "1", "hint": "Hinh câù có mât cong duy nhât"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 45:  # Thê tích cua môt hình
            templates = [
                {"q": "Thê tích là gì?", "a": "Không gian mà hình chiêm chiu", "hint": "Thê tích là phan không gian ba chiêu mà hình chiêm"},
                {"q": "Dôn vi dô thê tích co ban là gì?", "a": "cm³", "hint": "Xang-ti-mét khôi là dôn vi co ban cua thê tích"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 46:  # Xang-ti-mét khôi. Dê-xi-mét khôi
            conversions = [
                ("dm³", "cm³", 1000),
                ("cm³", "dm³", 1/1000)
            ]
            unit1, unit2, factor = random.choice(conversions)
            val = rint(1, 10)
            result = val * factor
            templates = [
                {"q": f"{val} {unit1} = ? {unit2}", "a": result, "hint": f"1 {unit1} = {factor} {unit2}"},
                {"q": f"{val} {unit2} = ? {unit1}", "a": val / factor, "hint": f"1 {unit2} = {1/factor} {unit1}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        elif lid == 47:  # Mét khôi
            conversions = [
                ("m³", "dm³", 1000),
                ("dm³", "m³", 1/1000),
                ("m³", "cm³", 1000000),
                ("cm³", "m³", 1/1000000)
            ]
            unit1, unit2, factor = random.choice(conversions)
            val = rint(1, 10)
            result = val * factor
            templates = [
                {"q": f"{val} {unit1} = ? {unit2}", "a": result, "hint": f"1 {unit1} = {factor} {unit2}"},
                {"q": f"{val} {unit2} = ? {unit1}", "a": val / factor, "hint": f"1 {unit2} = {1/factor} {unit1}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        elif lid == 48:  # Luyên tap chung
            operations = [
                (f"{rint(1,10)} dm³ = ? cm³", str(rint(1,10) * 1000)),
                (f"{rint(1000,5000)} cm³ = ? dm³", str(rint(1000,5000) // 1000)),
                (f"{rint(1,5)} m³ = ? dm³", str(rint(1,5) * 1000)),
                (f"{rint(1000,5000)} dm³ = ? m³", str(rint(1000,5000) // 1000))
            ]
            q, ans = random.choice(operations)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure", "Chuyên dôi thê tích"
        
        elif lid == 49:  # Thê tích hình hôp chû nhât
            length = rint(2, 10); width = rint(2, 8); height = rint(2, 8)
            volume = length * width * height
            templates = [
                {"q": f"Hinh hôp chû nhât {length}cm × {width}cm × {height}cm. Thê tích là bao nhiêu cm³?", "a": volume, "hint": f"V = dài × rông × cao = {length} × {width} × {height} = {volume}"},
                {"q": f"Môt hôp chû nhât có kích thuôc {length}×{width}×{height} (cm). Thê tích?", "a": volume, "hint": f"V = {length} × {width} × {height} = {volume}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 50:  # Thê tích hình lap phuong
            edge = rint(2, 10)
            volume = edge * edge * edge
            templates = [
                {"q": f"Hinh lap phuong côt {edge}cm. Thê tích là bao nhiêu cm³?", "a": volume, "hint": f"V = a³ = {edge}³ = {volume}"},
                {"q": f"Môt khôi lap phuong côt {edge}cm. Thê tích?", "a": volume, "hint": f"V = {edge} × {edge} × {edge} = {volume}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 51:  # Luyên tap chung
            operations = [
                lambda: (f"Hinh hôp chû nhât {rint(2,10)}×{rint(2,8)}×{rint(2,8)} (cm). V?", str(rint(2,10)*rint(2,8)*rint(2,8)), "geo"),
                lambda: (f"Hinh lap phuong côt {rint(2,10)}cm. V?", str(rint(2,10)*rint(2,10)*rint(2,10)), "geo")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap thê tích"
        
        elif lid == 52:  # Thûc hành và trai nghiêm vê dô luong
            scenarios = [
                (f"Dô thê tích môt hôp chû nhât kích thuôc {rint(2,5)}×{rint(2,4)}×{rint(2,4)} (dm)", "dm³", "V = dài × rông × cao"),
                (f"Dô diên tích môt cái bàn kích thuôc {rint(5,15)}×{rint(3,10)} (cm)", "cm²", "S = dài × rông"),
                (f"Dô chu vi môt sân hình vuông côt {rint(10,30)} (m)", "m", "P = 4 × côt")
            ]
            q, unit, hint = random.choice(scenarios)
            return q, "Sû dung thûc", SmartAI._generate_distractors("Sû dung thûc", "numeric"), "measure", hint
        
        elif lid == 53:  # Bâng dôn vi dô thôi gian
            conversions = [
                ("nâm", "tháng", 12),
                ("tháng", "ngày", 30),
                ("tuân", "ngày", 7),
                ("ngày", "giô", 24),
                ("giô", "phút", 60),
                ("phút", "giây", 60),
                ("thê ky", "nâm", 100)
            ]
            unit1, unit2, factor = random.choice(conversions)
            val = rint(2, 10)
            result = val * factor
            templates = [
                {"q": f"{val} {unit1} = ? {unit2}", "a": result, "hint": f"1 {unit1} = {factor} {unit2}"},
                {"q": f"{result} {unit2} = ? {unit1}", "a": val, "hint": f"{result} {unit2} = {result//factor} {unit1}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        elif lid == 54:  # Công, trù sô dô thôi gian
            h1 = rint(1, 12); m1 = rint(0, 59); s1 = rint(0, 59)
            h2 = rint(1, 12); m2 = rint(0, 59); s2 = rint(0, 59)
            total1 = h1 * 3600 + m1 * 60 + s1
            total2 = h2 * 3600 + m2 * 60 + s2
            if random.random() > 0.5:
                ans = total1 + total2
                q = f"{h1}giô {m1}phút {s1}giây + {h2}giô {m2}phút {s2}giây = ?"
            else:
                ans = abs(total1 - total2)
                q = f"{max(h1,h2)}giô {max(m1,m2)}phút {max(s1,s2)}giây - {min(h1,h2)}giô {min(m1,m2)}phút {min(s1,s2)}giây = ?"
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure", "Công/trù thôi gian"
        
        elif lid == 55:  # Nhân, chia sô dô thôi gian vôi môt sô
            h = rint(1, 5); m = rint(10, 50); s = rint(10, 50)
            multiplier = rint(2, 5)
            total = h * 3600 + m * 60 + s
            result = total * multiplier
            templates = [
                {"q": f"{h}giô {m}phút {s}giây nhân {multiplier} = ?", "a": result, "hint": f"Chuyên dôi sang giây rôngi nhân: {total} × {multiplier} = {result}"},
                {"q": f"{h}giô {m}phút {s}giây chia cho {multiplier} = ?", "a": total // multiplier, "hint": f"Chuyên dôi sang giây rôngi chia: {total} ÷ {multiplier} = {total // multiplier}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        elif lid == 56:  # Luyên tap chung
            operations = [
                lambda: (f"{rint(1,5)} nâm = ? tháng", str(rint(1,5) * 12), "measure"),
                lambda: (f"{rint(2,10)} tuân = ? ngày", str(rint(2,10) * 7), "measure"),
                lambda: (f"{rint(1,6)}giô {rint(10,30)}phút = ? phút", str(rint(1,6) * 60 + rint(10,30)), "measure")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap thôi gian"
        
        elif lid == 57:  # Vân tôc
            distance = rint(100, 500); time = rint(2, 8)
            speed = distance / time
            templates = [
                {"q": f"Môt xe di chuyen {distance}km trong {time}giô. Vân tôc trung binh là bao nhiêu km/h?", "a": speed, "hint": f"v = s/t = {distance}/{time} = {speed}"},
                {"q": f"Vân tôc = quãng dông ÷ thôi gian. Công thûc là gì?", "a": "v = s ÷ t", "hint": "Vân tôc = quãng dông chia cho thôi gian"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 58:  # Quãng dông
            speed = rint(30, 80); time = rint(2, 6)
            distance = speed * time
            templates = [
                {"q": f"Môt xe di chuyen vôi vân tôc {speed}km/h trong {time}giô. Quãng dông di duoc là bao nhiêu km?", "a": distance, "hint": f"s = v × t = {speed} × {time} = {distance}"},
                {"q": f"Quãng dông = vân tôc × thôi gian. Công thûc là gì?", "a": "s = v × t", "hint": "Quãng dông = vân tôc nhân vôi thôi gian"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 59:  # Thôi gian
            distance = rint(100, 500); speed = rint(30, 80)
            time = distance / speed
            templates = [
                {"q": f"Môt xe di chuyen {distance}km vôi vân tôc {speed}km/h. Thôi gian di chuyen là bao nhiêu giô?", "a": time, "hint": f"t = s/v = {distance}/{speed} = {time}"},
                {"q": f"Thôi gian = quãng dông ÷ vân tôc. Công thûc là gì?", "a": "t = s ÷ v", "hint": "Thôi gian = quãng dông chia cho vân tôc"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 60:  # Luyên tap chung
            scenarios = [
                (f"Môt xe di chuyen {rint(100,500)}km trong {rint(2,6)}giô. Vân tôc?", str(rint(100,500)//rint(2,6))),
                (f"Môt xe di chuyen vôi vân tôc {rint(30,80)}km/h trong {rint(2,6)}giô. Quãng dông?", str(rint(30,80)*rint(2,6))),
                (f"Môt xe di chuyen {rint(100,500)}km vôi vân tôc {rint(30,80)}km/h. Thôi gian?", str(rint(100,500)//rint(30,80)))
            ]
            q, ans = random.choice(scenarios)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Luyên tap vân tôc"
        
        elif lid == 61:  # Chuyên dông nguôc chiêu và cùng chiêu
            speed1 = rint(30, 60); speed2 = rint(30, 60)
            distance = rint(100, 500)
            time = distance / (speed1 + speed2)
            templates = [
                {"q": f"Hai xe xuông phôi nhau, xe 1 vôi vân tôc {speed1}km/h, xe 2 vôi vân tôc {speed2}km/h. Khoang cách {distance}km. Sau bao lâu hai xe gap nhau?", "a": time, "hint": f"t = s/(v1+v2) = {distance}/({speed1}+{speed2}) = {time}"},
                {"q": f"Chuyên dông nguôc chiêu: công thûc thôi gian gap nhau là gì?", "a": "t = s/(v1+v2)", "hint": "Thôi gian = khoang cách chia cho tông vân tôc"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 62:  # Luyên tap chung
            scenarios = [
                (f"Hai xe xuông phôi nhau, xe 1 {rint(30,60)}km/h, xe 2 {rint(30,60)}km/h. Khoang cách {rint(100,500)}km. Thôi gian gap nhau?", str(rint(100,500)//(rint(30,60)+rint(30,60)))),
                (f"Hai xe cùng chiêu, xe 1 {rint(30,60)}km/h, xe 2 {rint(20,50)}km/h. Sau {rint(2,4)}giô, xe 1 dâu trûc xe 2 bao nhiêu km?", str((rint(30,60)-rint(20,50))*rint(2,4)))
            ]
            q, ans = random.choice(scenarios)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Luyên tap chuyên dông"
        
        elif lid == 63:  # Thu thâp, phân loai, ghi chép sô liêu
            data = [rint(10, 50), rint(10, 50), rint(10, 50)]
            categories = ["quà cam", "quà táo", "quà chuôi"]
            templates = [
                {"q": f"Sô liêu: {categories[0]}: {data[0]}, {categories[1]}: {data[1]}, {categories[2]}: {data[2]}. Thu thâp sô liêu này?", "a": "Lâp bang", "hint": "Sû dung bang dê thu thâp và ghi chép sô liêu"},
                {"q": f"Phân loai sô liêu trên là gì?", "a": "Theo loai", "hint": "Phân loai theo loai quà"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 64:  # Biêu dô hình quàn tròn
            data = [rint(10, 50), rint(10, 50), rint(10, 50)]
            labels = ["Lôp 5A", "Lôp 5B", "Lôp 5C"]
            total = sum(data)
            templates = [
                {"q": f"Lâp biêu dô hình quàn tròn cho sô liêu: {labels[0]}: {data[0]}%, {labels[1]}: {data[1]}%, {labels[2]}: {data[2]}%", "a": "Biêu dô dã lâp", "hint": f"Biêu dô hình quàn tròn hiên thî tî lê phan trâm"},
                {"q": f"Tông sô phan trâm trong biêu dô trên là bao nhiêu?", "a": total, "hint": f"Tông = {data[0]} + {data[1]} + {data[2]} = {total}%"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 65:  # Tî sô cua sô lân lôi lai su kiên cua su kiên
            events = ["nút", "sáp", "trung", "nguôi"]
            counts = [rint(10, 50), rint(10, 50), rint(10, 50), rint(10, 50)]
            total = sum(counts)
            event_idx = random.randint(0, 3)
            ratio = counts[event_idx] / total
            templates = [
                {"q": f"Trong {total} lân tung, có {counts[event_idx]} lân {events[event_idx]}. Tî sô lân lôi lai su kiên cua su kiên là gì?", "a": f"{counts[event_idx]}/{total}", "hint": f"Tî sô = sô lân {events[event_idx]} / tông sô lân = {counts[event_idx]}/{total}"},
                {"q": f"Tî sô lân lôi lai su kiên cua su kiên là gì?", "a": "Sô lân xáy ra / Tông sô lân", "hint": "Tî sô = Sô lân xáy ra chia cho tông sô lân"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        elif lid == 66:  # Thûc hành thu thâp, phân tích sô liêu thông kê
            scenarios = [
                (f"Thu thâp sô liêu vê chiêu cao cua {rint(20, 30)} hoc sinh trong lôp", "Sû dung thang dô và ghi chép"),
                (f"Phân tích sô liêu vê môn hoc yêu thích cua {rint(20, 30)} hoc sinh", "Lâp biêu dô và phân tích"),
                (f"Thu thâp sô liêu vê thôi gian hoc bài tâp mõi ngày", "Ghi chép và tính trung binh")
            ]
            q, hint = random.choice(scenarios)
            return q, "Thûc hành thông kê", SmartAI._generate_distractors("Thûc hành thông kê", "numeric"), "arithmetic", hint
        
        elif lid == 67:  # Luyên tap chung
            operations = [
                lambda: (f"Lâp biêu dô hình quàn tròn cho sô liêu: Lôp A: {rint(10,30)}%, Lôp B: {rint(10,30)}%", "Biêu dô dã lâp", "arithmetic"),
                lambda: (f"Trong {rint(50,100)} lân, có {rint(10,30)} lân mât. Tî sô lân lôi lai su kiên?", f"{rint(10,30)}/{rint(50,100)}", "arithmetic"),
                lambda: ("Thu thâp sô liêu vê cân nang cua 20 hoc sinh", "Sû dung cân và ghi chép", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Luyên tap thông kê"
        
        elif lid == 68:  # Ôn tap sô tu nhiên, phân sô, sô thâp phân
            operations = [
                lambda: (f"{rint(100000, 500000)} + {rint(50000, 200000)} = ?", str(rint(150000, 700000)), "arithmetic"),
                lambda: (f"{rint(2,10)}/{rint(3,11)} + {rint(2,10)}/{rint(3,11)} = ?", f"{rint(2,10)+rint(2,10)}/{rint(3,11)}", "arithmetic"),
                lambda: (f"{rint(2,9)}.{rint(1,9)} + {rint(2,9)}.{rint(1,9)} = ?", str(round(rint(2,9) + rint(1,9)/10 + rint(2,9) + rint(1,9)/10, 2)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap các loai sô"
        
        elif lid == 69:  # Ôn tap các phép tính
            operations = [
                lambda: (f"{rint(2,9)}.{rint(1,9)} × {rint(2,9)} = ?", str(round((rint(2,9) + rint(1,9)/10) * rint(2,9), 2)), "arithmetic"),
                lambda: (f"{rint(2,9)}.{rint(1,9)} ÷ {rint(2,9)} = ?", str(round((rint(2,9) + rint(1,9)/10) / rint(2,9), 2)), "arithmetic"),
                lambda: (f"{rint(2,10)}/{rint(3,11)} × {rint(2,10)}/{rint(3,11)} = ?", f"{rint(2,10)*rint(2,10)}/{rint(3,11)*rint(3,11)}", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap phép tính"
        
        elif lid == 70:  # Ôn tap tî sô, tî sô phan trâm
            operations = [
                lambda: (f"Tông hai sô là {rint(100, 500)}, tî sô là {rint(2,5)}:{rint(2,5)}. Tìm hai sô", f"{rint(100,500)//(rint(2,5)+rint(2,5))*rint(2,5)} và {rint(100,500)//(rint(2,5)+rint(2,5))*rint(2,5)}", "arithmetic"),
                lambda: (f"Tìm {rint(5,50)}% cua {rint(100, 1000)}", str((rint(100, 1000) * rint(5,50)) // 100), "arithmetic"),
                lambda: (f"{rint(50, 300)} là bao nhiêu phan trâm cua {rint(200, 1000)}?", f"{round((rint(50, 300) / rint(200, 1000)) * 100, 1)}%", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap tî sô"
        
        elif lid == 71:  # Ôn tap hình hoc
            shapes = [
                ("Hình tam giác", "S = (dài × cao) ÷ 2", (rint(5,20)*rint(3,15))//2),
                ("Hình thang", "S = (a + b) × h ÷ 2", (rint(5,20)+rint(3,15))*rint(4,12)//2),
                ("Hình tròn", "S = 3,14 × r²", round(3.14 * rint(2,10) * rint(2,10), 2))
            ]
            shape, formula, area = random.choice(shapes)
            templates = [
                {"q": f"Công thûc diên tích {shape} là gì?", "a": formula, "hint": f"Công thûc diên tích {shape}"},
                {"q": f"Diên tích {shape} có các kích thuôc cho trôn là {area}?", "a": "Có thê", "hint": f"Diên tích = {area}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "geo", t.get("hint", "")
        
        elif lid == 72:  # Ôn tap dô luong
            operations = [
                lambda: (f"Hinh hôp chû nhât {rint(2,10)}×{rint(2,8)}×{rint(2,8)} (cm). V?", str(rint(2,10)*rint(2,8)*rint(2,8)), "geo"),
                lambda: (f"{rint(1,5)} m³ = ? dm³", str(rint(1,5) * 1000), "measure"),
                lambda: (f"{rint(2,8)}giô {rint(10,30)}phút = ? phút", str(rint(2,8) * 60 + rint(10,30)), "measure"),
                lambda: (f"Môt xe {rint(30,80)}km/h trong {rint(2,6)}giô. Quãng dông?", str(rint(30,80)*rint(2,6)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap dô luong"
        
        elif lid == 73:  # Ôn tap toán chuyên dông dêu
            scenarios = [
                (f"Môt xe di chuyen {rint(100,500)}km trong {rint(2,6)}giô. Vân tôc?", str(rint(100,500)//rint(2,6))),
                (f"Môt xe di chuyen vôi vân tôc {rint(30,80)}km/h trong {rint(2,6)}giô. Quãng dông?", str(rint(30,80)*rint(2,6))),
                (f"Hai xe xuông phôi nhau, xe 1 {rint(30,60)}km/h, xe 2 {rint(30,60)}km/h. Khoang cách {rint(100,500)}km. Thôi gian gap nhau?", str(rint(100,500)//(rint(30,60)+rint(30,60))))
            ]
            q, ans = random.choice(scenarios)
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Ôn tap toán chuyên dông"
        
        elif lid == 74:  # Ôn tap môt sô yêu tô thông kê và xác suât
            operations = [
                lambda: (f"Lâp biêu dô hình quàn tròn cho sô liêu: A: {rint(10,30)}%, B: {rint(10,30)}%, C: {rint(10,30)}%", "Biêu dô dã lâp", "arithmetic"),
                lambda: (f"Trong {rint(50,100)} lân, có {rint(10,30)} lân mât. Xác suât mât là bao nhiêu?", f"{rint(10,30)}/{rint(50,100)}", "arithmetic"),
                lambda: (f"Thu thâp sô liêu vê cân nang 20 hoc sinh", "Sû dung cân và ghi chép", "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap thông kê"
        
        elif lid == 75:  # Ôn tap chung
            operations = [
                lambda: (f"{rint(100000, 500000)} - {rint(50000, 200000)} = ?", str(rint(150000, 550000)), "arithmetic"),
                lambda: (f"{rint(2,9)}.{rint(1,9)} × {rint(2,9)}.{rint(1,9)} = ?", str(round((rint(2,9) + rint(1,9)/10) * (rint(2,9) + rint(1,9)/10), 2)), "arithmetic"),
                lambda: (f"Hinh lap phuong côt {rint(2,10)}cm. V?", str(rint(2,10)*rint(2,10)*rint(2,10)), "geo"),
                lambda: (f"{rint(1,5)} m³ = ? dm³", str(rint(1,5) * 1000), "measure"),
                lambda: (f"Môt xe {rint(30,80)}km/h trong {rint(2,6)}giô. Quãng dông?", str(rint(30,80)*rint(2,6)), "arithmetic")
            ]
            op = random.choice(operations)
            return op[0], op[1], SmartAI._generate_distractors(op[1], "numeric"), op[2], "Ôn tap chung cuôi nâm"
        
        # Mâc dînh cho các bài không xâc dînh
        else:
            a = rint(1000, 10000); b = rint(1000, 10000)
            ans = a + b
            return f"Tính: {a} + {b} = ?", str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Bài tap luyên"

    # --- LỚP 2 LOGIC - THEO SGK KẾT NỐI TRI THỨC ---
    @staticmethod
    def grade_2_logic(lid, difficulty=None):
        names = ["Mai", "Nam", "Việt", "Mi", "An", "Bình", "Hà", "Quân"]
        objs = ["quyển vở", "bút chì", "viên bi", "cái kẹo", "con tem", "bông hoa", "quả táo"]
        mult = SmartAI._difficulty_multiplier(difficulty)
        
        def rint(a, b):
            return random.randint(a, max(a, int(b * mult)))
        
        # Bài 1-4: Số trong phạm vi 100
        if lid in range(1, 5):
            val = rint(10, 99)
            templates = [
                {"q": f"Số {val} gồm {val//10} chục và mấy đơn vị?", "a": val % 10},
                {"q": f"Số liền trước của {val} là số nào?", "a": val - 1},
                {"q": f"Số liền sau của {val} là số nào?", "a": val + 1},
                {"q": f"Viết số {val} dưới dạng chữ?", "a": val}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic"
        
        # Bài 5-8: Cộng trong phạm vi 100
        elif lid in range(5, 9):
            a = rint(15, 50); b = rint(10, 40)
            ans = a + b
            templates = [
                {"q": f"Tính: {a} + {b} = ?", "a": ans},
                {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, nhận thêm {b} {random.choice(objs)}. Tổng số là?", "a": ans},
                {"q": f"Đặt tính rồi tính: {a} + {b}", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 9-12: Trừ trong phạm vi 100
        elif lid in range(9, 13):
            a = rint(30, 80); b = rint(10, 30)
            ans = a - b
            templates = [
                {"q": f"Tính: {a} - {b} = ?", "a": ans},
                {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, cho đi {b} {random.choice(objs)}. Còn lại?", "a": ans},
                {"q": f"Tìm hiệu: {a} và {b}", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 13-15: Nhân trong phạm vi 100
        elif lid in range(13, 16):
            a = rint(2, 9); b = rint(2, 9)
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans},
                {"q": f"Mỗi tổ có {a} học sinh. {b} tổ có bao nhiêu học sinh?", "a": ans},
                {"q": f"{a} lần {b} bằng bao nhiêu?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 16-18: Chia trong phạm vi 100
        elif lid in range(16, 19):
            b = rint(2, 9); a = b * rint(2, 10)
            ans = a // b
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans},
                {"q": f"{a} {random.choice(objs)} chia đều cho {b} bạn. Mỗi bạn được mấy?", "a": ans},
                {"q": f"{a} bằng {b} lần số nào?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 19-21: Đo độ dài
        elif lid in range(19, 22):
            a = rint(10, 50); b = rint(5, 25)
            ans = f"{a+b} cm"
            templates = [
                {"q": f"Đoạn AB dài {a}cm, đoạn BC dài {b}cm. Đoạn AC dài bao nhiêu?", "a": ans},
                {"q": f"{a}cm và {b}cm cộng lại bằng bao nhiêu cm?", "a": ans},
                {"q": f"Một cuộn dây dài {a}cm, dùng đi {b}cm. Còn lại bao nhiêu cm?", "a": f"{a-b} cm"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure"
        
        # Bài 22-24: Đo khối lượng
        elif lid in range(22, 25):
            a = rint(1, 10); b = rint(1, 5)
            ans = f"{a+b} kg"
            templates = [
                {"q": f"Bao A nặng {a}kg, bao B nặng {b}kg. Cả hai nặng bao nhiêu?", "a": ans},
                {"q": f"{a}kg cộng {b}kg bằng bao nhiêu?", "a": ans},
                {"q": f"Một quả dưa hấu nặng {a}kg, một quả dưa lê nặng {b}kg. Tổng khối lượng?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure"
        
        # Bài 25-27: Nhận biết thời gian
        elif lid in range(25, 28):
            h = rint(1, 12); m = random.choice([0, 15, 30, 45])
            ans = f"{h} giờ {m} phút" if m > 0 else f"{h} giờ"
            templates = [
                {"q": f"Kim dài chỉ số {h}, kim ngắn chỉ số {m//5 if m > 0 else 12}. Đồng hồ chỉ mấy giờ?", "a": ans},
                {"q": f"{random.choice(names)} đi ngủ lúc {ans}. Hỏi đó là mấy giờ?", "a": ans},
                {"q": f"Đổi {h} giờ {m} phút ra chữ?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "clock"), "clock"
        
        # Bài 28-30: Tiền tệ
        elif lid in range(28, 31):
            a = rint(10000, 50000); b = rint(5000, 25000)
            ans = f"{a+b}đ"
            templates = [
                {"q": f"Một quyển sách giá {a}đ, một bút giá {b}đ. Tổng giá trị?", "a": ans},
                {"q": f"{a}đ cộng {b}đ bằng bao nhiêu?", "a": ans},
                {"q": f"{random.choice(names)} có {a}đ, nhận thêm {b}đ. Tổng số tiền?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure"
        
        # Bài 31-35: Số trong phạm vi 1000
        elif lid in range(31, 36):
            val = rint(100, 999)
            templates = [
                {"q": f"Số {val} có mấy trăm, mấy chục, mấy đơn vị?", "a": f"{val//100} trăm {val%100//10} chục {val%10} đơn vị"},
                {"q": f"Số liền trước của {val} là số nào?", "a": val - 1},
                {"q": f"Số liền sau của {val} là số nào?", "a": val + 1},
                {"q": f"Đọc số {val}?", "a": val}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic"
        
        # Bài 36-40: Cộng trong phạm vi 1000
        elif lid in range(36, 41):
            a = rint(100, 500); b = rint(50, 300)
            ans = a + b
            templates = [
                {"q": f"Tính: {a} + {b} = ?", "a": ans},
                {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, nhận thêm {b} {random.choice(objs)}. Tổng số là?", "a": ans},
                {"q": f"Đặt tính rồi tính: {a} + {b}", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 41-45: Trừ trong phạm vi 1000
        elif lid in range(41, 46):
            a = rint(200, 800); b = rint(50, 200)
            ans = a - b
            templates = [
                {"q": f"Tính: {a} - {b} = ?", "a": ans},
                {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, cho đi {b} {random.choice(objs)}. Còn lại?", "a": ans},
                {"q": f"Tìm hiệu: {a} và {b}", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 46-50: Nhân với số có 2 chữ số
        elif lid in range(46, 51):
            a = rint(10, 99); b = rint(2, 9)
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans},
                {"q": f"Mỗi lớp có {a} học sinh. {b} lớp có bao nhiêu học sinh?", "a": ans},
                {"q": f"{a} nhân với {b} bằng bao nhiêu?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 51-55: Chia cho số có 1 chữ số
        elif lid in range(51, 56):
            b = rint(2, 9); a = b * rint(100, 999)
            ans = a // b
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans},
                {"q": f"{a} {random.choice(objs)} chia đều cho {b} túi. Mỗi túi có bao nhiêu?", "a": ans},
                {"q": f"{a} bằng {b} lần số nào?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic"
        
        # Bài 56-60: Phép tính có ngoặc
        elif lid in range(56, 61):
            a = rint(10, 50); b = rint(5, 20); c = rint(2, 8)
            if random.random() > 0.5:
                ans = (a + b) * c
                q = f"Tính: ({a} + {b}) × {c} = ?"
            else:
                ans = a + (b * c)
                q = f"Tính: {a} + {b} × {c} = ?"
            return q, str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic"
        
        # Bài 61-65: Đo độ dài (mét)
        elif lid in range(61, 66):
            a = rint(100, 500); b = rint(50, 200)
            ans = f"{a+b} m"
            templates = [
                {"q": f"Đoạn AB dài {a}m, đoạn BC dài {b}m. Đoạn AC dài bao nhiêu?", "a": ans},
                {"q": f"{a}m và {b}m cộng lại bằng bao nhiêu mét?", "a": ans},
                {"q": f"Một con đường dài {a}m, đã làm được {b}m. Còn lại bao nhiêu mét?", "a": f"{a-b} m"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure"
        
        # Bài 66-70: Đo khối lượng (kg)
        elif lid in range(66, 71):
            a = rint(10, 50); b = rint(5, 25)
            ans = f"{a+b} kg"
            templates = [
                {"q": f"Bao gạo A nặng {a}kg, bao gạo B nặng {b}kg. Cả hai nặng bao nhiêu?", "a": ans},
                {"q": f"{a}kg cộng {b}kg bằng bao nhiêu?", "a": ans},
                {"q": f"Một quả dưa hấu nặng {a}kg, một quả dưa lê nặng {b}kg. Tổng khối lượng?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure"
        
        # Bài 71-75: Đo thời gian (giờ, phút)
        elif lid in range(71, 76):
            h = rint(1, 12); m = random.choice([0, 15, 30, 45])
            ans = f"{h} giờ {m} phút" if m > 0 else f"{h} giờ"
            templates = [
                {"q": f"Kim dài chỉ số {h}, kim ngắn chỉ số {m//5 if m > 0 else 12}. Đồng hồ chỉ mấy giờ?", "a": ans},
                {"q": f"{random.choice(names)} bắt đầu học lúc {ans}. Hỏi đó là mấy giờ?", "a": ans},
                {"q": f"Đổi {h} giờ {m} phút ra chữ?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "clock"), "clock"
        
        # Bài 76-80: Tiền tệ (nghìn đồng)
        elif lid in range(76, 81):
            a = rint(10000, 50000); b = rint(5000, 25000)
            ans = f"{a+b}đ"
            templates = [
                {"q": f"Một chiếc xe đạp giá {a}đ, một chiếc mũ giá {b}đ. Tổng giá trị?", "a": ans},
                {"q": f"{a}đ cộng {b}đ bằng bao nhiêu đồng?", "a": ans},
                {"q": f"{random.choice(names)} có {a}đ, nhận thêm {b}đ. Tổng số tiền?", "a": ans}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure"
        
        # Bài 81-85: Hình học mặt phẳng
        elif lid in range(81, 86):
            shapes = {
                "tam giác": ["cờ tam giác", "biển báo", "mũ bảo hiểm", "cái kẹo"],
                "vuông": ["khối rubik", "cái hộp", "bánh quy", "cái bảng"],
                "chữ nhật": ["cái cửa", "quyển sách", "cái TV", "khung hình"],
                "tròn": ["bánh xe", "đồng hồ", "đĩa CD", "cái nắp"]
            }
            shape = random.choice(list(shapes.keys()))
            item = random.choice(shapes[shape])
            ans = f"Hình {shape}"
            return f"{item} có dạng hình gì?", ans, SmartAI._generate_distractors(ans, "geo"), "geo"
        
        # Bài 86-90: Chu vi hình học
        elif lid in range(86, 91):
            if lid in [86, 87]:  # Hình vuông
                c = rint(5, 15)
                ans = c * 4
                return f"Chu vi hình vuông có cạnh {c}cm là:", str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure"
            elif lid in [88, 89]:  # Hình chữ nhật
                d = rint(8, 20); r = rint(5, 12)
                ans = (d + r) * 2
                return f"Chu vi hình chữ nhật có chiều dài {d}cm, chiều rộng {r}cm là:", str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure"
            else:  # Hình tam giác đều
                c = rint(6, 15)
                ans = c * 3
                return f"Chu vi hình tam giác đều có cạnh {c}cm là:", str(ans), SmartAI._generate_distractors(ans, "numeric"), "measure"
        
        # Mặc định
        else:
            a = rint(10, 50); b = rint(5, 30)
            ans = a + b
            return f"Tính: {a} + {b} = ?", str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic"

    # --- LỚP 3 LOGIC - THEO SGK KẾT NỐI TRI THỨC ---
    @staticmethod
    def grade_3_logic(lid, difficulty=None):
        names = ["An", "Bình", "Chi", "Dũng", "Gia", "Hùng", "Linh", "Minh"]
        objs = ["quyển sách", "cái bút", "viên bi", "cái kẹo", "bông hoa", "quả cam", "cái hộp"]
        mult = SmartAI._difficulty_multiplier(difficulty)
        
        def rint(a, b):
            return random.randint(a, max(a, int(b * mult)))
        
        # Bài 1: Số trong phạm vi 10000 - Đọc và viết số
        if lid == 1:
            val = rint(1000, 9999)
            templates = [
                {"q": f"Đọc số {val}?", "a": val, "hint": f"Phân tích: {val//1000} nghìn {val%1000//100} trăm {val%100//10} chục {val%10} đơn vị"},
                {"q": f"Viết số {val//1000} nghìn {val%1000//100} trăm {val%100//10} chục {val%10} đơn vị bằng số?", "a": val, "hint": "Ghép các chữ số theo thứ tự hàng nghìn, trăm, chục, đơn vị"},
                {"q": f"Số {val} có mấy nghìn, mấy trăm, mấy chục, mấy đơn vị?", "a": f"{val//1000} nghìn {val%1000//100} trăm {val%100//10} chục {val%10} đơn vị", "hint": "Phân tích từng hàng từ trái sang phải"},
                {"q": f"Chữ số hàng nghìn của số {val} là số mấy?", "a": val//1000, "hint": f"Chữ số đầu tiên từ trái của {val} là hàng nghìn"},
                {"q": f"Số liền trước của {val} là số nào?", "a": val - 1, "hint": "Số liền trước là số nhỏ hơn 1 đơn vị"},
                {"q": f"Số liền sau của {val} là số nào?", "a": val + 1, "hint": "Số liền sau là số lớn hơn 1 đơn vị"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        # Bài 2: Số trong phạm vi 10000 - So sánh và sắp xếp
        elif lid == 2:
            a = rint(1000, 5000); b = rint(1000, 5000)
            while a == b: b = rint(1000, 5000)
            ans = ">" if a > b else "<"
            templates = [
                {"q": f"So sánh: {a} ... {b}", "a": ans, "hint": f"So sánh từng hàng từ trái sang phải, {a} {'lớn hơn' if a > b else 'nhỏ hơn'} {b}"},
                {"q": f"Số nào lớn hơn: {a} hay {b}?", "a": f"{a} {'>' if a > b else '<'} {b}", "hint": f"Đọc và so sánh hai số"},
                {"q": f"Sắp xếp các số sau theo thứ tự từ nhỏ đến lớn: {a}, {b}, {a+b}", "a": f"{min(a,b)}, {max(a,b)}, {a+b}", "hint": "So sánh từng cặp số để sắp xếp"},
                {"q": f"Tìm số nhỏ hơn {max(a,b)} và lớn hơn {min(a,b)}?", "a": f"{(max(a,b)+min(a,b))//2}", "hint": f"Số nằm giữa {min(a,b)} và {max(a,b)}"},
                {"q": f"Số chẵn lớn nhất trong hai số {a}, {b} là số nào?", "a": max([x for x in [a,b] if x%2==0]), "hint": "Kiểm tra số chẵn và chọn số lớn nhất"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "compare"), "logic", t.get("hint", "")
        
        # Bài 3: Cộng trong phạm vi 10000 - Cộng không nhớ
        elif lid == 3:
            a = rint(1000, 4000); b = rint(1000, 4000)
            if (a%100 + b%100) < 100:  # Đảm bảo không nhớ
                ans = a + b
                templates = [
                    {"q": f"Tính: {a} + {b} = ?", "a": ans, "hint": f"Cộng từng hàng: đơn vị {a%10}+{b%10}={a%10+b%10}, chục {(a//10)%10}+{(b//10)%10}={(a//10)%10+(b//10)%10}"},
                    {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, nhận thêm {b} {random.choice(objs)}. Tổng số là?", "a": ans, "hint": f"Cộng {a} và {b}"},
                    {"q": f"Đặt tính rồi tính: {a} + {b}", "a": ans, "hint": "Đặt số thẳng cột theo hàng rồi cộng"},
                    {"q": f"Tổng của {a} và {b} là bao nhiêu?", "a": ans, "hint": f"{a} + {b} = {ans}"},
                    {"q": f"Biết {a} + x = {ans}. Tìm x?", "a": b, "hint": f"x = {ans} - {a} = {b}"}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
            else:
                # Nếu có nhớ, chuyển sang bài 4
                return SmartAI.grade_3_logic(4, difficulty)
        
        # Bài 4: Cộng trong phạm vi 10000 - Cộng có nhớ
        elif lid == 4:
            a = rint(1500, 5000); b = rint(1500, 5000)
            if (a%100 + b%100) >= 100:  # Đảm bảo có nhớ
                ans = a + b
                templates = [
                    {"q": f"Tính: {a} + {b} = ?", "a": ans, "hint": f"Cộng có nhớ: đơn vị {a%10}+{b%10}={a%10+b%10}, viết {(a%10+b%10)%10} nhớ {(a%10+b%10)//10}"},
                    {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, nhận thêm {b} {random.choice(objs)}. Tổng số là?", "a": ans, "hint": f"Cộng có nhớ từ hàng đơn vị"},
                    {"q": f"Đặt tính rồi tính: {a} + {b}", "a": ans, "hint": "Nhớ 1 khi cộng hàng đơn vị và hàng chục"},
                    {"q": f"Tìm m sao cho: {a} + m = {ans}", "a": b, "hint": f"m = {ans} - {a} = {b}"},
                    {"q": f"Biết tổng của hai số là {ans} và một số là {a}. Số còn lại là bao nhiêu?", "a": b, "hint": f"Số còn lại = tổng - số đã biết = {ans} - {a} = {b}"}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
            else:
                # Nếu không nhớ, chuyển sang bài 3
                return SmartAI.grade_3_logic(3, difficulty)
        
        # Bài 5: Trừ trong phạm vi 10000 - Trừ không nhớ
        elif lid == 5:
            a = rint(2000, 8000); b = rint(1000, 3000)
            if (a%100) >= (b%100):  # Đảm bảo không nhớ
                ans = a - b
                templates = [
                    {"q": f"Tính: {a} - {b} = ?", "a": ans, "hint": f"Trừ từng hàng: đơn vị {a%10}-{b%10}={a%10-b%10}, chục {(a//10)%10}-{(b//10)%10}={(a//10)%10-(b//10)%10}"},
                    {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, cho đi {b} {random.choice(objs)}. Còn lại?", "a": ans, "hint": f"Trừ {b} từ {a}"},
                    {"q": f"Tìm hiệu của {a} và {b}", "a": ans, "hint": f"{a} - {b} = {ans}"},
                    {"q": f"{a} trừ đi {b} bằng bao nhiêu?", "a": ans, "hint": f"Thực hiện phép trừ theo hàng"},
                    {"q": f"Biết {ans} + {b} = {a}. Tìm hiệu?", "a": ans, "hint": f"Hiệu = {a} - {b} = {ans}"}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
            else:
                # Nếu có nhớ, chuyển sang bài 6
                return SmartAI.grade_3_logic(6, difficulty)
        
        # Bài 6: Trừ trong phạm vi 10000 - Trừ có nhớ
        elif lid == 6:
            a = rint(2000, 8000); b = rint(1000, 3000)
            if (a%100) < (b%100):  # Đảm bảo có nhớ
                ans = a - b
                templates = [
                    {"q": f"Tính: {a} - {b} = ?", "a": ans, "hint": f"Trừ có nhớ: mượn 1 chục, đơn vị {(a%10)+10}-{b%10}={(a%10)+10-b%10}"},
                    {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, cho đi {b} {random.choice(objs)}. Còn lại?", "a": ans, "hint": f"Trừ có nhớ từ hàng đơn vị"},
                    {"q": f"Đặt tính rồi tính: {a} - {b}", "a": ans, "hint": "Mượn 1 khi trừ hàng đơn vị và hàng chục"},
                    {"q": f"Tìm x sao cho: x + {b} = {a}", "a": ans, "hint": f"x = {a} - {b} = {ans}"},
                    {"q": f"Hiệu của {a} và {b} là bao nhiêu?", "a": ans, "hint": f"{a} - {b} = {ans}"}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
            else:
                # Nếu không nhớ, chuyển sang bài 5
                return SmartAI.grade_3_logic(5, difficulty)
        
        # Bài 7: Nhân với số có 2 chữ số - Nhân với số có chữ số 0
        elif lid == 7:
            a = rint(10, 99); b = random.choice([10, 20, 30, 40, 50, 60, 70, 80, 90])
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Nhân với số có 0: {a} × {b} = {a} × {b//10} × 10 = {a * (b//10)}0"},
                {"q": f"{a} nhân với {b} bằng bao nhiêu?", "a": ans, "hint": f"Nhân {a} với {b//10} rồi thêm 0 vào cuối"},
                {"q": f"Mỗi lớp có {a} học sinh. {b//10} chục lớp có bao nhiêu học sinh?", "a": ans, "hint": f"{a} × {b} = {ans}"},
                {"q": f"Tích của {a} và {b} là bao nhiêu?", "a": ans, "hint": f"{a} × {b} = {ans}"},
                {"q": f"Biết {a} × {b//10} = {ans//10}. Tính {a} × {b}?", "a": ans, "hint": f"Thêm 0 vào cuối kết quả"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 8: Nhân với số có 2 chữ số - Nhân thông thường
        elif lid == 8:
            a = rint(10, 99); b = rint(11, 99)
            if b % 10 != 0:  # Đảm bảo không có chữ số 0
                ans = a * b
                templates = [
                    {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Nhân theo cột: {a} × {b%10} = {a*(b%10)}, {a} × {b//10} = {a*(b//10)}"},
                    {"q": f"{a} nhân với {b} bằng bao nhiêu?", "a": ans, "hint": f"Áp dụng công thức nhân có hai chữ số"},
                    {"q": f"Mỗi tổ có {a} học sinh. {b} tổ có bao nhiêu học sinh?", "a": ans, "hint": f"{a} × {b} = {ans}"},
                    {"q": f"Đặt tính rồi nhân: {a} × {b}", "a": ans, "hint": "Nhân từng hàng rồi cộng kết quả"},
                    {"q": f"Tìm x sao cho: {a} × x = {ans}", "a": b, "hint": f"x = {ans} ÷ {a} = {b}"}
                ]
                t = random.choice(templates)
                return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
            else:
                # Nếu có chữ số 0, chuyển sang bài 7
                return SmartAI.grade_3_logic(7, difficulty)
        
        # Bài 9: Chia cho số có 1 chữ số - Chia hết
        elif lid == 9:
            b = rint(2, 9); a = b * rint(1000, 5000)
            ans = a // b
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans, "hint": f"{a} chia hết cho {b}, kết quả là {ans}"},
                {"q": f"{a} {random.choice(objs)} chia đều cho {b} hộp. Mỗi hộp có bao nhiêu?", "a": ans, "hint": f"Phép chia {a} cho {b}"},
                {"q": f"{a} bằng {b} lần số nào?", "a": ans, "hint": f"{b} × {ans} = {a}"},
                {"q": f"Thương của {a} chia cho {b} là bao nhiêu?", "a": ans, "hint": f"{a} ÷ {b} = {ans}"},
                {"q": f"Biết {ans} × {b} = {a}. Tìm thương?", "a": ans, "hint": f"Thương = {a} ÷ {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 10: Chia cho số có 1 chữ số - Chia có dư
        elif lid == 10:
            b = rint(2, 9); dividend = b * rint(1000, 5000) + rint(1, b-1)
            quotient = dividend // b; remainder = dividend % b
            ans = f"{quotient} dư {remainder}"
            templates = [
                {"q": f"{dividend} ÷ {b} = ?", "a": ans, "hint": f"{dividend} = {b} × {quotient} + {remainder}"},
                {"q": f"{dividend} {random.choice(objs)} chia cho {b} bạn. Mỗi bạn được mấy, còn dư bao nhiêu?", "a": ans, "hint": f"Chia đều {dividend} cho {b} người"},
                {"q": f"Chia {dividend} cho {b} được kết quả gì?", "a": ans, "hint": f"Tìm thương và số dư"},
                {"q": f"Tìm thương và số dư của {dividend} chia cho {b}", "a": ans, "hint": f"Thương = {quotient}, Dư = {remainder}"},
                {"q": f"Khi chia {dividend} cho {b}, số dư nhỏ nhất là bao nhiêu?", "a": remainder, "hint": f"Số dư luôn nhỏ hơn số chia {b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 11: Phép tính có ngoặc - (a + b) × c
        elif lid == 11:
            a = rint(100, 500); b = rint(50, 200); c = rint(2, 9)
            ans = (a + b) * c
            templates = [
                {"q": f"Tính: ({a} + {b}) × {c} = ?", "a": ans, "hint": f"Làm ngoặc trước: {a} + {b} = {a+b}, rồi nhân với {c}: {a+b} × {c} = {ans}"},
                {"q": f"{random.choice(names)} có {a} {random.choice(objs)}, {random.choice(names)} có {b} {random.choice(objs)}. Tổng số {random.choice(objs)} của cả hai nhân với {c} là bao nhiêu?", "a": ans, "hint": f"Tính tổng trước rồi nhân"},
                {"q": f"Tìm giá trị của ({a} + {b}) × {c}", "a": ans, "hint": f"Thực hiện phép tính trong ngoặc trước"},
                {"q": f"Biết x = ({a} + {b}) × {c}. Tìm x?", "a": ans, "hint": f"x = ({a} + {b}) × {c} = {ans}"},
                {"q": f"Mỗi tổ có {a} học sinh, {b} học sinh mới. {c} tổ như vậy có bao nhiêu học sinh?", "a": ans, "hint": f"({a} + {b}) × {c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 12: Phép tính có ngoặc - a + (b × c)
        elif lid == 12:
            a = rint(100, 500); b = rint(10, 50); c = rint(2, 9)
            ans = a + (b * c)
            templates = [
                {"q": f"Tính: {a} + ({b} × {c}) = ?", "a": ans, "hint": f"Làm ngoặc trước: {b} × {c} = {b*c}, rồi cộng với {a}: {a} + {b*c} = {ans}"},
                {"q": f"{random.choice(names)} có {a} {random.choice(objs)}. {random.choice(names)} có gấp {c} lần số {random.choice(objs)} của {random.choice(names)} có {b} {random.choice(objs)}. Tổng số là bao nhiêu?", "a": ans, "hint": f"Tính nhân trong ngoặc trước rồi cộng"},
                {"q": f"Tìm giá trị của {a} + ({b} × {c})", "a": ans, "hint": f"Nhân trước rồi cộng"},
                {"q": f"Biết x = {a} + ({b} × {c}). Tìm x?", "a": ans, "hint": f"x = {a} + {b*c} = {ans}"},
                {"q": f"{random.choice(names)} có {a} quyển sách, mỗi quyển có {b} trang. {c} quyển như vậy có bao nhiêu trang?", "a": ans, "hint": f"{a} + ({b} × {c}) = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 13: Đo độ dài - km đổi m
        elif lid == 13:
            a = rint(1, 10); b = rint(100, 900)
            ans = f"{a*1000 + b} m"
            templates = [
                {"q": f"{a}km {b}m bằng bao nhiêu mét?", "a": ans, "hint": f"{a}km = {a*1000}m, cộng với {b}m = {a*1000 + b}m"},
                {"q": f"Đổi {a}km {b}m ra mét?", "a": ans, "hint": f"1km = 1000m, nên {a}km = {a*1000}m"},
                {"q": f"Một đoạn đường dài {a}km {b}m. Hỏi độ dài tính bằng mét là bao nhiêu?", "a": ans, "hint": f"Chuyển km sang m rồi cộng"},
                {"q": f"{a}km bằng bao nhiêu mét?", "a": f"{a*1000} m", "hint": f"1km = 1000m"},
                {"q": f"Biết {a}km {b}m = X m. Tìm X?", "a": ans, "hint": f"X = {a*1000} + {b} = {a*1000 + b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 14: Đo độ dài - m đổi km
        elif lid == 14:
            total_m = rint(1500, 9500)
            a = total_m // 1000; b = total_m % 1000
            ans = f"{a}km {b}m"
            templates = [
                {"q": f"{total_m}m bằng bao nhiêu km và m?", "a": ans, "hint": f"{total_m}m = {a}km {b}m (chia cho 1000)"},
                {"q": f"Đổi {total_m}m ra km và m?", "a": ans, "hint": f"{total_m} ÷ 1000 = {a} dư {b}"},
                {"q": f"Một vận động viên chạy {total_m}m. Hỏi đó là bao nhiêu km và m?", "a": ans, "hint": f"Chia cho 1000 để tìm km"},
                {"q": f"{total_m}m = ? km ? m", "a": ans, "hint": f"{total_m}m = {a}km {b}m"},
                {"q": f"Biết X m = {a}km {b}m. Tìm X?", "a": total_m, "hint": f"X = {a*1000} + {b} = {total_m}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 15: Đo khối lượng - kg đổi g
        elif lid == 15:
            a = rint(1, 10); b = rint(100, 900)
            ans = f"{a*1000 + b} g"
            templates = [
                {"q": f"{a}kg {b}g bằng bao nhiêu gam?", "a": ans, "hint": f"{a}kg = {a*1000}g, cộng với {b}g = {a*1000 + b}g"},
                {"q": f"Đổi {a}kg {b}g ra gam?", "a": ans, "hint": f"1kg = 1000g, nên {a}kg = {a*1000}g"},
                {"q": f"Một bao gạo nặng {a}kg {b}g. Hỏi khối lượng tính bằng gam là bao nhiêu?", "a": ans, "hint": f"Chuyển kg sang g rồi cộng"},
                {"q": f"{a}kg bằng bao nhiêu gam?", "a": f"{a*1000} g", "hint": f"1kg = 1000g"},
                {"q": f"Biết {a}kg {b}g = X g. Tìm X?", "a": ans, "hint": f"X = {a*1000} + {b} = {a*1000 + b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 16: Đo khối lượng - g đổi kg
        elif lid == 16:
            total_g = rint(1500, 9500)
            a = total_g // 1000; b = total_g % 1000
            ans = f"{a}kg {b}g"
            templates = [
                {"q": f"{total_g}g bằng bao nhiêu kg và g?", "a": ans, "hint": f"{total_g}g = {a}kg {b}g (chia cho 1000)"},
                {"q": f"Đổi {total_g}g ra kg và g?", "a": ans, "hint": f"{total_g} ÷ 1000 = {a} dư {b}"},
                {"q": f"Một quả dưa hấu nặng {total_g}g. Hỏi đó là bao nhiêu kg và g?", "a": ans, "hint": f"Chia cho 1000 để tìm kg"},
                {"q": f"{total_g}g = ? kg ? g", "a": ans, "hint": f"{total_g}g = {a}kg {b}g"},
                {"q": f"Biết X g = {a}kg {b}g. Tìm X?", "a": total_g, "hint": f"X = {a*1000} + {b} = {total_g}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 17: Đo thời gian - Đọc đồng hồ analog
        elif lid == 17:
            h = rint(1, 12); m = rint(0, 59)
            ans = f"{h} giờ {m} phút" if m > 0 else f"{h} giờ"
            templates = [
                {"q": f"Kim dài chỉ số {h}, kim ngắn chỉ số {m//5 if m > 0 else 12}. Đồng hồ chỉ mấy giờ?", "a": ans, "hint": f"Kim giờ chỉ {h}, kim phút chỉ {m}"},
                {"q": f"{random.choice(names)} bắt đầu học lúc {ans}. Hỏi đó là mấy giờ?", "a": ans, "hint": f"Đọc giờ và phút từ đồng hồ"},
                {"q": f"Đồng hồ chỉ {h} giờ {m} phút. Hãy viết bằng chữ?", "a": ans, "hint": f"Kim giờ ở {h}, kim phút ở {m}"},
                {"q": f"Khi kim giờ chỉ {h} và kim phút chỉ {m}, đồng hồ chỉ mấy giờ?", "a": ans, "hint": f"Đọc vị trí kim giờ và phút"},
                {"q": f"Biết đồng hồ chỉ {h} giờ {m} phút. Hãy viết thời gian đó?", "a": ans, "hint": f"Thời gian = {h} giờ {m} phút"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "clock"), "clock", t.get("hint", "")
        
        # Bài 18: Đo thời gian - Tính khoảng cách thời gian
        elif lid == 18:
            h1 = rint(1, 8); m1 = rint(0, 59)
            h2 = h1 + rint(1, 6); m2 = rint(0, 59)
            total1 = h1 * 60 + m1; total2 = h2 * 60 + m2
            diff = total2 - total1
            diff_h = diff // 60; diff_m = diff % 60
            ans = f"{diff_h} giờ {diff_m} phút" if diff_m > 0 else f"{diff_h} giờ"
            templates = [
                {"q": f"Từ {h1} giờ {m1} phút đến {h2} giờ {m2} phút là bao lâu?", "a": ans, "hint": f"Hiệu = ({h2*60+m2}) - ({h1*60+m1}) = {diff} phút = {diff_h} giờ {diff_m} phút"},
                {"q": f"{random.choice(names)} học từ {h1}:{m1:02d} đến {h2}:{m2:02d}. Thời gian học là bao lâu?", "a": ans, "hint": f"Tính hiệu thời gian"},
                {"q": f"Một bộ phim bắt đầu lúc {h1} giờ {m1} phút, kết thúc lúc {h2} giờ {m2} phút. Thời lượng phim là bao lâu?", "a": ans, "hint": f"Thời lượng = thời gian kết thúc - thời gian bắt đầu"},
                {"q": f"Khoảng cách giữa {h1}:{m1:02d} và {h2}:{m2:02d} là bao nhiêu?", "a": ans, "hint": f"Đổi ra phút rồi tính hiệu"},
                {"q": f"Biết thời gian từ A đến B là X. A = {h1}:{m1:02d}, B = {h2}:{m2:02d}. Tìm X?", "a": ans, "hint": f"X = {h2} giờ {m2} phút - {h1} giờ {m1} phút"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "clock"), "clock", t.get("hint", "")
        
        # Bài 19: Tiền tệ - Cộng tiền lớn
        elif lid == 19:
            a = rint(100000, 900000); b = rint(50000, 400000)
            ans = f"{a+b}đ"
            templates = [
                {"q": f"Một chiếc xe máy giá {a}đ, một chiếc TV giá {b}đ. Tổng giá trị?", "a": ans, "hint": f"Tổng = {a} + {b} = {a+b}"},
                {"q": f"{a}đ cộng {b}đ bằng bao nhiêu đồng?", "a": ans, "hint": f"Cộng hai số tiền"},
                {"q": f"{random.choice(names)} có {a//1000} triệu {a%1000}đ, nhận thêm {b//1000} triệu {b%1000}đ. Tổng số tiền?", "a": ans, "hint": f"Chuyển cùng đơn vị rồi cộng"},
                {"q": f"Tổng giá trị của hai món đồ {a}đ và {b}đ là bao nhiêu?", "a": ans, "hint": f"Tổng giá trị = {a} + {b}"},
                {"q": f"Biết A = {a}đ, B = {b}đ. Tìm A + B?", "a": ans, "hint": f"A + B = {a+b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 20: Tiền tệ - Trừ tiền lớn
        elif lid == 20:
            a = rint(500000, 1000000); b = rint(100000, 400000)
            ans = f"{a-b}đ"
            templates = [
                {"q": f"Một người có {a}đ, mua đồ tốn {b}đ. Còn lại bao nhiêu?", "a": ans, "hint": f"Còn lại = {a} - {b} = {a-b}"},
                {"q": f"{a}đ trừ đi {b}đ bằng bao nhiêu đồng?", "a": ans, "hint": f"Trừ hai số tiền"},
                {"q": f"{random.choice(names)} có {a//1000} triệu {a%1000}đ, tiêu {b//1000} triệu {b%1000}đ. Còn lại?", "a": ans, "hint": f"Chuyển cùng đơn vị rồi trừ"},
                {"q": f"Hiệu của {a}đ và {b}đ là bao nhiêu?", "a": ans, "hint": f"Hiệu = {a} - {b}"},
                {"q": f"Biết A = {a}đ, B = {b}đ. Tìm A - B?", "a": ans, "hint": f"A - B = {a-b}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 21: Phân số - Đọc và viết phân số
        elif lid == 21:
            p = rint(2, 9); q = rint(2, 9)
            templates = [
                {"q": f"Phân số {p}/{q} đọc là gì?", "a": f"{p} phần {q}", "hint": f"Tử số là {p}, mẫu số là {q}, đọc là {p} phần {q}"},
                {"q": f"Viết phân số '{p} phần {q}' bằng số?", "a": f"{p}/{q}", "hint": f"'{p} phần {q}' = {p}/{q}"},
                {"q": f"Tử số của phân số {p}/{q} là số nào?", "a": p, "hint": f"Chữ số trên là tử số = {p}"},
                {"q": f"Mẫu số của phân số {p}/{q} là số nào?", "a": q, "hint": f"Chữ số dưới là mẫu số = {q}"},
                {"q": f"Phân số có tử số {p} và mẫu số {q} là phân số nào?", "a": f"{p}/{q}", "hint": f"Tử số trên, mẫu số dưới: {p}/{q}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 22: Phân số - So sánh phân số
        elif lid == 22:
            p = rint(2, 9); q = rint(2, 9)
            while p == q: q = rint(2, 9)
            comp = ">" if p > q else "<"
            templates = [
                {"q": f"So sánh {p}/{q} và {q}/{p}. Phân số nào lớn hơn?", "a": f"{p}/{q} {comp} {q}/{p}", "hint": f"{p}/{q} = {p/q:.2f}, {q}/{p} = {q/p:.2f}"},
                {"q": f"Điền dấu thích hợp: {p}/{q} ... {q}/{p}", "a": comp, "hint": f"So sánh {p/q:.2f} và {q/p:.2f}"},
                {"q": f"Phân số nào lớn hơn: {p}/{q} hay {q}/{p}?", "a": f"{p}/{q}" if p > q else f"{q}/{p}", "hint": f"Quy đồng mẫu số hoặc so sánh giá trị thập phân"},
                {"q": f"Sắp xếp {p}/{q}, {q}/{p}, 1 theo thứ tự từ nhỏ đến lớn?", "a": f"{min(p,q)}/{max(p,q)}, 1, {max(p,q)}/{min(p,q)}", "hint": f"1 là lớn nhất"},
                {"q": f"Biết {p}/{q} {comp} {q}/{p}. Điền dấu thích hợp?", "a": comp, "hint": f"Kiểm tra giá trị của hai phân số"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "compare"), "arithmetic", t.get("hint", "")
        
        # Bài 23: Diện tích hình vuông - Tính diện tích
        elif lid == 23:
            c = rint(5, 20)
            ans = c * c
            templates = [
                {"q": f"Diện tích hình vuông có cạnh {c}m là bao nhiêu m²?", "a": ans, "hint": f"Diện tích = cạnh × cạnh = {c} × {c} = {ans}"},
                {"q": f"Một hình vuông cạnh {c}m. Diện tích là bao nhiêu?", "a": ans, "hint": f"Công thức S = a² = {c}² = {ans}"},
                {"q": f"Tính diện tích hình vuông với cạnh {c}m", "a": ans, "hint": f"S = {c} × {c} = {ans} m²"},
                {"q": f"Hình vuông có cạnh {c}m có diện tích bao nhiêu?", "a": ans, "hint": f"Nhân cạnh với chính nó"},
                {"q": f"Biết hình vuông cạnh {c}m. Tính S?", "a": ans, "hint": f"S = cạnh² = {c}² = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 24: Diện tích hình vuông - Tìm cạnh từ diện tích
        elif lid == 24:
            c = rint(5, 20)
            area = c * c
            templates = [
                {"q": f"Một hình vuông có diện tích {area}m². Tính độ dài mỗi cạnh?", "a": c, "hint": f"Cạnh = √diện tích = √{area} = {c}"},
                {"q": f"Cạnh hình vuông có diện tích {area}m² bằng bao nhiêu mét?", "a": c, "hint": f"Tìm số mà bình phương bằng {area}"},
                {"q": f"Nếu hình vuông có diện tích {area}m² thì mỗi cạnh dài bao nhiêu?", "a": c, "hint": f"c² = {area} ⇒ c = {c}"},
                {"q": f"Hình vuông nào có diện tích {area}m² và cạnh là bao nhiêu?", "a": c, "hint": f"Kiểm tra {c} × {c} = {area}"},
                {"q": f"Biết S = {area}m². Tìm cạnh a?", "a": c, "hint": f"a = √S = √{area} = {c}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 25: Diện tích hình chữ nhật - Tính diện tích
        elif lid == 25:
            d = rint(5, 20); r = rint(3, 15)
            ans = d * r
            templates = [
                {"q": f"Diện tích hình chữ nhật có chiều dài {d}m, chiều rộng {r}m là bao nhiêu m²?", "a": ans, "hint": f"Diện tích = dài × rộng = {d} × {r} = {ans}"},
                {"q": f"Một hình chữ nhật dài {d}m, rộng {r}m. Diện tích là bao nhiêu?", "a": ans, "hint": f"Công thức S = d × r = {d} × {r} = {ans}"},
                {"q": f"Tính diện tích hình chữ nhật {d}m × {r}m", "a": ans, "hint": f"S = chiều dài × chiều rộng"},
                {"q": f"Hình chữ nhật {d}m × {r}m có diện tích bao nhiêu?", "a": ans, "hint": f"Nhân chiều dài với chiều rộng"},
                {"q": f"Biết d = {d}m, r = {r}m. Tính S?", "a": ans, "hint": f"S = d × r = {d} × {r} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 26: Diện tích hình chữ nhật - Tìm chiều rộng
        elif lid == 26:
            d = rint(5, 20); r = rint(3, 15)
            area = d * r
            templates = [
                {"q": f"Nếu hình chữ nhật có diện tích {area}m² và chiều dài {d}m thì chiều rộng bao nhiêu?", "a": r, "hint": f"Chiều rộng = diện tích ÷ chiều dài = {area} ÷ {d} = {r}"},
                {"q": f"Hình chữ nhật dài {d}m, diện tích {area}m². Chiều rộng là bao nhiêu?", "a": r, "hint": f"r = S ÷ d = {area} ÷ {d} = {r}"},
                {"q": f"Một hình chữ nhật có S = {area}m², d = {d}m. Tính r?", "a": r, "hint": f"r = S/d = {area}/{d} = {r}m"},
                {"q": f"Chiều rộng của hình chữ nhật {d}m × ?m = {area}m² là bao nhiêu?", "a": r, "hint": f"? = {area} ÷ {d} = {r}"},
                {"q": f"Biết S = {area}m², d = {d}m. Tìm chiều rộng?", "a": r, "hint": f"Chiều rộng = S ÷ chiều dài = {area} ÷ {d} = {r}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 27: Diện tích hình tam giác - Tính diện tích
        elif lid == 27:
            c = rint(5, 20); h = rint(3, 15)
            ans = (c * h) // 2
            templates = [
                {"q": f"Diện tích hình tam giác có cạnh {c}m, cao {h}m là bao nhiêu m²?", "a": ans, "hint": f"Diện tích = (cạnh × cao) ÷ 2 = ({c} × {h}) ÷ 2 = {ans}"},
                {"q": f"Một tam giác có cạnh đáy {c}m và cao {h}m. Diện tích là bao nhiêu?", "a": ans, "hint": f"S = (a × h) ÷ 2 = ({c} × {h}) ÷ 2 = {ans}"},
                {"q": f"Tính diện tích tam giác đáy {c}m, cao {h}m", "a": ans, "hint": f"S = (đáy × cao) ÷ 2"},
                {"q": f"Hình tam giác {c}m × {h}m có diện tích bao nhiêu?", "a": ans, "hint": f"Nhân cạnh với cao rồi chia 2"},
                {"q": f"Biết a = {c}m, h = {h}m. Tính S tam giác?", "a": ans, "hint": f"S = (a × h) ÷ 2 = ({c} × {h}) ÷ 2 = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 28: Diện tích hình tam giác - Tìm cao
        elif lid == 28:
            c = rint(5, 20); h = rint(3, 15)
            area = (c * h) // 2
            templates = [
                {"q": f"Diện tích tam giác là {area}m². Nếu cạnh đáy là {c}m thì cao bao nhiêu?", "a": h, "hint": f"Cao = (diện tích × 2) ÷ cạnh = ({area} × 2) ÷ {c} = {h}"},
                {"q": f"Tam giác có S = {area}m², đáy = {c}m. Tính cao?", "a": h, "hint": f"h = (S × 2) ÷ a = ({area} × 2) ÷ {c} = {h}m"},
                {"q": f"Một tam giác có diện tích {area}m² và cạnh đáy {c}m. Chiều cao là bao nhiêu?", "a": h, "hint": f"Chiều cao = (2 × diện tích) ÷ cạnh đáy"},
                {"q": f"Cao của tam giác {c}m × ?m = {area}m² là bao nhiêu?", "a": h, "hint": f"? = ({area} × 2) ÷ {c} = {h}"},
                {"q": f"Biết S = {area}m², a = {c}m. Tìm h?", "a": h, "hint": f"h = (S × 2) ÷ a = ({area} × 2) ÷ {c} = {h}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 29: Chu vi hình học - Chu vi hình vuông
        elif lid == 29:
            c = rint(5, 20)
            ans = c * 4
            templates = [
                {"q": f"Chu vi hình vuông có cạnh {c}m là bao nhiêu mét?", "a": ans, "hint": f"Chu vi = 4 × cạnh = 4 × {c} = {ans}"},
                {"q": f"Một hình vuông cạnh {c}m. Chu vi là bao nhiêu?", "a": ans, "hint": f"P = 4a = 4 × {c} = {ans}"},
                {"q": f"Tính chu vi hình vuông với cạnh {c}m", "a": ans, "hint": f"P = 4 × cạnh"},
                {"q": f"Hình vuông cạnh {c}m có chu vi bao nhiêu?", "a": ans, "hint": f"Cộng 4 cạnh bằng nhau"},
                {"q": f"Biết cạnh = {c}m. Tính chu vi hình vuông?", "a": ans, "hint": f"P = 4a = 4 × {c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 30: Chu vi hình học - Chu vi hình chữ nhật
        elif lid == 30:
            d = rint(5, 20); r = rint(3, 15)
            ans = (d + r) * 2
            templates = [
                {"q": f"Chu vi hình chữ nhật có chiều dài {d}m, chiều rộng {r}m là bao nhiêu mét?", "a": ans, "hint": f"Chu vi = 2 × (dài + rộng) = 2 × ({d} + {r}) = {ans}"},
                {"q": f"Một hình chữ nhật dài {d}m, rộng {r}m. Chu vi là bao nhiêu?", "a": ans, "hint": f"P = 2 × (d + r) = 2 × ({d} + {r}) = {ans}"},
                {"q": f"Tính chu vi hình chữ nhật {d}m × {r}m", "a": ans, "hint": f"P = 2 × (chiều dài + chiều rộng)"},
                {"q": f"Hình chữ nhật {d}m × {r}m có chu vi bao nhiêu?", "a": ans, "hint": f"Cộng tổng các cạnh"},
                {"q": f"Biết d = {d}m, r = {r}m. Tính chu vi hình chữ nhật?", "a": ans, "hint": f"P = 2(d + r) = 2({d} + {r}) = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "measure", t.get("hint", "")
        
        # Bài 31: Bảng cửu chương mở rộng - Nhân 11-19
        elif lid == 31:
            a = rint(11, 19); b = rint(2, 9)
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Bảng cửu chương {a}: {a} × {b} = {ans}"},
                {"q": f"{a} nhân {b} bằng bao nhiêu?", "a": ans, "hint": f"Áp dụng bảng cửu chương {a}"},
                {"q": f"Mỗi hàng có {a} ghế, {b} hàng. Tổng số ghế là bao nhiêu?", "a": ans, "hint": f"{a} × {b} = {ans} ghế"},
                {"q": f"Tích của {a} và {b} là bao nhiêu?", "a": ans, "hint": f"{a} × {b} = {ans}"},
                {"q": f"Biết {a} × {b} = X. Tìm X?", "a": ans, "hint": f"X = {a} × {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Bài 32: Bảng cửu chương mở rộng - Nhân hai số 11-19
        elif lid == 32:
            a = rint(11, 19); b = rint(11, 19)
            ans = a * b
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Nhân theo cột: {a} × {b%10} = {a*(b%10)}, {a} × {b//10} = {a*(b//10)}"},
                {"q": f"{a} nhân với {b} bằng bao nhiêu?", "a": ans, "hint": f"Áp dụng công thức nhân có hai chữ số"},
                {"q": f"Mỗi tổ có {a} học sinh. {b} tổ có bao nhiêu học sinh?", "a": ans, "hint": f"{a} × {b} = {ans} học sinh"},
                {"q": f"Đặt tính rồi nhân: {a} × {b}", "a": ans, "hint": "Nhân từng hàng rồi cộng kết quả"},
                {"q": f"Tìm x sao cho: {a} × x = {ans}", "a": b, "hint": f"x = {ans} ÷ {a} = {b}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Bài 33: Chia có dư - Chia đơn giản
        elif lid == 33:
            divisor = rint(2, 9); dividend = divisor * rint(10, 50) + rint(1, divisor-1)
            quotient = dividend // divisor; remainder = dividend % divisor
            ans = f"{quotient} dư {remainder}"
            obj = random.choice(objs)  # Chọn một loại đồ vật duy nhất
            templates = [
                {"q": f"{dividend} ÷ {divisor} = ?", "a": ans, "hint": f"{dividend} = {divisor} × {quotient} + {remainder}"},
                {"q": f"{dividend} {obj} chia cho {divisor} bạn. Mỗi bạn được mấy, còn dư bao nhiêu?", "a": ans, "hint": f"Chia đều {dividend} cho {divisor} người"},
                {"q": f"Chia {dividend} cho {divisor} được kết quả gì?", "a": ans, "hint": f"Tìm thương và số dư"},
                {"q": f"Tìm thương và số dư của {dividend} chia cho {divisor}", "a": ans, "hint": f"Thương = {quotient}, Dư = {remainder}"},
                {"q": f"Khi chia {dividend} cho {divisor}, số dư nhỏ nhất là bao nhiêu?", "a": remainder, "hint": f"Số dư luôn nhỏ hơn số chia {divisor}"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 34: Chia có dư - Chia phức tạp
        elif lid == 34:
            divisor = rint(2, 9); dividend = divisor * rint(100, 999) + rint(1, divisor-1)
            quotient = dividend // divisor; remainder = dividend % divisor
            ans = f"{quotient} dư {remainder}"
            obj = random.choice(objs)  # Chọn một loại đồ vật duy nhất
            templates = [
                {"q": f"{dividend} ÷ {divisor} = ?", "a": ans, "hint": f"{dividend} = {divisor} × {quotient} + {remainder}"},
                {"q": f"{dividend} {obj} chia đều cho {divisor} lớp. Mỗi lớp được mấy, còn dư bao nhiêu?", "a": ans, "hint": f"Chia đều {dividend} cho {divisor} lớp"},
                {"q": f"Thực hiện phép chia: {dividend} ÷ {divisor}", "a": ans, "hint": f"Đặt tính rồi chia, tìm thương và dư"},
                {"q": f"Kết quả của {dividend} chia cho {divisor} là gì?", "a": ans, "hint": f"Thương = {quotient}, Số dư = {remainder}"},
                {"q": f"Kiểm tra: {divisor} × {quotient} + {remainder} = ?", "a": dividend, "hint": f"Kiểm tra lại kết quả phép chia"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Bài 35: Bài toán có lời văn - Cộng nhân
        elif lid == 35:
            a = rint(100, 500); b = rint(50, 200); c = rint(2, 9)
            ans = a + (b * c)
            name1 = random.choice(names); name2 = random.choice(names); name3 = random.choice(names)
            obj = random.choice(objs)
            templates = [
                {"q": f"{name1} có {a} {obj}. {name2} có gấp {c} lần số {obj} của {name3} có {b} {obj}. Tổng số là bao nhiêu?", "a": ans, "hint": f"Tính {b} × {c} = {b*c}, rồi cộng với {a}: {a} + {b*c} = {ans}"},
                {"q": f"Mỗi lớp có {a} học sinh. {c} lớp có thêm {b} học sinh mỗi lớp. Tổng số học sinh là bao nhiêu?", "a": ans, "hint": f"{c} × {b} = {b*c}, cộng {a}: {a} + {b*c} = {ans}"},
                {"q": f"{name1} mua {a} {obj} giá {b}đ mỗi cái. {name2} mua thêm {c} cái. Tổng số tiền là bao nhiêu?", "a": ans, "hint": f"Tính tiền {c} cái rồi cộng với {a}"},
                {"q": f"Mỗi hộp có {b} kẹo. {c} hộp có bao nhiêu kẹo? Cộng với {a} kẹo có sẵn là bao nhiêu?", "a": ans, "hint": f"{c} × {b} + {a} = {ans}"},
                {"q": f"Biết A = {a}, B = {b} × {c}. Tính A + B?", "a": ans, "hint": f"A + B = {a} + {b*c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 36: Bài toán có lời văn - Nhân chia
        elif lid == 36:
            a = rint(50, 200); b = rint(2, 9); c = rint(2, 9)
            ans = (a * b) // c
            name = random.choice(names)
            obj = random.choice(objs)
            templates = [
                {"q": f"{name} có {a} {obj}. Mỗi ngày dùng {c} {obj}. {b} ngày như vậy dùng bao nhiêu {obj}?", "a": ans, "hint": f"{a} × {b} = {a*b}, chia cho {c}: {a*b} ÷ {c} = {ans}"},
                {"q": f"Mỗi túi chứa {c} kg gạo. {a} kg gạo đóng được bao nhiêu túi? {b} lần như vậy là bao nhiêu túi?", "a": ans, "hint": f"{a} ÷ {c} = {a//c} túi, nhân {b}: {a//c} × {b} = {ans}"},
                {"q": f"{name} có {a} quyển sách, mỗi quyển {c} trang. Tổng số trang là bao nhiêu? Đọc hết trong {b} tuần, mỗi tuần đọc bao nhiêu trang?", "a": ans, "hint": f"Tổng trang = {a} × {c}, mỗi tuần = ({a} × {c}) ÷ {b}"},
                {"q": f"Mỗi lớp học {c} tiết. {a} tiết học trong {b} tuần là bao nhiêu tiết mỗi tuần?", "a": ans, "hint": f"{a} ÷ {b} = {a//b} tiết mỗi tuần"},
                {"q": f"Biết A = {a} × {b} ÷ {c}. Tính A?", "a": ans, "hint": f"A = ({a} × {b}) ÷ {c} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 37: Bài toán có lời văn - So sánh
        elif lid == 37:
            a = rint(100, 500); b = rint(50, 200); c = rint(2, 9)
            val1 = a + b; val2 = a * c
            comp = ">" if val1 > val2 else "<"
            name1 = random.choice(names); name2 = random.choice(names); name3 = random.choice(names)
            obj = random.choice(objs)
            templates = [
                {"q": f"{name1} có {a} {obj}, nhận thêm {b} {obj}. {name2} có gấp {c} lần số {obj} của {name3}. Ai có nhiều hơn?", "a": f"{random.choice(['Người thứ nhất', 'Người thứ hai'])} nhiều hơn", "hint": f"So sánh {val1} và {val2}"},
                {"q": f"Tính {a} + {b} ... {a} × {c}. Điền dấu thích hợp?", "a": comp, "hint": f"{a} + {b} = {val1}, {a} × {c} = {val2}"},
                {"q": f"Mỗi lớp có {a} học sinh. Lớp A có thêm {b} học sinh, lớp B có gấp {c} lần. Lớp nào nhiều học sinh hơn?", "a": f"Lớp {'A' if val1 > val2 else 'B'} nhiều hơn", "hint": f"So sánh {val1} và {val2}"},
                {"q": f"Giá trị nào lớn hơn: {a} + {b} hay {a} × {c}?", "a": f"{a} + {b}" if val1 > val2 else f"{a} × {c}", "hint": f"Tính cả hai rồi so sánh"},
                {"q": f"Biết X = {a} + {b}, Y = {a} × {c}. So sánh X và Y?", "a": f"X {comp} Y", "hint": f"X = {val1}, Y = {val2}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "compare"), "arithmetic", t.get("hint", "")
        
        # Bài 38: Bài toán có lời văn - Tìm số chưa biết
        elif lid == 38:
            a = rint(50, 200); b = rint(2, 9); c = rint(2, 9)
            x = (a * b) - c
            name1 = random.choice(names); name2 = random.choice(names); name3 = random.choice(names)
            obj = random.choice(objs)
            templates = [
                {"q": f"{name1} có {a} {obj}. {name2} có gấp {b} lần số {obj} của {name3} nhưng ít hơn {c} {obj}. {name1} có bao nhiêu {obj}?", "a": x, "hint": f"{a} × {b} = {a*b}, trừ {c}: {a*b} - {c} = {x}"},
                {"q": f"Mỗi hộp có {a} cái. {b} hộp có bao nhiêu cái? Ít hơn {c} cái so với số cần tìm. Số cần tìm là bao nhiêu?", "a": x, "hint": f"{a} × {b} + {c} = {x}"},
                {"q": f"{name1} có {x} {obj}. Cho đi {c} {obj} thì bằng gấp {b} lần số {obj} của {name2} có {a} {obj}. {name1} có bao nhiêu {obj}?", "a": x, "hint": f"Giải phương trình: X - {c} = {a} × {b}"},
                {"q": f"Tìm số X sao cho: X + {c} = {a} × {b}", "a": x, "hint": f"X = {a} × {b} - {c} = {x}"},
                {"q": f"Biết X + {c} = {a} × {b}. Tìm X?", "a": x, "hint": f"X = {a*b} - {c} = {x}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 39: Bài toán có lời văn - Tổ hợp
        elif lid == 39:
            a = rint(20, 100); b = rint(2, 9); c = rint(2, 9); d = rint(10, 50)
            ans = (a * b) + (c * d)
            name = random.choice(names)
            templates = [
                {"q": f"{name} mua {a} quyển sách {b} nghìn đồng mỗi quyển, và {c} cái bút {d} nghìn đồng mỗi cái. Tổng số tiền là bao nhiêu?", "a": f"{ans} nghìn đồng", "hint": f"{a} × {b} = {a*b}, {c} × {d} = {c*d}, tổng = {a*b} + {c*d} = {ans}"},
                {"q": f"Mỗi lớp có {a} học sinh. {b} lớp có bao nhiêu học sinh? Mỗi lớp có thêm {c} giáo viên, {d} lớp có bao nhiêu giáo viên? Tổng người là bao nhiêu?", "a": ans, "hint": f"Học sinh: {a} × {b} = {a*b}, giáo viên: {c} × {d} = {c*d}, tổng = {ans}"},
                {"q": f"{name} đi bộ {a} mét mỗi ngày trong {b} ngày. Đi xe {c} km mỗi ngày trong {d} ngày. Tổng quãng đường là bao nhiêu mét?", "a": f"{ans} mét", "hint": f"Đi bộ: {a} × {b} = {a*b}, đi xe: {c*1000} × {d} = {c*d*1000}, tổng = {a*b + c*d*1000}"},
                {"q": f"Tính: ({a} × {b}) + ({c} × {d})", "a": ans, "hint": f"Làm ngoặc trước rồi cộng"},
                {"q": f"Biết X = {a} × {b} + {c} × {d}. Tính X?", "a": ans, "hint": f"X = {a*b} + {c*d} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 40: Bài toán có lời văn - Ôn tập
        elif lid == 40:
            question_types = [
                lambda: (f"Tính: {rint(100, 500)} + {rint(50, 200)} = ?", str(rint(150, 700)), "arithmetic"),
                lambda: (f"Tính: {rint(200, 800)} - {rint(50, 200)} = ?", str(rint(150, 750)), "arithmetic"),
                lambda: (f"Tính: {rint(10, 50)} × {rint(2, 9)} = ?", str(rint(20, 450)), "arithmetic"),
                lambda: (f"Tính: {rint(200, 800)} ÷ {rint(2, 9)} = ?", str(rint(50, 400)), "arithmetic"),
                lambda: (f"Diện tích hình vuông cạnh {rint(5, 15)}m là bao nhiêu m²?", str(rint(25, 225)), "measure"),
                lambda: (f"Chu vi hình chữ nhật dài {rint(5, 15)}m, rộng {rint(3, 10)}m là bao nhiêu mét?", str(rint(16, 50)), "measure"),
                lambda: (f"{rint(1, 10)}km {rint(100, 900)}m bằng bao nhiêu mét?", str(rint(1100, 10900)), "measure"),
                lambda: (f"{rint(100000, 500000)}đ + {rint(50000, 200000)}đ = ?", str(rint(150000, 700000)), "measure")
            ]
            q_func = random.choice(question_types)
            q, ans, q_type = q_func()
            return q, ans, SmartAI._generate_distractors(ans, "numeric"), q_type, "Ôn tập các kiến thức đã học"
        
        # Bài 41: Số trong phạm vi 100000 - Đọc và viết số lớn
        elif lid == 41:
            val = rint(10000, 99999)
            templates = [
                {"q": f"Đọc số {val}?", "a": val, "hint": f"Phân tích: {val//10000} chục nghìn {val%10000//1000} nghìn {val%1000//100} trăm {val%100//10} chục {val%10} đơn vị"},
                {"q": f"Viết số {val//10000} chục nghìn {val%10000//1000} nghìn {val%1000//100} trăm {val%100//10} chục {val%10} đơn vị bằng số?", "a": val, "hint": "Ghép các chữ số theo thứ tự"},
                {"q": f"Số {val} có mấy chục nghìn, mấy nghìn, mấy trăm, mấy chục, mấy đơn vị?", "a": f"{val//10000} chục nghìn {val%10000//1000} nghìn {val%1000//100} trăm {val%100//10} chục {val%10} đơn vị", "hint": "Phân tích từng hàng từ trái sang phải"},
                {"q": f"Chữ số hàng chục nghìn của số {val} là số mấy?", "a": val//10000, "hint": f"Chữ số đầu tiên từ trái của {val} là hàng chục nghìn"},
                {"q": f"Số liền trước của {val} là số nào?", "a": val - 1, "hint": "Số liền trước là số nhỏ hơn 1 đơn vị"},
                {"q": f"Số liền sau của {val} là số nào?", "a": val + 1, "hint": "Số liền sau là số lớn hơn 1 đơn vị"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")
        
        # Bài 42: Số trong phạm vi 100000 - Làm tròn số
        elif lid == 42:
            val = rint(10000, 99999)
            templates = [
                {"q": f"Làm tròn số {val} đến hàng chục nghìn là bao nhiêu?", "a": f"{(val//10000)*10000}", "hint": f"Thay các chữ số bên phải bằng 0: {(val//10000)*10000}"},
                {"q": f"Làm tròn số {val} đến hàng nghìn là bao nhiêu?", "a": f"{(val//1000)*1000}", "hint": f"Thay các chữ số bên phải bằng 0: {(val//1000)*1000}"},
                {"q": f"Làm tròn số {val} đến hàng trăm là bao nhiêu?", "a": f"{(val//100)*100}", "hint": f"Thay các chữ số bên phải bằng 0: {(val//100)*100}"},
                {"q": f"Số {val} làm tròn đến hàng chục nghìn bằng bao nhiêu?", "a": f"{(val//10000)*10000}", "hint": f"Giữ lại hàng chục nghìn, các hàng còn lại bằng 0"},
                {"q": f"Tìm số tròn hàng nghìn gần nhất với {val}?", "a": f"{(val//1000)*1000}", "hint": f"Làm tròn đến hàng nghìn"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "logic", t.get("hint", "")

        # Bài 43: Cộng trong phạm vi 100000 - Cộng lớn
        elif lid == 43:
            a = rint(10000, 50000); b = rint(5000, 30000)
            ans = a + b
            obj = random.choice(objs)  # Chọn một loại đồ vật duy nhất
            name = random.choice(names)  # Chọn một tên duy nhất
            templates = [
                {"q": f"Tính: {a} + {b} = ?", "a": ans, "hint": f"Cộng từng hàng: đơn vị {a%10}+{b%10}={a%10+b%10}, chục {(a//10)%10}+{(b//10)%10}={(a//10)%10+(b//10)%10}"},
                {"q": f"{name} có {a} {obj}, nhận thêm {b} {obj}. Tổng số là?", "a": ans, "hint": f"Cộng {a} và {b}"},
                {"q": f"Đặt tính rồi tính: {a} + {b}", "a": ans, "hint": "Đặt số thẳng cột theo hàng rồi cộng"},
                {"q": f"Tổng của {a} và {b} là bao nhiêu?", "a": ans, "hint": f"{a} + {b} = {ans}"},
                {"q": f"Biết {a} + x = {ans}. Tìm x?", "a": b, "hint": f"x = {ans} - {a} = {b}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Bài 44: Trừ trong phạm vi 100000 - Trừ lớn
        elif lid == 44:
            a = rint(20000, 80000); b = rint(5000, 30000)
            ans = a - b
            obj = random.choice(objs)  # Chọn một loại đồ vật duy nhất
            name = random.choice(names)  # Chọn một tên duy nhất
            templates = [
                {"q": f"Tính: {a} - {b} = ?", "a": ans, "hint": f"Trừ từng hàng: đơn vị {a%10}-{b%10}={a%10-b%10}, chục {(a//10)%10}-{(b//10)%10}={(a//10)%10-(b//10)%10}"},
                {"q": f"{name} có {a} {obj}, cho đi {b} {obj}. Còn lại?", "a": ans, "hint": f"Trừ {b} từ {a}"},
                {"q": f"Tìm hiệu của {a} và {b}", "a": ans, "hint": f"{a} - {b} = {ans}"},
                {"q": f"{a} trừ đi {b} bằng bao nhiêu?", "a": ans, "hint": f"Thực hiện phép trừ theo hàng"},
                {"q": f"Biết {ans} + {b} = {a}. Tìm hiệu?", "a": ans, "hint": f"Hiệu = {a} - {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Bài 45: Nhân với số có 3 chữ số
        elif lid == 45:
            a = rint(100, 999); b = rint(10, 99)
            ans = a * b
            obj = random.choice(objs)  # Chọn một loại đồ vật duy nhất
            templates = [
                {"q": f"Tính: {a} × {b} = ?", "a": ans, "hint": f"Nhân theo cột: {a} × {b%10} = {a*(b%10)}, {a} × {b//10} = {a*(b//10)}"},
                {"q": f"{a} nhân với {b} bằng bao nhiêu?", "a": ans, "hint": f"Áp dụng công thức nhân có hai chữ số"},
                {"q": f"Mỗi tổ có {a} học sinh. {b} tổ có bao nhiêu học sinh?", "a": ans, "hint": f"{a} × {b} = {ans} học sinh"},
                {"q": f"Đặt tính rồi nhân: {a} × {b}", "a": ans, "hint": "Nhân từng hàng rồi cộng kết quả"},
                {"q": f"Tìm x sao cho: {a} × x = {ans}", "a": b, "hint": f"x = {ans} ÷ {a} = {b}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Bài 46: Chia cho số có 2 chữ số
        elif lid == 46:
            b = rint(10, 99); a = b * rint(1000, 5000)
            ans = a // b
            obj = random.choice(objs)  # Chọn một loại đồ vật duy nhất
            templates = [
                {"q": f"Tính: {a} ÷ {b} = ?", "a": ans, "hint": f"{a} chia hết cho {b}, kết quả là {ans}"},
                {"q": f"{a} {obj} chia đều cho {b} hộp. Mỗi hộp có bao nhiêu?", "a": ans, "hint": f"Phép chia {a} cho {b}"},
                {"q": f"{a} bằng {b} lần số nào?", "a": ans, "hint": f"{b} × {ans} = {a}"},
                {"q": f"Thương của {a} chia cho {b} là bao nhiêu?", "a": ans, "hint": f"{a} ÷ {b} = {ans}"},
                {"q": f"Biết {ans} × {b} = {a}. Tìm thương?", "a": ans, "hint": f"Thương = {a} ÷ {b} = {ans}"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Bài 47: Phép tính có ngoặc phức tạp
        elif lid == 47:
            a = rint(100, 500); b = rint(50, 200); c = rint(2, 9); d = rint(2, 9)
            if random.random() > 0.5:
                ans = (a + b) * (c + d)
                q = f"Tính: ({a} + {b}) × ({c} + {d}) = ?"
            else:
                ans = (a * c) + (b * d)
                q = f"Tính: {a} × {c} + {b} × {d} = ?"
            name1 = random.choice(names); name2 = random.choice(names)
            obj = random.choice(objs)
            templates = [
                {"q": q, "a": ans, "hint": f"Làm ngoặc trước rồi nhân"},
                {"q": f"{name1} có {a} {obj}, {name2} có {b} {obj}. Tổng số {obj} của cả hai nhân với ({c} + {d}) là bao nhiêu?", "a": ans, "hint": f"Tính tổng trước rồi nhân"},
                {"q": f"Tìm giá trị của biểu thức trên", "a": ans, "hint": f"Thực hiện phép tính trong ngoặc trước"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")
        
        # Bài 48: Đo độ dài - Quy đổi phức tạp
        elif lid == 48:
            a = rint(1, 10); b = rint(100, 900); c = rint(1, 10); d = rint(100, 900)
            total_m1 = a * 1000 + b; total_m2 = c * 1000 + d
            ans = total_m1 + total_m2
            templates = [
                {"q": f"{a}km {b}m + {c}km {d}m = ? mét", "a": f"{ans} m", "hint": f"Đổi cả hai ra mét rồi cộng: {total_m1} + {total_m2} = {ans}"},
                {"q": f"Một người đi {a}km {b}m, sau đó đi thêm {c}km {d}m. Tổng quãng đường là bao nhiêu mét?", "a": f"{ans} m", "hint": f"Chuyển tất cả sang mét rồi cộng"},
                {"q": f"Tính tổng: ({a}km {b}m) + ({c}km {d}m)", "a": f"{ans} m", "hint": f"Đổi ra mét rồi cộng"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 49: Đo khối lượng - Quy đổi phức tạp
        elif lid == 49:
            a = rint(1, 10); b = rint(100, 900); c = rint(1, 10); d = rint(100, 900)
            total_g1 = a * 1000 + b; total_g2 = c * 1000 + d
            ans = total_g1 + total_g2
            templates = [
                {"q": f"{a}kg {b}g + {c}kg {d}g = ? gam", "a": f"{ans} g", "hint": f"Đổi cả hai ra gam rồi cộng: {total_g1} + {total_g2} = {ans}"},
                {"q": f"Một bao gạo nặng {a}kg {b}g, một bao khác nặng {c}kg {d}g. Tổng khối lượng là bao nhiêu gam?", "a": f"{ans} g", "hint": f"Chuyển tất cả sang gam rồi cộng"},
                {"q": f"Tính tổng: ({a}kg {b}g) + ({c}kg {d}g)", "a": f"{ans} g", "hint": f"Đổi ra gam rồi cộng"}
            ]
            t = random.choice(templates)
            return t["q"], t["a"], SmartAI._generate_distractors(t["a"], "measure"), "measure", t.get("hint", "")
        
        # Bài 50: Đo thời gian - Tính thời gian phức tạp
        elif lid == 50:
            h1 = rint(1, 8); m1 = rint(0, 59); s1 = rint(0, 59)
            h2 = h1 + rint(1, 6); m2 = rint(0, 59); s2 = rint(0, 59)
            total1 = h1 * 3600 + m1 * 60 + s1
            total2 = h2 * 3600 + m2 * 60 + s2
            diff = total2 - total1
            diff_h = diff // 3600; diff_m = (diff % 3600) // 60; diff_s = diff % 60
            ans = f"{diff_h} giờ {diff_m} phút {diff_s} giây" if diff_s > 0 else f"{diff_h} giờ {diff_m} phút"
            templates = [
                {"q": f"Từ {h1}:{m1:02d}:{s1:02d} đến {h2}:{m2:02d}:{s2:02d} là bao lâu?", "a": ans, "hint": f"Hiệu = {diff} giây = {diff_h} giờ {diff_m} phút {diff_s} giây"},
                {"q": f"{random.choice(names)} học từ {h1}:{m1:02d}:{s1:02d} đến {h2}:{m2:02d}:{s2:02d}. Thời gian học là bao lâu?", "a": ans, "hint": f"Tính hiệu thời gian có cả giây"},
                {"q": f"Một bộ phim bắt đầu lúc {h1}:{m1:02d}:{s1:02d}, kết thúc lúc {h2}:{m2:02d}:{s2:02d}. Thời lượng phim là bao lâu?", "a": ans, "hint": f"Thời lượng = thời gian kết thúc - thời gian bắt đầu"}
            ]
            t = random.choice(templates)
            return t["q"], str(t["a"]), SmartAI._generate_distractors(t["a"], "numeric"), "arithmetic", t.get("hint", "")

        # Mặc định cho các bài không xác định
        else:
            a = rint(1000, 10000); b = rint(1000, 10000)
            ans = a + b
            return f"Tính: {a} + {b} = ?", str(ans), SmartAI._generate_distractors(ans, "numeric"), "arithmetic", "Bài tập luyện"