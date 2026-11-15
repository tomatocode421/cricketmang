// Bundles the built app (dist/) into one self-contained HTML file.
// Used to publish a try-it-now preview; the real install uses dist/ as is.
//   npm run build && node scripts/build-single.mjs out.html
import fs from 'fs';
import path from 'path';

const dist = path.resolve('dist');
const out = process.argv[2] || 'cricket-single.html';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/);
const css = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/);
if (!js || !css) throw new Error('Could not find the built script or stylesheet in dist/index.html');
const script = fs.readFileSync(path.join(dist, js[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = fs.readFileSync(path.join(dist, css[1]), 'utf8');
const page = `<title>Cricket Team Manager</title>
<meta name="theme-color" content="#0e1011">
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
fs.writeFileSync(out, page);
console.log(`Wrote ${out} (${Math.round(page.length / 1024)} KB)`);
