/**
 * dump_now.js — 当前页面元素全文快照
 * =====================================
 * 不导航、不点击。运行后立即打印当前屏幕所有可见控件信息。
 * 流程:
 *   1. 脚本启动抖音 → 搜索 → 打印搜索结果页
 *   2. 等待20秒让你手动点一个视频
 *   3. 打印视频播放页所有元素
 *   4. 等待20秒让你手动点评论区
 *   5. 打印评论区所有元素
 */
"use strict";
console.show();

var KEYWORD = "好物推荐";

function sx(r) { return Math.round(device.width  * r); }
function sy(r) { return Math.round(device.height * r); }

function header(t) {
    log("\n========================================");
    log("=  " + t);
    log("========================================");
}

function wait(sec, label) {
    if (label) log("  ⏳ " + sec + "s — " + label);
    else log("  ⏳ " + sec + "s");
    sleep(sec * 1000);
}

function dumpAll(label, maxCount) {
    maxCount = maxCount || 0;
    header(label);
    var printed = 0;
    try {
        var raw = classNameMatches(/.*/).find();
        if (raw && raw.size) {
            for (var i = 0; i < raw.size(); i++) {
                if (maxCount > 0 && printed >= maxCount) break;
                try {
                    var n  = raw.get(i);
                    var ds = n.desc()  || "";
                    var tx = n.text()  || "";
                    var cl = n.className().replace(/^android\.widget\./, "");
                    var ck = n.clickable();
                    var b  = n.bounds();
                    if (b.width() <= 0 || b.height() <= 0) continue;
                    if (b.top < -500 || b.top > device.height + 500) continue;
                    var pos = Math.round(b.centerX()) + "," + Math.round(b.centerY());
                    var rect = Math.round(b.left) + "," + Math.round(b.top) + "-" +
                               Math.round(b.right) + "," + Math.round(b.bottom);
                    if (tx.length > 40) tx = tx.substring(0, 40) + "...";
                    if (ds.length > 40) ds = ds.substring(0, 40) + "...";
                    // 用字符串拼接，避免 util.format 参数错位
                    log("  [" + cl + "] d=\"" + ds + "\" t=\"" + tx + "\" ck=" + ck + " pos=(" + pos + ") rect=" + rect);
                    printed++;
                } catch (e2) {}
            }
        }
    } catch (e) {
        log("  dump 异常: " + e);
    }
    log("  --- 共 " + printed + " 条 ---");
}

// ====================================================================
auto();
device.keepScreenOn();

// --- 1. 启动抖音 + 搜索 ---
header("启动抖音");
app.launchPackage("com.ss.android.ugc.aweme");
wait(8, "首页加载");

// 点击搜索图标
var si = desc("搜索").findOne(5000);
if (si !== null) { si.click(); log("已点搜索图标"); }
else { press(sx(0.93), sy(0.078), 80); log("坐标点搜索图标"); }
wait(3, "搜索页加载");

// 输入关键词 + 回车
var input = className("EditText").findOne(3000);
if (input !== null) {
    input.click(); wait(0.5);
    input.setText(KEYWORD); wait(0.5);
    shell("input keyevent 66", false);
    log("已输入 " + KEYWORD + " + 回车");
} else { log("EditText 未找到"); }
wait(4, "搜索结果加载");

// 点视频标签
try {
    var tabs = className("androidx.appcompat.app.ActionBar$Tab").find();
    for (var i = 0; i < tabs.size(); i++) {
        var t = tabs.get(i);
        try { if (t.findOne(text("视频")) !== null) { t.click(); log("已点视频标签"); break; } } catch(e){}
    }
} catch(e) {}
wait(3, "视频标签加载");

// --- 2. 打印搜索结果页 ---
dumpAll("页面 A: 搜索结果页（视频标签）", 300);

// --- 3. 等你手动点一个视频 ---
header("⏸ 请手动点击一个视频（20秒倒计时）");
wait(20, "手动点击视频");

// --- 4. 打印视频播放页 ---
dumpAll("页面 B: 视频播放页", 300);

// --- 5. 等你手动点评论区 ---
header("⏸ 请手动点击评论区入口（20秒倒计时）");
wait(20, "手动点评论区");

// --- 6. 打印评论区 ---
dumpAll("页面 C: 评论区", 300);

header("完成");
toast("快照完成，查看日志");
