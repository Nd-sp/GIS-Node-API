/**
 * KML Import Script
 * Imports pop_location.kml and sub_pop_location.kml into the database
 * Usage: node scripts/import-kml-files.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');
const { parseStringPromise } = require('xml2js');
const { v4: uuidv4 } = require('uuid');

// Admin user ID (adjust if needed)
const ADMIN_USER_ID = 1;

/**
 * Auto-detect region from coordinates
 */
const detectRegionFromCoordinates = async (lat, lng) => {
  try {
    const regionMappings = [
      { name: 'Gujarat', latMin: 20.0, latMax: 24.7, lngMin: 68.0, lngMax: 74.5 },
      { name: 'Maharashtra', latMin: 15.6, latMax: 22.0, lngMin: 72.6, lngMax: 80.9 },
      { name: 'Rajasthan', latMin: 23.0, latMax: 30.2, lngMin: 69.5, lngMax: 78.3 },
      { name: 'Odisha', latMin: 17.8, latMax: 22.6, lngMin: 81.3, lngMax: 87.5 },
      { name: 'West Bengal', latMin: 21.5, latMax: 27.2, lngMin: 85.8, lngMax: 89.9 },
      { name: 'Uttar Pradesh', latMin: 23.9, latMax: 30.4, lngMin: 77.1, lngMax: 84.6 },
      { name: 'Karnataka', latMin: 11.5, latMax: 18.5, lngMin: 74.0, lngMax: 78.6 },
      { name: 'Tamil Nadu', latMin: 8.1, latMax: 13.6, lngMin: 76.2, lngMax: 80.3 }
    ];

    for (const region of regionMappings) {
      if (lat >= region.latMin && lat <= region.latMax &&
          lng >= region.lngMin && lng <= region.lngMax) {
        const [regions] = await pool.query(
          'SELECT id FROM regions WHERE name = ? AND is_active = TRUE LIMIT 1',
          [region.name]
        );
        if (regions.length > 0) {
          return regions[0].id;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error detecting region:', error);
    return null;
  }
};

/**
 * Parse ExtendedData from KML placemark
 */
const parseExtendedData = (placemark) => {
  const data = {};
  if (placemark.ExtendedData && placemark.ExtendedData[0]?.Data) {
    placemark.ExtendedData[0].Data.forEach(item => {
      const name = item.$.name;
      const value = item.value?.[0] || '';
      data[name] = value;
    });
  }
  return data;
};

/**
 * Import a single KML file
 */
const importKMLFile = async (filePath, itemType) => {
  try {
    console.log(`\n📂 Reading ${itemType} file: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return { success: false, count: 0 };
    }

    // Read KML file
    const kmlData = fs.readFileSync(filePath, 'utf8');
    console.log(`✅ File loaded (${(kmlData.length / 1024).toFixed(2)} KB)`);

    // Parse KML
    console.log('🔄 Parsing KML data...');
    const parsedKML = await parseStringPromise(kmlData);

    // Extract placemarks
    let placemarks = [];
    if (parsedKML?.kml?.Document?.[0]?.Placemark) {
      placemarks = parsedKML.kml.Document[0].Placemark;
    }
    if (parsedKML?.kml?.Document?.[0]?.Folder) {
      const folders = parsedKML.kml.Document[0].Folder;
      folders.forEach(folder => {
        if (folder.Placemark) {
          placemarks.push(...folder.Placemark);
        }
      });
    }

    console.log(`📊 Found ${placemarks.length} placemarks`);

    if (placemarks.length === 0) {
      console.error('❌ No placemarks found in KML file');
      return { success: false, count: 0 };
    }

    // Process placemarks
    const batchValues = [];
    let processedCount = 0;
    let skippedCount = 0;

    console.log('🔄 Processing placemarks...');

    for (const placemark of placemarks) {
      const name = placemark.name?.[0] || 'Unnamed';
      const coordinatesStr = placemark.Point?.[0]?.coordinates?.[0]?.trim();

      if (!coordinatesStr) {
        skippedCount++;
        continue;
      }

      const [lng, lat, height] = coordinatesStr.split(',').map(v => parseFloat(v.trim()));

      if (isNaN(lat) || isNaN(lng)) {
        skippedCount++;
        continue;
      }

      // Parse extended data
      const extData = parseExtendedData(placemark);

      // Generate unique ID
      const uniqueId = extData.unique_id || `KML-${itemType}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Detect region
      const detectedRegionId = await detectRegionFromCoordinates(lat, lng);

      // Map status to valid ENUM values
      const statusMapping = {
        'RFS': 'RFS',
        'L1': 'Active',
        'L2': 'Active',
        'L3': 'Active',
        'LIVE': 'Active',
        'Active': 'Active',
        'Inactive': 'Inactive',
        'Maintenance': 'Maintenance',
        'Planned': 'Planned',
        'Damaged': 'Damaged'
      };
      const mappedStatus = statusMapping[extData.status] || 'Active';

      // Map structure_type to valid ENUM values (handle empty strings)
      const structureTypeMapping = {
        'Tower': 'Tower',
        'Building': 'Building',
        'Ground': 'Ground',
        'Rooftop': 'Rooftop',
        'Other': 'Other'
      };
      const mappedStructureType = (extData.structure_type && extData.structure_type.trim())
        ? (structureTypeMapping[extData.structure_type] || 'Other')
        : 'Tower';

      // Prepare row data
      batchValues.push([
        ADMIN_USER_ID,                           // user_id
        detectedRegionId,                        // region_id
        ADMIN_USER_ID,                           // created_by
        itemType,                                // item_type
        name,                                    // item_name
        uniqueId,                                // unique_id
        extData.network_id || `NET-${uniqueId}`, // network_id
        extData.ref_code || null,                // ref_code
        lat,                                     // latitude
        lng,                                     // longitude
        height || null,                          // height
        extData.address || null,                 // address_street
        null,                                    // address_city
        null,                                    // address_state
        null,                                    // address_pincode
        extData.contact_name || null,            // contact_name
        extData.contact_no || null,              // contact_phone
        null,                                    // contact_email
        extData.is_rented === 'True',            // is_rented
        parseFloat(extData.rent_amount) || null, // rent_amount
        extData.agreement_start_date || null,    // agreement_start_date
        extData.agreement_end_date || null,      // agreement_end_date
        null,                                    // landlord_name
        null,                                    // landlord_contact
        extData.nature_of_bussiness || null,     // nature_of_business
        extData.owner || null,                   // owner
        mappedStructureType,                     // structure_type (mapped to valid ENUM)
        extData.ups_avaibility === 'True',       // ups_availability
        extData.ups_capacity || null,            // ups_capacity
        extData.backup_capacity || null,         // backup_capacity
        'Grid',                                  // power_source
        null,                                    // equipment_list
        null,                                    // connected_to
        null,                                    // bandwidth
        mappedStatus,                            // status (mapped to valid ENUM)
        null,                                    // installation_date
        null,                                    // maintenance_due_date
        'KML',                                   // source
        path.basename(filePath),                 // kml_filename
        null,                                    // notes
        JSON.stringify(extData),                 // properties
        null,                                    // photos
        null,                                    // capacity
        null                                     // equipment_details
      ]);

      processedCount++;

      // Show progress every 100 items
      if (processedCount % 100 === 0) {
        process.stdout.write(`\r   Processed: ${processedCount}/${placemarks.length}`);
      }
    }

    console.log(`\n✅ Processed ${processedCount} items (skipped ${skippedCount})`);

    // Batch insert
    if (batchValues.length > 0) {
      console.log('💾 Batch inserting into database...');

      await pool.query(
        `INSERT INTO infrastructure_items
         (user_id, region_id, created_by, item_type, item_name, unique_id, network_id, ref_code,
          latitude, longitude, height,
          address_street, address_city, address_state, address_pincode,
          contact_name, contact_phone, contact_email,
          is_rented, rent_amount, agreement_start_date, agreement_end_date,
          landlord_name, landlord_contact, nature_of_business, owner,
          structure_type, ups_availability, ups_capacity, backup_capacity, power_source,
          equipment_list, connected_to, bandwidth,
          status, installation_date, maintenance_due_date,
          source, kml_filename, notes, properties, photos, capacity, equipment_details)
         VALUES ?`,
        [batchValues]
      );

      console.log(`✅ Successfully imported ${batchValues.length} ${itemType} items`);
      return { success: true, count: batchValues.length };
    } else {
      console.log('⚠️ No valid items to import');
      return { success: false, count: 0 };
    }

  } catch (error) {
    console.error(`❌ Error importing ${itemType}:`, error);
    return { success: false, count: 0, error: error.message };
  }
};

/**
 * Main import function
 */
const importAllKMLFiles = async () => {
  try {
    console.log('🚀 KML Import Script Started\n');
    console.log('=' .repeat(60));

    // Define file paths
    const kmlFiles = [
      {
        path: path.join(__dirname, '../public/pop_location.kml'),
        type: 'POP'
      },
      {
        path: path.join(__dirname, '../public/sub_pop_location.kml'),
        type: 'SubPOP'
      }
    ];

    let totalImported = 0;

    // Import each file
    for (const file of kmlFiles) {
      const result = await importKMLFile(file.path, file.type);
      if (result.success) {
        totalImported += result.count;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Import Complete!');
    console.log(`📊 Total items imported: ${totalImported}`);
    console.log('\n🔍 Verifying import...');

    // Verify import
    const [[stats]] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN item_type = 'POP' THEN 1 ELSE 0 END) as pop_count,
        SUM(CASE WHEN item_type = 'SubPOP' THEN 1 ELSE 0 END) as subpop_count,
        SUM(CASE WHEN source = 'KML' THEN 1 ELSE 0 END) as kml_count,
        SUM(CASE WHEN region_id IS NOT NULL THEN 1 ELSE 0 END) as with_region
       FROM infrastructure_items`
    );

    console.log('\n📊 Database Statistics:');
    console.log(`   Total items: ${stats.total}`);
    console.log(`   POP locations: ${stats.pop_count}`);
    console.log(`   SubPOP locations: ${stats.subpop_count}`);
    console.log(`   KML imports: ${stats.kml_count}`);
    console.log(`   With regions: ${stats.with_region}`);
    console.log(`   Without regions: ${stats.total - stats.with_region}`);

    console.log('\n✨ Done!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
};

// Run import
importAllKMLFiles();
