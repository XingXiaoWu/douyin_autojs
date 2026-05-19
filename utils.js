"use strict";

const UTILS = (function () {

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
            let bounds = node.bounds();
            let x = random(bounds.left, bounds.right);
            let y = random(bounds.top, bounds.bottom);
            let pressTime = random(30, 80);
            press(x, y, pressTime);
            return true;
        } catch (e) {
            log("randomClick 失败: " + e);
            return false;
        }
    }

    /**
     * 使用三次贝塞尔曲线生成多点滑动手势，中间控制点随机偏移，模拟人类滑动轨迹。
     * 轨迹共 30 个点。
     * @param {number} x1 - 起点 X 坐标
     * @param {number} y1 - 起点 Y 坐标
     * @param {number} x2 - 终点 X 坐标
     * @param {number} y2 - 终点 Y 坐标
     * @param {number} duration - 手势总耗时（毫秒）
     */
    function humanSwipe(x1, y1, x2, y2, duration) {
        // 中间控制点随机偏移 ±150px
        let cpX = (x1 + x2) / 2 + random(-150, 150);
        let cpY = (y1 + y2) / 2 + random(-150, 150);

        let points = [];
        let steps = 30;

        for (let i = 0; i <= steps; i++) {
            let t = i / steps;
            // 二次贝塞尔曲线: B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
            let px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
            let py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;
            // 给每个轨迹点加微小随机抖动 ±3px，使轨迹更自然
            let jitterX = random(-3, 3);
            let jitterY = random(-3, 3);
            points.push([Math.round(px) + jitterX, Math.round(py) + jitterY]);
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
        for (let i = 0; i < selectorsArray.length; i++) {
            var t0 = Date.now();
            try {
                let result = selectorsArray[i].findOne(timeout);
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
        let node = textContains(txt).findOne(timeout);
        return node !== null;
    }

    /**
     * 安全返回：用 keyevent + 边缘滑动双保险。
     * 适配全面屏手势导航的 Android 设备，解决 back() 在某些设备上不生效的问题。
     */
    function safeBack() {
        shell("input keyevent 4", false);
        sleep(400);
        // 手势导航设备下 keyevent 有时不生效，左边缘右滑作为降级
        swipe(5, Math.round(device.height / 2),
              Math.round(device.width * 0.25), Math.round(device.height / 2), 200);
        sleep(300);
    }

    // 公开 API
    return {
        random: random,
        sleepRandom: sleepRandom,
        randomClick: randomClick,
        humanSwipe: humanSwipe,
        randomPick: randomPick,
        tryFind: tryFind,
        isPageLoaded: isPageLoaded,
        safeBack: safeBack
    };

})();

if (typeof module !== "undefined") {
    module.exports = UTILS;
}