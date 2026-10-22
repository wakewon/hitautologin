// Build unsigned AMO upload and matching reviewer sources. Never uploads or signs.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'Firefox Extension');
const output = path.join(root, 'dist', 'firefox-unlisted');
const artifacts = path.join(root, 'dist', 'firefox-upload');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config', 'firefox-unlisted.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
const originalId = manifest.browser_specific_settings.gecko.id;
if (!/^\{[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\}$/i.test(config.id) || config.id === originalId) {
  throw new Error('Configure a fixed, independent UUID in config/firefox-unlisted.json');
}
if (!config.name?.trim()) throw new Error('Distribution name is required');
manifest.name = config.name;
manifest.browser_specific_settings.gecko.id = config.id;
manifest.browser_action.default_title = config.name;
const files = ['content.js', 'background.js', 'popup.html', 'popup.js', 'help.html', 'help.js', 'privacy.html',
  ...new Set(Object.values(manifest.icons))];
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
// Preserve any signed XPI the user may have saved alongside the generated files.
fs.mkdirSync(artifacts, { recursive: true });
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
for (const file of files) copy(path.join(source, file), path.join(output, file));
copy(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
const notice = 'Personal modified distribution of HIT Auto Login.\nOriginal author: Ricardo Zheng.\n'
  + 'MIT License; see LICENSE. This build is distinct from the original published add-on.\n';
fs.writeFileSync(path.join(output, 'NOTICE.txt'), notice);
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
function archive(folder, file) {
  fs.rmSync(file, { force: true });
  const result = spawnSync('zip', ['-X', '-q', '-r', file, '.'], { cwd: folder, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr || 'zip failed');
}
const prefix = `hit-autologin-personal-${manifest.version}`;
const upload = path.join(artifacts, `${prefix}-unsigned.zip`);
const sources = path.join(artifacts, `${prefix}-source.zip`);
archive(output, upload);
const reviewerSource = fs.mkdtempSync(path.join(artifacts, '.reviewer-source-'));
for (const file of [...files, 'manifest.json']) copy(path.join(source, file), path.join(reviewerSource, 'Firefox Extension', file));
for (const file of ['LICENSE', 'scripts/build-firefox-unlisted.cjs', 'config/firefox-unlisted.json']) {
  copy(path.join(root, file), path.join(reviewerSource, file));
}
fs.writeFileSync(path.join(reviewerSource, 'README.md'), `# Reviewer source for ${config.name}\n\n`
  + `Version: ${manifest.version}\nAdd-on ID: ${config.id}\n\n`
  + 'Build on macOS or Linux using Node.js 24 LTS or 26 and the Info-ZIP zip command. '
  + 'Validated with Node.js 26.12.0 and Info-ZIP 3.0 on macOS. No npm dependencies or network access are required.\n\n'
  + 'Run from this extracted directory:\n\n```sh\nnode scripts/build-firefox-unlisted.cjs\n```\n\n'
  + 'Compare the contents of dist/firefox-unlisted/ to the unsigned extension archive. '
  + 'ZIP timestamps can differ; all extracted file contents must match.\n\n'
  + 'JavaScript, HTML, and icons are copied verbatim, with no minification, bundling, transpilation, '
  + 'or remote code. The build changes only the manifest name, add-on ID and toolbar title, '
  + 'and adds LICENSE and NOTICE.txt. The fixed ID is in config/firefox-unlisted.json.\n\n'
  + notice);
archive(reviewerSource, sources);
fs.rmSync(reviewerSource, { recursive: true, force: true });
const notes = 'Personal MIT-licensed modification of HIT Auto Login; original copyright and author retained.\n'
  + 'Desktop Firefox only. Source package includes exact build inputs and offline build instructions.\n'
  + 'No analytics, remote executable code, developer service, or third-party JavaScript dependencies.\n'
  + 'User-entered credentials are stored in browser.storage.local. They are filled only into verified HIT '
  + 'CAS/WLAN sign-in forms, whose own submission sends them to the school. The extension does not '
  + 'send credentials to academic publishers or the maintainer.\n'
  + 'Explicit academic sign-in and WebVPN actions may forward the current resource URL for return navigation.\n'
  + 'Required data declarations: authenticationInfo and browsingActivity. Local failure records contain only '
  + 'host, reason, and time and are not transmitted. See privacy.html for details.\n'
  + 'Broad host access supports the global floating UI and a hard-coded institution-adapter allowlist. '
  + 'CAS credential handling additionally validates HTTPS, exact host, route and trusted form structure.\n'
  + 'Auto Login is off by default. Tests can inspect the UI and institution routing without real school '
  + 'credentials; full school authentication requires an authorized HIT account. No real credentials are included.\n';
fs.writeFileSync(path.join(artifacts, 'reviewer-notes.txt'), notes);
fs.writeFileSync(path.join(artifacts, 'privacy-policy.txt'),
  'HIT Auto Login — personal modified build\n\n'
  + 'Usernames, passwords, settings and bounded failure records are stored locally in Firefox extension storage. '
  + 'This storage is not a separate encrypted password vault. The extension has no maintainer server, analytics, '
  + 'advertising, or remote executable code.\n\n'
  + 'When the user requests sign-in or enables Auto Login, verified HIT CAS/WLAN forms submit credentials '
  + 'to the school authentication service. Credentials are not sent to publishers or the maintainer. '
  + 'Official publisher institution sign-in and explicit HIT WebVPN navigation may pass the current '
  + 'resource URL for return navigation. Recipients handle ordinary authentication and access requests '
  + 'under their own policies. These functions are declared as authenticationInfo and browsingActivity.\n\n'
  + 'Failure records contain only host, reason and time, never credentials, page contents or full URLs, '
  + 'and are not transmitted. Users can clear records and account fields, disable the corresponding features, '
  + 'or remove the extension. No real user data is included in the uploaded files.\n');
const hashes = [upload, sources].map(file => `${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`).join('\n');
fs.writeFileSync(path.join(artifacts, 'SHA256SUMS.txt'), hashes + '\n');
console.log(`AMO extension file: ${upload}\nAMO source file: ${sources}\nAdd-on ID: ${config.id}`);
console.log('Unsigned packages only. Download and install the signed .xpi returned by Mozilla.');
