# Cricket Team Manager

A personal macOS desktop app for organising a cricket team and preparing for matches.

## Features

- **Dashboard**: shows the current match at a glance, quick links to each section and recent activity.
- **Current Match**: match details, save, finish, and switch between upcoming matches.
- **Match Day**:
  - match information and live weather forecast with rain warnings
  - ground and pitch details, plus ground research from Wikipedia with a source link
  - playing-conditions analysis and run-scoring heatmap
  - pace vs spin and toss recommendations, and the Game Plan
  - checklist and personal notes
- **Fielding Positions**: tick positions and type player names; they appear on the cricket field diagram straight away. You can save several setups, and create, rename, duplicate and delete them.
- **Batting Order**: drag-and-drop or menu-based reordering, with notes for each batter. A player can't appear twice.
- **Bowling Order**: planned overs, with warnings for the total overs and per-bowler limits (T20 / 40 / 50 / custom), plus bowling strategy advice.
- **Game Notes**: a notebook for each match, split into ten sections.
- **Tips and Improvements**: categories and statuses, with search and filters.
- **Player Management**: the 11-player roster that every other section uses, with each player's role, bowling style and batting hand. Match Day bowling advice uses these to name your actual pace and spin options.
- **12-player squad**: pick the playing XI for each match; the 12th player is marked as reserve.
- **Custom fielding**: move any fielder with horizontal and vertical sliders or by dragging, zoom the field, rename positions and add reusable custom positions. Exact spots are saved with each setup.
- **Live Match**: ball-by-ball scoring with run rates, batting and bowling figures, partnerships and scoring areas. It gives tactical suggestions (fielding, bowling, batting, positioning) based on the figures, which you can accept or dismiss.
- **Stats & Play-Cricket**: season stats from imported scorecards and matches scored live.
  - The Mac app can connect to Play-Cricket with your club's API key, which stays on the Mac. You can link players and import scorecards.
  - You can also import a scorecard as CSV on any device.
  - Play-Cricket's official access covers results after play, not a live feed.
- **Field templates**: one-tap balanced, new-ball, spin, powerplay, death-overs and defensive fields. A **left-handed batter** switch mirrors the field.
- **Team sheet**: turns the batting order, bowling plan and field into a message to copy or share with your team.
- **Match History**: read-only review of every match, editing earlier matches, and starting a new match by copying from a previous one.
- **Automatic saving** to your Mac, plus **Backup & Restore** to a single file.
- **Quick navigation**:
  - **⌘K** searches every section, match, tip and player
  - **⌘1–⌘9** jump between sections
  - **⌘N** starts a new match
  - the match switcher in the sidebar changes the current match
  - Recent Activity items on the Dashboard open the section they refer to

Weather comes from [Open-Meteo](https://open-meteo.com), which is free and needs no API key. The app never shows weather that wasn't retrieved from the service. If a match is more than 15 days away, it says the forecast isn't available yet.

Everything except the weather and ground research works offline.

## iPhone and iPad

The same app runs on iPhone and iPad as a web app that you add to your Home Screen. On a phone it switches to a touch layout:
- a tab bar along the bottom
- a **More** menu with every section and search
- up and down arrows for reordering batters and bowlers
- the cricket field shown above the list of positions

Once it's added to your Home Screen, it opens full screen like a normal app and works offline. Only the weather forecast and ground research need an internet connection.

### Install it on your iPhone

1. Publish it once. In this repository go to **Settings → Pages**, set **Source** to **GitHub Actions**, then run the **Publish iPhone web app** workflow from the **Actions** tab. It also runs automatically whenever `main` changes.

   GitHub Pages only works for a public repository, or for a private one on a paid GitHub plan.

2. On your iPhone, open the address the workflow shows (for example `https://<your-username>.github.io/cricketmang/`) in **Safari**.
3. Tap **Share**, then **Add to Home Screen**, then **Add**.

### Keeping your Mac and iPhone in step

Every device saves its own copy, so the app works offline. To share changes between your devices, turn on **Sync** under **Sync & Backup**.

Sync stores your data in a **private** GitHub repository that only you can see. Changes made on one device appear on the others within seconds of them opening the app.

**One-time setup:**
1. Create a new **private** repository named `cricket-data`.
2. Create a fine-grained access key at <https://github.com/settings/personal-access-tokens/new>:
   - **Repository access:** Only select repositories → `cricket-data`
   - **Permissions:** Contents → Read and write
3. In the app on each device, open **Sync & Backup**, paste the key and tap **Turn on sync**.

**How it handles changes:**
- If both devices changed things, they're combined match by match and tip by tip, rather than one copy replacing the other.
- If the same match was edited on both devices, the most recent edit wins.
- Deleted items stay deleted.

**Privacy:** the access key stays on each device. It isn't included in backups or in the synced data, and the app refuses to sync to a public repository.

You can still move data with **Backup & Restore**: save a backup on one device and restore it on another.

## Install on your Mac

### Option A: download the built app

1. On GitHub, open **Actions → Build Mac app**, open the latest run, and download the **Cricket-Team-Manager-mac** artifact.
2. Unzip it, open the `.dmg`, and drag **Cricket Team Manager** into **Applications**.
3. The app isn't signed with an Apple developer certificate. The first time you open it, right-click the app, choose **Open**, then **Open** again.

   If macOS says the app "is damaged", open Terminal and run:

   ```bash
   xattr -cr "/Applications/Cricket Team Manager.app"
   ```

### Option B: build it yourself

You need [Node.js](https://nodejs.org) 20 or later.

```bash
npm install
```

```bash
npm run dist
```

The installer is created in the `release/` folder.

## Development

```bash
npm install
```

Build the app and open it in Electron:

```bash
npm start
```

Run the logic unit tests:

```bash
npm test
```

Run the end-to-end test of every section in a headless browser:

```bash
npm run e2e
```

Run the same kind of test at iPhone size, with touch:

```bash
npm run e2e:mobile
```

Run two devices syncing through a stand-in for GitHub:

```bash
npm run e2e:sync
```

Your data is stored in `~/Library/Application Support/Cricket Team Manager/cricket-data.json`. A copy of the previous version is kept alongside it as `cricket-data.previous.json`.
