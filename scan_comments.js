/**
 * scan_comments.js — 评论区关键字扫描脚本
 * ============================================================
 * 流程: 打开抖音 → 搜索 → 进视频 → 打开评论区 → 扫描评论
 *
 * 扫描逻辑:
 *   1. 读取当前页面可见评论
 *   2. 匹配关键字（CONFIG.keywords）
 *   3. 若匹配到且有"展开x条回复"则点击展开，读子评论
 *   4. 若全部评论不符合，下滑 50px，重新读取
 *   5. 打印每条评论的文本和层级（主/子）
 */
"use strict";
console.show();

var CONFIG = {
    keyword:    "长沙旅游",
    keywords:   ["搭子", "组团", "地陪", "预算", "找人"],
    maxScrolls:  10,     // 最多下滑次数
    maxComments: 100,    // 最多扫描评论数
    scrollPx:    600,    // 每次下滑像素（加大，覆盖一整屏评论）
    loadWaitMs:  2000,   // 下滑后等待加载时间
};

var PASS_COUNT = 0;

function sx(r) { return Math.round(device.width  * r); }
function sy(r) { return Math.round(device.height * r); }

function tlog(msg) { log(util.format("[%s] %s", new Date().toLocaleTimeString(), msg)); }
function pass(msg) { PASS_COUNT++; tlog("✓ 命中: " + msg); }
function wait(sec) { sleep(sec * 1000); }

// ========== 工具函数（同步自 douyin_bot.js）==========
function smartClick(node) {
    if (node === null) return false;
    try {
        if (node.clickable()) { node.click(); return true; }
        var b = node.bounds();
        press(Math.round(b.centerX()), Math.round(b.centerY()), 60);
        return true;
    } catch(e) {
        try {
            var b2 = node.bounds();
            press(Math.round(b2.centerX()), Math.round(b2.centerY()), 60);
            return true;
        } catch(e2) { return false; }
    }
}

function tryFind(selectors, timeout) {
    timeout = timeout || 1000;
    for (var i = 0; i < selectors.length; i++) {
        try { var r = selectors[i].findOne(timeout); if (r !== null) return r; } catch(e){}
    }
    return null;
}

function findVideoTab() {
    try {
        var all = text("视频").find();
        for (var i = 0; i < all.size(); i++) {
            var p = all.get(i).parent();
            while (p !== null) {
                if (String(p.className()).indexOf("ActionBar$Tab") >= 0) return p;
                p = p.parent();
            }
        }
    } catch(e){}
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
                 && b.centerX() > sx(0.05) && b.width() > sx(0.1)) return el;
            } catch(e){}
        }
    } catch(e){}
    return null;
}

/**
 * 判断文本是否匹配任一关键字
 */
function matchesKeyword(text) {
    for (var k = 0; k < CONFIG.keywords.length; k++) {
        if (text.indexOf(CONFIG.keywords[k]) >= 0) return true;
    }
    return false;
}

/**
 * 读取评论区当前可见的评论
 * 评论 desc 有几种格式:
 *   "{用户名}的头像" — 头像，跳过
 *   "用户名,评论文本,日期, · 地点,回复 按钮," — 主评论
 *   "用户名,评论文本,日期, · 地点,回复 按钮," — 子评论（主评论下方缩进）
 *   "展开N条回复，按钮" — 展开行
 *   "赞N,未选中" / "踩,未选中" — 点赞/踩行，跳过
 * 判断主/子: desc 中出现"作者"字段的为主评论，主评论Y ≈ 头像Y；子评论Y比相邻主评论大且desc含"回复 按钮"
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

                // 只取 FrameLayout 且 desc 含逗号分隔评论数据的
                var cl = el.className();
                if (cl.indexOf("FrameLayout") < 0) continue;
                if (ds.indexOf(" 按钮") < 0) continue;
                if (ds.split(",").length < 3) continue;

                // 跳过点赞/踩行
                if ((ds.indexOf("赞") >= 0 || ds.indexOf("踩") >= 0) && ds.indexOf("未选中") >= 0) continue;

                // 展开行
                if (ds.indexOf("展开") >= 0 && ds.indexOf("条回复") >= 0) {
                    list.push({ text: ds, fullDesc: ds, y: b.top, isExpandLine: true, isSub: false });
                    continue;
                }

                // 解析评论: 格式 用户名,评论文本,日期, · 地点,回复 按钮,...
                var parts = ds.split(",");
                var isSub = (ds.indexOf("回复 按钮") >= 0 && ds.indexOf("作者") < 0);
                if (ds.indexOf("作者") >= 0) isSub = false;

                // 评论文本是 parts[1]（第2段）
                var commentText = parts[1] ? parts[1].trim() : "";
                // 如果 parts[1] 是"作者"，则评论文本在 parts[2]
                if (commentText === "作者" || commentText === "作者" && parts.length > 2) {
                    commentText = parts[2] ? parts[2].trim() : "";
                }
                if (commentText.match(/^\d{1,2}[:\-月]/) || commentText.match(/^\d{4}[:\-]/)) commentText = "";
                if (!commentText || commentText.length < 2) {
                    // 找第一个有实质内容的段
                    for (var p = 1; p < parts.length; p++) {
                        var seg = parts[p].trim();
                        if (seg && seg.length > 2 && seg !== "作者" && seg.indexOf("回复") < 0 && !seg.match(/^\d{1,2}[:\-月]/) && !seg.match(/^[ ·]/)) {
                            commentText = seg; break;
                        }
                    }
                }
                if (!commentText || commentText.length < 2) continue;

                list.push({
                    text: commentText, fullDesc: ds, y: b.top,
                    isExpandLine: false, isSub: isSub,
                });
            } catch(e2){}
        }
    } catch(e) { tlog("readComments 异常: " + e); }
    return list;
}
var _rawDumped = false;

/**
 * 点击所有可见的"展开N条回复"按钮
 */
function expandAllReplies() {
    var expanded = 0;
    try {
        var all = classNameMatches(/.*/).find();
        for (var i = 0; i < all.size(); i++) {
            try {
                var el = all.get(i);
                var ds = el.desc() || "";
                var b  = el.bounds();
                if (b.top < sy(0.28) || b.top > sy(0.95)) continue;
                if (ds.indexOf("展开") >= 0 && ds.indexOf("条回复") >= 0 && el.clickable()) {
                    tlog("  点击: " + ds);
                    smartClick(el);
                    wait(1.5);
                    expanded++;
                }
            } catch(e2){}
        }
    } catch(e) {}
    if (expanded > 0) tlog("  共展开了 " + expanded + " 条回复");
    return expanded;
}

/**
 * 在评论区下滑指定像素
 */
function scrollComments(px) {
    var x = sx(0.5);
    var y1 = sy(0.75);
    var y2 = y1 - px;
    tlog("  下滑 " + px + "px");
    swipe(x, y1, x, y2, 200);
    wait(CONFIG.loadWaitMs / 1000);
}

/**
 * 点击"展开N条回复"
 */
function clickExpandReply(commentNode) {
    // 找 desc 包含"展开"的 clickable 元素
    var all = classNameMatches(/.*/).find();
    for (var i = 0; i < all.size(); i++) {
        try {
            var el = all.get(i);
            var ds = el.desc() || "";
            if (ds.indexOf("展开") >= 0 && ds.indexOf("回复") >= 0 && el.clickable()) {
                tlog("  点击展开: " + ds);
                smartClick(el);
                wait(1.5);
                return true;
            }
        } catch(e2){}
    }
    return false;
}

// ====================================================================
auto();
device.keepScreenOn();

tlog("=== 启动 ===");
app.launchPackage("com.ss.android.ugc.aweme");
wait(8);

// --- 搜索 ---
tlog("点搜索图标");
var si = desc("搜索").findOne(5000);
if (si !== null) smartClick(si);
wait(3);

tlog("输入 " + CONFIG.keyword);
var input = className("EditText").findOne(3000);
if (input !== null) {
    smartClick(input);
    wait(0.5);
    input.setText(CONFIG.keyword);
    wait(0.3);
    var sb = desc("搜索").findOne(2000);
    smartClick(sb);
}
wait(4);

// --- 视频标签 ---
tlog("点视频标签");
var vt = findVideoTab();
if (vt !== null) smartClick(vt);
wait(3);

// --- 点第一个视频 ---
tlog("点第一个视频");
var fv = findFirstVideoCard();
if (fv !== null) smartClick(fv);
else press(sx(0.25), sy(0.43), 80);
wait(3);
press(sx(0.5), sy(0.17), 80); // 消半页
wait(2);

// --- 点评论入口 ---
tlog("点评论入口");
var cb = tryFind([descContains("评论")], 3000);
if (cb !== null) { smartClick(cb); tlog("  已点评论入口"); }
else { press(sx(0.92), sy(0.64), 80); tlog("  坐标点评论入口"); }
wait(2);

// --- 扫描循环 ---
tlog("=== 开始扫描评论 (关键字: " + CONFIG.keywords.join(", ") + ") ===");
var totalComments = 0;
var prevTexts = "";  // 上轮评论文本摘要，用于判断到底

for (var round = 0; round < CONFIG.maxScrolls; round++) {
    tlog("--- 第 " + (round + 1) + "/" + CONFIG.maxScrolls + " 轮 (已扫描 " + totalComments + " 条) ---");

    var comments = readComments();
    tlog("  可见评论: " + comments.length + " 条");

    // 提取本轮评论摘要
    var thisTexts = "";
    for (var ci = 0; ci < comments.length; ci++) {
        thisTexts += comments[ci].y + ":" + comments[ci].text.substring(0, 20) + "|";
    }

    // 判断是否到底（评论内容和位置无变化）
    if (round > 0 && thisTexts === prevTexts) {
        tlog("  评论无变化，已到底，终止扫描");
        break;
    }
    prevTexts = thisTexts;

    var foundInRound = false;
    for (var ci = 0; ci < comments.length; ci++) {
        var c = comments[ci];
        if (c.isExpandLine) {
            // 展开行暂时跳过，最后统一处理
            continue;
        }
        var label = c.isSub ? "子" : "主";
        tlog("  [" + label + "] \"" + c.text + "\"");

        if (matchesKeyword(c.text)) {
            pass("【" + label + "评论】" + c.text);
            foundInRound = true;
        }
        totalComments++;
        if (totalComments >= CONFIG.maxComments) break;
    }

    // 本轮有命中 → 展开所有可见的"展开N条回复"
    if (foundInRound) {
        tlog("  命中关键字，展开所有回复...");
        expandAllReplies();
        // 重新读取，打印新出现的子评论
        var expandedComments = readComments();
        for (var ei = 0; ei < expandedComments.length; ei++) {
            var ec = expandedComments[ei];
            if (ec.isSub && !ec.isExpandLine) {
                tlog("    [子] \"" + ec.text + "\"");
                if (matchesKeyword(ec.text)) pass("    【子评论】" + ec.text);
            }
        }
    }

    if (totalComments >= CONFIG.maxComments) {
        tlog("  已扫描 " + totalComments + " 条，达到上限");
        break;
    }

    scrollComments(CONFIG.scrollPx);
}
toast("扫描完成，命中 " + PASS_COUNT + " 条");
