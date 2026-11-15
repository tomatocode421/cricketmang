// Visits every section and Match Day tab at small iPhone sizes and fails if anything
// sticks out past the screen edge.   npm run build && node tests/overflow.cjs   (SHOTS=dir for screenshots)
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const OUT = process.env.SHOTS || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f)) return res.writeHead(404).end(); res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f)); }).listen(0, async () => {
  const b = await chromium.launch();
  let problems = 0;
  for (const dev of ['iPhone SE', 'iPhone 13']) {
    const { defaultBrowserType, ...d } = devices[dev];
    const ctx = await b.newContext(d);
    await ctx.route('https://**/*', (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${srv.address().port}/`);
    await p.waitForSelector('.tabbar');
    // sample data
    await p.locator('.topbar button', { hasText: 'New Match' }).tap();
    await p.fill('.modal >> input[placeholder="e.g. Round 5"]', 'Round 6 against the Hills District Cricket Club');
    await p.fill('.modal >> input[placeholder="e.g. Eastwood CC"]', 'Hills District Cricket Club');
    await p.selectOption('.modal >> select', 'T20');
    await p.locator('.modal button', { hasText: 'Create match' }).tap();
    const scan = async (where) => {
      await p.waitForTimeout(250);
      const over = await p.evaluate(() => {
        const W = window.innerWidth; const res = [];
        document.querySelectorAll('.main *, .modal *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || r.right <= W + 1) return;
          let a = el.parentElement, clipped = false;
          while (a) { const cs = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(cs.overflowX) && a.getBoundingClientRect().right <= W + 1) { clipped = true; break; } a = a.parentElement; }
          if (!clipped) res.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ')[0]} "${(el.innerText || '').slice(0, 20)}" +${Math.round(r.right - W)}px`);
        });
        return res.slice(0, 4);
      });
      if (over.length) { problems++; console.log(`${dev} | ${where} | ${over.join(' ; ')}`); }
      if (OUT) await p.screenshot({ path: `${OUT}/${dev.replace(' ', '')}-${where.replace(/[^a-z0-9]+/gi, '_')}.png` });
    };
    const sections = ['Dashboard', 'Current Match', 'Match Day', 'Fielding Positions', 'Batting Order', 'Bowling Order', 'Game Notes', 'Tips and Improvements', 'Player Management', 'Match History'];
    for (const s of sections) {
      await p.locator('.tabbar button', { hasText: 'More' }).tap();
      await p.locator('.sheet-grid button', { hasText: s }).tap();
      await scan(s);
      if (s === 'Match Day') {
        const n = await p.locator('.md-tab').count();
        for (let i = 1; i < n; i++) { await p.locator('.md-tab').nth(i).tap(); await scan('Match Day tab ' + (await p.locator('.md-tab').nth(i).innerText()).trim()); }
      }
    }
    await p.locator('.tabbar button', { hasText: 'More' }).tap();
    await p.locator('.sheet-grid button', { hasText: 'Backup' }).tap();
    await scan('Backup dialog');
    await ctx.close();
  }
  console.log(problems ? `${problems} screen(s) with overflow` : 'No overflow on any screen');
  process.exitCode = problems ? 1 : 0;
  await b.close(); srv.close();
});
