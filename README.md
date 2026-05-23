# fund-dca-backtester

基金定投回测工具 API

## 快速开始

```bash
npm install
npm start      # 启动服务（端口 3000）
npm test       # 运行单元测试
```

## API

### POST /api/backtest/dca

请求体：

```json
{
  "fundName": "示例基金",
  "navData": [
    { "date": "2020-01-02", "nav": 1.0 },
    { "date": "2020-01-03", "nav": 1.01 }
  ],
  "startDate": "2020-01-01",
  "endDate": "2023-12-31",
  "periodicAmount": 1000,
  "frequency": "monthly"
}
```

响应：

```json
{
  "fundName": "示例基金",
  "summary": {
    "totalInvested": 48000,
    "holdingShares": 38452.1234,
    "endingAssets": 56300.56,
    "totalProfit": 8300.56,
    "totalReturnRate": 0.1729,
    "maxDrawdown": -0.1832,
    "lumpSumReturnRate": 0.2451
  },
  "curves": {
    "dca": [
      { "date": "2020-01-02", "value": 1000 }
    ],
    "lumpSum": [
      { "date": "2020-01-02", "value": 48000 }
    ]
  }
}
```

错误响应：

```json
{
  "error": {
    "code": "DUPLICATE_NAV_DATE",
    "message": "历史净值数据存在重复日期"
  }
}
```