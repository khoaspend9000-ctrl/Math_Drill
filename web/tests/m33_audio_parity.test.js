/* M33 Desktop audio parity - every assertion cites its Desktop source line.
   Desktop audio.py is the source of truth; Web must reproduce its semantics. */
const assert=require('assert');
const R='E:/MathDrill/';
const A=require(R+'web/js/audio.js');
const fs=require('fs');
let pass=0,fail=0;
const F=(n,f)=>{try{f();pass++;console.log('PASS '+n);}catch(e){fail++;console.log('FAIL '+n+' :: '+e.message);}};
function spy(m){ const seen=[]; m._canPlay=()=>true; m.loadSound=(n)=>{seen.push(n);return {name:n,url:'x',volume:1};}; return seen; }

// T01 BGM map: audio.py:114-120 -- ONE file for every state.
F('T01 BGM_FILES all nhac_nen (audio.py:114-120)',()=>{
  ['menu','lesson','quiz','victory','defeat','default'].forEach(k=>
    assert.strictEqual(A.BGM_FILES[k],'nhac_nen.mp3','bgm '+k));
});

// T02 volume multipliers: audio.py:163-171 bgm_volume(0.3) * multiplier
F('T02 volume multipliers (audio.py:163-171)',()=>{
  const m=new A(R+'web/audio/');
  assert.strictEqual(m.bgmVolume,0.3);
  assert.ok(Math.abs(m.getBgmVolume('menu')-0.15)<1e-9,'menu');
  assert.ok(Math.abs(m.getBgmVolume('lesson')-0.18)<1e-9,'lesson');
  assert.ok(Math.abs(m.getBgmVolume('quiz')-0.24)<1e-9,'quiz');
  assert.ok(Math.abs(m.getBgmVolume('victory')-0.21)<1e-9,'victory');
  assert.ok(Math.abs(m.getBgmVolume('defeat')-0.15)<1e-9,'defeat');
});

// T03 fever scales BGM by 0.9 (audio.py:321-324)
F('T03 fever *0.9 (audio.py:321-324)',()=>{
  const m=new A(R+'web/audio/'); m.feverModeActive=true;
  assert.ok(Math.abs(m.getBgmVolume('menu')-0.27)<1e-9);
});

// T04 combo tiers: audio.py:267-283
F('T04 combo tiers (audio.py:267-283)',()=>{
  const m=new A(R+'web/audio/');
  [[0,0],[1,1],[4,1],[5,2],[9,2],[10,3],[14,3],[15,4],[19,4],[20,5],[24,5],[25,6],[99,6]]
   .forEach(([s,t])=>assert.strictEqual(m.comboTierForStreak(s),t,'streak '+s));
});

// T05 combo sound file = tier (audio.py:286)
F('T05 comboSoundForStreak = sound N (audio.py:286)',()=>{
  const m=new A(R+'web/audio/');
  assert.strictEqual(m.comboSoundForStreak(0),null);
  assert.strictEqual(m.comboSoundForStreak(3),'sound 1.mp3');
  assert.strictEqual(m.comboSoundForStreak(25),'sound 6.mp3');
});

// T06 combo volume = sfx * (1.0+tier*0.1) capped 1.6 (audio.py:290-291)
F('T06 combo volume cap 1.6 (audio.py:290-291)',()=>{
  const m=new A(R+'web/audio/'); const seen=[];
  m.sfxVolume=0.7; m._canPlay=()=>true;
  m.playSfx=(n,v)=>{seen.push([n,v]);return true;};
  m.playComboByStreak(25);
  assert.strictEqual(seen[0][0],'sound 6.mp3');
  assert.ok(Math.abs(seen[0][1]-0.7*1.6)<1e-9,'cap');
});

// T07 correct sound ONLY in TimeAttack (game_init.py:2775-2781)
F('T07 correct = TA-only sound 1 (game_init.py:2775-2781)',()=>{
  const m=new A(R+'web/audio/'); const seen=[];
  m._canPlay=()=>true; m.playSfx=(n)=>{seen.push(n);return true;};
  m.playSound('correct'); assert.strictEqual(seen.length,0,'silent in normal mode');
  m.timeAttackMode=true; m.playSound('correct');
  assert.deepStrictEqual(seen,['sound 1.mp3']);
});

// T08 semantic 'wrong' -> tra_loi_sai (audio.py:143)
F('T08 wrong -> tra_loi_sai (audio.py:143)',()=>{
  const m=new A(R+'web/audio/'); const seen=spy(m);
  m.playSfx('wrong'); assert.deepStrictEqual(seen,['tra_loi_sai.mp3']);
});

// T09 semantic name resolution (audio.py:123-128, 141-147)
F('T09 semantic name resolution (audio.py:123-147)',()=>{
  const m=new A(R+'web/audio/'); const seen=spy(m);
  m.playSfx('victory'); m.playSfx('levelup'); m.playSfx('purchase'); m.playSfx('fever_mode');
  assert.deepStrictEqual(seen,['victory.mp3','level_up.mp3','purchase.mp3','fever.mp3']);
});

// T10 setBgm does NOT restart the same file (audio.py:187-194)
F('T10 setBgm no-restart on same file (audio.py:187-194)',()=>{
  const m=new A(R+'web/audio/');
  assert.strictEqual(typeof m.setBgm,'function');
  assert.strictEqual(typeof m.set_bgm,'function');
  let restarts=0;
  m.mixerWorks=true; m.unlocked=true; m.soundEnabled=true;
  m._bgm={paused:false,volume:0.1}; m._bgmInfo={file:'nhac_nen.mp3',volume:0.1};
  m.playBgm=()=>{restarts++;return true;};
  m.setBgm('lesson');
  assert.strictEqual(restarts,0,'same file must not restart');
  assert.ok(Math.abs(m._bgm.volume-0.18)<1e-9,'volume -> lesson 0.18');
});

// T11 assets exist
F('T11 nhac_nen.ogg exists',()=>{
  assert.ok(fs.existsSync(R+'web/audio/nhac_nen.ogg'));
  assert.ok(fs.statSync(R+'web/audio/nhac_nen.ogg').size>100000);
});

// T12 all 18 tracked audio assets present
F('T12 all 18 web/audio assets present',()=>{
  const f=fs.readdirSync(R+'web/audio');
  assert.strictEqual(f.length,18,'got '+f.length);
  ['nhac_nen.ogg','combo.ogg','defeat.ogg','gacha5sao.ogg','level_up.ogg','purchase.ogg',
   'tra_loi_dung.ogg','tra_loi_sai.ogg','victory.ogg','victory_bgm.ogg','xp_gain.ogg',
   'sound 1.ogg','sound 2.ogg','sound 3.ogg','sound 4.ogg','sound 5.ogg','sound 6.ogg','bgm_main.ogg']
   .forEach(n=>assert.ok(f.includes(n),'missing '+n));
});

// T13 combo tier .mp3 resolves to .ogg (_resolve_audio_file)
F('T13 combo tiers resolve to .ogg',()=>{
  const m=new A(R+'web/audio/');
  for(let t=1;t<=6;t++) assert.strictEqual(m.resolveAudioFile('sound '+t+'.mp3'),'sound '+t+'.ogg');
});

// T14 missing asset degrades gracefully (audio.py:80-82, :248)
F('T14 missing asset returns null, no throw (audio.py:80-82)',()=>{
  const m=new A(R+'web/audio/');
  m.initAudio(); m.unlocked=true; m._canPlay=()=>true;
  assert.strictEqual(m.loadSound('nope_does_not_exist.mp3'),null);
  assert.strictEqual(m.playSfx('nope_does_not_exist.mp3'),false);
});

// T15 web-build deferral honoured: locked => silent (audio.py:150-161)
F('T15 locked audio plays nothing (audio.py:150-161)',()=>{
  const m=new A(R+'web/audio/');
  m.initAudio(); m.unlocked=false;
  assert.strictEqual(m._canPlay(),false);
  assert.strictEqual(m.playBgm('menu'),false);
});

// T16 states wire setBgm at Desktop call sites (main.py:1022,1093,1434)
F('T16 Victory/Defeat/Lesson call setBgm (main.py:1022,1093,1434)',()=>{
  const s=fs.readFileSync(R+'web/js/states_real.js','utf8');
  assert.ok(s.indexOf("setBgm('victory')")>=0,'victory'); 
  assert.ok(s.indexOf("setBgm('defeat')")>=0,'defeat'); 
  assert.ok(s.indexOf("setBgm('lesson')")>=0,'lesson'); 
});

// T17 first user gesture starts menu BGM (main.py:3648-3650)
F('T17 first gesture -> setBgm menu (main.py:3648-3650)',()=>{
  const s=fs.readFileSync(R+'web/js/main.js','utf8');
  assert.ok(s.indexOf("setBgm('menu')")>=0,'menu bgm on unlock'); 
  assert.ok(/once: true/.test(s),'one-shot listeners');
});

// T18 combo sound wired (game_init.py:422-426)
F('T18 combo sound wired (game_init.py:422-426)',()=>{
  const s=fs.readFileSync(R+'web/js/player.js','utf8');
  assert.ok(/playComboByStreak/.test(s));
  assert.ok(s.indexOf('if (!silent)')>=0,'silent respected (TimeAttack)'); 
});

console.log('\nM33_AUDIO_PARITY: pass='+pass+' fail='+fail);
process.exit(fail>0?1:0);
