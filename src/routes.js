/**
 * Express 入口 & 路由
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { runBacktest } = require('./calculator');
const { validateRequest, validateNavData } = require('./validation');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 基金列表（内存元数据，与 data/ 下 JSON 文件对应）
const FUNDS_META = [
  { code: '000001', name: '华夏成长混合' },
  { code: '110022', name: '易方达消费行业股票' },
  { code: '161005', name: '富国天惠成长混合' },
  { code: '163402', name: '兴全趋势投资混合' },
  { code: '519001', name: '银华价值优选混合' },
  { code: '519688', name: '交银精选混合' },
  { code: '100032', name: '富国中证红利指数' },
  { code: '270008', name: '广发稳健增长混合' },
  { code: '360008', name: '光大增长混合' },
  { code: '460005', name: '华泰柏瑞价值增长混合' },
  { code: '012922', name: '易方达全球成长精选混合(QDII)C' },
];

const DATA_DIR = path.join(__dirname, '..', 'data');
const FUNDS = FUNDS_META.map((fund) => ({
  ...fund,
  fundCode: fund.code,
  fundName: fund.name,
}));

function readFundNav(fundCode) {
  const filePath = path.join(DATA_DIR, fundCode + '.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// GET /api/funds — 基金列表（代码 + 名称）
app.get('/api/funds', (_req, res) => {
  res.json({ funds: FUNDS });
});

// GET /api/funds/:fundCode/nav — 读取指定基金的净值数据
app.get('/api/funds/:fundCode/nav', (req, res) => {
  const { fundCode } = req.params;
  const fund = FUNDS.find((f) => f.code === fundCode);
  if (!fund) {
    return res.status(404).json({ error: { code: 'FUND_NOT_FOUND', message: '基金不存在' } });
  }
  const data = readFundNav(fundCode);
  if (!data) {
    return res.status(404).json({ error: { code: 'NAV_NOT_FOUND', message: '净值数据文件不存在' } });
  }
  res.json(data);
});

// POST /api/backtest/dca-with-fund — 使用本地基金净值数据进行定投回测
app.post('/api/backtest/dca-with-fund', (req, res) => {
  const { fundCode, startDate, endDate, periodicAmount, frequency } = req.body || {};

  const reqErrors = validateRequest({
    fundName: fundCode,
    navData: [],
    startDate,
    endDate,
    periodicAmount,
    frequency,
  });
  if (reqErrors.length > 0) {
    const e = reqErrors[0];
    return res.status(400).json({ error: { code: e.code, message: e.message } });
  }

  const fund = FUNDS.find((f) => f.code === fundCode);
  if (!fund) {
    return res.status(404).json({ error: { code: 'FUND_NOT_FOUND', message: '基金不存在' } });
  }

  const navFile = readFundNav(fundCode);
  if (!navFile) {
    return res.status(404).json({ error: { code: 'NAV_NOT_FOUND', message: '净值数据文件不存在' } });
  }

  const navData = navFile.navData;
  const navErrors = validateNavData(navData, startDate, endDate);
  if (navErrors.length > 0) {
    const e = navErrors[0];
    return res.status(400).json({ error: { code: e.code, message: e.message } });
  }

  try {
    const result = runBacktest({ fundName: fund.name, navData, startDate, endDate, periodicAmount, frequency });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: { code: err.code || 'CALCULATION_ERROR', message: err.message } });
  }
});

// POST /api/backtest/dca — 原始接口（传入 navData）
app.post('/api/backtest/dca', (req, res) => {
  const { fundCode, fundName: fallbackFundName, navData, startDate, endDate, periodicAmount, frequency } = req.body || {};

  // 优先使用 fundCode 查找基金名称，否则降级使用 fundName
  let actualFundName = fallbackFundName || '';
  if (fundCode) {
    const fund = FUNDS.find((f) => f.code === fundCode);
    if (fund) {
      actualFundName = fund.name;
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
