// Squad of 12, custom fielding, live scoring with suggestions, CSV stats.
//   npm run build && node tests/addon.cjs
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
let failures = 0;
const check = (c, m) => (console.log(c ? '  ✓' : '  ✗ FAIL:', m), c || failures++);
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
});
srv.listen(0, async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  const nav = (l) => page.locator('.sidebar .nav-item', { hasText: l }).first().click();
  const names = ['James Carter', 'Liam Patel', 'Noah Singh', 'Oliver Brown', 'Jack Wilson', 'Ethan Nguyen', 'Lucas Taylor', 'Mason Lee', 'Henry Clarke', 'Sam Ahmed', 'Tom Riley', 'Ben Rose'];
  await nav('Player Management');
  check((await page.locator('.roster-row').count()) === 12, '12 player slots');
  for (let i = 0; i < 12; i++) await page.fill(`[aria-label="Player ${i + 1} name"]`, names[i]);
  for (const i of [4, 5, 6, 10]) await page.selectOption(`[aria-label="Player ${i} bowling style"]`, 'Fast');

  await nav('Dashboard');
  await page.click('.topbar >> text=New Match');
  await page.fill('.modal >> input[placeholder="e.g. Round 5"]', 'Round 8');
  await page.fill('.modal >> input[placeholder="e.g. Eastwood CC"]', 'Hills');
  await page.selectOption('.modal >> select', 'T20');
  await page.click('.modal >> text=Create match');
  check((await page.locator('.xi-row.reserve').innerText()).includes('Ben Rose'), '12th player shown as reserve');
  await page.click('[aria-label="Make James Carter 12th player"]');
  check((await page.locator('.xi-row.reserve').innerText()).includes('James Carter'), 'swap makes another player 12th');
  await nav('Batting Order');
  const opts = await page.locator('[aria-label="1st batter"] option').allInnerTexts();
  check((await page.locator('[aria-label="1st batter"] option:checked').innerText()).startsWith('Ben Rose') && !opts.some((o) => o.startsWith('James Carter')), 'incoming player takes the batting slot; 12th not selectable');

  await nav('Fielding Positions');
  await page.selectOption('[aria-label="Apply a field template"]', 'balanced');
  await page.locator('.pos-row', { hasText: 'Cover' }).first().locator('.pname').click();
  const cx = () => page.locator('[data-pos="cover"] circle').last().getAttribute('cx');
  const before = Number(await cx());
  await page.locator('#pos-x').fill('20');
  const afterSlide = Number(await cx());
  check(afterSlide < before, `horizontal slider moves the marker (${before} → ${afterSlide})`);
  const box = await page.locator('[data-pos="cover"] circle').last().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterDrag = Number(await cx());
  check(afterDrag > afterSlide + 30 && Number(await page.locator('#pos-x').inputValue()) > 20, 'dragging moves the marker and updates the slider');
  await page.click('text=Add custom position');
  await page.fill('[aria-label="Custom position name"]', 'Very Deep Mid-wicket');
  await page.click('.modal >> text=Add position');
  check((await page.locator('.pos-row', { hasText: 'Very Deep Mid-wicket' }).count()) === 1, 'custom position added');
  await page.click('.zoom-ctl [aria-label="Zoom in"]');
  check((await page.locator('.field-svg-wrap svg').getAttribute('viewBox')).split(' ')[2] < 1000, 'zoom in narrows the view');
  await page.waitForSelector('.save-pill:has-text("Saved")');
  await page.reload();
  await nav('Fielding Positions');
  check(Math.abs(Number(await cx()) - afterDrag) < 2, 'exact marker position restored after reopening');

  await nav('Live Match');
  await page.click('text=Hills bat first');
  await page.click('button:has-text("Start scoring")');
  await page.fill('[aria-label="Striker name"]', 'A Smith');
  await page.click('.pick >> button:has-text("Add") >> nth=0');
  await page.fill('[aria-label="Non-striker name"]', 'B Jones');
  await page.click('.pick >> button:has-text("Add")');
  const bowl = async (who) => {
    const v = await page.locator('[aria-label="Bowler"] option').evaluateAll((o, n) => o.find((x) => x.textContent.startsWith(n))?.value, who);
    await page.selectOption('[aria-label="Bowler"]', v);
  };
  await bowl('Oliver Brown');
  for (let over = 0; over < 3; over++) {
    if (over) await bowl(over === 1 ? 'Jack Wilson' : 'Oliver Brown');
    for (let i = 0; i < 6; i++) {
      await page.click('.pad-btn[aria-label="4 runs"]');
      await page.click('.area-btn:has-text("Cover") >> nth=0');
    }
  }
  check((await page.locator('.sb-score').innerText()) === '72/0', 'live score adds up (72/0 after 3 overs)');
  check((await page.locator('.sb-stats').innerText()).includes('3.0'), 'overs shown');
  const sug = page.locator('.sug', { hasText: 'Protect Cover' }).first();
  check((await sug.count()) === 1, 'suggests protecting Cover');
  await sug.locator('button.primary').click();
  check((await page.locator('.sug', { hasText: 'Protect Cover' }).count()) === 0, 'accepted suggestion leaves the list');
  const bsug = page.locator('.sug', { hasText: 'bowling change' }).first();
  if (await bsug.count()) await bsug.locator('text=Dismiss').click();
  check((await page.locator('.sug', { hasText: 'bowling change' }).count()) === 0, 'dismissed suggestion leaves the list');
  await page.click('[aria-label="Undo last ball"]').catch(() => {});

  await nav('Stats');
  await page.click('.md-tab:has-text("Import CSV")');
  check((await page.locator('text=Connect Play-Cricket from the Mac app').count()) === 0, 'tab switch works');
  await page.fill('[aria-label="CSV scorecard"]', 'section,name,runs,balls,fours,sixes,how_out,overs,maidens,wickets\nour_batting,Noah Singh,51,40,6,1,c X b Y,,,\nour_bowling,Jack Wilson,20,,,,,4,1,3');
  await page.click('text=Import scorecard');
  await page.click('.md-tab:has-text("Season stats")');
  const row = await page.locator('tr', { hasText: 'Noah Singh' }).innerText();
  check(/\b51\b/.test(row), 'imported runs appear in season stats');
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await b.close();
  srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll add-on checks passed');
  process.exit(failures ? 1 : 0);
});
