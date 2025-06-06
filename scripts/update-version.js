#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Hàm để cập nhật version trong app.json
const updateVersion = (versionType = 'patch', customVersion = null) => {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  
  try {
    // Đọc file app.json
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const currentVersion = appJson.expo.version;
    
    console.error(`Current version: ${currentVersion}`);
    
    let newVersion;
    
    if (customVersion) {
      // Sử dụng version tùy chỉnh
      newVersion = customVersion;
    } else {
      // Auto increment version
      const versionParts = currentVersion.split('.').map(v => parseInt(v));
      const [major, minor, patch] = versionParts;
      
      switch (versionType) {
        case 'major':
          newVersion = `${major + 1}.0.0`;
          break;
        case 'minor':
          newVersion = `${major}.${minor + 1}.0`;
          break;
        case 'patch':
        default:
          newVersion = `${major}.${minor}.${patch + 1}`;
          break;
      }
    }
    
    // Cập nhật version trong app.json
    appJson.expo.version = newVersion;
    
    // Ghi lại file app.json
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    
    console.error(`Updated version: ${currentVersion} -> ${newVersion}`);
    
    // Cũng cập nhật version trong package.json nếu cần
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJson.version = newVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.error(`Updated package.json version: ${newVersion}`);
    }
    
    // Chỉ output version number cho GitHub Actions
    console.log(newVersion);
    return newVersion;
  } catch (error) {
    console.error('Error updating version:', error.message);
    process.exit(1);
  }
};

// Xử lý command line arguments
const args = process.argv.slice(2);
const versionType = args[0] || 'patch'; // patch, minor, major
const customVersion = args[1] || null;

if (require.main === module) {
  updateVersion(versionType, customVersion);
}

module.exports = { updateVersion }; 