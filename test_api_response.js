const axios = require('axios');

async function testUserRegions() {
  try {
    // First, login to get token
    console.log('=== LOGGING IN ===');
    const loginResponse = await axios.post('http://localhost:5005/api/auth/login', {
      email: 'himilchauhan1498@gmail.com',
      password: 'Karmo@1107'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Fetch all users
    console.log('=== FETCHING USERS ===');
    const usersResponse = await axios.get('http://localhost:5005/api/users', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 1000, page: 1 }
    });

    console.log(`Total users returned: ${usersResponse.data.users.length}\n`);

    // Check each user's region count
    for (const user of usersResponse.data.users) {
      console.log(`User: ${user.full_name} (ID: ${user.id})`);
      console.log(`  assignedRegions array length: ${user.assignedRegions ? user.assignedRegions.length : 0}`);
      if (user.assignedRegions && user.assignedRegions.length > 0) {
        console.log(`  First 5 regions: ${user.assignedRegions.slice(0, 5).join(', ')}`);
        if (user.assignedRegions.length > 5) {
          console.log(`  ... and ${user.assignedRegions.length - 5} more`);
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testUserRegions();
