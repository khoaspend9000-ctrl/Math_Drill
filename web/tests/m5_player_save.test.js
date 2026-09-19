'use strict';

// =========================================================
// M5 Player + Save + Auth — test harness (Node thuần)
// Vector reference do py_reference.py sinh từ SOURCE PYTHON THẬT
// (player.py + hashlib) — xem web/tests/vectors/*.json
// Chạy: node web/tests/m5_player_save.test.js
// =========================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const webRoot = path.join(__dirname, '..');
const webJs = path.join(webRoot, 'js');
const vectorsDir = path.join(webRoot, 'tests', 'vectors');

let failed = 0;
let registered = 0;
let completed = 0;
let phaseComplete = false; // true khi mọi check() đã đăng ký xong (cuối file)
let summarized = false;

function pass(name) { console.log('PASS  ' + name); }
function fail(name, err) {
  failed += 1;
  console.error('FAIL  ' + name);
  console.error('      ' + (err && err.stack ? err.stack : err));
}
function summarize() {
  if (summarized) return;
  summarized = true;
  if (failed) {
    console.error('\n' + failed + ' test(s) failed');
    process.exit(1);
  }
  console.log('\nAll M5 player/save/auth tests passed. (' + completed + '/' + registered + ' checks)');
}
function done() {
  completed += 1;
  if (phaseComplete && completed === registered) summarize();
}

function check(name, fn) {
  registered += 1;
  let result;
  try {
    result = fn();
  } catch (err) {
    fail(name, err);
    return done();
  }
  if (result && typeof result.then === 'function') {
    result.then(function () { pass(name); done(); },
      function (err) { fail(name, err); done(); });
  } else {
    pass(name);
    done();
  }
}

// ---------- setup ----------
require('../js/save.js');
const PlayerModule = require('../js/player.js');
const PlayerData = PlayerModule.PlayerData;
const getRequiredExp = PlayerModule.getRequiredExp;
const AuthModule = require('../js/auth.js');
const AccountSystem = AuthModule.AccountSystem;
const hashPassword = AuthModule.hashPassword;
const verifyPassword = AuthModule.verifyPassword;

function loadVector(name) {
  return JSON.parse(fs.readFileSync(path.join(vectorsDir, name), 'utf8'));
}

// ---------- tests ----------

check('M5: syntax save.js / player.js / auth.js', function () {
  ['save.js', 'player.js', 'auth.js'].forEach(function (f) {
    const src = fs.readFileSync(path.join(webJs, f), 'utf8');
    new vm.Script(src, { filename: f });
  });
});

// T01 — plan: js_get_required_exp(l) == py_get_required_exp(l), tolerance ±1
check('M5 T01: XP curve khớp Python (306 mức, tolerance ±1) — vector từ player.py thật', function () {
  const vec = loadVector('xp_curve.json');
  assert.strictEqual(vec.source.indexOf('player.py'), 0, 'vector phải sinh từ player.py');
  let exact = 0;
  vec.curve.forEach(function (pair) {
    const level = pair[0];
    const py = pair[1];
    const js = getRequiredExp(level);
    assert.ok(Math.abs(js - py) <= vec.tolerance,
      'level ' + level + ': js=' + js + ' py=' + py);
    if (js === py) exact += 1;
  });
  assert.strictEqual(vec.curve.length, 306);
  console.log('      -> exact match: ' + exact + '/306 (giới hạn sai lệch ±1 do floating-point)');
});

// T02 — plan: add_exp(2.000.000) → transitions/final giống Python
check('M5 T02: level-up loop add_exp(2_000_000) + checkpoint bảng XP khớp Python', function () {
  const vec = loadVector('levelup.json');
  const p = new PlayerData();
  p.addExp(2000000);
  assert.strictEqual(p.level, vec.final_2m.level, 'level sau 2M XP');
  assert.strictEqual(p.exp, vec.final_2m.exp, 'exp dư sau 2M XP');
  assert.strictEqual(p.expToNextLevel, vec.final_2m.exp_to_next_level, 'exp_to_next_level');

  const p5 = new PlayerData();
  p5.addExp(500); // acceptance M5 trong plan: add_exp(500) → level up đúng
  assert.strictEqual(p5.level, vec.final_500.level);
  assert.strictEqual(p5.exp, vec.final_500.exp);
  assert.strictEqual(p5.expToNextLevel, vec.final_500.exp_to_next_level);

  vec.checkpoints.forEach(function (cp) {
    const q = new PlayerData();
    q.addExp(cp.xp);
    assert.strictEqual(q.level, cp.level, 'checkpoint ' + cp.xp + ' XP level');
    assert.strictEqual(q.exp, cp.exp, 'checkpoint ' + cp.xp + ' XP exp');
    assert.strictEqual(q.expToNextLevel, cp.exp_to_next_level, 'checkpoint ' + cp.xp + ' XP need');
  });
});

// T03 — gold luôn số nguyên khi input nguyên; sync account như Python add_gold
check('M5 T03: add_gold giữ số nguyên + sync account data (player.py:76-83)', function () {
  const auth = new AccountSystem();
  return auth.register('golduser', 'pw123456', 2).then(function (res) {
    assert.ok(res.ok, 'register: ' + res.msg);
    return auth.login('golduser', 'pw123456');
  }).then(function (res) {
    assert.ok(res.ok);
    const p = new PlayerData();
    p.loadSaveData(auth.data());
    p.addGold(250, auth);
    p.addGold(250, auth);
    assert.strictEqual(p.gold, 500);
    assert.strictEqual(Number.isInteger(p.gold), true);
    assert.strictEqual(auth.data().gold, 500, 'account data phải sync');
    // Nghiêm ngặt: Python KHÔNG clamp amount âm — port giữ nguyên hành vi
    p.addGold(-100, auth);
    assert.strictEqual(p.gold, 400);
  });
});

// T04 — combo multiplier theo game_init.update_combo (source thật):
// streak>=10→4.0 | >=5→3.0 | >=3→2.0 | else→1.5 ; sai → reset 1.0
check('M5 T04: combo threshold khớp update_combo (game_init.py:396-428)', function () {
  const expected = { 1: 1.5, 2: 1.5, 3: 2.0, 4: 2.0, 5: 3.0, 9: 3.0, 10: 4.0, 99: 4.0 };
  Object.keys(expected).forEach(function (n) {
    const p = new PlayerData();
    for (let i = 0; i < Number(n); i++) p.updateCombo(true);
    assert.strictEqual(p.comboStreak, Number(n), 'streak ' + n);
    assert.strictEqual(p.comboMultiplier, expected[n], 'multiplier tại streak ' + n);
  });
  // Sai → reset (player.py:85-88 + game_init.py:427-428)
  const p = new PlayerData();
  for (let i = 0; i < 12; i++) p.updateCombo(true);
  p.updateCombo(false);
  assert.strictEqual(p.comboStreak, 0);
  assert.strictEqual(p.comboMultiplier, 1.0);
  // incrementCombo base (player.py:90-100) — update_combo override lên trên
  const q = new PlayerData();
  q.incrementCombo();
  assert.strictEqual(q.comboMultiplier, 1.0, 'increment_combo streak=1 → 1.0');
  q.incrementCombo(); q.incrementCombo();
  assert.strictEqual(q.comboMultiplier, 1.5, 'increment_combo streak=3 → 1.5');
  q.incrementCombo(); q.incrementCombo();
  assert.strictEqual(q.comboMultiplier, 2.0, 'increment_combo streak=5 → 2.0');
  // Skill bonus giảm threshold (game_init.py:407-409) — combo_bonus=2
  const r = new PlayerData();
  for (let i = 0; i < 3; i++) r.updateCombo(true, 2);
  assert.strictEqual(r.comboStreak, 3);
  assert.strictEqual(r.comboMultiplier, 3.0, 'streak 3 với bonus 2 → ngưỡng 5-2=3 → 3.0');
});

// T12 — plan: lưu player → "reload" → load lại giống 100%
check('M5 T12: Save roundtrip + PlayerData getSaveData/loadSaveData', function () {
  const p = new PlayerData();
  p.loadSaveData({ level: 7, exp: 231, gold: 999, username: 'tester', grade: 3 });
  assert.strictEqual(p.expToNextLevel, getRequiredExp(7), 'loadSaveData phải tính lại exp_to_next');
  const snapshot = p.getSaveData();
  assert.ok(global.Save.save(global.Save.KEYS.PLAYER, snapshot), 'save phải thành công');
  // Giả lập reload: load lại từ storage vào instance mới
  const raw = global.Save.load(global.Save.KEYS.PLAYER, null);
  const p2 = new PlayerData();
  p2.loadSaveData(raw);
  assert.deepStrictEqual(p2.getSaveData(), snapshot, 'roundtrip phải giống hệt');
  assert.strictEqual(p2.expToNextLevel, getRequiredExp(7));
  // Edge: load key không tồn tại → default; load JSON hỏng → default
  assert.strictEqual(global.Save.load('mathdrill_khong_ton_tai', 'DEF'), 'DEF');
  // add_exp trên player đã load tiếp tục level-up đúng
  p2.addExp(getRequiredExp(7) - p2.exp);
  assert.strictEqual(p2.level, 8);
});

// T18 — plan: PBKDF2 hash match giữa Python (hashlib) và WebCrypto.
// Vector sinh từ game_init.hash_password format: pbkdf2$sha256$100000$salt$hex
check('M5 T18: PBKDF2 WebCrypto khớp hashlib Python 100% (4 vector, gồm mật khẩu Unicode)', async function () {
  const vec = loadVector('pbkdf2_vectors.json');
  for (const v of vec.vectors) {
    // (a) hashPassword cùng salt phải ra CHUỖI GIỐNG HỆT Python
    const jsHash = await hashPassword(v.password, v.salt);
    assert.strictEqual(jsHash, v.stored,
      'hash mismatch cho password=' + JSON.stringify(v.password));
    // (b) verifyPassword đúng mật khẩu → true
    assert.strictEqual(await verifyPassword(v.password, v.stored), true,
      'verify đúng phải true');
    // (c) sai mật khẩu → false
    assert.strictEqual(await verifyPassword(v.password + 'x', v.stored), false,
      'verify sai phải false');
    // (d) verify với stored sai định dạng → false (không crash)
    assert.strictEqual(await verifyPassword(v.password, 'garbage'), false);
  }
  // Salt ngẫu nhiên: 2 lần hash không cùng salt → khác nhau, vẫn verify được
  const h1 = await hashPassword('abc12345');
  const h2 = await hashPassword('abc12345');
  assert.notStrictEqual(h1, h2, 'salt ngẫu nhiên phải khác nhau');
  assert.strictEqual(await verifyPassword('abc12345', h1), true);
});

// Auth flow đầy đủ: register → login → defaults → sai mk → đổi mk → mk mới
check('M5: AccountSystem register/login/changePassword/lock (localStorage)', async function () {
  global.Save.clearAll();
  const auth = new AccountSystem();
  // register: validate
  assert.deepStrictEqual(await auth.register('', 'x'), { ok: false, msg: 'Không được để trống!' });
  assert.deepStrictEqual(await auth.register('alice', ''), { ok: false, msg: 'Không được để trống!' });
  const reg = await auth.register('alice', '123456', 3);
  assert.ok(reg.ok, 'register alice: ' + reg.msg);
  assert.strictEqual(reg.msg, 'Đăng ký thành công!');
  // trùng tên
  assert.deepStrictEqual((await auth.register('alice', '999')).msg, 'Tài khoản đã tồn tại!');
  // password KHÔNG được lưu plaintext
  assert.ok(AuthModule.isPasswordHashed(auth.accounts.alice.password), 'phải lưu dạng hash');
  assert.ok(auth.accounts.alice.password.indexOf('alice') < 0, 'hash không chứa plaintext');
  // login đúng
  const li = await auth.login('alice', '123456');
  assert.ok(li.ok && li.msg === 'Thành công');
  assert.strictEqual(auth.currentUser, 'alice');
  // data() defaults mirror game_init.py:4582-4591
  const d = auth.data();
  assert.strictEqual(d.grade, 3);
  assert.strictEqual(d.xp, 0);
  assert.strictEqual(d.level, 1);
  assert.strictEqual(d.gold, 0);
  assert.strictEqual(d.streak, 0);
  assert.strictEqual(d.fever_mode, false);
  assert.deepStrictEqual(d.pet, { type: 'clover', stage: 0, name: 'Cỏ Non' });
  assert.deepStrictEqual(d.unlocked_pets, ['clover']);
  assert.ok(Array.isArray(d.history) && Array.isArray(d.completed_lessons));
  // login sai mật khẩu
  assert.deepStrictEqual(await auth.login('alice', 'sai-roì'), { ok: false, msg: 'Sai tài khoản/mật khẩu' });
  // đổi mật khẩu: sai mk cũ → chặn; đúng mk cũ → ok; login bằng mk mới
  assert.deepStrictEqual((await auth.changePassword('alice', 'sai-roì', 'new999')).ok, false);
  const cp = await auth.changePassword('alice', '123456', 'new999');
  assert.ok(cp.ok && cp.msg === 'Đổi mật khẩu thành công!');
  assert.deepStrictEqual(await auth.login('alice', '123456'), { ok: false, msg: 'Sai tài khoản/mật khẩu' });
  assert.strictEqual((await auth.login('alice', 'new999')).ok, true);
    // account phải persist xuống Save (login mới thấy)
  const auth2 = new AccountSystem();
  assert.ok('alice' in auth2.accounts, 'accounts phải persist qua storage');
  assert.strictEqual((await auth2.login('alice', 'new999')).ok, true);
  // lockUser → login bị chặn đúng message Python
  auth2.lockUser('alice');
  const locked = await auth2.login('alice', 'new999');
  assert.strictEqual(locked.ok, false);
  assert.ok(locked.msg.indexOf('Tài khoản đã bị khóa') === 0, 'msg khóa: ' + locked.msg);
  // setMax (admin) — game_init.py:4556-4559
  auth2.setMax('alice');
  assert.strictEqual(auth2.accounts.alice.data.level, 9999);
  assert.strictEqual(auth2.accounts.alice.data.xp, 9800);
});

// addExp sync account (game_init.py add_xp:371-374) + persist qua Save
check('M5: addExp sync accountSystem.data() (xp/level) như add_xp Python', async function () {
  global.Save.clearAll();
  const auth = new AccountSystem();
  await auth.register('xpsync', 'pw12345', 1);
  await auth.login('xpsync', 'pw12345');
  const p = new PlayerData();
  p.loadSaveData(auth.data());
  // addExp với onLevelUp callback (thay snd_levelup.play())
  const levelUps = [];
  p.addExp(500, auth, function (newLevel) { levelUps.push(newLevel); });
  assert.strictEqual(p.level, 5);
  assert.deepStrictEqual(levelUps, [2, 3, 4, 5], 'callback mỗi lần lên cấp');
  assert.strictEqual(auth.data().xp, p.exp, 'account xp sync');
  assert.strictEqual(auth.data().level, 5, 'account level sync');
  auth.save();
  // persist: instance auth mới (giả lập lần chạy sau) vẫn thấy xp/level
  const authLater = new AccountSystem();
  assert.strictEqual(authLater.accounts.xpsync.data.level, 5);
  assert.strictEqual(authLater.accounts.xpsync.data.xp, p.exp);
});

// Session keys + Save fallback flags
check('M5: Save keys đúng plan + memory fallback trong Node', function () {
  const Save = global.Save;
  assert.deepStrictEqual(Save.KEYS, {
    PLAYER: 'mathdrill_player',
    SETTINGS: 'mathdrill_settings',
    SESSION: 'mathdrill_session',
    ACCOUNTS: 'mathdrill_accounts_local'
  });
  assert.strictEqual(Save.isPersistent(), false, 'Node không có localStorage → memory store');
  Save.save(Save.KEYS.SESSION, { last_user: 'bob' });
  assert.deepStrictEqual(Save.load(Save.KEYS.SESSION, null), { last_user: 'bob' });
  Save.remove(Save.KEYS.SESSION);
  assert.strictEqual(Save.load(Save.KEYS.SESSION, null), null);
  Save.clearAll();
  assert.strictEqual(Save.load(Save.KEYS.ACCOUNTS, null), null);
});

// Kết thúc pha đăng ký check. WebCrypto (PBKDF2 100k vòng) chạy trên
// threadpool nên các test async có thể hoàn tất SAU nhiều vòng event-loop
// → poll định kỳ thay vì setImmediate (sai thứ tự như lần chạy trước).
phaseComplete = true;
if (completed === registered) {
  summarize();
} else {
  const poll = setInterval(function () {
    if (completed >= registered) {
      clearInterval(poll);
      summarize();
    }
  }, 10);
  // An toàn: treo quá 30s → báo lỗi harness thay vì treo vô hạn
  setTimeout(function () {
    if (!summarized) {
      console.error('\nHarness timeout: chỉ ' + completed + '/' + registered + ' check hoàn tất');
      process.exit(2);
    }
  }, 30000);
}



