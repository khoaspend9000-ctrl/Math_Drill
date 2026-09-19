/* =========================================================
   MathDrill Web — M6-A: QUESTION MODEL + BASIC GENERATOR
   ---------------------------------------------------------
   Port 1:1 từ question_generator.py (1644 dòng — source of truth):
   - QuestionType / Difficulty / Question (12-36)
   - AdaptiveDifficulty (37-96)
   - QuestionGenerator (98-1644): __init__, get_lesson_info,
     _mix_options (166-178), generate_question (180-223),
     record_answer (225-227), _generate_grade_1_question (228-505),
     to_json (506-517), _generate_grade_2_question (518-923),
     _generate_grade_3_question (924-1453),
     _generate_grade_4_question (1454-1527),
     _generate_grade_5_question (1529-1644).

   RNG (plan R2 — KHÔNG tuyên bố tương đương MT19937 của Python):
   mặc định Math.random; có thể inject global.MDRandom cho test.
   Tính đúng đắn được xác minh bằng PY REFERENCE VECTORS (template
   pool sinh từ py_reference.py với random.seed cố định), không
   phải bằng seed-matching.
   Tên method/field giữ nguyên Python để đối chiếu dễ.
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };

  // round(x, n) — port round() Python (CPython _Py_double_round): làm tròn
  // nửa-về-chẵn trên GIÁ TRỊ NHỊ PHÂN CHÍNH XÁC của double (không phải biểu diễn
  // thập phân). BigInt exact: x = m*2^e → k = round_half_even(x*10^n) → trả về
  // double gần nhất của k/10^n (một phép chia — đúng IEEE). Miền game: |x| nhỏ.
  function round2(x, digits) {
    if (!isFinite(x)) return x;
    if (x === 0) return x; // ±0 giữ nguyên (Python round(-0.0, n) = -0.0)
    const neg = x < 0;
    const ax = neg ? -x : x;
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, ax, false); // big-endian: byte 0..3 = hi, 4..7 = lo
    const hi = dv.getUint32(0, false);
    const lo = dv.getUint32(4, false);
    const E = (hi >>> 20) & 0x7ff;
    const frac = BigInt((hi & 0xfffff) * 4294967296 + lo);
    let m, e;
    if (E === 0) { m = frac; e = -1074; } // subnormal
    else { m = frac | (1n << 52n); e = E - 1075; }
    const N = m * (10n ** BigInt(digits));
    let k;
    if (e >= 0) {
      k = N << BigInt(e);
    } else {
      const D = 1n << BigInt(-e);
      const q = N / D, r = N % D, r2 = r * 2n;
      if (r2 > D) k = q + 1n;
      else if (r2 === D) k = (q % 2n === 0n) ? q : q + 1n; // nửa về chẵn
      else k = q;
    }
    const res = Number(k) / Math.pow(10, digits);
    return neg ? -res : res;
  }
  // str(float) của Python: số nguyên-giá-trị in "7.0" (JS String(7)="7" — SAI),
  // -0.0 in "-0.0"; còn lại shortest-roundtrip — String() trùng Python str.
  function pyFloatStr(x) {
    if (Number.isInteger(x)) {
      if (Object.is(x, -0)) return '-0.0';
      return x.toFixed(1);
    }
    return String(x);
  }
  function rngSrc() {
    return (typeof global.MDRandom !== 'undefined' && global.MDRandom) || Math;
  }
  function rf() { return rngSrc().random(); }
  // random.randint(a, b) — inclusive cả hai đầu
  function ri(a, b) { return Math.floor(rf() * (b - a + 1)) + a; }
  // random.choice(arr)
  function pick(arr) { return arr[Math.floor(rf() * arr.length)]; }
  // random.shuffle(arr) — Fisher-Yates in-place
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rf() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ---- question_generator.py:12-19 ----
  const QuestionType = {
    MULTIPLE_CHOICE: 'multiple_choice',
    FILL_BLANK: 'fill_blank',
    COMPARISON: 'comparison',
    TRUE_FALSE: 'true_false',
    SORTING: 'sorting',
    SEARCH: 'search',
    REFLEX: 'reflex'
  };

  // ---- question_generator.py:21-24 ----
  const Difficulty = { EASY: 1, MEDIUM: 2, HARD: 3 };

  // ---- question_generator.py:26-35 (@dataclass Question) ----
  class Question {
    constructor(question_text, options, correct_answer, hint, question_type, difficulty, grade, lesson_id) {
      this.question_text = question_text;
      this.options = options;
      this.correct_answer = correct_answer;
      this.hint = hint;
      this.question_type = question_type;
      this.difficulty = difficulty;
      this.grade = grade;
      this.lesson_id = lesson_id;
    }
  }

  // ---- question_generator.py:37-94 ----
  class AdaptiveDifficulty {
    constructor() {
      this.user_stats = {};
      this.base_difficulty = 0.5;
    }

    update_user_performance(user_id, correct, lesson_id) {
      if (!(user_id in this.user_stats)) {
        this.user_stats[user_id] = {
          total: 0, correct: 0, recent_streak: 0, lesson_performance: {}
        };
      }
      const stats = this.user_stats[user_id];
      stats.total += 1;
      if (correct) { stats.correct += 1; stats.recent_streak += 1; }
      else stats.recent_streak = 0;
      if (!(lesson_id in stats.lesson_performance)) {
        stats.lesson_performance[lesson_id] = { correct: 0, total: 0 };
      }
      stats.lesson_performance[lesson_id].total += 1;
      if (correct) stats.lesson_performance[lesson_id].correct += 1;
    }

    get_user_difficulty(user_id, lesson_id) {
      if (!(user_id in this.user_stats)) return this.base_difficulty;
      const stats = this.user_stats[user_id];
      if (stats.total === 0) return this.base_difficulty;
      const overall_accuracy = stats.correct / stats.total;
      let combined_accuracy;
      if (lesson_id && (lesson_id in stats.lesson_performance)) {
        const lesson_stats = stats.lesson_performance[lesson_id];
        if (lesson_stats.total >= 3) {
          const lesson_accuracy = lesson_stats.correct / lesson_stats.total;
          combined_accuracy = 0.7 * lesson_accuracy + 0.3 * overall_accuracy;
        } else {
          combined_accuracy = overall_accuracy;
        }
      } else {
        combined_accuracy = overall_accuracy;
      }
      const streak_bonus = Math.min(0.1, stats.recent_streak * 0.01);
      const difficulty = combined_accuracy + streak_bonus;
      return Math.min(1.0, Math.max(0.0, difficulty));
    }

    should_increase_difficulty(user_id) {
      if (!(user_id in this.user_stats)) return false;
      const stats = this.user_stats[user_id];
      return stats.recent_streak >= 5 && (stats.correct / stats.total) > 0.8;
    }
  }
  const adaptive_difficulty = new AdaptiveDifficulty();

  // ---- question_generator.py:98-227 ----
  class QuestionGenerator {
    constructor() {
      this.objects = ['quả cam', 'con mèo', 'con thỏ', 'quả táo', 'bông hoa', 'viên bi', 'cái kẹo', 'quyển vở', 'chiếc lá', 'chiếc bút'];
      this.names = ['Lan', 'Nam', 'Mai', 'Hoa', 'Tuấn', 'Minh', 'Việt', 'Mi', 'Rô-bốt'];
      this.question_cache = {};
      this.lesson_structure = {
        1: {
          count: 40,
          topics: {
            1: 'Các số 0, 1, 2, 3, 4, 5', 2: 'Các số 6, 7, 8, 9, 10',
            3: 'Nhiều hơn, ít hơn, bằng nhau', 4: 'So sánh số', 5: 'Mấy và mấy',
            6: 'Luyện tập chung', 7: 'Hình vuông, hình tròn, hình tam giác, hình chữ nhật',
            8: 'Thực hành lắp ghép, xếp hình', 9: 'Luyện tập chung',
            10: 'Phép cộng trong phạm vi 10', 11: 'Phép trừ trong phạm vi 10',
            12: 'Bảng cộng, bảng trừ trong phạm vi 10', 13: 'Luyện tập chung',
            14: 'Khối lập phương, khối hộp chữ nhật', 15: 'Vị trí, định hướng trong không gian',
            16: 'Luyện tập chung', 17: 'Ôn tập các số trong phạm vi 10',
            18: 'Ôn tập phép cộng, phép trừ trong phạm vi 10', 19: 'Ôn tập hình học',
            20: 'Ôn tập chung học kì 1', 21: 'Số có hai chữ số',
            22: 'So sánh số có hai chữ số', 23: 'Bảng các số từ 1 đến 100',
            24: 'Luyện tập chung', 25: 'Dài hơn, ngắn hơn', 26: 'Đơn vị đo độ dài (cm)',
            27: 'Luyện tập chung', 28: 'Phép cộng (không nhớ) trong phạm vi 100',
            29: 'Phép trừ (không nhớ) trong phạm vi 100',
            30: 'Phép cộng, trừ (không nhớ) trong phạm vi 100', 31: 'Luyện tập chung',
            32: 'Xem đồng hồ, thời gian', 33: 'Các ngày trong tuần', 34: 'Xem lịch',
            35: 'Luyện tập chung', 36: 'Ôn tập các số trong phạm vi 100',
            37: 'Ôn tập phép cộng, phép trừ', 38: 'Ôn tập hình học và đo lường',
            39: 'Luyện tập chung', 40: 'Ôn tập cuối năm'
          }
        }
      };
    }

    // question_generator.py:156-164
    get_lesson_info(grade, lesson_id) {
      if (!(grade in this.lesson_structure)) return null;
      const structure = this.lesson_structure[grade];
      if (lesson_id < 1 || lesson_id > structure.count) return null;
      return {
        grade: grade, lesson_id: lesson_id,
        topic: structure.topics[lesson_id] || ('Bài ' + lesson_id),
        total_lessons: structure.count
      };
    }

    // question_generator.py:166-178
    _mix_options(correct_ans, w1, w2, w3) {
      const opts = [String(correct_ans)];
      const isDigits = function (s) { return /^\d+$/.test(s); };
      [w1, w2, w3].forEach(function (w) {
        let cand = String(w);
        while (opts.indexOf(cand) >= 0 || cand === '') {
          if (isDigits(cand) || (cand.charAt(0) === '-' && isDigits(cand.slice(1)))) {
            cand = String(parseInt(cand, 10) + 1);
          } else {
            cand += ' ';
          }
        }
        opts.push(cand);
      });
      return shuffle(opts);
    }

    // question_generator.py:180-223
    generate_question(grade, lesson_id, difficulty, user_id) {
      const diff = difficulty || Difficulty.MEDIUM;
      let eff = diff;
      if (user_id) {
        const user_difficulty = adaptive_difficulty.get_user_difficulty(user_id, lesson_id);
        if (user_difficulty < 0.33) eff = Difficulty.EASY;
        else if (user_difficulty < 0.66) eff = Difficulty.MEDIUM;
        else eff = Difficulty.HARD;
      }

      const cache_key = grade + '_' + lesson_id + '_' + eff;
      if (!(cache_key in this.question_cache)) this.question_cache[cache_key] = [];

      const max_attempts = 5;
      for (let attempt = 0; attempt < max_attempts; attempt++) {
        let q;
        if (grade === 1) q = this._generate_grade_1_question(lesson_id, eff);
        else if (grade === 2) q = this._generate_grade_2_question(lesson_id, eff);
        else if (grade === 3) q = this._generate_grade_3_question(lesson_id, eff);
        else if (grade === 4) q = this._generate_grade_4_question(lesson_id, eff);
        else if (grade === 5) q = this._generate_grade_5_question(lesson_id, eff);
        else q = new Question('1 + 1 = ?', ['1', '2', '3', '4'], '2', 'Tính tổng', QuestionType.MULTIPLE_CHOICE, eff, grade, lesson_id);

        const q_signature = q.question_text + '_' + q.correct_answer;
        const recent_questions = this.question_cache[cache_key].slice(-5);
        const sigs = recent_questions.map(function (x) { return x.question_text + '_' + x.correct_answer; });
        if (sigs.indexOf(q_signature) < 0) {
          this.question_cache[cache_key].push(q);
          if (this.question_cache[cache_key].length > 20) this.question_cache[cache_key].shift();
          return q;
        }
      }

      if (this.question_cache[cache_key].length) {
        return pick(this.question_cache[cache_key]);
      }
      if (grade === 1) return this._generate_grade_1_question(lesson_id, eff);
      return new Question('1 + 1 = ?', ['1', '2', '3', '4'], '2', 'Tính tổng', QuestionType.MULTIPLE_CHOICE, eff, grade, lesson_id);
    }

    // question_generator.py:225-227
    record_answer(user_id, lesson_id, correct) {
      adaptive_difficulty.update_user_performance(user_id, correct, lesson_id);
    }

    // question_generator.py:506-517
    to_json(question) {
      return {
        question_text: question.question_text,
        options: question.options,
        correct_answer: question.correct_answer,
        hint: question.hint,
        question_type: question.question_type,
        difficulty: question.difficulty,
        grade: question.grade,
        lesson_id: question.lesson_id
      };
    }
  }

  // ---- question_generator.py:228-505 ----
  // Gắn vào prototype (file lớn, tách chunk để dễ review)
  Object.assign(QuestionGenerator.prototype, {

    // question_generator.py:228-231 — pick obj (6 objects) TRƯỚC name (rng sequence parity)
    _generate_grade_1_question(lesson_id, difficulty) {
      const obj = pick(['quả táo', 'con thỏ', 'bông hoa', 'viên bi', 'quyển vở', 'cái kẹo']);
      const name = pick(['Lan', 'Nam', 'Mai', 'Việt', 'Mi', 'Rô-bốt']);
      let q = '', ans = '', hint = '';
      let w1 = '', w2 = '', w3 = '';

      if ([1, 2, 6].indexOf(lesson_id) >= 0) {
        const n = ri(2, 8);
        q = `Số nào đứng ngay trước số ${n} khi ta đếm số?`;
        ans = String(n - 1);
        w1 = String(n + 1); w2 = String(n); w3 = '0';
        hint = 'Đếm ngược lại 1 số.';
      } else if (lesson_id === 3) {
        q = 'Nhóm 5 con thỏ và nhóm 3 củ cà rốt. Nhóm nào nhiều hơn?';
        ans = 'Nhóm con thỏ';
        w1 = 'Nhóm củ cà rốt'; w2 = 'Bằng nhau'; w3 = 'Không biết';
        hint = '5 lớn hơn 3 nên nhóm thỏ nhiều hơn.';
      } else if (lesson_id === 4) {
        let a = ri(0, 10), b = ri(0, 10);
        while (a === b) b = ri(0, 10);
        q = `Điền dấu thích hợp: ${a} ... ${b}`;
        ans = a > b ? '>' : '<';
        w1 = a > b ? '<' : '>'; w2 = '='; w3 = '+';
        hint = 'Số đếm sau lớn hơn số đếm trước.';
      } else if (lesson_id === 5) {
        const a = ri(1, 5), b = ri(1, 4);
        q = `Gộp ${a} và ${b} được mấy?`;
        ans = String(a + b);
        w1 = String(a + b + 1); w2 = String(Math.abs(a - b)); w3 = String(a + b - 1);
        hint = 'Đếm tổng cả hai nhóm lại với nhau.';
      } else if ([7, 8, 9].indexOf(lesson_id) >= 0) {
        q = 'Hình nào có 4 cạnh bằng nhau và 4 góc vuông?';
        ans = 'Hình vuông';
        w1 = 'Hình tam giác'; w2 = 'Hình tròn'; w3 = 'Hình chữ nhật';
        hint = 'Các cạnh của nó dài bằng nhau.';
      } else if (lesson_id === 10) {
        const a = ri(1, 6), b = ri(1, 9 - a);
        q = `Tính: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = String(a + b + 1); w2 = String(Math.abs(a - b)); w3 = String(a + b - 1);
        hint = `Đưa ra ${a} ngón tay, bung thêm ${b} ngón tay.`;
      } else if (lesson_id === 11) {
        const a = ri(5, 10), b = ri(1, a - 1);
        q = `Tính: ${a} - ${b} = ?`;
        ans = String(a - b);
        w1 = String(a - b + 1); w2 = String(a - b - 1); w3 = String(a + b);
        hint = `Có ${a}, cất đi ${b} thì còn lại mấy?`;
      } else if (lesson_id === 12) {
        const a = ri(3, 8);
        q = `Điền số thích hợp: ${a} + ... = 10`;
        ans = String(10 - a);
        w1 = String(10 - a + 1); w2 = String(10 - a - 1); w3 = String(a);
        hint = `Đếm tiếp từ ${a} đến 10 xem cần mấy ngón tay.`;
      } else if (lesson_id === 13) {
        const a = ri(6, 10), b = ri(1, a - 2);
        q = `${name} có ${a} cái kẹo, ăn mất ${b} cái. ${name} còn lại mấy cái kẹo?`;
        ans = String(a - b);
        w1 = String(a + b); w2 = String(a - b + 1); w3 = String(a - b - 1);
        hint = 'Ăn mất nghĩa là bớt đi, ta làm phép trừ.';
      } else if (lesson_id === 14) {
        q = 'Cục Rubik là đồ vật có dạng khối gì?';
        ans = 'Khối lập phương';
        w1 = 'Khối hộp chữ nhật'; w2 = 'Khối cầu'; w3 = 'Khối trụ';
        hint = 'Tất cả các mặt của cục Rubik đều là hình vuông.';
      } else if (lesson_id === 15) {
        q = 'Khi đi bộ trên đường, chúng ta nên đi ở phía bên nào?';
        ans = 'Bên phải';
        w1 = 'Bên trái'; w2 = 'Ở giữa đường'; w3 = 'Phía sau';
        hint = 'Đây là quy định an toàn giao thông.';
      } else if (lesson_id === 16) {
        q = 'Nếu cầm đũa bằng tay phải, thì bát cơm thường được cầm bằng tay nào?';
        ans = 'Tay trái';
        w1 = 'Tay phải'; w2 = 'Cả hai tay'; w3 = 'Không dùng tay';
        hint = 'Một tay gắp thức ăn, tay còn lại đỡ bát cơm.';
      } else if (lesson_id === 17) {
        const n = ri(1, 8);
        q = `Các số được sắp xếp theo thứ tự từ bé đến lớn: ${n}, ${n + 1}, ..., ${n + 3}. Số bị thiếu là?`;
        ans = String(n + 2);
        w1 = String(n); w2 = String(n + 4); w3 = String(n - 1);
        hint = `Đếm tiến lên: ${n}, ${n + 1} rồi đến số mấy?`;
      } else if (lesson_id === 18) {
        const a = ri(1, 5), b = ri(1, 4);
        q = `Tính nhẩm: ${a} + ${b} - 1 = ?`;
        ans = String(a + b - 1);
        w1 = String(a + b); w2 = String(a + b + 1); w3 = String(a + b - 2);
        hint = 'Tính từ trái sang phải.';
      } else if (lesson_id === 19) {
        q = 'Quyển sách Toán lớp 1 có mặt trước dạng hình gì?';
        ans = 'Hình chữ nhật';
        w1 = 'Hình vuông'; w2 = 'Hình tam giác'; w3 = 'Hình tròn';
        hint = 'Sách có hai cạnh dài và hai cạnh ngắn.';
      } else if (lesson_id === 20) {
        const a = ri(5, 9), b = ri(1, 4);
        q = `Kết quả của phép tính ${a} - ${b} là:`;
        ans = String(a - b);
        w1 = String(a - b + 1); w2 = String(a + b); w3 = String(a - b - 1);
        hint = 'Đây là bài kiểm tra cuối kì, hãy tính cẩn thận.';
      } else if (lesson_id === 21) {
        const chuc = ri(2, 9);
        q = `Số gồm ${chuc} chục và 0 đơn vị viết là:`;
        ans = `${chuc}0`;
        w1 = `${chuc}`; w2 = `${chuc}1`; w3 = `1${chuc}`;
        hint = 'Viết chữ số hàng chục rồi thêm số 0 ở hàng đơn vị.';
      } else if (lesson_id === 22) {
        const a = ri(20, 50), b = ri(60, 99);
        q = `Điền dấu: ${a} ... ${b}`;
        ans = '<';
        w1 = '>'; w2 = '='; w3 = '+';
        hint = 'So sánh chữ số hàng chục trước.';
      } else if (lesson_id === 23) {
        const n = ri(40, 80);
        q = `Số liền trước của ${n} là:`;
        ans = String(n - 1);
        w1 = String(n + 1); w2 = String(n - 10); w3 = String(n + 10);
        hint = 'Đếm lùi lại 1 đơn vị.';
      } else if (lesson_id === 24) {
        q = 'Số lớn nhất có 2 chữ số là số nào?';
        ans = '99';
        w1 = '100'; w2 = '98'; w3 = '90';
        hint = 'Đó là số ngay trước số 100.';
      } else if (lesson_id === 25) {
        q = 'Cái bút chì của em so với quyển vở thì như thế nào?';
        ans = 'Ngắn hơn';
        w1 = 'Dài hơn'; w2 = 'Bằng nhau'; w3 = 'Cao hơn';
        hint = 'Em thường để lọt bút chì vào trong hộp bút hoặc vở.';
      } else if (lesson_id === 26) {
        const a = ri(3, 10);
        q = `Băng giấy dài ${a} cm. Cắt đi 2 cm thì còn lại mấy xăng-ti-mét?`;
        ans = `${a - 2} cm`;
        w1 = `${a + 2} cm`; w2 = `${a} cm`; w3 = `${a - 1} cm`;
        hint = 'Cắt đi nghĩa là làm phép trừ.';
      } else if (lesson_id === 27) {
        q = 'Dụng cụ nào dùng để kẻ đoạn thẳng dài 5 cm?';
        ans = 'Thước có chia vạch cm';
        w1 = 'Com-pa'; w2 = 'Cái cân'; w3 = 'Đồng hồ';
        hint = 'Cần thước có các vạch số.';
      } else if (lesson_id === 28) {
        const ao = ri(1, 5), at = ri(1, 7);
        const bo = ri(1, 9 - ao), bt = ri(1, 8 - at);
        const a = at * 10 + ao, b = bt * 10 + bo;
        q = `Tính: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = String(a + b + 10); w2 = String(a + b - 10); w3 = String(a + b + 1);
        hint = 'Cộng đơn vị với đơn vị, chục với chục.';
      } else if (lesson_id === 29) {
        const at = ri(3, 9), ao = ri(3, 9);
        const bt = ri(1, at - 1), bo = ri(1, ao);
        const a = at * 10 + ao, b = bt * 10 + bo;
        q = `Tính: ${a} - ${b} = ?`;
        ans = String(a - b);
        w1 = String(a - b + 10); w2 = String(a - b - 10); w3 = String(a - b + 1);
        hint = 'Trừ đơn vị cho đơn vị, chục cho chục.';
      } else if (lesson_id === 30) {
        const a = ri(2, 5) * 10, b = ri(1, 4) * 10;
        q = `Tính nhẩm: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = String(a + b + 10); w2 = String(Math.abs(a - b)); w3 = String(a + b - 10);
        hint = `Lấy ${a / 10} chục cộng ${b / 10} chục.`;
      } else if (lesson_id === 31) {
        const ao = ri(2, 8), bo = ri(1, 9 - ao);
        const a = 30 + ao, b = 20 + bo;
        q = `Kết quả của ${a} + ${b} là:`;
        ans = String(a + b);
        w1 = String(a + b + 1); w2 = String(a + b - 10); w3 = String(a + b + 10);
        hint = 'Đặt tính thẳng cột rồi tính.';
      } else if (lesson_id === 32) {
        const h = ri(1, 12);
        q = `Kim ngắn chỉ số ${h}, kim dài chỉ số 12. Bây giờ là mấy giờ?`;
        ans = `${h} giờ`;
        w1 = `${h + 1} giờ`; w2 = '12 giờ'; w3 = h > 1 ? `${h - 1} giờ` : '11 giờ';
        hint = 'Kim ngắn (kim giờ) chỉ vào số nào thì là giờ đó.';
      } else if (lesson_id === 33) {
        q = 'Hôm nay là Thứ Tư. Ngày mai là thứ mấy?';
        ans = 'Thứ Năm';
        w1 = 'Thứ Ba'; w2 = 'Thứ Sáu'; w3 = 'Thứ Hai';
        hint = 'Sau Thứ Tư là ngày nào?';
      } else if (lesson_id === 34) {
        q = 'Các ngày nghỉ cuối tuần thường là ngày nào?';
        ans = 'Thứ Bảy, Chủ Nhật';
        w1 = 'Thứ Hai, Thứ Ba'; w2 = 'Thứ Sáu, Thứ Bảy'; w3 = 'Chủ Nhật, Thứ Hai';
        hint = 'Ngày em không phải đi học.';
      } else if (lesson_id === 35) {
        q = 'Lúc 12 giờ trưa, hai kim đồng hồ (kim giờ và kim phút) nằm ở đâu?';
        ans = 'Cùng chỉ vào số 12';
        w1 = 'Chỉ số 6 và 12'; w2 = 'Chỉ số 3 và 9'; w3 = 'Chỉ số 1 và 12';
        hint = '12 giờ đúng thì kim dài và kim ngắn chập lại.';
      } else if (lesson_id === 36) {
        const n = ri(50, 90);
        q = `Số ${n} gồm mấy chục và mấy đơn vị?`;
        ans = `${Math.floor(n / 10)} chục và ${n % 10} đơn vị`;
        w1 = `${n % 10} chục và ${Math.floor(n / 10)} đơn vị`; w2 = `${Math.floor(n / 10)} chục`; w3 = `${n} chục`;
        hint = 'Phân tích cấu tạo số từ trái qua phải.';
      } else if (lesson_id === 37) {
        const a = ri(40, 80), b = ri(1, 9);
        q = `Tính nhẩm: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = String(a + b + 10); w2 = String(a + b - 1); w3 = String(a);
        hint = 'Cộng số đơn vị vào nhau.';
      } else if (lesson_id === 38) {
        q = 'Vật nào sau đây dùng để xem giờ?';
        ans = 'Đồng hồ';
        w1 = 'Cái cân'; w2 = 'Thước kẻ'; w3 = 'Quyển sách';
        hint = 'Vật có kim chỉ số hoặc hiện số giờ.';
      } else if ([39, 40].indexOf(lesson_id) >= 0) {
        const ao = ri(5, 9), at = ri(5, 9);
        const b = ri(1, ao);
        const a = at * 10 + ao;
        q = `Ôn tập: ${a} - ${b} = ?`;
        ans = String(a - b);
        w1 = String(a - b + 10); w2 = String(a - b - 10); w3 = String(a + b);
        hint = 'Tính cẩn thận không có nhớ.';
      } else if (lesson_id === 41) {
        const n = ri(20, 80);
        q = `Bài thi cuối kì: Số liền sau của ${n} lớn hơn số liền trước của ${n} mấy đơn vị?`;
        ans = '2 đơn vị';
        w1 = '1 đơn vị'; w2 = '3 đơn vị'; w3 = 'Bằng nhau';
        hint = `Số liền sau là ${n + 1}, số liền trước là ${n - 1}. Lấy ${n + 1} trừ đi ${n - 1}.`;
      } else {
        q = `Tính nhanh: ${lesson_id} - 1 = ?`;
        ans = String(lesson_id - 1);
        w1 = String(lesson_id); w2 = String(lesson_id + 1); w3 = '0';
        hint = 'Lùi lại 1 đơn vị.';
      }

      const opts = this._mix_options(ans, w1, w2, w3);
      return new Question(q, opts.slice(0, 4), ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 1, lesson_id);
    },
    _generate_grade_2_question(lesson_id, difficulty) {
      const obj = pick(this.objects);
      const name = pick(this.names);
      let q = '', ans = '', hint = '';
      let w1 = '', w2 = '', w3 = '';

      if (lesson_id === 1) {
        const val = ri(20, 99);
        if (rf() < 0.5) {
          q = `Số ${val} gồm mấy chục và mấy đơn vị?`;
          ans = `${Math.floor(val / 10)} chục ${val % 10} đơn vị`;
          w1 = `${val % 10} chục ${Math.floor(val / 10)} đơn vị`;
          w2 = `${Math.floor(val / 10)} chục`; w3 = `${val % 10} đơn vị`;
          hint = 'Chữ số phía trước là hàng chục, phía sau là hàng đơn vị.';
        } else {
          q = `Số gồm ${Math.floor(val / 10)} chục và ${val % 10} đơn vị được viết là:`;
          ans = String(val);
          w1 = `${val % 10}${Math.floor(val / 10)}`; w2 = String(val + 10); w3 = String(val - 10);
          hint = 'Ghép chữ số hàng chục và hàng đơn vị lại với nhau.';
        }
      } else if (lesson_id === 2) {
        const n = ri(10, 90);
        if (rf() < 0.5) { q = `Trên tia số, số liền sau của ${n} là số nào?`; ans = String(n + 1); }
        else { q = `Trên tia số, số liền trước của ${n} là số nào?`; ans = String(n - 1); }
        w1 = String(n); w2 = String(n + 2); w3 = String(n - 2);
        hint = 'Số liền trước trừ đi 1, số liền sau cộng thêm 1.';
      } else if (lesson_id === 3) {
        let a = ri(10, 40), b = ri(10, 40);
        if (rf() < 0.5) {
          q = `Trong phép tính ${a} + ${b} = ${a + b}, số ${a} được gọi là gì?`; ans = 'Số hạng';
          w1 = 'Tổng'; w2 = 'Số bị trừ'; w3 = 'Hiệu';
        } else {
          while (a < b) { const t = a; a = b; b = t; }
          q = `Trong phép tính ${a} - ${b} = ${a - b}, số ${a} được gọi là gì?`; ans = 'Số bị trừ';
          w1 = 'Số trừ'; w2 = 'Hiệu'; w3 = 'Số hạng';
        }
        hint = "Phép cộng có 'Số hạng' và 'Tổng'. Phép trừ có 'Số bị trừ', 'Số trừ' và 'Hiệu'.";
      } else if (lesson_id === 4) {
        const a = ri(20, 50), b = ri(5, 15);
        q = `Lớp 2A có ${a} bạn, lớp 2B có ${a - b} bạn. Lớp 2A nhiều hơn lớp 2B bao nhiêu bạn?`;
        ans = `${b} bạn`;
        w1 = `${b + 2} bạn`; w2 = `${b - 2} bạn`; w3 = `${a} bạn`;
        hint = 'Lấy số lớn trừ đi số bé để tìm phần hơn kém.';
      } else if ([5, 6].indexOf(lesson_id) >= 0) {
        const a = ri(2, 8) * 10 + ri(5, 9);
        const b = ri(1, a / 10) * 10 + ri(1, a % 10);
        if (rf() < 0.5) {
          const val = ri(1, 9 - a % 10);
          q = `Tính nhẩm: ${a} + ${val} = ?`; ans = String(a + val);
        } else {
          q = `Tính: ${a} - ${b} = ?`; ans = String(a - b);
        }
        w1 = String(parseInt(ans, 10) + 10); w2 = String(parseInt(ans, 10) - 10); w3 = String(parseInt(ans, 10) + 1);
        hint = 'Cộng/trừ hàng đơn vị với đơn vị, chục với chục.';
      } else if ([7, 8, 10].indexOf(lesson_id) >= 0) {
        const a = ri(5, 9); const b = ri(11 - a, 9);
        ans = String(a + b);
        q = `Tính: ${a} + ${b} = ?`;
        w1 = String(parseInt(ans, 10) + 1); w2 = String(parseInt(ans, 10) - 1); w3 = String(parseInt(ans, 10) + 10);
        hint = `Tách ${b} thành (${10 - a}) và ${b - (10 - a)} để tạo thành 10 rồi cộng phần còn lại.`;
      } else if (lesson_id === 9) {
        const a = ri(5, 15), b = ri(2, 8);
        if (rf() < 0.5) {
          q = `Trên sân có ${a} bạn, thêm ${b} bạn chạy tới. Có tất cả bao nhiêu bạn?`; ans = String(a + b);
        } else {
          q = `Trong rổ có ${a + b} ${obj}, lấy ra ${b} ${obj}. Còn lại mấy ${obj}?`; ans = String(a);
        }
        w1 = String(parseInt(ans, 10) + 1); w2 = String(Math.max(0, parseInt(ans, 10) - 1)); w3 = String(parseInt(ans, 10) + 2);
        hint = 'Thêm vào thì dùng phép cộng, bớt đi thì dùng phép trừ.';
      } else if ([11, 12, 14].indexOf(lesson_id) >= 0) {
        const a = ri(11, 18); const b = ri(a % 10 + 1, 9);
        ans = String(a - b);
        q = `Tính: ${a} - ${b} = ?`;
        w1 = String(parseInt(ans, 10) + 1); w2 = String(parseInt(ans, 10) - 1); w3 = String(parseInt(ans, 10) + 10);
        hint = 'Trừ để được 10 rồi trừ tiếp phần còn lại.';
      } else if (lesson_id === 13) {
        const a = ri(15, 30), b = ri(5, 12);
        if (rf() < 0.5) {
          q = `${name} có ${a} viên bi, Rô-bốt có nhiều hơn ${name} ${b} viên. Hỏi Rô-bốt có bao nhiêu viên bi?`;
          ans = String(a + b);
        } else {
          q = `Thùng đỏ có ${a} lít nước, thùng xanh có ít hơn thùng đỏ ${b} lít. Thùng xanh có bao nhiêu lít?`;
          ans = String(a - b);
        }
        w1 = String(parseInt(ans, 10) + b); w2 = String(parseInt(ans, 10) - b); w3 = String(a);
        hint = 'Nhiều hơn dùng phép cộng, ít hơn dùng phép trừ.';
      } else if (lesson_id === 15) {
        const a = ri(5, 30), b = ri(2, 10);
        q = `Bao gạo nặng ${a} kg, túi đường nặng ${b} kg. Cả hai nặng bao nhiêu?`;
        ans = `${a + b} kg`;
        w1 = `${a - b} kg`; w2 = `${a + b + 1} kg`; w3 = `${a + b} lít`;
        hint = 'Cộng các số đo khối lượng lại với nhau.';
      } else if (lesson_id === 16) {
        const a = ri(10, 40), b = ri(5, 20);
        q = `Can to chứa ${a} l nước, dùng hết ${b} l. Còn lại bao nhiêu?`;
        ans = `${a - b} l`;
        w1 = `${a + b} l`; w2 = `${a - b + 1} l`; w3 = `${a - b} kg`;
        hint = 'Trừ đi phần nước đã sử dụng.';
      } else if ([17, 18].indexOf(lesson_id) >= 0) {
        if (rf() < 0.5) {
          q = 'Đơn vị nào dùng để đo lượng nước trong chai?'; ans = 'lít (l)';
          w1 = 'ki-lô-gam (kg)'; w2 = 'xăng-ti-mét (cm)'; w3 = 'giờ';
        } else {
          q = 'Đơn vị nào dùng để cân quả dưa hấu?'; ans = 'ki-lô-gam (kg)';
          w1 = 'lít (l)'; w2 = 'mét (m)'; w3 = 'ngày';
        }
        hint = 'Chất lỏng đo bằng lít, vật nặng đo bằng ki-lô-gam.';
      } else if ([19, 20, 21].indexOf(lesson_id) >= 0) {
        // question_generator.py:646-652 — KNOWN_PYTHON_INFINITE_LOOP (PYTHON BUG BACKLOG):
        // Python treo vo han khi a%10==0 vi (a%10 + b%10) < 10 luon dung (0 + max 9 < 10).
        // SAFETY_GUARD: guard iteration cuc bo KHONG tieu RNG draw o duong binh thuong
        // (parity giu nguyen cho moi truong hop Python ket thuc). Guard cham nguong
        // → ve lai CA a (hanh vi hau-treo khong dinh nghia trong Python) → retry <= 50.
        let a = 0, b = 0, valid = false, guardHit = false;
        for (let attempt = 0; attempt < 50 && !valid; attempt++) {
          a = ri(15, 75); b = ri(5, 89 - a);
          let guard = 0;
          while (a % 10 + b % 10 < 10 && ++guard <= 5000) b = ri(5, 89 - a);
          valid = a % 10 + b % 10 >= 10;
          if (!valid) guardHit = true;
        }
        if (guardHit) {
          L.warn('[QuestionGenerator] SAFETY_GUARD triggered grade=2 lesson_id=' + lesson_id +
            ' generator=cong_co_nho (py:646-652) — truong hop a%10==0 (Python would loop forever); redrawing a. KNOWN_PYTHON_INFINITE_LOOP, PYTHON BUG BACKLOG.');
        }
        if (!valid) { a = 27; b = 48; } // fallback tinh hop le (7+8>=10) — khong bao gio toi trong thuc te
        ans = String(a + b);
        q = `Đặt tính rồi tính: ${a} + ${b} = ?`;
        w1 = String(parseInt(ans, 10) - 10); w2 = String(parseInt(ans, 10) + 10); w3 = String(parseInt(ans, 10) + 1);
        hint = 'Cộng hàng đơn vị, nếu bằng 10 trở lên thì viết đơn vị, nhớ 1 sang hàng chục.';
      } else if ([22, 23, 24].indexOf(lesson_id) >= 0) {
        // question_generator.py:654-660 — KNOWN_PYTHON_INFINITE_LOOP (PYTHON BUG BACKLOG):
        // Python treo vo han khi a%10==9 vi can b%10 > 9. SAFETY_GUARD nhu bai 19-21.
        let a = 0, b = 0, valid = false, guardHit = false;
        for (let attempt = 0; attempt < 50 && !valid; attempt++) {
          a = ri(30, 95); b = ri(8, a - 1);
          let guard = 0;
          while (a % 10 >= b % 10 && ++guard <= 5000) b = ri(8, a - 1);
          valid = a % 10 < b % 10;
          if (!valid) guardHit = true;
        }
        if (guardHit) {
          L.warn('[QuestionGenerator] SAFETY_GUARD triggered grade=2 lesson_id=' + lesson_id +
            ' generator=tru_co_muon (py:654-660) — truong hop a%10==9 (Python would loop forever); redrawing a. KNOWN_PYTHON_INFINITE_LOOP, PYTHON BUG BACKLOG.');
        }
        if (!valid) { a = 35; b = 17; } // fallback tinh hop le (5 < 7 → co muon) — khong bao gio toi
        ans = String(a - b);
        q = `Tìm hiệu của ${a} và ${b}:`;
        w1 = String(parseInt(ans, 10) + 10); w2 = String(parseInt(ans, 10) - 10); w3 = String(parseInt(ans, 10) - 1);
        hint = 'Hàng đơn vị không trừ được, mượn 1 chục rồi trừ, sau đó nhớ trả 1 vào hàng chục của số trừ.';
      } else if (lesson_id === 25) {
        q = 'Ba điểm cùng nằm trên một đường thẳng được gọi là gì?';
        ans = 'Ba điểm thẳng hàng';
        w1 = 'Ba điểm cong'; w2 = 'Ba điểm tam giác'; w3 = 'Ba điểm bất kì';
        hint = 'Hãy nhớ lại hình ảnh dùng thước kẻ vạch một đường thẳng qua 3 điểm.';
      } else if (lesson_id === 26) {
        const a = ri(2, 5), b = ri(2, 5), c = ri(2, 5);
        q = `Đường gấp khúc gồm 3 đoạn thẳng dài ${a}cm, ${b}cm, ${c}cm. Độ dài đường gấp khúc là?`;
        ans = `${a + b + c} cm`;
        w1 = `${a + b} cm`; w2 = `${b + c} cm`; w3 = `${a + b + c + 1} cm`;
        hint = 'Độ dài đường gấp khúc bằng tổng độ dài các đoạn thẳng cộng lại.';
      } else if ([27, 28].indexOf(lesson_id) >= 0) {
        q = 'Hình nào có 4 cạnh và 4 đỉnh?';
        ans = 'Hình tứ giác';
        w1 = 'Hình tam giác'; w2 = 'Hình tròn'; w3 = 'Đường gấp khúc';
        hint = 'Tứ nghĩa là 4.';
      } else if (lesson_id === 29) {
        if (rf() < 0.5) {
          q = 'Một ngày có bao nhiêu giờ?'; ans = '24 giờ';
          w1 = '12 giờ'; w2 = '60 giờ'; w3 = '7 ngày';
        } else {
          q = '1 giờ bằng bao nhiêu phút?'; ans = '60 phút';
          w1 = '30 phút'; w2 = '24 phút'; w3 = '100 phút';
        }
        hint = 'Ghi nhớ quy tắc thời gian trên mặt đồng hồ.';
      } else if ([30, 31, 32].indexOf(lesson_id) >= 0) {
        const m = ri(1, 12);
        q = `Tháng ${m} có bao nhiêu ngày?`;
        if ([1, 3, 5, 7, 8, 10, 12].indexOf(m) >= 0) ans = '31 ngày';
        else if (m === 2) ans = '28 hoặc 29 ngày';
        else ans = '30 ngày';
        w1 = '31 ngày'; w2 = '30 ngày'; w3 = '28 hoặc 29 ngày';
        if (ans === w1) w1 = '32 ngày';
        if (ans === w2) w2 = '27 ngày';
        if (ans === w3) w3 = '25 ngày';
        hint = 'Sử dụng quy tắc nắm tay để tính số ngày trong tháng.';
      } else if (lesson_id >= 33 && lesson_id <= 36) {
        const t = pick(['tinhtoan', 'hinhhoc', 'thoigian']);
        if (t === 'tinhtoan') {
          const a = ri(30, 90); const b = ri(15, 25);
          q = `Ôn tập: ${a} - ${b} = ?`; ans = String(a - b);
          w1 = String(parseInt(ans, 10) + 10); w2 = String(parseInt(ans, 10) - 10); w3 = String(parseInt(ans, 10) + 1);
        } else if (t === 'hinhhoc') {
          q = 'Hình có 3 cạnh gọi là hình gì?'; ans = 'Hình tam giác';
          w1 = 'Hình tứ giác'; w2 = 'Hình vuông'; w3 = 'Hình chữ nhật';
        } else {
          q = 'Đơn vị đo khối lượng là gì?'; ans = 'kg';
          w1 = 'lít'; w2 = 'cm'; w3 = 'giờ';
        }
        hint = 'Đọc kỹ câu hỏi để nhớ lại kiến thức Học kì 1.';
      } else if (lesson_id === 37) {
        const a = ri(2, 5); const b = ri(2, 4);
        const tong = new Array(b).fill(String(a)).join(' + ');
        q = `Chuyển tổng sau thành phép nhân: ${tong} = ?`;
        ans = `${a} x ${b}`;
        w1 = `${a} x ${b + 1}`; w2 = `${b} x ${a}`; w3 = `${a} + ${b}`;
        hint = `Số ${a} được lấy ${b} lần.`;
      } else if (lesson_id === 38) {
        const a = pick([2, 5]); const b = ri(1, 10);
        q = `Trong phép tính ${a} x ${b} = ${a * b}, số ${a * b} được gọi là gì?`;
        ans = 'Tích';
        w1 = 'Thừa số'; w2 = 'Tổng'; w3 = 'Số bị chia';
        hint = 'Kết quả của phép nhân gọi là Tích.';
      } else if (lesson_id === 39) {
        const b = ri(1, 10);
        q = `Tính nhẩm: 2 x ${b} = ?`;
        ans = String(2 * b);
        w1 = String(2 * b + 2); w2 = String(2 * b - 2); w3 = String(2 * b + 1);
        hint = 'Đếm thêm 2 hoặc cộng 2 nhiều lần.';
      } else if (lesson_id === 40) {
        const b = ri(1, 10);
        q = `Mỗi bàn tay có 5 ngón tay. Hỏi ${b} bàn tay có bao nhiêu ngón tay?`;
        ans = String(5 * b);
        w1 = String(5 * b + 5); w2 = String(5 * b - 5); w3 = '10';
        hint = 'Sử dụng bảng nhân 5: đếm thêm 5.';
      } else if (lesson_id === 41) {
        const a = pick([2, 5]); const b = ri(1, 5);
        q = `Có ${a * b} quả cam chia đều vào ${a} đĩa. Mỗi đĩa có mấy quả?`;
        ans = String(b);
        w1 = String(b + 1); w2 = String(b + 2); w3 = String(a);
        hint = 'Dựa vào phép nhân tương ứng để tìm kết quả phép chia.';
      } else if (lesson_id === 42) {
        q = 'Trong phép tính 10 : 2 = 5, số 2 được gọi là gì?';
        ans = 'Số chia';
        w1 = 'Số bị chia'; w2 = 'Thương'; w3 = 'Số hạng';
        hint = 'Số bị chia đứng trước, số chia đứng sau dấu chia.';
      } else if (lesson_id === 43) {
        const b = ri(1, 10);
        q = `Tính: ${2 * b} : 2 = ?`;
        ans = String(b);
        w1 = String(b + 1); w2 = String(Math.abs(b - 1)); w3 = '2';
        hint = 'Nhẩm xem 2 nhân mấy thì bằng Số bị chia.';
      } else if (lesson_id === 44) {
        const b = ri(1, 10);
        q = `Tính: ${5 * b} : 5 = ?`;
        ans = String(b);
        w1 = String(b + 1); w2 = String(Math.abs(b - 1)); w3 = '5';
        hint = 'Nhẩm xem 5 nhân mấy thì bằng Số bị chia.';
      } else if (lesson_id === 45) {
        if (rf() < 0.5) {
          const a = pick([2, 5]); const b = ri(1, 10);
          q = `Tính: ${a} x ${b} = ?`; ans = String(a * b);
        } else {
          const a = pick([2, 5]); const b = ri(1, 10);
          q = `Tính: ${a * b} : ${a} = ?`; ans = String(b);
        }
        w1 = String(parseInt(ans, 10) + 1); w2 = String(Math.abs(parseInt(ans, 10) - 1)); w3 = String(parseInt(ans, 10) + 2);
        hint = 'Ôn tập mối quan hệ giữa phép nhân và phép chia.';
      } else if (lesson_id === 46) {
        const items = { 'Hộp sữa đặc': 'Khối trụ', 'Quả bóng đá': 'Khối cầu', 'Lon nước ngọt': 'Khối trụ', 'Viên bi': 'Khối cầu' };
        const item = pick(Object.keys(items));
        ans = items[item];
        q = `Vật '${item}' có dạng hình khối nào?`;
        w1 = 'Khối lập phương'; w2 = 'Khối hộp chữ nhật'; w3 = 'Hình tròn';
        hint = 'Khối trụ có hai mặt đáy hình tròn, khối cầu thì tròn xoe lăn được.';
      } else if (lesson_id === 47) {
        q = 'Khối nào có hai mặt phẳng ở hai đầu hình tròn?';
        ans = 'Khối trụ';
        w1 = 'Khối cầu'; w2 = 'Khối lập phương'; w3 = 'Khối hộp chữ nhật';
        hint = 'Nhớ lại hình dáng của một chiếc cột hoặc hộp sữa.';
      } else if (lesson_id === 48) {
        q = '10 trăm bằng bao nhiêu?';
        ans = '1 nghìn';
        w1 = '1 trăm'; w2 = '10 chục'; w3 = '10 nghìn';
        hint = 'Quy luật: 10 đơn vị = 1 chục, 10 chục = 1 trăm, 10 trăm = ...';
      } else if ([49, 50, 51].indexOf(lesson_id) >= 0) {
        const tram = ri(1, 9), chuc = ri(0, 9), donvi = ri(0, 9);
        const val = tram * 100 + chuc * 10 + donvi;
        q = `Số gồm ${tram} trăm, ${chuc} chục và ${donvi} đơn vị là số nào?`;
        ans = String(val);
        w1 = `${chuc}${tram}${donvi}`; w2 = `${tram}${donvi}${chuc}`; w3 = String(val + 10);
        hint = 'Ghép lần lượt hàng trăm, hàng chục, hàng đơn vị.';
      } else if ([52, 53].indexOf(lesson_id) >= 0) {
        let a = ri(100, 999), b = ri(100, 999);
        while (a === b) b = ri(100, 999);
        ans = a > b ? '>' : '<';
        q = `Điền dấu thích hợp: ${a} ... ${b}`;
        w1 = '>'; w2 = '<'; w3 = '=';
        hint = 'So sánh từ hàng trăm, rồi đến hàng chục, hàng đơn vị.';
      } else if (lesson_id === 54) {
        q = '1 mét bằng bao nhiêu xăng-ti-mét?';
        ans = '100 cm';
        w1 = '10 cm'; w2 = '1000 cm'; w3 = '50 cm';
        hint = '1 m = 100 cm.';
      } else if (lesson_id === 55) {
        q = '1 kilômét bằng bao nhiêu mét?';
        ans = '1000 m';
        w1 = '100 m'; w2 = '10000 m'; w3 = '10 m';
        hint = '1 km = 1000 m.';
      } else if (lesson_id === 56) {
        q = '1 xăng-ti-mét bằng bao nhiêu mi-li-mét?';
        ans = '10 mm';
        w1 = '100 mm'; w2 = '1 mm'; w3 = '5 mm';
        hint = '1 cm = 10 mm.';
      } else if ([57, 58, 59].indexOf(lesson_id) >= 0) {
        q = 'Trong các đơn vị đo độ dài sau, đơn vị nào lớn nhất?';
        ans = 'km';
        w1 = 'm'; w2 = 'cm'; w3 = 'mm';
        hint = 'Sắp xếp: mm < cm < m < km.';
      } else if ([60, 61].indexOf(lesson_id) >= 0) {
        const a = ri(1, 8) * 100 + ri(1, 8) * 10 + ri(1, 8);
        const b = ri(1, 9 - a / 100) * 100 + ri(1, 9 - Math.floor(a % 100 / 10)) * 10 + ri(1, 9 - a % 10);
        q = `Tính: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = String(a + b + 10); w2 = String(a + b - 100); w3 = String(a + b + 1);
        hint = 'Cộng lần lượt hàng đơn vị, hàng chục, hàng trăm.';
      } else if ([62, 63, 64, 65].indexOf(lesson_id) >= 0) {
        // question_generator.py:871-880 — KNOWN_PYTHON_INFINITE_LOOP (PYTHON BUG BACKLOG):
        // nhanh cong treo vo han khi a%10==0, nhanh tru treo khi a%10==9. SAFETY_GUARD nhu grade 2.
        // Thu tu draw o duong binh thuong giu nguyen Python: a, b, choice, roi redraw b.
        let a = 0, b = 0, add = true, done = false, guardHit = false;
        for (let attempt = 0; attempt < 50 && !done; attempt++) {
          a = ri(100, 900); b = ri(10, 100);
          add = rf() < 0.5; // == random.choice([True, False]) — 1 draw
          let guard = 0;
          if (add) {
            while (a % 10 + b % 10 < 10 && ++guard <= 5000) b = ri(10, 100);
            done = a % 10 + b % 10 >= 10;
          } else {
            while (a % 10 >= b % 10 && ++guard <= 5000) b = ri(10, 100);
            done = a % 10 < b % 10;
          }
          if (!done) guardHit = true;
        }
        if (guardHit) {
          L.warn('[QuestionGenerator] SAFETY_GUARD triggered grade=2 lesson_id=' + lesson_id +
            ' generator=cong_tru_co_nho (py:871-880) — unsatisfiable loop case; redrawing a. KNOWN_PYTHON_INFINITE_LOOP, PYTHON BUG BACKLOG.');
        }
        if (!done) { a = 256; b = 78; add = true; } // fallback tinh hop le (6+8>=10) — khong bao gio toi
        if (add) {
          q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
        } else {
          q = `Tính: ${a} - ${b} = ?`; ans = String(a - b);
        }
        w1 = String(parseInt(ans, 10) + 10); w2 = String(parseInt(ans, 10) - 10); w3 = String(parseInt(ans, 10) + 100);
        hint = 'Chú ý việc nhớ/mượn sang hàng tiếp theo bên trái.';
      } else if ([66, 67, 68].indexOf(lesson_id) >= 0) {
        q = 'Đâu là cách ghi chép số lượng thường dùng khi kiểm đếm nhanh?';
        ans = 'Gạch chéo hoặc dùng vạch đánh dấu';
        w1 = 'Dùng máy tính'; w2 = 'Vẽ hình chi tiết'; w3 = 'Đo bằng thước kẻ';
        hint = 'Nhớ lại cách ta đếm số lượng xe cộ hoặc con vật bằng vạch.';
      } else if ([69, 70].indexOf(lesson_id) >= 0) {
        const t = pick(['chắc chắn', 'có thể', 'không thể']);
        if (t === 'chắc chắn') {
          q = 'Mặt trời mọc ở hướng Đông là hiện tượng...'; ans = 'Chắc chắn';
        } else if (t === 'có thể') {
          q = 'Hôm nay trời đổ mưa là hiện tượng...'; ans = 'Có thể';
        } else {
          q = 'Con lợn biết bay là hiện tượng...'; ans = 'Không thể';
        }
        w1 = 'Chắc chắn'; w2 = 'Có thể'; w3 = 'Không thể';
        if (ans === w1) w1 = 'Không biết';
        hint = 'Đánh giá mức độ thực tế của sự việc.';
      } else {
        const t = pick(['so', 'tinhtoan', 'hinhhoc']);
        if (t === 'so') {
          const n = ri(100, 999);
          q = `Số ${n} có mấy chữ số?`; ans = '3 chữ số';
          w1 = '2 chữ số'; w2 = '4 chữ số'; w3 = '1 chữ số';
        } else if (t === 'tinhtoan') {
          const a = ri(100, 500), b = ri(100, 400);
          q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
          w1 = String(a + b + 100); w2 = String(a + b - 100); w3 = String(a + b + 10);
        } else {
          q = 'Khối nào có thể lăn được dễ dàng trên mặt đất?';
          ans = 'Khối cầu';
          w1 = 'Khối lập phương'; w2 = 'Khối trụ'; w3 = 'Khối hộp chữ nhật';
        }
        hint = 'Ôn tập tổng hợp kiến thức toán lớp 2.';
      }

      const opts = this._mix_options(ans, w1, w2, w3);
      return new Question(q, opts.slice(0, 4), ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 2, lesson_id);
    },
    _generate_grade_3_question(lesson_id, difficulty) {
      const obj = pick(this.objects);
      const name = pick(this.names);
      let q = '', ans = '', hint = '';
      let w1 = '', w2 = '', w3 = '';

      if (lesson_id === 1) {
        const val = ri(100, 999);
        q = `Số ${val} được phân tích thành:`;
        ans = `${Math.floor(val / 100) * 100} + ${Math.floor(val % 100 / 10) * 10} + ${val % 10}`;
        w1 = `${Math.floor(val / 100)} + ${Math.floor(val % 100 / 10)} + ${val % 10}`;
        w2 = `${Math.floor(val / 100) * 100} + ${val % 100}`;
        w3 = `${val} + 0 + 0`;
        hint = 'Phân tích theo giá trị của hàng trăm, hàng chục và hàng đơn vị.';
      } else if (lesson_id === 2) {
        const a = ri(100, 500), b = ri(100, 400);
        q = `Đặt tính rồi tính: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = String(a + b + 10); w2 = String(a + b - 10); w3 = String(a + b + 100);
        hint = 'Cộng lần lượt từ hàng đơn vị sang trái.';
      } else if (lesson_id === 3) {
        const a = ri(50, 100), b = ri(10, 40);
        q = `Tìm x biết: x - ${b} = ${a}`;
        ans = String(a + b);
        w1 = String(a - b); w2 = String(a); w3 = String(b);
        hint = 'Muốn tìm số bị trừ, ta lấy hiệu cộng với số trừ.';
      } else if (lesson_id === 4) {
        const a = pick([2, 5]); const b = ri(1, 10);
        q = `Tính nhẩm: ${a} x ${b} = ?`;
        ans = String(a * b);
        w1 = String(a * b + a); w2 = String(a * b - a); w3 = String(a + b);
        hint = `Nhớ lại bảng nhân ${a} đã học ở lớp 2.`;
      } else if (lesson_id === 5) {
        q = 'Dụng cụ nào sau đây dùng để đo độ dài?';
        ans = 'Thước kẻ';
        w1 = 'Cái cân'; w2 = 'Đồng hồ'; w3 = 'Nhiệt kế';
        hint = 'Độ dài được đo bằng các đơn vị như cm, m.';
      } else if (lesson_id === 6) {
        const b = ri(1, 10);
        q = `Mỗi hộp có 6 cái bút. Hỏi ${b} hộp có bao nhiêu cái bút?`;
        ans = String(6 * b);
        w1 = String(6 * b + 6); w2 = String(6 * b - 6); w3 = String(b + 6);
        hint = 'Sử dụng bảng nhân 6.';
      } else if (lesson_id === 7) {
        const b = ri(1, 10); const prod = 6 * b;
        q = `Có ${prod} ${obj} chia đều cho 6 bạn. Mỗi bạn được mấy ${obj}?`;
        ans = String(b);
        w1 = String(b + 1); w2 = String(Math.abs(b - 1)); w3 = '6';
        hint = 'Nhẩm xem 6 nhân mấy bằng ' + prod + '.';
      } else if (lesson_id === 8) {
        const a = ri(11, 24), b = ri(2, 4);
        q = `Tính: ${a} x ${b} = ?`;
        ans = String(a * b);
        w1 = String(a * b + 10); w2 = String(a * b - 10); w3 = String(a + b);
        hint = 'Nhân từ hàng đơn vị rồi đến hàng chục.';
      } else if (lesson_id === 9) {
        const b = ri(1, 10);
        q = `Tính nhẩm: 7 x ${b} = ?`;
        ans = String(7 * b);
        w1 = String(7 * b + 7); w2 = String(7 * b - 7); w3 = String(b + 7);
        hint = 'Sử dụng bảng nhân 7.';
      } else if (lesson_id === 10) {
        const b = ri(1, 10); const prod = 7 * b;
        q = `Tính: ${prod} : 7 = ?`;
        ans = String(b);
        w1 = String(b + 1); w2 = String(Math.abs(b - 1)); w3 = '7';
        hint = 'Dựa vào bảng nhân 7 để tính.';
      } else if (lesson_id === 11) {
        const b = ri(1, 10);
        q = `Một con cua có 8 cẳng. Hỏi ${b} con cua có bao nhiêu cẳng?`;
        ans = String(8 * b);
        w1 = String(8 * b + 8); w2 = String(8 * b - 8); w3 = String(b + 8);
        hint = 'Sử dụng bảng nhân 8.';
      } else if (lesson_id === 12) {
        const b = ri(1, 10); const prod = 8 * b;
        q = `Tính: ${prod} : 8 = ?`;
        ans = String(b);
        w1 = String(b + 1); w2 = String(Math.abs(b - 1)); w3 = '8';
        hint = 'Nhẩm xem 8 nhân mấy thì bằng ' + prod + '.';
      } else if (lesson_id === 13) {
        const b = ri(1, 10);
        q = `Tính nhẩm: 9 x ${b} = ?`;
        ans = String(9 * b);
        w1 = String(9 * b + 9); w2 = String(9 * b - 9); w3 = '90';
        hint = 'Tổng các chữ số của kết quả trong bảng nhân 9 luôn bằng 9.';
      } else if (lesson_id === 14) {
        const b = ri(1, 10); const prod = 9 * b;
        q = `Tính: ${prod} : 9 = ?`;
        ans = String(b);
        w1 = String(b + 1); w2 = String(Math.abs(b - 1)); w3 = '9';
        hint = 'Dựa vào bảng nhân 9.';
      } else if (lesson_id === 15) {
        const a = pick([6, 7, 8, 9]); const b = ri(2, 9);
        if (rf() < 0.5) {
          q = `Ôn tập: ${a} x ${b} = ?`; ans = String(a * b);
        } else {
          const prod = a * b;
          q = `Ôn tập: ${prod} : ${a} = ?`; ans = String(b);
        }
        w1 = String(parseInt(ans, 10) + 1); w2 = String(Math.abs(parseInt(ans, 10) - 1)); w3 = String(parseInt(ans, 10) + 2);
        hint = 'Ôn lại các bảng nhân, chia đã học.';
      } else if (lesson_id === 16) {
        q = 'Điểm M là trung điểm của đoạn thẳng AB dài 8cm. Độ dài AM là:';
        ans = '4 cm';
        w1 = '8 cm'; w2 = '2 cm'; w3 = '16 cm';
        hint = 'Trung điểm chia đoạn thẳng làm hai phần bằng nhau.';
      } else if (lesson_id === 17) {
        const r = ri(2, 10);
        q = `Hình tròn có bán kính ${r}cm. Đường kính của hình tròn là:`;
        ans = `${r * 2} cm`;
        w1 = `${r} cm`; w2 = `${r + 2} cm`; w3 = `${r * 3} cm`;
        hint = 'Đường kính dài gấp 2 lần bán kính.';
      } else if (lesson_id === 18) {
        q = 'Góc nào sau đây có độ mở lớn nhất?';
        ans = 'Góc bẹt';
        w1 = 'Góc tù'; w2 = 'Góc vuông'; w3 = 'Góc nhọn';
        hint = 'Góc bẹt là một đường thẳng.';
      } else if (lesson_id === 19) {
        q = 'Nhiệt độ của nước đang sôi là khoảng bao nhiêu độ C?';
        ans = '100 độ C';
        w1 = '0 độ C'; w2 = '37 độ C'; w3 = '50 độ C';
        hint = 'Đây là kiến thức khoa học cơ bản.';
      } else if (lesson_id === 20) {
        q = 'Để vẽ một hình tròn thật chuẩn, ta dùng dụng cụ gì?';
        ans = 'Com-pa';
        w1 = 'Ê-ke'; w2 = 'Thước thẳng'; w3 = 'Thước dây';
        hint = 'Dụng cụ này có một đầu nhọn làm tâm và một đầu gắn bút chì.';
      } else if (lesson_id === 21) {
        q = 'Khối hộp chữ nhật có bao nhiêu mặt?';
        ans = '6 mặt';
        w1 = '4 mặt'; w2 = '8 mặt'; w3 = '12 mặt';
        hint = 'Hãy đếm số mặt của một viên gạch.';
      } else if (lesson_id === 22) {
        q = 'Mặt của khối lập phương là hình gì?';
        ans = 'Hình vuông';
        w1 = 'Hình chữ nhật'; w2 = 'Hình tròn'; w3 = 'Hình tam giác';
        hint = 'Các mặt của khối lập phương đều bằng nhau.';
      } else if (lesson_id === 23) {
        const a = ri(12, 34), b = ri(2, 3);
        q = `Đặt tính rồi tính: ${a} x ${b} = ?`;
        ans = String(a * b);
        w1 = String(a * b + 10); w2 = String(a * b - 10); w3 = String(a + b);
        hint = 'Nhân từ hàng đơn vị trước.';
      } else if (lesson_id === 24) {
        const a = ri(5, 12), b = ri(3, 5);
        q = `Gấp số ${a} lên ${b} lần ta được bao nhiêu?`;
        ans = String(a * b);
        w1 = String(a + b); w2 = String(a * b + 1); w3 = String(a * b - 1);
        hint = 'Gấp lên nhiều lần là thực hiện phép nhân.';
      } else if (lesson_id === 25) {
        const a = 14, b = 4;
        q = `Phép chia ${a} : ${b} có số dư là bao nhiêu?`;
        ans = '2';
        w1 = '1'; w2 = '3'; w3 = '0';
        hint = '14 = 4 x 3 + 2.';
      } else if (lesson_id === 26) {
        const a = pick([48, 64, 72]); const b = pick([4, 8]);
        q = `Tính: ${a} : ${b} = ?`;
        ans = String(Math.floor(a / b));
        w1 = String(Math.floor(a / b) + 1); w2 = String(Math.floor(a / b) - 1); w3 = String(Math.floor(a / b) + 10);
        hint = 'Thực hiện phép chia bình thường.';
      } else if (lesson_id === 27) {
        const a = 30, b = 5;
        q = `Giảm số ${a} đi ${b} lần ta được bao nhiêu?`;
        ans = String(Math.floor(a / b));
        w1 = String(a - b); w2 = String(a * b); w3 = String(a + b);
        hint = 'Giảm đi một số lần là thực hiện phép chia.';
      } else if (lesson_id === 28) {
        q = `${name} có 5 viên bi. Hùng có số bi gấp đôi ${name}. Cả hai có tất cả bao nhiêu viên bi?`;
        ans = '15';
        w1 = '10'; w2 = '20'; w3 = '25';
        hint = 'Bước 1: Tính số bi của Hùng. Bước 2: Tính tổng số bi.';
      } else if (lesson_id === 29) {
        const a = ri(20, 40), b = 2;
        q = `Tính nhanh: ${a} x ${b} = ?`;
        ans = String(a * b);
        w1 = String(a * b + 10); w2 = String(a * b - 10); w3 = String(a + b);
        hint = 'Nhân nhẩm hàng chục rồi đến hàng đơn vị.';
      } else if (lesson_id === 30) {
        q = '1 lít (l) bằng bao nhiêu mi-li-lít (ml)?';
        ans = '1000 ml';
        w1 = '100 ml'; w2 = '10 ml'; w3 = '10000 ml';
        hint = '1 l = 1000 ml.';
      } else if (lesson_id === 31) {
        q = 'Đơn vị nào sau đây dùng để đo khối lượng (độ nặng) của một vật nhỏ?';
        ans = 'Gam (g)';
        w1 = 'Mililít (ml)'; w2 = 'Xăng-ti-mét (cm)'; w3 = 'Độ C';
        hint = 'Gam nhỏ hơn Kilôgam.';
      } else if (lesson_id === 32) {
        q = '1 xăng-ti-mét (cm) bằng bao nhiêu mi-li-mét (mm)?';
        ans = '10 mm';
        w1 = '100 mm'; w2 = '1000 mm'; w3 = '1 mm';
        hint = 'Hãy nhìn các vạch chia nhỏ nhất trên thước kẻ của em.';
      } else if (lesson_id === 33) {
        q = 'Quả táo thường nặng khoảng bao nhiêu?';
        ans = '150 g';
        w1 = '150 kg'; w2 = '150 l'; w3 = '150 mm';
        hint = 'Dùng đơn vị Gam cho vật có khối lượng vừa phải.';
      } else if (lesson_id === 34) {
        q = 'Khi kim dài (kim phút) chỉ vào số 9 thì là bao nhiêu phút?';
        ans = '45 phút';
        w1 = '9 phút'; w2 = '30 phút'; w3 = '50 phút';
        hint = 'Lấy số trên đồng hồ nhân với 5.';
      } else if (lesson_id === 35) {
        q = 'Nửa giờ bằng bao nhiêu phút?';
        ans = '30 phút';
        w1 = '60 phút'; w2 = '15 phút'; w3 = '45 phút';
        hint = '1 giờ = 60 phút.';
      } else if (lesson_id === 36) {
        const a = ri(100, 300), b = ri(2, 3);
        q = `Tính: ${a} x ${b} = ?`;
        ans = String(a * b);
        w1 = String(a * b + 10); w2 = String(a * b - 10); w3 = String(a * b + 100);
        hint = 'Nhân lần lượt từ phải sang trái.';
      } else if (lesson_id === 37) {
        const a = pick([246, 369, 488]); const b = 2;
        q = `Tính: ${a} : ${b} = ?`;
        ans = String(Math.floor(a / b));
        w1 = String(Math.floor(a / b) + 10); w2 = String(Math.floor(a / b) - 10); w3 = String(Math.floor(a / b) + 1);
        hint = 'Chia từ trái sang phải (bắt đầu từ hàng trăm).';
      } else if (lesson_id === 38) {
        const a = 10, b = 5, c = 2;
        q = `Tính giá trị biểu thức: ${a} + ${b} x ${c} = ?`;
        ans = String(a + b * c);
        w1 = String((a + b) * c); w2 = String(a + b + c); w3 = String(a * b * c);
        hint = 'Nhân chia trước, cộng trừ sau.';
      } else if (lesson_id === 39) {
        const a = 24, b = 6;
        q = `Số ${a} gấp số ${b} mấy lần?`;
        ans = String(Math.floor(a / b)) + ' lần';
        w1 = String(a - b) + ' lần'; w2 = String(a * b) + ' lần'; w3 = String((Math.floor(a / b)) + 1) + ' lần';
        hint = 'Lấy số lớn chia cho số bé.';
      } else if (lesson_id === 40) {
        q = 'Biểu thức 20 : 2 x 3 có giá trị là bao nhiêu?';
        ans = '30';
        w1 = '60'; w2 = '10'; w3 = '15';
        hint = 'Thực hiện lần lượt từ trái sang phải.';
      } else if ([41, 42, 43, 44].indexOf(lesson_id) >= 0) {
        const t = pick(['tinhtoan', 'gapan', 'hinhhoc']);
        if (t === 'tinhtoan') {
          const a = ri(100, 200), b = pick([2, 3]);
          q = `Ôn tập HK1: ${a} x ${b} = ?`; ans = String(a * b);
          w1 = String(a * b + 10); w2 = String(a * b - 10); w3 = String(a + b);
        } else if (t === 'gapan') {
          q = 'Đoạn dây 10m gấp đoạn dây 2m mấy lần?'; ans = '5 lần';
          w1 = '8 lần'; w2 = '12 lần'; w3 = '20 lần';
        } else {
          q = '1 kg = ... g. Số cần điền là:'; ans = '1000';
          w1 = '100'; w2 = '10'; w3 = '10000';
        }
        hint = 'Tổng ôn kiến thức học kì 1.';
      } else if (lesson_id === 45) {
        const n = ri(1000, 9999);
        q = `Số liền sau của ${n} là số nào?`;
        ans = String(n + 1);
        w1 = String(n - 1); w2 = String(n + 10); w3 = String(n + 100);
        hint = 'Số liền sau thì cộng thêm 1.';
      } else if (lesson_id === 46) {
        const a = 4567, b = 4576;
        q = `Điền dấu thích hợp: ${a} ... ${b}`;
        ans = '<';
        w1 = '>'; w2 = '='; w3 = '+';
        hint = 'So sánh từ hàng nghìn, hàng trăm, rồi đến hàng chục.';
      } else if (lesson_id === 47) {
        q = 'Làm tròn số 3400 đến hàng nghìn ta được số nào?';
        ans = '3000';
        w1 = '4000'; w2 = '3500'; w3 = '3400';
        hint = 'Chữ số hàng trăm là 4 (nhỏ hơn 5) nên ta làm tròn xuống.';
      } else if (lesson_id === 48) {
        q = 'Số lớn nhất có 4 chữ số là số nào?';
        ans = '9999';
        w1 = '1000'; w2 = '8999'; w3 = '9000';
        hint = 'Mỗi chữ số đều phải là số lớn nhất (số 9).';
      } else if (lesson_id === 49) {
        const a = 4, b = 5, c = 6;
        q = `Hình tam giác có độ dài các cạnh là ${a}cm, ${b}cm, ${c}cm. Chu vi là:`;
        ans = `${a + b + c} cm`;
        w1 = `${a + b + c + 1} cm`; w2 = `${a + b} cm`; w3 = `${b + c} cm`;
        hint = 'Chu vi là tổng độ dài các cạnh bao quanh.';
      } else if (lesson_id === 50) {
        const c = 5;
        q = `Hình vuông có cạnh là ${c}cm. Chu vi của hình vuông đó là:`;
        ans = `${c * 4} cm`;
        w1 = `${c * c} cm`; w2 = `${c * 2} cm`; w3 = `${c * 4 + 1} cm`;
        hint = 'Chu vi hình vuông = Cạnh x 4.';
      } else if (lesson_id === 51) {
        q = 'Khi nói về độ rộng của bề mặt một hình, ta dùng khái niệm gì?';
        ans = 'Diện tích';
        w1 = 'Chu vi'; w2 = 'Độ dài'; w3 = 'Khối lượng';
        hint = 'Chu vi là đường bao quanh, còn bề mặt bên trong là diện tích.';
      } else if (lesson_id === 52) {
        const d = 6, r = 3;
        q = `Hình chữ nhật có chiều dài ${d}cm, chiều rộng ${r}cm. Diện tích là:`;
        ans = `${d * r} cm2`;
        w1 = `${(d + r) * 2} cm2`; w2 = `${d + r} cm2`; w3 = '18 cm';
        hint = 'Diện tích hình chữ nhật = Chiều dài x Chiều rộng.';
      } else if (lesson_id === 53) {
        const c = 4;
        q = `Hình vuông có cạnh ${c}cm. Diện tích là:`;
        ans = `${c * c} cm2`;
        w1 = `${c * 4} cm2`; w2 = '16 cm'; w3 = `${c + c} cm2`;
        hint = 'Diện tích hình vuông = Cạnh x Cạnh.';
      } else if (lesson_id === 54) {
        const a = ri(1000, 5000), b = ri(1000, 4000);
        q = `Tính: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = String(a + b + 100); w2 = String(a + b - 100); w3 = String(a + b + 10);
        hint = 'Cộng lần lượt từ hàng đơn vị sang trái.';
      } else if (lesson_id === 55) {
        const a = ri(5000, 9999), b = ri(1000, 4000);
        q = `Tính: ${a} - ${b} = ?`;
        ans = String(a - b);
        w1 = String(a - b + 100); w2 = String(a - b - 100); w3 = String(a - b + 10);
        hint = 'Trừ lần lượt từ hàng đơn vị sang trái.';
      } else if (lesson_id === 56) {
        const a = 1500, b = 2000, c = 500;
        q = `Tính giá trị: ${a} + ${b} - ${c} = ?`;
        ans = String(a + b - c);
        w1 = String(a + b + c); w2 = String(a - b + c); w3 = String(a + b);
        hint = 'Thực hiện phép tính từ trái sang phải.';
      } else if (lesson_id === 57) {
        const a = ri(1000, 3000), b = ri(2, 3);
        q = `Tính: ${a} x ${b} = ?`;
        ans = String(a * b);
        w1 = String(a * b + 100); w2 = String(a * b - 100); w3 = String(a + b);
        hint = 'Nhân lần lượt từ hàng đơn vị.';
      } else if (lesson_id === 58) {
        const a = pick([2468, 3690, 4800]); const b = 2;
        q = `Tính: ${a} : ${b} = ?`;
        ans = String(Math.floor(a / b));
        w1 = String(Math.floor(a / b) + 100); w2 = String(Math.floor(a / b) - 100); w3 = String(Math.floor(a / b) + 10);
        hint = 'Chia lần lượt từ hàng nghìn sang phải.';
      } else if (lesson_id === 59) {
        q = 'Tìm x biết: x : 3 = 1500';
        ans = '4500';
        w1 = '500'; w2 = '450'; w3 = '3000';
        hint = 'Muốn tìm số bị chia, ta lấy thương nhân với số chia.';
      } else if (lesson_id === 60) {
        const n = ri(10000, 99999);
        q = `Số liền trước của ${n} là số nào?`;
        ans = String(n - 1);
        w1 = String(n + 1); w2 = String(n - 10); w3 = String(n + 10);
        hint = 'Trừ đi 1 để tìm số liền trước.';
      } else if (lesson_id === 61) {
        const a = 45678, b = 45768;
        q = `So sánh ${a} và ${b}:`;
        ans = '<';
        w1 = '>'; w2 = '='; w3 = 'Không biết';
        hint = 'So sánh bắt đầu từ hàng chục nghìn.';
      } else if (lesson_id === 62) {
        q = 'Số lớn nhất có 5 chữ số là số nào?';
        ans = '99999';
        w1 = '100000'; w2 = '90000'; w3 = '10000';
        hint = 'Mọi chữ số đều là số 9.';
      } else if (lesson_id === 63) {
        const a = 25000, b = 35000;
        q = `Tính: ${a} + ${b} = ?`;
        ans = String(a + b);
        w1 = '50000'; w2 = '65000'; w3 = '70000';
        hint = 'Cộng bình thường như các số nhỏ.';
      } else if (lesson_id === 64) {
        const a = 80000, b = 25000;
        q = `Tính: ${a} - ${b} = ?`;
        ans = String(a - b);
        w1 = '50000'; w2 = '65000'; w3 = '45000';
        hint = 'Trừ bình thường như các số nhỏ.';
      } else if (lesson_id === 65) {
        const a = 12000, b = 4;
        q = `Tính: ${a} x ${b} = ?`;
        ans = String(a * b);
        w1 = '4800'; w2 = '36000'; w3 = '480000';
        hint = 'Lấy 12 x 4 rồi thêm 3 số 0.';
      } else if (lesson_id === 66) {
        const a = 45000, b = 5;
        q = `Tính: ${a} : ${b} = ?`;
        ans = String(Math.floor(a / b));
        w1 = '900'; w2 = '90000'; w3 = '8000';
        hint = 'Lấy 45 : 5 rồi thêm 3 số 0.';
      } else if (lesson_id === 67) {
        q = 'Tính: 100000 - 20000 x 2 = ?';
        ans = '60000';
        w1 = '160000'; w2 = '80000'; w3 = '40000';
        hint = 'Nhân chia trước, cộng trừ sau.';
      } else if (lesson_id === 68) {
        q = 'Mẹ có 1 tờ 20.000 đồng và 2 tờ 10.000 đồng. Tổng số tiền là:';
        ans = '40.000 đồng';
        w1 = '30.000 đồng'; w2 = '50.000 đồng'; w3 = '20.000 đồng';
        hint = 'Cộng tổng giá trị các tờ tiền lại.';
      } else if (lesson_id === 69) {
        q = 'Quyển truyện giá 15.000 đồng. Em đưa cô bán hàng 20.000 đồng, cô trả lại em bao nhiêu?';
        ans = '5.000 đồng';
        w1 = '10.000 đồng'; w2 = '15.000 đồng'; w3 = '35.000 đồng';
        hint = 'Lấy số tiền em có trừ đi giá quyển truyện.';
      } else if (lesson_id === 70) {
        q = 'Tháng 2 của năm không nhuận có bao nhiêu ngày?';
        ans = '28 ngày';
        w1 = '29 ngày'; w2 = '30 ngày'; w3 = '31 ngày';
        hint = 'Tháng 2 là tháng đặc biệt có ít ngày nhất.';
      } else if (lesson_id === 71) {
        q = 'Trong hộp chỉ có bi đỏ. Nhắm mắt lấy 1 viên bi, khả năng lấy được bi xanh là:';
        ans = 'Không thể';
        w1 = 'Chắc chắn'; w2 = 'Có thể'; w3 = 'Rất khó';
        hint = 'Vì trong hộp không có viên bi xanh nào cả.';
      } else if (lesson_id === 72) {
        q = 'Bảng số liệu dùng để làm gì?';
        ans = 'Tóm tắt và trình bày thông tin';
        w1 = 'Để vẽ tranh'; w2 = 'Để tính chu vi'; w3 = 'Để đo độ dài';
        hint = 'Bảng giúp ta dễ dàng nhìn thấy và so sánh các con số.';
      } else if ([73, 74, 75, 76].indexOf(lesson_id) >= 0) {
        const t = pick(['tinhtoan', 'hinhhoc', 'thucte']);
        if (t === 'tinhtoan') {
          const a = ri(10000, 40000), b = ri(10000, 30000);
          q = `Ôn tập cuối năm: ${a} + ${b} = ?`; ans = String(a + b);
          w1 = String(a + b + 100); w2 = String(a + b - 100); w3 = String(a + b + 1000);
        } else if (t === 'hinhhoc') {
          q = 'Hình chữ nhật có chiều dài 10cm, chiều rộng 5cm. Diện tích là:'; ans = '50 cm2';
          w1 = '30 cm'; w2 = '15 cm2'; w3 = '50 cm';
        } else {
          q = '1 kg bông và 1 kg sắt, cái nào nặng hơn?'; ans = 'Bằng nhau';
          w1 = 'Sắt nặng hơn'; w2 = 'Bông nặng hơn'; w3 = 'Không biết';
        }
        hint = 'Ôn tập tổng hợp kiến thức cả năm lớp 3.';
      } else {
        q = `Tính: ${lesson_id} + 1 = ?`;
        ans = String(lesson_id + 1);
        w1 = String(lesson_id); w2 = String(lesson_id + 2); w3 = '10';
        hint = 'Thực hiện phép tính cộng.';
      }

      const opts = this._mix_options(ans, w1, w2, w3);
      return new Question(q, opts.slice(0, 4), ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 3, lesson_id);
    },
    // question_generator.py:1456 — pick obj TRƯỚC name (rng sequence parity)
    _generate_grade_4_question(lesson_id, difficulty) {
      const obj = pick(this.objects);
      const name = pick(this.names);
      let q = '', ans = '', hint = '';
      let w1 = '', w2 = '', w3 = '';

      if (lesson_id === 1) {
        const val = ri(10000, 99999);
        q = `Số ${val} có mấy chữ số?`; ans = '5 chữ số';
        w1 = '4 chữ số'; w2 = '6 chữ số'; w3 = '3 chữ số'; hint = 'Đếm số chữ số.';
      } else if (lesson_id === 2) {
        const a = ri(10000, 50000), b = ri(1000, 30000);
        q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 100); w2 = String(a + b - 100); w3 = String(a + b + 1000); hint = 'Cộng từ phải sang trái.';
      } else if (lesson_id === 3) {
        const a = ri(1000, 9000), b = ri(2, 9);
        q = `Tính: ${a} x ${b} = ?`; ans = String(a * b);
        w1 = String(a * b + 100); w2 = String(a * b - 100); w3 = String(a + b); hint = 'Nhân lần lượt từng hàng.';
      } else if (lesson_id === 4) {
        const a = ri(10, 50);
        q = `Cho a = ${a}. Tính a + 15 = ?`; ans = String(a + 15);
        w1 = String(a + 5); w2 = String(a + 25); w3 = String(a - 15); hint = 'Thay a bằng số rồi tính.';
      } else if (lesson_id === 5) {
        const a = ri(10, 30), b = ri(2, 5), c = ri(5, 20);
        q = `${name} mua ${a} vở giá ${b} nghìn và ${c} bút giá 5 nghìn. Tất cả bao nhiêu nghìn?`;
        ans = String(a * b + c * 5);
        w1 = String(a * b + c); w2 = String(a + b * 5); w3 = String(a * b); hint = 'B1: Tiền vở. B2: Tiền bút. B3: Cộng.';
      } else if (lesson_id === 6) {
        const a = ri(10000, 50000), b = ri(5000, 20000);
        q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 1000); w2 = String(a + b - 1000); w3 = String(a + b + 100); hint = 'Cộng từng hàng.';
      } else if ([7, 8].indexOf(lesson_id) >= 0) {
        const val = ri(100000, 999999);
        q = `Số ${val} thuộc lớp nào?`; ans = 'Lớp nghìn';
        w1 = 'Lớp đơn vị'; w2 = 'Lớp triệu'; w3 = 'Lớp trăm'; hint = 'Số 6 chữ số thuộc lớp nghìn.';
      } else if (lesson_id === 9) {
        const a = ri(10000, 99999), b = ri(1000, 9999);
        q = `So sánh: ${a} ... ${b}`; ans = '>';
        w1 = '<'; w2 = '='; w3 = '+'; hint = 'Nhiều chữ số hơn thì lớn hơn.';
      } else if (lesson_id === 10) {
        // py:1475 — list nối chuỗi [i*10] + [i*100] + [i*1000] (KHÔNG xen kẽ)
        const roundVals = [];
        for (let i = 1; i < 100; i++) roundVals.push(i * 10);
        for (let i = 1; i < 100; i++) roundVals.push(i * 100);
        for (let i = 1; i < 100; i++) roundVals.push(i * 1000);
        const val = pick(roundVals);
        const t = val % 1000 === 0 ? 'tròn nghìn' : (val % 100 === 0 ? 'tròn trăm' : 'tròn chục');
        q = `Số ${val} là số gì?`; ans = `Số ${t}`;
        w1 = 'Số lẻ'; w2 = 'Số tự nhiên'; w3 = 'Số nguyên'; hint = 'Tròn chục tận 0, tròn trăm tận 00.';
      } else if (lesson_id === 11) {
        const val = ri(1000, 9999);
        const fl = Math.floor(val / 1000); // Python val//1000 — (val/1000) float gây lệch
        const rounded = val % 1000 < 500 ? fl * 1000 : (fl + 1) * 1000;
        q = `Làm tròn ${val} đến hàng nghìn:`; ans = String(rounded);
        w1 = String(rounded - 1000); w2 = String(rounded + 1000); w3 = String(val);
        hint = 'Hàng trăm ≥5 tròn lên, <5 tròn xuống.';
      } else if ([12, 13].indexOf(lesson_id) >= 0) {
        const val = ri(1000000, 9999999);
        q = `Số ${val} có mấy chữ số?`; ans = '7 chữ số';
        w1 = '6 chữ số'; w2 = '8 chữ số'; w3 = '5 chữ số'; hint = 'Đếm số chữ số.';
      } else if (lesson_id === 14) {
        let a = ri(100000, 999999), b = ri(100000, 999999);
        while (a === b) b = ri(100000, 999999);
        q = `Điền dấu: ${a} ... ${b}`; ans = a > b ? '>' : '<';
        w1 = a > b ? '<' : '>'; w2 = '='; w3 = '+'; hint = 'So sánh từ trái sang phải.';
      } else if ([15, 16].indexOf(lesson_id) >= 0) {
        const val = ri(100000, 999999);
        q = `Số liền sau của ${val}:`; ans = String(val + 1);
        w1 = String(val - 1); w2 = String(val + 10); w3 = String(val + 100); hint = 'Liền sau = +1.';
      } else if (lesson_id === 17) {
        const a = ri(1, 5);
        q = `${a} tấn bằng bao nhiêu kg?`; ans = `${a * 1000} kg`;
        w1 = `${a * 100} kg`; w2 = `${a * 10} kg`; w3 = `${a * 10000} kg`; hint = '1 tấn = 1000 kg.';
      } else if ([18, 19].indexOf(lesson_id) >= 0) {
        q = '1 thế kỷ bằng bao nhiêu năm?'; ans = '100 năm';
        w1 = '10 năm'; w2 = '50 năm'; w3 = '1000 năm'; hint = '1 thế kỷ = 100 năm.';
      } else if (lesson_id === 20) {
        const a = ri(2, 8);
        q = `${a} tạ bằng bao nhiêu yến?`; ans = `${a * 10} yến`;
        w1 = `${a * 100} yến`; w2 = `${a * 5} yến`; w3 = `${a} yến`; hint = '1 tạ = 10 yến.';
      } else if (lesson_id === 21) {
        const a = ri(100000, 500000), b = ri(100000, 400000);
        q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 1000); w2 = String(a + b - 1000); w3 = String(a + b + 100); hint = 'Cộng từ phải sang trái.';
      } else if (lesson_id === 22) {
        const a = ri(500000, 999999), b = ri(100000, 400000);
        q = `Tính: ${a} - ${b} = ?`; ans = String(a - b);
        w1 = String(a - b + 1000); w2 = String(a - b - 1000); w3 = String(a - b + 100); hint = 'Trừ từ phải sang trái.';
      } else if (lesson_id === 23) {
        const a = ri(10, 50), b = ri(10, 50);
        q = `Giao hoán: ${a} + ${b} = ${b} + ?`; ans = String(a);
        w1 = String(a + b); w2 = String(b); w3 = String(a - b); hint = 'a + b = b + a.';
      } else if (lesson_id === 24) {
        let tong = ri(20, 60), hieu = ri(2, 20);
        while (tong <= hieu || (tong + hieu) % 2 !== 0) { tong = ri(20, 60); hieu = ri(2, 20); }
        const lon = (tong + hieu) / 2;
        q = `Tổng hai số là ${tong}, hiệu là ${hieu}. Số lớn:`; ans = String(lon);
        w1 = String(tong - lon); w2 = String(tong); w3 = String(hieu); hint = 'Số lớn = (Tổng + Hiệu) : 2.';
      } else if ([25, 26].indexOf(lesson_id) >= 0) {
        const a = ri(10000, 99999), b = ri(1000, 9999);
        q = `Tính: ${a} - ${b} = ?`; ans = String(a - b);
        w1 = String(a - b + 100); w2 = String(a - b - 100); w3 = String(a + b); hint = 'Đặt tính thẳng cột.';
      } else if (lesson_id === 27) {
        q = 'Hai đường vuông góc tạo mấy góc vuông?'; ans = '4 góc vuông';
        w1 = '2 góc vuông'; w2 = '1 góc vuông'; w3 = 'Không có'; hint = 'Vuông góc tạo 4 góc vuông.';
      } else if (lesson_id === 28) {
        q = 'Hai đường song song có đặc điểm gì?'; ans = 'Không bao giờ cắt nhau';
        w1 = 'Cắt tại 1 điểm'; w2 = 'Vuông góc'; w3 = 'Trùng nhau'; hint = 'Song song = không cắt nhau.';
      } else if (lesson_id === 29) {
        q = 'Đường cao tam giác là gì?'; ans = 'Đoạn từ đỉnh hạ vuông góc xuống đáy';
        w1 = 'Đoạn nối hai đỉnh'; w2 = 'Trung tuyến'; w3 = 'Cạnh bên'; hint = 'Đường cao vuông góc với đáy.';
      } else if ([30, 31].indexOf(lesson_id) >= 0) {
        q = 'Hình bình hành có đặc điểm gì?'; ans = 'Hai cặp cạnh đối song song và bằng nhau';
        w1 = 'Bốn cạnh bằng nhau'; w2 = 'Bốn góc vuông'; w3 = 'Hai đường chéo vuông góc'; hint = 'Cạnh đối song song và bằng nhau.';
      } else if (lesson_id === 32) {
        q = 'Hình thoi có đặc điểm gì?'; ans = 'Bốn cạnh bằng nhau, hai cặp cạnh đối song song';
        w1 = 'Bốn góc vuông'; w2 = 'Chỉ hai cạnh bằng nhau'; w3 = 'Không có cạnh song song'; hint = 'Thoi: cả 4 cạnh bằng nhau.';
      } else if ([33, 34].indexOf(lesson_id) >= 0) {
        q = 'Góc nhọn so với góc vuông thì sao?'; ans = 'Nhỏ hơn góc vuông';
        w1 = 'Lớn hơn góc vuông'; w2 = 'Bằng góc vuông'; w3 = 'Bằng góc bẹt'; hint = 'Nhọn < Vuông < Tù < Bẹt.';
      } else if (lesson_id === 35) {
        q = 'Góc bẹt bằng bao nhiêu độ?'; ans = '180 độ';
        w1 = '90 độ'; w2 = '360 độ'; w3 = '270 độ'; hint = 'Góc bẹt = 2 góc vuông.';
      } else if ([36, 37].indexOf(lesson_id) >= 0) {
        const a = ri(10000, 50000), b = ri(5000, 30000);
        q = `Ôn tập HK1: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 1000); w2 = String(a + b - 1000); w3 = String(a * b); hint = 'Ôn lại đặt tính.';
      } else if (lesson_id >= 38 && lesson_id <= 73) {
        const a = ri(1000, 9999), b = ri(2, 9);
        if (rf() < 0.5) { q = `Tính: ${a} x ${b} = ?`; ans = String(a * b); w1 = String(a * b + 100); w2 = String(a * b - 100); w3 = String(a + b); hint = 'Nhân/chia số lớn.'; }
        else { q = `Tính: ${a * b} : ${b} = ?`; ans = String(a); w1 = String(a + 1); w2 = String(a - 1); w3 = String(a + 10); hint = 'Chia - Nhân - Trừ.'; }
      } else {
        const a = ri(10, 99), b = ri(1, 9);
        q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 1); w2 = String(a + b - 1); w3 = String(a + b + 10); hint = 'Thực hiện phép tính.';
      }

      const opts = this._mix_options(ans, w1, w2, w3);
      return new Question(q, opts.slice(0, 4), ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 4, lesson_id);
    },
    // question_generator.py:1531 — pick obj TRƯỚC name (rng sequence parity)
    _generate_grade_5_question(lesson_id, difficulty) {
      const obj = pick(this.objects);
      const name = pick(this.names);
      let q = '', ans = '', hint = '';
      let w1 = '', w2 = '', w3 = '';

      if (lesson_id === 1) {
        const val = ri(100000, 999999);
        q = `Viết số ${val} thành tổng theo lớp:`;
        ans = `${Math.floor(val / 1000) * 1000} + ${val % 1000}`;
        w1 = `${Math.floor(val / 100)} + ${val % 100}`;
        w2 = `${Math.floor(val / 10)} + ${val % 10}`;
        w3 = String(val + 1000);
        hint = 'Tách lớp nghìn và đơn vị.';
      } else if (lesson_id === 2) {
        const a = ri(100000, 500000), b = ri(100000, 400000);
        q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 1000); w2 = String(a + b - 1000); w3 = String(a + b + 100); hint = 'Cộng từ phải sang trái.';
      } else if (lesson_id === 3) {
        const a = ri(500000, 999999), b = ri(100000, 400000);
        q = `Tính: ${a} - ${b} = ?`; ans = String(a - b);
        w1 = String(a - b + 1000); w2 = String(a - b - 1000); w3 = String(a - b + 100); hint = 'Trừ từ phải sang trái.';
      } else if ([4, 5].indexOf(lesson_id) >= 0) {
        const a = ri(1000, 9999), b = ri(2, 9);
        q = `Tính: ${a} x ${b} = ?`; ans = String(a * b);
        w1 = String(a * b + 100); w2 = String(a * b - 100); w3 = String(a + b); hint = 'Nhân lần lượt.';
      } else if (lesson_id === 6) {
        const b = ri(2, 9); const a = b * ri(100, 1000);
        q = `Tính: ${a} : ${b} = ?`; ans = String(Math.floor(a / b));
        w1 = String(Math.floor(a / b) + 1); w2 = String(Math.floor(a / b) - 1); w3 = String(Math.floor(a / b) + 10); hint = 'Chia - Nhân - Trừ.';
      } else if (lesson_id === 7) {
        const a = ri(10, 50), b = ri(10, 50), c = ri(10, 50);
        q = `Tính: (${a} + ${b}) x ${c} = ?`; ans = String((a + b) * c);
        w1 = String(a + b * c); w2 = String(a * b + c); w3 = String((a + b) * c + 10); hint = 'Tính ngoặc trước.';
      } else if (lesson_id === 8) {
        let tong = ri(30, 80), hieu = ri(2, 20);
        while (tong <= hieu || (tong + hieu) % 2 !== 0) { tong = ri(30, 80); hieu = ri(2, 20); }
        const lon = (tong + hieu) / 2;
        q = `Tổng ${tong}, hiệu ${hieu}. Số lớn:`; ans = String(lon);
        w1 = String(tong - lon); w2 = String(tong); w3 = String(hieu); hint = 'Số lớn = (Tổng + Hiệu) : 2.';
      } else if (lesson_id === 9) {
        const a = ri(2, 5), b = ri(1, a - 1); const tong = (a + b) * ri(5, 15);
        q = `Tổng ${tong}, tỉ ${a}:${b}. Số lớn:`; ans = String(Math.floor(tong * a / (a + b)));
        w1 = String(Math.floor(tong * b / (a + b))); w2 = String(tong); w3 = String(a + b);
        hint = 'Số lớn = Tổng x Tỉ lớn / Tổng tỉ.';
      } else if ([10, 11].indexOf(lesson_id) >= 0) {
        const a = ri(10000, 50000), b = ri(1000, 9000);
        q = `Tìm x: x + ${b} = ${a + b}`; ans = String(a);
        w1 = String(a + 1); w2 = String(a - 1); w3 = String(a + b); hint = 'x = Tổng - Số hạng.';
      } else if ([12, 13].indexOf(lesson_id) >= 0) {
        const a = ri(100, 999), b = ri(11, 49);
        q = `Luyện: ${a} x ${b} = ?`; ans = String(a * b);
        w1 = String(a * b + 100); w2 = String(a * b - 100); w3 = String(a + b); hint = 'Ôn nhân số lớn.';
      } else if (lesson_id === 14) {
        q = 'Phân số gồm hai phần là gì?'; ans = 'Tử số và mẫu số';
        w1 = 'Hàng và lớp'; w2 = 'Chục và đơn vị'; w3 = 'Số lớn và số bé'; hint = 'Phân số = Tử/Mẫu.';
      } else if (lesson_id === 15) {
        const a = ri(1, 5), b = ri(2, 9), k = ri(2, 4);
        q = `Rút gọn ${a * k}/${b * k}:`; ans = `${a}/${b}`;
        w1 = `${a + 1}/${b}`; w2 = `${a}/${b + 1}`; w3 = `${a * k}/${b}`; hint = 'Chia tử và mẫu cho cùng số.';
      } else if ([16, 17].indexOf(lesson_id) >= 0) {
        const a = ri(1, 5), b = ri(1, 5), m = ri(2, 9);
        q = `Tính: ${a}/${m} + ${b}/${m} = ?`; ans = `${a + b}/${m}`;
        w1 = `${a + b}/${2 * m}`; w2 = `${a + b + 1}/${m}`; w3 = `${a * b}/${m}`; hint = 'Cộng tử, giữ mẫu.';
      } else if (lesson_id === 18) {
        const a = ri(4, 9), b = ri(1, 3), m = ri(2, 9);
        q = `Tính: ${a}/${m} - ${b}/${m} = ?`; ans = `${a - b}/${m}`;
        w1 = `${a + b}/${m}`; w2 = `${a - b - 1}/${m}`; w3 = `${a - b}/${2 * m}`; hint = 'Trừ tử, giữ mẫu.';
      } else if ([19, 20].indexOf(lesson_id) >= 0) {
        const a = ri(1, 5), b = ri(1, 5), m1 = ri(2, 9), m2 = ri(2, 9);
        q = `Tính: ${a}/${m1} x ${b}/${m2} = ?`; ans = `${a * b}/${m1 * m2}`;
        w1 = `${a + b}/${m1 * m2}`; w2 = `${a * b}/${m1 + m2}`; w3 = `${a * b + 1}/${m1 * m2}`; hint = 'Tử nhân tử, mẫu nhân mẫu.';
      } else if (lesson_id === 21) {
        const a = ri(1, 5), b = ri(1, 5), m1 = ri(2, 9), m2 = ri(2, 9);
        q = `Tính: ${a}/${m1} : ${b}/${m2} = ?`; ans = `${a * m2}/${m1 * b}`;
        w1 = `${a * b}/${m1 * m2}`; w2 = `${a * m2 + 1}/${m1 * b}`; w3 = `${a + m2}/${m1 + b}`; hint = 'Chia = nhân nghịch đảo.';
      } else if ([22, 23].indexOf(lesson_id) >= 0) {
        const a = ri(1, 5), b = ri(1, 5), m = ri(2, 9);
        q = `Luyện: ${a}/${m} x ${b}/${m} = ?`; ans = `${a * b}/${m * m}`;
        w1 = `${a + b}/${m * m}`; w2 = `${a * b}/${m}`; w3 = `${a * b + 1}/${m * m}`; hint = 'Ôn nhân chia phân số.';
      } else if (lesson_id === 24) {
        const a = ri(2, 9), b = ri(1, 5), m = ri(2, 9); const val = a * m;
        q = `Tìm ${b}/${m} của ${val}:`; ans = String(a * b);
        w1 = String(a * b + 1); w2 = String(Math.floor(a * m / b)); w3 = String(a + b); hint = 'Lấy số nhân phân số.';
      } else if ([25, 26].indexOf(lesson_id) >= 0) {
        const a = ri(100, 500), b = ri(1, 3), m = ri(2, 5);
        q = `Kho có ${a} kg, bán ${b}/${m}. Còn lại?`; ans = String(a - Math.floor(a * b / m));
        w1 = String(Math.floor(a * b / m)); w2 = String(Math.floor(a / m)); w3 = String(a - Math.floor(a * b / m) + 10);
        hint = 'Tổng trừ phần đã bán.';
      } else if ([27, 28].indexOf(lesson_id) >= 0) {
        q = 'Viết 3/10 dưới dạng số thập phân:'; ans = '0,3';
        w1 = '3,0'; w2 = '0,03'; w3 = '0,1'; hint = '3/10 = 0,3.';
      } else if (lesson_id === 29) {
        q = 'Viết 25/100 dưới dạng số thập phân:'; ans = '0,25';
        w1 = '2,5'; w2 = '0,025'; w3 = '25'; hint = '25/100 = 0,25.';
      } else if (lesson_id === 30) {
        const a = ri(1, 8);
        q = `So sánh: 0,${a} ... 0,${a + 1}`; ans = '<';
        w1 = '>'; w2 = '='; w3 = '+'; hint = 'So sánh từng chữ số sau dấu phẩy.';
      } else if ([31, 32].indexOf(lesson_id) >= 0) {
        // py:1580 — round(uniform(1.1, 9.9), 1): 1 draw/uniform, cùng biểu thức float
        const a = round2(1.1 + (9.9 - 1.1) * rf(), 1); const b = round2(1.1 + (9.9 - 1.1) * rf(), 1);
        q = `Tính: ${pyFloatStr(a)} + ${pyFloatStr(b)} = ?`; ans = pyFloatStr(round2(a + b, 1));
        w1 = pyFloatStr(round2(a + b + 0.1, 1)); w2 = pyFloatStr(round2(a + b - 0.1, 1)); w3 = pyFloatStr(round2(a * b, 1)); hint = 'Thẳng cột dấu phẩy.';
      } else if (lesson_id === 33) {
        // py:1582 — uniform(5.0, 9.9) / uniform(1.0, 4.9)
        const a = round2(5.0 + (9.9 - 5.0) * rf(), 1); const b = round2(1.0 + (4.9 - 1.0) * rf(), 1);
        q = `Tính: ${pyFloatStr(a)} - ${pyFloatStr(b)} = ?`; ans = pyFloatStr(round2(a - b, 1));
        w1 = pyFloatStr(round2(a - b + 0.1, 1)); w2 = pyFloatStr(round2(a - b - 0.1, 1)); w3 = pyFloatStr(round2(a + b, 1)); hint = 'Thẳng cột dấu phẩy.';
      } else if (lesson_id === 34) {
        // py:1584 — uniform(1.1, 9.9) + randint(2, 5)
        const a = round2(1.1 + (9.9 - 1.1) * rf(), 1); const b = ri(2, 5);
        q = `Tính: ${pyFloatStr(a)} x ${b} = ?`; ans = pyFloatStr(round2(a * b, 1));
        w1 = pyFloatStr(round2(a * b + 1, 1)); w2 = pyFloatStr(round2(a * b - 1, 1)); w3 = pyFloatStr(round2(a + b, 1)); hint = 'Nhân như số tự nhiên.';
      } else if (lesson_id === 35) {
        const a = ri(10000, 50000), b = ri(5000, 30000);
        q = `Ôn HK1: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 1000); w2 = String(a + b - 1000); w3 = String(a * b); hint = 'Ôn đặt tính.';
      } else if (lesson_id === 36) {
        const d = ri(4, 10), h = ri(3, 8);
        q = `Tam giác đáy ${d}cm, cao ${h}cm. Diện tích:`; ans = `${Math.floor(d * h / 2)} cm2`;
        w1 = `${d * h} cm2`; w2 = `${d + h} cm2`; w3 = `${Math.floor(d * h / 2) + 1} cm2`; hint = 'S = (Đáy x Cao) : 2.';
      } else if (lesson_id === 37) {
        const a = ri(4, 8), b = ri(2, 5), h = ri(3, 6);
        q = `Thang đáy lớn ${a}, đáy bé ${b}, cao ${h}. Diện tích:`; ans = `${Math.floor((a + b) * h / 2)} cm2`;
        w1 = `${(a + b) * h} cm2`; w2 = `${Math.floor(a * b * h / 2)} cm2`; w3 = `${Math.floor((a + b) * h / 2) + 1} cm2`;
        hint = 'S = (Đáy lớn + Đáy bé) x Cao : 2.';
      } else if (lesson_id === 38) {
        const r = ri(2, 7);
        q = `Hình tròn bán kính ${r}cm. Chu vi (π=3,14):`; ans = `${round2(2 * 3.14 * r, 2)} cm`;
        w1 = `${round2(3.14 * r * r, 2)} cm`; w2 = `${r * 2} cm`; w3 = `${round2(3.14 * r, 2)} cm`; hint = 'C = 2 x π x r.';
      } else if (lesson_id === 39) {
        const r = ri(2, 5);
        q = `Hình tròn bán kính ${r}cm. Diện tích (π=3,14):`; ans = `${round2(3.14 * r * r, 2)} cm2`;
        w1 = `${round2(2 * 3.14 * r, 2)} cm2`; w2 = `${r * r} cm2`; w3 = `${round2(3.14 * r, 2)} cm2`; hint = 'S = π x r x r.';
      } else if ([40, 41].indexOf(lesson_id) >= 0) {
        q = 'Hình hộp chữ nhật có mấy mặt?'; ans = '6 mặt';
        w1 = '4 mặt'; w2 = '8 mặt'; w3 = '12 mặt'; hint = '6 mặt hình chữ nhật.';
      } else if (lesson_id === 42) {
        const d = ri(3, 8), r = ri(2, 5), h = ri(2, 6);
        q = `Hộp ${d}x${r}x${h} cm. Sxq:`; ans = `${2 * (d + r) * h} cm2`;
        w1 = `${d * r * h} cm2`; w2 = `${2 * d * r + 2 * r * h} cm2`; w3 = `${(d + r) * h} cm2`; hint = 'Sxq = Chu vi đáy x Cao.';
      } else if (lesson_id === 43) {
        const c = ri(3, 7);
        q = `Lập phương cạnh ${c}cm. Stp:`; ans = `${c * c * 6} cm2`;
        w1 = `${c * c * 4} cm2`; w2 = `${c * c * 2} cm2`; w3 = `${c * c * 8} cm2`; hint = 'Stp = Cạnh x Cạnh x 6.';
      } else if ([44, 45].indexOf(lesson_id) >= 0) {
        q = 'Hình trụ có mấy mặt cong?'; ans = '1 mặt cong';
        w1 = '2 mặt cong'; w2 = 'Không có'; w3 = '3 mặt cong'; hint = '1 mặt cong, 2 mặt phẳng.';
      } else if (lesson_id === 46) {
        const d = ri(3, 8), r = ri(2, 5), h = ri(2, 6);
        q = `Hộp ${d}x${r}x${h} cm. Thể tích:`; ans = `${d * r * h} cm3`;
        w1 = `${2 * (d + r) * h} cm3`; w2 = `${d * r + h} cm3`; w3 = `${(d + r) * h} cm3`; hint = 'V = Dài x Rộng x Cao.';
      } else if (lesson_id === 47) {
        const c = ri(3, 7);
        q = `Lập phương cạnh ${c}cm. Thể tích:`; ans = `${c * c * c} cm3`;
        w1 = `${c * c * 6} cm3`; w2 = `${c * c * 4} cm3`; w3 = `${c * c * 2} cm3`; hint = 'V = Cạnh^3.';
      } else if ([48, 49].indexOf(lesson_id) >= 0) {
        q = '1 dm3 bằng bao nhiêu cm3?'; ans = '1000 cm3';
        w1 = '100 cm3'; w2 = '10 cm3'; w3 = '10000 cm3'; hint = '1 dm3 = 1000 cm3.';
      } else if (lesson_id === 50) {
        q = '1 m3 bằng bao nhiêu dm3?'; ans = '1000 dm3';
        w1 = '100 dm3'; w2 = '10 dm3'; w3 = '10000 dm3'; hint = '1 m3 = 1000 dm3.';
      } else if ([51, 52].indexOf(lesson_id) >= 0) {
        const d = ri(3, 8), r = ri(2, 5), h = ri(2, 6);
        q = `Luyện: V hộp ${d}x${r}x${h} cm = ?`; ans = `${d * r * h} cm3`;
        w1 = `${d * r * h + 10} cm3`; w2 = `${2 * (d + r) * h} cm3`; w3 = `${d + r + h} cm3`; hint = 'V = Dài x Rộng x Cao.';
      } else if ([53, 54].indexOf(lesson_id) >= 0) {
        const v = ri(30, 90), t = ri(2, 5);
        q = `Vận tốc ${v} km/h, thời gian ${t} giờ. Quãng đường:`; ans = `${v * t} km`;
        w1 = `${v + t} km`; w2 = `${Math.floor(v / t)} km`; w3 = `${v * t + 10} km`; hint = 's = v x t.';
      } else if ([55, 56].indexOf(lesson_id) >= 0) {
        const v = ri(30, 90), t = ri(2, 5); const s = v * t;
        q = `Quãng đường ${s} km, thởi gian ${t} giờ. Vận tốc:`; ans = `${v} km/h`;
        w1 = `${s + t} km/h`; w2 = `${Math.floor(s / t) + 10} km/h`; w3 = `${s - t} km/h`; hint = 'v = s : t.';
      } else if (lesson_id === 57) {
        const v1 = ri(30, 50), v2 = ri(30, 50);
        q = `Ngược chiều: ${v1} km/h và ${v2} km/h. Vận tốc gần:`; ans = `${v1 + v2} km/h`;
        w1 = `${v1 * v2} km/h`; w2 = `${Math.abs(v1 - v2)} km/h`; w3 = `${v1 + v2 + 10} km/h`; hint = 'Ngược chiều: cộng vận tốc.';
      } else if (lesson_id === 58) {
        const v = ri(30, 90); const s = v * ri(2, 5); const t = Math.floor(s / v);
        q = `Quãng đường ${s} km, vận tốc ${v} km/h. Thời gian:`; ans = `${t} giờ`;
        w1 = `${t + 1} giờ`; w2 = `${t - 1} giờ`; w3 = `${s + v} giờ`; hint = 't = s : v.';
      } else if (lesson_id === 61) {
        const v1 = ri(30, 50), v2 = ri(20, 29);
        q = `Cùng chiều: ${v1} km/h và ${v2} km/h. Vận tốc gần:`; ans = `${v1 - v2} km/h`;
        w1 = `${v1 + v2} km/h`; w2 = `${v1 * v2} km/h`; w3 = `${v1 - v2 + 5} km/h`; hint = 'Cùng chiều: trừ vận tốc.';
      } else if ([62, 63].indexOf(lesson_id) >= 0) {
        q = 'Biểu đồ hình quạt biểu diễn gì?'; ans = 'Tỉ lệ phần trăm';
        w1 = 'Số lượng'; w2 = 'Thời gian'; w3 = 'Độ dài'; hint = 'Biểu đồ quạt biểu diễn %.';
      } else if ([64, 65].indexOf(lesson_id) >= 0) {
        const a = ri(100, 500); const pct = pick([10, 20, 25, 50]);
        q = `${pct}% của ${a} là:`; ans = String(Math.floor(a * pct / 100));
        w1 = String(Math.floor(a * pct / 100) + 10); w2 = String(Math.floor(a / pct)); w3 = String(a + pct); hint = 'Nhân số với tỉ %.';
      } else if ([66, 67].indexOf(lesson_id) >= 0) {
        const a = ri(100, 500); const pct = pick([10, 20, 25]);
        q = `Giảm ${pct}%, giá gốc ${a}. Giá sau giảm:`; ans = String(a - Math.floor(a * pct / 100));
        w1 = String(Math.floor(a * pct / 100)); w2 = String(a + Math.floor(a * pct / 100)); w3 = String(a - Math.floor(a * pct / 100) + 10);
        hint = 'Giá gốc - Phần giảm.';
      } else if ([68, 69].indexOf(lesson_id) >= 0) {
        const a = ri(100, 999), b = ri(11, 49);
        q = `Ôn: ${a} x ${b} = ?`; ans = String(a * b);
        w1 = String(a * b + 1000); w2 = String(a * b - 1000); w3 = String(a + b); hint = 'Ôn nhân số lớn.';
      } else if (lesson_id === 70) {
        const a = ri(2, 5), b = ri(1, a - 1); const tong = (a + b) * ri(5, 15);
        q = `Ôn tỉ: Tổng ${tong}, tỉ ${a}:${b}. Số lớn:`; ans = String(Math.floor(tong * a / (a + b)));
        w1 = String(Math.floor(tong * b / (a + b))); w2 = String(tong); w3 = String(a + b); hint = 'Tổng x Tỉ lớn / Tổng tỉ.';
      } else if (lesson_id === 71) {
        const r = ri(2, 5);
        q = `Ôn: Hình tròn r=${r}cm. S (π=3,14):`; ans = `${round2(3.14 * r * r, 2)} cm2`;
        w1 = `${round2(2 * 3.14 * r, 2)} cm2`; w2 = `${r * r} cm2`; w3 = `${round2(3.14 * r, 2)} cm2`; hint = 'S = π x r x r.';
      } else if (lesson_id === 72) {
        const d = ri(3, 8), r = ri(2, 5), h = ri(2, 6);
        q = `Ôn: V hộp ${d}x${r}x${h} = ?`; ans = `${d * r * h} cm3`;
        w1 = `${2 * (d + r) * h} cm3`; w2 = `${d * r + h} cm3`; w3 = `${d * r * h + 10} cm3`; hint = 'V = D x R x C.';
      } else if ([73, 74].indexOf(lesson_id) >= 0) {
        const v = ri(30, 60), t = ri(2, 4);
        q = `Ôn: v=${v} km/h, t=${t} giờ. s = ?`; ans = `${v * t} km`;
        w1 = `${v + t} km`; w2 = `${Math.floor(v / t)} km`; w3 = `${v * t + 10} km`; hint = 's = v x t.';
      } else if (lesson_id === 75) {
        const a = ri(10000, 50000), b = ri(5000, 30000);
        q = `Ôn cuối năm: ${a} - ${b} = ?`; ans = String(a - b);
        w1 = String(a - b + 1000); w2 = String(a - b - 1000); w3 = String(a + b); hint = 'Ôn phép trừ.';
      } else {
        const a = ri(10, 99), b = ri(1, 9);
        q = `Tính: ${a} + ${b} = ?`; ans = String(a + b);
        w1 = String(a + b + 1); w2 = String(a + b - 1); w3 = String(a + b + 10); hint = 'Thực hiện phép tính.';
      }

      const opts = this._mix_options(ans, w1, w2, w3);
      return new Question(q, opts.slice(0, 4), ans, hint, QuestionType.MULTIPLE_CHOICE, difficulty, 5, lesson_id);
    }
    // __QG_TAIL__
  });

  // ---- exports (browser global + Node module) ----
  global.QuestionType = QuestionType;
  global.Difficulty = Difficulty;
  global.Question = Question;
  global.QuestionGenerator = QuestionGenerator;
  global.AdaptiveDifficulty = AdaptiveDifficulty;
  global.adaptive_difficulty = adaptive_difficulty;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      QuestionType: QuestionType,
      Difficulty: Difficulty,
      Question: Question,
      QuestionGenerator: QuestionGenerator,
      AdaptiveDifficulty: AdaptiveDifficulty,
      adaptive_difficulty: adaptive_difficulty
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
