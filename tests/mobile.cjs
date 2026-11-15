// Phone-size test (iPhone 13 screen, touch) of the installable web version.
//   npm run e2e:mobile      (SHOTS=dir to save screenshots)
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const SHOTS = process.env.SHOTS || '';
let failures = 0;
const check = (c, m) => {
  console.log(c ? '  ✓' : '  ✗ FAIL:', m);
  if (!c) failures++;
};
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(DIST, p);
      if (!fs.existsSync(f)) return res.writeHead(404).end();
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
    });
    srv.listen(0, () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
  const ctx = await browser.newContext({ ...iphone });
  await ctx.route('https://geocoding-api.open-meteo.com/**', (r) => r.fulfill({ json: { results: [{ name: 'Parramatta', admin1: 'New South Wales', country: 'Australia', latitude: -33.8, longitude: 151 }] } }));
  await ctx.route('https://api.open-meteo.com/**', (r) => {
    const date = new URL(r.request().url()).searchParams.get('start_date');
    const time = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
    const f = (v) => time.map((_, h) => (typeof v === 'function' ? v(h) : v));
    r.fulfill({ json: { hourly: { time, temperature_2m: f((h) => 18 + Math.max(0, 9 - Math.abs(14 - h))), precipitation_probability: f(10), precipitation: f(0), weather_code: f(1), wind_speed_10m: f(12), wind_direction_10m: f(90), wind_gusts_10m: f(25), relative_humidity_2m: f(50), dew_point_2m: f(10), cloud_cover: f(20) } } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (name) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    const style = await page.addStyleTag({ content: '.toasts{visibility:hidden}' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    await style.evaluate((el) => el.remove());
  };
  const tab = (label) => page.locator('.tabbar button', { hasText: label }).tap();
  const more = async (label) => {
    await page.locator('.tabbar button', { hasText: 'More' }).tap();
    await page.locator('.sheet-grid button', { hasText: label }).tap();
    await page.waitForTimeout(100);
  };
  const noSideScroll = async (where) => {
    const over = await page.evaluate(() => {
      const c = document.querySelector('.content');
      return { page: document.documentElement.scrollWidth - window.innerWidth, content: c ? c.scrollWidth - c.clientWidth : 0 };
    });
    check(over.page <= 1 && over.content <= 1, `${where}: nothing wider than the screen (${JSON.stringify(over)})`);
  };

  await page.goto(url);
  await page.waitForSelector('.tabbar');
  console.log('Phone layout');
  check(!(await page.locator('.sidebar').isVisible()), 'sidebar hidden on a phone');
  check(await page.locator('.tabbar').isVisible(), 'bottom tab bar shown');
  check((await page.evaluate(() => document.querySelector('link[rel=manifest]')?.href)).endsWith('manifest.webmanifest'), 'install manifest linked');
  check(!!(await page.evaluate(() => document.querySelector('link[rel=apple-touch-icon]'))), 'home-screen icon provided');

  // Players
  await more('Player Management');
  const NAMES = ['James Carter', 'Liam Patel', 'Noah Singh', 'Oliver Brown', 'Jack Wilson', 'Ethan Nguyen', 'Lucas Taylor', 'Mason Lee', 'Henry Clarke', 'Sam Ahmed', 'Tom Riley'];
  for (let i = 0; i < 11; i++) await page.fill(`[aria-label="Player ${i + 1} name"]`, NAMES[i]);
  await noSideScroll('Players');
  await shot('m08-players');

  // New match
  await tab('Home');
  await page.locator('.topbar button', { hasText: 'New Match' }).tap();
  check(await page.locator('.modal').isVisible(), 'new match dialog opens as a bottom sheet');
  await page.fill('.modal >> input[placeholder="e.g. Round 5"]', 'Round 6');
  await page.fill('.modal >> input[placeholder="e.g. Eastwood CC"]', 'Eastwood CC');
  await page.fill('.modal >> input[type=date]', inDays(3));
  await page.selectOption('.modal >> select', 'T20');
  await shot('m09-new-match');
  await page.locator('.modal button', { hasText: 'Create match' }).tap();
  await page.locator('text=Edit Match Details').tap();
  await page.fill('input[placeholder="e.g. Memorial Oval"]', 'Memorial Oval');
  await page.fill('input[placeholder="e.g. Parramatta"]', 'Parramatta');
  await page.fill('input[type=time]', '13:00');
  await page.locator('text=Done').tap();
  await noSideScroll('Current Match');
  await shot('m02-current-match');

  // Fielding
  console.log('Fielding');
  await tab('Fielding');
  const fld = [['Wicketkeeper', 'Henry Clarke'], ['First Slip', 'James Carter'], ['Gully', 'Noah Singh'], ['Point', 'Oliver Brown'], ['Cover', 'Jack Wilson'], ['Mid-off', 'Ethan Nguyen'], ['Mid-wicket', 'Lucas Taylor'], ['Square Leg', 'Mason Lee'], ['Fine Leg', 'Sam Ahmed'], ['Third Man', 'Liam Patel']];
  for (const [p, n] of fld) {
    await page.locator(`[aria-label="Select ${p}"]`).tap();
    await page.fill(`[aria-label="${p} player name"]`, n);
  }
  check((await page.locator('svg .marker-label', { hasText: 'Henry Clarke' }).count()) === 1, 'tapping a position puts the fielder on the field');
  const fieldBox = await page.locator('.field-svg-wrap').boundingBox();
  check(fieldBox.width > 340, `field fills the phone width (${Math.round(fieldBox.width)}px)`);
  await noSideScroll('Fielding');
  await page.locator('.content').evaluate((c) => c.scrollTo(0, 0));
  await shot('m04-fielding');
  await page.locator('.content').evaluate((c) => c.scrollTo(0, 700));
  await shot('m04b-fielding-list');

  // Batting with arrows
  console.log('Batting');
  await tab('Batting');
  check(!(await page.locator('.drag-handle').first().isVisible()), 'drag handles replaced on touch screens');
  const first = () => page.locator('.lineup-row').nth(0).locator('.c-player option:checked').innerText().then((t) => t.split(' · ')[0].trim());
  const second = () => page.locator('.lineup-row').nth(1).locator('.c-player option:checked').innerText().then((t) => t.split(' · ')[0].trim());
  check((await first()) === 'James Carter', 'roster order to start');
  await page.locator('.lineup-row').nth(0).locator('[aria-label="Move down"]').tap();
  check((await first()) === 'Liam Patel' && (await second()) === 'James Carter', 'down arrow moves batter to 2nd');
  await page.locator('.lineup-row').nth(1).locator('[aria-label="Move up"]').tap();
  check((await first()) === 'James Carter', 'up arrow moves batter back to 1st');
  await page.fill('[aria-label="1st batter notes"]', 'Strong opening batter');
  await noSideScroll('Batting');
  await shot('m05-batting');

  // Bowling
  console.log('Bowling');
  await more('Bowling Order');
  const ords = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
  const bw = [['Oliver Brown', 4], ['Jack Wilson', 4], ['Ethan Nguyen', 4], ['Sam Ahmed', 4], ['Tom Riley', 2], ['Mason Lee', 2]];
  for (let i = 0; i < 6; i++) {
    await page.selectOption(`[aria-label="${ords[i]} bowler"]`, { label: bw[i][0] });
    await page.fill(`[aria-label="${ords[i]} bowler planned overs"]`, String(bw[i][1]));
  }
  check(await page.locator('.callout', { hasText: 'All 20 overs are planned' }).count() === 1, 'overs total works on phone');
  await noSideScroll('Bowling');
  await shot('m06-bowling');

  // Match Day
  console.log('Match Day');
  await tab('Match Day');
  await page.locator('.md-tab', { hasText: 'Weather Forecast' }).tap();
  await page.waitForSelector('text=Match Day Weather');
  check(await page.locator('.callout', { hasText: 'Conditions look favourable' }).count() === 1, 'weather loads on phone');
  await noSideScroll('Match Day weather');
  await shot('m07-matchday-weather');
  await page.locator('.md-tab', { hasText: 'Ground & Pitch' }).tap();
  await page.locator('.seg button', { hasText: 'Dry' }).tap();
  await page.locator('.behaviour-row', { hasText: 'Offers spin' }).locator('button', { hasText: /^Yes$/ }).tap();
  await noSideScroll('Ground & Pitch');
  await page.locator('.md-tab', { hasText: 'Tactical Recommendations' }).tap();
  await noSideScroll('Tactics');
  await shot('m07b-matchday-tactics');

  // Dashboard + quick search
  console.log('Navigation');
  await tab('Home');
  await noSideScroll('Dashboard');
  await shot('m01-dashboard');
  await page.locator('.tabbar button', { hasText: 'More' }).tap();
  await shot('m03-more-menu');
  await page.locator('.sheet-search').tap();
  await page.fill('[aria-label="Quick search"]', 'tips');
  await page.keyboard.press('Enter');
  check((await page.locator('.topbar h1').innerText()) === 'Tips and Improvements', 'quick search opens a section');
  await page.goBack();
  await page.waitForTimeout(200);
  check((await page.locator('.topbar h1').innerText()) === 'Dashboard', 'back gesture returns to the previous section');
  await more('Match History');
  await noSideScroll('History');
  await more('Game Notes');
  await noSideScroll('Game Notes');
  await shot('m10-notes');

  // Data stays after closing and reopening
  await page.waitForSelector('.save-pill:has-text("Saved")');
  await page.reload();
  await page.waitForSelector('.tabbar');
  await tab('Fielding');
  check((await page.inputValue('[aria-label="Wicketkeeper player name"]')) === 'Henry Clarke', 'data kept after reopening on the phone');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll phone checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
