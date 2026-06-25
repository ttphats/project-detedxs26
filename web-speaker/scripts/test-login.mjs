const credentials = [
  { username: 'admin', password: 'admin123456' },
  { username: 'admin@tedxfptuhcm.com', password: 'admin123456' }
];

for (const cred of credentials) {
  try {
    console.log(`Testing with username: ${cred.username}`);
    const res = await fetch('http://127.0.0.1:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cred)
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error fetching:', err.message);
  }
}
