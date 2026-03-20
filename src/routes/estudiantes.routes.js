// =============================================================
//  src/routes/estudiantes.routes.js
// =============================================================

const express    = require('express');
const router     = express.Router();
const { verificarAuth } = require('../middlewares/auth.middleware');
const { verNotas }      = require('../controllers/estudiantes.controller');

// Ver notas de un estudiante específico
// Acceso: admin siempre / docente si tiene clase en el mismo grado
router.get('/estudiantes/:id/notas', verificarAuth, verNotas);

module.exports = router;
