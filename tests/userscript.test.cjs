const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const source = readFileSync(new URL('../Tampermonkey/app.js', `file://${__filename}`), 'utf8');
const IDP = 'https://idp.hit.edu.cn/idp/shibboleth';
const cas = `<form id="pwdFromId" method="post" action="/authserver/login"><input id="username" type="text" name="username"><input id="password" type="password" name="passwordText"><input name="execution" type="hidden" value="fixture"><input name="_eventId" type="hidden" value="submit"><input id="rememberMe" type="checkbox"><a id="login_submit">登录</a></form>`;

function setup(t, url, html = '', options = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const w = dom.window;
  const values = options.values || new Map([['username', 'fixture-user'], ['password', 'fixture-password'], ['autoLogin', true], ['fabEnabled', false]]);
  const reads = [], navigations = [], menus = new Map(), timers = new Map();
  const loc = new URL(url);
  const location = Object.fromEntries(['href', 'hostname', 'pathname', 'search', 'protocol', 'origin'].map(k => [k, loc[k]]));
  location.assign = target => navigations.push(target);
  w.__testLocation = location;
  w.GM_getValue = (key, fallback) => { reads.push(key); return values.has(key) ? values.get(key) : fallback; };
  w.GM_setValue = (key, value) => values.set(key, value);
  w.GM_registerMenuCommand = (name, fn) => menus.set(name, fn);
  w.alert = () => {};
  // JSDOM has no layout; model visible rectangles without changing the production visibility check.
  w.Element.prototype.getClientRects = function () {
    for (let e = this; e; e = e.parentElement) {
      const style = w.getComputedStyle(e);
      if (e.hidden || style.display === 'none' || style.visibility === 'hidden') return [];
    }
    return [{}];
  };
  let time = 1000000, seq = 0;
  w.Date.now = () => time;
  w.setTimeout = (fn, ms = 0) => { timers.set(++seq, { fn, at: time + ms }); return seq; };
  w.setInterval = (fn, ms) => { timers.set(++seq, { fn, at: time + ms, interval: ms }); return seq; };
  w.clearTimeout = w.clearInterval = id => timers.delete(id);
  Object.defineProperty(w.document, 'readyState', { get: () => 'complete' });
  if (options.before) options.before(w);
  w.eval(`((location) => {\n${source}\n})(window.__testLocation)`);
  t.after(() => { timers.clear(); dom.window.close(); });
  async function tick(ms) {
    await Promise.resolve();
    const target = time + ms;
    let iterations = 0;
    while (true) {
      const next = [...timers].filter(([, v]) => v.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++iterations < 1000, 'timers must remain bounded');
      const [id, timer] = next;
      time = timer.at;
      if (timer.interval) timer.at += timer.interval;
      else timers.delete(id);
      timer.fn();
      await Promise.resolve();
    }
    time = target;
    await Promise.resolve();
  }
  return { w, doc: w.document, values, reads, navigations, menus, tick, location, timers };
}

for (const url of [
  'https://xg.hit.edu.cn/login?jg=x&url=x',
  'https://other.hit.edu.cn/login',
  'https://mail.hit.edu.cn/login',
  'https://xg-hit-edu-cn-s.ivpn.hit.edu.cn/login',
  'https://ids.hit.edu.cn/retrieve-password/index.html',
  'https://ids.hit.edu.cn/authserver/login-evil',
  'http://ids.hit.edu.cn/authserver/login',
  'https://ids.hit.edu.cn.evil.example/authserver/login'
]) test(`never fills or submits outside approved routes: ${url}`, async t => {
  const env = setup(t, url, cas);
  let clicks = 0;
  env.doc.querySelector('#login_submit').onclick = () => clicks++;
  env.w.HITLoginAuto2.triggerLogin();
  await env.tick(31000);
  assert.equal(env.doc.querySelector('#username').value, '');
  assert.equal(env.doc.querySelector('#password').value, '');
  assert.equal(clicks, 0);
  assert.equal(env.doc.querySelector('#hit-overlay-host'), null);
  assert.equal(env.reads.includes('password'), false);
});

test('CAS fills the observed password form and submits exactly once', async t => {
  let clicks = 0;
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login?service=fixture', cas, {
    before(w) { w.document.querySelector('#login_submit').onclick = () => clicks++; }
  });
  assert.equal(env.doc.querySelector('#username').value, 'fixture-user');
  assert.equal(env.doc.querySelector('#password').value, 'fixture-password');
  env.w.HITLoginAuto2.triggerLogin();
  await env.tick(25000);
  assert.equal(clicks, 1);
  assert.equal(env.doc.querySelector('#hit-overlay-host'), null);
});

for (const [name, html] of [
  ['generic unrelated form', '<form><input id="username" type="text"><input id="password" type="password"><button id="login_submit">登录</button></form>'],
  ['cross-origin submission', cas.replace('action="/authserver/login"', 'action="https://evil.example/authserver/login"')],
  ['hidden password form', cas.replace('<form ', '<form hidden ')],
  ['missing CAS flow markers', cas.replace('name="execution"', 'name="unrelated"')],
  ['password field is hidden', cas.replace('id="password" type="password"', 'id="password" type="hidden"')],
  ['button outside credential form', cas.replace('<a id="login_submit">登录</a>', '') + '<a id="login_submit">登录</a>']
]) test(`rejects ${name} even on the CAS host`, async t => {
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', html);
  await env.tick(31000);
  assert.equal(env.doc.querySelector('#password').value, '');
  assert.equal(env.reads.includes('password'), false);
});

test('asynchronously mounted CAS form is filled without broad page heuristics', async t => {
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login');
  await env.tick(900);
  env.doc.body.innerHTML = cas;
  await env.tick(600);
  assert.equal(env.doc.querySelector('#username').value, 'fixture-user');
});

test('fill-only mode never submits; manual trigger only overrides that setting', async t => {
  let clicks = 0;
  const values = new Map([['username', 'fixture-user'], ['password', 'fixture-password'], ['autoLogin', false], ['fabEnabled', false]]);
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas, {
    values, before(w) { w.document.querySelector('#login_submit').onclick = () => clicks++; }
  });
  await env.tick(500);
  assert.equal(clicks, 0);
  assert.equal(env.doc.querySelector('#password').value, 'fixture-password');
  env.w.HITLoginAuto2.triggerLogin();
  await env.tick(200);
  assert.equal(clicks, 1);
});

test('empty credentials never submit', async t => {
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas, { values: new Map([['autoLogin', true], ['fabEnabled', false]]) });
  let clicks = 0;
  env.doc.querySelector('#login_submit').onclick = () => clicks++;
  await env.tick(1000);
  assert.equal(clicks, 0);
  assert.equal(env.doc.querySelector('#hit-overlay-host'), null);
});

test('captcha appearance after click pauses this page without disabling saved preferences', async t => {
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas);
  await env.tick(200);
  env.doc.body.insertAdjacentHTML('beforeend', '<div id="captcha-box">验证码</div>');
  await env.tick(500);
  assert.equal(env.doc.querySelector('#hit-overlay-host'), null);
  assert.equal(env.values.get('autoLogin'), true);
});

test('hidden captcha does not block normal login; visible captcha prevents credential access', async t => {
  const hidden = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas + '<div id="captcha-box" hidden></div>');
  assert.equal(hidden.doc.querySelector('#username').value, 'fixture-user');
  const visible = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas + '<input id="captcha" type="text">');
  assert.equal(visible.doc.querySelector('#username').value, '');
});

test('closing overlay cancels a pending submit', async t => {
  let clicks = 0;
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas, {
    before(w) { w.document.querySelector('#login_submit').onclick = () => clicks++; }
  });
  env.doc.querySelector('#hit-overlay-host').shadowRoot.querySelector('#hit-overlay-close').click();
  await env.tick(1000);
  assert.equal(clicks, 0);
});

test('WLAN uses its own explicit host, route and panel', async t => {
  const env = setup(t, 'https://webportal.hit.edu.cn/srun_portal_pc', '<input id="ac_id" type="hidden"><div class="panel-login"><input id="username" type="text"><input id="password" type="password"><button id="login">登录</button></div>');
  assert.equal(env.doc.querySelector('#password').value, 'fixture-password');
});

const wiley = '<input id="searchInstitution"><ul id="autoComplete_list_1"></ul>';
test('Wiley searches once and selects HIT from asynchronous results without touching passwords', async t => {
  const env = setup(t, 'https://onlinelibrary.wiley.com/action/ssostart', wiley + '<input id="password" type="password">');
  let searches = 0, clicks = 0;
  env.doc.querySelector('#searchInstitution').addEventListener('input', () => searches++);
  await env.tick(300);
  assert.equal(env.doc.querySelector('#searchInstitution').value, 'Harbin');
  env.doc.querySelector('ul').innerHTML = `<li><a href="?idp=https://idp.hrbeu.edu.cn/idp/shibboleth">Harbin Engineering University</a></li><li><a id="hit" href="https://iam.atypon.com/action/ssostart?idp=${encodeURIComponent(IDP)}">Harbin Institute of Technology</a></li>`;
  env.doc.querySelector('#hit').onclick = e => { e.preventDefault(); clicks++; };
  await env.tick(2500);
  assert.equal(searches, 1);
  assert.equal(clicks, 1);
  assert.equal(env.doc.querySelector('#password').value, '');
  assert.equal(env.reads.includes('password'), false);
});

for (const [name, entity] of [
  ['Harbin Engineering University', ''],
  ['Harbin Institute of Technology Weihai', ''],
  ['Harbin Institute of Technology (Shenzhen)', ''],
  ['哈尔滨工业大学（威海）', ''],
  ['HIT', ''],
  ['Harbin Institute of Technology', 'https://idp.hit.edu.cn.evil.example/idp/shibboleth'],
  ['Harbin Institute of Technology', 'https://idp.hrbeu.edu.cn/idp/shibboleth']
]) test(`never selects ambiguous or conflicting institution: ${name} ${entity}`, async t => {
  let clicks = 0;
  const env = setup(t, 'https://pubs.acs.org/institutional-login', `<input id="institutionSearchInput"><div role="option" class="institution-search__result-item" ${entity ? `data-shibboleth-id="${entity}"` : ''}>${name}</div>`, {
    before(w) { w.document.querySelector('[role="option"]').onclick = () => clicks++; }
  });
  await env.tick(2000);
  assert.equal(clicks, 0);
});

for (const name of ['Harbin Institute of Technology', 'HARBIN INST OF TECHNOLOGY', '哈尔滨工业大学(Harbin Institute of Technology) (Harbin Institute of Technology)']) {
  test(`accepts verified institution label: ${name}`, async t => {
    let clicks = 0;
    const env = setup(t, 'https://pubs.acs.org/institutional-login', `<input id="institutionSearchInput"><div role="option" class="institution-search__result-item">${name}</div>`, {
      before(w) { w.document.querySelector('[role="option"]').onclick = () => clicks++; }
    });
    await env.tick(1500);
    assert.equal(clicks, 1);
  });
}

test('Elsevier personal-email form never becomes an institution search', async t => {
  const env = setup(t, 'https://id.elsevier.com/as/authorization.oauth2', '<form><input id="bdd-email"><input type="password"></form>');
  await env.tick(1500);
  assert.equal(env.doc.querySelector('#bdd-email').value, '');
});

test('Elsevier accepts mixed Chinese/English result text and never clicks an unselected continue', async t => {
  let clicks = 0, submits = 0;
  const env = setup(t, 'https://id.elsevier.com/as/authorization.oauth2', '<div id="wayfEmailForm"><input id="bdd-email"><button id="bdd-els-searchBtn">Continue</button><div id="bdd-institution-resultList"></div></div>', {
    before(w) { w.document.querySelector('#bdd-els-searchBtn').onclick = () => submits++; }
  });
  await env.tick(500);
  assert.equal(submits, 0);
  env.doc.querySelector('#bdd-institution-resultList').innerHTML = '<button>哈尔滨工业大学(Harbin Institute of Technology) (Harbin Institute of Technology)</button>';
  env.doc.querySelector('#bdd-institution-resultList button').onclick = () => clicks++;
  await env.tick(1500);
  assert.equal(clicks, 1);
  assert.equal(submits, 1);
});

test('Springer selects a result before submitting and tolerates a disabled submit', async t => {
  let clicks = 0;
  const env = setup(t, 'https://wayf.springernature.com/?redirect_uri=https://link.springer.com', '<input id="autocomplete-input"><button id="institution-submit" disabled>Access</button><div id="eds-c-autocomplete-dropdown-option-0">Harbin Institute of Technology</div>', {
    before(w) { w.document.querySelector('#institution-submit').onclick = () => clicks++; }
  });
  await env.tick(500);
  assert.equal(clicks, 0);
  env.doc.querySelector('#institution-submit').disabled = false;
  await env.tick(1500);
  assert.equal(clicks, 1);
});

test('Silverchair federation then institution then Shibboleth, never its personal login form', async t => {
  let submits = 0, personal = 0;
  const env = setup(t, 'https://asmedigitalcollection.asme.org/institutional-login', `<input type="password"><button id="personal">Log In</button><select id="FederationDropdown"><option value="">Select</option><option value="carsi">China (CARSI)</option></select><select id="InstitutionDropdown"><option value="">Select Institution</option></select><a id="shibbolethSelectBtn">Select</a>`, {
    before(w) {
      w.document.querySelector('#personal').onclick = () => personal++;
      w.document.querySelector('#shibbolethSelectBtn').onclick = () => submits++;
      w.document.querySelector('#FederationDropdown').onchange = () => {
        w.document.querySelector('#InstitutionDropdown').innerHTML = `<option value="">Select</option><option value="${IDP}">Harbin Institute of Technology</option>`;
      };
    }
  });
  await env.tick(2200);
  assert.equal(env.doc.querySelector('#InstitutionDropdown').value, IDP);
  assert.equal(submits, 1);
  assert.equal(personal, 0);
});

test('missing institution times out, logs only host/reason/time and does not select another school', async t => {
  const env = setup(t, 'https://onlinelibrary.wiley.com/action/ssostart?secret=fixture', wiley);
  await env.tick(32000);
  const failure = env.values.get('institutionFailures')[0];
  assert.equal(failure.host, 'onlinelibrary.wiley.com');
  assert.match(failure.reason, /30/);
  assert.deepEqual(Object.keys(failure).sort(), ['host', 'reason', 'time']);
});

test('challenge is logged once and selection resumes when human verification finishes', async t => {
  const env = setup(t, 'https://onlinelibrary.wiley.com/action/ssostart', '<title>Just a moment...</title>' + wiley);
  await env.tick(3000);
  assert.equal(env.doc.querySelector('input').value, '');
  assert.equal(env.values.get('institutionFailures').length, 1);
  env.doc.title = 'Institutional Login';
  await env.tick(1500);
  assert.equal(env.doc.querySelector('input').value, 'Harbin');
});

test('other school query is preserved until explicit one-click HIT login', async t => {
  const env = setup(t, 'https://onlinelibrary.wiley.com/action/ssostart', wiley.replace('<input id="searchInstitution">', '<input id="searchInstitution" value="Tsinghua">'));
  await env.tick(500);
  assert.equal(env.doc.querySelector('input').value, 'Tsinghua');
  env.w.HITLoginAuto2.institutionLogin();
  await env.tick(500);
  assert.equal(env.doc.querySelector('input').value, 'Harbin');
});

test('one-click flow works with auto selection disabled and keeps that preference disabled', async t => {
  const values = new Map([['institutionAutoSelect', false], ['fabEnabled', false]]);
  const env = setup(t, 'https://onlinelibrary.wiley.com/action/ssostart', wiley, { values });
  await env.tick(500);
  assert.equal(env.doc.querySelector('input').value, '');
  env.w.HITLoginAuto2.institutionLogin();
  await env.tick(500);
  assert.equal(env.doc.querySelector('input').value, 'Harbin');
  assert.equal(values.get('institutionAutoSelect'), false);
});

test('unknown domains and publisher article search boxes remain untouched', async t => {
  const unknown = setup(t, 'https://evil.example/action/ssostart', wiley);
  const article = setup(t, 'https://onlinelibrary.wiley.com/doi/fixture', wiley);
  await unknown.tick(1500); await article.tick(1500);
  assert.equal(unknown.doc.querySelector('input').value, '');
  assert.equal(article.doc.querySelector('input').value, '');
});

test('floating one-click button is visible on a supported publisher homepage and preserves article return URL', async t => {
  const values = new Map([['fabEnabled', true]]);
  const env = setup(t, 'https://ieeexplore.ieee.org/document/123?arnumber=123', '', { values });
  const root = env.doc.querySelector('#hit-fab-host').shadowRoot;
  const button = root.querySelector('#hit-institution-login');
  assert.equal(button.textContent, '哈工大登录');
  assert.equal(button.closest('#hit-fab-panel'), null);
  assert.equal(env.navigations.length, 0);
  button.click();
  const target = new URL(env.navigations[0]);
  assert.equal(target.pathname, '/servlet/wayf.jsp');
  assert.equal(target.searchParams.get('entityId'), IDP);
  assert.equal(target.searchParams.get('url'), env.location.href);
});

test('repeated institution redirects are bounded', t => {
  const env = setup(t, 'https://www.emerald.com/', '');
  for (let i = 0; i < 5; i++) env.w.HITLoginAuto2.institutionLogin();
  assert.equal(env.navigations.length, 2);
  assert.match(env.values.get('institutionFailures')[0].reason, /反复/);
});

test('IDP consent waits for its own form, submits once, and honors disabling before click', async t => {
  let clicks = 0;
  const consent = '<form action="/idp/profile/SAML2/Redirect/SSO"><input id="accept" type="checkbox"><button name="_eventId_proceed" type="button">Continue</button></form>';
  const env = setup(t, 'https://idp.hit.edu.cn/idp/profile/SAML2/Redirect/SSO', '', {
    before(w) { w.document.addEventListener('click', e => { if (e.target.name === '_eventId_proceed') clicks++; }); }
  });
  env.doc.body.innerHTML = consent;
  await env.tick(500);
  assert.equal(clicks, 1);
  env.doc.body.appendChild(env.doc.createElement('div'));
  await env.tick(1000);
  assert.equal(clicks, 1);
  const paused = setup(t, 'https://idp.hit.edu.cn/idp/profile/SAML2/Redirect/SSO', consent);
  paused.values.set('idpAutoAuth', false);
  let pausedClicks = 0;
  paused.doc.querySelector('button').onclick = () => pausedClicks++;
  await paused.tick(500);
  assert.equal(pausedClicks, 0);
});

test('never combines another manually entered username with the saved password', async t => {
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas.replace('name="username"', 'name="username" value="another-user"'));
  await env.tick(1000);
  assert.equal(env.doc.querySelector('#username').value, 'another-user');
  assert.equal(env.doc.querySelector('#password').value, '');
  assert.equal(env.doc.querySelector('#hit-overlay-host'), null);
});

test('explicit retry is possible after a captcha pause without duplicate pending clicks', async t => {
  let clicks = 0;
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas + '<div id="captcha-box">Captcha</div>', {
    before(w) { w.document.querySelector('#login_submit').onclick = () => clicks++; }
  });
  assert.equal(env.doc.querySelector('#username').value, '');
  env.doc.querySelector('#captcha-box').remove();
  env.w.HITLoginAuto2.triggerLogin();
  env.w.HITLoginAuto2.triggerLogin();
  await env.tick(1000);
  assert.equal(clicks, 1);
});

test('bad credentials disable future automatic submissions', async t => {
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas);
  await env.tick(300);
  env.doc.body.insertAdjacentHTML('beforeend', '<span id="showErrorTip" title="该账号非常用账号或用户名密码有误"></span>');
  await env.tick(500);
  assert.equal(env.values.get('autoLogin'), false);
});

test('missing selection controls after a one-click request are recorded', async t => {
  const env = setup(t, 'https://onlinelibrary.wiley.com/action/ssostart');
  env.w.HITLoginAuto2.institutionLogin();
  await env.tick(32000);
  assert.match(env.values.get('institutionFailures')[0].reason, /未检测到/);
});

test('Cambridge observes its real option roles and requires selection before Continue', async t => {
  let submits = 0;
  const env = setup(t, 'https://shibboleth-discovery.cambridge.org/discovery/WAYF/?entityID=fixture', '<input id="institution"><ul><li role="option">Harbin Engineering University</li><li role="option">Harbin Institute of Technology</li></ul><button>Continue to login</button>', {
    before(w) { w.document.querySelector('button').onclick = () => submits++; }
  });
  await env.tick(1700);
  assert.equal(submits, 1);
});

test('CARSI uses Chinese query and the actual typeahead result before its dedicated login button', async t => {
  let submits = 0;
  const env = setup(t, 'https://ds.carsi.edu.cn/login/index.html?entityID=fixture', '<form id="idpForm"><input id="show"><input id="hid-inp" type="hidden"><ul class="typeahead"></ul><button type="button" id="idpSkipButton">登录</button></form>', {
    before(w) { w.document.querySelector('button').onclick = () => submits++; }
  });
  await env.tick(500);
  assert.equal(env.doc.querySelector('#show').value, '哈尔滨工业大学');
  assert.equal(submits, 0);
  env.doc.querySelector('ul').innerHTML = '<li><a role="option" href="#">哈尔滨工业大学（Harbin Institute of Technology）</a></li>';
  env.doc.querySelector('a').onclick = e => e.preventDefault();
  await env.tick(1700);
  assert.equal(submits, 1);
});

test('SAGE personal sign in is left alone until explicit institutional login', async t => {
  let carsiClicks = 0, personalClicks = 0;
  const env = setup(t, 'https://sage.cnpereading.com/login?redirect=/action/showLogin', '<input type="password"><button id="personal">登录</button><button id="carsi">通过 CARSI 登录</button>', {
    before(w) {
      w.document.querySelector('#personal').onclick = () => personalClicks++;
      w.document.querySelector('#carsi').onclick = () => carsiClicks++;
    }
  });
  await env.tick(1500);
  assert.equal(carsiClicks, 0);
  env.w.HITLoginAuto2.institutionLogin();
  await env.tick(1500);
  assert.equal(carsiClicks, 1);
  assert.equal(personalClicks, 0);
});

test('ASME missing HIT never chooses another school or submits its personal form', async t => {
  let submissions = 0;
  const env = setup(t, 'https://asmedigitalcollection.asme.org/institutional-login', '<select id="FederationDropdown"><option value="">Select</option><option value="cn" selected>China (CARSI)</option></select><select id="InstitutionDropdown"><option value="">Select</option><option value="other">Tsinghua University</option></select><a id="shibbolethSelectBtn">Select</a><button id="personal">Log in</button>', {
    before(w) { w.document.addEventListener('click', () => submissions++); }
  });
  await env.tick(32000);
  assert.equal(submissions, 0);
  assert.equal(env.doc.querySelector('#InstitutionDropdown').value, '');
  assert.match(env.values.get('institutionFailures')[0].reason, /未提供哈尔滨工业大学/);
});

test('native credential form must use the observed POST method', async t => {
  const env = setup(t, 'https://ids.hit.edu.cn/authserver/login', cas.replace('method="post"', 'method="get"'));
  await env.tick(31000);
  assert.equal(env.doc.querySelector('#password').value, '');
});

for (const [url, host, path] of [
  ['https://www.cnki.net/', 'fsso.cnki.net', '/'],
  ['https://pubs.acs.org/doi/fixture', 'pubs.acs.org', '/institutional-login'],
  ['https://www.scopus.com/pages/home', 'www.scopus.com', '/pages/checkAccess'],
  ['https://www.engineeringvillage.com/home.url', 'www.engineeringvillage.com', '/rest/oauth2/authorization/els-client-login'],
  ['https://www.scival.com/landing', 'www.scival.com', '/idp/start'],
  ['https://www.oadds.cn/', 'shibboleth.guodao.cn', '/Shibboleth.sso/Login']
]) test(`one click opens the provider entry without reading credentials: ${host}`, t => {
  const env = setup(t, url);
  env.w.HITLoginAuto2.institutionLogin();
  const target = new URL(env.navigations[0]);
  assert.equal(target.hostname, host);
  assert.equal(target.pathname, path);
  assert.equal(env.reads.includes('password'), false);
});
