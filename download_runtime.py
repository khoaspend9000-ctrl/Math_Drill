
import urllib.request
import os
import json

base_url = "https://github.com/pygame-web/archives/raw/main/0.9/"
dest_dir = r"f:\lam_game_2026\build\web"

files_to_download = [
    # Root-level files
    ("browserfs.min.js", "browserfs.min.js"),
    ("cpythonrc.py", "pythonrc.py"),
    ("empty.html", "empty.html"),
    ("favicon.png", "favicon.png"),
    ("pythons.js", "pythons.js"),
    ("vt.js", "vt.js"),
    ("vtx.js", "vtx.js"),
    ("empty.ogg", "empty.ogg"),
]

# Use GitHub API to list cpython312 and vt directories
dirs_to_fetch = [
    ("cpython312", "https://api.github.com/repos/pygame-web/archives/contents/0.9/cpython312?ref=main"),
    ("vt", "https://api.github.com/repos/pygame-web/archives/contents/0.9/vt?ref=main"),
]

def download_file(url, dest_path):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    try:
        print(f"Downloading {url}")
        urllib.request.urlretrieve(url, dest_path)
        print(f"  -> Saved to {dest_path}")
        return True
    except Exception as e:
        print(f"  -> ERROR: {e}")
        return False

# Download root files
for src_name, dest_name in files_to_download:
    download_file(base_url + src_name, os.path.join(dest_dir, dest_name))

# Download directory contents via API
for dir_name, api_url in dirs_to_fetch:
    print(f"\nFetching {dir_name} directory...")
    try:
        with urllib.request.urlopen(api_url) as response:
            dir_data = json.load(response)
        for item in dir_data:
            if item.get("type") == "file":
                download_file(item["download_url"], os.path.join(dest_dir, dir_name, item["name"]))
    except Exception as e:
        print(f"  -> ERROR listing {dir_name}: {e}")
        # Fallback: list known important files manually
        if dir_name == "cpython312":
            for fn in ["main.js", "main.data", "main.wasm"]:
                download_file(base_url + "cpython312/" + fn, os.path.join(dest_dir, "cpython312", fn))
        elif dir_name == "vt":
            for fn in ["xterm.js", "xterm-addon-image.js", "xterm.css"]:
                download_file(base_url + "vt/" + fn, os.path.join(dest_dir, "vt", fn))

print("\n=== ALL DOWNLOADS FINISHED ===")
