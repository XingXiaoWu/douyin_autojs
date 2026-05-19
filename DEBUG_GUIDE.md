# 抖音自动化脚本调试指南

---

## 1. 使用"布局范围分析"获取控件信息

AutoX 内置的**布局范围分析**可以实时查看当前页面的所有控件树，帮助你确认选择器是否正确。

### 操作步骤

1. 打开 AutoX 主界面 → 点击右上角 **"悬浮窗"** 图标开启悬浮球。
2. 打开抖音，滑动到**需要分析的页面**（如搜索页、评论区、视频播放页）。
3. 点击悬浮球 → 选择 **"布局范围分析"**（或"布局分析"）。
4. 窗口会以树形结构显示当前页面的控件层次，你可以：
   - 点击任意节点，右侧显示其属性：`desc`、`text`、`className`、`id`、`clickable`、`bounds` 等。
   - 上方的 **"分析"** 按钮可生成控件代码片段。
5. 根据分析结果，调整脚本中的选择器。

### 截图示意

```
┌──────────────────────────────┐
│  悬浮球                        │
│  ┌────┐  ┌────┐  ┌────────┐  │
│  │录制│  │布局│  │停止脚本│  │
│  └────┘  └────┘  └────────┘  │
├──────────────────────────────┤
│  布局分析 - 当前页面           │
│                               │
│  FrameLayout                  │
│  ├─ LinearLayout              │
│  │  ├─ ImageView desc="搜索"  │  ← 搜索图标的 desc 属性
│  │  │   clickable=true        │
│  │  │   bounds=[900,60][1020,180]
│  │  └─ ...                    │
│  ├─ RecyclerView              │
│  │  ├─ FrameLayout            │
│  │  │  └─ TextView desc="视频"│
│  │  └─ ...                    │
│  └─ EditText desc="写评论..." │  ← 评论输入框
│      className=EditText       │
└──────────────────────────────┘
```

> **提示**：抖音版本更新后控件属性可能变化，建议每次脚本运行前先用布局分析确认关键控件的 `desc` 或 `text` 值。

---

## 2. 选择器不匹配时的修改方法

当脚本找不到控件时，从布局分析中获取实际属性，然后按优先级替换选择器。

### 示例 1：找不到搜索图标

**原因**：抖音更新后 `desc("搜索")` 可能变为 `contentDescription` 为空，实际是 `ImageView` + 坐标定位。

**排查**：布局分析中查看搜索图标节点的 `desc`、`text`、`className`、`id`。

**修改方案**（在 `enterSearchFlow()` 中）：

```javascript
// 原选择器
var searchIcon = tryFind([desc("搜索")], 5000);

// 方案A：增加备选选择器
var searchIcon = tryFind([
    desc("搜索"),
    text("搜索"),
    descContains("search"),
    id("search_icon"),           // 从布局分析中查到的 id
    className("ImageView").desc("搜索")
], 5000);

// 方案B：直接使用布局分析中确认的相对坐标
// 从 bounds 属性计算坐标，如 bounds=[950,55][1050,155]
var cx = (950 + 1050) / 2;       // 控件中心 X
var cy = (55 + 155) / 2;         // 控件中心 Y
press(cx, cy, random(30, 80));
```

### 示例 2：找不到评论按钮

**原因**：评论区入口可能不是按钮，而是 `TextView` 或嵌套在 `LinearLayout` 中。

**排查**：在视频播放页打开布局分析，定位评论区入口（通常在右侧工具栏），查看其属性。

**修改方案**（在 `performComment()` 中）：

```javascript
// 原选择器
var commentBtn = tryFind([desc("评论"), text("评论")], 3000);

// 方案A：扩展选择器
var commentBtn = tryFind([
    desc("评论"),
    text("评论"),
    descContains("评论"),
    descContains("comment"),
    className("TextView").text("评论")
], 3000);

// 方案B：计算右侧评论区入口的绝对坐标
// 评论区入口通常在屏幕右下侧，坐标约为屏幕宽度的 85%，高度的 60%
var cx = sx(0.85);
var cy = sy(0.60);
press(cx, cy, random(30, 80));
```

### 示例 3：找不到发送按钮

**原因**：发送按钮可能是 `ImageView` 而非带文本的控件，`clickable(true)` 属性可能也不存在。

**排查**：在评论输入框弹出后打开布局分析，定位发送按钮节点。

**修改方案**（在 `performComment()` 中）：

```javascript
// 原选择器
var sendBtn = tryFind([text("发送").clickable(true)], 3000);

// 方案A：扩展选择器
var sendBtn = tryFind([
    text("发送").clickable(true),
    text("发送"),
    desc("发送"),
    descContains("send"),
    id("send_btn"),              // 从布局分析获取
    className("ImageView").desc("发送")
], 3000);

// 方案B：使用键盘回车键替代点击发送按钮
// 部分抖音版本输入评论后直接按回车即可发送
shell("input keyevent 66", true);

// 方案C：用坐标点击（从布局分析获取 bounds）
var b = {left: 950, top: 1800, right: 1050, bottom: 1920}; // 示例
var cx = (b.left + b.right) / 2;
var cy = (b.top + b.bottom) / 2;
press(cx, cy, random(30, 80));
```

---

## 3. 实时查看脚本日志

### 方式一：手机悬浮窗日志（推荐）

脚本中已开启 `console.show()`，运行后屏幕左上角会出现**半透明日志浮窗**，实时滚动显示带时间戳的执行信息：

```
[14:30:02] >>> 启动抖音
[14:30:07] >>> 抖音已启动
[14:30:07] [14:30:07] 查找搜索图标
[14:30:09] [14:30:09] 已点击搜索图标
[14:30:12] [14:30:12] >>> 第 1/20 次
...
```

- 浮窗可拖动、缩放，不影响脚本执行。
- 日志过多时可用 `console.clear()` 或调整 `console.setSize(w, h)`。

### 方式二：VSCode 远程输出

1. **PC 端**：VSCode 安装 **"Auto.js-VSCodeExt"** 插件。
2. **手机端**：AutoX 侧边栏 → **"连接电脑"** → 开启服务，记录显示的 IP 地址。
3. **VSCode**：`Cmd+Shift+P` → 输入 `Auto.js: Connect`，填入手机 IP 和端口（默认 9317）。
4. 连接成功后，在 VSCode 中运行脚本，`log()` 输出会同步显示在 VSCode 的 **输出面板**（选择 "Auto.js" 频道）。

### 方式三：保存日志到文件

在脚本开头加入以下代码，将所有输出持久化：

```javascript
// 将日志重定向到文件
var logFile = "/sdcard/douyin_bot_log.txt";
console.setTitle("douyin_bot");
events.on("console", function(msg) {
    files.append(logFile, new Date().toLocaleString() + " " + msg + "\n");
});
```

---

## 4. 常见运行错误及解决方法

### 错误 1：无障碍服务掉权限

**现象**：`auto()` 调用后无反应，或脚本中途停止，日志显示 `无障碍服务未开启`。

**原因**：Android 系统可能会杀死后台无障碍服务，尤其是国产 ROM 的省电策略。

**解决方法**：
- 进入 **系统设置 → 辅助功能 → 已安装的服务 → AutoX**，关闭后重新开启。
- 将 AutoX 加入系统**白名单/自启动列表**，关闭电池优化：
  - 设置 → 应用 → AutoX → 电池 → **不限制**。
- 在脚本 `auto()` 后增加循环检测：
  ```javascript
  auto();
  auto.waitFor();  // 等待无障碍服务就绪
  ```

### 错误 2：搜索键盘回车无效

**现象**：`shell("input keyevent 66", true)` 执行后搜索结果未出现。

**原因**：部分输入法或系统版本对 `input keyevent` 有限制；或者搜索框失去焦点。

**解决方法**：
- **方案A**：用点击搜索按钮替代回车键：
  ```javascript
  var searchBtn = tryFind([text("搜索"), desc("搜索"), descContains("search")], 3000);
  if (searchBtn !== null) {
      randomClick(searchBtn);
  } else {
      shell("input keyevent 66", true);
  }
  ```
- **方案B**：用 `performAction` 触发键盘搜索：
  ```javascript
  // 在输入框集合文本后
  searchInput.performAction(3); // ACTION_SEARCH
  ```

### 错误 3：滑动卡住/重复滑动同一视频

**现象**：循环中 `humanSwipe` 执行了但视频没有切换，或反复回到同一视频。

**原因**：滑动距离不够、抖音界面有其他弹窗遮挡、或视频列表已到底部。

**解决方法**：
- 增大滑动距离：将 `sy(0.8) → sy(0.2)` 改为 `sy(0.85) → sy(0.15)`。
- 增加滑动手势持续时间：将 `duration` 从 300 改为 400~500。
- 加入滑动前**检查是否有遮挡弹窗**：
  ```javascript
  var popup = tryFind([descContains("关闭"), text("我知道了")], 1000);
  if (popup !== null) {
      randomClick(popup);
      sleep(1000);
  }
  ```
- 滑动后检查视频是否确实变化（通过 desc 或 bounds 比对）。

---

## 5. 将脚本打包为独立 APK

1. 在手机 AutoX 主界面中，**长按** `douyin_bot.js` 文件。
2. 在弹出的菜单中选择 **"更多" → "生成安装包"**（或"打包应用"）。
3. 配置打包参数：
   - **应用名称**：如 `抖音助手`
   - **包名**：如 `com.example.douyinbot`（不可与现有应用重复）
   - **图标**：可选自定义图标
   - **版本号**：如 `1.0.0`
   - **权限**：默认勾选无障碍服务和悬浮窗权限
4. 点击 **"生成"**，等待编译完成（约 1~2 分钟）。
5. 生成的 APK 保存在 `/sdcard/AutoX/` 或 `/sdcard/脚本/` 目录下。
6. 将 APK 安装到手机，打开后即可**脱离 AutoX 独立运行**。

> **注意**：
> - 安装 APK 后需在系统设置中**手动开启该应用的无障碍权限和悬浮窗权限**。
> - 如果打包失败，检查 AutoX 是否为最新版本（设置 → 检查更新）。
> - 打包后的 APK 不会自动更新，每次修改脚本需重新打包。
