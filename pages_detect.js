/**
 * pages_detect.js — 页面特征诊断
 * ============================================================
 * 你手动操作手机切换到不同页面，脚本打印该页面的所有关键元素。
 * 每切换到一个页面后等待 3 秒，脚本自动打印。
 *
 * 需要覆盖的页面：
 *   A. 首页 Feed 流
 *   B. 搜索页（点搜索图标后）
 *   C. 搜索结果页（搜索"好物推荐"，综合标签）
 *   D. 搜索结果页（视频标签）
 *   E. 视频播放页（从搜索结果点一个视频）
 *   F. 评论区
 *   G. 评论回复框（点评论文字）
 *   H. 用户主页（点头像）
 *   I. 设置弹窗（点 ···）
 *   J. 私信页（点发私信）
 *   K. 直播间页面
 */
"use strict";
console.show();

function sx(r) { return Math.round(device.width  * r); }
function sy(r) { return Math.round(device.height * r); }
function tlog(msg) { log(util.format("[%s] %s", new Date().toLocaleTimeString(), msg)); }
function wait(sec) { sleep(sec*1000); }

var pageNames = [
    "A. 首页 Feed 流",
    "B. 搜索页",
    "C. 搜索结果-综合标签",
    "D. 搜索结果-视频标签",
    "E. 视频播放页",
    "F. 评论区",
    "G. 评论回复框",
    "H. 用户主页",
    "I. 设置弹窗",
    "J. 私信页",
    "K. 直播间",
];

function dumpNow(label) {
    tlog("");
    tlog("╔══════════════════════════════════════╗");
    tlog("║  " + label);
    tlog("╚══════════════════════════════════════╝");
    var printed = 0;
    try {
        var all = classNameMatches(/.*/).find();
        for (var i = 0; i < all.size(); i++) {
            if (printed >= 60) break;
            try {
                var el  = all.get(i);
                var ds  = el.desc() || "";
                var tx  = el.text() || "";
                var cl  = String(el.className()).replace(/^android\.widget\./, "");
                var ck  = el.clickable();
                var sc  = el.scrollable();
                var b   = el.bounds();
                if (b.width() <= 20 || b.height() <= 10) continue;
                if (!ds && !tx) continue;
                if (tx.length > 50) tx = tx.substring(0,50) + "...";
                if (ds.length > 50) ds = ds.substring(0,50) + "...";
                var rc  = Math.round(b.left) + "," + Math.round(b.top) + "-" + Math.round(b.right) + "," + Math.round(b.bottom);
                log(util.format("  [%s] d='%s' t='%s' ck=%s sc=%s rc=%s", cl, ds, tx, ck, sc, rc));
                printed++;
            } catch(e2){}
        }
    } catch(e) { tlog("  dump异常: " + e); }
    tlog("  --- " + printed + " 条 ---");
}

auto();
device.keepScreenOn();

tlog("=== 页面特征诊断 ===");
tlog("分辨率: " + device.width + "x" + device.height);
tlog("SDK: " + device.sdkInt);
tlog("");
tlog("请手动操作手机切换到以下页面，");
tlog("切换完成后等待 3 秒观察日志输出。");
tlog("=====================================");

for (var pi = 0; pi < pageNames.length; pi++) {
    tlog("");
    tlog("▶  请切换到: " + pageNames[pi]);
    tlog("   切换好后等待 5 秒...");
    wait(5);
    dumpNow(pageNames[pi]);

    if (pi < pageNames.length - 1) {
        tlog("   继续下一个页面 (5秒)...");
        wait(5);
    }
}

tlog("");
tlog("=== 全部页面诊断完成 ===");
tlog("请将以上日志粘贴给我");
toast("诊断完成");
