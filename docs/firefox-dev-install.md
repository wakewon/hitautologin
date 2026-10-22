# Firefox 本地开发版安装

适用于桌面 Firefox 140+。本次功能位于仓库源码 v1.4.2，商店版本不会因为本地 Git 提交自动更新。临时加载不需要原开发者账号，也不需要 Mozilla 开发者账号。

## 生成开发目录

在仓库根目录运行（构建只需要 Node.js，无需先安装 npm 依赖）：

```sh
npm run build:firefox-dev
```

生成 `dist/firefox-dev/manifest.json` 及完整扩展文件。开发包名称为 **HIT 自动登录（本地开发版）**，固定独立 ID 为 `hit-autologin-dev@local.invalid`。源目录 `Firefox Extension/manifest.json` 保留原项目 ID，构建时才替换为开发 ID。

这使开发版的本地设置与商店版隔离，也不需要取得原作者发布权限。开发版首次使用需要重新填写账号密码，原扩展的数据不会自动导入或删除。

## 临时加载

1. 为避免两个版本重复接管，先在 `about:addons` 停用旧版 HIT 扩展；如果油猴也启用了同类脚本，测试时暂停该脚本。
2. 在 Firefox 地址栏输入 `about:debugging#/runtime/this-firefox`。
3. 点击 **临时载入附加组件 / Load Temporary Add-on**。
4. 选择生成目录中的 **`dist/firefox-dev/manifest.json`**。整个目录都需要保留，不能只拷贝 manifest 文件。
5. 在调试页确认出现 **HIT 自动登录（本地开发版）**，然后刷新已经打开的学术网站或统一认证标签页。
6. 点击扩展图标，重新填写账号密码，按需开启“自动登录”。学术网站自动选校默认开启；右下角的“哈工大登录”、弹出页的“哈工大机构登录”和网页右键菜单都可执行一次机构登录。

普通 Firefox 即可这样测试未签名扩展。临时扩展会在 Firefox 重启后移除，需要重新执行第 2–4 步；临时加载的存储可能继续保留。Mozilla 的[临时安装文档](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)说明了这种生命周期。

## 使用与限制

- **自动登录**控制统一认证页填写后是否提交；关闭时只填充。**学术网站自动选校**单独控制机构选择，关闭后仍可主动点击按钮执行一次选校。
- 自动填凭据仅限已确认的 HTTPS 统一认证表单 / WLAN 面板，学工子站、密码找回、代理页面等不会被接管。手动触发也不能绕过识别规则。
- 选校包含已记住机构的继续步骤；延迟绑定或未生效的搜索/选择最多重试三次。同一步骤的提交去重，个人邮箱继续按钮不受机构名提示影响。
- 用户手动修改学校时让出控制权；遇到人机验证需要手动完成。找不到学校或超时后可以从弹出页查看失败记录。
- [119 项资源适配记录](./library-adapters.md)区分了已验证入口、共享规则、模板和未完成项。ASME 本次公开的 China (CARSI) 列表未提供哈工大，不能完成该站选校。
- Firefox 内部页面、扩展商店等受限页面不会注入脚本。在普通学术网站上测试。隐藏悬浮按钮后仍可从扩展弹出页或网页右键菜单启动。

## 修改代码后更新

1. 重新运行 `npm run build:firefox-dev`。
2. 在 `about:debugging#/runtime/this-firefox` 找到开发版，点击 **重新载入 / Reload**。
3. 刷新目标网站标签页，让新内容脚本接管。

稳定的开发 ID 让重新构建 / 重新载入继续使用同一套开发版设置。切回商店版时，在调试页移除临时开发版，再在 `about:addons` 恢复旧扩展。

## 希望重启后长期保留

Firefox 正式版 / Beta 的常规安装需要 Mozilla 签名。你可以用自己的 Mozilla 开发者账号，使用一个属于你自己的唯一扩展 ID，将修改版提交为 **自分发 / unlisted** 扩展；它无需作为公开商店条目发布，也无需原作者账号。

默认本地 ID 用于临时测试。用于你自己账号签名的个人包已有独立构建命令：

```sh
npm run build:firefox-unlisted
```

它使用 `config/firefox-unlisted.json` 中固定的独立 UUID，不改变商店版或临时开发版 ID，并保留 MIT 许可和原作者署名。按[自行分发上传步骤](./firefox-self-distribution.md)上传 `dist/firefox-upload/` 中的扩展 ZIP 与源码 ZIP，再安装 Mozilla 返回的已签名 `.xpi`。不要用原作者的扩展 ID 向其商店条目提交更新。

## 开发验证

安装测试依赖并运行两种运行环境的测试：

```sh
npm ci
npm run check
npm test
npm run build:firefox-dev
npx --yes web-ext@10.8.0 lint --source-dir dist/firefox-dev
```

测试包含共同站点行为、Firefox 异步存储和消息、弹出页、右键菜单、开发版及个人上传包打包和源码重建。站点订阅或登录后的下载权限仍需要用自己的账户确认；测试不使用真实账号密码。桌面最低版本为 140；Android 的数据声明最低版本单独标为 142，但本轮只验证桌面 Firefox，上传时只选择桌面平台。

Firefox 数据声明包含认证信息和浏览活动：前者用于学校登录，后者用于机构登录及 WebVPN 的当前资源回跳。详细用途见扩展内的 `privacy.html`，没有向维护者回传的接口。
