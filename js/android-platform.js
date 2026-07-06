//  __      __                                        __
// /\ \  __/\ \                                      /\ \
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/
//                                    \_/__/    \/__/


// ============================================================
// 安卓平台桥接脚本
// ============================================================

(function() {
    'use strict';

    console.log('[AndroidPlatform] 脚本开始执行');

    // 等待桥接就绪
    if (typeof AndroidBridge !== 'undefined') {
        console.log('[AndroidPlatform] 桥接立即可用');
        initPlatform();
    } else {
        console.log('[AndroidPlatform] 等待桥接...');
        var checkInterval = setInterval(function() {
            if (typeof AndroidBridge !== 'undefined') {
                clearInterval(checkInterval);
                console.log('[AndroidPlatform] 桥接已就绪');
                initPlatform();
            }
        }, 200);
    }

    function initPlatform() {
        console.log('[AndroidPlatform] ===== 初始化 =====');

        try {
            AndroidBridge.log('[AndroidPlatform] 初始化成功');
        } catch (e) {}

        // ============================================================
        // 获取所有账号的所有物品数据（直接分析 localStorage）
        // ============================================================
        function getAllAccountsData() {
            console.log('[AndroidPlatform] 开始获取所有账号数据...');

            var allData = [];

            try {
                var raw = localStorage.getItem('ef5_data');
                if (!raw) {
                    console.log('[AndroidPlatform] localStorage 无数据');
                    return [];
                }

                var store = JSON.parse(raw);
                var accounts = store.accounts || [];
                var records = store.records || {};

                console.log('[AndroidPlatform] 账号数:', accounts.length);

                accounts.forEach(function(accName) {
                    var accRecords = records[accName] || [];
                    if (accRecords.length === 0) return;

                    // 按物品分组
                    var itemMap = {};
                    accRecords.forEach(function(rec) {
                        var item = rec.item;
                        if (!itemMap[item]) {
                            itemMap[item] = {
                                name: item,
                                weeks: []
                            };
                        }
                        var hasData = rec.prices.some(function(p) { return p !== null; });
                        if (hasData) {
                            itemMap[item].weeks.push({
                                week: rec.week,
                                prices: rec.prices
                            });
                        }
                    });

                    var itemNames = Object.keys(itemMap);
                    itemNames.forEach(function(itemName) {
                        var itemData = itemMap[itemName];
                        var weeks = itemData.weeks;

                        // 找最新一周
                        var latestWeek = null;
                        var latestPrices = null;
                        weeks.forEach(function(w) {
                            if (!latestWeek || w.week > latestWeek) {
                                latestWeek = w.week;
                                latestPrices = w.prices;
                            }
                        });

                        // ===== 调用 analyzeItemSafe 判断是否锁定 =====
                        var isLocked = false;
                        var predictions = [];
                        var observed = [];

                        // 构建 records 格式供 analyzeItemSafe 使用
                        var recsForAnalysis = weeks.map(function(w) {
                            return {
                                item: itemName,
                                week: w.week,
                                prices: w.prices
                            };
                        });

                        try {
                            var result = analyzeItemSafe(recsForAnalysis);
                            if (result) {
                                isLocked = (result.stage === 'locked');

                                // 如果有预测数据，取第一个未被排除的
                                if (result.eightPredictions) {
                                    var filtered = filterEightPredictions(result.eightPredictions, latestPrices || []);
                                    var remaining = filtered.filter(function(p) { return !p.eliminated; });
                                    if (remaining.length > 0) {
                                        predictions = remaining[0].predicted;
                                    } else if (filtered.length > 0) {
                                        predictions = filtered[0].predicted;
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('[AndroidPlatform] analyzeItemSafe 失败:', e);
                        }

                        // 如果预测为空，用原始数据
                        if (predictions.length === 0 && latestPrices) {
                            predictions = latestPrices.slice();
                            observed = latestPrices.slice();
                        } else {
                            observed = latestPrices ? latestPrices.slice() : [];
                        }

                        var hasComplete = latestPrices ? latestPrices.every(function(p) { return p !== null; }) : false;

                        allData.push({
                            account: accName,
                            item: itemName,
                            week: latestWeek || '',
                            predictions: predictions,
                            observed: observed,
                            isLocked: isLocked,
                            hasComplete: hasComplete
                        });
                    });
                });

            } catch (e) {
                console.error('[AndroidPlatform] 获取数据出错:', e);
            }

            console.log('[AndroidPlatform] 获取完成，共', allData.length, '个物品');
            return allData;
        }

        // ============================================================
        // 获取星期几
        // ============================================================
        function getDayOfWeek() {
            var days = ['日', '一', '二', '三', '四', '五', '六'];
            var now = new Date();
            return days[now.getDay()];
        }

        // ============================================================
        // 暴露全局函数
        // ============================================================
        window.getPredictionDataForNative = function() {
            return getAllAccountsData();
        };

        window.syncPredictionDataToNative = function() {
            console.log('[AndroidPlatform] 同步数据到原生...');
            var data = getAllAccountsData();
            var jsonStr = JSON.stringify(data);

            try {
                AndroidBridge.savePredictionData(jsonStr);
                console.log('[AndroidPlatform] 同步成功，', data.length, '个物品');
                return jsonStr;
            } catch (e) {
                console.error('[AndroidPlatform] 同步失败:', e);
                return null;
            }
        };

        // ============================================================
        // 自动同步：拦截数据变化事件
        // ============================================================

        // 1. 拦截 saveRecords
        var origSaveRecords = window.saveRecords;
        if (typeof origSaveRecords === 'function') {
            window.saveRecords = function(acc, recs) {
                origSaveRecords(acc, recs);
                console.log('[AndroidPlatform] 检测到数据保存，自动同步');
                setTimeout(function() {
                    window.syncPredictionDataToNative();
                }, 300);
            };
        }

        // 2. 拦截 addRecord
        var origAddRecord = window.addRecord;
        if (typeof origAddRecord === 'function') {
            window.addRecord = function() {
                var result = origAddRecord.apply(this, arguments);
                setTimeout(function() {
                    window.syncPredictionDataToNative();
                }, 500);
                return result;
            };
        }

        // 3. 拦截 ovSaveAll
        var origOvSaveAll = window.ovSaveAll;
        if (typeof origOvSaveAll === 'function') {
            window.ovSaveAll = function(item, week) {
                origOvSaveAll(item, week);
                setTimeout(function() {
                    window.syncPredictionDataToNative();
                }, 500);
            };
        }

        // 4. 拦截 deleteRecord
        var origDeleteRecord = window.deleteRecord;
        if (typeof origDeleteRecord === 'function') {
            window.deleteRecord = function(item, week) {
                origDeleteRecord(item, week);
                setTimeout(function() {
                    window.syncPredictionDataToNative();
                }, 300);
            };
        }

        // 5. 拦截 deleteItem
        var origDeleteItem = window.deleteItem;
        if (typeof origDeleteItem === 'function') {
            window.deleteItem = function(itemName) {
                origDeleteItem(itemName);
                setTimeout(function() {
                    window.syncPredictionDataToNative();
                }, 300);
            };
        }

        // 6. 拦截 renameItem
        var origRenameItem = window.renameItem;
        if (typeof origRenameItem === 'function') {
            window.renameItem = function(oldName) {
                origRenameItem(oldName);
                setTimeout(function() {
                    window.syncPredictionDataToNative();
                }, 300);
            };
        }

        console.log('[AndroidPlatform] ===== 初始化完成 =====');
        console.log('[AndroidPlatform] 已拦截 saveRecords, addRecord, ovSaveAll, deleteRecord, deleteItem, renameItem');

        // 启动时自动同步一次
        setTimeout(function() {
            window.syncPredictionDataToNative();
        }, 2000);
    }

})();