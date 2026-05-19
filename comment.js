"use strict";

var utils = require("./utils.js");

/**
 * 在抖音视频评论区发送一条随机评论
 * @param {string[]} commentsArray - 候选评论文案数组
 */
function performComment(commentsArray) {
    if (!commentsArray || commentsArray.length === 0) {
        log("performComment: 评论数组为空，跳过");
        return;
    }

    // ---------- 1. 点击评论入口 ----------
    log("performComment: 查找评论入口");
    var commentBtn = utils.tryFind([descContains("评论")], 800);
    if (commentBtn !== null) {
        utils.randomClick(commentBtn);
    } else {
        log("performComment: 坐标直点评论入口");
        press(Math.round(device.width * 0.92), Math.round(device.height * 0.63), utils.random(50, 100));
    }
    utils.sleepRandom(800, 1500);

    // ---------- 2. 等待评论区弹出 ----------
    log("performComment: 等待评论区加载...");
    var panelStart = Date.now();
    var panelFound = utils.tryFind([
        className("EditText"),
        textContains("分享"),
        textContains("写评论"),
        descContains("写评论")
    ], 800);
    var panelElapsed = Date.now() - panelStart;
    log("performComment: 评论区检测耗时 " + panelElapsed + "ms" +
        (panelFound ? " (命中: " + (panelFound.desc() || panelFound.text() || panelFound.className()) + ")" : " (全部失败)"));
    if (panelFound === null) {
        log("performComment: 评论区未加载，尝试返回");
        utils.safeBack();
        return;
    }
    log("performComment: 评论区已弹出");

    // ---------- 3. 定位评论输入框 ----------
    log("performComment: 查找评论输入框");
    var inputBox = utils.tryFind([desc("写评论..."), className("EditText")], 3000);
    if (inputBox === null) {
        log("performComment: 未找到评论输入框，尝试返回");
        utils.safeBack();
        return;
    }
    utils.randomClick(inputBox);
    utils.sleepRandom(300, 600);

    // ---------- 4. 输入评论内容 ----------
    var msg = utils.randomPick(commentsArray);
    log("performComment: 输入评论: " + msg);
    inputBox.setText(msg);
    utils.sleepRandom(500, 1000);

    // ---------- 5. 点击发送 ----------
    log("performComment: 查找发送按钮");
    var sendBtn = utils.tryFind([text("发送").clickable(true)], 3000);
    if (sendBtn === null) {
        log("performComment: 未找到发送按钮，尝试返回");
        utils.safeBack();
        return;
    }
    utils.randomClick(sendBtn);
    log("performComment: 评论已发送");

    // ---------- 6. 返回视频界面 ----------
    utils.sleepRandom(800, 1200);
    utils.safeBack();
    log("performComment: 已返回视频界面");
    sleep(1500);
}

if (typeof module !== "undefined") {
    module.exports = { performComment: performComment };
}
