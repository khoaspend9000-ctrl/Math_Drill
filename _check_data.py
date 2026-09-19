import io, os, json

ROOT = r"E:\lam_game_2026"
data_src = os.path.join(ROOT, "data")
data_dst = os.path.join(ROOT, "web", "data")

files = ["achievements.json", "daily_rewards.json", "pets.json", "skills.json", "skins.json"]
for f in files:
    sp = os.path.join(data_src, f)
    dp = os.path.join(data_dst, f)
    sa = io.open(sp, encoding="utf-8").read()
    da = io.open(dp, encoding="utf-8").read()
    try:
        ja = json.loads(sa)
        jb = json.loads(da)
        semantic = ja == jb
        print(f"{f}: raw_equal={sa==da}, json_equal={semantic}")
        if not semantic:
            if isinstance(ja, dict) and isinstance(jb, dict):
                ka = set(ja.keys())
                kb = set(jb.keys())
                if ka != kb:
                    print(f"  src_only: {ka - kb}")
                    print(f"  dst_only: {kb - ka}")
    except Exception as e:
        print(f"{f}: error: {e}")
