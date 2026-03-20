// =============================================================
//  src/middlewares/auth.middleware.js
// =============================================================

const { Asignacion } = require('../models');

// ── Verifica que haya sesión activa ─────────────────────────
const verificarAuth = (req, res, next) => {
  if (!req.session.usuario) return res.redirect('/login');
  next();
};

// ── Verifica que el usuario sea admin ───────────────────────
const verificarAdmin = (req, res, next) => {
  if (!req.session.usuario) return res.redirect('/login');
  if (req.session.usuario.rol !== 'admin') {
    return res.status(403).render('403', { titulo: 'Acceso denegado' });
  }
  next();
};

// ── Verifica que el docente tenga acceso a la clase ─────────
// Uso: router.get('/notas/:gradoId/:materiaId', verificarAuth, verificarClaseDocente, ...)
// Espera req.params.gradoId y req.params.materiaId
const verificarClaseDocente = async (req, res, next) => {
  const usuario = req.session.usuario;
  if (!usuario) return res.redirect('/login');

  // Admin tiene acceso a todo
  if (usuario.rol === 'admin') return next();

  const { gradoId, materiaId } = req.params;

  try {
    const asignacion = await Asignacion.findOne({
      where: {
        docente_id: usuario.docente_id,
        grado_id:   gradoId,
        materia_id: materiaId,
        activo:     true,
      }
    });

    if (!asignacion) {
      return res.status(403).render('403', { titulo: 'Acceso denegado' });
    }

    next();
  } catch (error) {
    console.error('Error en verificarClaseDocente:', error);
    res.status(500).render('404', { titulo: 'Error del servidor' });
  }
};

module.exports = { verificarAuth, verificarAdmin, verificarClaseDocente };
