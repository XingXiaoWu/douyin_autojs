/**
 * douyin_bot.js — 抖音自动化脚本
 * ============================================================
 * 功能：
 *   自动打开抖音 → 搜索关键词 → 进入视频流 → 浏览视频
 *   → 随机评论/点赞（拟人化操作）→ 循环N次
 *   内置反检测策略：概率跳过评论、随机点赞、回退翻看、
 *   连续失败自动重启、滑动轨迹随机偏移等。
 *
 * 使用方法：
 *   1. 在 AutoX.js 中导入并运行此脚本，或将此脚本打包为 APK。
 *   2. 启动后先在配置表单中填写关键词、评论、循环次数和概率。
 *   3. 点击“保存并启动”，脚本会保存配置并开始运行。
 *   4. 确保已授予**无障碍服务权限**和**悬浮窗权限**。
 *
 * 需配置的变量（CONFIG 内）：
 *   keyword       - {string}  搜索关键词
 *   commentsPool  - {string[]} 候选评论文案数组
 *   maxLoops      - {number}  最大浏览/评论循环次数
 *   skipRate      - {number}  跳过评论的概率（0-100）
 *   likeRate      - {number}  随机点赞的概率（0-100）
 *
 * 风险提示：
 *   ⚠ 本脚本仅供学习 AutoX.js 自动化技术使用。
 *   ⚠ 使用自动化脚本可能违反抖音用户协议。
 *   ⚠ 可能导致账号被限流、限制功能，严重时可能封禁。
 *   ⚠ 请自行评估并承担全部使用风险。
 * ============================================================
 */

"ui";
"use strict";

var CONFIG_FILE = null;
var CONFIG_FILE_CANDIDATES = [
    "/sdcard/douyin_bot/data/config.json",
    "/storage/emulated/0/douyin_bot/data/config.json"
];

try {
    if (files.cwd) {
        CONFIG_FILE_CANDIDATES.push(files.path(files.cwd() + "/douyin_bot/data/config.json"));
    }
} catch (e) { }

try {
    if (typeof context !== "undefined" && context.getFilesDir) {
        CONFIG_FILE_CANDIDATES.push(String(context.getFilesDir().getAbsolutePath()) + "/douyin_bot/data/config.json");
    }
} catch (e) { }

function getConfigDir(path) {
    return path.substring(0, path.lastIndexOf("/"));
}

function ensureDirWritable(dir) {
    var dirFile = new java.io.File(dir);
    if (dirFile.exists()) {
        if (!dirFile.isDirectory()) {
            throw new Error("配置目录被同名文件占用: " + dir);
        }
    } else if (!dirFile.mkdirs() && !dirFile.exists()) {
        throw new Error("无法创建配置目录: " + dir);
    }

    var probe = dir + "/.write_test";
    files.write(probe, "ok");
    files.remove(probe);
}

function resolveConfigFile() {
    if (CONFIG_FILE !== null) return CONFIG_FILE;

    var errors = [];
    for (var i = 0; i < CONFIG_FILE_CANDIDATES.length; i++) {
        var path = CONFIG_FILE_CANDIDATES[i];
        try {
            ensureDirWritable(getConfigDir(path));
            CONFIG_FILE = path;
            return CONFIG_FILE;
        } catch (e) {
            errors.push(path + " => " + e);
        }
    }

    throw new Error("没有可写配置目录: " + errors.join(" | "));
}

function loadConfigFile(defaultValue) {
    var path = resolveConfigFile();
    if (!files.exists(path)) return defaultValue;
    return JSON.parse(files.read(path));
}

function saveConfigFile(config) {
    var path = resolveConfigFile();
    files.write(path, JSON.stringify(config, null, 2));
}

// ==================== 配置 ====================
var DEFAULT_CONFIG = {
    keyword: "好物推荐",
    commentsPool: ["不错", "非常好", "下次一定", "已收藏"],
    maxLoops: 40,
    skipRate: 50,
    likeRate: 50
};

var CONFIG = loadSavedConfig();
var botThread = null;
var isRunning = false;

function cloneConfig(config) {
    return {
        keyword: String(config.keyword || ""),
        commentsPool: (config.commentsPool || []).slice(),
        maxLoops: Number(config.maxLoops || DEFAULT_CONFIG.maxLoops),
        skipRate: Number(config.skipRate || DEFAULT_CONFIG.skipRate),
        likeRate: Number(config.likeRate || DEFAULT_CONFIG.likeRate)
    };
}

function loadSavedConfig() {
    try {
        return normalizeConfigForRuntime(loadConfigFile(DEFAULT_CONFIG));
    } catch (e) {
        log("读取配置失败，使用默认配置: " + e);
        return cloneConfig(DEFAULT_CONFIG);
    }
}

function normalizeConfigForRuntime(raw) {
    var cfg = cloneConfig(DEFAULT_CONFIG);
    if (!raw) return cfg;

    if (raw.keyword !== undefined) cfg.keyword = String(raw.keyword).trim();
    if (raw.commentsPool instanceof Array) {
        cfg.commentsPool = raw.commentsPool;
    } else if (raw.commentsPool !== undefined) {
        cfg.commentsPool = parseCommentsText(raw.commentsPool);
    }
    if (raw.maxLoops !== undefined) cfg.maxLoops = parseInt(raw.maxLoops, 10);
    if (raw.skipRate !== undefined) cfg.skipRate = parseInt(raw.skipRate, 10);
    if (raw.likeRate !== undefined) cfg.likeRate = parseInt(raw.likeRate, 10);

    if (!cfg.keyword) cfg.keyword = DEFAULT_CONFIG.keyword;
    if (!cfg.commentsPool.length) cfg.commentsPool = DEFAULT_CONFIG.commentsPool.slice();
    if (isNaN(cfg.maxLoops)) cfg.maxLoops = DEFAULT_CONFIG.maxLoops;
    if (isNaN(cfg.skipRate)) cfg.skipRate = DEFAULT_CONFIG.skipRate;
    if (isNaN(cfg.likeRate)) cfg.likeRate = DEFAULT_CONFIG.likeRate;

    return cfg;
}

function parseCommentsText(textValue) {
    var raw = String(textValue || "").replace(/，/g, ",").split(/[\n,]/);
    var result = [];
    for (var i = 0; i < raw.length; i++) {
        var item = String(raw[i]).trim();
        if (item.length > 0) result.push(item);
    }
    return result;
}

function commentsToText(commentsPool) {
    return commentsPool && commentsPool.length ? commentsPool.join("\n") : "";
}

function readAndValidateConfigFromUi() {
    var keyword = String(ui.keywordInput.text() || "").trim();
    var commentsPool = parseCommentsText(ui.commentsInput.text());
    var maxLoops = parseInt(String(ui.maxLoopsInput.text() || "").trim(), 10);
    var skipRate = parseInt(String(ui.skipRateInput.text() || "").trim(), 10);
    var likeRate = parseInt(String(ui.likeRateInput.text() || "").trim(), 10);

    if (!keyword) return { ok: false, message: "请输入搜索关键词" };
    if (keyword.length > 50) return { ok: false, message: "搜索关键词不能超过 50 个字符" };
    if (!commentsPool.length) return { ok: false, message: "请至少填写一条评论文案" };
    if (commentsPool.length > 100) return { ok: false, message: "评论文案最多支持 100 条" };

    for (var i = 0; i < commentsPool.length; i++) {
        if (commentsPool[i].length > 100) {
            return { ok: false, message: "单条评论不能超过 100 个字符：" + commentsPool[i] };
        }
    }

    if (isNaN(maxLoops) || maxLoops < 1 || maxLoops > 1000) {
        return { ok: false, message: "循环次数必须是 1-1000 的整数" };
    }
    if (isNaN(skipRate) || skipRate < 0 || skipRate > 100) {
        return { ok: false, message: "跳过评论概率必须是 0-100 的整数" };
    }
    if (isNaN(likeRate) || likeRate < 0 || likeRate > 100) {
        return { ok: false, message: "点赞概率必须是 0-100 的整数" };
    }

    return {
        ok: true,
        config: {
            keyword: keyword,
            commentsPool: commentsPool,
            maxLoops: maxLoops,
            skipRate: skipRate,
            likeRate: likeRate
        }
    };
}

function saveConfigFromUi() {
    var result;
    try {
        result = readAndValidateConfigFromUi();
        if (!result.ok) {
            toast(result.message);
            return null;
        }
    } catch (e) {
        toast("读取配置失败: " + e);
        return null;
    }

    CONFIG = result.config;
    try {
        saveConfigFile(CONFIG);
    } catch (e) {
        toast("保存配置失败: " + e);
        return null;
    }
    return CONFIG;
}

function bindUiClick(view, handler) {
    if (!view) return;
    if (typeof view.click === "function") {
        view.click(handler);
    } else {
        view.on("click", handler);
    }
}

ui.layout(
    <frame>
        <scroll>
            <vertical padding="16">
                <text text="抖音自动化配置" textSize="22sp" textStyle="bold" marginBottom="12" />
                <text text="搜索关键词" />
                <input id="keywordInput" hint="例如：好物推荐" singleLine="true" />
                <text text="评论文案（一行一条，也支持逗号分隔）" marginTop="12" />
                <input id="commentsInput" hint="不错&#10;非常好&#10;已收藏" minLines="5" gravity="top" />
                <text text="最大循环次数" marginTop="12" />
                <input id="maxLoopsInput" inputType="number" singleLine="true" />
                <text text="跳过评论概率（0-100）" marginTop="12" />
                <input id="skipRateInput" inputType="number" singleLine="true" />
                <text text="点赞概率（0-100）" marginTop="12" />
                <input id="likeRateInput" inputType="number" singleLine="true" />
                <button id="startBtn" text="保存并启动" marginTop="18" />
                <button id="saveBtn" text="仅保存配置" />
                <text text="提示：打包 APK 后会先显示本页面，点击保存并启动后才会运行自动化。" textColor="#666666" textSize="12sp" marginTop="12" />
            </vertical>
        </scroll>
    </frame>
);

ui.keywordInput.setText(CONFIG.keyword);
ui.commentsInput.setText(commentsToText(CONFIG.commentsPool));
ui.maxLoopsInput.setText(String(CONFIG.maxLoops));
ui.skipRateInput.setText(String(CONFIG.skipRate));
ui.likeRateInput.setText(String(CONFIG.likeRate));

bindUiClick(ui.saveBtn, function () {
    if (saveConfigFromUi()) toast("配置已保存");
});

bindUiClick(ui.startBtn, function () {
    if (saveConfigFromUi()) startBot();
});

// ==================== 屏幕适配 ====================
setScreenMetrics(1080, 2400);

function sx(ratio) {
    return Math.round(device.width * ratio);
}

function sy(ratio) {
    return Math.round(device.height * ratio);
}

/**
 * 带时间戳的日志输出
 * @param {string} msg - 日志消息
 */
function tlog(msg) {
    log(util.format("[%s] %s", new Date().toLocaleTimeString(), msg));
}

/**
 * 调试用：打印当前页面关键控件快照（文本 + 可点击元素，最多40条）
 */
function dumpPageInfo(label) {
    if (!label) label = "页面快照";
    tlog("=== " + label + " ===");
    var total = 0;
    try {
        var all = textMatches(/./).find();
        total = all.size();
        var count = Math.min(total, 40);
        for (var di = 0; di < count; di++) {
            try {
                var e = all.get(di);
                var txt = (e.text() || "");
                var ds = (e.desc() || "");
                var cls = (e.className() || "").replace("android.widget.", "");
                var b = e.bounds();
                var pos = "(" + Math.round(b.centerX()) + "," + Math.round(b.centerY()) + ")";
                if (txt.length > 40) txt = txt.substring(0, 40) + "...";
                if (ds.length > 40) ds = ds.substring(0, 40) + "...";
                log(util.format("  [%s] text=\"%s\" desc=\"%s\" pos=%s", cls, txt, ds, pos));
            } catch (e2) { }
        }
    } catch (e3) {
        tlog("dumpPage 异常: " + e3);
    }
    tlog("=== " + label + " 结束 (" + Math.min(total, 40) + "条) ===");
}

// ==================== 工具函数（内联自 utils.js） ====================

/**
 * 返回两数之间的随机整数（包含 min 和 max）
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} [min, max] 区间内的随机整数
 */
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机睡眠一段时间，模拟人类操作间隔
 * @param {number} minMs - 最短睡眠毫秒数
 * @param {number} maxMs - 最长睡眠毫秒数
 */
function sleepRandom(minMs, maxMs) {
    sleep(random(minMs, maxMs));
}

/**
 * 在指定控件的 bounds 区域内随机坐标按下随机时长，模拟人类点击的不精确性。
 * 若 node 为 null，则返回 false。
 * @param {UiObject|null} node - 目标控件
 * @returns {boolean} 是否成功执行点击
 */
function randomClick(node) {
    if (node === null) {
        return false;
    }
    try {
        var b = node.bounds();
        var x = random(b.left, b.right);
        var y = random(b.top, b.bottom);
        press(x, y, random(30, 80));
        return true;
    } catch (e) {
        log("randomClick 失败: " + e);
        return false;
    }
}

/**
 * 使用二次贝塞尔曲线生成多点滑动手势，中间控制点随机偏移，模拟人类滑动轨迹。
 * 轨迹共 30 个点，每点加 ±3px 微抖动。
 * @param {number} x1 - 起点 X 坐标
 * @param {number} y1 - 起点 Y 坐标
 * @param {number} x2 - 终点 X 坐标
 * @param {number} y2 - 终点 Y 坐标
 * @param {number} duration - 手势总耗时（毫秒）
 */
function humanSwipe(x1, y1, x2, y2, duration) {
    var cpX = (x1 + x2) / 2 + random(-150, 150);
    var cpY = (y1 + y2) / 2 + random(-150, 150);

    var points = [];
    var steps = 30;

    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
        var py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;
        points.push([Math.round(px) + random(-3, 3), Math.round(py) + random(-3, 3)]);
    }

    gesture(duration, points);
}

/**
 * 从数组中随机返回一个元素
 * @param {Array} arr - 源数组
 * @returns {*} 随机选中的元素，若数组为空则返回 undefined
 */
function randomPick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[random(0, arr.length - 1)];
}

/**
 * 依次尝试一组选择器查找控件，返回第一个找到的非 null 控件。
 * 全部失败则返回 null 并打印日志。
 * @param {Array<UiSelector>} selectorsArray - 选择器描述数组，如 [desc("搜索"), id("search")]
 * @param {number} [timeout=1000] - 每个选择器的查找超时时间（毫秒）
 * @returns {UiObject|null} 找到的第一个控件，或 null
 */
function tryFind(selectorsArray, timeout) {
    timeout = timeout || 1000;
    for (var i = 0; i < selectorsArray.length; i++) {
        var t0 = Date.now();
        try {
            var result = selectorsArray[i].findOne(timeout);
            var elapsed = Date.now() - t0;
            if (elapsed > 500) {
                log("tryFind[" + i + "] 耗时 " + elapsed + "ms" + (result ? " ✓" : " ✗"));
            }
            if (result !== null) {
                return result;
            }
        } catch (e) {
            log("tryFind[" + i + "] 异常: " + e);
        }
    }
    log("tryFind: 所有选择器均未找到控件");
    return null;
}

/**
 * 判断当前屏幕是否出现包含指定文本的控件
 * @param {string} txt - 要查找的文本
 * @param {number} [timeout=3000] - 查找超时时间（毫秒）
 * @returns {boolean} 是否找到
 */
function isPageLoaded(txt, timeout) {
    timeout = timeout || 3000;
    var node = textContains(txt).findOne(timeout);
    return node !== null;
}

/**
 * 安全返回：先 back()，再左边缘右滑手势降级。
 * 适配全面屏手势导航的 Android 设备。
 */
function safeBack() {
    back()
    // shell("input keyevent 4", false);
    sleep(400);
    swipe(5, Math.round(device.height / 2),
        Math.round(device.width * 0.25), Math.round(device.height / 2), 200);
    sleep(300);
}

/**
 * 智能点击：先找元素获取真实坐标，再 press，不受 clk=false 影响。
 * 调用方式: smartClick(desc("搜索")) 或 smartClick(text("视频").findOne(3000))
 * @param {UiObject|null} node
 * @returns {boolean} 是否成功
 */
function smartClick(node) {
    if (node === null) return false;
    try {
        if (node.clickable()) {
            // clk=true 的元素优先用无障碍 click
            node.click();
            return true;
        }
        // clk=false 则取坐标 press
        var b = node.bounds();
        press(Math.round(b.centerX()), Math.round(b.centerY()), random(40, 80));
        return true;
    } catch (e) {
        // click 失败降级为坐标 press
        try {
            var b2 = node.bounds();
            press(Math.round(b2.centerX()), Math.round(b2.centerY()), random(40, 80));
            return true;
        } catch (e2) {
            log("smartClick 失败: " + e2);
            return false;
        }
    }
}

/**
 * 带延迟的 smartClick —— 找到元素后点击
 * @param {UiSelector} selector - 选择器
 * @param {number} timeout - findOne 超时
 * @returns {boolean}
 */
function findAndClick(selector, timeout) {
    timeout = timeout || 3000;
    var node = selector.findOne(timeout);
    return smartClick(node);
}

/**
 * 模拟人类逐字输入，每个字符间隔 50~200ms
 */
function humanType(node, text) {
    var typed = "";
    for (var i = 0; i < text.length; i++) {
        typed += text.charAt(i);
        node.setText(typed);
        sleep(random(80, 300));
    }
}

/**
 * 在抖音视频评论区发送一条随机评论
 * @param {string[]} commentsArray - 候选评论文案数组
 */
function performComment(commentsArray) {
    if (!commentsArray || commentsArray.length === 0) {
        tlog("performComment: 评论数组为空，跳过");
        return;
    }

    // --- 1. 点评论入口 ---
    var cb = tryFind([descContains("评论")], 1000);
    if (cb !== null && smartClick(cb)) {
        // 已点
    } else {
        press(sx(0.92), sy(0.64), random(30, 80));
    }
    sleepRandom(1000, 1500);

    // --- 2. 等评论区弹出 ---
    var panel = tryFind([textContains("有爱评论"), textContains("说点儿"), className("EditText")], 2000);
    if (panel === null) {
        tlog("评论区未弹出，跳过");
        safeBack();
        return;
    }
    tlog("评论区已弹出");

    // --- 3. 点输入框唤起键盘 → 重新获取输入框 → 逐字输入 ---
    smartClick(panel);           // 聚焦，弹出键盘
    sleepRandom(500, 800);
    // 键盘弹出后视图刷新，重新获取输入框
    var inputBox = tryFind([textContains("有爱评论"), textContains("说点儿"), className("EditText")], 1500);
    if (inputBox === null) {
        tlog("输入框失效，跳过评论");
        safeBack();
        return;
    }
    var msg = randomPick(commentsArray);
    humanType(inputBox, msg);
    tlog("输入评论: " + msg);
    sleepRandom(500, 800);

    // --- 4. 点击发送按钮（输入文字后才会出现）---
    var sendBtn = tryFind([text("发送"), descContains("发送"), desc("发送")], 2000);
    if (sendBtn !== null) {
        smartClick(sendBtn);
        tlog("已点击发送按钮");
    } else {
        tlog("发送按钮未找到，尝试回车发送");
        shell("input keyevent 66", false);
    }
    sleepRandom(800, 1200);
    safeBack();
    tlog("performComment: 完成");
}

// ==================== 反检测状态管理 ====================

var failCount = 0;       // 连续失败计数器
var restartCount = 0;       // 当前已重启次数
var MAX_RESTARTS = 3;       // 最大允许重启次数

/**
 * 记录一次操作失败，累积到 3 次触发重启
 */
function addFail() {
    failCount++;
    tlog("[anti-detect] 失败计数: " + failCount + "/3");
    if (failCount >= 3) {
        if (restartCount >= MAX_RESTARTS) {
            tlog("[anti-detect] 已达最大重启次数，终止脚本");
            toast("连续失败过多，脚本终止");
            exit();
        }
        tlog("[anti-detect] 连续失败3次，重启抖音");
        restartDouyin();
    }
}

/**
 * 操作成功时重置连续失败计数
 */
function clearFail() {
    failCount = 0;
}

/**
 * 重启抖音并重新进入搜索 → 视频流
 */
function restartDouyin() {
    restartCount++;
    tlog("[anti-detect] 第 " + restartCount + " 次重启");
    shell("am force-stop com.ss.android.ugc.aweme", true);
    sleep(2000);
    app.launchPackage("com.ss.android.ugc.aweme");
    sleep(8000);
    enterSearchFlow();
    clearFail();
}

// ==================== 核心流程 ====================

/**
 * 搜索关键词 → 进入第一个视频
 * 提取为独立函数，供首次进入和重启恢复复用。
 */
function enterSearchFlow() {
    // --- 1. 搜索图标 ---
    tlog("点搜索图标");
    var si = desc("搜索").findOne(5000);
    if (si !== null) smartClick(si);
    else press(sx(0.93), sy(0.078), 80);
    sleepRandom(2000, 3000);

    // --- 2. 输入关键词 + 点搜索按钮 ---
    tlog("输入关键词");
    var input = className("EditText").findOne(3000);
    if (input !== null) {
        smartClick(input);
        sleepRandom(300, 500);
        input.setText(CONFIG.keyword);
        sleepRandom(300, 500);
        var searchBtn = desc("搜索").findOne(2000);
        smartClick(searchBtn);
        tlog("已输入: " + CONFIG.keyword + " + 搜索");
    } else {
        tlog("输入框未找到");
        addFail();
        return;
    }
    sleepRandom(3000, 4000);

    // --- 3. 视频标签 ---
    tlog("点视频标签");
    var vt = findVideoTab();
    if (vt !== null) smartClick(vt);
    sleepRandom(2000, 3000);

    // --- 4. 点第一个视频 ---
    tlog("点第一个视频");
    var fv = findFirstVideoCard();
    if (fv !== null) smartClick(fv);
    else press(sx(0.25), sy(0.43), 80);
    sleepRandom(2000, 3000);
    press(sx(0.5), sy(0.17), 80); // 消半页
    sleepRandom(1500, 2500);

    tlog("已进入视频");
}

/** 在 ActionBar$Tab 中找 "视频" 标签 */
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
    } catch (e) { }
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
                // 视频卡片通常在 Y: 0.36~0.54，且 X>0.05（避免负坐标幽灵元素）
                // 同时过滤太窄的元素（可能是分割线/图标）
                if (b.centerY() > sy(0.36) && b.centerY() < sy(0.54)
                    && b.centerX() > sx(0.05) && b.width() > sx(0.1)) {
                    tlog("findFirstVideoCard: pos=(" + Math.round(b.centerX()) + "," + Math.round(b.centerY()) + ") size=" + b.width() + "x" + b.height());
                    return el;
                }
            } catch (e) { }
        }
    } catch (e) { tlog("findFirstVideoCard 异常: " + e); }
    return null;
}

/**
 * 主循环：浏览视频 + 评论 + 滑动 + 反检测策略
 */
function browseLoop() {
    tlog("开始循环浏览，共 " + CONFIG.maxLoops + " 次");
    for (var i = 0; i < CONFIG.maxLoops; i++) {
        tlog(">>> 第 " + (i + 1) + "/" + CONFIG.maxLoops + " 次");

        // --- 反检测: 20% 概率跳过本轮评论 ---
        var skipComment = random(1, 100) <= CONFIG.skipRate;
        if (skipComment) {
            tlog("[anti-detect] 本轮跳过评论（" + CONFIG.skipRate + "% 概率）");
        }

        // --- 反检测: 评论前确认是否仍在视频播放页 ---
        if (!skipComment) {
            var onHomePage = tryFind([descContains("首页")], 1000);
            if (onHomePage !== null) {
                tlog("[anti-detect] 已跳出视频流（检测到首页），尝试回退");
                safeBack();
                sleepRandom(800, 1200);
                addFail();
            } else {
                performComment(CONFIG.commentsPool);
                clearFail();
            }
        }

        // --- 反检测: 滑动起终点 ±50px 随机偏移 ---
        var swipeX1 = sx(0.5) + random(-50, 50);
        var swipeY1 = sy(0.8) + random(-50, 50);
        var swipeX2 = sx(0.5) + random(-50, 50);
        var swipeY2 = sy(0.2) + random(-50, 50);
        humanSwipe(swipeX1, swipeY1, swipeX2, swipeY2, 300);
        tlog("已滑动到下一个视频");

        // --- 反检测: 5% 概率随机点赞 ---
        if (random(1, 100) <= CONFIG.likeRate) {
            tlog("[anti-detect] 随机点赞");
            sleepRandom(800, 1200);
            press(sx(0.92), sy(0.55), random(30, 80));
            tlog("点赞（坐标直点）");
        }

        sleepRandom(3000, 8000);

        // --- 反检测: 每5次循环回退至搜索结果首屏再重新进入 ---
        if ((i + 1) % 5 === 0) {
            tlog("[anti-detect] 第" + (i + 1) + "次循环，模拟返回翻看");
            safeBack();
            sleepRandom(800, 1500);
            var _vt = findVideoTab();
            if (_vt !== null) smartClick(_vt);
            else press(sx(0.26), sy(0.133), 80);
            sleepRandom(2000, 3000);
            var _fv = findFirstVideoCard();
            if (_fv !== null) smartClick(_fv);
            else press(sx(0.25), sy(0.43), 80);
            sleepRandom(2000, 3000);
            press(sx(0.5), sy(0.17), 80);
            sleepRandom(1500, 2000);
            tlog("[anti-detect] 已重新进入视频");
            clearFail();
        }

        // --- 反检测: 每轮结束后检查连续失败次数 ---
        if (failCount >= 3) {
            addFail(); // 内部触发 restartDouyin
        }
    }
}

// ==================== 主入口 ====================

function main() {
    tlog(">>> 启动抖音");
    app.launchPackage("com.ss.android.ugc.aweme");
    sleep(8000);
    tlog(">>> 抖音已启动");

    enterSearchFlow();
    browseLoop();

    tlog(">>> 所有循环执行完毕");
    toast("脚本执行完成");
}

function setRunningState(running) {
    isRunning = running;
    ui.run(function () {
        ui.startBtn.setEnabled(!running);
        ui.startBtn.setText(running ? "运行中..." : "保存并启动");
    });
}

function startBot() {
    if (isRunning) {
        toast("脚本正在运行中");
        return;
    }

    setRunningState(true);
    botThread = threads.start(function () {
        try {
            console.show();
            auto();
            main();
        } catch (e) {
            log("脚本运行异常: " + e);
            toast("脚本运行异常: " + e);
        } finally {
            setRunningState(false);
            botThread = null;
        }
    });
}
