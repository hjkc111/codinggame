# Codefront 代码战场

在线体验：https://codefront-arena.hjkc20050804.chatgpt.site

Python 优先的网页编程游戏，支持真实 Python / JavaScript、单人训练和 2–4 人云端休闲房间。教学按需查阅，没有强制通关。

## 文档

完整设计、实现计划、开发状态位于 `docx/`。每份同时提供 `.md` 原稿和 `.docx` 正式文档。使用 `python scripts/create-docs.py` 重新生成；需要 python-docx。更新后应渲染检查排版。

## 当前实现

- 三角色：Scout、Guard、Hauler；移动、采集、攻击、卸货、死亡、重生。
- 双人最多三局、先赢两局；3–4 人三轮积分赛。全员准备开战，首轮不限时，局间五分钟仅提醒。
- 每轮轮换出生位置、保留代码，展示采集/交付/死亡及累计积分；整场结束可原房间再赛。
- 单轮 180 秒，能源交付计分；核心价值 20，每次采完 35 秒后刷新。
- 原生 Python 语法在 Pyodide 0.27.7 的独立 Worker 中运行；JS 也使用 Worker。
- 运行、热部署、暂停、重置、2 倍训练、代码导出、按语言保存本机草稿。
- D1 存储房间，随机席位凭证摘要、乐观锁、动作序号、云端状态校验。
- 约 400ms 请求同步，Canvas 连续插值显示；无强制教程。

## 明确边界

这是朋友间的休闲版本：代码运行在客户端，云端校验动作并结算，但不能证明动作来自某份源代码。没有服务器 Python 沙箱、排位、战争迷雾、团队模式、8 人、完整回放。离线保留最后动作，Python 不会继续决策。D1 房间在创建一小时后过期；没有清理任务，生产运维应定期清理过期记录。

## 本地运行

要求 Node.js 24（或符合 engines 的版本）。

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stormy_kinsey_walden.sql
npm run dev
```

只在首次创建本地数据库时执行初始迁移。后续按顺序执行尚未应用的迁移；不要重跑已应用 SQL。开发服务器地址以终端输出为准。`npm start` 可验证构建 Worker。Windows 包装器异常时可用 `node <本机 npm 安装目录>/bin/npm-cli.js run dev`。

`prebuild` / `predev` 自动把已锁定 npm 包里的 Python 运行时复制到忽略的 `public/python/`，部署随站点打包；用户运行时不依赖第三方 CDN。复制文件体积约十余 MB，首次加载会比后续缓存加载慢。遵循 npm 包附带许可证。

## 测试

```sh
npm test
npx tsc --noEmit
npm run build
```

浏览器验收脚本 `scripts/browser-check.cjs` 需要 Playwright 和 Chrome。可以通过 `PLAYWRIGHT_MODULE` 指定已安装模块位置，`TEST_URL` 指定部署或本地网址，默认 http://localhost:5173。测试截图及结果写入忽略目录 `.qa/`。脚本验证 Python 实际执行、修改行为、超时恢复、暂停、手机布局、三客户端房间、房主授权和禁止中途加入。

```sh
node scripts/browser-check.cjs
# 完整三轮 UI 联机验收，约 10 分钟
node scripts/full-match.cjs
```

## 编程入口

```python
def decide(observation, memory):
    actions = {}
    for r in observation['robots']:
        actions[r['id']] = {'type': 'move', 'x': 480, 'y': 320}
    return actions, memory
```

`observation` 包含 robots、enemies、resources、base、scores、time、tick。详见网页内的手册和 `lib/game.ts`。每次决策串行执行，约 250ms 间隔；1.2 秒执行超时后销毁 Worker。初始化另有 45 秒上限。热部署先用当前观察进行验证，成功后切换；失败保留旧版本。当前热部署重置 memory。

## 房间 API

同源 `POST /api/rooms`，JSON 请求：

| op | 参数 | 结果 |
|---|---|---|
| create | name | code、token、playerId、房间快照 |
| join | code、name | 新席位和快照 |
| ready | code、token、match、round、ready | 全员准备后 3 秒开战；false 取消 |
| timer | code、token、match、round、seconds | 房主提醒：0 不限时、600 十分钟、120 延长两分钟 |
| rematch | code、token、match、round | 房主在整场结束后重开 |
| sync | code、token、match、round、seq、actions | 推进世界并返回最新快照 |

token 只交给该席位，不存日志或 Git；其他玩家只看到昵称和 ID。客户端 seq 必须递增，match / round 隔离旧轮指令。响应 revision 单调比较，防止旧快照回滚界面。lib/series.ts 定义状态机，tests/series.test.ts 注入时间验证边界。每个房间数据库更新使用 version 比较，冲突最多重试六次。云端不接受客户端给出的分数、血量或世界快照。

## 发布与仓库关联

GitHub `origin`: https://github.com/hjkc111/codinggame.git 。Sites 的发布源使用另一个 remote，保存完全相同的提交。`.openai/hosting.json` 保存 Site 身份及 D1 逻辑绑定，请保留它。

遵循 Sites 发布流程：构建、GitHub/Sites 双推送、读取完整 HEAD、打包 Worker 与静态资源及迁移、保存版本、部署、等待终态。不要只上传 public 目录。GitHub Actions 仅执行验证；GitHub push 不会自动发布 Sites。

站点访问范围按用户授权设置为公开链接。源代码与技术限制公开在仓库；席位令牌、临时发布凭证、QA 中的测试会话不进仓库。线上验收和本地测试结果分别记录。

## 后续开发顺序

先评估在线同步延迟和房间负载，再建设服务端 Python 隔离执行与专用房间调度；之后增加持久回放、团队和 8 人模式、迷雾与多地图。多轮规则与本次优化验收详见 `docx/04-多轮赛制与优化计划.docx`，当前状态见 03；01、02 保留为首版历史设计。
