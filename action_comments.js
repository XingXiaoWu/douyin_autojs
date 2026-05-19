/**
 * action_comments.js — 评论区匹配→进主页→发私信
 * ============================================================
 * 1. 滑动评论区，匹配关键字
 * 2. 命中后点击用户头像 → 进入用户主页
 * 3. 打印主页元素 → 点右上角"···" → 打印弹窗元素 → 点"发私信"
 * 4. back()×3 回到评论区，继续滑，已访问用户不再重复
 */

var PD = require("./page_detect.js");
var REC = require("./recovery.js");
REC.init(PD);
var PAGE = PD.PAGE;

var visitedUsers = {};

var CONFIG = {
    keyword:    "长沙旅游",
    keywords:   ["搭子", "组团", "地陪", "找人"],
    maxScrolls:  10,
    maxActionsPerVideo: 3,
    maxVideos:   3,
    scrollPx:    600,
    loadWaitMs:  2000,
};

function sx(r) { return Math.round(device.width  * r); }
function sy(r) { return Math.round(device.height * r); }
function tlog(msg) { log(util.format("[%s] %s", new Date().toLocaleTimeString(), msg)); }
function wait(sec) { sleep(sec*1000); }

/**
 * 逐字输入，模拟人类打字，每字间隔 80~280ms
 */
function humanType(node, text) {
    if (!node) return;
    var typed = "";
    for (var i = 0; i < text.length; i++) {
        typed += text.charAt(i);
        node.setText(typed);
        sleep(80 + Math.floor(Math.random() * 200));
    }
}

function smartClick(node) {
    if (!node) return false;
    try { if (node.clickable()) { node.click(); return true; } } catch(e){}
    try { var b = node.bounds(); press(Math.round(b.centerX()), Math.round(b.centerY()), 60); return true; } catch(e2){ return false; }
}

function tryFind(sel, to) { for (var i=0;i<sel.length;i++){ try{var r=sel[i].findOne(to||1000); if(r)return r;}catch(e){}} return null; }

function findVideoTab() {
    try { var a=text("视频").find(); for(var i=0;i<a.size();i++){var p=a.get(i).parent();while(p){if(String(p.className()).indexOf("ActionBar$Tab")>=0)return p;p=p.parent();}} } catch(e){} return null;
}

// ====== 评论区相关 ======

/**
 * 读取可见评论: 返回 [{username, text, y, desc}]
 */
function readComments() {
    var list = [];
    try {
        var all = classNameMatches(/.*/).find();
        for (var i = 0; i < all.size(); i++) {
            try {
                var el = all.get(i);
                var ds = el.desc() || "";
                var b  = el.bounds();
                if (b.width() <= 50 || b.height() <= 20) continue;
                if (b.top < sy(0.28) || b.top > sy(0.93)) continue;
                if (ds.indexOf("的头像") >= 0) continue;
                var cl = el.className();
                if (cl.indexOf("FrameLayout") < 0) continue;
                if (ds.indexOf(" 按钮") < 0) continue;
                if ((ds.indexOf("赞") >= 0 || ds.indexOf("踩") >= 0) && ds.indexOf("未选中") >= 0) continue;
                if (ds.indexOf("展开") >= 0 && ds.indexOf("条回复") >= 0) continue;
                var parts = ds.split(",");
                if (parts.length < 3) continue;
                var username = parts[0].trim();
                var commentText = parts[1].trim();
                if (commentText === "作者" && parts.length > 2) commentText = parts[2].trim();
                if (!username || !commentText || commentText.length < 2) continue;
                if (commentText.match(/^\d{1,2}[:\-月]/)) continue;
                list.push({ username: username, text: commentText, y: b.top, desc: ds });
            } catch(e2){}
        }
    } catch(e) {}
    return list;
}

function scrollComments(px) {
    swipe(sx(0.5), sy(0.75), sx(0.5), sy(0.75) - px, 200);
    wait(Math.round(CONFIG.loadWaitMs / 1000));
}

function matchesKeyword(text) {
    for (var k = 0; k < CONFIG.keywords.length; k++) {
        if (text.indexOf(CONFIG.keywords[k]) >= 0) return true;
    }
    return false;
}

/**
 * 点击评论文本区域，弹出回复框
 */
function clickCommentText(username, commentText, commentY) {
    try {
        var all = classNameMatches(/.*/).find();
        for (var i = 0; i < all.size(); i++) {
            try {
                var el = all.get(i);
                var tx = el.text() || "";
                var b  = el.bounds();
                // 找与评论 Y 区域接近、文本匹配的 TextView
                if (tx === commentText && Math.abs(b.centerY() - commentY) < 100) {
                    tlog("  点击评论文本: pos=(" + Math.round(b.centerX()) + "," + Math.round(b.centerY()) + ")");
                    press(Math.round(b.centerX()), Math.round(b.centerY()), 60);
                    return true;
                }
            } catch(e2){}
        }
        // 降级: 点评论 Y 区域
        press(sx(0.5), commentY, 60);
        return true;
    } catch(e){ return false; }
}

/**
 * 点击指定用户名的头像（在评论区中找到与 comment Y 区域接近的可点击头像/用户名）
 */
function clickUserAvatar(username, commentY) {
    try {
        var all = classNameMatches(/.*/).find();
        for (var i = 0; i < all.size(); i++) {
            try {
                var el = all.get(i);
                var ds = el.desc() || "";
                var b  = el.bounds();
                if (!el.clickable()) continue;
                // 头像元素通常 desc 包含用户名，位于评论上方
                if (ds.indexOf(username) >= 0 && b.centerY() > commentY - 200 && b.centerY() < commentY + 10) {
                    tlog("  点击头像: " + ds + " pos=(" + Math.round(b.centerX()) + "," + Math.round(b.centerY()) + ")");
                    smartClick(el);
                    wait(3);
                    return true;
                }
            } catch(e2){}
        }
    } catch(e){}
    // 降级: 点击该评论附近的 username TextView
    try {
        var unameEl = text(username).findOne(1000);
        if (unameEl) { smartClick(unameEl); wait(3); return true; }
    } catch(e){}
    return false;
}

function dumpPage(label, maxCount) {
    maxCount = maxCount || 30;
    tlog("=== " + label + " ===");
    var printed = 0;
    try {
        var all = classNameMatches(/.*/).find();
        for (var i = 0; i < all.size(); i++) {
            if (printed >= maxCount) break;
            try {
                var el = all.get(i);
                var ds = el.desc() || "";
                var tx = el.text() || "";
                var cl = el.className().replace(/^android\.widget\./, "");
                var ck = el.clickable();
                var b  = el.bounds();
                if (b.width() <= 20 || b.height() <= 5) continue;
                if (!ds && !tx) continue;
                if (tx.length > 45) tx = tx.substring(0,45)+"...";
                if (ds.length > 45) ds = ds.substring(0,45)+"...";
                tlog("  [" + cl + "] d='" + ds + "' t='" + tx + "' ck=" + ck + " rc=" + Math.round(b.left)+","+Math.round(b.top)+"-"+Math.round(b.right)+","+Math.round(b.bottom));
                printed++;
            } catch(e2){}
        }
    } catch(e) {}
    tlog("=== 共 " + printed + " 条 ===");
}

// goBack → 使用 REC.safeBack() 替代
auto();
device.keepScreenOn();

// === 导航到视频评论区 ===
tlog("启动抖音");
app.launchPackage("com.ss.android.ugc.aweme");
wait(4);
var si = desc("搜索").findOne(5000);
if (si) smartClick(si);
wait(3);
var inp = className("EditText").findOne(3000);
if (inp) {
    smartClick(inp);
    wait(0.5);
    humanType(inp, CONFIG.keyword);
    wait(0.3);
    smartClick(desc("搜索").findOne(2000));
}
wait(4);
var vt = findVideoTab();
if (vt) smartClick(vt);
wait(3);
try {
    var allC = clickable(true).find();
    for (var j = 0; j < allC.size(); j++) {
        try { var b = allC.get(j).bounds(); if (b.width()>0 && b.height()>0 && b.centerY()>sy(0.36) && b.centerY()<sy(0.54) && b.centerX()>sx(0.05) && b.width()>sx(0.1)) { smartClick(allC.get(j)); break; } } catch(e){}
    }
} catch(e){}
wait(3);
press(sx(0.5), sy(0.17), 80);
wait(2);

// === 视频循环 ===
for (var vid = 0; vid < CONFIG.maxVideos; vid++) {
    if (vid == 0) {
        // 首视频可能进入直播间，先检查
        var vp = REC.ensureState(PAGE.VIDEO_HALF_PAGE);
        if (vp === PAGE.UNKNOWN) vp = REC.ensureState(PAGE.VIDEO_PLAYER);
        if (vp === PAGE.LIVE_ROOM || vp === PAGE.UNKNOWN) {
            tlog("非视频页(" + vp + ")，滑到下一个");
            swipe(sx(0.5), sy(0.8), sx(0.5), sy(0.2), 300);
            wait(3);
        }
    }
    if (vid > 0) {
        visitedUsers = {};  // 每个视频重置已访问列表
        wait(1);
        tlog(">>> 滑到下一个视频 (" + (vid+1) + "/" + CONFIG.maxVideos + ")");
        swipe(sx(0.5), sy(0.8), sx(0.5), sy(0.2), 300);
        wait(3);
    }

    // 点评论入口
    tlog("点评论入口");
    REC.ensureState(PAGE.VIDEO_HALF_PAGE) || REC.ensureState(PAGE.VIDEO_PLAYER);
    var cb = tryFind([descContains("评论")], 5000);
    if (cb) smartClick(cb); else { press(sx(0.92), sy(0.64), 80); wait(1); }
    wait(2);

    if (REC.ensureState(PAGE.COMMENT_PANEL) === PAGE.UNKNOWN) {
        tlog("评论区未打开，跳过此视频");
        continue;
    }

    var vidActions = 0;  // 当前视频已操作次数

    // === 扫描循环 ===
    tlog("=== 开始扫描 视频" + (vid+1) + " ===");
    for (var round = 0; round < CONFIG.maxScrolls; round++) {
        if (vidActions >= CONFIG.maxActionsPerVideo) { tlog("视频" + (vid+1) + " 达到最大私信次数"); break; }
        tlog("--- 视频" + (vid+1) + " 第 " + (round+1) + " 轮 ---");

        var comments = readComments();
        tlog("  可见 " + comments.length + " 条评论");

        // 动态加载兜底：无评论则等2s再滑一次
        if (comments.length === 0) {
            tlog("  无评论，等待加载...");
            wait(2);
            scrollComments(CONFIG.scrollPx);
            comments = readComments();
            tlog("  重试后可见 " + comments.length + " 条评论");
        }
        if (comments.length === 0) {
            tlog("  评论已刷完，退出扫描");
            break;
        }

        for (var ci = 0; ci < comments.length; ci++) {
            var c = comments[ci];
            if (vidActions >= CONFIG.maxActionsPerVideo) break;
            if (!matchesKeyword(c.text)) continue;
            if (visitedUsers[c.username]) {
                tlog("  ⊘ 跳过已访问: " + c.username);
                continue;
            }

            tlog("  ✓ 命中: " + c.username + " — " + c.text);
            visitedUsers[c.username] = true;

            // 点击评论唤出回复框
            tlog("  点击评论唤出回复框");
            if (clickCommentText(c.username, c.text, c.y)) {
                wait(1.5);
                dumpPage("回复框", 20);
                tlog("  关闭回复框");
                REC.safeBack();
                wait(1);
            }

            // 点头像进主页
            if (!clickUserAvatar(c.username, c.y)) { tlog("  未找到头像"); continue; }
            REC.ensureState(PAGE.USER_PROFILE);
            dumpPage("用户主页", 20);

            // 点 "···" 设置
            var dotBtn = tryFind([descContains("更多"), desc("···")], 2000) || tryFind([descContains("设置")], 2000);
            if (dotBtn) { smartClick(dotBtn); wait(2); }
            else { press(sx(0.95), sy(0.04), 80); wait(2); }
            REC.ensureState(PAGE.SETTINGS_POPUP);
            dumpPage("设置弹窗", 15);

            // 点发私信
            var msgBtn = tryFind([text("发私信"), desc("发私信"), textContains("私信")], 2000);
            if (msgBtn) { smartClick(msgBtn); wait(2); }
            if (REC.ensureState(PAGE.PRIVATE_MSG) === PAGE.UNKNOWN) {
                tlog("  未进入私信页，跳过");
                REC.safeBack(); REC.safeBack();
                wait(2);
                continue;
            }
            dumpPage("私信页", 15);

            // 私信页：点击输入框，逐字输入"你好"
            tlog("  输入私信内容");
            var msgInput = tryFind([className("EditText")], 2000);
            if (msgInput) {
                smartClick(msgInput);
                wait(0.8);
                humanType(msgInput, "你好");
            }

            // 返回评论区 (back×4: 键盘+私信+弹窗+主页→评论区)
            tlog("  返回评论区 (REC.safeBack × 4)");
            REC.safeBack(); REC.safeBack(); REC.safeBack(); REC.safeBack();
            wait(3);
            vidActions++;
        }

        if (comments.length === 0) { tlog("  本轮无可见评论"); }
        if (vidActions >= CONFIG.maxActionsPerVideo) break;
        scrollComments(CONFIG.scrollPx);
    }

    // 退出评论区回到视频
    tlog("退出评论区");
    REC.safeBack();
    wait(1.5);

    if (vid >= CONFIG.maxVideos - 1) break;
}

tlog("=== 完成 ===");
toast("完成");
