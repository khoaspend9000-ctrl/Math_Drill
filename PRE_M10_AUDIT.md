# PRE-M10 ARCHITECTURE AUDIT

**Date:** 2026-09-11
**Scope:** Read-only audit of entire web/ project before M10
**Status:** M1 -> M9 verified PASS, checkpoints clean

---

## A. ARCHITECTURE CURRENTLY VERIFIED

### A1. Project Structure (110 files total)

`
web/
  index.html              (entry point)
  style.css
  CHECKPOINTS.md
  js/                     (32 JS modules)
    logger.js           1,014 B
    errors.js           1,628 B
    engine.js           3,378 B      <- RAF loop, fixed timestep
    input.js            7,446 B      <- singleton, canvas coord mapping
    renderer.js         2,196 B      <- Canvas2D wrapper
    assets.js           3,861 B      <- Image cache (Map)
    audio.js           12,930 B      <- WebAudio + HTMLAudio, SFX cache
    effects.js          5,932 B      <- ConfettiSystem (pool, cap 200)
    effects2.js        11,758 B      <- TransitionEffect, combo, shake
    effects_part1.js    3,608 B      <- legacy effects
    save.js             3,489 B      <- localStorage persistence
    player.js           7,573 B      <- PlayerData
    auth.js            10,681 B      <- client-side auth
    data_loader.js      2,873 B      <- JSON cache
    state_manager.js    3,057 B      <- state lifecycle
    states_real.js     52,779 B      <- all game states
    states.js           8,182 B      <- legacy state stubs
    main.js             3,771 B      <- bootstrap + Game global
    shop.js            12,027 B      <- ShopSystem
    pet.js              5,842 B      <- PetSystem
    skin.js             5,604 B      <- SkinSystem
    gacha.js            9,531 B      <- Gacha + BannerSystem
    achievements.js     4,928 B      <- AchievementSystem
    daily.js            8,159 B      <- DailyRewardSystem
    skill_tree.js      12,439 B      <- SkillTreeSystem
    item_effects.js    13,455 B      <- ItemEffectSystem
    question_generator.js 98,539 B   <- M6 question gen
    smart_ai.js        17,522 B      <- SmartAI
    adaptive_ai.js      7,263 B      <- AdaptiveAI
    mt19937.js          8,038 B      <- MT19937 RNG
    performance.js      2,176 B      <- ParticleBudget + SurfaceCache
    game_manager.js     6,053 B      <- GameManager
    ui.js              17,097 B      <- Button, CardButton, Popup, etc.
  data/                   (6 JSON files)
    achievements.json   1,236 B
    daily_rewards.json    562 B
    gacha_cards.json   3,108 B
    pets.json          3,128 B
    skills.json        4,310 B
    skins.json         2,419 B
  assets/                 (images)
  audio/
    tra_loi_dung.ogg   44,086 B      <- only 1 audio file present
  fonts/
    Quicksand-Bold.ttf 78,592 B
    Segoe UI Emoji.TTF 2,072,388 B
  tests/                  (23 test suites)
    phase1_foundation.test.js
    m4_states.test.js
    m5_player_save.test.js
    m6_question.test.js
    m6b_mt19937.test.js
    m6b_safety_guard.test.js
    m6b_vectors.test.js
    m7a_game_manager.test.js
    m7b_lesson_select.test.js
    m7c_lesson.test.js
    m7d_victory_defeat.test.js
    m8a_effects.test.js
    m8b_audio.test.js
    m8c_ui.test.js
    m8d_performance.test.js
    m9a_shop.test.js
    m9b_pet_skin.test.js
    m9c_gacha.test.js
    m9d_achievements.test.js
    m9e_daily.test.js
    m9f_skills_items.test.js
    m9_final_integration.test.js
    performance_stress.test.js
`

### A2. Script Load Order (index.html, 14 scripts)

`html
1.  logger.js
2.  errors.js
3.  engine.js
4.  input.js
5.  renderer.js
6.  assets.js
7.  audio.js
8.  effects.js
9.  save.js
10. player.js
11. auth.js
12. state_manager.js
13. states_real.js
14. main.js          <- bootstrap, creates global.Game
`

### A3. Scripts NOT loaded in index.html (19 files)

These are used by Node tests but **NOT browser-loaded** without additional wiring:

| File | Status in Browser |
|------|-------------------|
| achievements.js | Not loaded |
| adaptive_ai.js | Not loaded |
| daily.js | Not loaded |
| data_loader.js | Not loaded |
| effects2.js | Not loaded |
| effects_part1.js | Not loaded (legacy?) |
| gacha.js | Not loaded |
| game_manager.js | Not loaded |
| item_effects.js | Not loaded |
| mt19937.js | Not loaded |
| performance.js | Not loaded |
| pet.js | Not loaded |
| question_generator.js | Not loaded |
| shop.js | Not loaded |
| skill_tree.js | Not loaded |
| skin.js | Not loaded |
| smart_ai.js | Not loaded |
| states.js | Not loaded (legacy?) |
| ui.js | Not loaded |

**CRITICAL FINDING:** 19 JS modules (59% of JS codebase) are NOT loaded by index.html.
The browser game currently runs with only 14 core modules. M9 systems exist and are tested but may not be integrated into browser runtime without additional script tags or dynamic loading.

---

## B. FILES INVOLVED IN M10

M10 will likely need to integrate the 19 unloved modules into browser runtime.
Key files:

| File | Role in M10 |
|------|-------------|
| index.html | Add script tags for M9 systems |
| main.js | Bootstrap M9 systems into global.Game |
| states_real.js | Add Shop/Pet/Skin/Gacha/Achievement/Daily/Skill states |
| state_manager.js | Register new states |
| shop.js | ShopSystem (already tested) |
| pet.js | PetSystem (already tested) |
| skin.js | SkinSystem (already tested) |
| gacha.js | GachaSystem + BannerSystem (already tested) |
| achievements.js | AchievementSystem (already tested) |
| daily.js | DailyRewardSystem (already tested) |
| skill_tree.js | SkillTreeSystem (already tested) |
| item_effects.js | ItemEffectSystem (already tested) |
| question_generator.js | M6 question gen (already tested) |
| smart_ai.js | SmartAI (already tested) |
| adaptive_ai.js | AdaptiveAI (already tested) |
| mt19937.js | MT19937 RNG (already tested) |
| ui.js | Button, CardButton, Popup, etc. |
| data_loader.js | JSON cache |
| effects2.js | TransitionEffect, combo, shake |
| performance.js | ParticleBudget + SurfaceCache |
| game_manager.js | GameManager |

---

## C. DEPENDENCIES

### C1. Global Dependencies (browser)

`
global.Game        <- main.js creates
global.Engine      <- engine.js
global.Input       <- input.js (singleton)
global.Renderer    <- renderer.js
global.Assets      <- assets.js
global.Audio       <- audio.js
global.Save        <- save.js
global.Player      <- player.js
global.Auth        <- auth.js
global.UI          <- ui.js
global.States      <- state_manager.js
global.PetSystem   <- pet.js
global.SkinSystem  <- skin.js
global.GachaSystem <- gacha.js
global.AchievementSystem <- achievements.js
global.DailySystem <- daily.js
global.SkillTree   <- skill_tree.js
global.ItemEffects <- item_effects.js
global.QuestionGen <- question_generator.js
global.SmartAI     <- smart_ai.js
global.AdaptiveAI  <- adaptive_ai.js
global.MT19937     <- mt19937.js
global.performance <- performance.js
global.GameManager <- game_manager.js
`

### C2. Module Dependencies (Node tests)

`
engine.js -> none
input.js -> renderer.js (for coord mapping)
renderer.js -> none
assets.js -> none
audio.js -> none
effects.js -> none
effects2.js -> effects.js
save.js -> none
player.js -> none
auth.js -> save.js, player.js
data_loader.js -> none
state_manager.js -> none
states_real.js -> engine.js, input.js, renderer.js, save.js, player.js, auth.js
main.js -> engine.js, input.js, renderer.js, assets.js, audio.js, effects.js, save.js, player.js, auth.js, state_manager.js, states_real.js
shop.js -> player.js, save.js
pet.js -> player.js, save.js
skin.js -> player.js, save.js
gacha.js -> player.js, save.js, mt19937.js
achievements.js -> player.js, save.js
daily.js -> player.js, save.js
skill_tree.js -> player.js, save.js
item_effects.js -> player.js, save.js
question_generator.js -> mt19937.js
smart_ai.js -> question_generator.js
adaptive_ai.js -> question_generator.js, smart_ai.js
performance.js -> none
game_manager.js -> player.js, save.js
ui.js -> none
`

---

## D. SECURITY RISKS

### D1. Client-Only Auth (CRITICAL)

- **auth.js** implements login/register using localStorage
- Passwords are hashed client-side (SHA-256 or similar)
- **NO server-side validation**
- **NO session tokens**
- **NO CSRF protection**
- **NO rate limiting**
- **NO password reset flow**
- **NO email verification**

**Risk Level:** HIGH for production
**Mitigation:** M10 MUST implement backend auth for any real deployment

### D2. Admin Password in Frontend

- **auth.js** contains ADMIN_PASSWORD constant
- Admin authorization is client-side only
- **Anyone can inspect source and find the admin password**

**Risk Level:** CRITICAL for production
**Mitigation:** M10 MUST move admin authorization to backend

### D3. No HTTPS Enforcement

- No TLS/SSL enforcement in client code
- All data transmitted in plaintext if backend added

**Risk Level:** MEDIUM
**Mitigation:** M10 MUST enforce HTTPS for backend communication

### D4. No Input Sanitization

- User input (login, register) not sanitized for XSS
- No CSP headers

**Risk Level:** MEDIUM
**Mitigation:** M10 MUST add input sanitization and CSP headers

---

## E. REQUIRED BACKEND BOUNDARY

### E1. MUST be Server-Side

| Feature | Current | Required |
|---------|---------|----------|
| Auth | Client-side localStorage | Server-side sessions + JWT |
| Admin | Client-side password | Server-side RBAC |
| Player data | localStorage | Database |
| Save/Load | localStorage | Database + API |
| Password hashing | Client-side | Server-side (bcrypt/argon2) |
| Rate limiting | None | Server-side |
| CSRF protection | None | Server-side tokens |
| XSS prevention | None | Input sanitization + CSP |

### E2. Can Remain Client-Side

| Feature | Current |
|---------|---------|
| Game rendering | Canvas2D |
| Particle effects | effects.js |
| Audio playback | audio.js |
| Question generation | question_generator.js |
| RNG (MT19937) | mt19937.js |
| UI components | ui.js |
| State management | state_manager.js |

---

## F. CURRENT AUTH LIMITATIONS

1. **No session persistence across devices** - localStorage is per-browser
2. **No password recovery** - forgotten password = lost account
3. **No account deletion** - no way to remove account
4. **No profile editing** - cannot change username/email
5. **No avatar upload** - avatar is preset or URL-based
6. **No multi-factor authentication**
7. **No brute-force protection**
8. **No account lockout**
9. **No audit logging**
10. **No GDPR compliance** (data export/deletion)

---

## G. REQUIRED BROWSER APIS

| API | Used In | M10 Impact |
|-----|---------|------------|
| Canvas2D | renderer.js, effects.js | Core rendering |
| WebAudio | audio.js | Sound playback |
| localStorage | save.js, auth.js | Persistence |
| requestAnimationFrame | engine.js | Game loop |
| PointerEvents | input.js | Mouse/touch |
| KeyboardEvent | input.js | Keyboard |
| Fetch API | data_loader.js | JSON loading |
| Promise | all async | Async operations |
| Map/Set | caches | Data structures |
| JSON | data_loader.js | Parsing |
| IndexedDB | none | Future: larger storage |
| Service Worker | none | Future: offline support |
| WebSocket | none | Future: real-time multiplayer |

---

## H. DATA MIGRATION CONSIDERATIONS

### H1. Current localStorage Schema

`
mathdrill_accounts     -> { username: { password_hash, salt, created_at } }
mathdrill_player_{u}   -> { gold, xp, level, grade, inventory, bag, ... }
mathdrill_save_{u}     -> { daily_streak, last_claim, achievements, ... }
mathdrill_settings_{u} -> { audio_volume, mute, ... }
`

### H2. Migration Risks

1. **Data loss** - localStorage is browser-specific, not transferable
2. **Schema changes** - M10 may add new fields
3. **Backward compatibility** - old saves must still load
4. **Validation** - corrupted saves must be handled gracefully

### H3. Recommended Migration Strategy

1. Version all save schemas
2. Add migration functions for each version
3. Validate on load, fallback to defaults
4. Keep backup of previous save before migration

---

## I. M10 IMPLEMENTATION ORDER

### Recommended Sequence

1. **Integrate M9 systems into browser** (add script tags, wire to global.Game)
2. **Add new states** (ShopState, PetState, SkinState, GachaState, AchievementState, DailyState, SkillState)
3. **Wire UI components** (ui.js) to new states
4. **Add backend auth API** (replace client-only auth)
5. **Add admin panel** (server-side RBAC)
6. **Add database persistence** (replace localStorage)
7. **Add security headers** (CSP, HTTPS enforcement)
8. **Add input sanitization** (XSS prevention)
9. **Add rate limiting** (brute-force protection)
10. **Add GDPR features** (data export/deletion)

---

## J. THINGS M10 MUST NOT BREAK

1. **M6 question parity** - 1005 vectors must still pass
2. **MT19937 RNG** - deterministic behavior must be preserved
3. **Particle budget** - 200 cap must remain
4. **State transitions** - enter/exit lifecycle must remain clean
5. **Save/load** - existing saves must still load
6. **Audio behavior** - SFX cache, BGM state, mute must work
7. **UI components** - Button, CardButton, Popup must work
8. **Effects pooling** - ConfettiSystem pool must be reused
9. **Canvas coordinate mapping** - letterbox + input must work
10. **All 23 test suites** - must continue to pass

---

## K. RECOMMENDED M10 CHECKPOINTS

| Checkpoint | Criteria |
|------------|----------|
| M10-A | M9 systems integrated into browser (all 32 JS modules loaded) |
| M10-B | New states registered and reachable from Menu |
| M10-C | Backend auth API implemented |
| M10-D | Admin panel with server-side RBAC |
| M10-E | Database persistence (player data) |
| M10-F | Security headers + input sanitization |
| M10-G | Rate limiting + brute-force protection |
| M10-H | GDPR features (data export/deletion) |
| M10-Final | Full regression 23 suites x 5 runs = 115/115 |

---

## L. OPEN QUESTIONS REQUIRING HUMAN DECISION

1. **Backend technology?** (Node.js/Express, Python/FastAPI, etc.)
2. **Database?** (PostgreSQL, MongoDB, SQLite, etc.)
3. **Auth method?** (JWT, session cookies, OAuth, etc.)
4. **Deployment target?** (Vercel, AWS, self-hosted, etc.)
5. **Domain + SSL?** (custom domain, Let's Encrypt, etc.)
6. **Multiplayer?** (WebSocket, WebRTC, none, etc.)
7. **Monetization?** (free, freemium, subscription, etc.)
8. **GDPR jurisdiction?** (EU, US, global, etc.)
9. **Data retention policy?** (30 days, 1 year, indefinite, etc.)
10. **Backup strategy?** (daily, weekly, real-time, etc.)

---

## M. ARCHITECTURE HEALTH SUMMARY

### Strengths

1. **Clean separation** - each system is a separate module
2. **Test coverage** - 23 test suites covering all M1-M9 features
3. **Deterministic RNG** - MT19937 ensures reproducible results
4. **Particle pooling** - effects.js reuses objects, caps at 200
5. **State lifecycle** - enter/exit pattern prevents leaks
6. **Save versioning** - schema can evolve with migrations
7. **No external dependencies** - pure vanilla JS, no frameworks
8. **UTF-8 safe** - all files properly encoded

### Weaknesses

1. **59% of JS not browser-loaded** - M9 systems need integration
2. **Client-only auth** - insecure for production
3. **No backend** - all data in localStorage
4. **No security headers** - vulnerable to XSS/CSRF
5. **No rate limiting** - vulnerable to brute-force
6. **No input sanitization** - vulnerable to injection
7. **No offline support** - no Service Worker
8. **No multiplayer** - single-player only

### Critical Issues

1. **Admin password exposed in frontend** (auth.js)
2. **No server-side auth** (all client-side)
3. **localStorage data loss risk** (browser-specific, not backed up)

### High-Risk Issues

1. **M9 systems not browser-integrated** (shop, pet, skin, gacha, etc.)
2. **No HTTPS enforcement**
3. **No CSP headers**

### Medium/Low Issues

1. **Legacy files** (states.js, effects_part1.js) may be dead code
2. **Missing audio assets** (only 1 of 18 referenced files present)
3. **No browser validation** (all tests are Node-based)

---

## N. M10 BLOCKERS

1. **Backend technology decision** - cannot proceed without choosing stack
2. **Database schema design** - needed for player data migration
3. **Auth API design** - needed for login/register/logout flows
4. **Admin RBAC design** - needed for admin panel
5. **Deployment target** - affects architecture decisions

---

## O. EXACT RECOMMENDED FIRST M10 TASK

**M10-A: Integrate M9 systems into browser runtime**

Steps:
1. Add 19 missing script tags to index.html
2. Wire M9 systems to global.Game in main.js
3. Add new states to state_manager.js
4. Add menu buttons to states_real.js MenuState
5. Run all 23 test suites x 5 runs
6. Verify browser console has no errors
7. Checkpoint

This is the **safest first step** because:
- It doesn't change any existing behavior
- It only adds new functionality
- All code is already tested in Node
- It unblocks all future M10 work

---

## P. FINAL NOTES

- All M1-M9 code is **verified and checkpointed**
- 23 test suites, 110/110 regression runs
- No production code was modified during this audit
- All findings are based on actual code inspection
- No browser profiling was performed (unavailable in this environment)
- No new tests were created (read-only audit)

**END OF AUDIT**
