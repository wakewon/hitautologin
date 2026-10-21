// content.js — i18n（中文/English）、FAB 与遮罩文本随语言切换
(() => {
  'use strict';

  // ========== 跳过自动登录的站点 ==========
  // 这些站点会导致自动登录兼容性问题，只显示FAB但不执行自动登录
  const SKIP_AUTOLOGIN_HOSTNAMES = [
    'mail.hit.edu.cn'  // Issue #4: HIT MAIL 登录页面兼容性问题
  ];

  const skipAutoLogin = SKIP_AUTOLOGIN_HOSTNAMES.includes(location.hostname);

  // ========== 简易存储 ==========
  const store = {
    async get(key, defVal) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], (o) => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(o[key] !== undefined ? o[key] : defVal));
      });
    },
    async set(key, val) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: val }, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve());
      });
    }
  };

  // 只缓存行为设置与选校状态；学术网站启动时不读取用户名或密码。
  const institutionSettings = Object.create(null);
  const settingKeys = ['lang', 'fabEnabled', 'autoLogin', 'idpAutoAuth',
    'institutionAutoSelect', 'institutionLoginPending', 'institutionFailures'];
  let institutionWrites = Promise.resolve();
  const settingsReady = new Promise((resolve, reject) => {
    chrome.storage.local.get(settingKeys, values => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      Object.assign(institutionSettings, values);
      resolve();
    });
  });
  function getInstitutionValue(key, fallback) {
    return institutionSettings[key] === undefined ? fallback : institutionSettings[key];
  }
  function setInstitutionValue(key, value) {
    institutionSettings[key] = value;
    const write = store.set(key, value);
    institutionWrites = Promise.all([institutionWrites, write]).then(() => undefined);
    institutionWrites.catch(() => {}); // 跳转时统一报告写入错误。
    return write;
  }

  // 语言包
  const T = {
    zh: {
      site_hit: "当前站点：HIT",
      site_non: "当前站点：非HIT",
      common_intranet: "访问HIT内网",
      common_extranet: "访问HIT外网",
      common_wlan: "访问HIT-WLAN",
      fab_title_links: "常用入口",
      fab_title_login: "登录助手",
      fab_set_user: "设置用户名",
      fab_set_pass: "设置密码",
      fab_toggle_auto: "切换自动登录",
      fab_toggle_idp: "切换校外授权",
      fab_trigger_once: "手动接管登录",
      kv_username: "用户名",
      kv_password: "密码",
      kv_autologin: "自动登录",
      kv_idp_auth: "校外授权",
      val_on: "已开启",
      val_off: "未开启",
      val_unset: "未设置",
      overlay_title: "接管中",
      overlay_msg: "接管中…正在自动填写/登录",
      overlay_go_portal: "登录校园网",
      err_fail: "登录失败: ",
      err_autoclosed: "。自动登录已关闭。",
      err_captcha: "检测到验证码弹窗，自动登录已关闭。",
      fab_title_tools: "常用工具",
      tool_webvpn: "通过 WebVPN 访问",
      institution_login: "哈工大登录",
      institution_login_hint: "进入机构登录并选择哈尔滨工业大学",
      institution_storage_error: "无法保存选校状态，请刷新后重试"
    },
    en: {
      site_hit: "Current site: HIT",
      site_non: "Current site: Non-HIT",
      common_intranet: "Open HIT Internal",
      common_extranet: "Open HIT External",
      common_wlan: "Open HIT-WLAN",
      fab_title_links: "Quick Links",
      fab_title_login: "Login Assistant",
      fab_set_user: "Set Username",
      fab_set_pass: "Set Password",
      fab_toggle_auto: "Auto Login",
      fab_toggle_idp: "Toggle IDP Auth",
      fab_trigger_once: "Trigger Login Once",
      kv_username: "Username",
      kv_password: "Password",
      kv_autologin: "Auto Login",
      kv_idp_auth: "IDP Auth",
      val_on: "On",
      val_off: "Off",
      val_unset: "Not set",
      overlay_title: "Taking Over",
      overlay_msg: "Taking over… filling & logging in",
      overlay_go_portal: "Go to HIT-WLAN Login",
      err_fail: "Login failed: ",
      err_autoclosed: ". Auto-login is turned off.",
      err_captcha: "Captcha dialog detected. Auto-login is turned off.",
      fab_title_tools: "Common Tools",
      tool_webvpn: "Access via WebVPN",
      institution_login: "Sign in via HIT",
      institution_login_hint: "Open institutional sign-in and select Harbin Institute of Technology",
      institution_storage_error: "Could not save settings. Please reload and retry."
    }
  };
  let LANG = 'zh';
  const t = (k) => (T[LANG] || T.zh)[k] || k;

  // —— 悬浮入口开关（默认开启）——
  const FAB_KEY = 'fabEnabled';

  // ---- 目标链接 ----
  const URL_INTRANET = 'http://i.hit.edu.cn/';
  const URL_EXTRANET = 'http://ivpn.hit.edu.cn/';
  const URL_WLAN = 'https://webportal.hit.edu.cn/';

  // ---- HIT 站点判定 ----
  const isHitSite =
    /\.hit\.edu\.cn$/i.test(location.hostname) ||
    /(^|\.)ivpn\.hit\.edu\.cn$/i.test(location.hostname);

  // ====== 可配置 ID 列表（兼容历史）======
  let username_ids = ["username", "user", "loginUser", "IDToken1"];
  let password_ids = ["password", "passwd", "loginPwd", "IDToken2"];
  let rememberMe_ids = ["rememberMe", "remember", "stayLogged"];
  let login_submit_ids = ["login_submit", "login", "submitButton", "btn-login", "submit"];
  let errorTip_ids = ["showErrorTip"];
  let captcha_ids = ["captcha-id", "captcha-box"];

  function setCustomIds(options) {
    if (options.username_ids) username_ids = options.username_ids;
    if (options.password_ids) password_ids = options.password_ids;
    if (options.rememberMe_ids) rememberMe_ids = options.rememberMe_ids;
    if (options.login_submit_ids) login_submit_ids = options.login_submit_ids;
    if (options.errorTip_ids) errorTip_ids = options.errorTip_ids;
    if (options.captcha_ids) captcha_ids = options.captcha_ids;
  }

  // ====== 工具函数 ======
  function byIds(ids, root = document) {
    for (let i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el && root.contains(el)) return el;
    }
    return null;
  }
  function q(sel) { return document.querySelector(sel); }

  function isVisible(el) {
    if (!el?.isConnected || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  }

  // 地址是必要条件；HIT 子站自己的表单（包括 WebVPN 中的表单）不能读取校园密码。
  function loginRoute() {
    if (location.protocol !== 'https:' || skipAutoLogin) return null;
    if (location.hostname === 'ids.hit.edu.cn' && /^\/authserver\/login\/?$/.test(location.pathname)) return 'cas';
    if (location.hostname === 'webportal.hit.edu.cn' && /^\/(?:srun_portal_(?:pc|phone)\/?|index\.html)?$/.test(location.pathname)) return 'wlan';
    return null;
  }

  function loginContext() {
    const route = loginRoute();
    let root;
    if (route === 'cas') {
      root = q('form#pwdFromId, form#casLoginForm');
      if (!root || root.method.toLowerCase() !== 'post') return null;
      const action = new URL(root.action, location.href);
      if (action.origin !== location.origin || !/^\/authserver\/login\/?$/.test(action.pathname)) return null;
      if (!root.querySelector('input[name="execution"]') || !root.querySelector('input[name="_eventId"]')) return null;
    } else if (route === 'wlan') {
      root = q('.panel-login');
      if (!root || !q('input#ac_id[type="hidden"]')) return null;
    } else return null;

    const username = byIds(username_ids, root);
    const password = byIds(password_ids, root);
    const button = byIds(login_submit_ids, root);
    if (!username?.matches('input[type="text"], input[type="email"]') || !password?.matches('input[type="password"]')) return null;
    if (![username, password, button].every(isVisible) || username.disabled || password.disabled || username.readOnly || password.readOnly) return null;
    if (route === 'cas' && (username.form !== root || password.form !== root)) return null;
    return { root, username, password, button, remember: byIds(rememberMe_ids, root) };
  }

  function setInputValue(el, value) {
    if (!el) return;
    try {
      const setter =
        Object.getOwnPropertyDescriptor(el.__proto__, 'value')?.set ||
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
    } catch (_) { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ====== “接管中”浮层 ======
  let interrupted = false;
  let pollTimer = null;

  function getOverlayCss() {
    return `
      #hit-overlay { position: fixed; inset:0; z-index:2147483647;
        background: rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; backdrop-filter: blur(2px);}
      #hit-overlay-box{ position: relative; min-width:300px; max-width:90vw; background:#fff; color:#111; border-radius:16px;
        padding:20px 24px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,.25);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "PingFang SC","Microsoft YaHei",sans-serif;}
      #hit-overlay-close { position:absolute; top:8px; right:10px; width:28px; height:28px; line-height:28px; border:none;
        border-radius:50%; background:#f1f3f5; color:#444; cursor:pointer; font-size:18px; font-weight:700;}
      #hit-overlay-close:hover { background:#e9ecef; }
      #hit-overlay-title{ font-size:18px; font-weight:700; }
      #hit-overlay-spinner{ margin:12px auto 8px; width:22px; height:22px; border-radius:50%;
        border:3px solid #e5e7eb; border-top-color:#6366f1; animation: hitspin 1s linear infinite;}
      #hit-overlay-actions{ margin-top:12px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;}
      .hit-btn{ border:none; padding:8px 14px; border-radius:999px; cursor:pointer; font-size:14px; box-shadow: 0 2px 6px rgba(0,0,0,.08);}
      .hit-btn-primary{ background:#eef2ff; }
      .hit-btn-primary:hover{ background:#e0e7ff; }
      @keyframes hitspin { to { transform: rotate(360deg); } }
    `;
  }

  function showOverlay(msg = t('overlay_msg')) {
    if (document.getElementById('hit-overlay-host')) return;
    interrupted = false;

    const host = document.createElement('div');
    host.id = 'hit-overlay-host';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getOverlayCss();
    shadow.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'hit-overlay';
    wrap.innerHTML = `
      <div id="hit-overlay-box" role="dialog" aria-modal="true">
        <button id="hit-overlay-close" aria-label="中断并关闭">×</button>
        <div id="hit-overlay-title"></div>
        <div id="hit-overlay-spinner"></div>
        <div id="hit-overlay-msg"></div>
        <div id="hit-overlay-actions">
          <button class="hit-btn hit-btn-primary" id="hit-go-portal"></button>
        </div>
      </div>`;
    shadow.appendChild(wrap);
    shadow.getElementById('hit-overlay-title').textContent = t('overlay_title');
    shadow.getElementById('hit-overlay-msg').textContent = msg;
    shadow.getElementById('hit-go-portal').textContent = t('overlay_go_portal');
    document.body.appendChild(host);

    // 点击“×”关闭
    shadow.getElementById('hit-overlay-close')?.addEventListener('click', () => {
      interrupted = true; hideOverlay();
    });
    // 点击半透明背景关闭（等效中断）
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) { interrupted = true; hideOverlay(); }
    });
    // 直接跳转 WLAN
    shadow.getElementById('hit-go-portal')?.addEventListener('click', () => { location.href = URL_WLAN; });
  }

  function hideOverlay() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    document.getElementById('hit-overlay-host')?.remove();
  }

  function renderOverlayTexts() {
    const root = document.getElementById('hit-overlay-host')?.shadowRoot;
    if (!root) return;
    root.getElementById('hit-overlay-title').textContent = t('overlay_title');
    root.getElementById('hit-go-portal').textContent = t('overlay_go_portal');
  }

  // ====== 悬浮入口（全站显示）======
  // ====== 悬浮入口（全站显示）======
  let fabDocHandler = null;
  let fabShadowRoot = null;

  function getFabCss() {
    return `
      :host { position: fixed; right:14px; bottom:16px; z-index:2147483646;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "PingFang SC","Microsoft YaHei",sans-serif; }
      #hit-fab-toggle{ width:48px; height:48px; border-radius:50%; border:none; cursor:pointer; background:#005375; color:#fff;
        font-weight:700; font-size:14px; box-shadow:0 8px 20px rgba(0,0,0,.25); transition: transform 0.2s; }
      #hit-fab-toggle:hover { transform: scale(1.05); }
      #hit-institution-login{ position:absolute; right:60px; bottom:0; min-width:132px; min-height:44px;
        padding:10px 16px; border:0; border-radius:24px; background:#005375; color:white; cursor:pointer;
        font:600 14px system-ui; box-shadow:0 6px 20px rgba(0,0,0,.2); white-space:nowrap; }
      #hit-institution-login:hover{ background:#006c93; }
      #hit-institution-status{ position:absolute; right:0; bottom:54px; width:260px; padding:8px 12px;
        border-radius:10px; background:#fff; color:#333; font-size:12px; box-shadow:0 3px 12px rgba(0,0,0,.15); }
      #hit-institution-status:empty{ display:none; }
      #hit-fab-panel{ position:absolute; right:0; bottom:60px; min-width:260px; max-width:86vw; background:#fff; color:#111;
        border-radius:14px; padding:12px; box-shadow:0 16px 40px rgba(0,0,0,.25); display:none;
        transform-origin: bottom right; animation: hit-pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
      #hit-fab-panel.open{ display:block; }
      @keyframes hit-pop-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      .hit-fab-title{ font-size:14px; font-weight:700; margin:2px 0 8px; }
      .hit-fab-row{ display:flex; gap:8px; flex-wrap:wrap; }
      .hit-fab-btn{ border:none; border-radius:999px; padding:8px 12px; background:#eef2ff; cursor:pointer; font-size:13px; color: #111; transition: background 0.2s; }
      .hit-fab-btn:hover{ background:#e0e7ff; }
      .hit-fab-sec{ margin-top:10px; padding-top:8px; border-top:1px dashed #e5e7eb; }
      .hit-fab-meta{ font-size:12px; color:#6b7280; }
      .hit-fab-kv{ display:flex; justify-content:space-between; gap:8px; font-size:12px; padding:4px 0; }

      @media (prefers-color-scheme: dark) {
        #hit-fab-panel { background: #1f2937; color: #f3f4f6; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
        #hit-institution-status { background: #1f2937; color: #f3f4f6; }
        .hit-fab-btn { background: #374151; color: #e5e7eb; }
        .hit-fab-btn:hover { background: #4b5563; }
        .hit-fab-sec { border-top-color: #4b5563; }
        .hit-fab-meta { color: #9ca3af; }
      }
    `;
  }

  const mask = (str) => (!str ? t('val_unset') : '•'.repeat(Math.min(8, Math.max(6, Math.floor(str.length * 0.8)))));

  function renderFabStaticTexts() {
    // 标题与按钮文案
    if (!fabShadowRoot) return;
    const p = fabShadowRoot.getElementById('hit-fab-panel');
    if (!p) return;
    const titleEls = p.querySelectorAll('.hit-fab-title');
    if (titleEls[0]) titleEls[0].textContent = t('fab_title_links');
    if (titleEls[1]) titleEls[1].textContent = t('fab_title_tools');
    if (titleEls[2]) titleEls[2].textContent = t('fab_title_login');

    const btns = p.querySelectorAll('[data-goto]');
    btns.forEach((btn) => {
      const g = btn.getAttribute('data-goto');
      if (g === 'intranet') btn.textContent = t('common_intranet');
      if (g === 'extranet') btn.textContent = t('common_extranet');
      if (g === 'wlan') btn.textContent = t('common_wlan');
    });

    const btnSetU = fabShadowRoot.getElementById('hit-fab-set-username');
    const btnSetP = fabShadowRoot.getElementById('hit-fab-set-password');
    const btnTgl = fabShadowRoot.getElementById('hit-fab-toggle-autologin');
    const btnTglIdp = fabShadowRoot.getElementById('hit-fab-toggle-idp');
    const btnTrig = fabShadowRoot.getElementById('hit-fab-trigger-login');
    if (btnSetU) btnSetU.textContent = t('fab_set_user');
    if (btnSetP) btnSetP.textContent = t('fab_set_pass');
    if (btnTgl) btnTgl.textContent = t('fab_toggle_auto');
    if (btnTglIdp) btnTglIdp.textContent = t('fab_toggle_idp');
    if (btnTrig) btnTrig.textContent = t('fab_trigger_once');

    const btnWebVpn = fabShadowRoot.getElementById('hit-fab-tool-webvpn');
    if (btnWebVpn) btnWebVpn.textContent = t('tool_webvpn');

    const institutionButton = fabShadowRoot.getElementById('hit-institution-login');
    if (institutionButton) {
      institutionButton.textContent = t('institution_login');
      institutionButton.title = t('institution_login_hint');
    }
    const siteMeta = fabShadowRoot.getElementById('hit-fab-site-meta');
    if (siteMeta) siteMeta.textContent = isHitSite ? t('site_hit') : t('site_non');
  }

  // —— 提升为外层函数，便于 storage 变化时重渲染 ——
  async function renderFabKV() {
    if (!isHitSite || !fabShadowRoot) return;
    const kvBox = fabShadowRoot.getElementById('hit-fab-kv-box');
    if (!kvBox) return;
    const savedUsername = await store.get("username", "");
    const savedPassword = await store.get("password", "");
    const autoLogin = !!(await store.get("autoLogin", false));
    const idpAuth = !!(await store.get("idpAutoAuth", true));
    kvBox.replaceChildren();
    for (const [key, value] of [
      ['kv_username', savedUsername || t('val_unset')],
      ['kv_password', savedPassword ? mask(savedPassword) : t('val_unset')],
      ['kv_autologin', t(autoLogin ? 'val_on' : 'val_off')],
      ['kv_idp_auth', t(idpAuth ? 'val_on' : 'val_off')]
    ]) {
      const row = document.createElement('div');
      row.className = 'hit-fab-kv';
      const label = document.createElement('span');
      label.textContent = t(key);
      const content = document.createElement('span');
      content.textContent = value;
      row.append(label, content);
      kvBox.appendChild(row);
    }
  }

  async function createFab() {
    if (document.getElementById('hit-fab-host')) return;

    const host = document.createElement('div');
    host.id = 'hit-fab-host';
    const shadow = host.attachShadow({ mode: 'open' });
    fabShadowRoot = shadow;

    const style = document.createElement('style');
    style.textContent = getFabCss();
    shadow.appendChild(style);

    const academicAdapter = institutionAdapter();
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="hit-institution-login"></button>
      <div id="hit-institution-status" role="status" aria-live="polite"></div>
      <button id="hit-fab-toggle" title="HIT">HIT</button>
      <div id="hit-fab-panel" role="dialog" aria-label="HIT">
        <div class="hit-fab-title"></div>
        <div class="hit-fab-row">
          <button class="hit-fab-btn" data-goto="intranet"></button>
          <button class="hit-fab-btn" data-goto="extranet"></button>
          <button class="hit-fab-btn" data-goto="wlan"></button>
        </div>
        <div class="hit-fab-sec">
          <div class="hit-fab-title"></div>
          <div class="hit-fab-row"><button class="hit-fab-btn" id="hit-fab-tool-webvpn"></button></div>
        </div>
        <div class="hit-fab-sec" id="hit-fab-login-section">
          <div class="hit-fab-title"></div>
          <div id="hit-fab-kv-box" class="hit-fab-meta"></div>
          <div class="hit-fab-row" style="margin-top:6px;">
            <button class="hit-fab-btn" id="hit-fab-set-username"></button>
            <button class="hit-fab-btn" id="hit-fab-set-password"></button>
            <button class="hit-fab-btn" id="hit-fab-toggle-autologin"></button>
            <button class="hit-fab-btn" id="hit-fab-toggle-idp"></button>
            <button class="hit-fab-btn" id="hit-fab-trigger-login"></button>
          </div>
        </div>
        <div class="hit-fab-sec">
          <div class="hit-fab-kv"><span class="hit-fab-meta" id="hit-fab-site-meta"></span><span></span></div>
        </div>
      </div>`;
    if (!academicAdapter) {
      container.querySelector('#hit-institution-login').remove();
      container.querySelector('#hit-institution-status').remove();
    }
    if (!isHitSite) container.querySelector('#hit-fab-login-section').remove();
    if (!loginRoute()) container.querySelector('#hit-fab-trigger-login')?.remove();
    while (container.firstChild) shadow.appendChild(container.firstChild);
    document.body.appendChild(host);

    const panel = shadow.getElementById('hit-fab-panel');
    const toggle = shadow.getElementById('hit-fab-toggle');

    if (!toggle) return;
    shadow.getElementById('hit-institution-login')?.addEventListener('click', () => {
      startInstitutionLogin().catch(() => institutionStatus(t('institution_storage_error')));
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    fabDocHandler = (e) => {
      // 使用 composedPath 来正确判断事件是否来自我们的组件（包括 Shadow DOM）
      const path = e.composedPath();
      const clickedInsideHost = path.includes(host);

      if (!clickedInsideHost && panel.classList.contains('open')) {
        panel.classList.remove('open');
      }
    };
    document.addEventListener('click', fabDocHandler, true);

    panel.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tgo = btn.getAttribute('data-goto');
        if (tgo === 'intranet') window.open(URL_INTRANET, '_self');
        else if (tgo === 'extranet') window.open(URL_EXTRANET, '_self');
        else if (tgo === 'wlan') window.open(URL_WLAN, '_self');
      });
    });

    renderFabStaticTexts();

    if (isHitSite) {
      await renderFabKV();

      shadow.getElementById('hit-fab-set-username').addEventListener('click', async () => {
        const cur = await store.get("username", "");
        const v = prompt(LANG === 'zh' ? "请输入用户名:" : "Enter username:", cur || "");
        if (v !== null) { await store.set("username", v); await renderFabKV(); alert(LANG === 'zh' ? "用户名已保存" : "Username saved"); }
      });
      shadow.getElementById('hit-fab-set-password').addEventListener('click', async () => {
        const cur = await store.get("password", "");
        const v = prompt(LANG === 'zh' ? "请输入密码:" : "Enter password:", cur || "");
        if (v !== null) { await store.set("password", v); await renderFabKV(); alert(LANG === 'zh' ? "密码已保存" : "Password saved"); }
      });
      shadow.getElementById('hit-fab-toggle-autologin').addEventListener('click', async () => {
        const cur = !!(await store.get("autoLogin", false));
        await store.set("autoLogin", !cur);
        await renderFabKV();
        alert(!cur ? (LANG === 'zh' ? "自动登录已开启" : "Auto-login enabled")
          : (LANG === 'zh' ? "自动登录已关闭" : "Auto-login disabled"));
      });
      shadow.getElementById('hit-fab-toggle-idp').addEventListener('click', async () => {
        const cur = !!(await store.get("idpAutoAuth", true));
        await store.set("idpAutoAuth", !cur);
        await renderFabKV();
        alert(!cur ? (LANG === 'zh' ? "校外授权自动同意已开启" : "IDP Auto-Auth enabled")
          : (LANG === 'zh' ? "校外授权自动同意已关闭" : "IDP Auto-Auth disabled"));
      });
      shadow.getElementById('hit-fab-trigger-login')?.addEventListener('click', () => {
        triggerAutoLoginOnce();
      });
    }

    shadow.getElementById('hit-fab-tool-webvpn').addEventListener('click', () => {
      const url = location.href;
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return;

        const host = urlObj.hostname;
        const modifiedHost = host.replace(/\./g, '-');
        const finalHost = `${modifiedHost}-s.ivpn.hit.edu.cn:1080`;

        const newUrl = url.replace(host, finalHost).replace('https://', 'http://');
        window.open(newUrl, '_self');
      } catch (e) {
        console.error(e);
      }
    });

    // FAB 创建完成后，主动抬高页面上的 Float Button 组（因为 FAB 按钮会占据右下角空间）
    adjustPageFloatBtns(true);

    // 启动持续监控，检测动态加载的 Float Button
    observeNewFloatBtns();
  }

  function destroyFab() {
    if (fabDocHandler) {
      document.removeEventListener('click', fabDocHandler, true);
      fabDocHandler = null;
    }
    // 恢复页面上的 Ant Design Float Button 组
    adjustPageFloatBtns(false);
    document.getElementById('hit-fab-host')?.remove();
    fabShadowRoot = null;
  }

  // ====== 调整页面上的 Ant Design Float Button 组位置 ======
  const FLOAT_BTN_OFFSET = 60; // 抬高的像素值

  function adjustPageFloatBtns(fabVisible) {
    const selectors = [
      '.ant-float-btn-group',
      '.ant-float-btn:not(.ant-float-btn-group .ant-float-btn)'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));

    elements.forEach((el) => {
      const style = getComputedStyle(el);
      if (style.position !== 'fixed') return;

      const currentBottom = parseInt(style.bottom) || 0;
      const currentRight = parseInt(style.right) || 0;

      if (currentRight > 100 || (currentBottom > 200 && !el.dataset.hitOriginalBottom)) return;

      if (fabVisible) {
        if (!el.dataset.hitOriginalBottom) {
          el.dataset.hitOriginalBottom = currentBottom;
        }
        const newBottom = parseInt(el.dataset.hitOriginalBottom) + FLOAT_BTN_OFFSET;
        el.style.bottom = newBottom + 'px';
        el.style.transition = 'bottom 0.2s ease';
      } else {
        if (el.dataset.hitOriginalBottom) {
          el.style.bottom = el.dataset.hitOriginalBottom + 'px';
          delete el.dataset.hitOriginalBottom;
        }
      }
    });
  }

  // 持续监控页面上新添加的 float button，确保它们也被抬高
  let floatBtnObserver = null;
  function observeNewFloatBtns() {
    if (floatBtnObserver) return; // 已经在监控了

    floatBtnObserver = new MutationObserver((mutations) => {
      // 检查是否有新的 float button 添加
      let hasNewFloatBtn = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches?.('.ant-float-btn, .ant-float-btn-group') ||
                node.querySelector?.('.ant-float-btn, .ant-float-btn-group')) {
                hasNewFloatBtn = true;
                break;
              }
            }
          }
        }
        if (hasNewFloatBtn) break;
      }

      if (hasNewFloatBtn) {
        const fabHost = document.getElementById('hit-fab-host');
        if (fabHost) {
          adjustPageFloatBtns(true);
        }
      }
    });

    floatBtnObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }



  // ====== 学术网站：机构选择与一键入口（外站绝不读取校园账号密码） ======
  const HIT_IDP = 'https://idp.hit.edu.cn/idp/shibboleth';
  const INSTITUTION_KEY = 'institutionAutoSelect';
  const INSTITUTION_PENDING_KEY = 'institutionLoginPending';
  const INSTITUTION_LOG_KEY = 'institutionFailures';
  const atyponHosts = ['dl.acm.org', 'arc.aiaa.org', 'ascelibrary.org', 'epubs.siam.org',
    'www.pnas.org', 'www.annualreviews.org', 'www.tandfonline.com', 'www.icevirtuallibrary.com'];
  const silverchairHosts = ['pubs.acs.org', 'asmedigitalcollection.asme.org', 'pubs.aip.org', 'academic.oup.com', 'iwaponline.com'];
  const INSTITUTION_ADAPTERS = [
    { id: 'cnki', hosts: ['cnki.net', 'www.cnki.net', 'kns.cnki.net', 'gongjushu.cnki.net', 'fsso.cnki.net'],
      entry: () => 'https://fsso.cnki.net/', page: () => location.hostname === 'fsso.cnki.net',
      search: '#o', results: '#allschoollist a' },
    { id: 'wiley', hosts: ['onlinelibrary.wiley.com', 'agupubs.onlinelibrary.wiley.com', 'iam.atypon.com'],
      entry: () => `https://${location.hostname === 'iam.atypon.com' ? 'onlinelibrary.wiley.com' : location.hostname}/action/ssostart`,
      page: () => /^\/action\/ssostart\/?$/.test(location.pathname), search: '#searchInstitution',
      results: '#autoComplete_list_1 a, #autoComplete_list_1 [role="option"]', federation: '#federation' },
    { id: 'silverchair', hosts: silverchairHosts, entry: () => `https://${location.hostname}/institutional-login`,
      page: () => /^\/institutional-login\/?$/.test(location.pathname), search: '#institutionSearchInput',
      results: '.institution-search__result-item', federation: '#FederationDropdown',
      select: '#InstitutionDropdown', submit: '#shibbolethSelectBtn' },
    { id: 'atypon', hosts: atyponHosts, entry: () => `https://${location.hostname}/action/ssostart`,
      page: () => /^\/action\/ssostart\/?$/.test(location.pathname), search: '#searchInstitution',
      results: '#autoComplete_list_1 a, [role="option"]', federation: '#federation' },
    { id: 'springer', hosts: ['link.springer.com', 'www.nature.com', 'nature.com', 'materials.springer.com', 'wayf.springernature.com'],
      entry: () => 'https://wayf.springernature.com/?redirect_uri=' + encodeURIComponent(location.href),
      page: () => location.hostname === 'wayf.springernature.com', search: '#autocomplete-input',
      results: '[id^="eds-c-autocomplete-dropdown-option-"]', submit: '#institution-submit' },
    { id: 'elsevier', hosts: ['www.sciencedirect.com', 'sciencedirect.com', 'id.elsevier.com', 'auth.elsevier.com',
      'www.scopus.com', 'www.engineeringvillage.com', 'www.scival.com'],
      entry: () => {
        if (location.hostname === 'www.scopus.com') return 'https://www.scopus.com/pages/checkAccess?referralUrl=' + encodeURIComponent(location.href);
        if (location.hostname === 'www.engineeringvillage.com') return 'https://www.engineeringvillage.com/rest/oauth2/authorization/els-client-login';
        if (location.hostname === 'www.scival.com') return 'https://www.scival.com/idp/start';
        return 'https://www.sciencedirect.com/user/institution/login?targetURL=' + encodeURIComponent(location.pathname + location.search);
      },
      page: () => ['id.elsevier.com', 'auth.elsevier.com'].includes(location.hostname) &&
        (!!q('#wayfEmailForm, .els-institution-form, #bdd-institution-resultList') ||
          location.pathname.startsWith('/as/') && !!rememberedInstitutionAction()),
      search: '#wayfEmailForm #bdd-email',
      results: '#bdd-institution-resultList button, .els-institution-form button[name="action"][value="selectedShibInst"]' },
    { id: 'cambridge', hosts: ['www.cambridge.org', 'shibboleth.cambridge.org', 'shibboleth-discovery.cambridge.org'],
      entry: () => 'https://shibboleth.cambridge.org/CJOShibb2/index?app=' + encodeURIComponent('https://www.cambridge.org/core/shibboleth?ref=' + encodeURIComponent(location.pathname)),
      page: () => location.hostname === 'shibboleth-discovery.cambridge.org' && location.pathname.startsWith('/discovery/WAYF/'),
      search: '#institution', results: '[role="option"]', submitText: /^Continue to login$/i },
    { id: 'carsi', hosts: ['sage.cnpereading.com', 'ds.carsi.edu.cn'],
      entry: () => location.hostname === 'ds.carsi.edu.cn' ? location.href : 'https://sage.cnpereading.com/login?redirect=/action/showLogin',
      page: () => location.hostname === 'ds.carsi.edu.cn' ? /^\/login\/index(?:_en)?\.html$/.test(location.pathname) : location.pathname === '/login',
      entryButtonText: /^通过 CARSI 登录$/, query: '哈尔滨工业大学',
      search: '#idpForm #show', results: '#idpForm .typeahead [role="option"]', entity: '#idpForm #hid-inp', submit: '#idpSkipButton' },
    { id: 'ieee', hosts: ['ieeexplore.ieee.org'],
      entry: () => 'https://ieeexplore.ieee.org/servlet/wayf.jsp?entityId=' + encodeURIComponent(HIT_IDP) + '&url=' + encodeURIComponent(location.href),
      page: () => !!q('.inst-typeahead-input'), direct: true },
    // 以下入口基于图书馆资源详情页；验证受限情况见 docs/library-adapters.md。
    { id: 'emerald', hosts: ['www.emerald.com', 'www.emeraldinsight.com'],
      entry: () => 'https://www.emerald.com/start-session?idp=' + encodeURIComponent(HIT_IDP), page: () => false },
    { id: 'jove', hosts: ['www.jove.com'],
      entry: () => 'https://www.jove.com/Shibboleth.sso/Login?entityID=' + encodeURIComponent(HIT_IDP) + '&target=' + encodeURIComponent('https://www.jove.com/shibboleth/wayf_login.php?return_page=' + location.href), page: () => false },
    { id: 'dds', hosts: ['shibboleth.guodao.cn', 'www.guodao.cn', 'www.oadds.cn'],
      entry: () => 'https://shibboleth.guodao.cn/Shibboleth.sso/Login?entityID=' + encodeURIComponent(HIT_IDP), page: () => false }
  ];

  function institutionAdapter() {
    if (location.protocol !== 'https:') return null;
    return INSTITUTION_ADAPTERS.find(adapter => adapter.hosts.includes(location.hostname)) || null;
  }

  function isHitInstitutionName(value) {
    // 允许中英混排和重复标签；不接受缩写 HIT、附属医院或其他校区。
    const name = (value || '').normalize('NFKC').trim().toLowerCase();
    if (!name || /威海|深圳|weihai|shenzhen/.test(name)) return false;
    return name.replace(/哈尔滨工业大学|harbin\s+institute\s+of\s+technology|harbin\s+inst\s+of\s+technology/g, '')
      .replace(/[\s(),，（）·-]/g, '') === '';
  }

  function hasHitEntity(value) {
    if (value === HIT_IDP) return true;
    try {
      const url = new URL(value, location.href);
      return ['entityID', 'entityId', 'idp'].some(key => url.searchParams.get(key) === HIT_IDP);
    } catch (_) { return false; }
  }

  function isHitInstitution(el) {
    const label = el.textContent?.trim() || '';
    if (/威海|深圳|weihai|shenzhen/i.test(label)) return false;
    const entity = el.getAttribute('data-shibboleth-id') || el.getAttribute('data-entityid') || el.getAttribute('href') || el.value;
    // 有明确实体 ID 时以实体为准，避免名称匹配却指向另一所学校。
    if (entity && (el.hasAttribute('data-shibboleth-id') || el.hasAttribute('data-entityid') || /^https?:/i.test(entity) || /[?&](?:entityID|entityId|idp)=/.test(entity))) return hasHitEntity(entity);
    return isHitInstitutionName(label);
  }

  function rememberedInstitutionAction(allowBareName = true) {
    const actions = [...document.querySelectorAll('button, a, [role="button"]')].filter(isVisible);
    // Elsevier 实际记忆页：优先使用带完整校名的 SeamlessAccess 登录按钮。
    const access = actions.find(el => ['id.elsevier.com', 'auth.elsevier.com'].includes(location.hostname) &&
      el.id === 'bdd-elsPrimaryBtn2' && el.name === 'action' && el.value === 'signInWithInst' && el.form?.name === 'elsForm');
    if (access) actions.unshift(access);
    const loginText = /^(?:sign\s*in|log\s*in|continue|access|登录|繼續|继续|登入)(?:\s*(?:via|through|with|to|your institution|your organization|↗|→))*$/i;
    for (const el of actions) {
      // 只接受操作本身明确指向本校的登录卡片，不按全页出现的学校名点击任意 Continue。
      const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
      if (/remove|forget|delete|change|manage|清除|忘记|移除|更改/i.test(text)) continue;
      const name = text.replace(/^(?:(?:sign\s*in|log\s*in|access)\s+(?:via|through|with|to|at)|continue\s+(?:with|to)|通过|使用)\s*/i, '')
        .replace(/\s*(?:登录|登入|访问|↗|→)$/, '');
      const hasEntity = ['data-shibboleth-id', 'data-entityid'].some(attr => el.hasAttribute(attr)) ||
        /[?&](?:entityID|entityId|idp)=/.test(el.getAttribute('href') || '');
      if ((!allowBareName || el.tagName === 'A') && !hasEntity && name === text) continue;
      if (hasEntity ? isHitInstitution(el) && (isHitInstitutionName(name) || loginText.test(text)) : isHitInstitutionName(name)) return el;
    }
    // 有些站点以隐藏实体 ID + 校名 + 独立 Continue 表单呈现记住的机构。
    for (const form of document.querySelectorAll('form')) {
      if (!isVisible(form) || form.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')) continue;
      const entities = [...form.querySelectorAll('input[type="hidden"]')]
        .filter(el => /^(?:entityID|idp|shibbolethId)$/i.test(el.name));
      if (!entities.length || !entities.every(el => hasHitEntity(el.value))) continue;
      const label = [...form.querySelectorAll('p, span, strong, label, h1, h2, h3, h4')]
        .some(el => isVisible(el) && isHitInstitutionName(el.textContent));
      const submit = [...form.querySelectorAll('button, input[type="submit"]')]
        .find(el => isVisible(el) && loginText.test((el.textContent || el.value).trim()));
      if (label && submit) return submit;
    }
    return null;
  }

  let institutionState = null;
  let institutionTimer = null;
  let institutionObserver = null;

  function institutionStatus(message) {
    const status = fabShadowRoot?.getElementById('hit-institution-status');
    if (status) status.textContent = message;
  }

  function recordInstitutionFailure(reason) {
    const failures = getInstitutionValue(INSTITUTION_LOG_KEY, []);
    const last = failures[failures.length - 1];
    if (last?.host === location.hostname && last?.reason === reason && Date.now() - last.time < 60000) return;
    // 不保存完整 URL、查询参数、页面内容或任何账号信息。
    setInstitutionValue(INSTITUTION_LOG_KEY, [...failures.slice(-29), { host: location.hostname, reason, time: Date.now() }]);
  }

  function newInstitutionState(requested = false) {
    const pending = getInstitutionValue(INSTITUTION_PENDING_KEY, null);
    return { href: location.href, started: 0, steps: 0, selected: false, selectionAttempted: false, stopped: false, actions: new WeakMap(), submitted: new Set(),
      requested: requested || (pending?.expires > Date.now() && pending.adapter === institutionAdapter()?.id) };
  }

  function institutionEnabled() {
    const pending = getInstitutionValue(INSTITUTION_PENDING_KEY, null);
    return getInstitutionValue(INSTITUTION_KEY, true) ||
      (pending?.expires > Date.now() && pending.adapter === institutionAdapter()?.id);
  }

  function actOnInstitution(el, action, fn, retry = false) {
    if (!isVisible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    let actions = institutionState.actions.get(el);
    if (!actions) { actions = new Map(); institutionState.actions.set(el, actions); }
    const previous = actions.get(action);
    // 框架可能晚于内容脚本绑定事件；仅对尚未生效的搜索/选择有限重试。
    if (previous && (!retry || previous.count >= 3 || Date.now() - previous.time < 3000)) return false;
    if (++institutionState.steps > 12) {
      institutionState.stopped = true;
      recordInstitutionFailure('操作次数达到上限，请手动完成机构登录');
      institutionStatus('已暂停，请手动完成或点击重试');
      return false;
    }
    actions.set(action, { count: (previous?.count || 0) + 1, time: Date.now() });
    fn();
    return true;
  }

  function institutionSubmit(adapter) {
    return adapter.submit ? [...document.querySelectorAll(adapter.submit)].find(isVisible) :
      [...document.querySelectorAll('button')].find(el => adapter.submitText?.test(el.textContent.trim()) && isVisible(el));
  }

  function institutionSubmitGuard(stage, reset = false) {
    // 内存去重在整页重载后会丢失；按平台/步骤计数，不受变化的 OAuth state/表单 action 影响。
    try {
      const key = 'hit-institution-submit:' + institutionAdapter().id + ':' + stage;
      if (reset) { sessionStorage.removeItem(key); return true; }
      const previous = JSON.parse(sessionStorage.getItem(key) || 'null');
      const count = previous && Date.now() - previous.time < 300000 ? previous.count : 0;
      if (count >= 2) {
        institutionState.stopped = true;
        recordInstitutionFailure('机构登录反复返回，已停止自动提交');
        institutionStatus('认证反复返回，已暂停；请检查后点击按钮重试');
        return false;
      }
      sessionStorage.setItem(key, JSON.stringify({ count: count + 1, time: Date.now() }));
    } catch (_) { /* 存储不可用时仍有本页去重与操作次数上限 */ }
    return true;
  }

  function submitInstitution(el) {
    if (!el) return false;
    const form = el.form || el.closest('form');
    // 同一机构步骤即使重新渲染按钮，也只能提交一次；新的表单 action 才是下一步。
    const key = [el.id, el.getAttribute('name'), el.getAttribute('value'), form?.getAttribute('action'), el.getAttribute('href')].join('|');
    if (institutionState.submitted.has(key) || !isVisible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    const adapter = institutionAdapter();
    const stage = adapter.results && el.matches(adapter.results) ? 'select' : 'continue';
    if (!institutionSubmitGuard(stage)) return false;
    return actOnInstitution(el, 'submit', () => {
      institutionState.submitted.add(key);
      institutionStatus('正在前往哈工大认证…');
      el.click();
    });
  }

  function confirmedInstitution(adapter, search, select, results) {
    if (isVisible(select)) return !select.disabled && !!select.selectedOptions[0] &&
      !select.selectedOptions[0].disabled && isHitInstitution(select.selectedOptions[0]);
    if (search?.disabled) return false;
    const entity = adapter.entity && q(adapter.entity);
    // CARSI 以隐藏实体为准，仅输入学校全称不能代表已选校。
    if (entity) return hasHitEntity(entity.value) && isHitInstitutionName(search?.value);
    // Springer/Cambridge 已记住或真正选中后，输入框为完整校名且下拉已收起。
    return ['springer', 'cambridge'].includes(adapter.id) && isVisible(search) &&
      isHitInstitutionName(search.value) && search.getAttribute('aria-expanded') === 'false' && !results.length;
  }

  async function navigateInstitution(url) {
    // 防止单点登录配置错误导致返回机构页后无限跳转；存储不可用时仍受本页步骤限制。
    try {
      const key = 'hit-institution-nav:' + location.hostname + location.pathname;
      const previous = JSON.parse(sessionStorage.getItem(key) || 'null');
      const count = previous && Date.now() - previous.time < 300000 ? previous.count : 0;
      if (count >= 2) {
        institutionState.stopped = true;
        recordInstitutionFailure('机构登录反复返回，已停止跳转');
        institutionStatus('登录反复返回，请手动检查');
        return false;
      }
      sessionStorage.setItem(key, JSON.stringify({ count: count + 1, time: Date.now() }));
    } catch (_) { /* 隐私模式可能禁用 sessionStorage */ }
    institutionStatus('正在前往哈工大认证…');
    try { await institutionWrites; }
    catch (_) {
      institutionState.stopped = true;
      institutionStatus(LANG === 'en' ? 'Could not save settings. Please reload and retry.' : '无法保存选校状态，请刷新后重试');
      return false;
    }
    location.assign(url);
    return true;
  }

  function runInstitutionStep() {
    const adapter = institutionAdapter();
    if (!adapter || !institutionEnabled()) return;
    if (!institutionState || institutionState.href !== location.href) institutionState = newInstitutionState();
    if (institutionState.stopped) return;
    if (/just a moment|请稍候|access denied|安全验证|应用防火墙/i.test(document.title)) {
      institutionStatus('请先完成人机验证，完成后自动继续');
      if (!institutionState.challengeLogged) recordInstitutionFailure('人机验证或防火墙拦截');
      institutionState.challengeLogged = true;
      return;
    }
    institutionState.challengeLogged = false;
    if (!adapter.page()) return;
    if (adapter.entryButtonText && institutionState.requested) {
      const entry = [...document.querySelectorAll('button')].find(el => adapter.entryButtonText.test(el.textContent.trim()) && isVisible(el));
      if (entry && actOnInstitution(entry, 'entry', () => entry.click())) return;
    }
    if (adapter.direct) {
      const search = q('.inst-typeahead-input');
      if (isVisible(search)) actOnInstitution(search, 'navigate', () => navigateInstitution(adapter.entry()));
      return;
    }

    const search = adapter.search && [...document.querySelectorAll(adapter.search)].find(isVisible);
    const federation = adapter.federation && [...document.querySelectorAll(adapter.federation)].find(isVisible);
    const select = adapter.select && [...document.querySelectorAll(adapter.select)].find(isVisible);
    const results = adapter.results ? [...document.querySelectorAll(adapter.results)].filter(isVisible) : [];
    const remembered = rememberedInstitutionAction();
    if (![search, federation, select].some(isVisible) && !results.length && !remembered) {
      if (institutionState.requested) {
        if (!institutionState.started) institutionState.started = Date.now();
        if (Date.now() - institutionState.started > 30000) {
          institutionState.stopped = true;
          recordInstitutionFailure('未检测到可用的机构选择控件');
          institutionStatus('未找到机构选校控件，请手动检查');
        }
      }
      return;
    }
    const otherQuery = search?.value && !/^harbin$/i.test(search.value.trim()) && !isHitInstitutionName(search.value);
    const otherFederation = federation?.selectedIndex > 0 && !/CARSI/i.test(federation.selectedOptions[0]?.textContent || '');
    const otherSelection = select?.selectedIndex > 0 && !isHitInstitution(select.selectedOptions[0]);
    if (((institutionState.selected || institutionState.selectionAttempted) && (otherQuery || otherFederation || otherSelection)) ||
        (!institutionState.requested && (otherQuery || otherFederation || otherSelection))) {
      institutionState.stopped = true;
      institutionStatus('保留你已选择的机构；点击按钮可改为哈工大');
      return;
    }
    if (!institutionState.started) institutionState.started = Date.now();
    if (Date.now() - institutionState.started > 30000) {
      institutionState.stopped = true;
      const missingSchool = isVisible(select) && select.options.length > 1 && ![...select.options].some(isHitInstitution);
      recordInstitutionFailure(missingSchool ? '机构学校列表中未提供哈尔滨工业大学' : '30 秒内未能完成学校选择');
      institutionStatus('选校超时，可点击“哈工大登录”重试');
      return;
    }

    // 每轮重新读取当前表单，不能把“点击过结果”当作选择成功。
    institutionState.selected = confirmedInstitution(adapter, search, select, results);
    if (institutionState.selected) {
      submitInstitution(institutionSubmit(adapter));
      return;
    }
    const hit = results.find(isHitInstitution) || remembered;
    if (hit) {
      // Elsevier 的学校按钮本身提交表单；不要再点击用于搜索的“提交并继续”。
      const navigates = hit.tagName === 'A' && hit.getAttribute('href') && hit.getAttribute('href') !== '#' ||
        hit.matches('button[type="submit"], .els-institution-form button');
      if (navigates || hit === remembered && !results.includes(hit)) submitInstitution(hit);
      else actOnInstitution(hit, 'select', () => hit.click(), true);
      institutionState.selectionAttempted = true;
      institutionStatus('正在选择哈尔滨工业大学…');
      return;
    }
    if (isVisible(select) && !select.disabled) {
      const option = [...select.options].find(option => !option.disabled && isHitInstitution(option));
      if (option && actOnInstitution(select, 'select', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, true)) return;
    }
    // 初次加载可能早于站点事件绑定；无结果时最多重新触发三次，给异步请求留出时间。
    if (isVisible(search) && !search.readOnly && (!search.value || !otherQuery || institutionState.requested)) {
      if (actOnInstitution(search, 'search', () => {
        setInputValue(search, adapter.query || 'Harbin');
        search.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'n', code: 'KeyN' }));
      }, true)) {
        institutionStatus('正在查找哈尔滨工业大学…');
        return;
      }
    }
    // 无搜索控件或搜索无结果时，才尝试 CARSI 联盟下拉框。
    if (isVisible(federation) && !federation.disabled && (!isVisible(search) || Date.now() - institutionState.started > 6000)) {
      const option = [...federation.options].find(option => /\bCARSI\b/i.test(option.textContent));
      if (option && !/CARSI/i.test(federation.selectedOptions[0]?.textContent || '')) {
        actOnInstitution(federation, 'federation', () => {
          federation.value = option.value;
          federation.dispatchEvent(new Event('change', { bubbles: true }));
        }, true);
      }
    }
  }

  function scheduleInstitutionStep() {
    if (institutionTimer) return;
    institutionTimer = setTimeout(() => { institutionTimer = null; runInstitutionStep(); }, 200);
  }

  async function startInstitutionLogin() {
    const adapter = institutionAdapter();
    if (!adapter) return false;
    institutionState = newInstitutionState(true);
    // 显式按钮表示用户已检查并重试；自动返回机构页不会清除此限制。
    institutionSubmitGuard('select', true);
    institutionSubmitGuard('continue', true);
    await setInstitutionValue(INSTITUTION_PENDING_KEY, { adapter: adapter.id, expires: Date.now() + 180000 });
    // 文章页已记住本校时，使用站点现成入口以保留资源回跳；仅显式点击时执行。
    const remembered = rememberedInstitutionAction(adapter.page());
    if (remembered) return submitInstitution(remembered);
    // 已在机构页就直接选校；在文章或首页则进入站点的机构登录流程。
    if (adapter.page()) { runInstitutionStep(); return true; }
    return navigateInstitution(adapter.entry());
  }

  function observeInstitutionLogin() {
    if (!institutionAdapter() || institutionObserver) return;
    institutionState = newInstitutionState();
    // 人工修改学校输入/下拉框时立即让出控制权，按钮可重新启动。
    const yieldInstitutionControl = event => {
      if (!event.isTrusted || !event.target.matches?.('input,select')) return;
      const adapter = institutionAdapter();
      const selectors = [adapter?.search, adapter?.select, adapter?.federation].filter(Boolean).join(',');
      if (selectors && event.target.matches(selectors)) {
        institutionState.stopped = true;
        institutionStatus('已交由你手动选择；可点击按钮重新开始');
      }
    };
    document.addEventListener('input', yieldInstitutionControl, true);
    document.addEventListener('change', yieldInstitutionControl, true);
    institutionObserver = new MutationObserver(scheduleInstitutionStep);
    institutionObserver.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'disabled', 'aria-expanded', 'aria-selected', 'aria-disabled', 'value'] });
    window.addEventListener('popstate', scheduleInstitutionStep);
    // 低频计时同时处理框架延迟挂载、SPA 路由和超时；每次操作仍按元素去重。
    setInterval(scheduleInstitutionStep, 1000);
    scheduleInstitutionStep();
  }

  // ====== 自动登录核心 ======
  const attemptedLoginForms = new WeakSet();
  let loginRetryTimer = null;
  let loginStopped = false;
  let loginRunning = false;
  let loginRetryStarting = false;

  function loginProblem() {
    const error = byIds(errorTip_ids);
    const message = error?.title || error?.textContent || '';
    if (isVisible(error) && /该账号非常用账号|用户名密码有误|图形动态码错误/.test(message)) return message.trim();
    const captcha = [...captcha_ids.map(id => document.getElementById(id)),
      q('#captcha'), q('.geetest_panel'), q('.yidun_popup')].find(isVisible);
    return captcha ? '需要手动完成验证码' : '';
  }

  function stopLogin(message) {
    loginStopped = true;
    if (/该账号非常用账号|用户名密码有误/.test(message)) setInstitutionValue('autoLogin', false);
    hideOverlay();
    console.info('[HIT Auto Login]', message);
  }

  async function doHitAutoLogin({ force = false } = {}) {
    // force 只覆盖“自动点击”开关，不能越过域名、路径和表单校验。
    if (loginStopped || interrupted) return true;
    const context = loginContext();
    if (!context) return false;
    if (attemptedLoginForms.has(context.root)) return true;
    const problem = loginProblem();
    if (problem) { stopLogin(problem); return true; }

    if (loginRunning) return false;
    loginRunning = true;
    try {
      const [savedUsername, savedPassword] = await Promise.all([store.get('username', ''), store.get('password', '')]);
      if (interrupted || loginStopped || loginContext()?.root !== context.root) return false;
      const delayedProblem = loginProblem();
      if (delayedProblem) { stopLogin(delayedProblem); return true; }
      const autoLogin = getInstitutionValue('autoLogin', false);
      // 不覆盖用户已输入的内容，也不提交空表单。
      if (context.username.value && savedUsername && context.username.value !== savedUsername) return true;
      if (!context.username.value && savedUsername) setInputValue(context.username, savedUsername);
      if (!context.password.value && savedPassword && savedUsername && context.username.value === savedUsername) setInputValue(context.password, savedPassword);
      if ((!autoLogin && !force) || !context.username.value.trim() || !context.password.value || context.button.disabled) return true;
      if (context.remember && !context.remember.checked) context.remember.click();

      attemptedLoginForms.add(context.root);
      showOverlay();
      const deadline = Date.now() + 20000;
      setTimeout(() => {
        if (interrupted || loginStopped || loginContext()?.root !== context.root || loginProblem() ||
          (!force && !getInstitutionValue('autoLogin', false))) { hideOverlay(); return; }
        context.button.click();
      }, 150);
      pollTimer = setInterval(() => {
        const problem = loginProblem();
        if (problem) { stopLogin(problem); return; }
        if (interrupted || !loginContext() || Date.now() >= deadline) hideOverlay();
      }, 500);
      return true;
    } finally { loginRunning = false; }
  }

  async function autoLoginWithRetry() {
    if (!loginRoute() || loginRetryTimer || loginRetryStarting || loginStopped || interrupted) return;
    loginRetryStarting = true;
    try {
      if (await doHitAutoLogin()) return;
      const deadline = Date.now() + 30000;
      loginRetryTimer = setInterval(async () => {
        if (await doHitAutoLogin() || Date.now() >= deadline || !loginRoute()) {
          clearInterval(loginRetryTimer);
          loginRetryTimer = null;
        }
      }, 300);
    } finally { loginRetryStarting = false; }
  }

  function triggerAutoLoginOnce() {
    if (pollTimer) return true;
    interrupted = false;
    loginStopped = false;
    const context = loginContext();
    if (context) attemptedLoginForms.delete(context.root);
    return doHitAutoLogin({ force: true });
  }

  // ====== IDP 自动授权功能 ======
  const attemptedConsents = new WeakSet();
  function handleIdpAuth() {
    if (location.protocol !== 'https:' || location.hostname !== 'idp.hit.edu.cn' ||
      !location.pathname.startsWith('/idp/profile/') || interrupted || !getInstitutionValue('idpAutoAuth', true)) return;
    const proceed = q('button[name="_eventId_proceed"]');
    const form = proceed?.form;
    if (!form || !isVisible(proceed) || proceed.disabled || attemptedConsents.has(proceed)) return;
    const action = new URL(form.action, location.href);
    if (action.origin !== location.origin || !action.pathname.startsWith('/idp/')) return;
    const consent = form.querySelector('#accept') || form.querySelector('input[type="radio"][value="_shib_idp_globalConsent"]');
    if (!consent || !isVisible(consent)) return;
    if (!consent.checked) consent.click();
    if (!consent.checked) return;
    attemptedConsents.add(proceed);
    showOverlay(LANG === 'en' ? 'Authorizing off-campus access…' : '正在自动同意校外访问授权…');
    const href = location.href;
    setTimeout(() => {
      if (!interrupted && location.href === href && proceed.isConnected && !proceed.disabled && getInstitutionValue('idpAutoAuth', true)) proceed.click();
    }, 200);
    setTimeout(hideOverlay, 10000);
  }

  // ====== 系统更新弹窗自动点击 ======
  function handleSystemUpdateModal() {
    // 检测 Ant Design Modal 确认弹窗
    // 特征：.ant-modal-confirm 且内容包含"系统已更新，为保证使用体验，请刷新页面"
    const modals = document.querySelectorAll('.ant-modal-confirm');

    for (const modal of modals) {
      const content = modal.querySelector('.ant-modal-confirm-content');
      if (content && content.textContent.includes('系统已更新，为保证使用体验，请刷新页面')) {
        // 找到"立即刷新"按钮并点击
        const refreshBtn = modal.querySelector('.ant-modal-confirm-btns .ant-btn-primary');
        if (refreshBtn) {
          console.log('[HIT Auto Login] 检测到系统更新弹窗，自动点击刷新按钮');
          refreshBtn.click();
          return true;
        }
      }
    }
    return false;
  }

  // 使用 MutationObserver 监听弹窗出现
  function observeSystemUpdateModal() {
    // 先检查一次当前页面
    handleSystemUpdateModal();

    // 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // 延迟一小段时间确保 DOM 完全渲染
          setTimeout(() => {
            handleSystemUpdateModal();
          }, 100);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async function boot() {
    await settingsReady;
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    LANG = getInstitutionValue('lang', 'zh');
    if (getInstitutionValue(FAB_KEY, true)) await createFab();
    if (isHitSite) observeSystemUpdateModal();
    await autoLoginWithRetry();
    observeInstitutionLogin();
    handleIdpAuth();
    if (location.hostname === 'idp.hit.edu.cn') {
      let consentTimer = null;
      new MutationObserver(() => {
        if (consentTimer) return;
        consentTimer = setTimeout(() => { consentTimer = null; handleIdpAuth(); }, 200);
      }).observe(document.body, { childList: true, subtree: true });
    }
    if (loginRoute() === 'cas') await setInstitutionValue(INSTITUTION_PENDING_KEY, null);
  }
  const ready = boot();
  ready.catch(error => console.error('[HIT Auto Login] Initialization failed', error));

  // Firefox supports Promise responses; do not combine an async listener with sendResponse.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'HIT_TRIGGER_LOGIN') return ready.then(async () => ({ ok: !!(await triggerAutoLoginOnce()) }));
    if (msg?.type === 'HIT_INSTITUTION_LOGIN') return ready.then(async () => ({ ok: !!(await startInstitutionLogin()) }));
    if (msg?.type === 'HIT_SET_FAB' && typeof msg.enabled === 'boolean') return ready.then(async () => {
      await setInstitutionValue(FAB_KEY, msg.enabled);
      if (msg.enabled) await createFab(); else destroyFab();
      return { ok: true };
    });
    return undefined;
  });

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    await settingsReady;
    for (const key of settingKeys) {
      if (!(key in changes)) continue;
      if (changes[key].newValue === undefined) delete institutionSettings[key];
      else institutionSettings[key] = changes[key].newValue;
    }
    if ('fabEnabled' in changes) {
      getInstitutionValue(FAB_KEY, true) ? createFab() : destroyFab();
    }
    if ('username' in changes || 'password' in changes || 'autoLogin' in changes || 'idpAutoAuth' in changes) renderFabKV();
    if ('institutionAutoSelect' in changes) {
      if (!getInstitutionValue(INSTITUTION_KEY, true)) await setInstitutionValue(INSTITUTION_PENDING_KEY, null);
      institutionState = newInstitutionState();
      scheduleInstitutionStep();
    }
    if ('autoLogin' in changes && changes.autoLogin.newValue) autoLoginWithRetry();
    if ('lang' in changes) {
      LANG = getInstitutionValue('lang', 'zh');
      renderFabStaticTexts();
      renderFabKV();
      renderOverlayTexts();
    }
  });

  window.HITLoginAuto2 = { setCustomIds, triggerLogin: triggerAutoLoginOnce, showOverlay, hideOverlay,
    adjustFloatBtns: adjustPageFloatBtns, institutionLogin: startInstitutionLogin };
})();
