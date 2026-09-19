# -*- coding: utf-8 -*-
import io, os, re

ROOT = r"E:\lam_game_2026"
SRC = os.path.join(ROOT, "web", "js", "states_real.js")
PY = os.path.join(ROOT, "main.py")

raw = io.open(SRC, encoding="utf-8", newline="").read()
print("states_real.js bytes:", len(raw))
NL = "\r\n" if "\r\n" in raw else "\n"
print("newline:", repr(NL))

for cls in ("MenuState", "TheoryState"):
    pm = sorted(set(re.findall(cls + r"\.prototype\.(\w+)\s*=", raw)))
    pm2 = sorted(set(re.findall(cls + r"\.prototype\[['\"](\w+)['\"]\]\s*=", raw)))
    print(cls, "| class decl:", bool(re.search(r"class\s+" + cls + r"\b", raw)), "| prototype:", pm + pm2)

pl = io.open(PY, encoding="utf-8").read().splitlines()
idx = [i for i, s in enumerate(pl) if re.match(r"\s*def draw_left", s)]
print("main.py draw_left lines:", [i + 1 for i in idx])
if idx:
    a = idx[0]
    for i in range(a, min(a + 85, len(pl))):
        print("PY%04d| %s" % (i + 1, pl[i]))

MARK = "POLISH M2 (appended)"
if MARK in raw:
    print("RESULT: ALREADY_PATCHED")
else:
    layer = r'''/* ===== POLISH M2 (appended): Menu dashboard detail panel + Theory scroll indicator =====
   Non-destructive visual layer. Wraps BaseState.draw() only and always calls the
   previous implementation first. Never throws: every drawing step is guarded.
   Parity target: main.py MenuState.draw_left (difficulty, streak, pet block with
   evolution progress, achievement preview) + TheoryState scroll affordance. */
(function () {
  var G = (typeof globalThis !== "undefined" && globalThis) || (typeof global !== "undefined" && global) || null;
  if (!G || G.__POLISH_M2_APPLIED__) return;
  G.__POLISH_M2_APPLIED__ = true;

  function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  function s(v, d) { return (v === undefined || v === null || v === "") ? d : String(v); }
  function pick() {
    for (var i = 0; i < arguments.length; i++) { var o = arguments[i]; if (o && typeof o === "object") return o; }
    return null;
  }
  function profile(state) {
    var g = state && state.game ? state.game : null, p = state && state.player ? state.player : null;
    return pick(
      p && p.profile, p && p.data, p && p.playerData,
      g && g.player && g.player.profile, g && g.player && g.player.data,
      g && g.playerData, g && g.profile,
      state && state.profile, state && state.playerData, state && state.data
    ) || {};
  }
  function petInfo(state) {
    var g = state && state.game ? state.game : null, out = null;
    try {
      if (g && g.petSystem && typeof g.petSystem.getActivePet === "function") out = g.petSystem.getActivePet();
      if (!out && g && g.petSystem && typeof g.petSystem.getActivePetInfo === "function") out = g.petSystem.getActivePetInfo();
      if (!out && g && g.pets) out = g.pets;
      if (!out && g && g.player && g.player.pets) out = g.player.pets;
    } catch (e) { out = null; }
    return (out && typeof out === "object") ? out : null;
  }
  function achCount(state) {
    var g = state && state.game ? state.game : null, v = null;
    try {
      if (g && g.achievements) {
        var a = g.achievements;
        if (typeof a.getUnlockedCount === "function") v = a.getUnlockedCount();
        else if (Array.isArray(a.unlocked)) v = a.unlocked.length;
        else if (a.stats && typeof a.stats.unlocked === "number") v = a.stats.unlocked;
      }
    } catch (e) { v = null; }
    return (typeof v === "number" && isFinite(v)) ? v : null;
  }
  function rr(ctx, x, y, w, h, r) {
    var rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }
  function line(ctx, txt, x, y, size, col, weight, align) {
    ctx.font = (weight || "600") + " " + size + "px Segoe UI, Roboto, Arial, sans-serif";
    ctx.fillStyle = col;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, x, y);
  }
  function bar(ctx, x, y, w, h, pct, bg, fg) {
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = bg; ctx.fill();
    var fw = Math.max(0, Math.min(1, pct)) * w;
    if (fw > 0) { rr(ctx, x, y, fw, h, h / 2); ctx.fillStyle = fg; ctx.fill(); }
  }

  function menuDetails(ctx, state) {
    if (!ctx || typeof ctx.fillText !== "function" || typeof ctx.fillRect !== "function") return;
    var cv = ctx.canvas || { width: 1280, height: 720 };
    var W = n(cv.width, 1280), H = n(cv.height, 720);
    var p = profile(state);
    var pet = petInfo(state);
    var un = achCount(state);

    var fs = Math.max(11, Math.round(H * 0.0215));
    var pad = Math.round(H * 0.018);
    var x = Math.round(W * 0.075);
    var y = Math.round(H * 0.60);
    var w = Math.round(W * 0.345);
    var rows = pet ? 4 : 3;
    var h = pad * 2 + fs * 1.2 + rows * fs * 1.5;

    ctx.save();
    rr(ctx, x, y, w, h, Math.round(H * 0.016));
    ctx.fillStyle = "rgba(12, 26, 48, 0.55)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0, 188, 212, 0.35)";
    ctx.stroke();

    var cx = x + pad, cy = y + pad + fs * 0.7, lh = fs * 1.5;

    var diff = n(p.difficulty, 1);
    var diffName = s(p.difficulty_name, "");
    if (!diffName) diffName = (diff === 3) ? "Kho" : (diff === 2 ? "Trung binh" : "De");
    line(ctx, "Do kho: " + diffName, cx, cy, fs, "#FFC107");
    cy += lh;

    var streak = n(p.streak !== undefined ? p.streak : p.daily_streak, 0);
    line(ctx, "Chuoi ngay: " + streak, cx, cy, fs, "#4CAF50");
    cy += lh;

    if (pet) {
      var pname = s(pet.name || pet.pet_name || pet.type, s(p.pet_type, "Thu cung"));
      var plvl = n(pet.level !== undefined ? pet.level : pet.pet_level, 8);
      line(ctx, "Thu cung: " + pname + "  Lv" + plvl, cx, cy, fs, "#CE93D8");
      cy += lh;
      var maxLv = Math.max(1, n(pet.max_level !== undefined ? pet.max_level : pet.maxLevel, 30));
      bar(ctx, cx, cy - fs * 0.5, w - pad * 2, Math.max(6, Math.round(fs * 0.55)), plvl / maxLv,
          "rgba(255,255,255,0.16)", "#CE93D8");
      cy += lh;
    } else {
      line(ctx, "Thu cung: chua chon", cx, cy, fs, "rgba(255,255,255,0.45)");
      cy += lh;
    }

    var total = null;
    try {
      var g = state && state.game ? state.game : null;
      if (g && g.achievements && Array.isArray(g.achievements.list)) total = g.achievements.list.length;
      else if (g && g.achievementData && Array.isArray(g.achievementData)) total = g.achievementData.length;
    } catch (e) { total = null; }
    line(ctx, "Thanh tuu: " + (un === null ? "-" : (total ? (un + "/" + total) : String(un))), cx, cy, fs, "#64B5F6");
    ctx.restore();
  }

  function theoryScroll(ctx, state) {
    if (!ctx || typeof ctx.fillRect !== "function") return;
    var cv = ctx.canvas || { width: 1280, height: 720 };
    var W = n(cv.width, 1280), H = n(cv.height, 720);
    var off = null, mx = null;
    try {
      if (typeof state.scrollY === "number") off = state.scrollY;
      else if (typeof state.scrollOffset === "number") off = state.scrollOffset;
      else if (typeof state._scroll === "number") off = state._scroll;
      if (typeof state.maxScroll === "number") mx = state.maxScroll;
      else if (typeof state.maxScrollY === "number") mx = state.maxScrollY;
    } catch (e) { off = null; }
    if (off === null || !mx || mx <= 0) return;
    var xr = Math.round(W * 0.945), yt = Math.round(H * 0.22), hb = Math.round(H * 0.60);
    var bw = Math.max(6, Math.round(W * 0.006));
    ctx.save();
    rr(ctx, xr, yt, bw, hb, bw / 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fill();
    var frac = Math.max(0, Math.min(1, off / mx));
    var th = Math.max(bw * 2, hb * Math.max(0.12, 1 - Math.min(0.85, mx / (hb * 3))));
    var ty = yt + frac * (hb - th);
    rr(ctx, xr, ty, bw, th, bw / 2);
    ctx.fillStyle = "#4CAF50"; ctx.fill();
    ctx.restore();
  }

  function wrap(cls, fn) {
    if (typeof cls !== "function" || !cls.prototype || typeof cls.prototype.draw !== "function") return false;
    if (cls.prototype.__POLISH_M2_WRAPPED__) return true;
    var prev = cls.prototype.draw;
    cls.prototype.draw = function (ctx) {
      var out = prev.apply(this, arguments);
      try { fn(ctx, this); } catch (e) { /* visual layer must never break base draw */ }
      return out;
    };
    cls.prototype.__POLISH_M2_WRAPPED__ = true;
    return true;
  }

  function attempt() {
    var done = 0, need = 0;
    if (typeof G.MenuState === "function") { need++; if (wrap(G.MenuState, menuDetails)) done++; }
    if (typeof G.TheoryState === "function") { need++; if (wrap(G.TheoryState, theoryScroll)) done++; }
    G.__POLISH_M2_WRAPPED__ = done;
    return (need > 0 && done === need);
  }

  if (!attempt() && typeof setTimeout === "function") {
    var tries = 0;
    var tick = function () {
      tries++;
      if (attempt() || tries >= 20) return;
      setTimeout(tick, 50);
    };
    setTimeout(tick, 50);
  }
})();
'''
    raw2 = raw.rstrip() + NL + NL + layer.replace("\n", NL) + NL
    io.open(SRC, "w", encoding="utf-8", newline="").write(raw2)
    print("RESULT: PATCHED bytes", len(raw), "->", len(raw2))