# 图书馆数据库选校适配记录

核查来源：[哈工大图书馆数据库列表](https://lib.hit.edu.cn/14781/list.htm)，共 **119 项**。资源名称和顺序来自该列表；逐项读取了图书馆详情页，并对主要可提取访问入口进行了 HTTP 探测，重点机构登录流程另在浏览器检查。HTTP 探测与浏览器可访问性可能不同，表中以浏览器实测优先。

119 项分别标记了已验证、共享适配、模板、访问失败和待适配状态。“已验证入口”只表示浏览器操作学校选择或指定本校实体后，到达 `https://ids.hit.edu.cn/authserver/login`；未输入真实账号密码，也未验证登录后的订阅、下载、付费或个人账号权限。DOM 回归测试验证脚本行为，不替代真实站点验证。

## 使用方式

更新 `Tampermonkey/app.js`，或按 [开发版安装说明](./firefox-dev-install.md) 加载 Firefox v1.4.2 后，在已登记的学术网站右下角直接点击 **哈工大登录**。在实际机构选择页，脚本也会按默认开启的设置自动选校。首页、文章页不会自行跳走。

- 统一认证账号密码仅用于 HTTPS 的 `ids.hit.edu.cn/authserver/login` 已确认表单；WLAN 另有独立的域名、路径和面板识别。
- 支持简体中文、英文全称、ACS 的 `HARBIN INST OF TECHNOLOGY` 及中英混排，核对页面提供的本校实体 ID；不选哈尔滨工程大学、其他校区或缩写 HIT。
- 用户手动修改机构输入时暂停。显式点击“哈工大登录”可重新启动。自动选校开关和已有自动提交账号密码开关相互独立。
- 油猴菜单支持开启/关闭自动选校、查看/清空失败记录。记录至多 30 条，仅保存站点、原因、时间。
- 人机验证由用户完成；验证页不填写、不点击。验证结束后继续选校。控件缺失、找不到学校、30 秒超时或重复跳回都会停止；不会猜其他学校。
- 仍需个人账号、仅校园 IP 或无法访问的站点，可按网站原流程或已有 HIT 面板的 WebVPN 工具处理。下表的“待适配/访问失败”尚无新的自动选校规则。

Firefox 使用相同站点规则，并额外通过扩展存储、消息和弹出页的行为回归测试。下方实站流程记录沿用原先浏览器核查；不表示所有资源都已在 Firefox 登录后验证。Firefox 弹出页也可关闭自动选校、启动一次机构登录、查看/清空失败记录。

## 浏览器已确认的流程

| 平台 | 一键入口/选校方式 | 观察结果 |
| --- | --- | --- |
| 知网 | `fsso.cnki.net` 中精确本校链接 | 已到达统一认证 |
| ACS | 新版 `/institutional-login`，`#institutionSearchInput`，核对 `data-shibboleth-id` | 用户通过验证后已到达统一认证 |
| Wiley | `/action/ssostart`，`#searchInstitution`，选择本校结果 | 用户通过验证后已到达统一认证 |
| ScienceDirect | 原站机构登录 → `id.elsevier.com` 的 `#wayfEmailForm` | 已到达统一认证；个人邮箱页不接管 |
| Springer / Cambridge | 各自 WAYF 搜索下拉框 → 选择本校 → 专用提交按钮 | 已到达统一认证 |
| IEEE / Emerald / DDS / JoVE | 图书馆公布的指定本校实体入口 | 已到达统一认证；IEEE 与 JoVE 保留当前资源回跳 |
| SAGE 中国平台 | 访问选项 → 通过 CARSI 登录 → `ds.carsi.edu.cn` 本校结果 → 登录 | 已到达统一认证 |
| EBSCO ASC / BSC | 图书馆已配置本校的两个 research 客户入口 | 原站直接到达统一认证，无需脚本加选校 |
| ASME | `/institutional-login` → China (CARSI) | 列表未提供哈工大，不能确认/完成选校 |

## 2026-10-22 稳定性与记住机构

油猴 v1.4.2 与 Firefox v1.4.2 使用相同规则：

- 搜索控件出现早于站点事件绑定时，每隔至少 3 秒重新触发输入，最多 3 次；未生效的普通结果选择同样有限重试。超时与总操作次数仍有上限。
- 每次操作重新读取当前表单。Springer/Cambridge 需完整本校名且下拉已收起；CARSI 需本校隐藏实体 ID 与完整校名；Silverchair 核对当前选中项。单纯点击过结果不能开启提交。
- ScienceDirect 的学校结果按钮本身提交并跳转。脚本不再随后点击用于搜索的“提交并继续”，也不把手填全称当作选中。
- 已记住机构的卡片须由操作本身明确标注本校，或由仅含隐藏本校实体和本校名的独立继续表单证明。个人邮箱表单、其他学校、校区与“忘记机构”操作不提交。
- 文章页保持原位；显式点击“哈工大登录”时，优先使用已有“Access through Harbin Institute of Technology”等本校入口并保留站点回跳。普通作者单位链接不当作登录入口。
- 同一步骤按按钮及表单 action 去重，重建按钮不会再次提交。手动输入或更改下拉框时让出控制权。

本轮在浏览器再次确认 ScienceDirect 搜索结果与 Springer/Cambridge 的选中状态，并到达统一认证。Elsevier 的[官方 SeamlessAccess 说明](https://www.elsevier.support/sciencedirect/answer/what-is-seamlessaccess)确认记住机构时文章页会显示“Access through [机构名]”入口。

### 真实 ScienceDirect 记忆页复核（v1.4.2）

用户随后在内置浏览器完成学校登录，首页出现本校机构访问标识。测试时通过个人菜单中的正常 Sign out 链接退出；Elsevier 有时停在 `/ext/ae-logout` 中转页，需点击“注销”才完成退出。**未清除站点数据或机构记忆。** 再次点击 Sign in，实际显示“通过您的组织访问”页：

- `form[name="elsForm"]` 中，`#bdd-elsPrimaryBtn` 是完整本校名的可提交卡片。
- `#bdd-elsPrimaryBtn2[name="action"][value="signInWithInst"]` 是“通过本校名访问”的专用按钮；脚本优先使用它，且在主卡片隐藏时仍可识别。
- `#bdd-rememberSA` 原已选中；脚本不修改此设置，不点击取消、注销或其他学校。
- 实际点击学校卡片返回 ScienceDirect，个人账户已显示，但返回页未见机构权限标识，因此不将此次返回当作订阅权限恢复证明。浏览器未加载本项目油猴或 Firefox 扩展；真实站点流程验证与两端脱敏 DOM 回归测试是不同证据。

多标签页测试退出期间，旧认证页曾落到 `ILP-VERIFY-1` 会话错误页；已关闭旧测试页并暂停浏览器登录操作。未据此归因于扩展或油猴脚本。代码另外补充了跨页面保护：同一平台、同一步骤在 5 分钟内自动提交最多两次，不使用变化的 OAuth state 或表单 action 作为限次标识；达到上限暂停并记录，用户显式点击按钮才重置。正常的搜索结果提交与记忆机构继续步骤分别计数。


## 拦截与未完成项

ACM、AIAA、AIP、ASCE 和 RSC 的浏览器访问遇到 Cloudflare。Wiley、ACS、ASME 经用户介入后可访问；Emerald 初次也遇到拦截，之后观察到正确跳转。没有尝试绕过人机验证或证书告警。其余 HTTP 403、TLS、超时与未确认选校流程逐项记录如下。

Atypon 与 Silverchair 的模板规则只在相应已登记域名的机构登录路径及明确控件出现时运行。它们不是所有出版商当前页面都兼容的保证；ACS 已根据实际新版单独纳入 Silverchair 规则。ASME 的 Shibboleth 下拉流程与页面上的个人账号验证码表单相互独立，脚本不会提交后者。

## 全部资源清单

“共享适配”表示复用已验证平台的选校机制，具体数据库的回跳/权限仍待确认。重复数据库或图书子集保留原列表中的独立条目。

| 序号 | 资源（图书馆详情） | 状态 | 入口检查 / 说明 |
| --- | --- | --- | --- |
| 1 | [中国知网](https://lib.hit.edu.cn/2022/0614/c14818a277344/page.htm) | 已验证入口 | [入口](http://www.cnki.net/)；知网 FSSO 精确选择本校，已到达统一认证 |
| 2 | [万方数据](https://lib.hit.edu.cn/2022/0614/c14818a277317/page.htm) | 旧入口失败，待验证 | [入口](http://g.wanfangdata.com.cn/)；图书馆旧 g.wanfangdata 入口请求异常；新版 www.wanfangdata.com.cn 已能打开且本次显示哈工大机构，校外选校仍待验证 |
| 3 | [北大法宝数据库](https://lib.hit.edu.cn/2022/0614/c14818a277343/page.htm) | 待适配 | [入口](http://www.pkulaw.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 4 | [博看人文社科期刊数据库](https://lib.hit.edu.cn/2022/0614/c14818a277342/page.htm) | 待适配 | [入口](https://ai-zq.bookan.com.cn/?id=21160)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 5 | [CCF数字图书馆](https://lib.hit.edu.cn/2026/0610/c14818a393914/page.htm) | 待适配 | [入口](https://dl.ccf.org.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 6 | [CIDP制造业数字资源平台](https://lib.hit.edu.cn/2022/0614/c14818a277336/page.htm) | 待适配 | [入口](https://www.cidp.com.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 7 | [cnki工具书](https://lib.hit.edu.cn/2022/0614/c14818a277338/page.htm) | 共享适配 | [入口](https://gongjushu.cnki.net/rbook/)；复用知网 FSSO 选校；工具书回跳与资源权限待验证 |
| 8 | [创新树-全球创新知识服务平台](https://lib.hit.edu.cn/2022/0614/c14818a277341/page.htm) | 待适配 | [入口](http://www.innovationtree.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 9 | [畅想之星电子书](https://lib.hit.edu.cn/2022/0614/c14818a277337/page.htm) | 待适配 | [入口](http://www.cxstar.com/hgd.htm)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 10 | [超星学术视频](https://lib.hit.edu.cn/2022/0614/c14818a277339/page.htm) | 待适配 | [入口](http://ssvideo.chaoxing.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 11 | [超星电子图书（读秀知识库服务平台）](https://lib.hit.edu.cn/2022/0609/c14818a277037/page.htm) | 访问失败 | [入口](http://www.duxiu.com/)；网络/TLS/重定向异常；未完成机构选校验证 |
| 12 | [EPS全球统计数据/分析平台](https://lib.hit.edu.cn/2022/0614/c14818a277334/page.htm) | 待适配 | [入口](http://www.epsnet.com.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 13 | [e线图情](https://lib.hit.edu.cn/2022/0614/c14818a277333/page.htm) | 访问失败 | [入口](http://www.chinalibs.cn/)；网络/TLS/重定向异常；未完成机构选校验证 |
| 14 | [FlyLaTeX](https://lib.hit.edu.cn/2025/1113/c14818a381702/page.htm) | 待适配 | [入口](https://www.flylatex.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 15 | [Global Sim全球仿真应用技能资源库](https://lib.hit.edu.cn/2026/0722/c14818a398040/page.htm) | 待适配 | [入口](http://hitwh.chinafangzhenedu.com/index.html)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 16 | [国务院发展研究中心信息网（国研网）](https://lib.hit.edu.cn/2022/0614/c14818a277330/page.htm) | 待适配 | [入口](http://www.drcnet.com.cn/www/integrated/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 17 | [国家哲学社会科学文献中心(NSSD)](https://lib.hit.edu.cn/2022/0614/c14818a277331/page.htm) | 待适配 | [入口](http://www.ncpssd.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 18 | [Kuke数字音乐图书馆](https://lib.hit.edu.cn/2022/0614/c14818a277327/page.htm) | 待适配 | [入口](http://www.kuke.com)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 19 | [科学文库](https://lib.hit.edu.cn/2022/0614/c14818a277326/page.htm) | 待适配 | [入口](http://reading.sciencepress.cn/shop/main/Login/shopFrame.do)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 20 | [MeTeL教学资源库](https://lib.hit.edu.cn/2022/0614/c14818a277325/page.htm) | 待适配 | [入口](https://www.metel.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 21 | [NoteExpress Web 参考文献管理与检索系统（青提学术）](https://lib.hit.edu.cn/2025/1113/c14818a381701/page.htm) | 待补入口 | 详情页未解析到可用的在线访问链接；不猜测认证路径 |
| 22 | [NoteExpress文献管理软件](https://lib.hit.edu.cn/2022/0614/c14818a277324/page.htm) | 软件资源 | [入口](https://www.inoteexpress.com/support/cgi-bin/download_sch.cgi?code=HaErBinGYDX)；学校专用软件下载链接，不是网页选校流程；不新增自动登录规则 |
| 23 | [全球大学生创新创业与就业数据库](https://lib.hit.edu.cn/2022/0614/c14818a277322/page.htm) | 待适配 | [入口](http://www.chinacxc.org/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 24 | [人大“复印报刊资料”全文数据库](https://lib.hit.edu.cn/2023/0608/c14818a313631/page.htm) | 待适配 | [入口](https://www.rdfybk.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 25 | [软件通-计算机技能视频学习系统](https://lib.hit.edu.cn/2022/0614/c14818a277321/page.htm) | 待适配 | [入口](https://rjt.softtone.cn/index)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 26 | [上岸考公网](https://lib.hit.edu.cn/2026/0722/c14818a398042/page.htm) | 待适配 | [入口](https://www.shangankaogong.net/index.html)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 27 | [上岸考研网](https://lib.hit.edu.cn/2026/0722/c14818a398058/page.htm) | 待适配 | [入口](https://www.shangankaoyan.net/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 28 | [书香哈工大——中文在线电子图书](https://lib.hit.edu.cn/2022/0609/c14818a277035/page.htm) | 待适配 | [入口](https://hrbgy.chineseall.cn/index)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 29 | [万方国内外文献保障服务数据库](https://lib.hit.edu.cn/2022/0614/c14818a277318/page.htm) | 待适配 | [入口](https://s.wanfangdata.com.cn/nav/4c905db3-916f-4d43-86dd-1568e1254b55)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 30 | [维普中文科技期刊](https://lib.hit.edu.cn/2022/0614/c14818a277316/page.htm) | 访问失败 | [入口](https://lib.cqvip.com/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
| 31 | [网上报告厅视频资源库](https://lib.hit.edu.cn/2026/0722/c14818a398039/page.htm) | 待适配 | [入口](https://wb.bjadks.com/home)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 32 | [壹专利数据库](https://lib.hit.edu.cn/2024/0528/c14818a345646/page.htm) | 待适配 | [入口](http://www.patyee.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 33 | [阅途美育在线](https://lib.hit.edu.cn/2026/0722/c14818a398038/page.htm) | 待适配 | [入口](https://www.myu100.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 34 | [中国共产党思想理论资源数据库](https://lib.hit.edu.cn/2022/1121/c14818a319852/page.htm) | 访问失败 | [入口](https://data.lilun.cn/)；网络/TLS/重定向异常；未完成机构选校验证 |
| 35 | [中国国家图书馆·中国国家数字图书馆](https://lib.hit.edu.cn/2022/0614/c14818a277300/page.htm) | 待适配 | [入口](https://www.nlc.cn/web/select.html)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 36 | [中国科学院GoOA开放获取论文一站式发现平台](https://lib.hit.edu.cn/2022/0614/c14818a277307/page.htm) | 访问失败 | [入口](http://gooa.las.ac.cn/)；网络/TLS/重定向异常；未完成机构选校验证 |
| 37 | [中文社会科学引文索引（CSSCI）](https://lib.hit.edu.cn/2022/0614/c14818a277304/page.htm) | 访问失败 | [入口](http://cssci.nju.edu.cn/)；HTTP 虽返回 200，但内容为 WEB 应用防火墙；未完成机构选校验证 |
| 38 | [中科UMajor专业课学习数据库](https://lib.hit.edu.cn/2022/0614/c14818a277309/page.htm) | 访问失败 | [入口](http://www.umajor.org/)；HTTPS 证书校验失败；未忽略证书错误，未完成选校验证 |
| 39 | [中科VIPExam考试学习资源库](https://lib.hit.edu.cn/2022/0614/c14818a277302/page.htm) | 访问失败 | [入口](http://www.vipexam.org/)；HTTPS 证书校验失败；未忽略证书错误，未完成选校验证 |
| 40 | [中科院JCR期刊分区数据在线平台](https://lib.hit.edu.cn/2022/0614/c14818a277298/page.htm) | 访问失败 | [入口](http://www.fenqubiao.com/)；网络/TLS/重定向异常；未完成机构选校验证 |
| 41 | [卓越联盟图书馆知识共享服务平台](https://lib.hit.edu.cn/2022/0614/c14818a277305/page.htm) | 访问失败 | [入口](http://www.zylm.superlib.net/)；HTTPS 证书校验失败；未忽略证书错误，未完成选校验证 |
| 42 | [掌阅精选数字图书馆](https://lib.hit.edu.cn/2026/0915/c14818a401544/page.htm) | 待适配 | [入口](https://s.zhangyue.com/channel/index?rentId=106510&appId=7b29d7c3)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 43 | [智课英文学术论文润色平台](https://lib.hit.edu.cn/2022/0614/c14818a277310/page.htm) | 访问失败 | [入口](http://www.smartpigai.com/smartstudy_hitlw/)；网络请求超时；未完成机构选校验证 |
| 44 | [智课英语学练在线服务平台](https://lib.hit.edu.cn/2022/0614/c14818a277311/page.htm) | 待适配 | [入口](https://www.starsunstudy.com/#/kc/hebgydxtsg)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 45 | [职业全能培训库](https://lib.hit.edu.cn/2022/0614/c14818a277308/page.htm) | 待适配 | [入口](https://zyk.bjadks.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 46 | [“文泉学堂”高等教育知识库](https://lib.hit.edu.cn/2022/1121/c14818a284761/page.htm) | 待适配 | [入口](https://lib-hit.wqxuetang.com)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 47 | [LeapSpace平台](https://lib.hit.edu.cn/2026/0707/c14819a396322/page.htm) | 共享适配 | [入口](https://www.sciencedirect.com/leapspace)；复用 ScienceDirect/Elsevier；LeapSpace 后续个人账号/权限待验证 |
| 48 | [A&HCI  艺术和人文科学引文索引](https://lib.hit.edu.cn/2022/0531/c14819a275649/page.htm) | 待适配 | [入口](http://apps.webofknowledge.com/WOS_GeneralSearch_input.do?last_prod=WOS&SID=S2IAgPKG6KF9coGOHF9&product=WOS&highlighted_tab=WOS&search_mode=GeneralSearch)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 49 | [Academic Search Complete (ASC) 综合学科全文数据库](https://lib.hit.edu.cn/2022/0531/c14819a275648/page.htm) | 原站已配置本校 | [入口](https://research.ebsco.com/c/amkst5)；图书馆 research.ebsco.com 客户入口已直接到达本校统一认证，无需额外选校 |
| 50 | [ACM 美国计算机学会](https://lib.hit.edu.cn/2022/0531/c14819a275647/page.htm) | 模板适配，未验证 | [入口](http://dl.acm.org/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 51 | [ACS 美国化学学会](https://lib.hit.edu.cn/2022/0531/c14819a275645/page.htm) | 已验证入口 | [入口](https://pubs.acs.org/action/ssostart?idp=https%3A%2F%2Fidp.hit.edu.cn%2Fidp%2Fshibboleth&redirectUri=%2Faction%2Fssostart)；ACS 新版 Silverchair，选择 HARBIN INST OF TECHNOLOGY 后到达统一认证 |
| 52 | [AGU美国地球物理学会数据库](https://lib.hit.edu.cn/2022/0531/c14819a275654/page.htm) | 共享适配 | [入口](https://agupubs.onlinelibrary.wiley.com/)；Wiley 平台 AGU 子域入口；复用已确认的 Wiley 选校，AGU 回跳待验证 |
| 53 | [AIAA美国航空航天学会数据库](https://lib.hit.edu.cn/2022/0531/c14819a275644/page.htm) | 模板适配，未验证 | [入口](http://arc.aiaa.org/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 54 | [AIAA美国航空航天学会电子图书](https://lib.hit.edu.cn/2022/0531/c14819a275646/page.htm) | 模板适配，未验证 | [入口](https://arc.aiaa.org/action/showPublications?pubType=book)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 55 | [AIP美国物理研究所](https://lib.hit.edu.cn/2022/0531/c14819a275657/page.htm) | 模板适配，未验证 | [入口](http://pubs.aip.org/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 56 | [AMS美国数学学会电子期刊数据库](https://lib.hit.edu.cn/2022/0531/c14819a275651/page.htm) | 访问失败 | [入口](https://www.ams.org/epubsearch/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
| 57 | [Annual Reviews  综述数据库](https://lib.hit.edu.cn/2022/0531/c14819a275656/page.htm) | 模板适配，未验证 | [入口](http://www.annualreviews.org/action/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 58 | [APS 美国物理学会](https://lib.hit.edu.cn/2022/0531/c14819a275653/page.htm) | 访问失败 | [入口](http://journals.aps.org/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
| 59 | [ASCE 美国土木工程学会](https://lib.hit.edu.cn/2022/0531/c14819a275652/page.htm) | 模板适配，未验证 | [入口](http://ascelibrary.org/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 60 | [ASME 美国机械工程师学会](https://lib.hit.edu.cn/2022/0531/c14819a275650/page.htm) | 无法完成选校 | [入口](http://asmedigitalcollection.asme.org/)；用户已通过验证；检查 /institutional-login 的 China (CARSI) 列表，未提供哈工大；保留安全下拉适配，找不到本校时停止 |
| 61 | [Business Source Complete (BSC)商管财经类全文数据库](https://lib.hit.edu.cn/2022/0531/c14819a275642/page.htm) | 原站已配置本校 | [入口](https://research.ebsco.com/c/3kighv)；图书馆 research.ebsco.com 客户入口已直接到达本校统一认证，无需额外选校 |
| 62 | [Cambridge Journals 剑桥期刊数据库](https://lib.hit.edu.cn/2022/0531/c14819a275638/page.htm) | 已验证入口 | [入口](https://www.cambridge.org/core)；Cambridge 搜索、选中、Continue to login 后到达统一认证 |
| 63 | [Cell Press 数据库](https://lib.hit.edu.cn/2022/0531/c14819a275637/page.htm) | 访问失败 | [入口](http://www.cell.com/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
| 64 | [CPCI会议录索引](https://lib.hit.edu.cn/2022/0531/c14819a275616/page.htm) | 待适配 | [入口](http://apps.webofknowledge.com/WOS_GeneralSearch_input.do?product=WOS&SID=2ENQUzh6JQ4CvlbfhF5&search_mode=GeneralSearch)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 65 | [DDS 学位论文集成发现系统](https://lib.hit.edu.cn/2022/0531/c14819a275635/page.htm) | 已验证入口 | [入口](https://shibboleth.guodao.cn/Shibboleth.sso/Login?entityID=https://idp.hit.edu.cn/idp/shibboleth)；图书馆 Shibboleth 直达入口已到达统一认证（普通 HTTP 探测曾返回 500） |
| 66 | [Derwent Innovations Index 德温特专利索引](https://lib.hit.edu.cn/2022/0531/c14819a275636/page.htm) | 待适配 | [入口](http://apps.webofknowledge.com/DIIDW_GeneralSearch_input.do?highlighted_tab=DIIDW&product=DIIDW&last_prod=DIIDW&search_mode=GeneralSearch&SID=S2IAgPKG6KF9coGOHF9)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 67 | [Ei 工程索引](https://lib.hit.edu.cn/2022/0531/c14819a275633/page.htm) | 入口适配，待验证 | [入口](https://www.engineeringvillage.com/search/quick.url?CID=quickSearch&database=1)；已加 Engineering Village 实际 Check access 入口；后续复用 Elsevier 组织选择，完整链路待验证 |
| 68 | [Elsevier Science 数据库](https://lib.hit.edu.cn/2022/0531/c14819a275632/page.htm) | 已验证入口 | [入口](https://auth.elsevier.com/ShibAuth/institutionLogin?entityID=https%3A%2F%2Fidp.hit.edu.cn%2Fidp%2Fshibboleth&appReturnURL=https%3A%2F%2Fwww.sciencedirect.com%2F)；ScienceDirect → Elsevier 组织搜索 → 本校 → 统一认证 |
| 69 | [Elsevier《酶学方法》电子书](https://lib.hit.edu.cn/2022/0609/c14819a277039/page.htm) | 共享适配 | [入口](http://www.sciencedirect.com/science/bookseries/00766879)；复用 ScienceDirect/Elsevier；具体书系权限待验证 |
| 70 | [Elsevier电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277041/page.htm) | 共享适配 | [入口](https://www.sciencedirect.com/science/bookbshsrw)；复用 ScienceDirect/Elsevier；具体图书权限待验证 |
| 71 | [Emerald《工商管理与经济学》专集](https://lib.hit.edu.cn/2022/0609/c14819a277059/page.htm) | 访问失败 | [入口](http://www.emeraldinsight.com/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
| 72 | [Emerald全文电子期刊回溯库](https://lib.hit.edu.cn/2022/0531/c14819a275629/page.htm) | 已验证入口 | [入口](https://www.emerald.com/start-session?idp=https://idp.hit.edu.cn/idp/shibboleth)；图书馆 Emerald 直达入口已到达统一认证；初次遇 Cloudflare，后续通过 |
| 73 | [Emerald经济管理学、图书馆学、工程学数据](https://lib.hit.edu.cn/2022/0531/c14819a275631/page.htm) | 已验证入口 | [入口](https://www.emerald.com/start-session?idp=https://idp.hit.edu.cn/idp/shibboleth)；与上一项共用 Emerald 直达入口，已到达统一认证 |
| 74 | [ESI 基本科学指标数据库](https://lib.hit.edu.cn/2022/0531/c14819a275627/page.htm) | 待适配 | [入口](https://esi.clarivate.com)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 75 | [国际光学工程学会（SPIE）电子书](https://lib.hit.edu.cn/2022/0609/c14819a277042/page.htm) | 访问失败 | [入口](https://www.spiedigitallibrary.org/ebooks)；网络请求超时；未完成机构选校验证 |
| 76 | [IEEE/IEE Electronic Library](https://lib.hit.edu.cn/2022/0531/c14819a275622/page.htm) | 已验证入口 | [入口](https://ieeexplore.ieee.org/servlet/wayf.jsp?entityId=https://idp.hit.edu.cn/idp/shibboleth&url=https%3A%2F%2Fieeexplore.ieee.org)；图书馆 wayf.jsp 指定本校实体，已到达统一认证 |
| 77 | [IGI电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277056/page.htm) | 待适配 | [入口](http://www.cnpereading.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 78 | [iGroup外文电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277057/page.htm) | 待适配 | [入口](https://portal.igpublish.com.cn)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 79 | [IMechE英国机械工程师协会](https://lib.hit.edu.cn/2022/0531/c14819a275619/page.htm) | 已验证入口 | [入口](http://sage.cnpereading.com/)；SAGE 中国平台 → CARSI → 精确本校 → 统一认证 |
| 80 | [InCites数据库](https://lib.hit.edu.cn/2022/0531/c14819a275612/page.htm) | 待适配 | [入口](https://incites.clarivate.com)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 81 | [IOP电子书](https://lib.hit.edu.cn/2022/0609/c14819a277054/page.htm) | 待适配 | [入口](http://iopscience.iop.org/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 82 | [IOP英国物理学会](https://lib.hit.edu.cn/2022/0531/c14819a275618/page.htm) | 待适配 | [入口](http://iopscience.iop.org/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 83 | [IWA数据库](https://lib.hit.edu.cn/2022/0531/c14819a275614/page.htm) | 模板适配，未验证 | [入口](https://iwaponline.com/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 84 | [JCR 期刊引证报告](https://lib.hit.edu.cn/2022/0531/c14819a275607/page.htm) | 待适配 | [入口](https://jcr.clarivate.com)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 85 | [JoVE视频实验期刊](https://lib.hit.edu.cn/2022/0531/c14819a275608/page.htm) | 已验证入口 | [入口](https://www.jove.com/Shibboleth.sso/Login?entityID=https://idp.hit.edu.cn/idp/shibboleth&target=https%3A%2F%2Fwww.jove.com%2Fshibboleth%2Fwayf_login.php%3Freturn_page=https://www.jove.com/)；图书馆 JoVE 直达入口已到达统一认证（普通 HTTP 探测曾返回 500） |
| 86 | [剑桥期刊回溯库](https://lib.hit.edu.cn/2022/0531/c14819a275606/page.htm) | 共享适配 | [入口](https://www.cambridge.org/core/services/librarians/cambridge-journals-digital-archive/cambridge-journals-complete-digital-archive-2011)；复用 Cambridge 选校；回溯库权限待验证 |
| 87 | [MathSciNet数学评论](https://lib.hit.edu.cn/2022/0531/c14819a275598/page.htm) | 待适配 | [入口](https://mathscinet.ams.org/mathscinet/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 88 | [Morgan & Claypool综述文集数据库](https://lib.hit.edu.cn/2022/0609/c14819a277053/page.htm) | 沿用 WebVPN | [入口](http://ieeexplore-ieee-org-s.ivpn.hit.edu.cn:1080/search/searchresult.jsp?sortType=newest&highlight=true&returnType=SEARCH&refinements=ContentType:Books&refinements=PublicationPackage:MCSYNTH&returnFacets=ALL)；图书馆直接给出 WebVPN 链接；无独立选校适配，不在代理页填校园密码 |
| 89 | [美国科学院院报(PNAS)期刊数据库](https://lib.hit.edu.cn/2026/0430/c14819a391275/page.htm) | 模板适配，未验证 | [入口](http://www.pnas.org/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 90 | [Nature 数据库](https://lib.hit.edu.cn/2022/0531/c14819a275594/page.htm) | 共享适配 | [入口](https://www.nature.com/)；复用 Springer Nature WAYF；Nature 具体资源回跳待验证 |
| 91 | [NSTL (国家科技图书文献中心)](https://lib.hit.edu.cn/2022/0531/c14819a275592/page.htm) | 待适配 | [入口](https://www.nstl.gov.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 92 | [OSA美国光学学会](https://lib.hit.edu.cn/2022/0531/c14819a275590/page.htm) | 访问失败 | [入口](https://www.osapublishing.org/china/)；网络/TLS/重定向异常；未完成机构选校验证 |
| 93 | [Oxford Journals  牛津期刊数据库](https://lib.hit.edu.cn/2022/0531/c14819a275589/page.htm) | 模板适配，未验证 | [入口](https://academic.oup.com/journals/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 94 | [PQDT国外博硕论文全文](https://lib.hit.edu.cn/2022/0531/c14819a275587/page.htm) | 待适配 | [入口](http://www.pqdtcn.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 95 | [RSC英国皇家化学学会数据库](https://lib.hit.edu.cn/2022/0531/c14819a275585/page.htm) | 访问失败 | [入口](http://pubs.rsc.org/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
| 96 | [RSC英国皇家化学学会电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277046/page.htm) | 待补入口 | 详情页未解析到可用的在线访问链接；不猜测认证路径 |
| 97 | [SAGE Premier数据库](https://lib.hit.edu.cn/2022/0531/c14819a275579/page.htm) | 已验证入口 | [入口](http://sage.cnpereading.com/)；SAGE 中国平台 → CARSI → 精确本校 → 统一认证 |
| 98 | [Science online《科学》在线](https://lib.hit.edu.cn/2022/0531/c14819a275577/page.htm) | 访问失败 | [入口](http://www.sciencemag.org/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
| 99 | [SciVal科研分析平台](https://lib.hit.edu.cn/2025/0905/c14819a377186/page.htm) | 入口适配，待验证 | [入口](http://www.scival.com/)；已加 SciVal 实际 /idp/start 入口；可能仍需个人账号，完整链路待验证 |
| 100 | [SCI科学引文索引](https://lib.hit.edu.cn/2022/0531/c14819a275578/page.htm) | 待适配 | [入口](http://apps.webofknowledge.com/WOS_GeneralSearch_input.do?product=WOS&SID=2FiAssmf5r2aJDoAenh&search_mode=GeneralSearch)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 101 | [Scopus AI](https://lib.hit.edu.cn/2025/0905/c14819a377185/page.htm) | 入口适配，待验证 | [入口](http://www.scopus.com/)；已加 Scopus 实际 Check access 入口；AI 服务权限待验证 |
| 102 | [Scopus数据库](https://lib.hit.edu.cn/2025/0905/c14819a377184/page.htm) | 入口适配，待验证 | [入口](http://www.scopus.com/)；已加 Scopus 实际 Check access 入口；后续复用 Elsevier 组织选择，完整链路待验证 |
| 103 | [SIAM工业和应用数学学会](https://lib.hit.edu.cn/2022/0531/c14819a275575/page.htm) | 模板适配，未验证 | [入口](http://epubs.siam.org)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 104 | [SIAM电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277040/page.htm) | 模板适配，未验证 | [入口](https://epubs.siam.org/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 105 | [SPIE国际光学工程学会](https://lib.hit.edu.cn/2022/0531/c14819a275574/page.htm) | 访问失败 | [入口](https://www.spiedigitallibrary.org/journals)；网络请求超时；未完成机构选校验证 |
| 106 | [Springer LINK电子期刊](https://lib.hit.edu.cn/2022/0531/c14819a275572/page.htm) | 已验证入口 | [入口](https://link.springer.com/)；Springer WAYF 搜索、选中、提交后到达统一认证 |
| 107 | [Springer Materials数据库](https://lib.hit.edu.cn/2022/0531/c14819a275571/page.htm) | 共享适配 | [入口](https://link.springer.com/)；复用 Springer WAYF；Materials 链接/权限待验证 |
| 108 | [Springer RLoS 俄罗斯科学在线期刊](https://lib.hit.edu.cn/2022/0531/c14819a275570/page.htm) | 共享适配 | [入口](https://link.springer.com/)；复用 Springer WAYF；RLoS 权限待验证 |
| 109 | [Springer电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277051/page.htm) | 共享适配 | [入口](https://link.springer.com/)；复用 Springer WAYF；具体图书权限待验证 |
| 110 | [SSCI社会科学引文索引](https://lib.hit.edu.cn/2022/0531/c14819a275581/page.htm) | 待适配 | [入口](http://apps.webofknowledge.com/WOS_GeneralSearch_input.do?last_prod=WOS&SID=S2IAgPKG6KF9coGOHF9&product=WOS&highlighted_tab=WOS&search_mode=GeneralSearch)；共用 Clarivate；本次仅看到个人账号登录或应用壳，未确认可安全自动操作的机构选择控件 |
| 111 | [TAYLOR出版社电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277050/page.htm) | 待适配 | [入口](http://www.taylorfrancis.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 112 | [TAYLOR出版社电子期刊](https://lib.hit.edu.cn/2022/0531/c14819a275567/page.htm) | 模板适配，未验证 | [入口](http://www.tandfonline.com/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 113 | [Wiley 电子期刊](https://lib.hit.edu.cn/2022/0531/c14819a275605/page.htm) | 已验证入口 | [入口](http://onlinelibrary.wiley.com/)；Wiley 经用户完成人机验证后，搜索本校并到达统一认证 |
| 114 | [Wiley电子图书](https://lib.hit.edu.cn/2022/0609/c14819a277045/page.htm) | 共享适配 | [入口](http://onlinelibrary.wiley.com/browse/publications)；复用 Wiley 选校；具体图书权限待验证 |
| 115 | [Wiley电子教材](https://lib.hit.edu.cn/2022/0609/c14819a277044/page.htm) | 待适配 | [入口](http://www.itextbook.cn/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 116 | [易阅通电子书平台](https://lib.hit.edu.cn/2022/0609/c14819a277047/page.htm) | 待适配 | [入口](http://www.cnpereading.com/)；已读取公开入口；未确认可用的机构选校流程（可能为 IP、专属门户或个人账号登录），脚本暂不自动操作 |
| 117 | [英国土木工程师协会（ICE）期刊](https://lib.hit.edu.cn/2022/0531/c14819a275617/page.htm) | 模板适配，未验证 | [入口](http://www.icevirtuallibrary.com/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 118 | [英国土木工程师协会（ICE）电子书](https://lib.hit.edu.cn/2022/0609/c14819a277058/page.htm) | 模板适配，未验证 | [入口](http://www.icevirtuallibrary.com/)；已加入一键机构入口与 Atypon/Silverchair 控件规则；人机验证、HTTP 403 或未完成浏览器验证，不能确认实际选校成功 |
| 119 | [英国工程技术学会（IET）电子书](https://lib.hit.edu.cn/2022/0609/c14819a277052/page.htm) | 访问失败 | [入口](http://digital-library.theiet.org/)；HTTP 探测返回 403；未完成浏览器机构选校验证 |
