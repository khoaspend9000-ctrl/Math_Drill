/* M32.5 exact-parity guard. Every assertion cites the Desktop line it enforces. */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'states_real.js'), 'utf8');
var A0 = SRC.indexOf('class AchievementState');
var A1 = SRC.indexOf('class DailyState');
var ACH = SRC.slice(A0, A1);
var LOCK = String.fromCodePoint(0x1F512);
var TROPHY = String.fromCodePoint(0x1F3C6);
var TICK = String.fromCodePoint(0x2713);
let pass = 0, fail = 0;
function chk(name, cond) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); } }

chk('ACH :1941 background s.fill((165,214,167))', /R\.clear\('#a5d6a7'\)/.test(SRC));
chk('ACH :1951 title colour (255,215,0)', /fill: 'rgb\(255,215,0\)'/.test(SRC));
chk('ACH :1958 summary at y=130', /W2 \/ 2, 130/.test(SRC));
chk('ACH :1960 y_start = 170 + scroll', /yStart = 170 \+ this\.scrollY/.test(SRC));
chk('ACH :1961 col_w = 540', /const colW = 540/.test(SRC));
chk('ACH :1966 x = 100 + col*(col_w+30)', /100 \+ col \* \(colW \+ 30\)/.test(SRC));
chk('ACH :1967 y = y_start + row*90', /yStart \+ row \* 90/.test(SRC));
chk('ACH :1968-1969 cull y<150 or y>HEIGHT-100', /if \(y < 150 \|\| y > H2 - 100\) continue/.test(SRC));
chk('ACH :1972 card fill (60,60,80)/(40,40,50) alpha 200 radius 12',
  /cardFill = isUn \? 'rgb\(60,60,80\)' : 'rgb\(40,40,50\)'/.test(SRC) &&
  /fillRoundRectAlpha\(x, y, colW, 80, 12, cardFill, 200 \/ 255\)/.test(SRC));
chk('ACH :1977/:1979 border colours, alphas, width 2, radius 12',
  /bStroke = isUn \? 'rgb\(200,170,80\)' : 'rgb\(100,100,100\)'/.test(SRC) &&
  /strokeRoundRectAlpha\(x, y, colW, 80, 12, bStroke, \(isUn \? 200 : 150\) \/ 255, 2\)/.test(SRC));
chk('ACH :1982-1985 icon at (x+15,y+25), padlock when locked',
  ACH.indexOf(LOCK) >= 0 && ACH.indexOf('x + 15, y + 25') >= 0 && ACH.indexOf(TROPHY) >= 0);
chk('ACH :1987-1989 name colours and (x+60,y+10)',
  /fill: isUn \? 'rgb\(200,170,80\)' : 'rgb\(120,120,120\)'/.test(SRC) && /x \+ 60, y \+ 10/.test(SRC));
chk('ACH :1991-1994 desc colours and (x+60,y+45)',
  /fill: isUn \? 'rgb\(180,180,180\)' : 'rgb\(90,90,90\)'/.test(SRC) && /x \+ 60, y \+ 45/.test(SRC));
chk('ACH :1991 locked desc dimmed, scoped to AchievementState',
  ACH.length > 0 && !/rgba\(255,255,255,0\.85\)/.test(ACH) && ACH.indexOf('rgb(90,90,90)') >= 0);
chk('ACH :1996-2000 XP tick + (x+col_w-100, y+45)',
  ACH.indexOf(TICK) >= 0 && /x \+ colW - 100, y \+ 45/.test(SRC));
chk('ACH :1936 wheel scroll min(0, +delta*30)', /this\.scrollY = Math\.min\(0, this\.scrollY \+ \(wheel\.deltaY \|\| 0\) \* 30\)/.test(SRC));
chk('ACH :1931 scroll_y reset on enter', /this\.scrollY = 0;/.test(SRC));
chk('ACH :1935 back transition_type PAGE', /change\('menu', null, 'PAGE'\)/.test(SRC));
chk('ACH :1929/:1942 book with empty page lambdas',
  /_wireBookState\('AchievementState'\)/.test(SRC) && /book\.draw\(R, null, null, !!book\.flipping\)/.test(SRC));

chk('PROF :2173 admin gold byte-exact', /return 'Vô hạn \(Admin\)';/.test(SRC));
chk('PROF :2173 keyed on current username', /auth\.currentUser/.test(SRC));
chk('PROF :2173 admin constant game_init.py:311', /cu === 'admin'/.test(SRC));
chk('PROF non-admin keeps numeric gold', /String\(d\.gold !== undefined \? d\.gold/.test(SRC));

var IDX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var M10 = fs.readFileSync(path.join(__dirname, 'm10a_browser_load.test.js'), 'utf8');
chk('CLS states.js NOT loaded by index.html', !/src="js\/states\.js"/.test(IDX));
chk('CLS states_real.js IS the loaded module', /src="js\/states_real\.js"/.test(IDX));
chk('CLS m10a lists states.js as NOT_LOADED legacy', /NOT_LOADED = \[[^\]]*'states\.js'/.test(M10));

var AUD = fs.readFileSync(path.join(__dirname, '..', 'js', 'audio.js'), 'utf8');
var AS = path.join(__dirname, '..', 'assets');
var af = fs.existsSync(AS) ? fs.readdirSync(AS).filter(function (f) { return /\.(mp3|ogg|wav)$/i.test(f); }) : [];
chk('CLS audio.js has BGM map + playBgm', /playBgm/.test(AUD) && /BGM_FILES/.test(AUD));
chk('CLS web/assets ships ZERO audio files (Desktop ships 40)', af.length === 0);

console.log('\nM32_5_EXACT_PARITY: pass=' + pass + ' fail=' + fail);
process.exit(fail > 0 ? 1 : 0);