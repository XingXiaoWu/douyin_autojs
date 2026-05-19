# AGENTS.md

## Project overview

AutoX.js automation scripts for Douyin (TikTok China). Runs **on Android via AutoX.js**, not Node.js. No package.json, no npm, no build/lint/test commands.

## Project progress (2026-05-14)

### Done ✓

| Module | File | Status |
|---|---|---|
| 页面识别 | `page_detect.js` | 完成 — 识别 11 种页面（首页/搜索/结果/视频/评论/回复/主页/设置/私信/直播/未知），800ms 超时 |
| JSON 持久化 | `store.js` | 完成 — `/sdcard/douyin_bot/data/*.json`，已私信用户/已处理视频/断点续跑 |
| 评论区扫描 | `scan_comments.js` | 完成 — 滑动评论、关键字匹配、展开子回复、到达底部检测 |
| 评论区→私信 | `action_comments.js` | 完成 — 搜索→评论→回复→主页→设置→私信，支持多视频循环、用户去重 |
| 浏览+评论 | `douyin_bot.js` | 完成 — 搜索→视频→浏览→评论→滑动，反检测策略 |
| 工具函数 | `utils.js` | 完成 — safeBack, smartClick, humanType, tryFind 等 |
| 诊断脚本 | `page_detect_test.js`, `pages_detect.js`, `dump_now.js` | 完成 — 页面元素打印、识别验证 |

### 关键组件

| 组件 | 位置 | 用途 |
|---|---|---|
| `smartClick(node)` | `douyin_bot.js`, `action_comments.js` | `clk=true` → `.click()`；`clk=false` → 取坐标 `press()` |
| `humanType(node, text)` | `action_comments.js`, `douyin_bot.js` | 逐字输入，每字 80~280ms |
| `findVideoTab()` | `douyin_bot.js`, `action_comments.js` | 遍历 `text("视频")` → `parent` → 找 `ActionBar$Tab` 祖先 |
| `findFirstVideoCard()` | `douyin_bot.js`, `action_comments.js` | 过滤 RecyclerView 幽灵元素，找 Y `0.36~0.54` 的 clickable 控件 |

### 待实现

| 优先级 | 模块 | 说明 |
|---|---|---|
| P0 | 容错恢复 `recovery.js` | 卡死检测、自动重启、断点续跑、网络超时重试 |
| P1 | 模块化重构 | 现有代码分散在多个文件，需统一到 `modules/` 目录 |
| P1 | 页面导航 `navigate.js` | 根据当前页面和目标页面自动跳转 |
| P2 | APK 打包 | 配置 UI、热更新 |
| P2 | 直播间处理 | 自动识别直播间并跳过/退出 |
| P2 | 配置 UI | 手机端可视化修改 CONFIG |

## File structure

| File | Role |
|---|---|
| `douyin_bot.js` | 独立入口 — 浏览视频+评论+反检测 |
| `action_comments.js` | 评论区→私信 流程 |
| `scan_comments.js` | 评论区关键字扫描 |
| `page_detect.js` | 页面识别模块（11 种页面） |
| `store.js` | JSON 持久化存储模块 |
| `page_detect_test.js` | 页面识别测试脚本 |
| `pages_detect.js` | 页面元素诊断（一次性导出全部页面元素） |
| `dump_now.js` | 当前页面完整元素快照 |
| `utils.js` | 工具函数模块 |
| `comment.js` | 评论模块 |
| `main.js` | 旧版入口（依赖 utils.js + comment.js） |
| `DEBUG_GUIDE.md` | 调试指南 |
| `AGENTS.md` | 本文档 |

## Key AutoX.js API facts

- `require()` paths are relative to the **running script's directory**.
- `sleep(ms)` is blocking. No async/await — AutoX v7 Rhino engine doesn't support it.
- Selectors are chainable: `desc("搜索").clickable(true).findOne(timeout)`.
- `findOne(timeout)` returns `null` on failure, never throws for timeout.
- `setScreenMetrics(1080, 2400)` scales hardcoded coordinates.
- Coordinate functions (`press`, `gesture`, `swipe`) expect **absolute pixels**.

## Slip-ups an agent might make

1. **Not a Node project** — `require()` here is AutoX's module loader, not Node's CommonJS.
2. **`humanSwipe` uses quadratic (not cubic) Bezier**: `(1-t)²·P0 + 2(1-t)t·P1 + t²·P2`.
3. **`randomClick` returns `false` on null node**, doesn't throw.
4. **Every `tryFind` call is a blocking `findOne`** per selector.
5. **`isPageLoaded` uses `textContains()`**, not exact match.
6. **Anti-detect state is global mutable**.
7. **`CONFIG.commentsPool` must be non-empty** for `performComment` to work.
8. **Selectors break across Douyin versions** — use layout analysis first.
9. **AutoX v7 `findOne` timeout ≈ 2x the stated value** — actual blocking time is ~1.5-2x longer.
10. **Right-sidebar button bounds may return negative Y** → `randomClick` taps off-screen.
11. **`async/await` not supported** on AutoX v7.
12. **`randomClick` uses `press()` not `click()`** — UI elements needing accessibility action must use `node.click()`.
13. **`smartClick` handles both**: `clk=true` → `.click()`; `clk=false` → `press(centerX, centerY)`.
14. **RecyclerView `find()` returns ghost elements** with invalid bounds (width≤0, negative). Filter: `b.width()>0 && b.height()>0`.
15. **`ActionBar$Tab` 的 child `Button` 有 `clk=false`** — 必须通过 `parent()` 找父节点或直接用坐标。
16. **`press()` on `ActionBar$Tab` 无效** — 必须用 `.click()` 触发标签切换。
17. **搜索触发不能用回车键** — Douyin 自定义输入法拦截 `keyevent 66`。需点搜索按钮坐标。

## Page detect architecture

`page_detect.js` 按"具体→笼统"层级检测，每项超时 800ms：

```
私信页（3态）→ 设置弹窗 → 用户主页 → 评论回复框 → 评论区
→ 直播间 → 视频半页 → 视频播放页 → 搜索结果页 → 搜索着陆页 → 首页Feed → 未知
```

## When editing selectors

Run AutoX's **布局范围分析** on the target page, note actual `desc`/`text`/`className` values, update arrays. Add fallbacks — never remove originals unless confirmed dead.

## Testing

1. Push `.js` to `/sdcard/脚本/`
2. Run in AutoX with `console.show()` active
3. Watch floating log window
4. Use `page_detect_test.js` for page identification verification
