(function (global) {
  'use strict';
  /* =========================================================
     MathDrill Web — M9-F: SKILL TREE
     ---------------------------------------------------------
     Port từ game_init.py (source of truth):
     - SkillTreeSystem (dòng 1028-1186): unlock/upgrade/activate/passive
     - AccountSystem.get_skill_levels/unlock_skill/upgrade_skill/
       activate_skill/get_skill_bonuses/spend_skill_shield (5008-5067)
     Currency = XP (KHÔNG phải gold):
     - unlock: 50 XP (cần level >= 5, requires đã mở)
     - upgrade: cost_per_level[current_level]
     Persistence: account data `skill_levels` (skill_id -> level),
     `active_shields`; in-memory `skills[id].unlocked`.
     Active duration effects: {end_time (sec), level} — time.time() secs.
     ========================================================= */

  const UNLOCK_COST = 50;          // game_init.py: chi phí mở khóa cơ bản
  const MIN_UNLOCK_LEVEL = 5;      // "Cần đạt level 5 để mở khóa kỹ năng."

  function _fetchJson(url) {
    if (typeof fetch === 'function') {
      return fetch(url).then(function (r) { return r.json(); });
    }
    if (typeof require === 'function') {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', url);
      return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf8', function (err, data) {
          if (err) return reject(err);
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      });
    }
    return Promise.reject(new Error('No fetch or fs available'));
  }

  function loadSkills() {
    return _fetchJson('data/skills.json');
  }

  class SkillTreeSystem {
    constructor(skills, opts) {
      this.skills = skills || {};
      var o = opts || {};
      this._nowSec = o.nowSec || null;
    }
    _now() {
      if (this._nowSec) return this._nowSec();
      return Date.now() / 1000;
    }
    getSkillInfo(skillId) {
      return this.skills[skillId] || {};
    }
    getSkillsByCategory(category) {
      var out = {};
      var keys = Object.keys(this.skills);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (this.skills[k].category === category) out[k] = this.skills[k];
      }
      return out;
    }
    isSkillUnlocked(skillId) {
      var s = this.skills[skillId];
      return !!(s && s.unlocked);
    }
    // game_init.py can_unlock_skill
    canUnlockSkill(skillId, userLevel, userXp) {
      var skill = this.skills[skillId];
      if (!skill) return [false, 'Kỹ năng không tồn tại.'];
      if (userLevel < MIN_UNLOCK_LEVEL) return [false, 'Cần đạt level 5 để mở khóa kỹ năng.'];
      var requires = skill.requires || [];
      for (var i = 0; i < requires.length; i++) {
        if (!this.isSkillUnlocked(requires[i])) {
          return [false, "Cần mở khóa '" + this.skills[requires[i]].name + "' trước."];
        }
      }
      return [true, 'Có thể mở khóa.'];
    }
    // game_init.py unlock_skill — MUTATE skills[id].unlocked (in-memory như Python)
    unlockSkill(skillId, userXp) {
      var skill = this.skills[skillId];
      if (!skill) return [false, 'Kỹ năng không tồn tại.'];
      if (skill.unlocked) return [false, 'Kỹ năng đã mở khóa.'];
      if (userXp < UNLOCK_COST) return [false, 'Cần ' + UNLOCK_COST + ' XP để mở khóa.'];
      skill.unlocked = true;
      return [true, "Mở khóa '" + skill.name + "' thành công!"];
    }
    // game_init.py upgrade_skill
    upgradeSkill(skillId, userXp, currentLevel) {
      var skill = this.skills[skillId];
      if (!skill || !skill.unlocked) return [false, 'Kỹ năng chưa mở khóa.'];
      var maxLevel = skill.max_level !== undefined ? skill.max_level : 1;
      if (currentLevel >= maxLevel) return [false, 'Đã đạt cấp độ tối đa.'];
      var costList = skill.cost_per_level || [];
      if (currentLevel >= costList.length) return [false, 'Không thể nâng cấp thêm.'];
      var upgradeCost = costList[currentLevel];
      if (userXp < upgradeCost) return [false, 'Cần ' + upgradeCost + ' XP để nâng cấp.'];
      return [true, 'Nâng cấp lên cấp ' + (currentLevel + 1) + ' thành công!'];
    }
    // game_init.py activate_skill — chỉ effect_type "duration"
    activateSkill(skillId, level) {
      var skill = this.skills[skillId];
      if (!skill || skill.effect_type !== 'duration') {
        return [false, 'Kỹ năng không thể kích hoạt.'];
      }
      var duration = skill.duration !== undefined ? skill.duration : 60;
      var endTime = this._now() + duration;
      this.activeEffects = this.activeEffects || {};
      this.activeEffects[skillId] = { end_time: endTime, level: level };
      return [true, "Kích hoạt '" + skill.name + "' thành công!"];
    }
    // game_init.py is_skill_active — hết hạn → xoá
    isSkillActive(skillId) {
      this.activeEffects = this.activeEffects || {};
      if (!(skillId in this.activeEffects)) return [false, 0];
      var effect = this.activeEffects[skillId];
      if (this._now() > effect.end_time) {
        delete this.activeEffects[skillId];
        return [false, 0];
      }
      return [true, effect.level];
    }
    // game_init.py get_active_effects — prune expired
    getActiveEffects() {
      this.activeEffects = this.activeEffects || {};
      var active = {};
      var current = this._now();
      var ids = Object.keys(this.activeEffects);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (current <= this.activeEffects[id].end_time) {
          active[id] = this.activeEffects[id];
        } else {
          delete this.activeEffects[id];
        }
      }
      return active;
    }
    // game_init.py apply_skill_effects — duration skills nhân vào base
    applySkillEffects(baseValue, effectType) {
      var totalMultiplier = 1.0;
      var activeEffects = this.getActiveEffects();
      var ids = Object.keys(activeEffects);
      for (var i = 0; i < ids.length; i++) {
        var skillId = ids[i];
        var skill = this.skills[skillId] || {};
        if (skill.effect_type === 'duration' && (skill.category || '').indexOf(effectType) !== -1) {
          var level = activeEffects[skillId].level - 1;
          var multipliers = skill.multiplier || [];
          if (level < multipliers.length) {
            totalMultiplier *= multipliers[level];
          }
        }
      }
      return baseValue * totalMultiplier;
    }
    // game_init.py get_passive_bonuses
    getPassiveBonuses(userSkills) {
      var bonuses = {
        gold_multiplier: 1.0,
        xp_multiplier: 1.0,
        time_bonus: 0,
        combo_bonus: 0,
        shield_count: 0,
        retry_chance: 0.0,
        lucky_chance: 0.0
      };
      var ids = Object.keys(userSkills);
      for (var i = 0; i < ids.length; i++) {
        var skillId = ids[i];
        var level = userSkills[skillId];
        if (level <= 0) continue;
        var skill = this.skills[skillId] || {};
        if (skill.effect_type !== 'passive') continue;
        var levelIndex = level - 1;
        var category = skill.category;
        if (category === 'gold') {
          var gm = skill.multiplier || [];
          if (levelIndex < gm.length) bonuses.gold_multiplier *= gm[levelIndex];
        } else if (category === 'xp') {
          var xm = skill.multiplier || [];
          if (levelIndex < xm.length) bonuses.xp_multiplier *= xm[levelIndex];
        } else if (category === 'time') {
          var bt = skill.bonus_time || [];
          if (levelIndex < bt.length) bonuses.time_bonus += bt[levelIndex];
        } else if (category === 'combo') {
          var th = skill.combo_threshold || [];
          var du = skill.bonus_duration || [];
          if (levelIndex < th.length) bonuses.combo_bonus += th[levelIndex];
          if (levelIndex < du.length) {
            bonuses.combo_duration = (bonuses.combo_duration || 0) + du[levelIndex];
          }
        } else if (category === 'protection') {
          var sh = skill.shield_count || [];
          if (levelIndex < sh.length) bonuses.shield_count += sh[levelIndex];
        } else if (category === 'special') {
          var rc = skill.retry_chance || [];
          var lc = skill.lucky_chance || [];
          if (levelIndex < rc.length) bonuses.retry_chance = Math.max(bonuses.retry_chance, rc[levelIndex]);
          if (levelIndex < lc.length) bonuses.lucky_chance = Math.max(bonuses.lucky_chance, lc[levelIndex]);
        }
      }
      return bonuses;
    }
  }

  /* AccountSystem skill methods (game_init.py 5008-5067) — adapter qua account data.
     opts: { skillTree, accountSystem, save? } */
  class SkillManager {
    constructor(opts) {
      var o = opts || {};
      this.skillTree = o.skillTree;
      this.accountSystem = o.accountSystem;
      this._save = o.save || null;
    }
    _saveNow() {
      if (this._save) this._save();
      else if (this.accountSystem && typeof this.accountSystem.save === 'function') this.accountSystem.save();
    }
    // get_skill_levels
    getSkillLevels() {
      var d = this.accountSystem.data();
      return d.skill_levels || {};
    }
    // AccountSystem.unlock_skill (5010-5029)
    unlockSkill(skillId) {
      var d = this.accountSystem.data();
      var userLevel = d.level !== undefined ? d.level : 1;
      var userXp = d.xp !== undefined ? d.xp : 0;
      var canUnlock = this.skillTree.canUnlockSkill(skillId, userLevel, userXp);
      if (!canUnlock[0]) return [false, canUnlock[1]];
      if (userXp < UNLOCK_COST) return [false, 'Không đủ XP để mở khóa.'];
      d.xp = userXp - UNLOCK_COST;
      var skillLevels = d.skill_levels = d.skill_levels || {};
      skillLevels[skillId] = 1;
      this.skillTree.skills[skillId].unlocked = true;
      this._saveNow();
      return [true, 'Mở khóa kỹ năng thành công! (-' + UNLOCK_COST + ' XP)'];
    }
    // AccountSystem.upgrade_skill (5030-5047)
    upgradeSkill(skillId) {
      var d = this.accountSystem.data();
      var skillLevels = d.skill_levels = d.skill_levels || {};
      var currentLevel = skillLevels[skillId] !== undefined ? skillLevels[skillId] : 0;
      var userXp = d.xp !== undefined ? d.xp : 0;
      var check = this.skillTree.upgradeSkill(skillId, userXp, currentLevel);
      if (!check[0]) return [false, check[1]];
      var costList = this.skillTree.skills[skillId].cost_per_level || [];
      if (currentLevel < costList.length) {
        var upgradeCost = costList[currentLevel];
        d.xp = userXp - upgradeCost;
        skillLevels[skillId] = currentLevel + 1;
      }
      this._saveNow();
      return [true, check[1]];
    }
    // AccountSystem.activate_skill (5048-5056)
    activateSkill(skillId) {
      var d = this.accountSystem.data();
      var skillLevels = d.skill_levels || {};
      var level = skillLevels[skillId] !== undefined ? skillLevels[skillId] : 0;
      if (level <= 0) return [false, 'Kỹ năng chưa mở khóa.'];
      return this.skillTree.activateSkill(skillId, level);
    }
    // AccountSystem.get_skill_bonuses
    getSkillBonuses() {
      return this.skillTree.getPassiveBonuses(this.getSkillLevels());
    }
    // AccountSystem.spend_skill_shield (5058-5067)
    spendSkillShield() {
      var d = this.accountSystem.data();
      var shields = d.active_shields !== undefined ? d.active_shields : 0;
      if (shields <= 0) return false;
      d.active_shields = shields - 1;
      this._saveNow();
      return true;
    }
  }

  global.SkillTreeSystem = SkillTreeSystem;
  global.SkillManager = SkillManager;
  global.SKILL_UNLOCK_COST = UNLOCK_COST;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      loadSkills: loadSkills,
      SkillTreeSystem: SkillTreeSystem,
      SkillManager: SkillManager,
      SKILL_UNLOCK_COST: UNLOCK_COST,
      MIN_UNLOCK_LEVEL: MIN_UNLOCK_LEVEL
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
