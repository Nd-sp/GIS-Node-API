const fs = require('fs');

const geojsonPath = 'C:/Users/hkcha/OneDrive/Desktop/New folder/OptiConnect_Frontend/public/india.json';
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

const states = data.features.map(f => f.properties.st_nm).sort();

console.log('=== GEOJSON STATE NAMES ===\n');
console.log(`Total: ${states.length}\n`);
states.forEach((state, index) => {
  console.log(`${index + 1}. ${state}`);
});
