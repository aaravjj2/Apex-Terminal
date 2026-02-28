const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

const BEFORE_DIR = 'C:\\Tradingview recreation\\artifacts\\proof\\v1-51-52-uiux\\screenshots_before';
const AFTER_DIR = 'C:\\Tradingview recreation\\artifacts\\proof\\v1-51-52-uiux\\screenshots_after';
const DIFF_DIR = 'C:\\Tradingview recreation\\artifacts\\proof\\v1-51-52-uiux\\screenshots_diff';

// Ensure diff directory exists
if (!fs.existsSync(DIFF_DIR)) {
  fs.mkdirSync(DIFF_DIR, { recursive: true });
}

// Get all before screenshot files
const beforeFiles = fs.readdirSync(BEFORE_DIR).filter(f => f.endsWith('.png')).sort();
const afterFiles = fs.readdirSync(AFTER_DIR).filter(f => f.endsWith('.png')).sort();

console.log(`Found ${beforeFiles.length} BEFORE screenshots`);
console.log(`Found ${afterFiles.length} AFTER screenshots`);

let diffsGenerated = 0;
const diffResults = [];

beforeFiles.forEach((filename, idx) => {
  const beforePath = path.join(BEFORE_DIR, filename);
  const afterPath = path.join(AFTER_DIR, filename);
  const diffPath = path.join(DIFF_DIR, filename);

  if (!fs.existsSync(afterPath)) {
    console.log(`⚠️  No matching AFTER file for ${filename}`);
    return;
  }

  try {
    const beforeImg = PNG.sync.read(fs.readFileSync(beforePath));
    const afterImg = PNG.sync.read(fs.readFileSync(afterPath));

    const { width, height } = beforeImg;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      beforeImg.data,
      afterImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const diffPercent = ((numDiffPixels / (width * height)) * 100).toFixed(2);

    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    diffsGenerated++;

    diffResults.push({
      filename,
      width,
      height,
      diffPixels: numDiffPixels,
      diffPercent,
    });

    console.log(`✅ ${filename}: ${diffPercent}% different (${numDiffPixels} pixels)`);
  } catch (err) {
    console.error(`❌ Error processing ${filename}:`, err.message);
  }
});

// Write summary JSON
const summaryPath = path.join(DIFF_DIR, 'diff-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(diffResults, null, 2));

console.log(`\n✅ Generated ${diffsGenerated} diff images`);
console.log(`📊 Summary saved to: ${summaryPath}`);
