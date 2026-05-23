const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

const FUNDS = [
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
];

function fetchPage(fundCode, pageIndex) {
  return new Promise(function(resolve, reject) {
    const url = 'http://api.fund.eastmoney.com/f10/lsjz?fundCode=' + fundCode + '&pageSize=100&pageIndex=' + pageIndex + '&startDate=2020-01-01&endDate=2026-05-23';
    const req = http.get(url, {
      headers: {
        Referer: 'http://fund.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchFund(fund) {
  const allData = [];
  let pageIndex = 1;
  let totalCount = null;
  let pageSize = 100;

  while (true) {
    process.stdout.write('  [' + fund.code + '] page ' + pageIndex + '...');
    const json = await fetchPage(fund.code, pageIndex);
    const list = json.Data && json.Data.LSJZList;
    if (!list || list.length === 0) {
      console.log(' done (no data)');
      break;
    }

    if (totalCount === null) {
      totalCount = json.TotalCount || 0;
      pageSize = json.PageSize || 100;
      console.log(' total=' + totalCount);
    }

    allData.push.apply(allData, list);
    process.stdout.write(' +' + list.length + '\n');

    if (list.length < pageSize) break;
    pageIndex++;
    if (pageIndex > 200) { console.log(' max pages'); break; }
  }

  return allData;
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  for (const fund of FUNDS) {
    console.log('\nFetching ' + fund.code + ' (' + fund.name + ')...');
    try {
      const raw = await fetchFund(fund);

      const navData = raw
        .map(function(r) { return { date: r.FSRQ, nav: parseFloat(r.DWJZ) }; })
        .filter(function(r) { return r.date && !isNaN(r.nav); })
        .sort(function(a, b) { return a.date.localeCompare(b.date); });

      const out = { fundCode: fund.code, fundName: fund.name, navData: navData };
      const filePath = path.join(DATA_DIR, fund.code + '.json');
      fs.writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf8');
      console.log('  => Saved ' + navData.length + ' records to ' + filePath);
    } catch (e) {
      console.error('  => Failed: ' + e.message);
    }
  }

  console.log('\nAll done!');
}

main().catch(console.error);