// =============================================================
//  src/controllers/admin.controller.js
//  Gestión académica del año:
//  1. Gestión de corte activo
//  2. Cálculo de repitentes + cambio de año
// =============================================================

const { Estudiante, Nota, Materia, Grado, Periodo } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// ── Helpers ───────────────────────────────────────────────────
function calcularEstadoFinal(notasPorMateria) {
  let materiasConNota = 0;
  let materiasPerdidas = 0;

  for (const [materia_id, notas] of Object.entries(notasPorMateria)) {
    if (notas.length === 0) continue;
    materiasConNota++;
    const promedio = notas.reduce((a, b) => a + b, 0) / notas.length;
    if (promedio < 60) materiasPerdidas++;
  }

  if (materiasConNota === 0) return { estado: 'sin_notas', materiasPerdidas: 0 };
  return {
    estado:           materiasPerdidas >= 3 ? 'repitente' : 'aprobado',
    materiasPerdidas,
    materiasConNota,
  };
}

// ── GET /admin/corte ──────────────────────────────────────────
const mostrarGestionCorte = async (req, res) => {
  try {
    const anio     = new Date().getFullYear();
    const periodos = await Periodo.findAll({
      where: { anio },
      order: [['corte', 'ASC']],
    });
    const periodoActivo = periodos.find(p => p.activo);

    res.render('admin/corte', {
      titulo:       'Gestión de Corte Activo',
      periodos,
      periodoActivo,
      anio,
      mensaje:      req.query.mensaje || null,
      error:        req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en mostrarGestionCorte:', error);
    res.redirect('/dashboard?error=Error al cargar la gestión de corte');
  }
};

// ── POST /admin/corte/cambiar ─────────────────────────────────
const cambiarCorte = async (req, res) => {
  const { periodo_id } = req.body;

  try {
    const anio = new Date().getFullYear();

    // Desactivar todos los cortes del año
    await Periodo.update({ activo: false }, { where: { anio } });

    // Activar el seleccionado
    await Periodo.update({ activo: true }, { where: { id: periodo_id } });

    const periodo = await Periodo.findByPk(periodo_id);
    res.redirect(`/admin/corte?mensaje=${encodeURIComponent(`Corte ${periodo.corte} activado correctamente`)}`);
  } catch (error) {
    console.error('Error en cambiarCorte:', error);
    res.redirect('/admin/corte?error=Error al cambiar el corte activo');
  }
};

// ── GET /admin/fin-de-anio ────────────────────────────────────
// Pantalla que muestra el cálculo de repitentes antes de confirmar
const mostrarFinDeAnio = async (req, res) => {
  try {
    const anio = req.query.anio ? parseInt(req.query.anio) : new Date().getFullYear();

    // Cargar todos los grados activos
    const grados = await Grado.findAll({
      where: { activo: true },
      order: [['orden', 'ASC']],
      include: [{
        model:    Materia,
        as:       'materias',
        where:    { activo: true },
        required: false,
      }],
    });

    const gradoSelId = req.query.grado_id ? parseInt(req.query.grado_id) : null;
    const gradoSel   = gradoSelId ? grados.find(g => g.id === gradoSelId) : null;

    let resultados = [];

    if (gradoSelId) {
      // Cargar estudiantes del grado
      const estudiantes = await Estudiante.findAll({
        where: {
          grado_id:         gradoSelId,
          estado_matricula: { [Op.in]: ['activo', 'repitente'] },
        },
        order: [['apellido1', 'ASC'], ['nombre1', 'ASC']],
      });

      // Cargar materias del grado
      const materias = await Materia.findAll({
        where: { grado_id: gradoSelId, activo: true },
      });

      // Cargar notas del año para ese grado
      const periodos = await Periodo.findAll({ where: { anio } });
      const periodoIds = periodos.map(p => p.id);

      const notas = await Nota.findAll({
        where: {
          materia_id: { [Op.in]: materias.map(m => m.id) },
          periodo_id: { [Op.in]: periodoIds },
        },
      });

      // Agrupar notas por estudiante → materia → [notas]
      const notasPorEstudiante = {};
      notas.forEach(n => {
        if (!notasPorEstudiante[n.estudiante_id]) notasPorEstudiante[n.estudiante_id] = {};
        if (!notasPorEstudiante[n.estudiante_id][n.materia_id]) notasPorEstudiante[n.estudiante_id][n.materia_id] = [];
        notasPorEstudiante[n.estudiante_id][n.materia_id].push(parseFloat(n.nota_numerica));
      });

      // Calcular resultado para cada estudiante
      resultados = estudiantes.map(est => {
        const notasEst  = notasPorEstudiante[est.id] || {};
        const resultado = calcularEstadoFinal(notasEst);

        // Detalle por materia
        const detalle = materias.map(m => {
          const ns = notasEst[m.id] || [];
          const prom = ns.length > 0
            ? (ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1)
            : null;
          return {
            nombre:   m.nombre,
            promedio: prom,
            perdida:  prom !== null && parseFloat(prom) < 60,
          };
        });

        return {
          estudiante: est,
          ...resultado,
          detalle,
        };
      });
    }

    // Grado siguiente para cada grado (para la promoción)
    const gradoSiguiente = gradoSel
      ? grados.find(g => g.orden === gradoSel.orden + 1) || null
      : null;

    res.render('admin/fin-de-anio', {
      titulo:         'Fin de Año — Cálculo de Repitentes',
      grados,
      gradoSel,
      gradoSiguiente,
      resultados,
      anio,
      mensaje:        req.query.mensaje || null,
      error:          req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en mostrarFinDeAnio:', error);
    res.redirect('/dashboard?error=Error al calcular repitentes');
  }
};

// ── POST /admin/fin-de-anio/aplicar ──────────────────────────
// Aplica el resultado: marca repitentes y promueve aprobados
const aplicarFinDeAnio = async (req, res) => {
  const { grado_id, grado_siguiente_id, anio } = req.body;

  try {
    const gradoId          = parseInt(grado_id);
    const gradoSiguienteId = grado_siguiente_id ? parseInt(grado_siguiente_id) : null;
    const anioNum          = parseInt(anio);

    // Cargar estudiantes activos del grado
    const estudiantes = await Estudiante.findAll({
      where: {
        grado_id:         gradoId,
        estado_matricula: { [Op.in]: ['activo', 'repitente'] },
      },
    });

    const materias   = await Materia.findAll({ where: { grado_id: gradoId, activo: true } });
    const periodos   = await Periodo.findAll({ where: { anio: anioNum } });
    const periodoIds = periodos.map(p => p.id);

    const notas = await Nota.findAll({
      where: {
        materia_id: { [Op.in]: materias.map(m => m.id) },
        periodo_id: { [Op.in]: periodoIds },
      },
    });

    const notasPorEstudiante = {};
    notas.forEach(n => {
      if (!notasPorEstudiante[n.estudiante_id]) notasPorEstudiante[n.estudiante_id] = {};
      if (!notasPorEstudiante[n.estudiante_id][n.materia_id]) notasPorEstudiante[n.estudiante_id][n.materia_id] = [];
      notasPorEstudiante[n.estudiante_id][n.materia_id].push(parseFloat(n.nota_numerica));
    });

    let repitentes = 0;
    let promovidos = 0;

    for (const est of estudiantes) {
      const notasEst  = notasPorEstudiante[est.id] || {};
      const resultado = calcularEstadoFinal(notasEst);

      if (resultado.estado === 'repitente') {
        await est.update({ estado_matricula: 'repitente' });
        repitentes++;
      } else if (resultado.estado === 'aprobado') {
        // Promover al grado siguiente si existe
        await est.update({
          estado_matricula: 'activo',
          grado_id:         gradoSiguienteId || est.grado_id,
        });
        promovidos++;
      }
    }

    const msg = `${promovidos} promovidos, ${repitentes} marcados como repitentes`;
    res.redirect(`/admin/fin-de-anio?grado_id=${gradoId}&mensaje=${encodeURIComponent(msg)}`);

  } catch (error) {
    console.error('Error en aplicarFinDeAnio:', error);
    res.redirect(`/admin/fin-de-anio?grado_id=${grado_id}&error=Error al aplicar los cambios`);
  }
};

module.exports = {
  mostrarGestionCorte, cambiarCorte,
  mostrarFinDeAnio, aplicarFinDeAnio,
  mostrarPapelera, restaurarElemento, eliminarPermanente,
};

// ── GET /admin/papelera ───────────────────────────────────────
async function mostrarPapelera(req, res) {
  try {
    const { Materia, Docente, Usuario } = require('../models');

    const [gradosInactivos, materiasInactivas, estudiantesInactivos, docentesInactivos] = await Promise.all([
      Grado.findAll({
        where: { activo: false },
        order: [['orden', 'ASC']],
      }),
      Materia.findAll({
        where: { activo: false },
        include: [{ model: Grado, as: 'grado', attributes: ['nombre'] }],
        order:   [['nombre', 'ASC']],
      }),
      Estudiante.findAll({
        where: { estado_matricula: { [Op.in]: ['retirado', 'egresado'] } },
        include: [{ model: Grado, as: 'grado', attributes: ['nombre'] }],
        order:   [['apellido1', 'ASC']],
      }),
      Docente.findAll({
        include: [{
          model:    Usuario,
          as:       'usuario',
          where:    { activo: false },
          required: true,
          attributes: ['username', 'activo'],
        }],
        order: [['apellido', 'ASC']],
      }),
    ]);

    res.render('admin/papelera', {
      titulo:             'Papelera',
      gradosInactivos,
      materiasInactivas,
      estudiantesInactivos,
      docentesInactivos,
      mensaje:            req.query.mensaje || null,
      error:              req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en mostrarPapelera:', error);
    res.redirect('/dashboard?error=Error al cargar la papelera');
  }
}

// ── POST /admin/papelera/restaurar ────────────────────────────
async function restaurarElemento(req, res) {
  const { tipo, id } = req.body;
  try {
    const { Materia, Docente, Usuario } = require('../models');

    if (tipo === 'grado') {
      await Grado.update({ activo: true }, { where: { id } });
    } else if (tipo === 'materia') {
      await Materia.update({ activo: true }, { where: { id } });
    } else if (tipo === 'estudiante') {
      await Estudiante.update({ estado_matricula: 'activo' }, { where: { id } });
    } else if (tipo === 'docente') {
      const docente = await Docente.findByPk(id);
      if (docente) await Usuario.update({ activo: true }, { where: { id: docente.usuario_id } });
    }

    res.redirect(`/admin/papelera?mensaje=${encodeURIComponent('Elemento restaurado correctamente')}`);
  } catch (error) {
    console.error('Error en restaurarElemento:', error);
    res.redirect('/admin/papelera?error=Error al restaurar el elemento');
  }
}

// ── POST /admin/papelera/eliminar ─────────────────────────────
async function eliminarPermanente(req, res) {
  const { tipo, id } = req.body;
  try {
    const { Materia, Docente, Usuario, Asignacion, Nota } = require('../models');

    if (tipo === 'grado') {
      await Grado.destroy({ where: { id } });
    } else if (tipo === 'materia') {
      await Nota.destroy({ where: { materia_id: id } });
      await Asignacion.destroy({ where: { materia_id: id } });
      await Materia.destroy({ where: { id } });
    } else if (tipo === 'estudiante') {
      await Nota.destroy({ where: { estudiante_id: id } });
      await Estudiante.destroy({ where: { id } });
    } else if (tipo === 'docente') {
      const docente = await Docente.findByPk(id);
      if (docente) {
        await Asignacion.destroy({ where: { docente_id: id } });
        await Docente.destroy({ where: { id } });
        await Usuario.destroy({ where: { id: docente.usuario_id } });
      }
    }

    res.redirect(`/admin/papelera?mensaje=${encodeURIComponent('Elemento eliminado permanentemente')}`);
  } catch (error) {
    console.error('Error en eliminarPermanente:', error);
    res.redirect('/admin/papelera?error=Error al eliminar. Puede tener datos asociados.');
  }
}
