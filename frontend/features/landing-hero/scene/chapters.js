import { clamp, smooth } from './util.js';

// Story chapters shown beside the boat while the camera looks down on the bay. Replaces the v5 wave-text beats:
// every [data-chapter] block fades/slides in and out over its [start, end] stretch of the journey, and the words
// of its title light up one after another (the same scrub effect the landing page uses for its headings).
export function buildChapters(root) {
  return [...root.querySelectorAll('[data-chapter]')].map((el) => ({
    el,
    start: +el.dataset.start, end: +el.dataset.end,
    textSide: el.dataset.textSide === 'l' ? -1 : 1,
    text: el.querySelector('[data-ch-text]'),
    media: el.querySelector('[data-ch-media]'),
    words: [...el.querySelectorAll('[data-ch-word]')],
  }));
}

export function animateChapters(chapters, p) {
  for (const c of chapters) {
    const tl = clamp((p - c.start) / (c.end - c.start));
    const a = smooth(tl, 0, .2), o = smooth(tl, .82, 1), v = a * (1 - o);
    // opacity only (never visibility:hidden / display:none): the copy stays in the accessibility tree for screen readers
    if (v < .002) { if (c.el.style.opacity !== '0') c.el.style.opacity = '0'; continue; }
    c.el.style.opacity = v.toFixed(3);
    const shift = (1 - a) + o;                           // 0 while fully shown, 1 when entering / leaving
    if (c.text) c.text.style.transform = `translate3d(${(c.textSide * shift * 60).toFixed(1)}px,0,0)`;
    if (c.media) c.media.style.transform = `translate3d(${(-c.textSide * shift * 60).toFixed(1)}px,0,0) rotate(${(-c.textSide * 2.5).toFixed(1)}deg)`;
    const n = c.words.length;
    c.words.forEach((w, i) => { w.style.opacity = (.18 + .82 * smooth((tl - .03) / .32 * (1 + .09 * n) - i * .09, 0, 1)).toFixed(3); });
  }
}
