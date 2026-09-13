# Codefront 代码战场

在线体验：https://codefront-arena.hjkc20050804.chatgpt.site

Python 优先，兼容 JavaScript，支持单人训练与 2–4 人休闲联机。教程自主查阅。

## v0.4 当前实现

全宽原生编辑器，自动折行、字号、逻辑行列、Tab 缩进、导入导出及本机草稿。顶部提供带中文注释的只读 SDK。`scout(robot, world, memory)`、`guard`、`hauler` 分别控制机器人，`robot.follow` 支持独立路线和记忆，旧 `decide` 兼容。

训练和联机都先计算再播放。全员提交后锁定本轮代码，房主浏览器用独立 Worker 执行所有 Python/JS 程序，服务端校验动作、推进世界和保存日志。每人下载同一战报后暂停、0.25–4 倍速、拖动和重播；绘制按动画帧插值，不需要持续联网。房间阶段仍低频查询。

双人三局两胜、最多三轮；3–4 人三轮积分赛。单轮180秒模拟时间，轮换出生点、保留代码、清空记忆。采集后运回基地计分，核心20EP/格。首轮准备不限时，局间五分钟只是提醒，全员提交才开局。

## 文档和实现

当前设计为 `docx/06-编程工作台与独立战报设计`，当前实现及验收为 `docx/07-开发实现与验收手册`，均有 Markdown 和 DOCX。01–05 保留历史版本，其中实时热部署和旧同步操作已被06/07取代。

- `app/page.tsx`：编辑、提交、协调和手册。
- `public/sdk.py` / `sdk.js` 与两个 worker：接口和解释器入口。
- `lib/compute.ts`：各队独立执行、超时降级和批次生成。
- `lib/game.ts` / `replay.ts`：战斗、动作规范化和检查点。
- `lib/series.ts` / `app/api/rooms/route.ts`：赛程、鉴权、CAS和日志。
- `components/ReplayViewer.tsx` / `Arena.tsx`：播放器和Canvas动画。

## 本地运行

Node.js 24，`npm ci`、`npm run build`。首次本地数据库按顺序应用0000和0001；不要重复执行已经应用的SQL：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stormy_kinsey_walden.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_replay_chunks.sql
npm start
npm test
python -m unittest discover -s tests -p '*_test.py'
npx tsc --noEmit
```

`npm start` 验证构建Worker，`npm run dev` 开发。Windows包装器异常可直接调用安装目录的npm-cli.js。预构建复制锁定的Pyodide 0.27.7至忽略的public/python，随网站部署，不依赖第三方CDN。

浏览器测试需要Playwright和Chrome，可设PLAYWRIGHT_MODULE、TEST_URL，默认 http://127.0.0.1:8787。`scripts/browser-check.cjs` 验证编辑与训练；`full-match.cjs` 跑三人三轮和恢复；`performance-check.cjs` 测动画回调和断网播放。证据保存于忽略目录.qa。性能结果仅代表测试设备。

## 房间协议

同源POST /api/rooms：create(name)、join(code,name)、ready(ready,program={language,code})、timer(seconds)、rematch、sync。除create/join外需code/token，修改操作需当前match/round。计算者先claim(computeId,executor)，再batch(computeId,executor,start,frames,errors)，最多20组动作/批。replay(match,round)返回initial、900组动作、errors、final。

format=3，旧房间需重建。waiting → computing → intermission/finished。每组动作推进4个0.05秒物理步。revision防旧响应回滚；match/round/computeId/executor隔离旧请求及重复协调页面。D1事务在同一version条件下插入日志和更新房间，重复批次不重复推进。服务端不信任客户端分数、血量和世界快照。

## 边界和发布

源码提交后房间成员可见，勿放密钥。房主浏览器协调执行，不能证明合法动作来自某份源码，尚无可信服务器Python沙箱或排位。单次策略约1.2秒超时，加载45秒；出错队伍之后空闲，其余继续。计算60秒无进度退回准备；已完成战报刷新可恢复。

房间创建后一小时到期，原房间再赛仅能查询当前场次。无自动清理；过期房间、旧场次和中断批次需后续清理任务。下一步优先可信执行与数据清理，再扩地图和模式。

origin 为 https://github.com/hjkc111/codinggame.git，Sites remote保存相同提交。保留.openai/hosting.json中的Site身份和DB绑定。构建后打包Worker、静态资源及迁移，发布原公开站点。GitHub Actions验证测试和构建，push不会自动部署。分别记录本地、CI和真实公开网址验收。
