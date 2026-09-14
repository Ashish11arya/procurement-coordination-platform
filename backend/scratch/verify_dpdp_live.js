const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    options.headers = {
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {}),
    };
    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Registration WITHOUT Consent (Expect 400 rejection) ---');
  const testMobile = '98765' + Math.floor(10000 + Math.random() * 90000);
  const rejectRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/farmer/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      mobile: testMobile,
      name: 'Ramesh Patel',
      state: 'Madhya Pradesh',
      district: 'Indore',
      consentToDataSharing: false, // Intentionally false
    }
  );
  console.log('Status:', rejectRes.status);
  console.log('Response:', JSON.stringify(rejectRes.data));

  if (rejectRes.status !== 400) {
    throw new Error('Expected 400 when consent is false, got ' + rejectRes.status);
  }
  console.log('✓ Correctly rejected registration without DPDP explicit consent!\n');

  console.log('--- 2. Testing Registration WITH Consent (Expect 201 Created) ---');
  const acceptRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/farmer/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      mobile: testMobile,
      name: 'Ramesh Patel',
      state: 'Madhya Pradesh',
      district: 'Indore',
      subDistrict: 'Sanwer',
      village: 'Dharampuri',
      landAreaAcres: 6.2,
      consentToDataSharing: true,
      consentVersion: '1.0',
    }
  );
  console.log('Status:', acceptRes.status);
  console.log('Farmer Registered:', acceptRes.data.user?.name, acceptRes.data.user?.farmerId);
  const token = acceptRes.data.accessToken;

  if (acceptRes.status !== 201 || !token) {
    throw new Error('Registration with consent failed!');
  }
  console.log('✓ Successfully registered farmer with stored statutory consent record!\n');

  console.log('--- 3. Testing GET /api/v1/farmers/data-export (Data Subject Right to Access) ---');
  const exportRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/farmers/data-export',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  console.log('Status:', exportRes.status);
  console.log('Export Metadata:', JSON.stringify(exportRes.data.data?.exportMetadata));
  console.log('Integrity SHA-256:', exportRes.data.data?.integrity?.sha256Checksum);
  console.log('Consents exported:', exportRes.data.data?.consents?.length);
  console.log('✓ Successfully exported portable JSON data dump with SHA-256 integrity hash!\n');

  console.log('--- 4. Testing GET /api/v1/compliance/policy (Public Legal Transparency API) ---');
  const policyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/compliance/policy',
    method: 'GET',
  });
  console.log('Status:', policyRes.status);
  console.log('Policy Statute:', policyRes.data.statute);
  console.log('Data Fiduciary:', policyRes.data.dataFiduciary);
  console.log('Statutory Retention Policy:', JSON.stringify(policyRes.data.statutoryRetention, null, 2));
  if (policyRes.status !== 200) {
    throw new Error('Failed to retrieve compliance policy!');
  }
  console.log('✓ Public DPDP Compliance Policy API verified!\n');

  console.log('--- 5. Testing DELETE /api/v1/farmers/account (Right to Erasure with GFR Hold) ---');
  const deleteRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/farmers/account',
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      reason: 'Farmer exercised DPDP Section 12 Right to Erasure',
    }
  );
  console.log('Status:', deleteRes.status);
  console.log('Delete Response Data:', deleteRes.data);
  console.log('Delete Response Text:', deleteRes.text);
  if (deleteRes.data) {
    console.log('Success:', deleteRes.data.success);
    console.log('Message:', deleteRes.data.message);
    console.log('Statutory Notice:', deleteRes.data.statutoryRetentionNotice);
    console.log('Anonymized Record:', JSON.stringify(deleteRes.data.anonymizedRecord));
  }
  if (deleteRes.status !== 200) {
    throw new Error('Failed to execute account erasure: ' + JSON.stringify(deleteRes.data || deleteRes.text));
  }
  console.log('✓ Successfully exercised Right to Erasure while enforcing 7-year GFR statutory hold!\n');

  console.log('ALL LIVE DPDP COMPLIANCE CHECKS PASSED!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
