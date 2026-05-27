const request = require('supertest');
const { app } = require('../src/routes');

describe('GET /api/funds', () => {
  test('返回10只基金列表', async () => {
    const res = await request(app).get('/api/funds');
    expect(res.status).toBe(200);
    expect(res.body.funds).toHaveLength(11);
    expect(res.body.funds[0]).toHaveProperty('code');
    expect(res.body.funds[0]).toHaveProperty('name');
  });
});

describe('GET /api/funds/:fundCode/nav', () => {
  test('有效基金返回净值数据', async () => {
    const res = await request(app).get('/api/funds/000001/nav');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fundCode', '000001');
    expect(res.body).toHaveProperty('fundName', '华夏成长混合');
    expect(res.body).toHaveProperty('navData');
    expect(Array.isArray(res.body.navData)).toBe(true);
    expect(res.body.navData.length).toBeGreaterThan(0);
    expect(res.body.navData[0]).toHaveProperty('date');
    expect(res.body.navData[0]).toHaveProperty('nav');
  });

  test('无效基金代码返回404 FUND_NOT_FOUND', async () => {
    const res = await request(app).get('/api/funds/999999/nav');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FUND_NOT_FOUND');
  });
});

describe('POST /api/backtest/dca-with-fund', () => {
  const validPayload = {
    fundCode: '000001',
    startDate: '2020-01-01',
    endDate: '2020-12-31',
    periodicAmount: 1000,
    frequency: 'monthly',
  };

  test('有效请求返回回测结果', async () => {
    const res = await request(app)
      .post('/api/backtest/dca-with-fund')
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fundName', '华夏成长混合');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('curves');
    expect(res.body.summary).toHaveProperty('totalInvested');
    expect(res.body.summary).toHaveProperty('totalReturnRate');
  });

  test('无效基金代码返回404 FUND_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/backtest/dca-with-fund')
      .send({ ...validPayload, fundCode: '999999' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FUND_NOT_FOUND');
  });

  test('参数校验失败返回400', async () => {
    const res = await request(app)
      .post('/api/backtest/dca-with-fund')
      .send({ ...validPayload, periodicAmount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('code');
  });

  test('日期范围无净值返回400 NO_NAV_AFTER_START', async () => {
    const res = await request(app)
      .post('/api/backtest/dca-with-fund')
      .send({ ...validPayload, startDate: '2030-01-01', endDate: '2030-12-31' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_NAV_AFTER_START');
  });
});

describe('health', () => {
  test('GET /health 返回 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});