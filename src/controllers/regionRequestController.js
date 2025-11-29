const { pool } = require('../config/database');
const { createNotification, notifyAllAdmins } = require('./notificationController');

/**
 * @route   GET /api/region-requests
 * @desc    Get all region requests (own or manager)
 * @access  Private
 */
const getAllRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role?.toLowerCase(); // Case-insensitive role check
    const { status } = req.query;

    let query = `
      SELECT rr.*,
             u.username,
             u.full_name,
             u.email,
             u.role,
             r.name as region_name,
             r.code as region_code,
             r.type as region_type,
             reviewer.username as reviewed_by_username,
             reviewer.full_name as reviewed_by_name
      FROM region_requests rr
      INNER JOIN users u ON rr.user_id = u.id
      INNER JOIN regions r ON rr.region_id = r.id
      LEFT JOIN users reviewer ON rr.reviewed_by = reviewer.id
      WHERE 1=1
    `;
    const params = [];

    // Managers and admins can see all requests, users see only their own
    if (userRole !== 'admin' && userRole !== 'manager') {
      query += ' AND rr.user_id = ?';
      params.push(userId);
    }

    if (status) {
      query += ' AND rr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY rr.requested_at DESC';

    const [requests] = await pool.query(query, params);

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get region requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to get region requests' });
  }
};

/**
 * @route   POST /api/region-requests
 * @desc    Create region access request
 * @access  Private
 */
const createRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { region_id, region_name, comments } = req.body;

    // Accept either region_id or region_name
    if (!region_id && !region_name) {
      return res.status(400).json({
        success: false,
        error: 'Region (ID or name) is required'
      });
    }

    // Find region by ID or name
    let regionId;
    if (region_id) {
      const [regions] = await pool.query('SELECT id FROM regions WHERE id = ?', [region_id]);
      if (regions.length === 0) {
        return res.status(404).json({ success: false, error: 'Region not found' });
      }
      regionId = region_id;
    } else {
      const [regions] = await pool.query('SELECT id FROM regions WHERE name = ? AND is_active = true', [region_name]);
      if (regions.length === 0) {
        return res.status(404).json({ success: false, error: 'Region not found' });
      }
      regionId = regions[0].id;
    }

    // Check if user already has access
    const [existingAccess] = await pool.query(
      'SELECT id FROM user_regions WHERE user_id = ? AND region_id = ?',
      [userId, regionId]
    );

    if (existingAccess.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have access to this region'
      });
    }

    // Check for pending request
    const [pendingRequests] = await pool.query(
      'SELECT id FROM region_requests WHERE user_id = ? AND region_id = ? AND status = ?',
      [userId, regionId, 'pending']
    );

    if (pendingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending request for this region'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO region_requests
       (user_id, region_id, comments, status)
       VALUES (?, ?, ?, 'pending')`,
      [userId, regionId, comments || '']
    );

    console.log(`✅ Created region request ID: ${result.insertId} for user ${userId} for region ${regionId}`);

    // Get region and user info for notification
    const [regionInfo] = await pool.query('SELECT name, code FROM regions WHERE id = ?', [regionId]);
    const [userInfo] = await pool.query('SELECT username, full_name FROM users WHERE id = ?', [userId]);

    const regionName = regionInfo[0]?.name || 'Unknown Region';
    const userName = userInfo[0]?.full_name || userInfo[0]?.username || 'User';

    // Notify all admins about the new region request
    try {
      await notifyAllAdmins(
        'region_request',
        '🗺️ New Region Request',
        `${userName} has requested access to ${regionName}`,
        {
          data: {
            requestId: result.insertId,
            userId,
            userName,
            regionId,
            regionName,
            comments
          },
          priority: 'high',
          action_url: '/admin/region-requests',
          action_label: 'View Request'
        }
      );
      console.log(`📧 Admins notified about region request ID: ${result.insertId}`);
    } catch (notifError) {
      console.error('Failed to send notification to admins:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      request: {
        id: result.insertId,
        user_id: userId,
        region_id: regionId,
        comments,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Create region request error:', error);
    res.status(500).json({ success: false, error: 'Failed to create region request' });
  }
};

/**
 * @route   PATCH /api/region-requests/:id/approve
 * @desc    Approve region access request (manager+)
 * @access  Private (Manager/Admin)
 */
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;
    const reviewerRole = req.user.role?.toLowerCase(); // Case-insensitive role check
    const { comments: reviewComments } = req.body;

    if (reviewerRole !== 'admin' && reviewerRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can approve requests'
      });
    }

    // Get request details
    const [requests] = await pool.query(
      'SELECT * FROM region_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const request = requests[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Request already ${request.status}`
      });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update request status
      await connection.query(
        `UPDATE region_requests
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), comments = ?
         WHERE id = ?`,
        [reviewerId, reviewComments, id]
      );

      // Grant access to the region
      await connection.query(
        `INSERT INTO user_regions (user_id, region_id, assigned_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE assigned_by = ?`,
        [request.user_id, request.region_id, reviewerId, reviewerId]
      );

      await connection.commit();

      // Get region and user info for notification
      const [regionInfo] = await pool.query('SELECT name, code FROM regions WHERE id = ?', [request.region_id]);
      const [userInfo] = await pool.query('SELECT username, full_name FROM users WHERE id = ?', [request.user_id]);

      const regionName = regionInfo[0]?.name || 'Unknown Region';
      const userName = userInfo[0]?.full_name || userInfo[0]?.username || 'User';

      // Notify the user that their request was approved
      try {
        await createNotification(
          request.user_id,
          'region_request',
          '✅ Region Request Approved',
          `Your request for access to ${regionName} has been approved`,
          {
            data: {
              requestId: id,
              regionId: request.region_id,
              regionName,
              reviewNotes: reviewComments
            },
            priority: 'high',
            action_url: '/map',
            action_label: 'View Map'
          }
        );
        console.log(`📧 User ${userName} notified about approved region request ID: ${id}`);
      } catch (notifError) {
        console.error('Failed to send notification to user:', notifError);
        // Don't fail the request if notification fails
      }

      res.json({ success: true, message: 'Request approved successfully' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve request' });
  }
};

/**
 * @route   PATCH /api/region-requests/:id/reject
 * @desc    Reject region access request (manager+)
 * @access  Private (Manager/Admin)
 */
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;
    const reviewerRole = req.user.role?.toLowerCase(); // Case-insensitive role check
    const { comments: reviewComments } = req.body;

    if (reviewerRole !== 'admin' && reviewerRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can reject requests'
      });
    }

    // Get request details
    const [requests] = await pool.query(
      'SELECT * FROM region_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const request = requests[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Request already ${request.status}`
      });
    }

    await pool.query(
      `UPDATE region_requests
       SET status = 'rejected',
           comments = ?,
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ?`,
      [reviewComments || 'Rejected', reviewerId, id]
    );

    // Get region and user info for notification
    const [regionInfo] = await pool.query('SELECT name, code FROM regions WHERE id = ?', [request.region_id]);
    const [userInfo] = await pool.query('SELECT username, full_name FROM users WHERE id = ?', [request.user_id]);

    const regionName = regionInfo[0]?.name || 'Unknown Region';
    const userName = userInfo[0]?.full_name || userInfo[0]?.username || 'User';

    // Notify the user that their request was rejected
    try {
      await createNotification(
        request.user_id,
        'region_request',
        '❌ Region Request Rejected',
        `Your request for access to ${regionName} has been rejected`,
        {
          data: {
            requestId: id,
            regionId: request.region_id,
            regionName,
            reviewNotes: review_notes
          },
          priority: 'high',
          action_url: '/region-requests',
          action_label: 'View Requests'
        }
      );
      console.log(`📧 User ${userName} notified about rejected region request ID: ${id}`);
    } catch (notifError) {
      console.error('Failed to send notification to user:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({ success: true, message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject request' });
  }
};

/**
 * @route   DELETE /api/region-requests/:id
 * @desc    Delete region access request (admin or own request)
 * @access  Private
 */
const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role?.toLowerCase();

    // Get request details
    const [requests] = await pool.query(
      'SELECT user_id FROM region_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const request = requests[0];

    // Only admin can delete any request, or users can delete their own
    if (userRole !== 'admin' && request.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied: Only administrators or the requester can delete this request'
      });
    }

    // Delete the request
    await pool.query('DELETE FROM region_requests WHERE id = ?', [id]);

    console.log(`✅ Deleted region request ID: ${id} by user ${userId}`);

    res.json({ success: true, message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete request' });
  }
};

module.exports = {
  getAllRequests,
  createRequest,
  approveRequest,
  rejectRequest,
  deleteRequest
};
