/**
 * 计算器模块：定投回测核心算法
 */

const { parseNavData, validateNavData } = require('./validation');

/**
 * 从已排序的净值数据中，找到 >= targetDate 的第一条净值
 */
function findNavOnOrAfter(sortedNavData, targetDate) {
  return sortedNavData.find((r) => r.date >= targetDate) || null;
}

/**
 * 从已排序的净值数据中，找到 <= targetDate 的最后一条净值
 */
function findNavOnOrBefore(sortedNavData, targetDate) {
  let result = null;
  for (const r of sortedNavData) {
    if (r.date <= targetDate) {
      result = r;
    } else {
      break;
    }
  }
  return result;
}

/**
 * 生成 weekly 计划扣款日列表
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {string[]} 计划扣款日列表（YYYY-MM-DD）
 */
function generateWeeklySchedule(startDate, endDate) {
  const schedule = [];
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (cur <= end) {
    schedule.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return schedule;
}

/**
 * 生成 monthly 计划扣款日列表
 * 若目标月份没有该日，则使用该月最后一天
 */
function generateMonthlySchedule(startDate, endDate) {
  const schedule = [];
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  // 保存原始目标日（如 15、28、31），在每个月计算 actualDay 时使用
  const originalDay = cur.getUTCDate();
  while (cur <= end) {
    const year = cur.getUTCFullYear();
    const month = cur.getUTCMonth();

    // 计算该月最后一天
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    const actualDay = Math.min(originalDay, lastDayOfMonth.getUTCDate());

    schedule.push(
      new Date(Date.UTC(year, month, actualDay)).toISOString().slice(0, 10)
    );

    // 移动到下个月：先将 day 复位为 1，避免 31 日在 2 月溢出导致 day 歪斜
    cur.setUTCDate(1);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return schedule;
}

/**
 * 计算最大回撤（返回负数，如 -0.1825 表示 -18.25%）
 * @param {Array<{date:string, value:number}>} curve
 * @returns {number|null}
 */
function computeMaxDrawdown(curve) {
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of curve) {
    if (point.value <= 0) continue;
    if (point.value > peak) peak = point.value;
    const drawdown = (point.value - peak) / peak;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown === 0 && peak === 0 ? 0 : maxDrawdown;
}

/**
 * 主回测函数
 *
 * @param {object} params
 * @param {string} params.fundName
 * @param {Array<{date:string, nav:number}>} params.navData
 * @param {string} params.startDate  - YYYY-MM-DD
 * @param {string} params.endDate    - YYYY-MM-DD
 * @param {number} params.periodicAmount
 * @param {'weekly'|'monthly'} params.frequency
 * @returns {{fundName:string, summary:object, curves:object}}
 */
function runBacktest({ fundName, navData, startDate, endDate, periodicAmount, frequency }) {
  // 1. 校验并排序净值数据
  const errors = validateNavData(navData, startDate, endDate);
  if (errors.length > 0) {
    const e = errors[0];
    const err = new Error(e.message);
    err.code = e.code;
    err.details = e.details;
    throw err;
  }

  const sorted = parseNavData(navData);

  // 2. 确定期初 / 期末可用净值
  const firstNav = findNavOnOrAfter(sorted, startDate);
  const lastNav = findNavOnOrBefore(sorted, endDate);

  if (!firstNav) {
    const err = new Error('定投开始日期之后没有可用净值数据');
    err.code = 'NO_NAV_AFTER_START';
    throw err;
  }
  if (!lastNav) {
    const err = new Error('定投结束日期之前没有可用净值数据');
    err.code = 'NO_NAV_BEFORE_END';
    throw err;
  }

  // 3. 生成计划扣款日
  const schedule =
    frequency === 'weekly'
      ? generateWeeklySchedule(startDate, endDate)
      : generateMonthlySchedule(startDate, endDate);

  // 4. 执行每期买入，记录成功买入列表
  let holdingShares = 0;
  let investedCount = 0;
  const purchases = []; // [{ scheduledDate, buyDate, nav, shares, amount }]

  for (const schedDate of schedule) {
    const navRecord = findNavOnOrAfter(sorted, schedDate);
    if (!navRecord) continue; // 计划扣款日之后、定投结束日期之前无净值，跳过
    const buyDate = navRecord.date;
    const nav = navRecord.nav;
    const shares = periodicAmount / nav;
    holdingShares += shares;
    investedCount += 1;
    purchases.push({ scheduledDate: schedDate, buyDate, nav, shares, amount: periodicAmount });
  }

  const totalInvested = investedCount * periodicAmount;

  // 5. 构建定投资产曲线
  const dcaCurve = []; // [{date, value}]
  let currentShares = 0;
  let peakDca = 0;

  for (const navRecord of sorted) {
    if (navRecord.date < firstNav.date) continue;
    if (navRecord.date > lastNav.date) break;

    // 处理该日期触发的买入
    for (const p of purchases) {
      if (p.buyDate === navRecord.date) {
        currentShares += p.shares;
      }
    }

    const value = currentShares * navRecord.nav;
    if (value > 0) {
      dcaCurve.push({ date: navRecord.date, value });
      if (value > peakDca) peakDca = value;
    } else {
      dcaCurve.push({ date: navRecord.date, value: 0 });
    }
  }

  const maxDrawdown = computeMaxDrawdown(dcaCurve);

  // 6. 一次性买入计算
  const lumpSumAmount = totalInvested;
  const lumpSumShares = lumpSumAmount / firstNav.nav;
  const lumpSumCurve = [];
  for (const navRecord of sorted) {
    if (navRecord.date < firstNav.date) continue;
    if (navRecord.date > lastNav.date) break;
    lumpSumCurve.push({ date: navRecord.date, value: lumpSumShares * navRecord.nav });
  }

  const endingAssets = currentShares * lastNav.nav;
  const totalProfit = endingAssets - totalInvested;
  const totalReturnRate = totalInvested > 0 ? totalProfit / totalInvested : 0;

  const lumpSumEndingAssets = lumpSumShares * lastNav.nav;
  const lumpSumReturnRate =
    lumpSumAmount > 0 ? (lumpSumEndingAssets - lumpSumAmount) / lumpSumAmount : 0;

  return {
    fundName,
    summary: {
      totalInvested: Math.round(totalInvested * 100) / 100,
      holdingShares: Math.round(holdingShares * 10000) / 10000,
      endingAssets: Math.round(endingAssets * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalReturnRate: Math.round(totalReturnRate * 10000) / 10000,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      lumpSumReturnRate: Math.round(lumpSumReturnRate * 10000) / 10000,
    },
    curves: {
      dca: dcaCurve,
      lumpSum: lumpSumCurve,
    },
  };
}

module.exports = { runBacktest, computeMaxDrawdown, generateWeeklySchedule, generateMonthlySchedule };