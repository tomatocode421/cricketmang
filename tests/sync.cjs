// Two devices (a Mac-sized window and an iPhone) syncing through a fake GitHub.
// The fake keeps one file with a version id (sha) and rejects stale writes,
// like the real GitHub contents API.
//   npm run build && node tests/sync.cjs
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '..', 'dist');
let failures = 0;
const check = (c, m) => {
  console.log(c ? '  ✓' : '  ✗ FAIL:', m);
  if (!c) failures++;
};

// ---- fake GitHub ----
const gh = { file: null, sha: null, writes: 0, private: true, offline: false, raceNextPut: null };
async function fakeGithub(route) {
  const req = route.request();
  const url = new URL(req.url());
  const auth = req.headers()['authorization'];
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  if (gh.offline) return route.abort('internetdisconnected');
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,PUT' } });
  if (auth !== 'Bearer good-key') return json(401, { message: 'Bad credentials' });
  if (url.pathname === '/user') return json(200, { login: 'coach' });
  if (url.pathname === '/repos/coach/cricket-data') return json(200, { private: gh.private });
  if (url.pathname === '/repos/coach/cricket-data/contents/cricket-data.json') {
    if (req.method() === 'GET') {
      if (!gh.file) return json(404, { message: 'Not Found' });
      return json(200, { sha: gh.sha, encoding: 'base64', content: Buffer.from(gh.file).toString('base64') });
    }
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData());
      if (gh.raceNextPut) {
        // Another device uploads just before this one: the file changes underneath it.
        const other = gh.raceNextPut;
        gh.raceNextPut = null;
        gh.file = other(JSON.parse(gh.file));
        gh.sha = crypto.createHash('sha1').update(gh.file).digest('hex');
      }
      if ((body.sha || null) !== gh.sha) return json(409, { message: 'sha mismatch' });
      gh.file = Buffer.from(body.content, 'base64').toString('utf8');
      gh.sha = crypto.createHash('sha1').update(gh.file).digest('hex');
      gh.writes++;
      return json(200, { content: { sha: gh.sha } });
    }
  }
  return json(404, { message: 'Not Found' });
}

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(DIST, p);
      if (!fs.existsSync(f)) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
    });
    srv.listen(0, () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
  const mk = async (opts, label) => {
    const ctx = await browser.newContext(opts);
    await ctx.route('https://api.github.com/**', fakeGithub);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`  [${label} error]`, e.message));
    await page.goto(url);
    await page.waitForSelector('.topbar');
    return page;
  };
  const mac = await mk({ viewport: { width: 1440, height: 900 } }, 'Mac');
  const phone = await mk(iphone, 'iPhone');
  const openSync = async (page) => {
    if (await page.locator('.tabbar').isVisible()) {
      await page.locator('.tabbar button', { hasText: 'More' }).click();
      await page.locator('.sheet-grid button', { hasText: 'Sync & Backup' }).click();
    } else await page.click('.sidebar >> text=Sync & Backup');
    await page.waitForSelector('.modal');
  };
  const closeModal = (page) => page.locator('.modal-foot button', { hasText: 'Close' }).click();
  const goSection = async (page, label) => {
    if (await page.locator('.tabbar').isVisible()) {
      await page.locator('.tabbar button', { hasText: 'More' }).click();
      await page.locator('.sheet-grid button', { hasText: label }).click();
    } else await page.locator('.sidebar .nav-item', { hasText: label }).click();
  };
  const syncNow = async (page) => {
    await openSync(page);
    await page.locator('.modal button', { hasText: 'Sync now' }).click();
    await page.waitForSelector('.modal >> text=Up to date', { timeout: 10000 });
    await closeModal(page);
  };

  console.log('Mac: set up team, then turn on sync');
  await goSection(mac, 'Player Management');
  await mac.fill('[aria-label="Player 1 name"]', 'James Carter');
  await mac.fill('[aria-label="Player 2 name"]', 'Liam Patel');
  await mac.waitForSelector('.save-pill:has-text("Saved")');
  await openSync(mac);
  await mac.fill('[aria-label="Access key"]', 'wrong-key');
  await mac.click('.modal >> text=Turn on sync');
  await mac.waitForSelector('.modal .callout.danger');
  check((await mac.locator('.modal .callout.danger').innerText()).includes('not accepted'), 'a wrong access key is explained clearly');
  gh.private = false;
  await mac.fill('[aria-label="Access key"]', 'good-key');
  await mac.click('.modal >> text=Turn on sync');
  await mac.waitForSelector('.modal .callout.danger:has-text("public")');
  check(true, 'refuses to sync to a public repository');
  gh.private = true;
  await mac.click('.modal >> text=Turn on sync');
  await mac.waitForSelector('.modal >> text=Sync between devices is on', { timeout: 10000 });
  check(!!gh.file && JSON.parse(gh.file).players[0].name === 'James Carter', 'Mac uploads its data to the private repository');
  check(!gh.file.includes('good-key'), 'the access key is never written into the synced data');
  await closeModal(mac);

  console.log('iPhone: turn on sync and receive the Mac team');
  await openSync(phone);
  await phone.fill('[aria-label="Access key"]', 'good-key');
  await phone.click('.modal >> text=Turn on sync');
  await phone.waitForSelector('.modal >> text=Sync between devices is on', { timeout: 10000 });
  await closeModal(phone);
  await goSection(phone, 'Player Management');
  check((await phone.inputValue('[aria-label="Player 1 name"]')) === 'James Carter', 'iPhone gets the team from the Mac (not its own default names)');

  console.log('Change on iPhone → appears on Mac');
  await phone.fill('[aria-label="Player 3 name"]', 'Noah Singh');
  await phone.waitForSelector('.save-pill:has-text("Saved")');
  await phone.waitForFunction(() => document.querySelector('.save-pill')?.textContent.includes('synced'), null, { timeout: 15000 });
  check(JSON.parse(gh.file).players[2].name === 'Noah Singh', 'iPhone change is uploaded automatically');
  await syncNow(mac);
  await goSection(mac, 'Player Management');
  check((await mac.inputValue('[aria-label="Player 3 name"]')) === 'Noah Singh', 'Mac shows the change made on the iPhone');

  console.log('Both devices change different things at the same time');
  await goSection(mac, 'Dashboard');
  await mac.click('.topbar >> text=New Match');
  await mac.fill('.modal >> input[placeholder="e.g. Round 5"]', 'Round 6');
  await mac.click('.modal >> text=Create match');
  await goSection(phone, 'Tips and Improvements');
  await phone.locator('.topbar button', { hasText: 'Add New' }).click();
  await phone.fill('.modal input[placeholder^="e.g. Back up"]', 'Back up throws');
  await phone.locator('.modal button', { hasText: 'Add entry' }).click();
  await syncNow(mac);
  await syncNow(phone);
  await syncNow(mac);
  const remote = JSON.parse(gh.file);
  check(remote.matches.some((m) => m.name === 'Round 6') && remote.tips.some((t) => t.title === 'Back up throws'), 'both changes are kept — nothing overwritten');
  await goSection(mac, 'Tips and Improvements');
  check(await mac.locator('.tip-card', { hasText: 'Back up throws' }).count() === 1, 'Mac shows the tip added on the iPhone');
  await goSection(phone, 'Current Match');
  check((await phone.locator('.topbar .subtitle').innerText()).includes('Round 6'), 'iPhone shows the match created on the Mac');

  console.log('Delete on one device stays deleted');
  await goSection(phone, 'Tips and Improvements');
  await phone.locator('.tip-card', { hasText: 'Back up throws' }).locator('text=Delete').click();
  await phone.locator('.modal button', { hasText: 'Delete' }).click();
  await syncNow(phone);
  await syncNow(mac);
  await syncNow(phone);
  await goSection(mac, 'Tips and Improvements');
  check(await mac.locator('.tip-card', { hasText: 'Back up throws' }).count() === 0, 'tip deleted on iPhone is removed on Mac and does not come back');

  console.log('Two devices upload at the same moment');
  gh.raceNextPut = (d) => {
    d.tips.push({ id: 'tip_race', title: 'Added by the other device', description: '', category: 'Batting', notes: '', status: 'Not Started', matchId: '', createdAt: Date.now(), updatedAt: Date.now() });
    return JSON.stringify(d);
  };
  await goSection(phone, 'Player Management');
  await phone.fill('[aria-label="Player 5 name"]', 'Jack Wilson');
  await phone.waitForFunction(() => document.querySelector('.save-pill')?.textContent.includes('synced'), null, { timeout: 15000 });
  const raced = JSON.parse(gh.file);
  check(raced.players[4].name === 'Jack Wilson' && raced.tips.some((t) => t.id === 'tip_race'), 'when the other device uploads first, both changes are merged and kept');

  console.log('Offline');
  gh.offline = true;
  await goSection(phone, 'Player Management');
  await phone.fill('[aria-label="Player 4 name"]', 'Oliver Brown');
  await phone.waitForFunction(() => /offline/i.test(document.querySelector('.save-pill')?.textContent || ''), null, { timeout: 15000 });
  check(true, 'shows "offline" and keeps the change on the phone');
  gh.offline = false;
  await phone.evaluate(() => window.dispatchEvent(new Event('online')));
  await phone.waitForFunction(() => document.querySelector('.save-pill')?.textContent.includes('synced'), null, { timeout: 15000 });
  check(JSON.parse(gh.file).players[3].name === 'Oliver Brown', 'change made offline uploads once back online');

  console.log(`  (${gh.writes} uploads in total)`);
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll sync checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
