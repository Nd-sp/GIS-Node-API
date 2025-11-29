const { pool } = require("../config/database");
const { parseStringPromise } = require("xml2js");
const { v4: uuidv4 } = require("uuid");
const {
  isValidIndiaCoordinate,
  getNearestState
} = require("../utils/coordinateValidator");
const { logAudit, detectRegionFromCoordinates } = require("./infrastructureHelpers");

/**
 * @route   POST /api/infrastructure/import/kml
 * @desc    Import KML file and save to temporary import table
 * @access  Private (ALL USERS - Admin/Manager/Technician/User)
 *
 * NEW WORKFLOW:
 * 1. All users can import KML data (stored temporarily)
 * 2. Users see imported data on their map immediately
 * 3. Users can click "Save" to make data permanent and visible to all users in region
 * 4. Unsaved data is only visible to the user who imported it
 *
 * Features:
 * - Parses KML XML format
 * - Auto-detects POP vs SubPOP based on folder names, unique_id, or name patterns
 * - Validates coordinates are within India
 * - Auto-detects region from coordinates
 * - Batch inserts for performance
 */
const importKML = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { kmlData, filename } = req.body;

    console.log("📥 KML Import Request:", {
      userId,
      userRole,
      hasKmlData: !!kmlData,
      kmlDataLength: kmlData?.length,
      filename
    });

    // All authenticated users can import KML
    console.log("✅ KML import allowed for user:", userId, "Role:", userRole);

    if (!kmlData) {
      console.error("❌ Import rejected: No KML data provided");
      return res
        .status(400)
        .json({ success: false, error: "KML data is required" });
    }

    // Parse KML data
    console.log("🔄 Parsing KML data...");
    let parsedKML;
    try {
      parsedKML = await parseStringPromise(kmlData);
      console.log("✅ KML parsed successfully");
    } catch (parseError) {
      console.error("❌ KML parsing failed:", parseError.message);
      return res.status(400).json({
        success: false,
        error: `Invalid KML format: ${parseError.message}`
      });
    }

    // Extract placemarks - they can be directly under Document or inside Folders
    let placemarks = [];

    // Try direct placemarks under Document
    if (parsedKML?.kml?.Document?.[0]?.Placemark) {
      placemarks = parsedKML.kml.Document[0].Placemark;
      console.log("📊 Found placemarks directly under Document:", placemarks.length);
    }

    // Check for placemarks inside Folders and detect type from folder name
    if (parsedKML?.kml?.Document?.[0]?.Folder) {
      const folders = parsedKML.kml.Document[0].Folder;
      console.log("📁 Found folders:", folders.length);

      folders.forEach((folder, index) => {
        if (folder.Placemark) {
          const folderName = (folder.name?.[0] || "").toLowerCase();

          // Detect type from folder name
          let folderType = "POP"; // Default
          if (
            folderName.includes("spop") ||
            folderName.includes("subpop") ||
            folderName.includes("sub_pop") ||
            folderName.includes("p_spop")
          ) {
            folderType = "SubPOP";
          } else if (
            folderName.includes("pop") ||
            folderName.includes("p_pop")
          ) {
            folderType = "POP";
          }

          console.log(
            `📍 Folder ${index + 1} "${
              folder.name?.[0] || "Unnamed"
            }" detected as ${folderType}, has ${
              folder.Placemark.length
            } placemarks`
          );

          // Add folder type to each placemark for later use
          folder.Placemark.forEach((placemark) => {
            placemark._folderType = folderType;
          });

          placemarks.push(...folder.Placemark);
        }
      });
      console.log("📊 Total placemarks from all folders:", placemarks.length);
    }

    if (placemarks.length === 0) {
      console.error("❌ No placemarks found in KML file");
      return res.status(400).json({
        success: false,
        error:
          "No placemarks found in KML file. Please check if the KML file contains valid Placemark elements."
      });
    }

    console.log(`✅ Total placemarks to process: ${placemarks.length}`);

    // Generate import session ID
    const importSessionId = uuidv4();
    const importedItems = [];
    const batchValues = [];

    // Process each placemark and collect values for batch insert
    console.log("🔄 Processing placemarks...");
    for (const placemark of placemarks) {
      const name = placemark.name?.[0] || "Unnamed";
      const description = placemark.description?.[0] || "";
      const coordinatesStr = placemark.Point?.[0]?.coordinates?.[0]?.trim();

      if (!coordinatesStr) continue;

      const [lng, lat, height] = coordinatesStr
        .split(",")
        .map((v) => parseFloat(v.trim()));

      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`⚠️ Skipping "${name}": Invalid coordinates (NaN)`);
        continue;
      }

      // Validate coordinates are within India
      const validation = isValidIndiaCoordinate(lat, lng);
      if (!validation.valid) {
        const nearest = getNearestState(lat, lng);
        console.warn(`⚠️ Skipping "${name}": ${validation.error}`);
        console.warn(`   Coordinates: (${lat}, ${lng})`);
        console.warn(`   ${nearest.suggestion}`);
        continue; // Skip items with invalid coordinates
      }

      // IMPROVED TYPE DETECTION - Multi-level approach
      let type = placemark._folderType || "POP"; // Use folder type if available

      // Extract ExtendedData for unique_id check
      let uniqueIdFromKML = null;
      if (placemark.ExtendedData?.[0]?.Data) {
        const dataFields = placemark.ExtendedData[0].Data;
        const uniqueIdField = dataFields.find((d) => d.$.name === "unique_id");
        if (uniqueIdField?.value?.[0]) {
          uniqueIdFromKML = uniqueIdField.value[0];
        }
      }

      // If folder type wasn't detected, try other methods
      if (!placemark._folderType) {
        const nameStr = name.toLowerCase();
        const descStr = description.toLowerCase();

        // Method 1: Check unique_id from ExtendedData (most reliable)
        if (uniqueIdFromKML) {
          if (
            uniqueIdFromKML.startsWith("SPOP.") ||
            uniqueIdFromKML.startsWith("SUBPOP.")
          ) {
            type = "SubPOP";
          } else if (uniqueIdFromKML.startsWith("POP.")) {
            type = "POP";
          }
        }
        // Method 2: Check name and description
        else if (
          nameStr.includes("spop") ||
          nameStr.includes("subpop") ||
          nameStr.includes("sub-pop") ||
          nameStr.includes("sub pop") ||
          descStr.includes("spop") ||
          descStr.includes("subpop")
        ) {
          type = "SubPOP";
        } else if (nameStr.includes("pop") || descStr.includes("pop")) {
          type = "POP";
        }
      }

      console.log(
        `📋 "${name}" → Type: ${type} (Folder: ${
          placemark._folderType || "none"
        }, UniqueID: ${uniqueIdFromKML || "none"})`
      );

      // Generate unique ID
      const uniqueId = `KML-${type}-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;

      // Auto-detect region
      const detectedRegionId = await detectRegionFromCoordinates(lat, lng);

      // Add to batch values
      batchValues.push([
        importSessionId,
        userId,
        type,
        name,
        uniqueId,
        `NET-${uniqueId}`,
        lat,
        lng,
        height || null,
        filename || "imported.kml",
        description,
        detectedRegionId,
        true, // is_selected
        "KML" // source
      ]);

      importedItems.push({
        name,
        type,
        uniqueId,
        latitude: lat,
        longitude: lng,
        detectedRegionId
      });
    }

    // Batch insert all items (much faster than individual inserts)
    if (batchValues.length > 0) {
      console.log(`💾 Batch inserting ${batchValues.length} items...`);

      await pool.query(
        `INSERT INTO infrastructure_imports
         (import_session_id, imported_by, item_type, item_name, unique_id, network_id,
          latitude, longitude, height, kml_filename, notes, detected_region_id, is_selected, source)
         VALUES ?`,
        [batchValues]
      );
      console.log(`✅ Batch insert completed`);
    }

    // Log summary
    const popCount = importedItems.filter((i) => i.type === "POP").length;
    const subPopCount = importedItems.filter((i) => i.type === "SubPOP").length;
    console.log(`📊 Import Summary: ${popCount} POPs, ${subPopCount} SubPOPs`);

    res.json({
      success: true,
      message: `Imported ${importedItems.length} items to preview (${popCount} POPs, ${subPopCount} SubPOPs)`,
      data: {
        importSessionId,
        itemCount: importedItems.length,
        items: importedItems
      }
    });
  } catch (error) {
    console.error("Import KML error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to import KML file" });
  }
};

/**
 * @route   GET /api/infrastructure/import/:sessionId/preview
 * @desc    Get preview of imported items
 * @access  Private (ALL USERS)
 */
const getImportPreview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const [items] = await pool.query(
      `SELECT
        i.id,
        i.import_session_id,
        i.item_type as type,
        i.item_name as name,
        i.unique_id as uniqueId,
        i.network_id as networkId,
        i.latitude,
        i.longitude,
        i.height,
        i.kml_filename as kmlFilename,
        i.notes,
        i.detected_region_id as detectedRegionId,
        i.is_selected as isSelected,
        
        i.status,
        i.contact_name as contactName,
        i.contact_phone as contactPhone,
        i.address_street as addressStreet,
        i.address_city as addressCity,
        i.address_state as addressState,
        i.address_pincode as addressPincode,
        i.structure_type as structureType,
        i.bandwidth,
        i.power_source as powerSource,
        r.name as regionName
       FROM infrastructure_imports i
       LEFT JOIN regions r ON i.detected_region_id = r.id
       WHERE i.import_session_id = ? AND i.imported_by = ?
       ORDER BY i.imported_at`,
      [sessionId, userId]
    );

    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    console.error("Get import preview error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to get import preview" });
  }
};

/**
 * @route   POST /api/infrastructure/import/:sessionId/save
 * @desc    Save selected imported items to main table (makes data permanent & visible to all)
 * @access  Private (ALL USERS)
 *
 * When user clicks "Save":
 * - Data moves from temporary import table to permanent infrastructure_items table
 * - Data becomes visible to all users in the same region
 * - Temporary import session remains (user can still see what they imported)
 */
const saveImportedItems = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const { selectedIds } = req.body; // Array of IDs to save

    // Get selected items from import table
    let query = `
      SELECT * FROM infrastructure_imports
      WHERE import_session_id = ? AND imported_by = ?
    `;
    const params = [sessionId, userId];

    if (selectedIds && selectedIds.length > 0) {
      query += ` AND id IN (${selectedIds.map(() => "?").join(",")})`;
      params.push(...selectedIds);
    } else {
      query += " AND is_selected = TRUE";
    }

    const [importedItems] = await pool.query(query, params);

    if (importedItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No items selected to save" });
    }

    // Prepare batch values for insert (matching actual database schema)
    console.log(
      `💾 Batch saving ${importedItems.length} items to infrastructure table...`
    );
    const batchValues = importedItems.map((item) => [
      item.item_name,
      item.item_type,
      item.status || "Active",
      item.latitude,
      item.longitude,
      item.detected_region_id,
      item.customer_name || null,
      item.address_street || null,  // Will be mapped to 'address' column
      item.address_city || null,    // Will be mapped to 'city' column
      item.address_state || null,   // Will be mapped to 'state' column
      item.address_pincode || null, // Will be mapped to 'pincode' column
      item.contact_name || null,    // Will be mapped to 'contact_person' column
      item.contact_email || null,
      item.contact_phone || null,
      item.installation_date || null,
      item.capacity || null,
      item.properties ? JSON.stringify(item.properties) : null,
      userId  // created_by
    ]);

    // Batch insert all items at once (much faster!)
    await pool.query(
      `INSERT INTO infrastructure_items
       (item_name, item_type, status, latitude, longitude, region_id,
        customer_name, address, city, state, pincode,
        contact_person, contact_email, contact_phone,
        installation_date, capacity, properties, created_by)
       VALUES ?`,
      [batchValues]
    );

    console.log(
      `✅ Batch insert completed: ${importedItems.length} items saved`
    );

    // Log single audit entry for the batch import
    await logAudit(
      userId,
      userId,
      "IMPORT_BATCH",
      null,
      {
        count: importedItems.length,
        session_id: sessionId,
        source: "KML",
        kml_filename: importedItems[0]?.kml_filename
      },
      req
    );

    const savedCount = importedItems.length;

    res.json({
      success: true,
      message: `Successfully saved ${savedCount} items`,
      data: {
        count: savedCount
      }
    });
  } catch (error) {
    console.error("Save imported items error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to save imported items" });
  }
};

/**
 * @route   POST /api/infrastructure/import/:sessionId/save-item/:itemId
 * @desc    Save a single imported item to permanent storage
 * @access  Private (ALL USERS)
 *
 * NEW FEATURE: Individual Save
 * - Allows user to save one item at a time
 * - Useful for gradual verification
 * - Item moves from infrastructure_imports to infrastructure_items
 */
const saveSingleImportedItem = async (req, res) => {
  try {
    const { sessionId, itemId } = req.params;
    const userId = req.user.id;

    console.log(`💾 Saving single item: ${itemId} from session: ${sessionId}`);

    // Get the specific item from imports table
    const [items] = await pool.query(
      `SELECT * FROM infrastructure_imports
       WHERE import_session_id = ?
       AND id = ?
       AND imported_by = ?`,
      [sessionId, itemId, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Item not found or access denied"
      });
    }

    const item = items[0];

    // Insert to permanent infrastructure_items table
    const [result] = await pool.query(
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
        source, notes, properties)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        item.detected_region_id,
        userId,
        item.item_type,
        item.item_name,
        item.unique_id,
        item.network_id,
        item.ref_code,
        item.latitude,
        item.longitude,
        item.height,
        item.address_street,
        item.address_city,
        item.address_state,
        item.address_pincode,
        item.contact_name,
        item.contact_phone,
        item.contact_email,
        item.is_rented,
        item.rent_amount,
        item.agreement_start_date,
        item.agreement_end_date,
        item.landlord_name,
        item.landlord_contact,
        item.nature_of_business,
        item.owner,
        item.structure_type,
        item.ups_availability,
        item.ups_capacity,
        item.backup_capacity,
        item.power_source,
        item.equipment_list,
        item.connected_to,
        item.bandwidth,
        item.status || "Active",
        item.installation_date,
        item.maintenance_due_date,
        item.source,
        item.notes,
        item.properties ? JSON.stringify(item.properties) : null
      ]
    );

    // Delete from temporary import table
    await pool.query(
      `DELETE FROM infrastructure_imports WHERE id = ?`,
      [itemId]
    );

    // Log audit
    await logAudit(
      result.insertId,
      userId,
      "IMPORT_SINGLE",
      null,
      {
        item_type: item.item_type,
        item_name: item.item_name,
        unique_id: item.unique_id,
        source: "KML",
        kml_filename: item.kml_filename
      },
      req
    );

    console.log(`✅ Successfully saved item: ${item.item_name} (ID: ${result.insertId})`);

    res.json({
      success: true,
      message: `Saved: ${item.item_name}`,
      data: {
        id: result.insertId,
        item_name: item.item_name,
        item_type: item.item_type
      }
    });

  } catch (error) {
    console.error("Save single item error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save item"
    });
  }
};

/**
 * @route   DELETE /api/infrastructure/import/:sessionId
 * @desc    Delete all imported items from session (cancel/discard import)
 * @access  Private (ALL USERS)
 */
const deleteImportSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    await pool.query(
      "DELETE FROM infrastructure_imports WHERE import_session_id = ? AND imported_by = ?",
      [sessionId, userId]
    );

    res.json({ success: true, message: "Import session deleted successfully" });
  } catch (error) {
    console.error("Delete import session error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete import session" });
  }
};

module.exports = {
  importKML,
  getImportPreview,
  saveImportedItems,
  saveSingleImportedItem,
  deleteImportSession
};
