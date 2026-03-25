// =============================================================
//  src/routes/importar.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { verificarAdmin } = require('../middlewares/auth.middleware');
const { mostrarImportar, procesarImportar } = require('../controllers/importar.controller');

// Configurar multer — guardar temporalmente en uploads/
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const nombre = `import_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, nombre);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos .xlsx o .xls'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
});

router.get( '/estudiantes/importar', verificarAdmin, mostrarImportar);
router.post('/estudiantes/importar', verificarAdmin, upload.single('archivo'), procesarImportar);

module.exports = router;
