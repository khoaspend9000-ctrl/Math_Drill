// M24-P1 regression: session restore on reload must not be silently removed again.
const fs=require('fs');
const SR='E:/MathDrill/web/js/states_real.js';
const AU='E:/MathDrill/web/js/auth.js';
const src=fs.readFileSync(SR,'utf8');
const auth=fs.readFileSync(AU,'utf8');
let pass=0,fail=0;const bad=[];
function chk(n,f,d){ if(f)pass++; else{fail++;bad.push(n+(d?(' :: '+d):''));} console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):''));}

chk('AccountSystem.me() exists (auth.js:401)', /async me\(\)\s*\{/.test(auth));
chk('me() wraps GET /api/auth/me', /backendMe\(\)/.test(auth) && /'\/api\/auth\/me'/.test(auth));
chk('LoginState calls _restoreSession() from enter()',
    /enter\(params\)[\s\S]{0,900}this\._restoreSession\(\)/.test(src));
chk('_restoreSession is defined', /_restoreSession\(\)\s*\{/.test(src));
chk('restore validates the session via auth.me() (not a shortcut)',
    /auth\.me\(\)/.test(src));
chk('restore pulls server player data (same call as _onLogin)',
    /pullPlayerData\(\)/.test(src));
chk('restore maps xp->exp through accountToPlayerSave (M10-QA2 fix kept)',
    /loadSaveData\(accountToPlayerSave\(d\)\)/.test(src));
chk('restore routes the player to the menu', /states\.change\('menu'/.test(src));
chk('restore is failure-safe (.catch) so login never breaks',
    /\}\)\s*\.catch\(function/.test(src) || /\.catch\(function \(e\)/.test(src));
chk('restore only auto-advances for a real BACKEND user object (username present)',
    /typeof user !== 'object' \|\| !user\.username/.test(src));

console.log('');
console.log('M24_SESSION_RESTORE: pass='+pass+' fail='+fail);
if(bad.length)console.log('FAILED: '+bad.join(' | '));
process.exit(fail?1:0);
