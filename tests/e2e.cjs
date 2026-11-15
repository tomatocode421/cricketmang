// End-to-end test of every section, run against the built app in Chromium.
// Weather/ground services are mocked so the test is repeatable offline; the
// mocked numbers are TEST DATA ONLY and never ship in the app.
//   npm run e2e            (SHOTS=dir to save screenshots)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const SHOTS = process.env.SHOTS || '';
const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const MATCH_DATE = inDays(3);

let failures = 0;
const check = (cond, msg) => {
  if (cond) console.log('  ✓', msg);
  else {
    failures++;
    console.log('  ✗ FAIL:', msg);
  }
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(DIST, p);
      if (!fs.existsSync(f)) return res.writeHead(404).end();
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }).end(fs.readFileSync(f));
    });
    srv.listen(0, () => resolve(srv));
  });
}

function mockForecast(date) {
  const time = [];
  const v = { temperature_2m: [], precipitation_probability: [], precipitation: [], weather_code: [], wind_speed_10m: [], wind_direction_10m: [], wind_gusts_10m: [], relative_humidity_2m: [], dew_point_2m: [], cloud_cover: [] };
  for (let h = 0; h < 24; h++) {
    time.push(`${date}T${String(h).padStart(2, '0')}:00`);
    v.temperature_2m.push(18 + Math.max(0, 9 - Math.abs(14 - h)));
    const rain = h >= 16 && h <= 18;
    v.precipitation_probability.push(rain ? 65 : 15);
    v.precipitation.push(rain ? 1.2 : 0);
    v.weather_code.push(rain ? 80 : 2);
    v.wind_speed_10m.push(17);
    v.wind_direction_10m.push(200);
    v.wind_gusts_10m.push(32);
    v.relative_humidity_2m.push(62);
    v.dew_point_2m.push(13);
    v.cloud_cover.push(rain ? 85 : 45);
  }
  return { hourly: { time, ...v } };
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const style = await page.addStyleTag({ content: '.toasts{visibility:hidden}' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  await style.evaluate((el) => el.remove());
}

// Pick a player from a dropdown by name (option labels also show styles and positions).
async function pick(page, selector, name) {
  const value = await page.locator(`${selector} option`).evaluateAll((opts, n) => opts.find((o) => o.textContent.trim().startsWith(n))?.value, name);
  await page.selectOption(selector, value);
}

async function nav(page, label) {
  await page.locator('.sidebar .nav-item', { hasText: label }).first().click();
  await page.waitForTimeout(120);
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR || 1), acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.route('https://geocoding-api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { results: [{ name: 'Parramatta', admin1: 'New South Wales', country: 'Australia', latitude: -33.81, longitude: 151.0, timezone: 'Australia/Sydney' }] } })
  );
  await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: mockForecast(new URL(r.request().url()).searchParams.get('start_date')) }));
  await page.route('https://en.wikipedia.org/**', (r) => {
    const u = r.request().url();
    if (u.includes('list=search')) return r.fulfill({ json: { query: { search: [] } } });
    return r.fulfill({ json: {} });
  });

  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.sidebar');

  console.log('Navigation');
  for (const label of ['Dashboard', 'Current Match', 'Match Day', 'Fielding Positions', 'Batting Order', 'Bowling Order', 'Game Notes', 'Tips and Improvements', 'Player Management', 'Match History']) {
    await nav(page, label);
    const title = await page.locator('.topbar h1').innerText();
    check(title === label, `"${label}" opens its page`);
    check(await page.locator('.nav-item.active', { hasText: label }).count() === 1, `"${label}" highlighted in sidebar`);
  }

  console.log('Players');
  await nav(page, 'Player Management');
  const NAMES = ['James Carter', 'Liam Patel', 'Noah Singh', 'Oliver Brown', 'Jack Wilson', 'Ethan Nguyen', 'Lucas Taylor', 'Mason Lee', 'Henry Clarke', 'Sam Ahmed', 'Tom Riley'];
  for (let i = 0; i < 11; i++) await page.fill(`[aria-label="Player ${i + 1} name"]`, NAMES[i]);
  check((await page.inputValue('[aria-label="Player 11 name"]')) === 'Tom Riley', '11 player names entered');
  // Roles and styles
  await page.selectOption('[aria-label="Player 9 role"]', 'Wicketkeeper');
  for (const [i, style] of [[4, 'Fast'], [5, 'Medium pace'], [6, 'Fast'], [10, 'Off-spin'], [11, 'Leg-spin']]) await page.selectOption(`[aria-label="Player ${i} bowling style"]`, style);
  await page.locator('[aria-label="Player 2 batting hand"] button', { hasText: 'LHB' }).click();
  check((await page.locator('.squad-line', { hasText: 'Pace' }).innerText()).includes('Oliver Brown, Jack Wilson, Ethan Nguyen'), 'squad summary lists pace bowlers');
  check((await page.locator('.squad-line', { hasText: 'Keeper' }).innerText()).includes('Henry Clarke'), 'keeper recorded');
  await shot(page, '09-players');

  await nav(page, 'Dashboard');
  check(await page.locator('.getting-started').count() === 1, 'getting-started guide shown before the first match');
  console.log('Create match');
  await nav(page, 'Dashboard');
  await page.click('.topbar >> text=New Match');
  await page.fill('.modal >> input[placeholder="e.g. Round 5"]', 'Round 6');
  await page.fill('.modal >> input[placeholder="e.g. Eastwood CC"]', 'Eastwood CC');
  await page.fill('.modal >> input[type=date]', MATCH_DATE);
  await page.selectOption('.modal >> select', 'T20');
  await page.click('.modal >> text=Create match');
  check((await page.locator('.topbar h1').innerText()) === 'Current Match', 'new match opens Current Match');
  await page.click('text=Edit Match Details');
  await page.fill('input[placeholder="e.g. Saturday B Grade"]', 'Saturday B Grade');
  await page.fill('input[placeholder="e.g. Memorial Oval"]', 'Memorial Oval');
  await page.fill('input[placeholder="e.g. Parramatta"]', 'Parramatta');
  await page.fill('input[placeholder="e.g. Oval 1"]', 'Oval 1');
  await page.fill('input[type=time]', '13:00');
  await page.click('text=Done');
  check(await page.locator('dd', { hasText: 'Eastwood CC' }).count() === 1, 'match details saved and shown');

  console.log('Fielding');
  await nav(page, 'Fielding Positions');
  const field = {
    wk: ['Wicketkeeper', 'Henry Clarke'],
    s1: ['First Slip', 'James Carter'],
    s2: ['Second Slip', 'Liam Patel'],
    g: ['Gully', 'Noah Singh'],
    p: ['Point', 'Oliver Brown'],
    c: ['Cover', 'Jack Wilson'],
    mo: ['Mid-off', 'Ethan Nguyen'],
    mw: ['Mid-wicket', 'Lucas Taylor'],
    sl: ['Square Leg', 'Mason Lee'],
    fl: ['Fine Leg', 'Sam Ahmed'],
  };
  for (const [pos, player] of Object.values(field)) {
    await page.check(`[aria-label="Select ${pos}"]`);
    await page.fill(`[aria-label="${pos} player name"]`, player);
  }
  check((await page.locator('svg .marker-label', { hasText: 'James Carter' }).count()) === 1, 'ticked position shows player name on field');
  check((await page.locator('.field-toolbar .tag').first().innerText()).startsWith('10 positions'), '10 positions counted');
  await page.fill('[aria-label="First Slip player name"]', 'John');
  check((await page.locator('svg .marker-label', { hasText: 'John' }).count()) === 1, 'field updates immediately when name changes');
  await page.fill('[aria-label="First Slip player name"]', 'James Carter');
  await page.uncheck('[aria-label="Select Mid-wicket"]');
  check((await page.locator('svg .marker-label', { hasText: 'Lucas Taylor' }).count()) === 0, 'unticking removes marker');
  check(await page.locator('.toast', { hasText: 'Removed Lucas Taylor' }).count() === 1, 'undo offered after unticking a named position');
  await page.click('.toast >> text=Undo');
  check((await page.inputValue('[aria-label="Mid-wicket player name"]')) === 'Lucas Taylor', 'undo restores the player');
  await shot(page, '04-fielding');

  // Setups
  await page.click('.setup-actions >> text=New');
  await page.fill('.modal input', 'Death Overs Field');
  await page.click('.modal-foot >> button:has-text("Create")');
  check((await page.locator('.field-toolbar .tag').first().innerText()).startsWith('0 positions'), 'new setup starts empty');
  for (const pos of ['Long-off', 'Long-on', 'Deep Mid-wicket', 'Deep Square Leg', 'Third Man']) await page.check(`[aria-label="Select ${pos}"]`);
  await page.fill('[aria-label="Long-off player name"]', 'Jack');
  await page.selectOption('[aria-label="Fielding setup"]', { index: 0 });
  check((await page.inputValue('[aria-label="First Slip player name"]')) === 'James Carter', 'switching setups keeps original setup intact');
  check(!(await page.isChecked('[aria-label="Select Long-off"]')), 'other setup did not overwrite this one');
  await page.click('.setup-actions >> text=Duplicate');
  await page.fill('.modal input', 'Attacking Field');
  await page.click('.modal-foot >> button:has-text("Duplicate")');
  check((await page.locator('[aria-label="Fielding setup"] option').count()) === 3, 'duplicate creates third setup');
  await page.click('.setup-actions >> text=Rename');
  await page.fill('.modal input', 'Attacking Field (new ball)');
  await page.click('.modal >> button:has-text("Rename")');
  check((await page.locator('[aria-label="Fielding setup"] option', { hasText: 'Attacking Field (new ball)' }).count()) === 1, 'rename works');
  await page.click('.setup-actions >> text=Delete');
  await page.click('.modal >> text=Delete setup');
  check((await page.locator('[aria-label="Fielding setup"] option').count()) === 2, 'delete removes setup after confirmation');
  await page.selectOption('[aria-label="Fielding setup"]', { index: 0 });

  // Templates and left-handed batter
  await page.click('.setup-actions >> text=New');
  await page.fill('.modal input', 'Template test');
  await page.click('.modal-foot >> button:has-text("Create")');
  await page.selectOption('[aria-label="Apply a field template"]', 'death');
  check((await page.locator('.field-toolbar .tag').first().innerText()).startsWith('10 positions'), 'template places 10 fielders');
  check((await page.locator('.field-toolbar .tag', { hasText: 'out' }).innerText()).includes('5 out'), 'shows 5 fielders outside the circle for death overs');
  check((await page.inputValue('[aria-label="Wicketkeeper player name"]')) === 'Henry Clarke', 'template puts the team keeper behind the stumps');
  const xOf = () => page.locator('svg .marker', { has: page.locator('title', { hasText: 'Long-off' }) }).locator('circle').last().getAttribute('cx');
  const before = Number(await xOf());
  await page.click('.field-toolbar >> text=Left-hander');
  const after = Number(await xOf());
  check(before < 500 && after > 500, `left-hander mirrors the field (Long-off x ${before} → ${after})`);
  await shot(page, '04c-fielding-template-left');
  await page.click('.field-toolbar >> text=Right-hander');
  await page.click('.setup-actions >> text=Delete');
  await page.click('.modal >> text=Delete setup');
  await page.selectOption('[aria-label="Fielding setup"]', { index: 0 });

  // Player rename propagates
  await nav(page, 'Player Management');
  await page.fill('[aria-label="Player 1 name"]', 'Jimmy Carter');
  await nav(page, 'Fielding Positions');
  check((await page.inputValue('[aria-label="First Slip player name"]')) === 'Jimmy Carter', 'renaming a player updates fielding setups');
  await nav(page, 'Player Management');
  await page.fill('[aria-label="Player 1 name"]', 'James Carter');

  console.log('Batting');
  await nav(page, 'Batting Order');
  const firstBatter = () => page.locator('[aria-label="1st batter"] option:checked').innerText().then((t) => t.split(' · ')[0].trim());
  check((await firstBatter()) === 'James Carter', 'batting defaults to roster order');
  await pick(page, '[aria-label="1st batter"]', 'Liam Patel');
  check((await firstBatter()) === 'Liam Patel', 'dropdown assigns player');
  check((await page.locator('[aria-label="2nd batter"] option:checked').innerText().then((t) => t.split(' · ')[0].trim())) === 'James Carter', 'duplicate selection swaps the players');
  await page.fill('[aria-label="1st batter notes"]', 'Strong opening batter');
  await page.selectOption('[aria-label="Move 1st batter to position"]', '3');
  check((await page.locator('[aria-label="4th batter"] option:checked').innerText().then((t) => t.split(' · ')[0].trim())) === 'Liam Patel', 'move-to dropdown repositions batter');
  check((await page.inputValue('[aria-label="4th batter notes"]')) === 'Strong opening batter', 'notes move with the player');
  // drag & drop: 4th back to 1st
  const rows = page.locator('.lineup-row');
  const handle = rows.nth(3).locator('.drag-handle');
  await handle.hover();
  await page.mouse.down();
  await handle.dispatchEvent('dragstart', { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  const dt = await page.evaluateHandle(() => new DataTransfer());
  const box = await rows.nth(0).boundingBox();
  await rows.nth(0).dispatchEvent('dragover', { dataTransfer: dt, clientX: box.x + 50, clientY: box.y + 3 });
  await rows.nth(0).dispatchEvent('drop', { dataTransfer: dt, clientX: box.x + 50, clientY: box.y + 3 });
  await page.mouse.up();
  check((await firstBatter()) === 'Liam Patel', 'drag and drop moves batter to 1st');
  check((await page.locator('[aria-label="2nd batter"] option:checked').innerText().then((t) => t.split(' · ')[0].trim())) === 'James Carter', 'other batters shift down');
  await page.fill('[aria-label="2nd batter notes"]', 'Good at rotating the strike');
  await shot(page, '05-batting');

  console.log('Bowling');
  await nav(page, 'Bowling Order');
  const bowlers = [['Oliver Brown', 4], ['Jack Wilson', 4], ['Ethan Nguyen', 4], ['Sam Ahmed', 4], ['Tom Riley', 3], ['Mason Lee', 3]];
  for (let i = 0; i < bowlers.length; i++) {
    const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th'][i];
    await pick(page, `[aria-label="${ord} bowler"]`, bowlers[i][0]);
    await page.fill(`[aria-label="${ord} bowler planned overs"]`, String(bowlers[i][1]));
  }
  check(await page.locator('.callout', { hasText: 'Too many overs planned' }).count() === 1, 'warning when planned overs exceed 20');
  await page.fill('[aria-label="3rd bowler planned overs"]', '5');
  check(await page.locator('.callout', { hasText: 'Bowling restriction' }).count() === 1, 'warning when bowler exceeds T20 4-over limit');
  await page.fill('[aria-label="3rd bowler planned overs"]', '4');
  await page.fill('[aria-label="5th bowler planned overs"]', '2');
  await page.fill('[aria-label="6th bowler planned overs"]', '2');
  check(await page.locator('.callout', { hasText: 'All 20 overs are planned' }).count() === 1, 'confirms when overs total 20');
  await page.fill('[aria-label="1st bowler notes"]', 'Attack the stumps');
  await page.fill('[aria-label="4th bowler notes"]', 'Save slower balls for later overs');

  console.log('Team sheet');
  await nav(page, 'Current Match');
  await page.click('.topbar >> text=Share team sheet');
  const sheet = await page.inputValue('[aria-label="Team sheet text"]');
  check(sheet.includes('BATTING ORDER') && sheet.includes('1. Liam Patel'), 'team sheet lists the batting order');
  check(sheet.includes('Oliver Brown – 4 overs'), 'team sheet lists bowlers and overs');
  check(sheet.includes('Wicketkeeper: Henry Clarke'), 'team sheet lists the field');
  await shot(page, '02b-team-sheet');
  await page.click('.modal-foot >> text=Close');

  console.log('Match Day');
  await nav(page, 'Match Day');
  check((await page.inputValue('input[placeholder="e.g. Memorial Oval"]')) === 'Memorial Oval', 'ground from Current Match appears in Match Day');
  check((await page.inputValue('.panel input[type=date]')) === MATCH_DATE, 'match date shared with Match Day');
  await page.fill('textarea', 'Meet at 12:15. Whites only.');
  await shot(page, '06a-matchday-info');
  await page.click('.md-tab:has-text("Weather Forecast")');
  await page.waitForSelector('text=Match Day Weather');
  check(await page.locator('.callout', { hasText: 'Rain is likely' }).count() === 1, 'rain warning shown for likely rain');
  check(await page.locator('text=Last updated').count() === 1, 'forecast retrieval time shown');
  await shot(page, '06b-matchday-weather');
  await page.click('.md-tab:has-text("Ground & Pitch")');
  await page.click('.seg >> text=Turf');
  await page.click('.seg >> text=Damp');
  await page.locator('.field', { hasText: 'Outfield speed' }).locator('button', { hasText: 'Slow' }).click();
  await page.locator('.field', { hasText: 'Ground size' }).locator('button', { hasText: 'Medium' }).click();
  const beh = (label, v) => page.locator('.row', { hasText: label }).locator('button', { hasText: new RegExp(`^${v}$`) }).click();
  await beh('Assists seam movement', 'Yes');
  await beh('Offers spin', 'No');
  await beh('Assists swing', 'Somewhat');
  await page.fill('input[placeholder="e.g. 65 m"] >> nth=0', '62 m');
  await page.click('text=Search for ground information');
  await page.waitForSelector('text=No reliable published information');
  check(true, 'ground research handles no reliable source');
  await shot(page, '06c-matchday-ground');
  await page.click('.md-tab:has-text("Playing Conditions")');
  await page.selectOption('[aria-label="Scoring area"]', 'midwicket');
  await page.selectOption('[aria-label="How often"]', '3');
  await page.fill('input[placeholder^="e.g. Their opener"]', 'Their opener hits through mid-wicket');
  await page.click('.panel >> button:has-text("Add")');
  await page.selectOption('[aria-label="Scoring area"]', 'cover');
  await page.selectOption('[aria-label="How often"]', '1');
  await page.click('.panel >> button:has-text("Add")');
  check(await page.locator('text=No sourced ground statistics').count() === 1, 'states no sourced statistics are available');
  check(await page.locator('text=Consider extra protection at').count() >= 1, 'fielding suggestion generated from observation');
  await shot(page, '06d-matchday-conditions');
  await page.click('.md-tab:has-text("Tactical Recommendations")');
  const toss = await page.locator('text=Consider Bowling First').count();
  check(toss >= 1, 'damp seaming pitch + rain suggests considering bowling first');
  check(await page.locator('text=Lean towards pace').count() >= 1, 'pace recommended on damp seaming pitch');
  check(await page.locator('text=Your pace options: Oliver Brown, Jack Wilson, Ethan Nguyen').count() >= 1, 'bowling advice names your pace bowlers');
  await shot(page, '06e-matchday-strategy');
  await page.click('.md-tab:has-text("Checklist")');
  check(await page.isChecked('.check-item:has-text("Check the weather forecast") input'), 'weather checklist item ticked after retrieval');
  await page.check('.check-item:has-text("Confirm the 11 players") input');
  await page.fill('input[placeholder="Add your own checklist item…"]', 'Pack the scorebook');
  await page.click('text=Add item');
  check(await page.locator('.check-item', { hasText: 'Pack the scorebook' }).count() === 1, 'custom checklist item added');
  await shot(page, '06f-matchday-checklist');
  await page.click('.md-tab:has-text("Personal Notes")');
  await page.fill('textarea.editor', 'Their number four likes hitting over mid-wicket.\nKeep a deep fielder on the leg side.');

  // Fielding heatmap overlay connected
  await nav(page, 'Fielding Positions');
  await page.click('text=Show scoring areas');
  check(await page.locator('text=Hide scoring areas').count() === 1, 'scoring heatmap overlays on fielding field');
  await shot(page, '04b-fielding-heatmap');
  await page.click('text=Hide scoring areas');

  console.log('Game notes');
  await nav(page, 'Game Notes');
  await page.fill('textarea.editor', 'Good start with the new ball; two early wickets.');
  await page.click('.notes-nav >> text=What went well');
  await page.fill('textarea.editor', 'Ground fielding was sharp.');
  await page.click('.notes-nav >> text=General observations');
  check((await page.inputValue('textarea.editor')).startsWith('Good start'), 'note sections are kept separately');
  await shot(page, '07-game-notes');

  console.log('Tips');
  await nav(page, 'Tips and Improvements');
  const addTip = async (title, cat, status, desc) => {
    await page.click('.topbar >> text=Add New');
    await page.fill('.modal input[placeholder^="e.g. Back up"]', title);
    await page.fill('.modal textarea >> nth=0', desc);
    await page.selectOption('.modal select >> nth=0', cat);
    await page.selectOption('.modal select >> nth=1', status);
    await page.click('.modal >> text=Add entry');
  };
  await addTip('Back up throws at the stumps', 'Fielding', 'In Progress', 'Every throw needs a fielder backing up at the bowler’s end.');
  await addTip('Call clearly when running', 'Communication', 'Not Started', 'Yes, No or Wait — loud and early.');
  await addTip('Bowl to the plan in the death overs', 'Bowling', 'Completed', 'Yorkers and wide yorkers, protect the short side.');
  check(await page.locator('.tip-card').count() === 3, 'three tips added');
  await page.fill('[aria-label="Search"]', 'running');
  check(await page.locator('.tip-card').count() === 1, 'search filters tips');
  await page.fill('[aria-label="Search"]', '');
  await page.selectOption('[aria-label="Filter by category"]', 'Bowling');
  check(await page.locator('.tip-card').count() === 1, 'category filter works');
  await page.selectOption('[aria-label="Filter by category"]', '');
  await page.click('.seg >> text=/^In Progress/');
  check(await page.locator('.tip-card').count() === 1, 'status filter works');
  await page.click('.seg >> text=/^All/');
  await page.locator('.tip-card', { hasText: 'Call clearly' }).locator('text=Edit').click();
  await page.fill('.modal input[placeholder^="e.g. Back up"]', 'Call clearly when running between wickets');
  await page.click('.modal >> text=Save changes');
  check(await page.locator('.tip-card', { hasText: 'between wickets' }).count() === 1, 'edit tip works');
  await shot(page, '08-tips');

  await nav(page, 'Dashboard');
  await shot(page, '01-dashboard');
  await nav(page, 'Current Match');
  await shot(page, '02-current-match');

  console.log('Quick navigation');
  await page.keyboard.press('Control+k');
  await page.fill('[aria-label="Quick search"]', 'r');
  await shot(page, '03b-search');
  await page.fill('[aria-label="Quick search"]', 'bowl');
  await page.keyboard.press('Enter');
  check((await page.locator('.topbar h1').innerText()) === 'Bowling Order', 'quick search (Ctrl/Cmd+K) jumps to a section');
  await page.keyboard.press('Control+3');
  check((await page.locator('.topbar h1').innerText()) === 'Match Day', 'Ctrl/Cmd+3 opens Match Day');
  await page.keyboard.press('Control+k');
  await page.fill('[aria-label="Quick search"]', 'weather');
  await page.keyboard.press('Enter');
  check(await page.locator('.md-tab.on', { hasText: 'Weather Forecast' }).count() === 1, 'search can open a Match Day tab directly');
  await page.goBack();
  check((await page.locator('.topbar h1').innerText()) === 'Bowling Order', 'back button returns to previous section');
  await page.click('.switcher-btn');
  check(await page.locator('.switcher-menu', { hasText: 'Round 6' }).count() === 1, 'match switcher lists upcoming matches');
  await shot(page, '03-match-switcher');
  await page.keyboard.press('Escape');
  await page.click('.topbar h1');
  await nav(page, 'Dashboard');
  await page.locator('button.activity-item').first().click();
  check((await page.locator('.topbar h1').innerText()) !== 'Dashboard', 'recent activity items open their section');

  console.log('Persistence after reload');
  await page.waitForSelector('.save-pill:has-text("Saved")');
  await page.reload();
  await page.waitForSelector('.sidebar');
  await nav(page, 'Fielding Positions');
  check((await page.inputValue('[aria-label="Wicketkeeper player name"]')) === 'Henry Clarke', 'fielding remembered after reopening');
  await nav(page, 'Bowling Order');
  check((await page.inputValue('[aria-label="1st bowler planned overs"]')) === '4', 'planned overs remembered after reopening');
  await nav(page, 'Match Day');
  await page.click('.md-tab:has-text("Checklist")');
  check(await page.isChecked('.check-item:has-text("Confirm the 11 players") input'), 'checklist progress remembered');

  console.log('Finish match & history');
  await nav(page, 'Current Match');
  await page.click('.topbar >> text=Finish Match');
  await page.click('.modal >> button:has-text("Finish match")');
  await page.fill('.modal input', 'Won by 18 runs');
  await page.click('.modal >> text=Save result');
  check((await page.locator('.topbar h1').innerText()) === 'Round 6', 'finished match opens in history review');
  await page.click('.md-tab:has-text("Fielding")');
  await shot(page, '10b-history-review');
  await page.click('text=All matches');
  check(await page.locator('tbody tr', { hasText: 'Eastwood CC' }).locator('text=Finished').count() === 1, 'history lists the finished match');

  // New match copying previous
  await page.click('.topbar >> text=New Match');
  await page.fill('.modal >> input[placeholder="e.g. Round 5"]', 'Round 7');
  await page.fill('.modal >> input[placeholder="e.g. Eastwood CC"]', 'Hills District');
  await page.fill('.modal >> input[type=date]', inDays(40));
  await shot(page, '11-new-match-dialog');
  await page.click('.modal >> text=Create match');
  await nav(page, 'Batting Order');
  check((await page.locator('[aria-label="1st batter"] option:checked').innerText().then((t) => t.split(' · ')[0].trim())) === 'Liam Patel', 'new match copied previous batting order');
  await nav(page, 'Fielding Positions');
  check((await page.inputValue('[aria-label="Wicketkeeper player name"]')) === 'Henry Clarke', 'new match copied fielding setup');
  await page.fill('[aria-label="Wicketkeeper player name"]', 'Tom Riley');
  await nav(page, 'Match Day');
  await page.click('.md-tab:has-text("Match Information")');
  await page.fill('input[placeholder="e.g. Parramatta NSW"]', 'Castle Hill');
  await page.click('.md-tab:has-text("Weather Forecast")');
  await page.waitForSelector('text=Forecast not available yet');
  check(true, 'match 40 days away explains forecast is not available yet');
  await shot(page, '06g-matchday-too-far');

  await nav(page, 'Match History');
  await shot(page, '10-history');
  await page.locator('tbody tr', { hasText: 'Eastwood CC' }).click();
  await page.click('.md-tab:has-text("Fielding")');
  check((await page.locator('.panel .row', { hasText: 'Wicketkeeper' }).first().innerText()).includes('Henry Clarke'), 'previous match fielding unchanged by new match edits');
  await page.click('.topbar >> text=Edit this match');
  check(await page.locator('.banner', { hasText: 'editing a previous match' }).count() === 1, 'editing previous match shows banner');
  await nav(page, 'Game Notes');
  await page.click('text=Return to current match');
  await nav(page, 'Current Match');
  check((await page.locator('.topbar .subtitle').innerText()).includes('Round 7'), 'returning goes back to current match');

  console.log('Backup & restore');
  await page.click('text=Sync & Backup');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Save backup…')]);
  const backupPath = await download.path();
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  check(backup.matches.length === 2 && backup.tips.length === 3, 'backup file contains all matches and tips');
  await shot(page, '12-backup');
  await page.click('.modal-foot >> text=Close');
  // Make a change, then restore the backup
  await nav(page, 'Player Management');
  await page.fill('[aria-label="Player 2 name"]', 'CHANGED');
  await page.click('text=Sync & Backup');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Choose file…')]);
  await chooser.setFiles(backupPath);
  await page.waitForSelector('text=Restore this backup?');
  await page.click('text=Replace my data');
  await page.waitForTimeout(300);
  await nav(page, 'Player Management');
  check((await page.inputValue('[aria-label="Player 2 name"]')) === 'Liam Patel', 'restore brings back backed-up data after confirmation');

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
