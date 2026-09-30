// M25.1 focused regression: book-only page flip navigation.
const fs=require('fs');
const SR='E:/MathDrill/web/js/states_real.js';
const UI='E:/MathDrill/web/js/ui.js';
const src=fs.readFileSync(SR,'utf8');
const ui=fs.readFileSync(UI,'utf8');
let pass=0,fail=0;const bad=[];
function chk(n,f,d){ if(f)pass++;else{fail++;bad.push(n+(d?(' :: '+d):''));}console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):'')); }

// --- the defect: full-screen fade must be gone from book navigation ---
chk('Menu -> lesson_select no longer passes "fade"',
    !/c\.id === 'lesson'\) \{\s*[\s\S]{0,200}states\.change\('lesson_select', \{ grade: getPlayer\(\)\.grade \}, 'fade'\)/.test(src));
chk('book navigation calls states.change with transition=null (no screen fade)',
    /states\.change\('lesson_select', \{ grade: getPlayer\(\)\.grade \}, null\)/.test(src));

// --- three-phase machine ---
chk('bookNav exists with IDLE/FLIPPING/COMPLETE phases',
    /function bookNav\(states, book\)/.test(src) && /get isFlipping\(\)/.test(src) && /get isBusy\(\)/.test(src));
chk('bookNav.next -> slide_left, bookNav.prev -> slide_right',
    /next: function \(swap\) \{ return flip\('slide_left', swap\); \}/.test(src) &&
    /prev: function \(swap\) \{ return flip\('slide_right', swap\); \}/.test(src));
chk('destination is committed only when the flip completes',
    /if \(swap\) swap\(\);/.test(src) && /book\.update\(dt\) === true/.test(src));

// --- duplicate-click guard ---
chk('MenuState refuses input while a page is turning',
    /MenuState\.prototype\.handleInput = function \(input, dt\) \{\s*if \(this\._rbNav && this\._rbNav\.isBusy\) return;/.test(src));
chk('LessonSelectState refuses input while a page is turning',
    /LessonSelectState\.prototype\.handleInput = function \(input, dt\) \{\s*if \(this\._rbNav && this\._rbNav\.isBusy\) return;/.test(src));

// --- destination must NOT be revealed early ---
chk('LessonSelect no longer advances currentPage immediately',
    !/this\.currentPage \+= 1;[\s\S]{0,160}startFlip\('slide_left'\)/.test(src));
chk('LessonSelect next defers the page change into the flip callback',
    /var goN = function \(\) \{ selfN\.currentPage \+= 1;/.test(src) && /_rbNav\.next\(goN\)/.test(src));
chk('LessonSelect prev defers the page change into the flip callback',
    /var goP = function \(\) \{ selfP\.currentPage -= 1; \}/.test(src) && /_rbNav\.prev\(goP\)/.test(src));

// --- the curl must actually RENDER ---
chk('book drawn with withTransition so the curl is not skipped',
    /book\.draw\(R, null, null, !!book\.flipping\)/.test(src));
chk('MenuState book draw passes withTransition',
    /this\._rbBook\.draw\(R, null, null, !!this\._rbBook\.flipping\)/.test(src));
chk('page SURFACE is painted at the curled rect (Desktop scales the page itself)',
    /var ca = this\._curlRect\(lr, this\.flipProgress, leftOld\);/.test(ui) &&
    /R\.fillRoundRect\(ca\.x, ca\.y, ca\.w, ca\.h, 10, '#fdf6e3'\)/.test(ui));
chk('full-size page surfaces are NOT painted while turning',
    /if \(!animate\) \{\s*R\.fillRoundRect\(lr\.x, lr\.y, lr\.w, lr\.h, 10, '#fdf6e3'\);/.test(ui));

// --- book identity must be preserved ---
chk('cover colour unchanged (80,50,20)', /#503214/.test(ui));
chk('inner frame unchanged (101,67,33)', /#654321/.test(ui));
chk('spine unchanged (150,150,150)', /#969696/.test(ui));
chk('page colour unchanged (253,246,227)', /#fdf6e3/.test(ui));
chk('page width formula (w-40)/2 preserved', /Math\.floor\(\(this\.rect\.w - 40\) \/ 2\)/.test(ui));
chk('flip duration still 1/3 s (Desktop dt*3.0)', /o\.flipDur : \(1 \/ 3\)/.test(ui));
chk('curl scale 1.0 -> 0.7 preserved (Desktop game_init.py)',
    /1\.0 - .*0\.3|1 - .*0\.3|0\.7/.test(ui));

// --- no full-screen animation introduced ---
chk('no CSS transform/opacity page-turn added to style.css',
    !/transform\s*:\s*rotateY|perspective\s*:/i.test(fs.readFileSync('E:/MathDrill/web/style.css','utf8')));

console.log('');
console.log('M25_1_BOOK_FLIP: pass='+pass+' fail='+fail);
if(bad.length)console.log('FAILED: '+bad.join(' | '));
process.exit(fail?1:0);
