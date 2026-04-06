// =============================================================
//  src/controllers/notas.controller.js
//  Registro de notas por grado / materia / corte
//  Admin: acceso total | Docente: solo sus materias asignadas
// =============================================================

const { Nota, Estudiante, Materia, Grado, Periodo, Asignacion, Docente } = require('../models');
const { Op } = require('sequelize');

// ── GET /notas ────────────────────────────────────────────────
// Pantalla principal — el docente elige grado, materia y corte
const mostrarNotas = async (req, res) => {
  try {
    const usuario    = req.session.usuario;
    const anioActual = new Date().getFullYear();

    // Periodos del año actual
    const periodos = await Periodo.findAll({
      where: { anio: anioActual },
      order: [['corte', 'ASC']],
    });

    // Periodo activo por defecto
    const periodoActivo = periodos.find(p => p.activo) || periodos[0];

    let grados = [];

    if (usuario.rol === 'admin') {
      // Admin ve todos los grados con todas sus materias
      grados = await Grado.findAll({
        where: { activo: true },
        order: [['orden', 'ASC']],
        include: [{
          model:    Materia,
          as:       'materias',
          where:    { activo: true },
          required: false,
        }],
      });
    } else {
      // Docente solo ve grados/materias que tiene asignados
      const docente = await Docente.findOne({ where: { usuario_id: usuario.id } });
      if (!docente) return res.redirect('/dashboard?error=Perfil de docente no encontrado');

      const asignaciones = await Asignacion.findAll({
        where:   { docente_id: docente.id, activo: true },
        include: [
          { model: Grado,   as: 'gradoAsignacion', attributes: ['id', 'nombre', 'orden'] },
          { model: Materia, as: 'materia',          attributes: ['id', 'nombre', 'grado_id'] },
        ],
      });

      // Construir estructura grado → materias desde las asignaciones
      const gradoMap = {};
      asignaciones.forEach(a => {
        if (!a.gradoAsignacion || !a.materia) return;
        const gId = a.gradoAsignacion.id;
        if (!gradoMap[gId]) {
          gradoMap[gId] = {
            id:       a.gradoAsignacion.id,
            nombre:   a.gradoAsignacion.nombre,
            orden:    a.gradoAsignacion.orden,
            materias: [],
          };
        }
        gradoMap[gId].materias.push(a.materia);
      });
      grados = Object.values(gradoMap).sort((a, b) => a.orden - b.orden);
    }

    // Leer filtros de la query
    const gradoId    = req.query.grado_id   ? parseInt(req.query.grado_id)   : null;
    const materiaId  = req.query.materia_id ? parseInt(req.query.materia_id) : null;
    const periodoId  = req.query.periodo_id ? parseInt(req.query.periodo_id) : periodoActivo?.id;

    let estudiantes = [];
    let notasMap    = {};
    let gradoSel    = null;
    let materiaSel  = null;
    let periodoSel  = null;

    if (gradoId && materiaId && periodoId) {
      [gradoSel, materiaSel, periodoSel] = await Promise.all([
        Grado.findByPk(gradoId),
        Materia.findByPk(materiaId),
        Periodo.findByPk(periodoId),
      ]);

      // Estudiantes activos y repitentes del grado
      estudiantes = await Estudiante.findAll({
        where: {
          grado_id:         gradoId,
          estado_matricula: { [Op.in]: ['activo', 'repitente'] },
        },
        order: [['apellido1', 'ASC'], ['nombre1', 'ASC']],
      });

      // Notas existentes de ese grupo
      const notas = await Nota.findAll({
        where: { materia_id: materiaId, periodo_id: periodoId },
      });
      notas.forEach(n => { notasMap[n.estudiante_id] = n; });
    }

    res.render('notas/lista', {
      titulo:      'Registro de Notas',
      grados,
      periodos,
      gradoId,
      materiaId,
      periodoId,
      gradoSel,
      materiaSel,
      periodoSel,
      estudiantes,
      notasMap,
      mensaje:     req.query.mensaje || null,
      error:       req.query.error   || null,
      usarDataTables: false,
    });
  } catch (error) {
    console.error('Error en mostrarNotas:', error);
    res.redirect('/dashboard?error=Error al cargar notas');
  }
};

// ── POST /notas/guardar ───────────────────────────────────────
// Guarda o actualiza las notas de todos los estudiantes del formulario
const guardarNotas = async (req, res) => {
  const { materia_id, periodo_id, grado_id, notas } = req.body;
  const usuario = req.session.usuario;

  try {
    // Si es docente verificar que tiene esa materia asignada
    if (usuario.rol === 'docente') {
      const docente = await Docente.findOne({ where: { usuario_id: usuario.id } });
      const asig    = await Asignacion.findOne({
        where: { docente_id: docente.id, materia_id, activo: true },
      });
      if (!asig) return res.redirect('/notas?error=No tienes permiso para editar estas notas');
    }

    // notas viene como objeto { estudiante_id: nota_numerica }
    if (notas) {
      for (const [key, nota_numerica] of Object.entries(notas)) {
        if (!nota_numerica || nota_numerica.toString().trim() === '') continue;

        // El key viene como "est_123" — extraer el ID numérico real
        const estudiante_id = parseInt(key.replace('est_', ''));
        if (isNaN(estudiante_id) || estudiante_id <= 0) continue;

        const valor = parseFloat(nota_numerica);
        if (isNaN(valor) || valor < 0 || valor > 100) continue;

        // Buscar si ya existe la nota
        const notaExistente = await Nota.findOne({
          where: {
            estudiante_id,
            materia_id:  parseInt(materia_id),
            periodo_id:  parseInt(periodo_id),
          },
        });

        if (notaExistente) {
          await notaExistente.update({ nota_numerica: valor });
        } else {
          await Nota.create({
            estudiante_id,
            materia_id:  parseInt(materia_id),
            periodo_id:  parseInt(periodo_id),
            nota_numerica: valor,
          });
        }
      }
    }

    res.redirect(
      `/notas?grado_id=${grado_id}&materia_id=${materia_id}&periodo_id=${periodo_id}&mensaje=Notas guardadas correctamente`
    );
  } catch (error) {
    console.error('Error en guardarNotas:', error);
    res.redirect(`/notas?grado_id=${grado_id}&materia_id=${materia_id}&periodo_id=${periodo_id}&error=Error al guardar las notas`);
  }
};

// ── POST /notas/:id/eliminar ──────────────────────────────────
const eliminarNota = async (req, res) => {
  try {
    await Nota.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.json({ ok: false });
  }
};

module.exports = { mostrarNotas, guardarNotas, eliminarNota };
