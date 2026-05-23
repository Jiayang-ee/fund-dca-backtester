/**
 * 校验模块：净值数据、请求参数校验
 */

/**
 * 解析并排序净值数据
 * @param {Array<{date:string, nav:number}>} navData
 * @returns {Array<{date:string, nav:number}>} 按 date 升序排列
 */
function parseNavData(navData) {
  return [...navData].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 校验净值数据合法性
 * @param {Array<{date:string, nav:number}>} navData
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Array<{code:string, message:string, details?:object}>}
 */
function validateNavData(navData, startDate, endDate) {
  const errors = [];

  if (!Array.isArray(navData) || navData.length === 0) {
    errors.push({ code: 'INVALID_NAV_DATA', message: '历史净值数据不能为空' });
    return errors;
  }

  const seen = new Set();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  for (let i = 0; i < navData.length; i++) {
    const r = navData[i];

    if (!dateRegex.test(r.date)) {
      errors.push({
        code: 'INVALID_NAV_DATA',
        message: `第 ${i + 1} 条净值日期格式非法，应为 YYYY-MM-DD，实际：${r.date}`,
        details: { index: i, date: r.date },
      });
      continue;
    }

    if (seen.has(r.date)) {
      errors.push({
        code: 'DUPLICATE_NAV_DATE',
        message: `历史净值数据存在重复日期：${r.date}`,
        details: { index: i, date: r.date },
      });
    }
    seen.add(r.date);

    const nav = Number(r.nav);
    if (isNaN(nav) || nav <= 0) {
      errors.push({
        code: 'INVALID_NAV',
        message: `日期 ${r.date} 的净值必须为大于 0 的数字，实际：${r.nav}`,
        details: { index: i, date: r.date, nav: r.nav },
      });
    }
  }

  if (errors.length > 0) return errors;

  // 检查区间内是否有可用净值
  const sorted = parseNavData(navData);
  const hasAfterStart = sorted.some((r) => r.date >= startDate);
  const hasBeforeEnd = sorted.some((r) => r.date <= endDate);

  if (!hasAfterStart) {
    errors.push({
      code: 'NO_NAV_AFTER_START',
      message: `定投开始日期 ${startDate} 之后没有可用净值数据`,
    });
  }
  if (!hasBeforeEnd) {
    errors.push({
      code: 'NO_NAV_BEFORE_END',
      message: `定投结束日期 ${endDate} 之前没有可用净值数据`,
    });
  }

  return errors;
}

/**
 * 校验请求参数
 * @returns {{code:string, message:string}[]}
 */
function validateRequest({ fundName, navData, startDate, endDate, periodicAmount, frequency }) {
  const errors = [];

  if (!fundName || typeof fundName !== 'string' || fundName.length < 1 || fundName.length > 100) {
    errors.push({ code: 'INVALID_FUND_NAME', message: '基金名称必须为 1-100 个字符' });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) {
    errors.push({ code: 'INVALID_START_DATE', message: `定投开始日期格式非法，应为 YYYY-MM-DD，实际：${startDate}` });
  }
  if (!dateRegex.test(endDate)) {
    errors.push({ code: 'INVALID_END_DATE', message: `定投结束日期格式非法，应为 YYYY-MM-DD，实际：${endDate}` });
  }
  if (dateRegex.test(startDate) && dateRegex.test(endDate) && startDate > endDate) {
    errors.push({ code: 'DATE_RANGE_INVALID', message: '定投开始日期不得晚于结束日期' });
  }

  const amount = Number(periodicAmount);
  if (isNaN(amount) || amount <= 0) {
    errors.push({
      code: 'INVALID_PERIODIC_AMOUNT',
      message: `每期定投金额必须为大于 0 的数字，实际：${periodicAmount}`,
    });
  }

  if (frequency !== 'weekly' && frequency !== 'monthly') {
    errors.push({ code: 'INVALID_FREQUENCY', message: '定投频率必须为 weekly 或 monthly' });
  }

  return errors;
}

module.exports = { parseNavData, validateNavData, validateRequest };