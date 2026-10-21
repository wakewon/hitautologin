// Generate an isolated, unsigned Firefox development build for about:debugging.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'Firefox Extension');
const output = path.join(root, 'dist', 'firefox-dev');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
manifest.name = 'HIT 自动登录（本地开发版）';
manifest.browser_specific_settings.gecko.id = 'hit-autologin-dev@local.invalid';
manifest.browser_action.default_title = manifest.name;
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['content.js', 'background.js', 'popup.html', 'popup.js', 'help.html', 'help.js', 'icons']) {
  fs.cpSync(path.join(source, name), path.join(output, name), { recursive: true });
}
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Load this manifest in about:debugging#/runtime/this-firefox:\n${path.join(output, 'manifest.json')}`);
console.log('Temporary, unsigned development build. Existing extension settings stay separate.');
