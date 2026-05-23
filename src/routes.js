/**
 * Express 入口 & 路由
 */
const express = require('express');
const { runBacktest } = require('./calculator');
const { validateRequest, validateNavData } = require('./validation');

const app = express();
app.use(express.json());

app.post('/api/backtest/dca', (req, res) => {
  const { fundName, navData, startDate, endDate, periodicAmount, frequency } = req.body || {};

  // 参数基本校验
  const reqErrors = validateRequest(req.body || {});
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
    const result = runBacktest({ fundName, navData, startDate, endDate, periodicAmount, frequency });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: { code: err.code || 'CALCULATION_ERROR', message: err.message } });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = { app };