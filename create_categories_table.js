const { pool } = require('./src/config/database');

async function createCategoriesTable() {
  try {
    console.log('🔧 Creating infrastructure_categories table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS infrastructure_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('POP', 'SubPOP', 'Tower', 'Building', 'Equipment', 'Other') NOT NULL,
        description TEXT NULL,
        icon VARCHAR(50) NULL,
        color VARCHAR(20) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_is_active (is_active),
        UNIQUE KEY unique_name_type (name, type)
      ) ENGINE=InnoDB
    `);

    console.log('✅ infrastructure_categories table created successfully!');

    // Insert some default categories
    await pool.query(`
      INSERT IGNORE INTO infrastructure_categories (name, type, description, icon, color) VALUES
        ('Primary POP', 'POP', 'Main Point of Presence', 'tower', '#FF5733'),
        ('Secondary POP', 'POP', 'Secondary Point of Presence', 'tower', '#FFC300'),
        ('Distribution SubPOP', 'SubPOP', 'Distribution point', 'building', '#DAF7A6'),
        ('Access SubPOP', 'SubPOP', 'Access point', 'building', '#C70039'),
        ('Telecom Tower', 'Tower', 'Telecommunications tower', 'tower', '#900C3F'),
        ('Data Center', 'Building', 'Data center facility', 'server', '#581845'),
        ('Router', 'Equipment', 'Network router equipment', 'router', '#3498DB'),
        ('Switch', 'Equipment', 'Network switch equipment', 'switch', '#2ECC71')
    `);

    console.log('✅ Default categories inserted!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createCategoriesTable();
