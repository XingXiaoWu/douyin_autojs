/**
 * recovery.js — 容错恢复模块 v2
 * ============================================================
 * 防御层级（按优先级）：
 *   1. 包名检查 — 是否在抖音
 *   2. 弹窗扫描 — 青少年模式/更新/权限/广告等已知关闭控件
 *   3. 偏离页面 — 直播间/他人主页等脱离主流程的页面
 *   4. 期望页面 — 匹配主流程中的页面
 *   5. 返回纠正 — back() 尝试回到上一页
 *   6. 空白点击 — 无控件弹窗降级
 *   7. 卡死检测 — 同状态 >10s 无进展 → 冷重启
 *
 * 用法:
 *   var REC = require("./recovery.js");
 *   REC.init(require("./page_detect.js"));
 *   REC.ensureState(PD.PAGE.VIDEO_PLAYER);  // 确保在视频页
 *   REC.retry(3, function() { ... }, PD.PAGE.VIDEO_PLAYER);
 */

"use strict";

var RECOVERY = (function() {

    var PD = null;
    var PAGE = null;

    // 统计
    var _stats = { popups: 0, backs: 0, restarts: 0, recoveries: 0 };

    // 卡死追踪
    var _freezeTracker = { page: "", time: 0, count: 0 };

    // 恢复操作历史（防死循环）
    var _recoveryLog = [];

    function _log(msg) { log("[recovery] " + msg); }

    /**
     * 初始化
     */
    function init(pageDetectModule) {
        PD = pageDetectModule;
        PAGE = PD.PAGE;
    }

    // ====================== 第1层：包名/进程 ======================

    function isDouyinForeground() {
        try { return currentPackage() === "com.ss.android.ugc.aweme"; }
        catch(e) { return false; }
    }

    function launchDouyin() {
        _log("启动抖音");
        app.launchPackage("com.ss.android.ugc.aweme");
        sleep(6000);
        return isDouyinForeground();
    }

    // ====================== 第2层：弹窗扫描 ======================

    var POPUP_DISMISS = [
        // 精确匹配（优先）—— 注意：去掉通用的"关闭"，评论区自带关闭按钮会误触
        { f: function(){ return desc("我知道了").findOne(400); },    label: "我知道了" },
        { f: function(){ return desc("立即更新").findOne(400); },    label: "立即更新" },
        { f: function(){ return desc("跳过").findOne(400); },        label: "跳过" },
        { f: function(){ return desc("稍后").findOne(400); },        label: "稍后" },
        { f: function(){ return desc("取消").findOne(400); },        label: "取消" },
        { f: function(){ return desc("以后再说").findOne(400); },    label: "以后再说" },
        { f: function(){ return desc("暂不").findOne(400); },        label: "暂不" },
        { f: function(){ return desc("不同意").findOne(400); },      label: "不同意" },
        { f: function(){ return desc("允许").findOne(400); },        label: "允许" },
        { f: function(){ return desc("始终允许").findOne(400); },    label: "始终允许" },
        { f: function(){ return desc("禁止").findOne(400); },        label: "禁止" },
        { f: function(){ return desc("关闭").className("ImageView").findOne(400); }, label: "关闭(图片)" },
        { f: function(){ return text("我知道了").findOne(400); },    label: "我知道了(txt)" },
        { f: function(){ return text("允许").findOne(400); },        label: "允许(txt)" },
        { f: function(){ return text("确定").findOne(400); },        label: "确定(txt)" },
        // 模糊匹配（降级，仅在非评论区/非直播间时使用）
        { f: function(){ return descContains("跳过").findOne(300); },   label: "跳过(模糊)" },
        { f: function(){ return descContains("暂不").findOne(300); },   label: "暂不(模糊)" },
        { f: function(){ return textContains("同意").findOne(300); },   label: "同意(模糊)" },
    ];

    /**
     * 扫描并关闭弹窗
     * @returns {boolean} 是否关闭了一个弹窗
     */
    function scanAndDismissPopup() {
        for (var i = 0; i < POPUP_DISMISS.length; i++) {
            var item = POPUP_DISMISS[i];
            try {
                var node = item.f();
                if (node !== null) {
                    _log("弹窗: " + item.label + " → 点击");
                    _recoveryLog.push("popup-" + item.label);
                    _click(node);
                    sleep(1500);
                    _stats.popups++;
                    return true;
                }
            } catch(e) {}
        }
        return false;
    }

    /**
     * 点击空白区域（非弹窗中心的区域）
     */
    function tapBlank() {
        var x = Math.round(device.width / 2 + (Math.random() - 0.5) * device.width * 0.3);
        var y = Math.round(device.height * 0.85);
        _log("点空白区 (" + x + "," + y + ")");
        click(x, y);
        sleep(1500);
    }

    /**
     * 安全点击：优先 .click()（无障碍），clk=false 则 press(center)
     */
    function _click(node) {
        try {
            if (node.clickable()) {
                node.click();
            } else {
                var b = node.bounds();
                var cx = Math.round(b.centerX()) + Math.floor(Math.random() * 20 - 10);
                var cy = Math.round(b.centerY()) + Math.floor(Math.random() * 20 - 10);
                press(cx, cy, 50 + Math.floor(Math.random() * 40));
            }
        } catch(e) {
            // click 失败，press 降级
            try {
                var b2 = node.bounds();
                press(Math.round(b2.centerX()), Math.round(b2.centerY()), 60);
            } catch(e2) {}
        }
    }

    // ====================== 第3层：偏离页面检测 ======================

    /**
     * 检测是否在脱离主流程的页面（需 back 离开）
     */
    function isOffTrackPage(page) {
        // 直播间 → 非预期，须退出
        if (page === PAGE.LIVE_ROOM) return true;
        // 他人主页（非自己主动进入的）
        if (page === PAGE.USER_PROFILE) return true;
        // 设置弹窗（可能是误触）
        if (page === PAGE.SETTINGS_POPUP) return true;
        return false;
    }

    // ====================== 卡死检测 ======================

    function updateFreezeTracker(currentPage) {
        var now = Date.now();
        if (currentPage === _freezeTracker.page) {
            _freezeTracker.count++;
        } else {
            _freezeTracker.page = currentPage;
            _freezeTracker.time = now;
            _freezeTracker.count = 1;
        }
        var elapsed = now - _freezeTracker.time;
        // 同页面 >10s 且连续检测 >3 次 → 卡死
        return elapsed > 10000 && _freezeTracker.count > 3;
    }

    function resetFreezeTracker() {
        _freezeTracker = { page: "", time: 0, count: 0 };
    }

    // ====================== 冷重启 ======================

    function coldRestart() {
        _stats.restarts++;
        _log("冷重启 #" + _stats.restarts);
        _recoveryLog.push("coldrestart");
        shell("am force-stop com.ss.android.ugc.aweme", true);
        sleep(3000);
        app.launchPackage("com.ss.android.ugc.aweme");
        sleep(8000);
        resetFreezeTracker();
        _recoveryLog = [];
        return PD.detect();
    }

    // ====================== 主入口 ======================

    /**
     * 确保当前页面符合预期，自动处理偏离、弹窗、卡死
     * @param {string} expectedPage - PAGE 枚举值
     * @param {number} [maxAttempts=6] - 最大尝试次数
     * @returns {string} 当前页面类型
     */
    function ensureState(expectedPage, maxAttempts) {
        maxAttempts = maxAttempts || 3;
        var attempts = 0;
        var page = PD.detect();

        while (attempts < maxAttempts) {
            attempts++;

            if (!isDouyinForeground()) {
                _log("抖音不在前台");
                if (!launchDouyin()) return PAGE.UNKNOWN;
                page = PD.detect();
            }

            if (scanAndDismissPopup()) {
                sleep(800);
                page = PD.detect();
                continue;
            }

            if (isOffTrackPage(page)) {
                _log("偏离页面: " + page + "，back");
                back(); sleep(2000);
                _stats.backs++;
                page = PD.detect();
                continue;
            }

            if (page === expectedPage) {
                resetFreezeTracker();
                return page;
            }

            if (page !== PAGE.UNKNOWN) {
                back(); sleep(2000);
                page = PD.detect();
                if (page === expectedPage) return page;
            }

            tapBlank();
            sleep(1500);
            page = PD.detect();
            if (page === expectedPage) return page;

            if (updateFreezeTracker(page)) {
                _log("卡死检测，冷重启");
                page = coldRestart();
            }
        }

        _log("ensureState 失败，当前页面: " + page + "，期望: " + expectedPage);
        return page;
    }

    /**
     * 带容错的重试包装器
     * @param {number} retries - 最大重试次数
     * @param {Function} fn - 要执行的操作
     * @param {string} [expectedPage] - 操作后期望的页面
     * @returns {*} fn 的返回值或 undefined
     */
    function retry(retries, fn, expectedPage) {
        for (var r = 0; r < retries; r++) {
            if (expectedPage) ensureState(expectedPage);
            try {
                return fn();
            } catch(e) {
                _log("retry #" + (r+1) + " 异常: " + e);
                sleep(2000);
            }
        }
        _log("retry " + retries + " 次全失败");
        return undefined;
    }

    /**
     * 安全返回（先 back()，若无效边缘滑动）
     */
    function safeBack() {
        back();
        sleep(500);
        // 手势导航降级
        swipe(5, Math.round(device.height / 2),
              Math.round(device.width * 0.2), Math.round(device.height / 2), 200);
        sleep(500);
    }

    // ====================== 公开 API ======================

    return {
        init:                  init,
        ensureState:           ensureState,
        retry:                 retry,
        coldRestart:           coldRestart,
        scanAndDismissPopup:   scanAndDismissPopup,
        isDouyinForeground:    isDouyinForeground,
        safeBack:              safeBack,
        isOffTrackPage:        isOffTrackPage,
        getStats:              function() { return _stats; },
        resetStats:            function() { _stats = { popups: 0, backs: 0, restarts: 0, recoveries: 0 }; },
    };

})();

if (typeof module !== "undefined") {
    module.exports = RECOVERY;
}

