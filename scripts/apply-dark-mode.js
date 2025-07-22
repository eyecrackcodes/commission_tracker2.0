const fs = require('fs');
const path = require('path');

// Define replacements for dark mode
const replacements = [
  // General backgrounds
  { from: 'bg-white', to: 'bg-white dark:bg-gray-800' },
  { from: 'bg-gray-50', to: 'bg-gray-50 dark:bg-gray-900' },
  { from: 'bg-gray-100', to: 'bg-gray-100 dark:bg-gray-800' },
  
  // Text colors
  { from: 'text-gray-900', to: 'text-gray-900 dark:text-gray-100' },
  { from: 'text-gray-800', to: 'text-gray-800 dark:text-gray-200' },
  { from: 'text-gray-700', to: 'text-gray-700 dark:text-gray-300' },
  { from: 'text-gray-600', to: 'text-gray-600 dark:text-gray-400' },
  { from: 'text-gray-500', to: 'text-gray-500 dark:text-gray-400' },
  
  // Borders
  { from: 'border-gray-200', to: 'border-gray-200 dark:border-gray-700' },
  { from: 'border-gray-300', to: 'border-gray-300 dark:border-gray-600' },
  { from: 'divide-gray-200', to: 'divide-gray-200 dark:divide-gray-700' },
  
  // Shadows
  { from: 'shadow-sm', to: 'shadow-sm dark:shadow-gray-900/30' },
  { from: 'shadow', to: 'shadow dark:shadow-gray-900/50' },
  
  // Hover states
  { from: 'hover:bg-gray-50', to: 'hover:bg-gray-50 dark:hover:bg-gray-700' },
  { from: 'hover:bg-gray-100', to: 'hover:bg-gray-100 dark:hover:bg-gray-700' },
  { from: 'hover:bg-gray-200', to: 'hover:bg-gray-200 dark:hover:bg-gray-600' },
];

// Files to update
const filesToUpdate = [
  'src/components/PolicyTable.tsx',
  'src/components/InsightsDashboard.tsx',
  'src/components/CommissionPipeline.tsx',
  'src/components/AgentProfile.tsx',
  'src/components/AddPolicyButton.tsx',
  'src/components/SlackNotificationModal.tsx',
];

function applyDarkMode() {
  filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    replacements.forEach(({ from, to }) => {
      // Only replace if dark mode class isn't already present
      const regex = new RegExp(`className="([^"]*\\b${from}\\b(?!.*dark:)[^"]*)"`, 'g');
      const newContent = content.replace(regex, (match, classes) => {
        return match.replace(from, to);
      });
      
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✓ Updated ${file}`);
    } else {
      console.log(`- No changes needed for ${file}`);
    }
  });
}

console.log('Applying dark mode classes...\n');
applyDarkMode();
console.log('\nDark mode application complete!'); 