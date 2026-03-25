// =============================================================
//  src/controllers/materias.controller.js
//  CRUD de materias dentro de un grado — solo admin
// =============================================================

const { Grado, Materia } = require('../models');

// ── GET /grados/:gradoId/materias ────────────────────────────
const listarMaterias = async (req, res) => {
  try {
    const grado = await Grado.findByPk(req.params.gradoId, {
      include: [{
        model:    Materia,
        as:       'materias',
        order:    [['nombre', 'ASC']],
        required: false,
      }],
    });

    if (!grado) return res.redirect('/grados?error=Grado no encontrado');

    // Ordenar: activas primero, luego inactivas
    const materias = (grado.materias || []).sort((a, b) => {
      if (a.activo === b.activo) return a.nombre.localeCompare(b.nombre);
      return b.activo - a.activo;
    });

    res.render('grados/materias', {
      titulo:  `Materias — ${grado.nombre}`,
      grado,
      materias,
      mensaje: req.query.mensaje || null,
      error:   req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en listarMaterias:', error);
    res.redirect('/grados?error=Error al cargar las materias');
  }
};

// ── POST /grados/:gradoId/materias/nueva ─────────────────────
const crearMateria = async (req, res) => {
  const { gradoId } = req.params;
  const { nombre } = req.body;

  try {
    const grado = await Grado.findByPk(gradoId);
    if (!grado) return res.redirect('/grados?error=Grado no encontrado');

    await Materia.create({
      grado_id: gradoId,
      nombre:   nombre.trim(),
      activo:   true,
    });

    res.redirect(`/grados/${gradoId}/materias?mensaje=Materia creada correctamente`);

  } catch (error) {
    let msg = 'Error al crear la materia';
    if (error.name === 'SequelizeUniqueConstraintError') {
      msg = `Ya existe una materia llamada "${nombre}" en este grado`;
    }
    res.redirect(`/grados/${gradoId}/materias?error=${encodeURIComponent(msg)}`);
  }
};

// ── POST /grados/:gradoId/materias/:id/editar ────────────────
const actualizarMateria = async (req, res) => {
  const { gradoId, id } = req.params;
  const { nombre } = req.body;

  try {
    const materia = await Materia.findOne({
      where: { id, grado_id: gradoId }
    });

    if (!materia) {
      return res.redirect(`/grados/${gradoId}/materias?error=Materia no encontrada`);
    }

    await materia.update({ nombre: nombre.trim() });

    res.redirect(`/grados/${gradoId}/materias?mensaje=Materia actualizada correctamente`);

  } catch (error) {
    let msg = 'Error al actualizar la materia';
    if (error.name === 'SequelizeUniqueConstraintError') {
      msg = `Ya existe una materia llamada "${nombre}" en este grado`;
    }
    res.redirect(`/grados/${gradoId}/materias?error=${encodeURIComponent(msg)}`);
  }
};

// ── POST /grados/:gradoId/materias/:id/toggle ────────────────
const toggleMateria = async (req, res) => {
  const { gradoId, id } = req.params;

  try {
    const materia = await Materia.findOne({ where: { id, grado_id: gradoId } });
    if (!materia) {
      return res.redirect(`/grados/${gradoId}/materias?error=Materia no encontrada`);
    }

    await materia.update({ activo: !materia.activo });
    const accion = materia.activo ? 'desactivada' : 'activada';
    res.redirect(`/grados/${gradoId}/materias?mensaje=Materia ${accion} correctamente`);

  } catch (error) {
    res.redirect(`/grados/${gradoId}/materias?error=Error al cambiar el estado`);
  }
};

module.exports = { listarMaterias, crearMateria, actualizarMateria, toggleMateria };
