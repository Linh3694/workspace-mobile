const fs = require('fs');
const path = require('path');

// Directory containing your emoji .gif files
const EMOJI_DIR = path.resolve(__dirname, '../src/assets/emojis');
// Output JSON file path
const OUTPUT_PATH = path.resolve(EMOJI_DIR, 'emoji-codes.json');

function main() {
    // Read all files in emoji directory
    const files = fs.readdirSync(EMOJI_DIR)
        .filter(file => {
            const filePath = path.join(EMOJI_DIR, file);
            return fs.statSync(filePath).isFile();
        });

    // Map each file to { code, name }
    const emojis = files.map(file => {
        const code = file.replace(/\.[^/.]+$/, '');
        const name = code.replace(/_/g, ' ');
        return { code, name };
    });

    // Write metadata JSON
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(emojis, null, 2), 'utf-8');
    console.log(`✅ Saved ${emojis.length} emojis to ${OUTPUT_PATH}`);
}

main();
