/**
 * WebSocket Service - Wrapper for WebSocket Server
 * This module provides simplified functions for sending WebSocket messages
 */

const websocketServer = require('./websocketServer');

/**
 * Broadcast message to all connected clients
 * @param {Object} messageData - The message data to broadcast
 * @returns {Number} Number of clients message was sent to
 */
const broadcastToAll = (messageData) => {
  const message = {
    type: messageData.type || 'notification',
    event: messageData.event,
    data: messageData.data,
    timestamp: new Date().toISOString()
  };

  return websocketServer.broadcast(message);
};

/**
 * Send message to specific user (all their connections)
 * @param {Number} userId - User ID to send message to
 * @param {Object} messageData - The message data to send
 * @returns {Boolean} True if message was sent, false otherwise
 */
const sendToUser = (userId, messageData) => {
  const message = {
    type: messageData.type || 'notification',
    event: messageData.event,
    data: messageData.data,
    timestamp: new Date().toISOString()
  };

  return websocketServer.sendToUser(userId, message);
};

/**
 * Force logout a user
 * @param {Number} userId - User ID to logout
 * @param {String} reason - Reason for logout
 * @returns {Boolean} True if logout event was sent
 */
const forceLogoutUser = (userId, reason) => {
  return websocketServer.forceLogoutUser(userId, reason);
};

/**
 * Send session expired event
 * @param {Number} userId - User ID
 * @returns {Boolean} True if event was sent
 */
const sendSessionExpired = (userId) => {
  return websocketServer.sendSessionExpired(userId);
};

/**
 * Check if user is connected
 * @param {Number} userId - User ID
 * @returns {Boolean} True if user has active connections
 */
const isUserConnected = (userId) => {
  return websocketServer.isUserConnected(userId);
};

/**
 * Get connected clients count
 * @returns {Number} Total number of connected clients
 */
const getConnectedClientsCount = () => {
  return websocketServer.getConnectedClientsCount();
};

/**
 * Get connected users count
 * @returns {Number} Number of unique users connected
 */
const getConnectedUsersCount = () => {
  return websocketServer.getConnectedUsersCount();
};

module.exports = {
  broadcastToAll,
  sendToUser,
  forceLogoutUser,
  sendSessionExpired,
  isUserConnected,
  getConnectedClientsCount,
  getConnectedUsersCount
};
