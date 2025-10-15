const { pool } = require('../config/database');

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
    const { region_id, region_name, request_type, reason } = req.body;

    // Accept either region_id or region_name
    if ((!region_id && !region_name) || !request_type) {
      return res.status(400).json({
        success: false,
        error: 'Region (ID or name) and request type are required'
      });
    }

    if (!['access', 'modification', 'creation'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type. Must be: access, modification, or creation'
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

    // Check if user already has access (for access requests)
    if (request_type === 'access') {
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
    }

    // Check for pending request
    const [pendingRequests] = await pool.query(
      'SELECT id FROM region_requests WHERE user_id = ? AND region_id = ? AND request_type = ? AND status = ?',
      [userId, regionId, request_type, 'pending']
    );

    if (pendingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending request for this region'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO region_requests
       (user_id, region_id, request_type, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, regionId, request_type, reason || '']
    );

    console.log(`✅ Created region request ID: ${result.insertId} for user ${userId} - ${request_type} for region ${regionId}`);

    res.status(201).json({
      success: true,
      request: {
        id: result.insertId,
        user_id: userId,
        region_id: regionId,
        request_type,
        reason,
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
    const { review_notes } = req.body;

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
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
         WHERE id = ?`,
        [reviewerId, review_notes, id]
      );

      // Grant access based on request type
      if (request.request_type === 'access') {
        await connection.query(
          `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
           VALUES (?, ?, 'read', ?)
           ON DUPLICATE KEY UPDATE access_level = 'read', assigned_by = ?`,
          [request.user_id, request.region_id, reviewerId, reviewerId]
        );
      } else if (request.request_type === 'creation') {
        // Activate the region if it was created
        await connection.query(
          'UPDATE regions SET is_active = true WHERE id = ?',
          [request.region_id]
        );
      }

      await connection.commit();

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
    const { review_notes } = req.body;

    if (reviewerRole !== 'admin' && reviewerRole !== 'manager') {
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
           review_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ?`,
      [review_notes || 'Rejected', reviewerId, id]
    );

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
