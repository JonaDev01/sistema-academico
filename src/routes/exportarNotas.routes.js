// =============================================================
//  src/routes/exportarNotas.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAuth } = require('../middlewares/auth.middleware');
const { exportarGeneral, exportarCorte } = require('../controllers/exportarNotas.controller');

router.get('/notas/exportar/general', verificarAuth, exportarGeneral);
router.get('/notas/exportar/corte',   verificarAuth, exportarCorte);

module.exports = router;
