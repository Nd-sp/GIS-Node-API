const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map userId -> Set of WebSocket connections
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log('✅ WebSocket Server initialized on path /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    console.log('🔌 New WebSocket connection attempt');
    console.log('  - Request URL:', req.url);
    console.log('  - Request headers:', req.headers);

    // Extract token from query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      console.warn('⚠️ WebSocket connection rejected - No token provided');
      console.warn('  - URL:', req.url);
      ws.close(4001, 'Authentication required');
      return;
    }

    console.log('🔑 Token received, length:', token.length);

    // Verify token and get user ID
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      console.log(`✅ Token verified successfully`);
      console.log(`  - User ID: ${userId}`);
      console.log(`  - Username: ${decoded.username || 'N/A'}`);
      console.log(`✅ WebSocket client connected - User ID: ${userId}`);
    } catch (error) {
      console.warn('⚠️ WebSocket connection rejected - Invalid token');
      console.warn('  - Error:', error.message);
      ws.close(4002, 'Invalid token');
      return;
    }

    // Store client connection
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);

    // Setup message handlers
    ws.on('message', (data) => {
      this.handleMessage(ws, userId, data);
    });

    ws.on('close', () => {
      this.handleClose(userId, ws);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for user ${userId}:`, error);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'system',
      event: 'connected',
      data: { message: 'Connected to WebSocket server' },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle incoming messages from clients
   */
  handleMessage(ws, userId, data) {
    try {
      const message = JSON.parse(data);

      // Handle ping/pong for keepalive
      if (message.type === 'ping') {
        this.sendToClient(ws, {
          type: 'pong',
          event: 'heartbeat',
          data: { timestamp: Date.now() },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Handle other message types as needed
      console.log(`📨 Message from user ${userId}:`, message.type);

    } catch (error) {
      console.error('❌ Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle client disconnection
   */
  handleClose(userId, ws) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
    console.log(`🔌 WebSocket client disconnected - User ID: ${userId}`);
  }

  /**
   * Send message to a specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Send message to all connections of a specific user
   */
  sendToUser(userId, message) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) {
      console.warn(`⚠️ No active WebSocket connections for user ${userId}`);
      return false;
    }

    let sentCount = 0;
    userClients.forEach(ws => {
      if (this.sendToClient(ws, message)) {
        sentCount++;
      }
    });

    console.log(`📤 Sent message to ${sentCount} connection(s) for user ${userId}`);
    return sentCount > 0;
  }

  /**
   * Force logout a user (send force_logout event)
   */
  forceLogoutUser(userId, reason = 'Admin forced logout') {
    const message = {
      type: 'system',
      event: 'force_logout',
      data: {
        reason,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    const sent = this.sendToUser(userId, message);

    if (sent) {
      console.log(`✅ Force logout event sent to user ${userId}`);
      // Close all connections for this user after a brief delay
      setTimeout(() => {
        const userClients = this.clients.get(userId);
        if (userClients) {
          userClients.forEach(ws => {
            ws.close(1000, 'Force logout by admin');
          });
          this.clients.delete(userId);
        }
      }, 1000); // 1 second delay to ensure message is received
    }

    return sent;
  }

  /**
   * Send session expired event to a user
   */
  sendSessionExpired(userId) {
    const message = {
      type: 'system',
      event: 'user_session_expired',
      data: {
        reason: 'Session expired',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    return this.sendToUser(userId, message);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    let sentCount = 0;
    this.clients.forEach((userClients, userId) => {
      userClients.forEach(ws => {
        if (this.sendToClient(ws, message)) {
          sentCount++;
        }
      });
    });

    console.log(`📡 Broadcast message sent to ${sentCount} client(s)`);
    return sentCount;
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount() {
    let count = 0;
    this.clients.forEach((userClients) => {
      count += userClients.size;
    });
    return count;
  }

  /**
   * Get number of unique users connected
   */
  getConnectedUsersCount() {
    return this.clients.size;
  }

  /**
   * Check if a user has active connections
   */
  isUserConnected(userId) {
    const userClients = this.clients.get(userId);
    return userClients && userClients.size > 0;
  }
}

// Create singleton instance
const websocketServer = new WebSocketServer();

module.exports = websocketServer;
