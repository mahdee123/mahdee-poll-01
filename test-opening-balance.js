const http = require('http');

const API = 'http://localhost:4000/api';

async function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // 1. Login
    console.log('🔐 Step 1: Login...');
    const loginData = await makeRequest('POST', '/auth/login', {
      email: 'admin@raya.com',
      password: 'admin123'
    });
    const token = loginData.token;
    console.log('✓ Logged in successfully\n');

    // 2. Set Opening Balance
    const today = new Date().toISOString().split('T')[0];
    console.log(`💾 Step 2: Setting opening balance ৳5000 for ${today}...`);
    const obData = await makeRequest('POST', '/opening-balance', {
      date: today,
      amount: 5000,
      notes: 'Test setup'
    }, token);
    console.log(`✓ Opening balance set: ৳${obData.openingBalance?.amount || 'Error setting'}`);
    if (!obData.openingBalance) {
      console.log('Response:', JSON.stringify(obData, null, 2));
    }
    console.log('');

    // 3. Get Financial Summary (THE KEY TEST)
    console.log('📊 Step 3: Fetching financial-summary (with FIXED date query)...');
    const summaryData = await makeRequest('GET', '/reports/financial-summary?range=today', null, token);
    console.log('✓ Financial Summary Retrieved:');
    console.log(`  📍 Opening Balance: ৳${summaryData.openingBalance}`);
    console.log(`  💰 Total Income: ৳${summaryData.totalIncome}`);
    console.log(`  💸 Total Expense: ৳${summaryData.totalExpense}`);
    console.log(`  📤 Closing Balance: ৳${summaryData.closingBalance}\n`);

    // 4. Get Income Report
    console.log('📈 Step 4: Fetching income report (with FIXED date query)...');
    const incomeData = await makeRequest('GET', '/reports/income?range=today', null, token);
    console.log('✓ Income Report Retrieved:');
    console.log(`  📍 Opening Balance: ৳${incomeData.openingBalance}`);
    console.log(`  💰 Total Income: ৳${incomeData.totalIncome}`);
    console.log(`  📤 Closing Balance: ৳${incomeData.closingBalance}\n`);

    // Verify fix worked
    if (summaryData.openingBalance === 5000 && incomeData.openingBalance === 5000) {
      console.log('✅ SUCCESS! Opening balance DATE QUERY FIX WORKING PERFECTLY!');
      console.log('   - Financial summary shows correct opening balance');
      console.log('   - Income report shows correct opening balance');
      console.log('   - Both now use date range query (handles timezone)');
    } else {
      console.log(`❌ Issue: Opening balance mismatch`);
      console.log(`   Summary: ${summaryData.openingBalance}, Income: ${incomeData.openingBalance}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
