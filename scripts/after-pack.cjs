// Ad-hoc sign the finished Mac app. Apple Silicon Macs refuse to open apps
// with no signature at all; an ad-hoc signature needs no Apple developer account.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin' || context.electronPlatformName !== 'darwin') return;
  // Universal builds pack each architecture into a "-temp" folder first; sign only the final app.
  if (context.appOutDir.endsWith('-temp')) return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing ${app}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
