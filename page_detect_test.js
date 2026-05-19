/**
 * page_detect_test.js v2 — 详细调试模式
 * ============================================================
 * 每轮打印: 当前页面关键特征存在性 + 元素列表 + 最终识别结果
 * 你手动切页面，每8秒自动测一轮，共12轮
 */
"use strict";
console.show();
var PD = require("./page_detect.js");

function tlog(msg) { log(util.format("[%s] %s", new Date().toLocaleTimeString(), msg)); }
function wait(sec) { sleep(sec*1000); }
function _exists(sel, to) { try { return sel.findOne(to||800) !== null; } catch(e){ return false; } }

auto();

var tests = [
    { name: "暂停视频",       check: function(){ return _exists(desc("暂停视频，按钮"), 600); } },
    { name: "搜索按钮",       check: function(){ return _exists(desc("搜索"), 600); } },
    { name: "搜索返回",       check: function(){ return _exists(desc("返回"), 600); } },
    { name: "放大评论区",     check: function(){ return _exists(desc("放大评论区"), 600); } },
    { name: "关闭(评论)",     check: function(){ return _exists(desc("关闭"), 600); } },
    { name: "分享名片",       check: function(){ return _exists(text("分享名片"), 600); } },
    { name: "发私信",         check: function(){ return _exists(text("发私信"), 600); } },
    { name: "删除会话",       check: function(){ return _exists(text("删除会话"), 600); } },
    { name: "用户头像",       check: function(){ return _exists(desc("用户头像"), 600); } },
    { name: "抖音号:",        check: function(){ return _exists(textContains("抖音号"), 600); } },
    { name: "回复@",          check: function(){ return _exists(textContains("回复 @"), 600); } },
    { name: "同时发布为作品", check: function(){ return _exists(text("同时发布为作品"), 600); } },
    { name: "说点什么...",    check: function(){ return _exists(descContains("说点什么"), 600); } },
    { name: "更多面板",       check: function(){ return _exists(descContains("更多面板"), 600); } },
    { name: "更多按钮(···)",  check: function(){ return _exists(desc("更多"), 600); } },
    { name: "填入搜索框",     check: function(){ return _exists(desc("填入搜索框"), 600); } },
    { name: "ActionBar$Tab",  check: function(){ return className("androidx.appcompat.app.ActionBar$Tab").findOne(600) !== null; } },
    { name: "底部首页tab",    check: function(){ return _exists(text("首页"), 600) && _exists(text("我"), 600); } },
    { name: "底部拍摄tab",    check: function(){ return _exists(desc("拍摄，按钮"), 600); } },
    { name: "直播本场点赞",   check: function(){ return _exists(descContains("本场点赞"), 600); } },
    { name: "评论行format",   check: function(){
        try { var a=className("FrameLayout").find(); for(var i=0;i<a.size();i++){ var ds=a.get(i).desc()||""; if(ds.indexOf("回复 按钮")>=0 && ds.indexOf(",")>=0) return true; } } catch(e){} return false;
    }},
];

function dumpElements(max) {
    max = max || 30;
    var printed = 0;
    try {
        var all = classNameMatches(/.*/).find();
        for (var i = 0; i < all.size(); i++) {
            if (printed >= max) break;
            try {
                var el = all.get(i);
                var ds = el.desc() || "";
                var tx = el.text() || "";
                var cl = String(el.className()).replace(/^android\.widget\./, "");
                var b  = el.bounds();
                if (b.width() <= 20 || b.height() <= 10) continue;
                if (!ds && !tx) continue;
                if (tx.length > 50) tx = tx.substring(0,50)+"...";
                if (ds.length > 50) ds = ds.substring(0,50)+"...";
                tlog("  ["+cl+"] d='"+ds+"' t='"+tx+"' rc="+Math.round(b.left)+","+Math.round(b.top)+"-"+Math.round(b.right)+","+Math.round(b.bottom));
                printed++;
            } catch(e2){}
        }
    } catch(e) {}
    tlog("  --- "+printed+" 条 ---");
}

tlog("=== 页面识别测试 v2 (详细模式) ===");
tlog("请在手机上随意切换页面，每8秒测一轮");
tlog("格式: [轮] ✓/✗ 页面名 → 打印特征");
tlog("");

for (var r = 1; r <= 12; r++) {
    var features = [];
    for (var t = 0; t < tests.length; t++) {
        var ok = tests[t].check();
        if (ok) features.push(tests[t].name);
    }
    var page = PD.detect();
    if (page === "未知页面" || page === "视频半页（搜索栏残留）" || page === "视频播放页") {
        tlog("[" + r + "/12] "+ (page==="未知页面"?"✗":"✓") + " " + page + " ↓↓↓ 打印元素 ↓↓↓");
        dumpElements(40);
    } else {
        tlog("[" + r + "/12] ✓ " + page);
        tlog("  特征: " + (features.length>0 ? features.join(", ") : "(无)"));
    }
    tlog("");

    wait(8);
}
tlog("=== 结束 ===");
toast("完成");
