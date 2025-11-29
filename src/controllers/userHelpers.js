/**
 * User Controller Helper Functions
 * Shared utilities used across user-related controllers
 */

/**
 * Helper function to calculate time remaining from seconds
 *
 * @param {number} seconds - Total seconds remaining
 * @returns {object} Object with expired flag, display string, and time breakdown
 */
const calculateTimeRemaining = (seconds) => {
  if (!seconds || seconds <= 0) {
    return {
      expired: true,
      display: 'Expired',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      total_seconds: 0
    };
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  let display = '';
  if (days > 0) display += `${days}d `;
  if (hours > 0) display += `${hours}h `;
  if (minutes > 0) display += `${minutes}m `;
  if (secs > 0 && days === 0) display += `${secs}s`;

  return {
    expired: false,
    display: display.trim() || 'Just now',
    days,
    hours,
    minutes,
    seconds: secs,
    total_seconds: seconds
  };
};

module.exports = {
  calculateTimeRemaining
};
