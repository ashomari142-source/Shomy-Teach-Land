const fs = require('fs');
const path = require('path');

const OMMY_IMAGE_URL = 'https://raw.githubusercontent.com/ashomari142-source/Shomy-Teach-Land/main/OMMY.jpg';
const OMMY_IMAGE_PATH = path.join(process.cwd(), 'OMMY.jpg');

function hasLocalOmmyImage() {
    try {
        return fs.existsSync(OMMY_IMAGE_PATH);
    } catch {
        return false;
    }
}

module.exports = {
    OMMY_IMAGE_URL,
    OMMY_IMAGE_PATH,
    hasLocalOmmyImage
};
