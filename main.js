"use strict";

// ==================== 配置 ====================
var KEYWORD = "好物推荐";
var MAX_LOOPS = 20;
var COMMENTS = [
    // 在这里填入候选评论文案，例如:
    // "太棒了！", "学到了", "好物分享", "已收藏"
];

// ==================== 导入工具模块 ====================
var utils = require("./utils.js");
var commentMod = require("./comment.js");

// +++ anti-detect: 全局状态
var failCount = 0;          // 连续失败计数器
var restartCount = 0;       // 重启次数
var MAX_RESTARTS = 3;       // 最大重启次数

// +++ anti-detect: 记录一次失败，满3次触发重启
function addFail() {
    failCount++;
    log(">>> [anti-detect] 失败计数: " + failCount + "/3");
    if (failCount >= 3) {
        if (restartCount >= MAX_RESTARTS) {
            log(">>> [anti-detect] 已达最大重启次数，终止脚本");
            toast("连续失败过多，脚本终止");
            exit();
        }
        log(">>> [anti-detect] 连续失败3次，重启抖音");
        restartDouyin();
    }
}

// +++ anti-detect: 操作成功时重置失败计数
function clearFail() {
    failCount = 0;
}

// +++ anti-detect: 重启抖音并重新进入搜索流程
function restartDouyin() {
    restartCount++;
    log(">>> [anti-detect] 第 " + restartCount + " 次重启");
    app.launchPackage("com.ss.android.ugc.aweme");
    sleep(5000);
    enterSearchFlow();
    clearFail();
}

// +++ anti-detect: 封装 搜索 → 输入关键词 → 进入第一个视频 流程
function enterSearchFlow() {
    // ---------- 2. 点击搜索图标 ----------
    log(">>> 查找搜索图标");
    var searchIcon = utils.tryFind([desc("搜索")], 5000);
    if (searchIcon !== null) {
        utils.randomClick(searchIcon);
        log(">>> 已点击搜索图标");
        clearFail(); // +++ anti-detect
    } else {
        log(">>> 未找到搜索图标，使用相对坐标点击");
        press(device.width * 0.92, device.height * 0.06, utils.random(30, 80));
        addFail(); // +++ anti-detect
    }

    utils.sleepRandom(1000, 2000);

    // ---------- 3. 输入关键词并搜索 ----------
    log(">>> 查找搜索输入框");
    var searchInput = utils.tryFind([
        className("EditText").descContains("搜索"),
        className("EditText")
    ], 5000);
    if (searchInput !== null) {
        utils.randomClick(searchInput);
        utils.sleepRandom(500, 1000);
        searchInput.setText(KEYWORD);
        log(">>> 已输入关键词: " + KEYWORD);
        utils.sleepRandom(500, 800);
        shell("input keyevent 66", true);
        log(">>> 已触发搜索");
        clearFail(); // +++ anti-detect
    } else {
        log(">>> 未找到搜索输入框");
        addFail(); // +++ anti-detect
        return;
    }

    utils.sleepRandom(2000, 3000);

    // ---------- 4. 点击第一个视频卡片 ----------
    log(">>> 查找第一个视频结果");
    var firstVideo = utils.tryFind([
        clickable(true).descMatches(/视频/),
        clickable(true).descContains("视频")
    ], 5000);
    if (firstVideo !== null) {
        utils.randomClick(firstVideo);
        log(">>> 已点击第一个视频");
        clearFail(); // +++ anti-detect
    } else {
        log(">>> 未找到视频卡片，使用相对坐标点击");
        press(device.width / 2, device.height * 0.35, utils.random(30, 80));
        addFail(); // +++ anti-detect
    }

    utils.sleepRandom(2000, 3000);
}

// ==================== 主流程 ====================
log(">>> 启动抖音");
app.launchPackage("com.ss.android.ugc.aweme");
sleep(5000);
log(">>> 抖音已启动");

enterSearchFlow();

// ---------- 5. 循环浏览视频 ----------
log(">>> 开始循环浏览，共 " + MAX_LOOPS + " 次");
for (var i = 0; i < MAX_LOOPS; i++) {
    log(">>> 第 " + (i + 1) + "/" + MAX_LOOPS + " 次");

    // +++ anti-detect: 20% 概率跳过本轮评论，只浏览不评论
    var skipComment = utils.random(1, 100) <= 20;
    if (skipComment) {
        log(">>> [anti-detect] 本轮跳过评论（20%概率）");
    }

    // +++ anti-detect: 评论前确认是否仍在视频播放页
    if (!skipComment) {
        var onHomePage = utils.tryFind([descContains("首页")], 1000);
        if (onHomePage !== null) {
            log(">>> [anti-detect] 已跳出视频流（检测到首页），尝试回退");
            back();
            utils.sleepRandom(800, 1200);
            addFail();
        } else {
            // 评论模块
            commentMod.performComment(COMMENTS);
            clearFail(); // +++ anti-detect
        }
    }

    // +++ anti-detect: 滑动起始点和终点各加入 ±50px 随机偏移
    var swipeX1 = device.width / 2 + utils.random(-50, 50);
    var swipeY1 = device.height * 0.8 + utils.random(-50, 50);
    var swipeX2 = device.width / 2 + utils.random(-50, 50);
    var swipeY2 = device.height * 0.2 + utils.random(-50, 50);
    utils.humanSwipe(swipeX1, swipeY1, swipeX2, swipeY2, 300);
    log(">>> 已滑动到下一个视频");

    // +++ anti-detect: 5% 概率额外随机点赞
    if (utils.random(1, 100) <= 5) {
        log(">>> [anti-detect] 随机点赞（5%概率）");
        var likeBtn = utils.tryFind([
            desc("赞"),
            descContains("赞"),
            desc("点赞")
        ], 2000);
        if (likeBtn !== null) {
            utils.randomClick(likeBtn);
            log(">>> 点赞成功");
        } else {
            log(">>> 未找到点赞按钮，忽略");
        }
    }

    utils.sleepRandom(3000, 8000);

    // +++ anti-detect: 每执行5次循环后，回退到搜索结果列表首屏再重新进入
    if ((i + 1) % 5 === 0) {
        log(">>> [anti-detect] 第" + (i + 1) + "次循环，模拟返回翻看");
        back();
        utils.sleepRandom(800, 1500);
        back();
        utils.sleepRandom(1500, 2500);
        // 重新点击第一个视频
        var replayVideo = utils.tryFind([
            clickable(true).descMatches(/视频/),
            clickable(true).descContains("视频")
        ], 5000);
        if (replayVideo !== null) {
            utils.randomClick(replayVideo);
            log(">>> [anti-detect] 已重新进入视频");
            clearFail();
        } else {
            log(">>> [anti-detect] 未找到视频卡片，使用相对坐标点击");
            press(device.width / 2, device.height * 0.35, utils.random(30, 80));
            addFail();
        }
        utils.sleepRandom(2000, 3000);
    }

    // +++ anti-detect: 每轮结束后检查连续失败次数
    if (failCount >= 3) {
        addFail(); // 内部会触发 restartDouyin
    }
}

log(">>> 所有循环执行完毕");
toast("脚本执行完成");
