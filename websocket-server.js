const http = require('http');
const url = require('url');

// Simple WebSocket server to handle frontend WebSocket connections
const server = http.createServer();

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  
  if (pathname === '/ws') {
    // WebSocket handshake
    const key = request.headers['sec-websocket-key'];
    const acceptKey = require('crypto')
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '', ''
    ].join('\r\n');

    socket.write(responseHeaders);

    // Handle WebSocket frames (basic implementation)
    socket.on('data', (buffer) => {
      // Simple echo or acknowledgment
      // Just send a ping/pong to keep connection alive
    });

    socket.on('close', () => {
      console.log('WebSocket connection closed');
    });

    console.log('WebSocket connection established on /ws');
  } else {
    socket.destroy();
  }
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`🔌 WebSocket Server running on port ${PORT}`);
  console.log(`📡 WebSocket URL: ws://localhost:${PORT}/ws`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. WebSocket server not started.`);
  } else {
    console.error('WebSocket server error:', error);
  }
});