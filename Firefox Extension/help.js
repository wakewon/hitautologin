function render(lang) {
  document.getElementById('zh').hidden = lang === 'en';
  document.getElementById('en').hidden = lang !== 'en';
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
}
browser.storage.local.get('lang').then(({ lang = 'zh' }) => render(lang));
for (const [id, lang] of [['btnZh', 'zh'], ['btnEn', 'en']]) {
  document.getElementById(id).addEventListener('click', async () => {
    await browser.storage.local.set({ lang });
    render(lang);
  });
}
