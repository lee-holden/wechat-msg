const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (ext === '.sil') ext = '.mp3';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.sil'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) cb(null, true);
    else {
      console.log('拦截非 sil 文件，不保存:', file.originalname);
      cb(null, false);
    }
  },
});

module.exports = upload;
