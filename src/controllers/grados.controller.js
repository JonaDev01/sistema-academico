// =============================================================
//  src/controllers/grados.controller.js
//  CRUD completo de grados — solo admin
// =============================================================

const { Grado, Materia } = require('../models');

// ── GET /grados ──────────────────────────────────────────────
const listarGrados = async (req, res) => {
  try {
    const grados = await Grado.findAll({
      order: [['orden', 'ASC']],
      include: [{
        model:      Materia,
        as:         'materias',
        where:      { activo: true },
        required:   false,          // LEFT JOIN — incluye grados sin materias
      }],
    });

    res.render('grados/lista', {
      titulo: 'Grados y Materias',
      grados,
      mensaje: req.query.mensaje || null,
      error:   req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en listarGrados:', error);
    res.redirect('/dashboard');
  }
};

// ── GET /grados/nuevo ────────────────────────────────────────
const mostrarFormNuevo = (req, res) => {
  res.render('grados/form', {
    titulo:  'Nuevo Grado',
    grado:   null,
    errores: [],
  });
};

// ── POST /grados/nuevo ───────────────────────────────────────
const crearGrado = async (req, res) => {
  const { nombre, nivel, orden, nivel_importacion, modalidad_importacion } = req.body;

  try {
    // Calcular orden automáticamente si no se especificó
    let ordenFinal = parseInt(orden);
    if (!ordenFinal) {
      const ultimo = await Grado.findOne({ order: [['orden', 'DESC']] });
      ordenFinal   = ultimo ? ultimo.orden + 1 : 1;
    }

    await Grado.create({
      nombre, nivel, orden: ordenFinal, activo: true,
      nivel_importacion:     nivel_importacion     || null,
      modalidad_importacion: modalidad_importacion || null,
    });
    res.redirect('/grados?mensaje=Grado creado correctamente');

  } catch (error) {
    let errores = ['Error al crear el grado'];

    if (error.name === 'SequelizeValidationError') {
      errores = error.errors.map(e => e.message);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errores = [`Ya existe un grado con el nombre "${nombre}"`];
    }

    res.render('grados/form', {
      titulo:  'Nuevo Grado',
      grado:   { nombre, nivel, orden },
      errores,
    });
  }
};

// ── GET /grados/:id/editar ───────────────────────────────────
const mostrarFormEditar = async (req, res) => {
  try {
    const grado = await Grado.findByPk(req.params.id);
    if (!grado) return res.redirect('/grados?error=Grado no encontrado');

    res.render('grados/form', {
      titulo:  `Editar — ${grado.nombre}`,
      grado,
      errores: [],
    });
  } catch (error) {
    res.redirect('/grados?error=Error al cargar el grado');
  }
};

// ── POST /grados/:id/editar ──────────────────────────────────
const actualizarGrado = async (req, res) => {
  const { nombre, nivel, orden, nivel_importacion, modalidad_importacion } = req.body;

  try {
    const grado = await Grado.findByPk(req.params.id);
    if (!grado) return res.redirect('/grados?error=Grado no encontrado');

    await grado.update({
      nombre, nivel, orden: parseInt(orden),
      nivel_importacion:     nivel_importacion     || null,
      modalidad_importacion: modalidad_importacion || null,
    });
    res.redirect('/grados?mensaje=Grado actualizado correctamente');

  } catch (error) {
    let errores = ['Error al actualizar el grado'];

    if (error.name === 'SequelizeValidationError') {
      errores = error.errors.map(e => e.message);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errores = [`Ya existe un grado con el nombre "${nombre}"`];
    }

    const grado = await Grado.findByPk(req.params.id);
    res.render('grados/form', {
      titulo:  `Editar — ${nombre}`,
      grado:   { ...grado?.dataValues, nombre, nivel, orden },
      errores,
    });
  }
};

// ── POST /grados/:id/toggle ──────────────────────────────────
// Activa o desactiva un grado (no se borra, solo se oculta)
const toggleGrado = async (req, res) => {
  try {
    const grado = await Grado.findByPk(req.params.id);
    if (!grado) return res.redirect('/grados?error=Grado no encontrado');

    await grado.update({ activo: !grado.activo });
    const accion = grado.activo ? 'desactivado' : 'activado';
    res.redirect(`/grados?mensaje=Grado ${accion} correctamente`);

  } catch (error) {
    res.redirect('/grados?error=Error al cambiar el estado del grado');
  }
};

module.exports = { listarGrados, mostrarFormNuevo, crearGrado, mostrarFormEditar, actualizarGrado, toggleGrado };
