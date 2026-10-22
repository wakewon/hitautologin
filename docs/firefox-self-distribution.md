# Firefox 自行分发上传与安装

本步骤对应 Mozilla Add-ons Developer Hub 中的 **On your own / 自行分发**。上传的是未签名扩展包；最终安装的是 Mozilla 返回的已签名 XPI。

## 已准备的文件

运行以下命令可重新生成当前版本的全部材料，无需安装 npm 依赖：

```sh
npm run build:firefox-unlisted
```

要求 Node.js 24 LTS / 26，以及 macOS/Linux 的 `zip` 命令。输出目录为 `dist/firefox-upload/`：

| 文件 | 在哪里使用 |
| --- | --- |
| `hit-autologin-personal-1.4.2-unsigned.zip` | AMO 的 **Select a file / 选择文件**，上传扩展本体 |
| `hit-autologin-personal-1.4.2-source.zip` | 后续源码问题选择 **Yes** 后上传，供审核重建 |
| `reviewer-notes.txt` | 如果页面出现审核备注，可粘贴其内容 |
| `privacy-policy.txt` | 如果页面要求隐私说明，可粘贴其内容；扩展内另附 `privacy.html` |
| `SHA256SUMS.txt` | 本地核对两个 ZIP 的 SHA-256，无需上传 |

扩展 ZIP 的根目录直接包含 `manifest.json`，不是外包一层文件夹。源码包包含完整重建所需的原始文件、固定 ID 配置、构建脚本及英文 README；不含 `.git`、`node_modules`、浏览器数据、真实账号或密码。

个人包使用 `config/firefox-unlisted.json` 中生成并固定的 UUID，名称为 **HIT 自动登录（个人修改版）**。源扩展保留原作者 ID；临时开发版也继续使用自己的开发 ID。这三个 ID 彼此不同。MIT 许可与原作者署名随包保留。首次提交后不要改变个人包 ID。

## 你当前页面的下一步

1. 在 **On your own** 下点击 Continue。到上传页后，选择 `hit-autologin-personal-1.4.2-unsigned.zip`。
2. 等待验证完成。本地 `web-ext` 检查通过不等于 Mozilla 已签名；以网页验证结果为准。有错误时先修复错误。
3. 平台只选择 **Firefox 桌面版**，不要勾选 Android。本轮没有做 Android 功能验证。
4. 到 **Do you need to submit source code?** 之类的问题时，选择 **Yes** 并上传 `hit-autologin-personal-1.4.2-source.zip`。虽然 JS 未压缩或混淆，打包脚本仍会生成修改后的 manifest，因此附上完整重建材料。
5. 如果出现审核备注或隐私说明字段，使用相应 TXT 内容。许可证填写 **MIT**；这是原项目的个人修改版，不是原作者官方发布。如果隐私政策要求 HTTPS URL 而不是文本框，需要把随包的 `privacy.html` 放到你控制的 HTTPS 页面后填写地址。
6. 如果页面显示数据类型，应与 manifest 一致：**Authentication information / 认证信息** 和 **Browsing activity / 浏览活动**。含义分别是学校认证表单的凭据提交，以及机构登录或主动使用 WebVPN 时的资源地址回跳；没有向开发者上传密码、历史记录或失败日志，也没有统计 SDK。不能选择“完全不传输任何数据”。
7. 按页面按钮完成提交，等待 **Signature pending / 签名处理中**。开发者协议如尚未接受，由你在网页阅读并决定接受。
8. 进入 **My Submissions / My Add-ons**，找到本扩展的 **Manage Status & Versions / View All**，打开 `1.4.2`，下载 Mozilla 生成的 **已签名 `.xpi`**。可能需要等待处理或邮件通知；不要把本地未签名 ZIP 改扩展名当作签名包。

Mozilla 的[提交说明](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)、[源码要求](https://extensionworkshop.com/documentation/publish/source-code-submission/)和[数据声明说明](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)给出了这些步骤和要求。不同语言或新版页面的按钮文字可能略有差异。

## 安装 Mozilla 返回的 XPI

1. 在 `about:debugging#/runtime/this-firefox` 移除旧的临时开发版；在 `about:addons` 停用商店版和其他重复运行的版本。测试时暂停同功能油猴脚本。
2. 在 Firefox 打开 `about:addons`，点击齿轮，选择 **Install Add-on From File / 从文件安装附加组件**。
3. 选择刚下载的已签名 `.xpi`，核对名称、网站权限及数据声明，确认安装。
4. 刷新已打开的网站，并在新扩展弹出页重新填写账号与所需设置。个人包 ID 不同，因此不会自动导入开发版或商店版的设置。

这是常规安装，重启 Firefox 后仍保留。参见 Mozilla 的[从文件安装说明](https://extensionworkshop.com/documentation/publish/install-self-distributed/)。

## 后续更新

当前包没有自动更新服务器。修改完成后提高 `Firefox Extension/manifest.json` 的版本号，保留 `config/firefox-unlisted.json` 中的同一 ID，重新运行构建命令。在 AMO **同一个扩展条目**中上传新版本和对应源码，下载新签名 XPI，再从文件安装更新。不要再次创建新扩展或随机生成 ID，否则会成为另一份扩展，也不会沿用已有设置。
