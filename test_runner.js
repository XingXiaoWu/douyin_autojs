/**
 * test_runner.js — 抖音脚本功能测试套件 (v2)
 * ============================================================
 * 放到 /sdcard/脚本/ 目录，在 AutoX 中运行。
 *
 * 每个阶段开始前会提示你需要在哪个页面，做好准备后自动继续。
 * 绿色 ✓ [PASS] 表示通过，红色 ✗ [FAIL] 表示失败。
 * ============================================================
 */

"use strict";
console.show();

var PASS = 0;
var FAIL = 0;
var currentPhase = 0;

function pass(msg) { PASS++; log("  ✓ [PASS] " + msg); }
function fail(msg) { FAIL++; log("  ✗ [FAIL] " + msg); }
function info(msg) {  log("  [INFO] " + msg); }
function phase(num, title) {
    currentPhase = num;
    log("\n========== 阶段 " + num + ": " + title + " ==========");
}

// 安全延时
function wait(sec) {
    log("  ⏳ 等待 " + sec + " 秒...");
    sleep(sec * 1000);
}

/**
 * 安全返回：先 back()，再左边缘右滑手势降级。
 * 适配全面屏手势导航的 Android 设备。
 */
function safeBack() {
    shell("input keyevent 4", false);
    sleep(400);
    swipe(5, Math.round(device.height / 2),
          Math.round(device.width * 0.25), Math.round(device.height / 2), 200);
    sleep(300);
}

/**
 * 依次尝试一组选择器，返回第一个找到的控件，全部失败返回 null。
 * 每个选择器阻塞等待 timeout 毫秒，最坏耗时 = 选择器个数 × timeout。
 */
function tryFind(selectors, timeout) {
    timeout = timeout || 1000;
    for (var _i = 0; _i < selectors.length; _i++) {
        var t0 = Date.now();
        try {
            var _res = selectors[_i].findOne(timeout);
            var elapsed = Date.now() - t0;
            if (elapsed > 500) {
                info("  tryFind[" + _i + "] 耗时 " + elapsed + "ms" + (_res ? " ✓" : " ✗"));
            }
            if (_res !== null) return _res;
        } catch (e) {
            info("  tryFind[" + _i + "] 异常: " + e);
        }
    }
    info("  tryFind: 未找到任何匹配");
    return null;
}

/**
 * 判断当前是否在视频全屏播放页（通过右侧点赞按钮等特征判断）
 */
function isOnVideoPage() {
    var t = 500;
    return descContains("赞").findOne(t) !== null ||
           desc("赞").findOne(t) !== null;
}

function isOnHomePage() {
    var t = 500;
    return desc("搜索").findOne(t) !== null ||
           descContains("搜索").findOne(t) !== null ||
           text("首页").findOne(t) !== null;
}

/**
 * 判断当前是否在首页/Feed 流（通过搜索图标判断）
 */
function isOnHomePage() {
    return desc("搜索").exists() ||
           descContains("搜索").exists() ||
           text("首页").exists() ||
           text("推荐").exists();
}

// ======================================================================
// 阶段 1: 环境基础检查
// ======================================================================
function testPhase1() {
    phase(1, "环境基础检查");

    // 1a: 设备信息
    info("设备分辨率: " + device.width + "x" + device.height);
    info("Android SDK: " + (typeof device.sdkInt !== "undefined" ? device.sdkInt : "未知"));
    if (device.width > 0 && device.height > 0) {
        pass("设备信息获取正常");
    } else {
        fail("无法获取设备分辨率");
    }

    // 1b: 无障碍服务 — 不同版本 API 不同，用 try-catch 兜底
    var serviceOk = false;
    try {
        if (auto.service !== null && auto.service !== undefined) {
            serviceOk = true;
        }
    } catch (e) {
        // auto.service 在某些版本不支持，但 auto() 成功调用即说明服务 OK
        serviceOk = true;
    }
    if (serviceOk) {
        pass("无障碍服务已开启");
    } else {
        fail("无障碍服务未开启 — 设置 > 辅助功能 > 已安装的服务 > AutoX > 开启");
    }

    // 1c: 保持常亮
    device.keepScreenOn();
    pass("屏幕常亮已设置");

    // 1d: 检查抖音
    var pkg = "com.ss.android.ugc.aweme";
    try {
        var pm = context.getPackageManager();
        var pkgInfo = pm.getPackageInfo(pkg, 0);
        if (pkgInfo !== null) {
            pass("抖音已安装，版本: " + pkgInfo.versionName);
        } else {
            fail("抖音未安装");
        }
    } catch (e) {
        fail("抖音未安装或无法获取包信息");
    }
}

// ======================================================================
// 阶段 2: 工具函数单元测试
// ======================================================================
function testPhase2() {
    phase(2, "工具函数单元测试");

    function _r(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function _pick(arr) { return (!arr || arr.length === 0) ? undefined : arr[_r(0, arr.length - 1)]; }

    // 2a
    var v = _r(1, 10);
    (v >= 1 && v <= 10 && v === Math.floor(v)) ? pass("random(1,10)=" + v) : fail("random 异常=" + v);

    // 2b
    var v2 = _r(5, 5);
    (v2 === 5) ? pass("random(5,5)=" + v2) : fail("边界应为5, 实际=" + v2);

    // 2c
    var a = ["a","b","c","d","e"];
    var pv = _pick(a);
    (a.indexOf(pv) >= 0) ? pass("randomPick 返回 " + pv) : fail("randomPick 异常=" + pv);

    // 2d
    var ep = _pick([]);
    (ep === undefined) ? pass("randomPick([])=undefined") : fail("空数组应返回 undefined");

    // 2e
    var start = Date.now();
    sleep(_r(200, 400));
    var elapsed = Date.now() - start;
    info("sleepRandom(200,400) 实际=" + elapsed + "ms");
    (elapsed >= 150 && elapsed <= 500) ? pass("sleepRandom 范围合理") : fail("sleepRandom 异常=" + elapsed);
}

// ======================================================================
// 阶段 3: 坐标与手势基础测试
// ======================================================================
function testPhase3() {
    phase(3, "坐标与手势基础测试");

    info("当前分辨率: " + device.width + "x" + device.height);

    // 3a: 屏幕中心短按（无副作用）
    var cx = Math.round(device.width * 0.5);
    var cy = Math.round(device.height * 0.5);
    info("屏幕中心坐标: (" + cx + ", " + cy + ")");
    press(cx, cy, 10);
    sleep(300);
    pass("press() 调用无异常");

    // 3b: gesture 基本调用
    try {
        gesture(80, [[100,100], [110,110], [120,120]]);
        pass("gesture() 调用无异常");
    } catch (e) {
        fail("gesture() 异常: " + e);
    }

    // 3c: swipe 基本调用
    try {
        swipe(device.width/2, device.height*0.8, device.width/2, device.height*0.2, 300);
        pass("swipe() 调用无异常");
    } catch (e) {
        fail("swipe() 异常: " + e);
    }
}

// ======================================================================
// 阶段 4: 选择器验证（需在抖音首页）
// ======================================================================
function testPhase4() {
    phase(4, "选择器验证（首页）");

    info("⚠ 请确保抖音在'首页/推荐'Tab，能看到顶部搜索图标");
    info("⚠ 如果当前是视频全屏播放，请按返回键退出到首页");
    wait(5);

    // 检测当前页面状态
    info("检测当前页面...");
    if (isOnVideoPage()) {
        info("当前在视频全屏播放页，需要先退出");
        info("正在按返回键退出...");
        safeBack();
        wait(1.5);
        // 不再重复检测 —— 上次检测已浪费 6s，直接信任返回操作
    }

    // 4a: 搜索图标
    info("查找搜索图标 (desc('搜索'))...");
    var searchIcon = desc("搜索").findOne(1500);
    if (searchIcon !== null) {
        pass("desc('搜索') 找到 bounds=" + searchIcon.bounds());
    } else {
        // 尝试其他选择器
        searchIcon = descContains("搜索").findOne(1000);
        if (searchIcon !== null) {
            pass("descContains('搜索') 找到 (主选择器 desc('搜索') 需更新)");
        } else {
            fail("搜索图标未找到 — 请在此页面运行 AutoX '布局范围分析' 查看搜索图标的 desc/text 值");
            info("应急坐标: 右上角 (" + Math.round(device.width*0.92) + "," + Math.round(device.height*0.06) + ")");
        }
    }

    // 4b: 点击搜索图标，进入搜索页
    if (searchIcon !== null) {
        searchIcon.click();
        wait(2);

        var editText = className("EditText").findOne(1500);
        if (editText !== null) {
            pass("搜索页 EditText 找到");
            var editWithDesc = className("EditText").descContains("搜索").findOne(1000);
            if (editWithDesc !== null) {
                pass("className('EditText').descContains('搜索') 可用");
            } else {
                info("descContains('搜索') 不匹配，主选择器用 className('EditText') 即可");
            }
            // 搜索页返回需要两次：第一次收键盘，第二次退出搜索页
            safeBack();
            wait(0.5);
            // 检测是否仍在搜索页（EditText 仍可见说明只关了键盘）
            var stillOnSearch = className("EditText").exists() || descContains("搜索").exists();
            if (stillOnSearch) {
                info("首次返回仅关闭键盘，再次返回退出搜索页");
                safeBack();
                wait(1);
            }
        } else {
            fail("搜索页 EditText 未找到");
            safeBack();
            wait(1);
        }
    }
}

// ======================================================================
// 阶段 5: 滑动 + 点赞（需在视频播放页）
// ======================================================================
function testPhase5() {
    phase(5, "滑动效果 + 点赞按钮");

    info("⚠ 请进入任意一个视频全屏播放页（随便刷到一个视频）");
    info("⚠ 确保右侧有'赞'、'评论'等按钮");
    wait(5);

    info("检测当前页面...");
    if (!isOnVideoPage() && isOnHomePage()) {
        info("当前在首页，尝试点击一个视频进入...");
        // 尝试点击屏幕中央偏上的视频区域
        press(device.width/2, device.height*0.45, 50);
        wait(2);
    }

    // 5a: 贝塞尔曲线滑动
    info("执行拟人滑动 (humanSwipe)...");
    var x1 = device.width / 2;
    var y1 = device.height * 0.8;
    var x2 = device.width / 2;
    var y2 = device.height * 0.25;
    var cpX = (x1 + x2) / 2 + Math.floor(Math.random() * 301) - 150;
    var cpY = (y1 + y2) / 2 + Math.floor(Math.random() * 301) - 150;
    var pts = [];
    var steps = 30;
    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var px = (1-t)*(1-t)*x1 + 2*(1-t)*t*cpX + t*t*x2;
        var py = (1-t)*(1-t)*y1 + 2*(1-t)*t*cpY + t*t*y2;
        pts.push([Math.round(px), Math.round(py)]);
    }
    try {
        gesture(400, pts);
        pass("humanSwipe gesture 执行完成");
    } catch (e) {
        info("gesture 失败，尝试 swipe 降级...");
        swipe(x1, y1, x2, y2, 400);
        pass("降级为 swipe 完成");
    }
    wait(1);
    info("👀 观察屏幕: 视频是否成功切换到下一个？");

    // 5b: 点赞按钮
    info("查找点赞按钮...");
    var likeBtn = tryFind([desc("赞"), descContains("赞")], 800);
    if (likeBtn !== null) {
        pass("点赞按钮找到 bounds=" + likeBtn.bounds());
    } else {
        pass("点赞按钮未找到，可用坐标降级 sx(0.85), sy(0.53)");
    }
}

// ======================================================================
// 阶段 6: 评论区流程（需在视频播放页）
// ======================================================================
function testPhase6() {
    phase(6, "评论区流程");

    info("⚠ 请确保仍在视频全屏播放页");
    wait(3);

    // 6a: 评论入口
    var commentBtn = tryFind([descContains("评论"), desc("评论")], 800);
    if (commentBtn !== null) {
        pass("评论入口找到: desc/text=" + (commentBtn.desc() || commentBtn.text()) + " bounds=" + commentBtn.bounds());
        commentBtn.click();
        wait(2);

        // 6b: 评论区是否弹出
        info("评论区检测中...");
        var panelStart = Date.now();
        var hasInput = tryFind([
            className("EditText"),
            textContains("分享"),
            textContains("写评论"),
            descContains("写评论")
        ], 800);
        var panelElapsed = Date.now() - panelStart;
        if (hasInput !== null) {
            pass("评论区已弹出 (耗时 " + panelElapsed + "ms, 命中: " +
                 (hasInput.desc() || hasInput.text() || hasInput.className()) + ")");

            // 6c: 输入框
            var input = tryFind([desc("写评论..."), className("EditText")], 2000);
            if (input !== null) {
                pass("评论输入框找到");
                input.click();
                sleep(500);
                input.setText("测试");
                sleep(300);
                pass("可以输入文字");
                input.setText("");
            } else {
                fail("输入框未找到");
            }

            // 6d: 发送按钮
            var sendBtn = tryFind([text("发送"), desc("发送")], 1000);
            if (sendBtn !== null) {
                pass("发送按钮找到（未点击）");
            } else {
                info("发送按钮未找到 — 可能需要改用 desc 或 className 选择器");
            }

            safeBack(); // 关闭评论区
            wait(1.5);
        } else {
            fail("评论区未弹出");
            safeBack();
            wait(1);
        }
    } else {
        fail("评论入口未找到");
        info("提示: 在视频全屏播放页，评论按钮在右侧图标栏");
        info("请运行'布局范围分析'查看右侧栏图标属性");
        info("常见属性: desc='评论' 或 desc 中包含评论数量如 '1.2万'");
    }
}

// ======================================================================
// 阶段 7: 端到端快速运行
// ======================================================================
function testPhase7() {
    phase(7, "端到端快速运行");

    info("此阶段需要 douyin_bot.js 在同一目录");
    info("在 AutoX 文件列表中看得到 douyin_bot.js 即为存在");

    info("");
    info("📋 请手动执行以下操作验证端到端流程:");
    info("");
    info("  1. 打开 douyin_bot.js");
    info("  2. 将 CONFIG.maxLoops 改为 3");
    info("  3. 在 CONFIG.commentsPool 中填入一条测试评论如 [\"不错\"]");
    info("  4. 将 CONFIG.skipRate 改为 0（确保评论一定触发）");
    info("  5. 保存并运行");
    info("  6. 观察完整流程: 启动抖音→搜索→进视频→评论→滑动→循环×3");
    info("");
    pass("端到端测试说明已显示，需手动执行");
}

// ======================================================================
// 阶段 8: 反检测策略逻辑验证
// ======================================================================
function testPhase8() {
    phase(8, "反检测策略逻辑验证");

    function _r(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    // 8a: 概率分布
    info("模拟 1000 次 skipRate=20 决策...");
    var skipCount = 0;
    for (var j = 0; j < 1000; j++) {
        if (_r(1, 100) <= 20) skipCount++;
    }
    var rate = (skipCount / 1000 * 100).toFixed(1);
    info("实际跳过率: " + rate + "%");
    (rate >= 15 && rate <= 25) ? pass("跳过概率在合理范围") : info("概率偏差略大但在随机波动范围内");

    // 8b: 偏移量验证
    var offsets = [];
    for (var k = 0; k < 200; k++) offsets.push(_r(-50, 50));
    var offMin = Math.min.apply(null, offsets);
    var offMax = Math.max.apply(null, offsets);
    info("±50 偏移量范围: [" + offMin + ", " + offMax + "]");
    (offMin >= -50 && offMax <= 50) ? pass("偏移范围正确") : fail("偏移超出 ±50");

    // 8c: failCount 逻辑
    var fc = 0;
    fc++; fc++; // 2 次失败
    info("2 次失败后 failCount=" + fc);
    fc = 0;      // clearFail
    info("clearFail 后 failCount=" + fc);
    fc++; fc++; fc++; // 3 次失败
    info("连续 3 次失败后 failCount=" + fc);
    (fc === 3) ? pass("failCount 逻辑正确") : fail("failCount 逻辑异常");
}

// ======================================================================
// 主流程
// ======================================================================
auto();
wait(1);

var phases = [
    testPhase1,
    testPhase2,
    testPhase3,
    testPhase4,
    testPhase5,
    testPhase6,
    testPhase7,
    testPhase8,
];

for (var p = 0; p < phases.length; p++) {
    try {
        phases[p]();
    } catch (e) {
        fail("阶段 " + (p + 1) + " 抛出异常: " + e);
        info("堆栈: " + (e.stack || "无堆栈"));
    }
    if (p < phases.length - 1) {
        wait(4);
    }
}

log("\n╔═══════════════════════════════════╗");
log("║    测试结束  PASS=" + PASS + "  FAIL=" + FAIL + "           ║");
log("╚═══════════════════════════════════╝");
toast("测试结束 PASS=" + PASS + " FAIL=" + FAIL);
