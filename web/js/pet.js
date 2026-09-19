// placeholder
(function (global) {
  'use strict';
  const L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };
  function _fetchJson(url) {
    if (typeof fetch === 'function') { return fetch(url).then(function (r) { return r.json(); }); }
    if (typeof require === 'function') {
      const fs = require('fs'); const path = require('path');
      const filePath = path.join(__dirname, '..', url);
      return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf8', function (err, data) {
          if (err) return reject(err);
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
    }
    return Promise.reject(new Error('No fetch or fs available'));
  }
  function PetSystem(petTypes) { this.petTypes = petTypes || {}; this._ready = !!petTypes; }
  PetSystem.prototype = {
    load: function () { var self = this; return _fetchJson('data/pets.json').then(function (d) { self.petTypes = d; self._ready = true; return d; }); },
    getPetInfo: function (petType, stage) { if (!this.petTypes || !this.petTypes[petType]) return null; var s = this.petTypes[petType].stages; if (!s || stage < 0 || stage >= s.length) return null; return s[stage]; },
    getMaxStage: function (petType) { if (!this.petTypes || !this.petTypes[petType]) return 0; var s = this.petTypes[petType].stages; return s ? s.length - 1 : 0; },
    getPrice: function (petType) { if (!this.petTypes || !this.petTypes[petType]) return 0; return Math.floor(this.petTypes[petType].price || 0); },
    canEvolve: function (petType, currentStage, currentXp) {
      var maxStage = this.getMaxStage(petType);
      if (currentStage >= maxStage) return false;
      var next = this.getPetInfo(petType, currentStage + 1);
      if (!next) return false;
      var xpReq = next.xp_required !== undefined ? next.xp_required : 0;
      return currentXp >= xpReq;
    },
    getEvolutionProgress: function (petType, currentStage, currentXp) {
      var maxStage = this.getMaxStage(petType);
      if (currentStage >= maxStage) return 100;
      var cur = this.getPetInfo(petType, currentStage); var next = this.getPetInfo(petType, currentStage + 1);
      if (!cur || !next) return 0;
      var curReq = cur.xp_required !== undefined ? cur.xp_required : 0;
      var nextReq = next.xp_required !== undefined ? next.xp_required : 0;
      var range = nextReq - curReq;
      if (!(range > 0)) return 100;
      var progress = currentXp - curReq;
      return Math.min(100, Math.max(0, (progress / range) * 100));
    },
    getStageInfo: function (petType, stage) { return this.getPetInfo(petType, stage); },
    getType: function (petType) { return this.petTypes ? this.petTypes[petType] : null; },
    isReady: function () { return this._ready; }
  };
  global.PetSystem = PetSystem;

  function PetManager(opts) {
    this.petSystem = opts && opts.petSystem ? opts.petSystem : new PetSystem();
    this.data = opts && opts.data ? opts.data : {};
    this.isAdmin = !!(opts && opts.isAdmin);
    this._save = (opts && typeof opts.save === 'function') ? opts.save : function () {};
  }
  PetManager.DEFAULT_UNLOCKED_PETS = ['clover'];
  PetManager.prototype = {
    getUnlockedPets: function () { this._needData(); return this.data.unlocked_pets || PetManager.DEFAULT_UNLOCKED_PETS.slice(); },
    purchasePet: function (petType) {
      if (!this.petSystem || !this.petSystem.getType(petType)) return { ok: false, msg: 'Thú cưng không tồn tại.' };
      var unlocked = this.getUnlockedPets();
      if (unlocked.indexOf(petType) >= 0) return { ok: false, msg: 'Đã sở hữu thú cưng này.' };
      var price = this.petSystem.getPrice(petType);
      var gold = Math.floor((this.data.gold !== undefined ? this.data.gold : 0));
      if (!this.isAdmin) { if (gold < price) return { ok: false, msg: 'Không đủ vàng để mua.' }; this.data.gold = gold - price; }
      if (!this.data.unlocked_pets) this.data.unlocked_pets = PetManager.DEFAULT_UNLOCKED_PETS.slice();
      this.data.unlocked_pets.push(petType);
      this._save();
      return { ok: true, msg: 'Mua thành công (' + price + ' vàng).', spent: price };
    },
    changePetType: function (newPetType) {
      if (!this.petSystem || !this.petSystem.getType(newPetType)) return false;
      var unlocked = this.getUnlockedPets();
      if (unlocked.indexOf(newPetType) < 0) return false;
      var stage0 = this.petSystem.getPetInfo(newPetType, 0);
      if (stage0) {
        this.data.pet = { type: newPetType, stage: 0, name: stage0.name !== undefined ? stage0.name : newPetType };
        this._save();
        return true;
      }
      return false;
    },
    getCurrentPet: function () { this._needData(); return this.data.pet || { type: 'clover', stage: 0, name: 'Cỏ Non' }; },
    canEvolvePet: function () {
      this._needData();
      var pet = this.getCurrentPet();
      var currentXp = (this.data.xp !== undefined ? this.data.xp : 0);
      return this.petSystem.canEvolve(pet.type, pet.stage, currentXp);
    },
    evolvePet: function () {
      this._needData();
      if (!this.canEvolvePet()) return false;
      var pet = this.getCurrentPet();
      var newStage = pet.stage + 1;
      var info = this.petSystem.getPetInfo(pet.type, newStage);
      if (info) { pet.stage = newStage; pet.name = info.name; this.data.pet = pet; this._save(); return true; }
      return false;
    },
    _needData: function () { if (!this.data) this.data = {}; }
  };
  global.PetManager = PetManager;
  if (typeof module !== 'undefined' && module.exports) { module.exports = { PetSystem: PetSystem, PetManager: PetManager }; }
})(typeof window !== 'undefined' ? window : globalThis);
