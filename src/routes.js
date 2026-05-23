/**
 * Express 入口 & 路由
 */
const express = require('express');
const { runBacktest } = require('./calculator');
const { validateRequest, validateNavData } = require('./validation');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 基金列表数据（实际项目中应从数据库或缓存获取）
const FUNDS = [
  { fundCode: '000001', fundName: '沪深300指数增强' },
  { fundCode: '000002', fundName: '上证50ETF联接' },
  { fundCode: '000003', fundName: '中证500指数增强' },
  { fundCode: '000005', fundName: '创业板ETF联接' },
  { fundCode: '000008', fundName: '红利低波动ETF' },
  { fundCode: '000012', fundName: '消费行业股票' },
  { fundCode: '000015', fundName: '医药健康行业' },
  { fundCode: '000017', fundName: '科技龙头ETF' },
  { fundCode: '000021', fundName: '新能源ETF' },
  { fundCode: '000025', fundName: '金融地产ETF' },
];

// 获取基金列表（下拉框数据源）
app.get('/api/funds', (_req, res) => {
  res.json({ funds: FUNDS });
});

// 回测接口（支持 fundCode 或 fundName）
app.post('/api/backtest/dca', (req, res) => {
  const { fundCode, fundName: fallbackFundName, navData, startDate, endDate, periodicAmount, frequency } = req.body || {};

  // 优先使用 fundCode 查找基金名称，否则降级使用 fundName
  let actualFundName = fallbackFundName || '';
  if (fundCode) {
    const fund = FUNDS.find((f) => f.fundCode === fundCode);
    if (fund) {
      actualFundName = fund.fundName;
    } else if (!fallbackFundName) {
      return res.status(400).json({
        error: { code: 'INVALID_FUND_CODE', message: `未找到基金代码：${fundCode}` },
      });
    }
  }

  // 参数基本校验
  const reqErrors = validateRequest({ fundName: actualFundName, navData, startDate, endDate, periodicAmount, frequency });
  if (reqErrors.length > 0) {
    return res.status(400).json({
      error: { code: reqErrors[0].code, message: reqErrors[0].message },
    });
  }

  // 净值数据校验
  const navErrors = validateNavData(navData, startDate, endDate);
  if (navErrors.length > 0) {
    const e = navErrors[0];
    return res.status(400).json({ error: { code: e.code, message: e.message } });
  }

  try {
    const result = runBacktest({ fundName: actualFundName, navData, startDate, endDate, periodicAmount, frequency });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: { code: err.code || 'CALCULATION_ERROR', message: err.message } });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = { app };