/**
 * store.js — JSON 持久化存储模块
 * ============================================================
 * 数据文件存放于 /sdcard/douyin_bot/data/
 * 用法:
 *   var store = require("./store.js");
 *   store.save("visited_users", { "userA": { time: "..." } });
 *   var users = store.load("visited_users");
 */

"use strict";

var STORE = (function() {

    var DATA_DIR = "/sdcard/douyin_bot/data/";

    /**
     * 确保数据目录存在
     */
    function ensureDir() {
        var dir = files.path(DATA_DIR);
        if (!files.exists(dir)) {
            files.createWithDirs(dir);
        }
    }

    /**
     * 获取文件完整路径
     * @param {string} name - 文件名（不含路径和扩展名）
     * @returns {string} 完整文件路径
     */
    function filePath(name) {
        return DATA_DIR + name + ".json";
    }

    /**
     * 读取 JSON 文件，返回解析后的对象
     * @param {string} name - 文件名
     * @param {*} [defaultValue={}] - 文件不存在时的默认值
     * @returns {*} 解析后的数据
     */
    function load(name, defaultValue) {
        ensureDir();
        if (defaultValue === undefined) defaultValue = {};
        var path = filePath(name);
        if (!files.exists(path)) return defaultValue;
        try {
            var raw = files.read(path);
            return JSON.parse(raw);
        } catch(e) {
            log("[store] load '" + name + "' 失败: " + e);
            return defaultValue;
        }
    }

    /**
     * 写入 JSON 文件
     * @param {string} name - 文件名
     * @param {*} data - 要保存的数据
     */
    function save(name, data) {
        ensureDir();
        try {
            var path = filePath(name);
            files.write(path, JSON.stringify(data, null, 2));
        } catch(e) {
            log("[store] save '" + name + "' 失败: " + e);
        }
    }

    /**
     * 读取并更新 JSON 文件（原子操作：读→改→写）
     * @param {string} name - 文件名
     * @param {Function} updater - 更新函数 (data) => newData
     */
    function update(name, updater) {
        var data = load(name);
        var updated = updater(data);
        save(name, updated);
        return updated;
    }

    /**
     * 删除数据文件
     * @param {string} name - 文件名
     */
    function remove(name) {
        var path = filePath(name);
        if (files.exists(path)) files.remove(path);
    }

    /**
     * 列出所有数据文件
     * @returns {string[]} 文件名列表
     */
    function list() {
        ensureDir();
        var result = [];
        var raw = files.listDir(DATA_DIR);
        for (var i = 0; i < raw.length; i++) {
            if (raw[i].endsWith(".json")) {
                result.push(raw[i].replace(".json", ""));
            }
        }
        return result;
    }

    // ========== 业务专用方法 ==========

    /**
     * 记录已私信用户
     * @param {string} keyword - 搜索关键词
     * @param {string} videoId  - 视频标识（前20字标题）
     * @param {string} username - 用户名
     */
    function markUserDMed(keyword, videoId, username) {
        update("visited_users", function(data) {
            var key = keyword + "__" + videoId;
            if (!data[key]) data[key] = {};
            data[key][username] = {
                time: new Date().toISOString(),
                video: videoId,
            };
            return data;
        });
    }

    /**
     * 检查用户是否已私信过
     * @param {string} keyword
     * @param {string} username
     * @returns {boolean}
     */
    function isUserDMed(keyword, username) {
        var data = load("visited_users");
        for (var key in data) {
            if (data[key][username]) return true;
        }
        return false;
    }

    /**
     * 记录已处理视频
     * @param {string} keyword - 搜索关键词
     * @param {string} videoTitle - 视频标题（前40字）
     */
    function markVideoProcessed(keyword, videoTitle) {
        update("processed_videos", function(data) {
            var key = keyword;
            if (!data[key]) data[key] = [];
            if (data[key].indexOf(videoTitle) < 0) {
                data[key].push(videoTitle);
                // 保留最近 20 条
                if (data[key].length > 20) data[key].shift();
            }
            return data;
        });
    }

    /**
     * 检查视频是否已处理过
     * @param {string} keyword
     * @param {string} videoTitle
     * @returns {boolean}
     */
    function isVideoProcessed(keyword, videoTitle) {
        var data = load("processed_videos");
        var arr = data[keyword] || [];
        return arr.indexOf(videoTitle) >= 0;
    }

    /**
     * 保存运行状态（断点续跑）
     * @param {object} state - {phase, currentVid, keyword, ...}
     */
    function saveState(state) {
        save("state", state);
    }

    /**
     * 读取运行状态
     * @returns {object|null}
     */
    function loadState() {
        return load("state", null);
    }

    // ========== 公开 API ==========
    return {
        load:    load,
        save:    save,
        update:  update,
        remove:  remove,
        list:    list,
        markUserDMed:      markUserDMed,
        isUserDMed:        isUserDMed,
        markVideoProcessed: markVideoProcessed,
        isVideoProcessed:   isVideoProcessed,
        saveState:          saveState,
        loadState:          loadState,
    };

})();

if (typeof module !== "undefined") {
    module.exports = STORE;
}
