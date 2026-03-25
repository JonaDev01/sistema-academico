// =============================================================
//  src/routes/estudiantes.routes.js
//  IMPORTANTE: rutas estáticas SIEMPRE antes de rutas con :id
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAuth, verificarAdmin } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/estudiantes.controller');

// ── Rutas estáticas (sin parámetros) — VAN PRIMERO ──────────
router.get( '/estudiantes',                  verificarAuth,  ctrl.listarEstudiantes);
router.get( '/estudiantes/nuevo',            verificarAdmin, ctrl.mostrarFormNuevo);
router.post('/estudiantes/nuevo',            verificarAdmin, ctrl.crearEstudiante);

// ── Rutas dinámicas (con :id) — VAN DESPUÉS ─────────────────
router.get( '/estudiantes/:id',              verificarAuth,  ctrl.verPerfil);
router.get( '/estudiantes/:id/notas',        verificarAuth,  ctrl.verNotas);
router.get( '/estudiantes/:id/editar',       verificarAdmin, ctrl.mostrarFormEditar);
router.post('/estudiantes/:id/editar',       verificarAdmin, ctrl.actualizarEstudiante);
router.post('/estudiantes/:id/toggle',       verificarAdmin, ctrl.toggleEstudiante);

module.exports = router;
