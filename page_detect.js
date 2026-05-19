/**
 * page_detect.js — 页面识别模块
 * ============================================================
 * 根据当前屏幕关键元素的 text/desc/className 判断所在页面。
 * 返回页面类型枚举值，供导航和容错模块使用。
 *
 * 页面类型按"从具体到笼统"的优先级检测，避免误判。
 */

"use strict";

var PAGE = (function() {

    var PAGE_TYPE = {
        PRIVATE_MSG:      "私信页",
        SETTINGS_POPUP:   "设置弹窗",
        USER_PROFILE:     "用户主页",
        COMMENT_REPLY:    "评论回复框",
        COMMENT_PANEL:    "评论区",
        VIDEO_PLAYER:     "视频播放页",
        VIDEO_HALF_PAGE:  "视频半页（搜索栏残留）",
        SEARCH_RESULTS:   "搜索结果页",
        SEARCH_LANDING:   "搜索着陆页",
        HOME_FEED:        "首页Feed流",
        LIVE_ROOM:        "直播间",
        UNKNOWN:          "未知页面",
    };

    /**
     * 快速检测：某类元素是否存在
     */
    function hasText(txt, timeout) {
        return text(txt).findOne(timeout || 800) !== null;
    }

    function hasDesc(dsc, timeout) {
        return desc(dsc).findOne(timeout || 800) !== null;
    }

    function hasDescContains(dsc, timeout) {
        return descContains(dsc).findOne(timeout || 800) !== null;
    }

    function hasCommentRow() {
        try {
            var all = className("FrameLayout").find();
            for (var i = 0; i < all.size(); i++) {
                var ds = all.get(i).desc() || "";
                if (ds.indexOf("回复 按钮") >= 0 && ds.indexOf(",") >= 0) return true;
            }
        } catch(e) {}
        return false;
    }

    function hasTabBar() {
        return className("androidx.appcompat.app.ActionBar$Tab").findOne(800) !== null;
    }

    function hasBottomTabs() {
        return hasText("首页", 800) && hasText("我", 800);
    }

    function detect() {
        // 1. 私信页: "更多"+"关闭"+"拍摄"+"只能发送一条消息"(键盘弹出，未输入)
        if (hasDesc("更多", 800) && hasDesc("关闭", 800) && hasDesc("拍摄", 800) &&
            textContains("只能发送一条消息").findOne(800) !== null) return PAGE_TYPE.PRIVATE_MSG;
        // 私信页: "更多"+"关闭"+"发送"(已输入文字，发送按钮出现)
        if (hasDesc("更多", 800) && hasDesc("关闭", 800) && hasDesc("发送", 800) &&
            textContains("你好").findOne(500) !== null) return PAGE_TYPE.PRIVATE_MSG;
        if (hasDesc("更多", 800) && hasDesc("关闭", 800) && hasDesc("发送", 800)) return PAGE_TYPE.PRIVATE_MSG;
        // 私信页(无键盘): "更多" + "删除会话"(Button desc)
        if (hasDesc("删除会话", 800) && hasDesc("更多", 800)) return PAGE_TYPE.PRIVATE_MSG;

        // 2. 设置弹窗: 有"分享名片" + "发私信"
        if (hasText("分享名片", 800) && hasText("发私信", 800)) return PAGE_TYPE.SETTINGS_POPUP;

        // 3. 用户主页: 有"用户头像" desc + "抖音号" + 作品/喜欢 tab
        if (hasDesc("用户头像", 800) && textContains("抖音号").findOne(800) !== null && hasTabBar()) return PAGE_TYPE.USER_PROFILE;

        // 4. 评论回复框: 有"回复 @" EditText + "同时发布为作品"
        if (textContains("回复 @").findOne(800) !== null && hasText("同时发布为作品", 800)) return PAGE_TYPE.COMMENT_REPLY;

        // 5. 评论区: 有"放大评论区" + 评论数据行
        if (hasDesc("放大评论区", 800) && hasCommentRow()) return PAGE_TYPE.COMMENT_PANEL;

        // 6. 直播间: 有"更多面板" + "说点什么"
        if (hasDescContains("更多面板", 800) && hasDescContains("说点什么", 800)) return PAGE_TYPE.LIVE_ROOM;
        if (hasDesc("关闭", 800) && hasDescContains("本场点赞", 800)) return PAGE_TYPE.LIVE_ROOM;
        // 直播间回复框
        if (hasDesc("退出", 800) && hasDesc("发送，已停用", 800)) return PAGE_TYPE.LIVE_ROOM;

        // 7. 视频半页: 搜索栏(返回+搜索) + 视频播放中
        if (hasDesc("返回", 800) && hasDesc("暂停视频，按钮", 800) && hasDesc("搜索", 800)) return PAGE_TYPE.VIDEO_HALF_PAGE;
        // 也匹配图片滑动帖
        if (hasDesc("返回", 800) && hasDesc("播放视频，按钮", 800) && hasDesc("搜索", 800)) return PAGE_TYPE.VIDEO_HALF_PAGE;

        // 8. 视频播放页: 有暂停或播放视频 + 右侧栏评论按钮
        if ((hasDesc("暂停视频，按钮", 800) || hasDesc("播放视频，按钮", 800)) &&
            hasDescContains("评论", 800)) return PAGE_TYPE.VIDEO_PLAYER;

        // 9. 搜索结果页: 有 ActionBar$Tab 标签栏 + 搜索框
        if (hasTabBar() && className("EditText").findOne(800) !== null) return PAGE_TYPE.SEARCH_RESULTS;

        // 10. 搜索着陆页: 有返回 + 搜索按钮 + EditText，无 ActionBar$Tab
        if (hasDesc("返回", 800) && hasDesc("搜索", 800) && !hasTabBar() && className("EditText").findOne(800) !== null)
            return PAGE_TYPE.SEARCH_LANDING;

        // 11. 首页 Feed: 有视频 + 底部导航栏
        if ((hasDesc("暂停视频，按钮", 800) || hasDesc("播放视频，按钮", 800)) && hasBottomTabs())
            return PAGE_TYPE.HOME_FEED;

        return PAGE_TYPE.UNKNOWN;
    }

    /**
     * 判断当前是否在指定页面类型
     */
    function is(type) {
        return detect() === type;
    }

    // ========== 公开 API ==========
    return {
        PAGE:         PAGE_TYPE,
        detect:       detect,
        is:           is,
    };

})();

if (typeof module !== "undefined") {
    module.exports = PAGE;
}

// ========== 自测：运行此文件直接打印当前页面类型 ==========
// auto();
// var t = PAGE.detect();
// log("当前页面: " + t);
// toast(t);
