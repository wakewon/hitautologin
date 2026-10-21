// popup.js — i18n + 即改即生效 (Firefox compatible)
const $ = (id) => document.getElementById(id);

// storage helpers
const get = async (key, defVal) => { const values = await browser.storage.local.get(key); return values[key] === undefined ? defVal : values[key]; };
const set = (key, val) => browser.storage.local.set({ [key]: val });
function debounce(fn, ms = 500) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

const I18N = {
  zh: {
    title: "HIT 自动登录",
    help: "使用教程",
    lang: " ",
    username: "用户名",
    user_ph: "学号/用户名",
    password: "密码",
    pass_ph: "密码",
    auto: "开启自动登录",
    fab: "显示悬浮按钮",
    saved_user: "用户名已自动保存",
    saved_pass: "密码已自动保存",
    enabled_auto: "已开启自动登录",
    disabled_auto: "已关闭自动登录",
    show_fab: "已显示悬浮按钮",
    hide_fab: "已隐藏悬浮按钮",
    cant_inject: "当前页面无法注入脚本，切换将于刷新后生效",
    hint: "仅在已确认的统一认证/WLAN 页面填写；学术网站可一键选校。",
    institution_auto: "学术网站自动选校",
    institution_login: "哈工大机构登录",
    institution_on: "自动选校已开启",
    institution_off: "自动选校已关闭；仍可点击按钮执行一次",
    institution_started: "已启动机构登录，请查看网页",
    institution_unsupported: "当前页面未适配或尚未加载；请刷新学术网站后重试",
    failures: "查看选校失败记录",
    clear_failures: "清空失败记录",
    no_failures: "暂无失败记录",
    idp_auth: "自动同意校外授权",
    enabled_idp: "已开启自动授权",
    disabled_idp: "已关闭自动授权",
    webvpn_reload: "通过 WebVPN 访问",
    invalid_url: "无效的 URL"
  },
  en: {
    title: "HIT Auto Login",
    help: "Help",
    lang: " ",
    username: "Username",
    user_ph: "Username/ID",
    password: "Password",
    pass_ph: "Password",
    auto: "Enable Auto Login",
    fab: "Show Floating Button",
    saved_user: "Username saved automatically",
    saved_pass: "Password saved automatically",
    enabled_auto: "Auto login enabled",
    disabled_auto: "Auto login disabled",
    show_fab: "Floating button shown",
    hide_fab: "Floating button hidden",
    cant_inject: "This page blocks injection. Change takes effect after refresh.",
    hint: "Credentials are used only on verified HIT sign-in forms. Select HIT on academic sites with one click.",
    institution_auto: "Auto-select HIT institution",
    institution_login: "Sign in through HIT",
    institution_on: "Institution selection enabled",
    institution_off: "Auto-selection off; one-click sign-in remains available",
    institution_started: "Institutional sign-in started. Check the page.",
    institution_unsupported: "Page unsupported or not loaded. Reload the academic site and retry.",
    failures: "Show institution failure records",
    clear_failures: "Clear failure records",
    no_failures: "No failure records",
    idp_auth: "Auto Authorize Off-campus",
    enabled_idp: "Auto auth enabled",
    disabled_idp: "Auto auth disabled",
    webvpn_reload: "Access via WebVPN",
    invalid_url: "Invalid URL"
  }
};
let LANG = 'zh';
const tr = (k) => (I18N[LANG] || I18N.zh)[k] || k;

function applyI18n() {
  $('ttl').textContent = tr('title');
  $('langLabel').textContent = tr('lang');
  $('help').title = tr('help');
  $('labUser').textContent = tr('username');
  $('username').placeholder = tr('user_ph');
  $('labPass').textContent = tr('password');
  $('password').placeholder = tr('pass_ph');
  $('kvAuto').textContent = tr('auto');
  $('kvFab').textContent = tr('fab');
  $('kvIdp').textContent = tr('idp_auth');
  $('btnWebVpn').textContent = tr('webvpn_reload');
  $('kvInstitution').textContent = tr('institution_auto');
  $('btnInstitutionLogin').textContent = tr('institution_login');
  $('btnFailures').textContent = tr('failures');
  $('btnClearFailures').textContent = tr('clear_failures');
  $('hint').textContent = tr('hint');
}

const showMsg = (txt) => {
  $('hint').textContent = txt;
  setTimeout(() => { $('hint').textContent = tr('hint'); }, 1500);
};

async function sendToActiveOrInject(msg) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return false;
  try {
    const response = await browser.tabs.sendMessage(tab.id, msg);
    return response?.ok === true;
  } catch {
    // Firefox MV2: content script 已经自动注入，这里不需要手动 inject
    // 如果失败，说明页面可能不支持或还未加载完成
    return false;
  }
}

async function init() {
  LANG = await get('lang', 'zh');
  $('lang').value = LANG;

  $('username').value = await get('username', '');
  $('password').value = await get('password', '');
  $('autologin').checked = !!(await get('autoLogin', false));
  $('fab').checked = !!(await get('fabEnabled', true));
  $('idpAuth').checked = !!(await get('idpAutoAuth', true));
  $('institutionAutoSelect').checked = !!(await get('institutionAutoSelect', true));

  applyI18n();
}
init();

// 语言切换
$('lang').addEventListener('change', async (e) => {
  LANG = e.target.value;
  await set('lang', LANG);
  applyI18n();
});

// 自动保存用户名/密码
const saveUser = debounce(async () => {
  await set('username', $('username').value.trim());
  showMsg(tr('saved_user'));
});
const savePass = debounce(async () => {
  await set('password', $('password').value);
  showMsg(tr('saved_pass'));
});
$('username').addEventListener('input', saveUser);
$('username').addEventListener('blur', saveUser);
$('password').addEventListener('input', savePass);
$('password').addEventListener('blur', savePass);

// 开关：立即写入 + 尝试通知当前页（FAB 显/隐需要实时更新）
$('autologin').addEventListener('change', async (e) => {
  await set('autoLogin', e.target.checked);
  showMsg(e.target.checked ? tr('enabled_auto') : tr('disabled_auto'));
});

$('fab').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await set('fabEnabled', enabled);
  const ok = await sendToActiveOrInject({ type: 'HIT_SET_FAB', enabled });
  showMsg(ok
    ? (enabled ? tr('show_fab') : tr('hide_fab'))
    : tr('cant_inject'));
});

$('idpAuth').addEventListener('change', async (e) => {
  await set('idpAutoAuth', e.target.checked);
  showMsg(e.target.checked ? tr('enabled_idp') : tr('disabled_idp'));
});

// 右上角"？" → 打开内置教程
document.getElementById('help').addEventListener('click', async (e) => {
  e.preventDefault();
  const url = browser.runtime.getURL('help.html');
  await browser.tabs.create({ url });
});

// WebVPN Reload Logic
function getWebVpnUrl(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return null;

    const host = urlObj.hostname;
    const modifiedHost = host.replace(/\./g, '-');
    const finalHost = `${modifiedHost}-s.ivpn.hit.edu.cn:1080`;

    return url.replace(host, finalHost).replace('https://', 'http://');
  } catch (e) {
    return null;
  }
}

$('btnWebVpn').addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const newUrl = getWebVpnUrl(tab.url);
  if (newUrl) {
    browser.tabs.update(tab.id, { url: newUrl });
  } else {
    showMsg(tr('invalid_url') || "Invalid URL");
  }
});

$('institutionAutoSelect').addEventListener('change', async e => {
  await set('institutionAutoSelect', e.target.checked);
  showMsg(tr(e.target.checked ? 'institution_on' : 'institution_off'));
});
$('btnInstitutionLogin').addEventListener('click', async () => {
  const ok = await sendToActiveOrInject({ type: 'HIT_INSTITUTION_LOGIN' });
  showMsg(tr(ok ? 'institution_started' : 'institution_unsupported'));
});
async function renderFailures() {
  const failures = await get('institutionFailures', []);
  $('failureList').textContent = failures.length
    ? failures.map(item => `${new Date(item.time).toLocaleString()} ${item.host}: ${item.reason}`).join('\n')
    : tr('no_failures');
}
$('btnFailures').addEventListener('click', async () => {
  $('failureList').hidden = !$('failureList').hidden;
  $('btnClearFailures').hidden = $('failureList').hidden;
  if (!$('failureList').hidden) await renderFailures();
});
$('btnClearFailures').addEventListener('click', async () => {
  await set('institutionFailures', []);
  await renderFailures();
});
