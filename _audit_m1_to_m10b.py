# M1->M10B Comprehensive Audit
import io, os, re

ROOT = r"E:\lam_game_2026"

# 1. Check index.html script load order
print("=== INDEX.HTML SCRIPT ORDER ===")
idx = os.path.join(ROOT, "web", "index.html")
t = io.open(idx, encoding="utf-8").read()
scripts = re.findall(r'<script\s+src="([^"]+)"', t)
for i, s in enumerate(scripts, 1):
    print(f"  {i:2d}. {s}")
print(f"\n  Total: {len(scripts)} scripts")

# 2. Check data file mirrors
print("\n=== DATA FILE MIRRORS ===")
data_src = os.path.join(ROOT, "data")
data_dst = os.path.join(ROOT, "web", "data")
if os.path.exists(data_src) and os.path.exists(data_dst):
    src_files = set(os.listdir(data_src))
    dst_files = set(os.listdir(data_dst))
    all_files = sorted(src_files | dst_files)
    for f in all_files:
        in_src = f in src_files
        in_dst = f in dst_files
        sp = os.path.join(data_src, f)
        dp = os.path.join(data_dst, f)
        if in_src and in_dst:
            sa = io.open(sp, encoding="utf-8").read()
            da = io.open(dp, encoding="utf-8").read()
            match = sa == da
            status = "OK" if match else "DIFF"
            print(f"  {status}  {f} ({len(sa)} vs {len(da)} chars)")
        elif in_src:
            print(f"  MISSING web/data/{f}")
        else:
            print(f"  EXTRA   web/data/{f}")
else:
    print("  data/ or web/data/ not found")

# 3. Check documentation consistency
print("\n=== MILESTONES IN WEB_PORT_PLAN.md ===")
plan = io.open(os.path.join(ROOT, "WEB_PORT_PLAN.md"), encoding="utf-8").read()
milestones = ["M1", "M2", "M3", "M4", "M5", "M6-A", "M6-B", "M7-A", "M7-B", "M7-C", "M7-D",
              "M8-A", "M8-B", "M8-C", "M8-D", "M9-A", "M9-B", "M9-C", "M9-D", "M9-E", "M9-F", "M9-G",
              "M10-A", "M10-B"]
for m in milestones:
    found = m in plan
    status = "OK" if found else "MISSING"
    print(f"  {status}  {m}")

# 4. Check legacy files
print("\n=== LEGACY FILES CHECK ===")
js_dir = os.path.join(ROOT, "web", "js")
legacy = ["states.js", "effects_part1.js"]
for f in legacy:
    p = os.path.join(js_dir, f)
    if os.path.exists(p):
        loaded = f in t
        status = "LOADED" if loaded else "NOT_LOADED"
        print(f"  {status}  {f}")

print("\n=== AUDIT COMPLETE ===")
