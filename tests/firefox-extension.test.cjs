const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'Firefox Extension');
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };

async function popup(t, initial = {}, response = { ok: true }) {
  const dom = new JSDOM(fs.readFileSync(path.join(extension, 'popup.html'), 'utf8'), {
    runScripts: 'outside-only', url: 'https://fixture.example/', virtualConsole: new VirtualConsole()
  });
  t.after(() => dom.window.close());
  const values = { ...initial }, messages = [], opened = [];
  dom.window.browser = {
    storage: { local: {
      get: async key => ({ [key]: values[key] }), set: async items => Object.assign(values, items)
    } },
    runtime: { getURL: file => 'moz-extension://fixture/' + file },
    tabs: {
      query: async () => [{ id: 5, url: 'https://www.cnki.net/' }],
      sendMessage: async (id, message) => { messages.push({ id, ...message }); return response; },
      create: async info => opened.push(info), update: async () => {}
    }
  };
  dom.window.eval(fs.readFileSync(path.join(extension, 'popup.js'), 'utf8'));
  await flush();
  return { doc: dom.window.document, w: dom.window, values, messages, opened };
}

test('Firefox popup loads settings and starts institutional login without requiring a floating button', async t => {
  const env = await popup(t, { fabEnabled: false, institutionAutoSelect: false });
  assert.equal(env.doc.querySelector('#institutionAutoSelect').checked, false);
  env.doc.querySelector('#btnInstitutionLogin').click();
  await flush();
  assert.equal(env.messages[0].type, 'HIT_INSTITUTION_LOGIN');
  assert.match(env.doc.querySelector('#hint').textContent, /已启动机构登录/);
  assert.equal(env.values.institutionAutoSelect, false);
});

test('Firefox popup shows a useful unsupported-page result instead of reporting success', async t => {
  const env = await popup(t, {}, { ok: false });
  env.doc.querySelector('#btnInstitutionLogin').click();
  await flush();
  assert.match(env.doc.querySelector('#hint').textContent, /未适配或尚未加载/);
});

test('Firefox popup updates the independent school-selection setting', async t => {
  const env = await popup(t, { autoLogin: true });
  const control = env.doc.querySelector('#institutionAutoSelect');
  control.checked = false;
  control.dispatchEvent(new env.w.Event('change', { bubbles: true }));
  await flush();
  assert.equal(env.values.institutionAutoSelect, false);
  assert.equal(env.values.autoLogin, true);
});

test('Firefox failure viewer uses plain text and can clear records', async t => {
  const env = await popup(t, { institutionFailures: [{ host: '<img src=x onerror=fixture>', reason: 'No HIT', time: 1 }] });
  env.doc.querySelector('#btnFailures').click();
  await flush();
  const display = env.doc.querySelector('#failureList');
  assert.equal(display.hidden, false);
  assert.equal(display.querySelector('img'), null);
  assert.match(display.textContent, /No HIT/);
  env.doc.querySelector('#btnClearFailures').click();
  await flush();
  assert.equal(env.values.institutionFailures.length, 0);
  assert.match(display.textContent, /暂无失败记录/);
});

test('Firefox help link is reachable and opens the packaged help page', async t => {
  const env = await popup(t);
  assert.equal(env.doc.querySelector('.lang-row').style.display, '');
  env.doc.querySelector('#help').click();
  await flush();
  assert.equal(env.opened[0].url, 'moz-extension://fixture/help.html');
  const html = fs.readFileSync(path.join(extension, 'help.html'), 'utf8');
  assert.match(html, /about:debugging/);
  const help = new JSDOM(html);
  t.after(() => help.window.close());
  for (const script of help.window.document.querySelectorAll('script')) assert.ok(script.src, 'Firefox CSP requires an external script');
});

test('Firefox background routes both context menus and keeps locale changes working', async () => {
  const events = {}, menus = [], messages = [];
  const browser = {
    storage: { local: { get: async () => ({ lang: 'en' }) }, onChanged: { addListener: fn => events.changed = fn } },
    runtime: { onInstalled: { addListener: fn => events.installed = fn }, onStartup: { addListener: fn => events.startup = fn } },
    contextMenus: { removeAll: async () => menus.splice(0), create: menu => menus.push(menu), onClicked: { addListener: fn => events.clicked = fn } },
    tabs: { sendMessage: async (id, message) => messages.push({ id, ...message }) }
  };
  vm.runInNewContext(fs.readFileSync(path.join(extension, 'background.js'), 'utf8'), { browser, console });
  await events.installed();
  assert.equal(menus.length, 2);
  await events.clicked({ menuItemId: 'hit_institution_login' }, { id: 4 });
  await events.clicked({ menuItemId: 'hit_trigger_login' }, { id: 4 });
  assert.equal(messages[0].type, 'HIT_INSTITUTION_LOGIN');
  assert.equal(messages[1].type, 'HIT_TRIGGER_LOGIN');
  events.changed({ lang: { newValue: 'en' } }, 'local');
  await flush();
  assert.equal(menus.length, 2);
  assert.match(menus[0].title, /Institutional sign-in/);
});

test('development build has an independent identity and all referenced scripts, without altering the source identity', () => {
  const before = fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8');
  const result = spawnSync(process.execPath, ['scripts/build-firefox-dev.cjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = path.join(root, 'dist', 'firefox-dev');
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  assert.notEqual(manifest.browser_specific_settings.gecko.id, JSON.parse(before).browser_specific_settings.gecko.id);
  assert.equal(manifest.browser_specific_settings.gecko.id, 'hit-autologin-dev@local.invalid');
  assert.equal(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'), before);
  for (const file of [...manifest.background.scripts, ...manifest.content_scripts.flatMap(entry => entry.js), 'help.js', 'popup.js', 'privacy.html', 'LICENSE']) {
    assert.ok(fs.existsSync(path.join(output, file)), `missing packaged file ${file}`);
  }
  assert.deepEqual(manifest.permissions, JSON.parse(before).permissions);
});

test('unlisted upload has an independent fixed ID, clean archive roots, and reproducible reviewer sources', t => {
  const before = fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8');
  const artifacts = path.join(root, 'dist', 'firefox-upload');
  fs.mkdirSync(artifacts, { recursive: true });
  const preserved = path.join(artifacts, 'test-signed-download.xpi');
  fs.writeFileSync(preserved, 'fixture: user downloaded signed file');
  t.after(() => fs.rmSync(preserved, { force: true }));
  const built = spawnSync(process.execPath, ['scripts/build-firefox-unlisted.cjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  assert.equal(fs.readFileSync(preserved, 'utf8'), 'fixture: user downloaded signed file');
  const output = path.join(root, 'dist', 'firefox-unlisted');
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config', 'firefox-unlisted.json'), 'utf8'));
  assert.equal(manifest.browser_specific_settings.gecko.id, config.id);
  assert.notEqual(config.id, JSON.parse(before).browser_specific_settings.gecko.id);
  assert.notEqual(config.id, 'hit-autologin-dev@local.invalid');
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['authenticationInfo', 'browsingActivity']);
  assert.equal(manifest.browser_specific_settings.gecko_android.strict_min_version, '142.0');
  assert.equal(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'), before);
  const prefix = `hit-autologin-personal-${manifest.version}`;
  const upload = path.join(artifacts, `${prefix}-unsigned.zip`);
  const sources = path.join(artifacts, `${prefix}-source.zip`);
  const listing = spawnSync('unzip', ['-Z1', upload], { encoding: 'utf8' });
  assert.equal(listing.status, 0, listing.stderr);
  const entries = listing.stdout.trim().split('\n');
  assert.ok(entries.includes('manifest.json'), 'manifest must be at the archive root');
  assert.ok(entries.includes('LICENSE'));
  assert.ok(entries.includes('privacy.html'));
  assert.equal(entries.some(file => /(?:^|\/)(?:\.git|node_modules|\.env|scripts|config)(?:\/|$)/.test(file)), false);
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'hit-amo-source-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const extracted = spawnSync('unzip', ['-q', sources, '-d', tmp], { encoding: 'utf8' });
  assert.equal(extracted.status, 0, extracted.stderr);
  const rebuilt = spawnSync(process.execPath, ['scripts/build-firefox-unlisted.cjs'], { cwd: tmp, encoding: 'utf8' });
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  for (const file of entries.filter(entry => !entry.endsWith('/'))) {
    assert.deepEqual(fs.readFileSync(path.join(tmp, 'dist', 'firefox-unlisted', file)), fs.readFileSync(path.join(output, file)), `source rebuild differs: ${file}`);
  }
  const hashes = fs.readFileSync(path.join(artifacts, 'SHA256SUMS.txt'), 'utf8');
  for (const file of [upload, sources]) {
    assert.ok(hashes.includes(require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')));
  }
});
