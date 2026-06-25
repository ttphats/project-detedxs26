import net from 'net';

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const ports = [
  { name: 'web-client', port: 3000, host: '127.0.0.1' },
  { name: 'web-admin', port: 3002, host: '127.0.0.1' },
  { name: 'backend', port: 4000, host: '127.0.0.1' },
  { name: 'Redis', port: 6379, host: '222.255.180.85' }
];
for (const p of ports) {
  const open = await checkPort(p.port, p.host);
  console.log(`${p.name} (${p.host}:${p.port}) is ${open ? 'OPEN' : 'CLOSED'}`);
}
