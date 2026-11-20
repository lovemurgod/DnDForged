import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

test('Hero Crest Interactive d20 Easter Egg DOM & Logic', async (t) => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  
  // Ensure DOM has required elements
  assert.ok(html.includes('crest-interactive'), 'index.html contains .crest-interactive');
  assert.ok(html.includes('crest-shield-die'), 'index.html contains .crest-shield-die');
  assert.ok(html.includes('fa-dice-d20'), 'index.html contains d20 icon');
  assert.ok(html.includes('Cursed to subscriptions,'), 'index.html contains Nat 1 text');
  assert.ok(html.includes('A Forge to create,'), 'index.html contains Nat 20 text');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'https://forgedvtt.com/'
  });

  const document = dom.window.document;
  const crest = document.querySelector('.crest-interactive');
  const dieEl = document.querySelector('.crest-shield-die');
  const headline = document.getElementById('home-headline');

  assert.ok(crest, 'Crest element exists in DOM');
  assert.ok(dieEl, 'Die overlay element exists in DOM');
  assert.ok(headline, 'Headline element exists in DOM');

  // Verify initial state
  const spans = headline.querySelectorAll('span');
  assert.equal(spans[0].textContent.trim(), 'One DM to Run it.');
  assert.equal(spans[1].textContent.trim(), 'One Party to Play it.');
  assert.equal(spans[2].textContent.trim(), 'One VTT to Forge it All—');
  assert.equal(spans[3].textContent.trim(), 'and in your minds, display it.');

  // Test simulation of roll outcomes directly through the DOM elements
  // Verify Nat 1 styling classes exist in CSS
  const css = fs.readFileSync(path.resolve('css/website.css'), 'utf8');
  assert.ok(css.includes('.state-nat1'), 'CSS has .state-nat1');
  assert.ok(css.includes('.state-nat20'), 'CSS has .state-nat20');
  assert.ok(css.includes('.crest-shield-die'), 'CSS has .crest-shield-die');
  assert.ok(css.includes('.die-nat1'), 'CSS has .die-nat1');
  assert.ok(css.includes('.die-nat20'), 'CSS has .die-nat20');

  // Trigger a click on crest
  crest.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.ok(dieEl.classList.contains('is-visible'), 'Die becomes visible on click');
});
