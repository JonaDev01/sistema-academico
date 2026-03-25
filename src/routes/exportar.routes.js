// =============================================================
//  src/routes/exportar.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAdmin } = require('../middlewares/auth.middleware');
const { exportarEstudiantes } = require('../controllers/exportar.controller');

// Descarga directa — no renderiza vista
router.get('/estudiantes/exportar', verificarAdmin, exportarEstudiantes);

module.exports = router;
