require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('\n🔍 Token Configuration Check\n');
console.log('=' .repeat(50));
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');
console.log('JWT_EXPIRE:', process.env.JWT_EXPIRE || '❌ Not set (using fallback: 15m)');
console.log('JWT_REFRESH_EXPIRE:', process.env.JWT_REFRESH_EXPIRE || '❌ Not set');
console.log('=' .repeat(50));

// Test token generation
if (process.env.JWT_SECRET) {
  const testPayload = { id: 1, email: 'test@example.com', role: 'admin' };
  const token = jwt.sign(testPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });

  const decoded = jwt.decode(token, { complete: true });
  const expiresIn = decoded.payload.exp - decoded.payload.iat;
  const hours = Math.floor(expiresIn / 3600);
  const minutes = Math.floor((expiresIn % 3600) / 60);

  console.log('\n✅ Test Token Generated:');
  console.log(`   Expires in: ${hours > 0 ? hours + 'h ' : ''}${minutes}min (${expiresIn} seconds)`);
  console.log(`   Token: ${token.substring(0, 50)}...`);
} else {
  console.log('\n❌ Cannot generate test token - JWT_SECRET not set');
}

console.log('\n');
