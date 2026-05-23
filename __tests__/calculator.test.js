const {
  runBacktest,
  computeMaxDrawdown,
  generateWeeklySchedule,
  generateMonthlySchedule,
} = require('../src/calculator');
const { parseNavData, validateNavData, validateRequest } = require('../src/validation');

describe('generateWeeklySchedule', () => {
  test('生成每周计划扣款日，正确包含起止日期', () => {
    const sched = generateWeeklySchedule('2020-01-01', '2020-01-21');
    expect(sched).toEqual([
      '2020-01-01', '2020-01-08', '2020-01-15',
    ]);
    expect(sched[0]).toBe('2020-01-01');
  });

  test('起止日期相同时应只返回一天', () => {
    const sched = generateWeeklySchedule('2020-01-01', '2020-01-01');
    expect(sched).toEqual(['2020-01-01']);
  });
});

describe('generateMonthlySchedule', () => {
  test('每月同日生成扣款日', () => {
    const sched = generateMonthlySchedule('2020-01-15', '2020-04-15');
    expect(sched).toEqual(['2020-01-15', '2020-02-15', '2020-03-15', '2020-04-15']);
  });

  test('1月31日 → 2月无31日，使用2月最后一天 2020-02-29（2020是闰年）', () => {
    const sched = generateMonthlySchedule('2020-01-31', '2020-03-31');
    expect(sched[0]).toBe('2020-01-31');
    expect(sched[1]).toBe('2020-02-29'); // 闰年2月最后一天
    expect(sched[2]).toBe('2020-03-31');
  });

  test('2月28日（非闰年）→ 3月使用3月28日', () => {
    const sched = generateMonthlySchedule('2021-02-28', '2021-04-28');
    expect(sched[0]).toBe('2021-02-28');
    expect(sched[1]).toBe('2021-03-28');
    expect(sched[2]).toBe('2021-04-28');
  });
});

describe('computeMaxDrawdown', () => {
  test('净值单边上行，无回撤', () => {
    const curve = [
      { date: '2020-01-01', value: 1000 },
      { date: '2020-01-02', value: 1100 },
      { date: '2020-01-03', value: 1200 },
    ];
    expect(computeMaxDrawdown(curve)).toBe(0);
  });

  test('净值回落后，计算正确最大回撤', () => {
    const curve = [
      { date: '2020-01-01', value: 1000 },
      { date: '2020-01-02', value: 1200 }, // peak=1200
      { date: '2020-01-03', value: 900 },  // 回撤 = (900-1200)/1200 = -0.25
      { date: '2020-01-04', value: 1000 },
    ];
    expect(computeMaxDrawdown(curve)).toBe(-0.25);
  });

  test('value 为 0 的点不参与计算', () => {
    const curve = [
      { date: '2020-01-01', value: 0 },
      { date: '2020-01-02', value: 1000 },
    ];
    expect(computeMaxDrawdown(curve)).toBe(0);
  });
});

describe('validateNavData', () => {
  test('空数组返回错误', () => {
    expect(validateNavData([], '2020-01-01', '2023-12-31')).toContainEqual(
      expect.objectContaining({ code: 'INVALID_NAV_DATA' })
    );
  });

  test('重复日期返回 DUPLICATE_NAV_DATE', () => {
    const navData = [
      { date: '2020-01-02', nav: 1.0 },
      { date: '2020-01-02', nav: 1.01 },
    ];
    expect(validateNavData(navData, '2020-01-01', '2023-12-31')).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_NAV_DATE' })
    );
  });

  test('非法日期格式返回 INVALID_NAV_DATA', () => {
    const navData = [{ date: '2020/01/02', nav: 1.0 }];
    expect(validateNavData(navData, '2020-01-01', '2023-12-31')).toContainEqual(
      expect.objectContaining({ code: 'INVALID_NAV_DATA' })
    );
  });

  test('净值 <= 0 返回 INVALID_NAV', () => {
    const navData = [{ date: '2020-01-02', nav: 0 }];
    expect(validateNavData(navData, '2020-01-01', '2023-12-31')).toContainEqual(
      expect.objectContaining({ code: 'INVALID_NAV' })
    );
  });

  test('开始日期之后无净值返回 NO_NAV_AFTER_START', () => {
    const navData = [{ date: '2020-01-02', nav: 1.0 }];
    expect(validateNavData(navData, '2020-02-01', '2020-02-28')).toContainEqual(
      expect.objectContaining({ code: 'NO_NAV_AFTER_START' })
    );
  });

  test('结束日期之前无净值返回 NO_NAV_BEFORE_END', () => {
    const navData = [{ date: '2020-01-02', nav: 1.0 }];
    expect(validateNavData(navData, '2020-01-01', '2020-01-01')).toContainEqual(
      expect.objectContaining({ code: 'NO_NAV_BEFORE_END' })
    );
  });
});

describe('validateRequest', () => {
  test('基金名称超长返回错误', () => {
    const errs = validateRequest({ fundName: 'a'.repeat(101), navData: [], startDate: '2020-01-01', endDate: '2023-12-31', periodicAmount: 1000, frequency: 'monthly' });
    expect(errs).toContainEqual(expect.objectContaining({ code: 'INVALID_FUND_NAME' }));
  });

  test('开始日期晚于结束日期返回 DATE_RANGE_INVALID', () => {
    const errs = validateRequest({ fundName: 'Test', navData: [], startDate: '2023-12-31', endDate: '2020-01-01', periodicAmount: 1000, frequency: 'monthly' });
    expect(errs).toContainEqual(expect.objectContaining({ code: 'DATE_RANGE_INVALID' }));
  });

  test('每期金额 <= 0 返回错误', () => {
    const errs = validateRequest({ fundName: 'Test', navData: [], startDate: '2020-01-01', endDate: '2023-12-31', periodicAmount: 0, frequency: 'monthly' });
    expect(errs).toContainEqual(expect.objectContaining({ code: 'INVALID_PERIODIC_AMOUNT' }));
  });

  test('frequency 非 weekly/monthly 返回错误', () => {
    const errs = validateRequest({ fundName: 'Test', navData: [], startDate: '2020-01-01', endDate: '2023-12-31', periodicAmount: 1000, frequency: 'daily' });
    expect(errs).toContainEqual(expect.objectContaining({ code: 'INVALID_FREQUENCY' }));
  });
});

describe('parseNavData', () => {
  test('乱序输入按 date 升序返回', () => {
    const navData = [
      { date: '2020-01-03', nav: 1.0 },
      { date: '2020-01-01', nav: 0.9 },
      { date: '2020-01-02', nav: 0.95 },
    ];
    const sorted = parseNavData(navData);
    expect(sorted.map((r) => r.date)).toEqual(['2020-01-01', '2020-01-02', '2020-01-03']);
  });
});

describe('runBacktest - 正常月定投', () => {
  test('基本月定投，返回 summary 和曲线', () => {
    const navData = [
      { date: '2020-01-02', nav: 1.0 },
      { date: '2020-02-03', nav: 1.1 },
      { date: '2020-03-02', nav: 0.9 },
      { date: '2020-04-01', nav: 1.2 },
      { date: '2020-04-30', nav: 1.3 },
    ];

    const result = runBacktest({
      fundName: '测试基金',
      navData,
      startDate: '2020-01-01',
      endDate: '2020-04-30',
      periodicAmount: 1000,
      frequency: 'monthly',
    });

    expect(result.fundName).toBe('测试基金');
    expect(result.summary).toHaveProperty('totalInvested');
    expect(result.summary).toHaveProperty('holdingShares');
    expect(result.summary).toHaveProperty('endingAssets');
    expect(result.summary).toHaveProperty('totalProfit');
    expect(result.summary).toHaveProperty('totalReturnRate');
    expect(result.summary).toHaveProperty('maxDrawdown');
    expect(result.summary).toHaveProperty('lumpSumReturnRate');
    expect(result.curves).toHaveProperty('dca');
    expect(result.curves).toHaveProperty('lumpSum');
    expect(result.summary.totalInvested).toBe(4000); // 4个月
  });
});

describe('runBacktest - 正常周定投', () => {
  test('周定投，每7天扣款一期', () => {
    const navData = [
      { date: '2020-01-01', nav: 1.0 },
      { date: '2020-01-08', nav: 1.0 },
      { date: '2020-01-15', nav: 1.0 },
    ];

    const result = runBacktest({
      fundName: '周测基金',
      navData,
      startDate: '2020-01-01',
      endDate: '2020-01-15',
      periodicAmount: 1000,
      frequency: 'weekly',
    });

    expect(result.summary.totalInvested).toBe(3000); // 3期
    expect(result.curves.dca).toHaveLength(3);
  });
});

describe('runBacktest - 非交易日起止日期', () => {
  test('开始日期为非交易日，应使用之后最近净值买入', () => {
    const navData = [
      { date: '2020-01-02', nav: 1.0 }, // 第一个可用净值
      { date: '2020-01-03', nav: 1.1 },
    ];

    const result = runBacktest({
      fundName: 'Test',
      navData,
      startDate: '2020-01-01', // 非交易日
      endDate: '2020-01-03',
      periodicAmount: 1000,
      frequency: 'monthly',
    });

    expect(result.summary.totalInvested).toBe(1000);
    // 期初使用 1/2 的净值
    expect(result.summary.holdingShares).toBeCloseTo(1000, 4);
  });

  test('结束日期为非交易日，应使用之前最近净值计算期末资产', () => {
    const navData = [
      { date: '2020-01-02', nav: 1.0 },
      { date: '2020-01-03', nav: 1.2 },
      { date: '2020-01-04', nav: 1.5 },
    ];

    const result = runBacktest({
      fundName: 'Test',
      navData,
      startDate: '2020-01-01',
      endDate: '2020-01-03', // 非交易日
      periodicAmount: 1000,
      frequency: 'monthly',
    });

    expect(result.summary.endingAssets).toBeCloseTo(1200, 2); // 用 1/3 nav=1.2
  });
});

describe('runBacktest - 重复净值日期', () => {
  test('重复日期抛出 DUPLICATE_NAV_DATE 错误', () => {
    const navData = [
      { date: '2020-01-02', nav: 1.0 },
      { date: '2020-01-02', nav: 1.05 },
    ];

    expect(() =>
      runBacktest({
        fundName: 'Test',
        navData,
        startDate: '2020-01-01',
        endDate: '2020-12-31',
        periodicAmount: 1000,
        frequency: 'monthly',
      })
    ).toThrow();
  });
});

describe('runBacktest - 空区间', () => {
  test('区间内无净值抛出 NO_NAV_AFTER_START', () => {
    const navData = [{ date: '2020-01-02', nav: 1.0 }];

    let err;
    try {
      runBacktest({
        fundName: 'Test',
        navData,
        startDate: '2020-02-01',
        endDate: '2020-02-28',
        periodicAmount: 1000,
        frequency: 'monthly',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('NO_NAV_AFTER_START');
  });
});

describe('runBacktest - 一次性买入对照', () => {
  test('一次性买入收益率与定投累计投入金额一致', () => {
    const navData = [
      { date: '2020-01-02', nav: 1.0 },
      { date: '2020-01-03', nav: 1.5 },
      { date: '2020-01-04', nav: 2.0 },
    ];

    const result = runBacktest({
      fundName: 'Test',
      navData,
      startDate: '2020-01-01',
      endDate: '2020-01-04',
      periodicAmount: 1000,
      frequency: 'monthly',
    });

    // 期初净值=1.0，一次性买入1000；期末净值=2.0，期末资产=2000，收益率=100%
    expect(result.summary.lumpSumReturnRate).toBeCloseTo(1.0, 2);
    // 定投只能买1期，投入1000，期末资产=2000/2=1000? 不对...
    // 让我再算一次：monthly 第一期 1/2 nav=1.0，买入1000份
    // 期末（1/4 nav=2.0）期末资产 = 1000 * 2.0 = 2000
    // 总投入=1000，收益=1000，收益率=100%
    expect(result.summary.totalReturnRate).toBeCloseTo(1.0, 2);
    expect(result.summary.lumpSumReturnRate).toBeCloseTo(1.0, 2);
    expect(result.summary.totalInvested).toBe(1000);
    expect(result.summary.holdingShares).toBeCloseTo(1000, 2);
    expect(result.summary.endingAssets).toBeCloseTo(2000, 2);
  });
});

describe('runBacktest - 最大回撤计算', () => {
  test('定投过程有回撤时，最大回撤为负数', () => {
    // 净值: 1.0 -> 2.0 -> 0.5 -> 1.0
    const navData = [
      { date: '2020-01-01', nav: 1.0 },
      { date: '2020-01-02', nav: 2.0 }, // peak=2
      { date: '2020-01-03', nav: 0.5 }, // 跌到 0.5，回撤 = (0.5-2)/2 = -0.75
      { date: '2020-01-04', nav: 1.0 }, // 恢复但未创新高，回撤 = (1-2)/2 = -0.5
    ];

    const result = runBacktest({
      fundName: 'Test',
      navData,
      startDate: '2020-01-01',
      endDate: '2020-01-04',
      periodicAmount: 1000,
      frequency: 'monthly',
    });

    // 第一次买入在 1/1 nav=1.0，买1000份，资产: 0 -> 1000 -> 2000 -> 500 -> 1000
    // 在 1/2 peak=2000，在 1/3 回撤=(500-2000)/2000=-0.75
    expect(result.summary.maxDrawdown).toBeCloseTo(-0.75, 2);
  });
});