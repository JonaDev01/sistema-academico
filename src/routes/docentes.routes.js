// =============================================================
//  src/routes/docentes.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAdmin, verificarAuth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/docentes.controller');

// Rutas estáticas primero
router.get( '/docentes',              verificarAdmin, ctrl.listarDocentes);
router.get( '/docentes/nuevo',        verificarAdmin, ctrl.mostrarFormNuevo);
router.post('/docentes/nuevo',        verificarAdmin, ctrl.crearDocente);

// Rutas dinámicas
router.get( '/docentes/:id',                                    verificarAdmin, ctrl.verPerfil);
router.get( '/docentes/:id/editar',                             verificarAdmin, ctrl.mostrarFormEditar);
router.post('/docentes/:id/editar',                             verificarAdmin, ctrl.actualizarDocente);
router.post('/docentes/:id/toggle',                             verificarAdmin, ctrl.toggleDocente);
// Ruta para docente — redirige a sus propios estudiantes
router.get( '/mis-estudiantes', verificarAuth, async (req, res) => {
  const { Docente } = require('../models');
  const doc = await Docente.findOne({ where: { usuario_id: req.session.usuario.id } });
  if (!doc) return res.redirect('/dashboard');
  res.redirect(`/docentes/${doc.id}/estudiantes`);
});

router.get( '/docentes/:id/estudiantes',                        verificarAuth,  ctrl.verEstudiantes);
router.get( '/docentes/:id/asignaciones',                       verificarAdmin, ctrl.verAsignaciones);
router.post('/docentes/:id/asignaciones',                       verificarAdmin, ctrl.agregarAsignacion);
router.post('/docentes/:id/asignaciones/grado-completo',        verificarAdmin, ctrl.agregarGradoCompleto);
router.post('/docentes/:id/asignaciones/:asigId/eliminar',      verificarAdmin, ctrl.eliminarAsignacion);

module.exports = router;
