const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const guardDetachedStylesheet = require('./css-hmr-detached-link-loader.cjs');

// Execute the actual Next-bundled runtime, not a reimplementation of its callbacks.
const source = readFileSync(require.resolve('next/dist/compiled/mini-css-extract-plugin/hmr/hotModuleReplacement.js'), 'utf8');

function reloadCss(transform = guardDetachedStylesheet) {
  const dom = new JSDOM('<!doctype html><head><link rel="stylesheet" href="http://localhost/style.css"></head>');
  const original = dom.window.document.querySelector('link');
  let update;
  const context = {
    module: { exports: {} },
    document: dom.window.document,
    console: { log() {} },
    setTimeout(callback) { update = callback; return 1; },
    clearTimeout() {},
    __dirname,
  };
  vm.runInNewContext(transform(source), context);
  context.module.exports('test-style', { locals: true })();
  update();
  const replacement = original.nextSibling;
  assert.ok(replacement, 'HMR must insert a replacement stylesheet');
  return { dom, original, replacement };
}

test('reproduces the original detached-link crash before the guard', () => {
  const { dom, original, replacement } = reloadCss(value => value);
  // Call the captured listener directly so jsdom does not swallow event errors.
  original.remove();
  let caught;
  dom.window.addEventListener('error', event => { caught = event.error; event.preventDefault(); });
  replacement.dispatchEvent(new dom.window.Event('load'));
  assert.match(caught?.message ?? '', /removeChild/);
  dom.window.close();
});

for (const eventName of ['load', 'error']) {
  test(`ignores a detached original stylesheet on replacement ${eventName}`, () => {
    const { dom, original, replacement } = reloadCss();
    const errors = [];
    dom.window.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
    original.remove();
    replacement.dispatchEvent(new dom.window.Event(eventName));
    assert.equal(errors.length, 0);
    assert.equal(replacement.isConnected, true);
    assert.equal(replacement.isLoaded, true);
    dom.window.close();
  });
}

test('still swaps connected stylesheets and ignores duplicate completion events', () => {
  const { dom, original, replacement } = reloadCss();
  const errors = [];
  dom.window.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
  replacement.dispatchEvent(new dom.window.Event('load'));
  assert.equal(original.isConnected, false);
  assert.equal(replacement.isConnected, true);
  replacement.dispatchEvent(new dom.window.Event('error'));
  assert.equal(errors.length, 0);
  dom.window.close();
});

test('leaves unrelated source code untouched', () => {
  const unrelated = 'document.title = "Tripri";';
  assert.equal(guardDetachedStylesheet(unrelated), unrelated);
});
