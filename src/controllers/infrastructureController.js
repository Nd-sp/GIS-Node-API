const { pool } = require('../config/database');

/**
 * @route   GET /api/infrastructure
 * @desc    Get all user's infrastructure items
 * @access  Private
 */
const getAllInfrastructure = async (req, res) => {
  try {
    const userId = req.user.id;
    const { regionId, item_type, status } = req.query;

    let query = 'SELECT * FROM infrastructure_items WHERE user_id = ?';
    const params = [userId];

    if (regionId) {
      query += ' AND region_id = ?';
      params.push(regionId);
    }
    if (item_type) {
      query += ' AND item_type = ?';
      params.push(item_type);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const [items] = await pool.query(query, params);

    res.json({ success: true, items });
  } catch (error) {
    console.error('Get infrastructure error:', error);
    res.status(500).json({ success: false, error: 'Failed to get infrastructure items' });
  }
};

/**
 * @route   GET /api/infrastructure/:id
 * @desc    Get infrastructure item by ID
 * @access  Private
 */
const getInfrastructureById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [items] = await pool.query(
      'SELECT * FROM infrastructure_items WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({ success: false, error: 'Infrastructure item not found' });
    }

    res.json({ success: true, item: items[0] });
  } catch (error) {
    console.error('Get infrastructure item error:', error);
    res.status(500).json({ success: false, error: 'Failed to get infrastructure item' });
  }
};

/**
 * @route   POST /api/infrastructure
 * @desc    Create infrastructure item
 * @access  Private
 */
const createInfrastructure = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      item_type,
      item_name,
      latitude,
      longitude,
      height,
      owner,
      installation_date,
      maintenance_due_date,
      status,
      capacity,
      equipment_details,
      contact_person,
      contact_phone,
      region_id,
      notes,
      properties
    } = req.body;

    if (!item_type || !item_name || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Item type, name, and coordinates required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO infrastructure_items
       (user_id, region_id, item_type, item_name, latitude, longitude, height,
        owner, installation_date, maintenance_due_date, status, capacity,
        equipment_details, contact_person, contact_phone, notes, properties)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        region_id,
        item_type,
        item_name,
        latitude,
        longitude,
        height,
        owner,
        installation_date,
        maintenance_due_date,
        status || 'active',
        capacity ? JSON.stringify(capacity) : null,
        equipment_details ? JSON.stringify(equipment_details) : null,
        contact_person,
        contact_phone,
        notes,
        properties ? JSON.stringify(properties) : null
      ]
    );

    res.status(201).json({
      success: true,
      item: {
        id: result.insertId,
        item_type,
        item_name,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.error('Create infrastructure error:', error);
    res.status(500).json({ success: false, error: 'Failed to create infrastructure item' });
  }
};

/**
 * @route   PUT /api/infrastructure/:id
 * @desc    Update infrastructure item
 * @access  Private
 */
const updateInfrastructure = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateFields = req.body;

    const allowedFields = [
      'item_name', 'height', 'owner', 'installation_date', 'maintenance_due_date',
      'status', 'capacity', 'equipment_details', 'contact_person', 'contact_phone', 'notes'
    ];

    const updates = [];
    const params = [];

    Object.keys(updateFields).forEach(field => {
      if (allowedFields.includes(field)) {
        updates.push(`${field} = ?`);
        const value = ['capacity', 'equipment_details'].includes(field) && typeof updateFields[field] === 'object'
          ? JSON.stringify(updateFields[field])
          : updateFields[field];
        params.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id, userId);

    await pool.query(
      `UPDATE infrastructure_items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    res.json({ success: true, message: 'Infrastructure item updated successfully' });
  } catch (error) {
    console.error('Update infrastructure error:', error);
    res.status(500).json({ success: false, error: 'Failed to update infrastructure item' });
  }
};

/**
 * @route   DELETE /api/infrastructure/:id
 * @desc    Delete infrastructure item
 * @access  Private
 */
const deleteInfrastructure = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query('DELETE FROM infrastructure_items WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Infrastructure item deleted successfully' });
  } catch (error) {
    console.error('Delete infrastructure error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete infrastructure item' });
  }
};

/**
 * @route   PATCH /api/infrastructure/:id/status
 * @desc    Update infrastructure status
 * @access  Private
 */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'maintenance', 'damaged'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: active, inactive, maintenance, or damaged'
      });
    }

    await pool.query(
      'UPDATE infrastructure_items SET status = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [status, id, userId]
    );

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
};

/**
 * @route   POST /api/infrastructure/:id/upload-photo
 * @desc    Upload photo for infrastructure (placeholder)
 * @access  Private
 */
const uploadPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Placeholder - implement file upload with multer
    const photoUrl = '/uploads/infrastructure/' + Date.now() + '.jpg';

    // Get existing photos
    const [items] = await pool.query(
      'SELECT photos FROM infrastructure_items WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({ success: false, error: 'Infrastructure item not found' });
    }

    let photos = items[0].photos ? JSON.parse(items[0].photos) : [];
    photos.push(photoUrl);

    await pool.query(
      'UPDATE infrastructure_items SET photos = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(photos), id]
    );

    res.json({ success: true, photo_url: photoUrl });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload photo' });
  }
};

module.exports = {
  getAllInfrastructure,
  getInfrastructureById,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  updateStatus,
  uploadPhoto
};
