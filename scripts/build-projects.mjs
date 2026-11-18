// Generates assets/project-*-{dark,light}.svg cards. Run: node scripts/build-projects.mjs <dir with spotify.jpg + roman.jpg>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = process.argv[2] || '../proj-src';
const b64 = (f) => readFileSync(`${src}/${f}`).toString('base64');

const W = 400, H = 360, BH = 200;
const T = {
  dark: { page: '#0a0710', panel: '#120d1d', line: '#2a1f45', t1: '#f1eaff', t2: '#c4b5e6', t3: '#8174a8', acc: '#a56bff', acc2: '#e4d2ff', well: '#1e1238' },
  light: { page: '#f7f3ff', panel: '#ffffff', line: '#d9ccf2', t1: '#1a0f33', t2: '#4a3a75', t3: '#7a6ba3', acc: '#6a35c9', acc2: '#3d1f78', well: '#e2d6f7' },
};

const projects = [
  { id: '01', name: 'spotify-widget', desc: ['Tiny always-on-top Spotify player', 'for Windows. 12 styles, Pomodoro.'], tags: ['Electron', 'CSS'], banner: { img: 'spotify.jpg', fit: 'slice' } },
  { id: '02', name: 'roman-clip', desc: ['Instant-replay clips for Windows.', 'Hotkey or voice, saved as MP4.'], tags: ['Electron', 'JavaScript'], banner: { img: 'roman.jpg', fit: 'meet' } },
  { id: '03', name: 'claude-usage-tracker', desc: ['Tray icon with your Claude limits:', '5-hour session + weekly.'], tags: ['Python', 'Windows'], banner: { art: 'tracker' } },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function trackerArt(t) {
  return `<rect width="${W}" height="${BH}" fill="${t.well}"/>
<g font-family="ui-monospace,Consolas,monospace">
<text x="28" y="52" font-size="11" letter-spacing="1.2" fill="${t.t3}">SESSION · 5H</text>
<rect x="28" y="62" width="344" height="12" rx="2" fill="${t.panel}" stroke="${t.line}"/>
<rect x="28" y="62" width="120" height="12" rx="2" fill="${t.acc}"><animate attributeName="width" values="90;230;90" dur="7s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1"/></rect>
<text x="28" y="108" font-size="11" letter-spacing="1.2" fill="${t.t3}">WEEKLY</text>
<rect x="28" y="118" width="344" height="12" rx="2" fill="${t.panel}" stroke="${t.line}"/>
<rect x="28" y="118" width="170" height="12" rx="2" fill="${t.acc2}" opacity=".85"><animate attributeName="width" values="150;200;150" dur="9s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1"/></rect>
<g transform="translate(300 146)"><rect width="72" height="38" rx="8" fill="${t.panel}" stroke="${t.line}"/><text x="36" y="26" text-anchor="middle" font-size="20" font-weight="700" fill="${t.acc}">42<animate attributeName="opacity" values="1;1;.5;1" dur="3s" repeatCount="indefinite"/></text></g>
<text x="28" y="172" font-size="11" fill="${t.t3}">resets in 2h 14m</text>
</g>`;
}

function card(p, t) {
  const banner = p.banner.art
    ? trackerArt(t)
    : `<rect width="${W}" height="${BH}" fill="${t.well}"/><image x="0" y="0" width="${W}" height="${BH}" preserveAspectRatio="xMidYMid ${p.banner.fit}" href="data:image/jpeg;base64,${b64(p.banner.img)}"/>`;
  const tags = p.tags.map((tag, i) => {
    const x = 20 + p.tags.slice(0, i).reduce((a, s) => a + s.length * 7 + 24, 0);
    return `<rect x="${x}" y="318" width="${tag.length * 7 + 16}" height="22" rx="4" fill="none" stroke="${t.line}"/><text x="${x + 8}" y="333" class="t2" font-size="11">${esc(tag)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t"><title id="t">${esc(p.name)}</title><style>
text{font-family:ui-monospace,'Fira Code',SFMono-Regular,Menlo,Consolas,monospace}.t1{fill:${t.t1}}.t2{fill:${t.t2}}.t3{fill:${t.t3}}.acc{fill:${t.acc}}
.scan{animation:s 4.5s ease-in-out infinite}@keyframes s{0%{transform:translateY(-30px);opacity:0}20%{opacity:.5}80%{opacity:.5}100%{transform:translateY(${BH}px);opacity:0}}
.arrow{animation:a 1.6s ease-in-out infinite}@keyframes a{50%{transform:translateX(5px)}}
@media(prefers-reduced-motion:reduce){.scan,.arrow{animation:none}}
</style><defs><clipPath id="c"><rect width="${W}" height="${BH}"/></clipPath><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.acc}" stop-opacity="0"/><stop offset=".5" stop-color="${t.acc}" stop-opacity=".45"/><stop offset="1" stop-color="${t.acc}" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="${t.page}"/>
<g clip-path="url(#c)">${banner}<rect class="scan" width="${W}" height="30" fill="url(#g)"/></g>
<line x1="0" x2="${W}" y1="${BH + .5}" y2="${BH + .5}" stroke="${t.line}"/>
<text x="20" y="${BH + 34}" class="t3" font-size="11" letter-spacing="1.2">PROJECT ${p.id}</text>
<text x="20" y="${BH + 62}" class="t1" font-size="18" font-weight="700">${esc(p.name)}</text>
<text x="20" y="${BH + 84}" class="t2" font-size="12">${esc(p.desc[0])}</text><text x="20" y="${BH + 100}" class="t2" font-size="12">${esc(p.desc[1])}</text>
${tags}
<g class="arrow acc"><text x="${W - 40}" y="334" font-size="16">&#8594;</text></g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${t.line}"/></svg>`;
}

mkdirSync('assets', { recursive: true });
for (const p of projects) for (const [mode, t] of Object.entries(T)) {
  const svg = card(p, t);
  writeFileSync(`assets/project-${p.id}-${mode}.svg`, svg);
  console.log(p.id, mode, (svg.length / 1024).toFixed(0) + ' KB');
}
