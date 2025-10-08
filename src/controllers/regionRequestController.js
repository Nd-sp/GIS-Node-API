const { pool } = require('../config/database');

/**
 * @route   GET /api/region-requests
 * @desc    Get all region requests (own or manager)
 * @access  Private
 */
const getAllRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status } = req.query;

    let query = `
      SELECT rr.*,
             u.username,
             u.full_name,
             u.email,
             r.name as region_name,
             r.code as region_code,
             r.type as region_type,
             approver.username as processed_by_username
      FROM region_requests rr
      INNER JOIN users u ON rr.user_id = u.id
      INNER JOIN regions r ON rr.region_id = r.id
      LEFT JOIN users approver ON rr.processed_by = approver.id
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

    query += ' ORDER BY rr.created_at DESC';

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
    const { region_id, access_level, justification } = req.body;

    if (!region_id || !justification) {
      return res.status(400).json({
        success: false,
        error: 'Region ID and justification are required'
      });
    }

    // Verify region exists
    const [regions] = await pool.query('SELECT id FROM regions WHERE id = ?', [region_id]);
    if (regions.length === 0) {
      return res.status(404).json({ success: false, error: 'Region not found' });
    }

    // Check if user already has access
    const [existingAccess] = await pool.query(
      'SELECT id FROM user_regions WHERE user_id = ? AND region_id = ?',
      [userId, region_id]
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
      [userId, region_id, 'pending']
    );

    if (pendingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending request for this region'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO region_requests
       (user_id, region_id, access_level, justification, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, region_id, access_level || 'read', justification]
    );

    res.status(201).json({
      success: true,
      request: {
        id: result.insertId,
        user_id: userId,
        region_id,
        access_level: access_level || 'read',
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
    const approverId = req.user.id;
    const approverRole = req.user.role;

    if (approverRole !== 'admin' && approverRole !== 'manager') {
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
         SET status = 'approved', processed_by = ?, processed_at = NOW()
         WHERE id = ?`,
        [approverId, id]
      );

      // Grant access to user
      await connection.query(
        `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE access_level = ?, assigned_by = ?`,
        [
          request.user_id,
          request.region_id,
          request.access_level,
          approverId,
          request.access_level,
          approverId
        ]
      );

      await connection.commit();

      res.json({ success: true, message: 'Request approved and access granted' });
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
    const approverId = req.user.id;
    const approverRole = req.user.role;
    const { rejection_reason } = req.body;

    if (approverRole !== 'admin' && approverRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can reject requests'
      });
    }

    // Get request details
    const [requests] = await pool.query(
      'SELECT status FROM region_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (requests[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Request already ${requests[0].status}`
      });
    }

    await pool.query(
      `UPDATE region_requests
       SET status = 'rejected',
           rejection_reason = ?,
           processed_by = ?,
           processed_at = NOW()
       WHERE id = ?`,
      [rejection_reason, approverId, id]
    );

    res.json({ success: true, message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject request' });
  }
};

module.exports = {
  getAllRequests,
  createRequest,
  approveRequest,
  rejectRequest
};
