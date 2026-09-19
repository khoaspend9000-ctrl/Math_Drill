'use strict';
// Run the actual UI script both as CommonJS and as a browser classic script.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const file = path.resolve(__dirname, '../js/ui.js');
const nodeUI = require(file);
const browser = {};
browser.window = browser;
vm.runInNewContext(fs.readFileSync(file, 'utf8'), browser, { filename: file });
function inspect(UI) {
  const book = new UI.RealisticBook();
  const texts = [];
  book.draw({ fillRoundRect() {}, text(value) { texts.push(String(value)); } });
  return { count: book.pageCount, firstType: typeof book.page, texts };
}
const node = inspect(nodeUI);
const web = inspect(browser.UI);
console.log(JSON.stringify({ node, browser: web }, null, 2));
assert.deepStrictEqual(node, web, 'Default book must have identical Node/browser behavior');
assert(!node.texts.includes('[object Object]'), 'Book must not render object coercion as content');
// An explicitly supplied page list must remain independent per instance.
const pages = ['First', 'Second'];
const book = new nodeUI.RealisticBook(pages);
assert.strictEqual(book.pageCount, 2);
assert.strictEqual(book.next(), true);
assert.strictEqual(book.next(), false);
book.update(1);
assert.strictEqual(book.pageIndex, 1);
book.reset();
assert.strictEqual(book.pageIndex, 0);
assert.strictEqual(book.flipping, false);
assert.deepStrictEqual(pages, ['First', 'Second']);
console.log('BOOK_RUNTIME_PROBE: 3/3 PASS');
