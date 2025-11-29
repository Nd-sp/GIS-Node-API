-- ============================================
-- Insert ALL Indian States/UTs for Boundary Editor
-- Matches india.json GeoJSON data (37 features in india.json)
-- Note: Dadra & Daman are merged in current admin but separate in old GeoJSON
-- ============================================

-- Insert India country
INSERT IGNORE INTO regions (id, name, code, type, parent_region_id, latitude, longitude, is_active, description)
VALUES (1, 'India', 'IN', 'country', NULL, 20.5937, 78.9629, TRUE, 'Republic of India');

-- Insert all 37 states and union territories (matching india.json)
INSERT IGNORE INTO regions (id, name, code, type, parent_region_id, latitude, longitude, is_active, description)
VALUES
-- States (28)
(2, 'Andhra Pradesh', 'AP', 'state', 1, 15.9129, 79.7400, TRUE, 'Southern state'),
(3, 'Arunachal Pradesh', 'AR', 'state', 1, 28.2180, 94.7278, TRUE, 'North-eastern state'),
(4, 'Assam', 'AS', 'state', 1, 26.2006, 92.9376, TRUE, 'North-eastern state'),
(5, 'Bihar', 'BR', 'state', 1, 25.0961, 85.3131, TRUE, 'Eastern state'),
(6, 'Chhattisgarh', 'CT', 'state', 1, 21.2787, 81.8661, TRUE, 'Central state'),
(7, 'Goa', 'GA', 'state', 1, 15.2993, 74.1240, TRUE, 'Western coastal state'),
(8, 'Gujarat', 'GJ', 'state', 1, 22.2587, 71.1924, TRUE, 'Western state'),
(9, 'Haryana', 'HR', 'state', 1, 29.0588, 76.0856, TRUE, 'Northern state'),
(10, 'Himachal Pradesh', 'HP', 'state', 1, 31.1048, 77.1734, TRUE, 'Northern hill state'),
(11, 'Jharkhand', 'JH', 'state', 1, 23.6102, 85.2799, TRUE, 'Eastern state'),
(12, 'Karnataka', 'KA', 'state', 1, 15.3173, 75.7139, TRUE, 'Southern state'),
(13, 'Kerala', 'KL', 'state', 1, 10.8505, 76.2711, TRUE, 'Southern coastal state'),
(14, 'Madhya Pradesh', 'MP', 'state', 1, 22.9734, 78.6569, TRUE, 'Central state'),
(15, 'Maharashtra', 'MH', 'state', 1, 19.7515, 75.7139, TRUE, 'Western state'),
(16, 'Manipur', 'MN', 'state', 1, 24.6637, 93.9063, TRUE, 'North-eastern state'),
(17, 'Meghalaya', 'ML', 'state', 1, 25.4670, 91.3662, TRUE, 'North-eastern state'),
(18, 'Mizoram', 'MZ', 'state', 1, 23.1645, 92.9376, TRUE, 'North-eastern state'),
(19, 'Nagaland', 'NL', 'state', 1, 26.1584, 94.5624, TRUE, 'North-eastern state'),
(20, 'Odisha', 'OR', 'state', 1, 20.9517, 85.0985, TRUE, 'Eastern state'),
(21, 'Punjab', 'PB', 'state', 1, 31.1471, 75.3412, TRUE, 'Northern state'),
(22, 'Rajasthan', 'RJ', 'state', 1, 27.0238, 74.2179, TRUE, 'Northern state'),
(23, 'Sikkim', 'SK', 'state', 1, 27.5330, 88.5122, TRUE, 'North-eastern hill state'),
(24, 'Tamil Nadu', 'TN', 'state', 1, 11.1271, 78.6569, TRUE, 'Southern state'),
(25, 'Telangana', 'TG', 'state', 1, 18.1124, 79.0193, TRUE, 'Southern state'),
(26, 'Tripura', 'TR', 'state', 1, 23.9408, 91.9882, TRUE, 'North-eastern state'),
(27, 'Uttar Pradesh', 'UP', 'state', 1, 26.8467, 80.9462, TRUE, 'Northern state'),
(28, 'Uttarakhand', 'UT', 'state', 1, 30.0668, 79.0193, TRUE, 'Northern hill state'),
(29, 'West Bengal', 'WB', 'state', 1, 22.9868, 87.8550, TRUE, 'Eastern state'),

-- Union Territories (9) - Note: Dadra/Daman split into 2 for india.json compatibility
(30, 'Andaman and Nicobar Islands', 'AN', 'state', 1, 11.7401, 92.6586, TRUE, 'Union Territory'),
(31, 'Chandigarh', 'CH', 'state', 1, 30.7333, 76.7794, TRUE, 'Union Territory'),
(32, 'Dadra and Nagar Haveli', 'DN', 'state', 1, 20.1809, 73.0169, TRUE, 'Union Territory'),
(33, 'Daman and Diu', 'DD', 'state', 1, 20.4283, 72.8397, TRUE, 'Union Territory'),
(34, 'Delhi', 'DL', 'state', 1, 28.7041, 77.1025, TRUE, 'National Capital Territory'),
(35, 'Jammu and Kashmir', 'JK', 'state', 1, 33.7782, 76.5762, TRUE, 'Union Territory'),
(36, 'Ladakh', 'LA', 'state', 1, 34.1526, 77.5771, TRUE, 'Union Territory'),
(37, 'Lakshadweep', 'LD', 'state', 1, 10.5667, 72.6417, TRUE, 'Union Territory'),
(38, 'Puducherry', 'PY', 'state', 1, 11.9416, 79.8083, TRUE, 'Union Territory');

-- Verify insertions
SELECT 'All 38 Indian states/UTs inserted successfully (37 from india.json + 1 extra for Dadra/Daman split)!' as Status;
SELECT type, COUNT(*) as count FROM regions GROUP BY type;
SELECT id, name, code, type FROM regions WHERE type = 'state' ORDER BY name LIMIT 40;
