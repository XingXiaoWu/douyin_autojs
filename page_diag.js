/**
 * page_diag.js — 抖音页面元素诊断 v5
 * ============================================================
 * 用 smartClick(先找元素→取坐标→press) 遍历关键页面。
 * 流程: 首页 → 搜索页 → 搜索结果 → 视频标签 → 视频播放页 → 评论区
 */
"use strict";
console.show();

var KEYWORD = "好物推荐";

function sx(r) { return Math.round(device.width  * r); }
function sy(r) { return Math.round(device.height * r); }

function header(t) { log("\n==== " + t + " ===="); }
function wait(sec, label) { log("  ⏳ " + sec + "s " + (label||"")); sleep(sec*1000); }

function smartClick(node) {
    if (node === null) return false;
    try {
        if (node.clickable()) {
            log("  smartClick: click() @ pos=" + Math.round(node.bounds().centerX()) + "," + Math.round(node.bounds().centerY()));
            node.click();
            return true;
        }
        var b = node.bounds();
        var cx = Math.round(b.centerX()), cy = Math.round(b.centerY());
        log("  smartClick: press(" + cx + "," + cy + ") clk=false");
        press(cx, cy, 60);
        return true;
    } catch(e) {
        try {
            var b2 = node.bounds();
            press(Math.round(b2.centerX()), Math.round(b2.centerY()), 60);
            return true;
        } catch(e2) { log("  smartClick 失败: " + e2); return false; }
    }
}

function findAndClick(sel, timeout) {
    var n = sel.findOne(timeout || 3000);
    return smartClick(n);
}

function findVideoTab() {
    try {
        var all = text("视频").find();
        log("  findVideoTab: " + all.size() + " 个 text=视频");
        for (var i = 0; i < all.size(); i++) {
            var p = all.get(i).parent();
            while (p !== null) {
                if (String(p.className()).indexOf("ActionBar$Tab") >= 0) {
                    log("  ✓ 向上遍历找到 ActionBar$Tab");
                    return p;
                }
                p = p.parent();
            }
        }
    } catch(e){ log("  findVideoTab 异常: " + e); }
    return null;
}

function findFirstVideoCard() {
    try {
        var all = clickable(true).find();
        for (var i = 0; i < all.size(); i++) {
            try {
                var el = all.get(i);
                var b = el.bounds();
                if (b.width() <= 0 || b.height() <= 0) continue;
                if (b.centerY() > sy(0.36) && b.centerY() < sy(0.54)
                 && b.centerX() > sx(0.05) && b.width() > sx(0.1)) {
                    log("  findFirstVideoCard: pos=(" + Math.round(b.centerX()) + "," + Math.round(b.centerY()) + ") sz=" + b.width() + "x" + b.height());
                    return el;
                }
            } catch(e){}
        }
    } catch(e){}
    return null;
}

function dumpKey(label, maxCount) {
    maxCount = maxCount || 40;
    header(label);
    var printed = 0;
    try {
        var raw = classNameMatches(/.*/).find();
        if (raw && raw.size) {
            for (var i = 0; i < raw.size(); i++) {
                if (printed >= maxCount) break;
                try {
                    var n  = raw.get(i);
                    var ds = n.desc()  || "";
                    var tx = n.text()  || "";
                    var cl = n.className().replace(/^android\.widget\./, "");
                    var ck = n.clickable();
                    var b  = n.bounds();
                    if (!ds && !tx && !ck) continue;
                    if (b.width() <= 0 || b.height() <= 0) continue;
                    var pos = Math.round(b.centerX()) + "," + Math.round(b.centerY());
                    var siz = Math.round(b.width()) + "x" + Math.round(b.height());
                    if (tx.length > 35) tx = tx.substring(0, 35) + "...";
                    if (ds.length > 35) ds = ds.substring(0, 35) + "...";
                    log("  [" + cl + "] d=\"" + ds + "\" t=\"" + tx + "\" ck=" + ck + " pos=(" + pos + ") sz=" + siz);
                    printed++;
                } catch(e2){}
            }
        }
    } catch(e) { log("  dump 异常: " + e); }
    log("  --- 共 " + printed + " 条 ---");
}

// ====================================================================
auto();
device.keepScreenOn();

header("设备: " + device.width + "x" + device.height + " SDK:" + device.sdkInt);
app.launchPackage("com.ss.android.ugc.aweme");
wait(3, "首页加载");

// === 页面 1: 首页 ===
dumpKey("页面 1: 首页", 40);

// === 搜索页 ===
header("点搜索图标");
findAndClick(desc("搜索"), 5000);
wait(3, "搜索页加载");
dumpKey("页面 2: 搜索页", 40);

// === 输入+搜索 ===
header("输入 " + KEYWORD);
var input = className("EditText").findOne(3000);
if (input !== null) {
    smartClick(input);
    wait(0.5);
    input.setText(KEYWORD);
    wait(0.3);
    // 点搜索按钮触发
    var searchBtn = desc("搜索").findOne(2000);
    smartClick(searchBtn);
    log("  已输入 + 点搜索按钮");
}
wait(4, "搜索加载");
dumpKey("页面 3: 搜索结果页（综合）", 60);

// === 视频标签 ===
header("点视频标签");
var vt = findVideoTab();
if (vt !== null) smartClick(vt);
wait(3, "视频标签加载");
dumpKey("页面 4: 视频结果页", 60);

// === 点第一个视频 ===
header("点第一个视频");
var fv = findFirstVideoCard();
if (fv !== null) smartClick(fv);
else { press(sx(0.25), sy(0.43), 80); log("  坐标降级"); }
wait(3, "视频加载");
press(sx(0.5), sy(0.17), 80); // 消半页
wait(2);
dumpKey("页面 5: 视频播放页", 60);

// === 检查评论/点赞 ===
header("检查右侧栏按钮");
var cb = descContains("评论").findOne(2000);
log("  descContains('评论'): " + (cb ? "✓ " + cb.desc() + " pos=(" + Math.round(cb.bounds().centerX()) + "," + Math.round(cb.bounds().centerY()) + ")" : "✗ 未找到"));
var lb = descContains("赞").findOne(1000) || desc("赞").findOne(1000);
log("  descContains('赞'): " + (lb ? "✓ " + lb.desc() + " pos=(" + Math.round(lb.bounds().centerX()) + "," + Math.round(lb.bounds().centerY()) + ")" : "✗ 未找到"));

// === 点评论 ===
if (cb !== null) {
    header("点评论入口");
    smartClick(cb);
    wait(2, "评论区弹出");
    dumpKey("页面 6: 评论区", 40);
}

header("诊断完成");
toast("诊断完成");
