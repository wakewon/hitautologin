// Native Firefox background APIs; no page credentials are read by menu handling.
let menuUpdate = Promise.resolve();
function updateMenus() {
  menuUpdate = menuUpdate.then(async () => {
    const { lang = 'zh' } = await browser.storage.local.get('lang');
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({
      id: 'hit_institution_login', contexts: ['all'],
      title: lang === 'en' ? 'HIT: Institutional sign-in' : 'HIT：哈工大机构登录'
    });
    browser.contextMenus.create({
      id: 'hit_trigger_login', contexts: ['all'],
      title: lang === 'en' ? 'HIT: Trigger login manually' : 'HIT：手动接管统一认证'
    });
  }).catch(error => console.error('[HIT Auto Login] Menu update failed', error));
  return menuUpdate;
}
browser.runtime.onInstalled.addListener(updateMenus);
browser.runtime.onStartup.addListener(updateMenus);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'lang' in changes) updateMenus();
});
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!Number.isInteger(tab?.id)) return;
  const type = info.menuItemId === 'hit_institution_login' ? 'HIT_INSTITUTION_LOGIN'
    : info.menuItemId === 'hit_trigger_login' ? 'HIT_TRIGGER_LOGIN' : null;
  if (!type) return;
  try { await browser.tabs.sendMessage(tab.id, { type }); }
  catch (error) { console.info('[HIT Auto Login] Reload the page before using sign-in', error); }
});
