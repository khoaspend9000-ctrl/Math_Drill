# =========================================================
# game_main.spec — PyInstaller build cho MathDrill 5.0
# =========================================================
# CÁCH DÙNG:
#   1. Đặt file này vào thư mục gốc dự án (F:\lam_game_2026), đè lên
#      game_main.spec cũ.
#   2. Chạy:  pyinstaller game_main.spec
#      (không cần thêm --add-data hay --onefile trên dòng lệnh nữa,
#      mọi thứ đã khai báo sẵn trong file này)
#   3. Kết quả nằm trong dist\game_main\ (bản --onedir, dễ kiểm tra).
#      Khi đã chắc ăn, đổi EXE(..., onefile=True cần cấu trúc COLLECT
#      khác — xem ghi chú "ONEFILE" ở cuối file) rồi build lại.
# =========================================================
import glob
import os
from PyInstaller.utils.hooks import collect_submodules

PROJECT_DIR = os.path.abspath('.')

# ---------------------------------------------------------
# 1) FILE RỜI Ở THƯ MỤC GỐC — CHỈ ĐỌC (ảnh/nhạc/font/dữ liệu bài học)
#    Gom tự động theo phần đuôi mở rộng, KHÔNG cần liệt kê tay từng file.
# ---------------------------------------------------------
READONLY_EXTENSIONS = [
    '*.png', '*.jpg', '*.jpeg', '*.gif',
    '*.mp3', '*.ogg', '*.wav',
    '*.ttf', '*.TTF', '*.otf',
]
datas = []
for pattern in READONLY_EXTENSIONS:
    for f in glob.glob(os.path.join(PROJECT_DIR, pattern)):
        datas.append((f, '.'))  # '.' = copy vào gốc thư mục dist, cùng cấp với .exe

# Dữ liệu TĨNH của game (nội dung bài học/câu hỏi mặc định — chỉ đọc,
# KHÔNG phải file người dùng ghi đè lúc chơi). Nếu game có ghi đè lên
# những file này lúc chạy (ví dụ admin sửa câu hỏi), hãy bỏ dòng tương
# ứng khỏi danh sách này và để nó dùng writable_data_path() thay vì
# resource_path() trong code.
STATIC_JSON = ['math_lessons.json', 'math_theory.json', 'daily_quiz_admin.json']
for name in STATIC_JSON:
    p = os.path.join(PROJECT_DIR, name)
    if os.path.exists(p):
        datas.append((p, '.'))

# ---------------------------------------------------------
# 2) THƯ MỤC TÀI NGUYÊN — copy nguyên cây thư mục, giữ đúng cấu trúc
#    con (ví dụ audio/nhac1.mp3 -> dist/audio/nhac1.mp3), vì code có
#    thể build đường dẫn kiểu resource_path("audio/xxx.mp3").
# ---------------------------------------------------------
ASSET_DIRS = ['audio', 'avatars', 'data', 'segoe ui emoji']
for d in ASSET_DIRS:
    full = os.path.join(PROJECT_DIR, d)
    if os.path.isdir(full):
        for root, _, files in os.walk(full):
            for fn in files:
                src = os.path.join(root, fn)
                # đường dẫn đích giữ nguyên cấu trúc con trong thư mục gốc "d"
                rel_dir = os.path.relpath(root, PROJECT_DIR)
                datas.append((src, rel_dir))

# ---------------------------------------------------------
# 3) PACKAGE PYTHON NỘI BỘ (ui/, utils/, systems/) — đảm bảo PyInstaller
#    quét hết mọi submodule kể cả khi import động (importlib, __import__)
#    mà phân tích tĩnh có thể bỏ sót.
# ---------------------------------------------------------
hiddenimports = []
for pkg in ['ui', 'utils', 'systems']:
    if os.path.isdir(os.path.join(PROJECT_DIR, pkg)):
        hiddenimports += collect_submodules(pkg)

# ---------------------------------------------------------
# 4) LOẠI TRỪ tường minh — các file KHÔNG được đóng gói làm tài nguyên
#    tĩnh, vì đây là dữ liệu người dùng, phải để trống lúc build và tự
#    sinh ra khi chạy thật (đã trỏ qua writable_data_path() trong code):
#      accounts.json, session.json, user_data.db, user_data.json,
#      user_data.json.bak, temp_password_state.txt, thư mục logs/
#    -> Không thêm dòng datas.append(...) nào cho các file này.
# ---------------------------------------------------------

block_cipher = None

a = Analysis(
    ['game_main.py'],
    pathex=[PROJECT_DIR],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    cipher=block_cipher,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='game_main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,   # đổi thành True tạm thời nếu cần xem log lỗi console khi debug
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# ----- BẢN --onedir (khuyên dùng để TEST trước) -----
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='game_main',
)

# ----- GHI CHÚ "ONEFILE" -----
# Sau khi test bản --onedir ở trên chạy tốt (dist\game_main\game_main.exe),
# muốn gộp thành 1 file .exe duy nhất: xoá toàn bộ khối EXE+COLLECT phía
# trên, thay bằng:
#
# exe = EXE(
#     pyz, a.scripts, a.binaries, a.zipfiles, a.datas, [],
#     name='game_main', debug=False, bootloader_ignore_signals=False,
#     strip=False, upx=True, upx_exclude=[], runtime_tmpdir=None,
#     console=False,
# )
