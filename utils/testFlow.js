const http = require('http');

const postData = new URLSearchParams({
  role: 'admin',
  username: 'principle@gmial.com',
  password: '123123'
}).toString();

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`[POST /auth/login] STATUS: ${res.statusCode}`);
  const cookies = res.headers['set-cookie'];
  console.log('Cookies:', cookies);
  const location = res.headers.location;
  console.log('Redirect location:', location);
  
  if (location && cookies) {
    const adminTokenCookie = cookies.find(c => c.startsWith('adminToken=') && !c.includes('Expires=Thu, 01 Jan 1970'));
    if (!adminTokenCookie) {
      console.log('No valid adminToken found in cookies!');
      return;
    }
    const tokenPart = adminTokenCookie.split(';')[0];
    console.log('Testing GET', location, 'with token', tokenPart);
    
    const getOptions = {
      hostname: 'localhost',
      port: 3000,
      path: location,
      method: 'GET',
      headers: {
        'Cookie': tokenPart
      }
    };
    const getReq = http.request(getOptions, (getRes) => {
      console.log(`[GET ${location}] STATUS: ${getRes.statusCode}`);
      console.log(`[GET ${location}] Redirect location:`, getRes.headers.location);
    });
    getReq.end();
  }
});

req.write(postData);
req.end();
