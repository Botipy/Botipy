// Generates assets/header-{dark,light}.svg: a dithered, animated aurora (APNG embedded in SVG).
// Technique inspired by ripgrim's profile generator. Run: node scripts/build-header.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 1000, H = 338, SCENE_Y = 38, SCENE_H = 150;
const CELL = 4, STRENGTH = 1.0, FPS = 10, DURATION = 7;

const THEMES = {
  dark: {
    page: '#0a0710', panel: '#120d1d', line: '#2a1f45', t1: '#f1eaff', t2: '#c4b5e6', t3: '#8174a8', accent: '#a56bff',
    palette: ['#0a0710', '#1e1238', '#3d1f78', '#6a35c9', '#a56bff', '#e4d2ff'],
  },
  light: {
    page: '#f7f3ff', panel: '#ffffff', line: '#d9ccf2', t1: '#1a0f33', t2: '#4a3a75', t3: '#7a6ba3', accent: '#6a35c9',
    palette: ['#f7f3ff', '#e2d6f7', '#bba0ec', '#8f62dc', '#6a35c9', '#3d1f78'],
  },
};

const BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
const CRC = Array.from({ length: 256 }, (_, n) => { let v = n; for (let b = 0; b < 8; b++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; return v >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data = Buffer.alloc(0)) => {
  const name = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
};
const header = (w, h) => { const b = Buffer.alloc(13); b.writeUInt32BE(w, 0); b.writeUInt32BE(h, 4); b[8] = 8; b[9] = 3; return b; };
const plte = (p) => Buffer.from(p.flatMap((hex) => [1, 3, 5].map((s) => parseInt(hex.slice(s, s + 2), 16))));
const rows = (px, w, h) => { const out = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y++) Buffer.from(px.buffer, px.byteOffset + y * w, w).copy(out, y * (w + 1) + 1); return out; };
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const still = (px, w, h, pal) => Buffer.concat([SIG, chunk('IHDR', header(w, h)), chunk('PLTE', plte(pal)), chunk('IDAT', deflateSync(rows(px, w, h), { level: 9 })), chunk('IEND')]).toString('base64');
function apng(frames, order, w, h, pal, fps) {
  const ac = Buffer.alloc(8); ac.writeUInt32BE(order.length, 0);
  const out = [SIG, chunk('IHDR', header(w, h)), chunk('PLTE', plte(pal)), chunk('acTL', ac)];
  let seq = 0;
  order.forEach((fi, i) => {
    const c = Buffer.alloc(26);
    c.writeUInt32BE(seq++, 0); c.writeUInt32BE(w, 4); c.writeUInt32BE(h, 8);
    c.writeUInt16BE(1000, 20); c.writeUInt16BE(Math.round(fps * 1000), 22);
    out.push(chunk('fcTL', c));
    const z = deflateSync(rows(frames[fi], w, h), { level: 9 });
    if (i === 0) out.push(chunk('IDAT', z));
    else { const d = Buffer.alloc(z.length + 4); d.writeUInt32BE(seq++, 0); z.copy(d, 4); out.push(chunk('fdAT', d)); }
  });
  out.push(chunk('IEND'));
  return Buffer.concat(out).toString('base64');
}

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453123; return v - Math.floor(v); };
function vnoise(x, y, s = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), d = hash(x0, y0 + 1, s), e = hash(x0 + 1, y0 + 1, s);
  const top = a + (b - a) * sx, bot = d + (e - d) * sx;
  return top + (bot - top) * sy;
}
function fbm(x, y, s) {
  let t = 0, amp = .5, n = 0;
  for (let o = 0; o < 4; o++) { t += vnoise(x, y, s + o * 17) * amp; n += amp; x = x * 2.03 + 7.1; y = y * 2.03 - 3.7; amp *= .5; }
  return t / n;
}
function frame(phase, w, h, levels) {
  const cols = Math.ceil(w / CELL), rws = Math.ceil(h / CELL), px = new Uint8Array(cols * rws);
  const time = 11 + phase, aspect = cols / rws, sn = (x, y, s) => vnoise(x, y, s) * 2 - 1;
  for (let r = 0; r < rws; r++) for (let c = 0; c < cols; c++) {
    const u = (c + .5) / cols, py = 1 - (r + .5) / rws, x = (u - .5) * aspect + time * .01;
    let light = 0;
    for (let i = 0; i < 4; i++) {
      const depth = i / 3;
      const edge = .38 + i * .06 + 1.4 * .11 * sn(x * .55 + i * 3.1, time * .035 + i * 1.7, 41) + .8 * .05 * sn(x * 2.1 - i * 1.3, time * .07 + i, 73);
      const above = py - edge;
      const curtain = above > 0 ? Math.exp(-Math.abs(above) * 4.12 * (1 + i * .4)) : Math.exp(-Math.abs(above) * 48);
      const rayX = (x + sn(x * .8, time * .03 + i, 101) * .74) * 12;
      let ray = .2 + .8 * smooth(.25, .75, fbm(rayX + i * 9, time * .045 + i, 131 + i * 11));
      ray *= .75 + .25 * vnoise(rayX * 3.2, i * 4 + time * .02, 173 + i * 7);
      const patch = .3 + .7 * smooth(.25, .7, fbm(x * .45 + i * 5, time * .02 + i * 2, 211 + i * 13));
      const rim = Math.exp(-Math.abs(above) * 34) * 1.1;
      const haze = above > 0 ? Math.exp(-Math.abs(above) * 5) * .09 : Math.exp(-Math.abs(above) * 14) * .05;
      light += (curtain * ray + rim * (.5 + .5 * ray) + haze) * patch * (1 - .5 * depth);
    }
    let tone = smooth(.035, .96, (1 - Math.exp(-light * 1.25)) * STRENGTH);
    if (tone < .025) continue;
    const scaled = tone * (levels - 1), base = Math.floor(scaled);
    px[r * cols + c] = Math.min(levels - 1, base + (scaled - base > BAYER[r % 4][c % 4] / 16 ? 1 : 0));
  }
  return { px, cols, rows: rws };
}

function build(name, t) {
  const n = Math.floor(DURATION * FPS / 2) + 1, span = 7.6;
  const frames = Array.from({ length: n }, (_, i) => frame(i * span / (n - 1), W, SCENE_H, t.palette.length));
  const order = [...Array(n).keys(), ...Array.from({ length: n - 2 }, (_, i) => n - 2 - i)];
  const { cols, rows: rws } = frames[0];
  const anim = apng(frames.map((f) => f.px), order, cols, rws, t.palette, FPS);
  const poster = still(frames[0].px, cols, rws, t.palette);
  const img = (d, x = '') => `<image x="0" y="0" width="${W}" height="${SCENE_H}" preserveAspectRatio="none" href="data:image/png;base64,${d}" ${x}/>`;
  const dot = (x, y, i) => {
    const v = [0, 0, 0, 0].map((_, k) => (k === i ? 1 : .28)).join(';');
    const vals = [0, 1, 2, 3, 0].map((k) => (k === i ? 1 : .28));
    return `<rect x="${x}" y="${y}" width="3" height="3" fill="${t.accent}" opacity=".28"><animate attributeName="opacity" values="${vals.join(';')}" dur="0.8s" calcMode="discrete" repeatCount="indefinite"/></rect>`;
  };
  const Y2 = SCENE_Y + SCENE_H;
  const cell = (x, y, w, label, value, mono = true) => `<line x1="${x}" x2="${x + w}" y1="${y + .5}" y2="${y + .5}" stroke="${t.line}"/><text x="${x + 16}" y="${y + 28}" class="micro t3">${label}</text><text x="${x + 16}" y="${y + 58}" class="mono t1" font-size="22">${value}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t"><title id="t">Botipy on GitHub</title><style>
text{font-family:ui-monospace,'Fira Code',SFMono-Regular,Menlo,Consolas,monospace}.sans{font-family:Inter,'Segoe UI',Arial,sans-serif;font-weight:700}
.t1{fill:${t.t1}}.t2{fill:${t.t2}}.t3{fill:${t.t3}}.acc{fill:${t.accent}}.code{font-size:13px}.label{font-size:12px;letter-spacing:.06em;text-transform:uppercase}.micro{font-size:11px;letter-spacing:.06em;text-transform:uppercase}.display{font-size:64px;letter-spacing:-.04em}
.cur{animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}
@media(prefers-reduced-motion:reduce){.motion{display:none!important}.reduced{display:block!important}.cur{animation:none}}
</style><rect width="${W}" height="${H}" fill="${t.page}"/><rect width="${W}" height="38" fill="${t.panel}"/><line x1="0" x2="${W}" y1="37.5" y2="37.5" stroke="${t.line}"/><text x="12" y="24" class="code t1">botipy</text><g class="motion">${dot(72, 14, 0)}${dot(77, 14, 1)}${dot(72, 19, 2)}${dot(77, 19, 3)}</g><text x="90" y="24" class="label t1">online</text><text x="${W - 12}" y="24" text-anchor="end" class="code t3">github.com/Botipy</text>
<g transform="translate(0 ${SCENE_Y})">${img(anim, 'class="motion"')}${img(poster, 'class="reduced" style="display:none"')}</g><line x1="0" x2="${W}" y1="${Y2 + .5}" y2="${Y2 + .5}" stroke="${t.line}"/>
<line x1="600.5" x2="600.5" y1="${Y2}" y2="${H}" stroke="${t.line}"/>
<text x="28" y="${Y2 + 68}" class="sans display t1">Botipy</text><text x="28" y="${Y2 + 98}" class="sans t2" font-size="15" style="font-weight:400">Building things, breaking things, shipping them anyway.</text><text x="28" y="${Y2 + 130}" class="code acc">$ whoami &#8594; botipy<tspan class="cur"> ▋</tspan></text>
${cell(600, Y2, 200, 'Public repos', '6')}<line x1="800.5" x2="800.5" y1="${Y2}" y2="${Y2 + 75}" stroke="${t.line}"/>${cell(800, Y2, 200, 'Followers', '3')}
<line x1="600" x2="${W}" y1="${Y2 + 75.5}" y2="${Y2 + 75.5}" stroke="${t.line}"/>${cell(600, Y2 + 75, 200, 'Following', '6')}<line x1="800.5" x2="800.5" y1="${Y2 + 75}" y2="${H}" stroke="${t.line}"/>${cell(800, Y2 + 75, 200, 'Joined', '2024')}
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${t.line}"/></svg>`;
  mkdirSync('assets', { recursive: true });
  writeFileSync(`assets/header-${name}.svg`, svg);
  console.log(name, (svg.length / 1024).toFixed(0) + ' KB', n, 'frames');
}
for (const [k, t] of Object.entries(THEMES)) build(k, t);
