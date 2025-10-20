-- =====================================================
-- Infrastructure Management Migration
-- Date: 2025-10-15
-- Description: Adds comprehensive PoP/SubPoP management
-- =====================================================

USE opticonnect_db;

-- Drop existing minimal infrastructure_items table if exists
DROP TABLE IF EXISTS infrastructure_items;

-- Create comprehensive infrastructure_items table
CREATE TABLE IF NOT EXISTS infrastructure_items (
  -- Primary Key
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Foreign Keys
  user_id INT NOT NULL,
  region_id INT NULL,
  created_by INT NULL,

  -- Basic Information
  item_type ENUM('POP', 'SubPOP', 'Tower', 'Building', 'Equipment', 'Other') DEFAULT 'POP',
  item_name VARCHAR(255) NOT NULL,
  unique_id VARCHAR(100) NOT NULL,
  network_id VARCHAR(100) NULL,
  ref_code VARCHAR(100) NULL,

  -- Location
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  height DECIMAL(10, 2) NULL,

  -- Address
  address_street VARCHAR(255) NULL,
  address_city VARCHAR(100) NULL,
  address_state VARCHAR(100) NULL,
  address_pincode VARCHAR(20) NULL,

  -- Contact Information
  contact_name VARCHAR(150) NULL,
  contact_phone VARCHAR(30) NULL,
  contact_email VARCHAR(191) NULL,

  -- Rental Information
  is_rented BOOLEAN DEFAULT FALSE,
  rent_amount DECIMAL(10, 2) NULL,
  agreement_start_date DATE NULL,
  agreement_end_date DATE NULL,
  landlord_name VARCHAR(150) NULL,
  landlord_contact VARCHAR(30) NULL,

  -- Business Information
  nature_of_business VARCHAR(255) NULL,
  owner VARCHAR(150) NULL,

  -- Technical Details
  structure_type ENUM('Tower', 'Building', 'Ground', 'Rooftop', 'Other') DEFAULT 'Tower',
  ups_availability BOOLEAN DEFAULT FALSE,
  ups_capacity VARCHAR(100) NULL,
  backup_capacity VARCHAR(100) NULL,
  power_source ENUM('Grid', 'Solar', 'Generator', 'Hybrid', 'Other') DEFAULT 'Grid',

  -- Equipment & Connectivity (JSON)
  equipment_list JSON NULL,
  connected_to JSON NULL,
  bandwidth VARCHAR(100) NULL,

  -- Status & Maintenance
  status ENUM('Active', 'Inactive', 'Maintenance', 'Planned', 'RFS', 'Damaged') DEFAULT 'Active',
  installation_date DATE NULL,
  maintenance_due_date DATE NULL,

  -- Metadata
  source ENUM('Manual', 'KML', 'Import', 'API') DEFAULT 'Manual',
  kml_filename VARCHAR(255) NULL,
  notes TEXT NULL,
  properties JSON NULL,
  photos JSON NULL,

  -- Capacity (JSON for flexibility)
  capacity JSON NULL,
  equipment_details JSON NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_region_id (region_id),
  INDEX idx_created_by (created_by),
  INDEX idx_item_type (item_type),
  INDEX idx_status (status),
  INDEX idx_source (source),
  INDEX idx_unique_id (unique_id),
  INDEX idx_network_id (network_id),
  INDEX idx_created_at (created_at),

  -- Foreign Key Constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create temporary import table for preview functionality
CREATE TABLE IF NOT EXISTS infrastructure_imports (
  -- Primary Key
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Import Session
  import_session_id VARCHAR(100) NOT NULL,
  imported_by INT NOT NULL,

  -- Same structure as infrastructure_items (minus id)
  item_type ENUM('POP', 'SubPOP', 'Tower', 'Building', 'Equipment', 'Other') DEFAULT 'POP',
  item_name VARCHAR(255) NOT NULL,
  unique_id VARCHAR(100) NOT NULL,
  network_id VARCHAR(100) NULL,
  ref_code VARCHAR(100) NULL,

  -- Location
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  height DECIMAL(10, 2) NULL,

  -- Address
  address_street VARCHAR(255) NULL,
  address_city VARCHAR(100) NULL,
  address_state VARCHAR(100) NULL,
  address_pincode VARCHAR(20) NULL,

  -- Contact Information
  contact_name VARCHAR(150) NULL,
  contact_phone VARCHAR(30) NULL,
  contact_email VARCHAR(191) NULL,

  -- Rental Information
  is_rented BOOLEAN DEFAULT FALSE,
  rent_amount DECIMAL(10, 2) NULL,
  agreement_start_date DATE NULL,
  agreement_end_date DATE NULL,
  landlord_name VARCHAR(150) NULL,
  landlord_contact VARCHAR(30) NULL,

  -- Business Information
  nature_of_business VARCHAR(255) NULL,
  owner VARCHAR(150) NULL,

  -- Technical Details
  structure_type ENUM('Tower', 'Building', 'Ground', 'Rooftop', 'Other') DEFAULT 'Tower',
  ups_availability BOOLEAN DEFAULT FALSE,
  ups_capacity VARCHAR(100) NULL,
  backup_capacity VARCHAR(100) NULL,
  power_source ENUM('Grid', 'Solar', 'Generator', 'Hybrid', 'Other') DEFAULT 'Grid',

  -- Equipment & Connectivity (JSON)
  equipment_list JSON NULL,
  connected_to JSON NULL,
  bandwidth VARCHAR(100) NULL,

  -- Status & Maintenance
  status ENUM('Active', 'Inactive', 'Maintenance', 'Planned', 'RFS', 'Damaged') DEFAULT 'Active',
  installation_date DATE NULL,
  maintenance_due_date DATE NULL,

  -- Metadata
  source ENUM('Manual', 'KML', 'Import', 'API') DEFAULT 'KML',
  kml_filename VARCHAR(255) NULL,
  notes TEXT NULL,
  properties JSON NULL,

  -- Auto-detected region (will be set during import)
  detected_region_id INT NULL,

  -- Selection status
  is_selected BOOLEAN DEFAULT TRUE,

  -- Timestamps
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_import_session (import_session_id),
  INDEX idx_imported_by (imported_by),
  INDEX idx_item_type (item_type),
  INDEX idx_detected_region (detected_region_id),
  INDEX idx_imported_at (imported_at),

  -- Foreign Key Constraints
  FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (detected_region_id) REFERENCES regions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create function to auto-detect region from coordinates
DELIMITER //

CREATE FUNCTION detect_region_from_coordinates(
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8)
) RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE region_id INT DEFAULT NULL;

  -- Example logic: Find closest region or use boundary check
  -- For now, return NULL (to be implemented with actual region boundary logic)
  -- In practice, you would join with regions table and use spatial queries

  SELECT id INTO region_id
  FROM regions
  WHERE is_active = TRUE
  LIMIT 1;

  RETURN region_id;
END//

DELIMITER ;

-- Add audit log for infrastructure changes
CREATE TABLE IF NOT EXISTS infrastructure_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  infrastructure_id INT NOT NULL,
  user_id INT NOT NULL,
  action ENUM('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'EXPORT') NOT NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_infrastructure_id (infrastructure_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT '✅ Infrastructure management tables created successfully' AS status;
