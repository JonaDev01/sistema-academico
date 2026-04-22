// =============================================================
//  src/routes/reportes.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAdmin } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/reportes.controller');

router.get('/admin/reportes',         verificarAdmin, ctrl.mostrarReportes);
router.get('/admin/reportes/generar', verificarAdmin, ctrl.generarReportes);

module.exports = router;
