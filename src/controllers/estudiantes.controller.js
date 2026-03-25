// =============================================================
//  src/controllers/estudiantes.controller.js
//  CRUD completo de estudiantes + vista de notas
// =============================================================

const { Estudiante, Grado, Nota, Materia, Periodo, Asignacion } = require('../models');
const { Op } = require('sequelize');

// ── GET /estudiantes ─────────────────────────────────────────
const listarEstudiantes = async (req, res) => {
  try {
    const { busqueda, grado_id, estado_matricula, tipo_beca, estado_pago, en_proyecto } = req.query;

    // Construir filtros dinámicamente
    const where = { estado_matricula: { [Op.ne]: 'egresado' } };

    if (busqueda) {
      where[Op.or] = [
        { nombre1:            { [Op.iLike]: `%${busqueda}%` } },
        { apellido1:          { [Op.iLike]: `%${busqueda}%` } },
        { apellido2:          { [Op.iLike]: `%${busqueda}%` } },
        { codigo_estudiante:  { [Op.iLike]: `%${busqueda}%` } },
      ];
    }
    if (grado_id)         where.grado_id         = grado_id;
    if (estado_matricula) where.estado_matricula  = estado_matricula;
    if (tipo_beca)        where.tipo_beca         = tipo_beca;
    if (estado_pago)      where.estado_pago       = estado_pago;
    if (en_proyecto)      where.en_proyecto       = en_proyecto === 'true';

    const [estudiantes, grados] = await Promise.all([
      Estudiante.findAll({
        where,
        include: [{ model: Grado, as: 'grado', attributes: ['id', 'nombre'] }],
        order:   [['apellido1', 'ASC'], ['nombre1', 'ASC']],
      }),
      Grado.findAll({ where: { activo: true }, order: [['orden', 'ASC']] }),
    ]);

    res.render('estudiantes/lista', {
      titulo:      'Estudiantes',
      estudiantes,
      grados,
      filtros:     req.query,
      mensaje:     req.query.mensaje || null,
      error:       req.query.error   || null,
      usarDataTables: true,
    });
  } catch (error) {
    console.error('Error en listarEstudiantes:', error);
    res.redirect('/dashboard');
  }
};

// ── GET /estudiantes/nuevo ───────────────────────────────────
const mostrarFormNuevo = async (req, res) => {
  try {
    const grados = await Grado.findAll({
      where: { activo: true }, order: [['orden', 'ASC']]
    });
    res.render('estudiantes/form', {
      titulo:     'Nuevo Estudiante',
      estudiante: null,
      grados,
      errores:    [],
      paso:       parseInt(req.query.paso) || 1,
    });
  } catch (error) {
    res.redirect('/estudiantes?error=Error al cargar el formulario');
  }
};

// ── POST /estudiantes/nuevo ──────────────────────────────────
const crearEstudiante = async (req, res) => {
  try {
    const grados = await Grado.findAll({
      where: { activo: true }, order: [['orden', 'ASC']]
    });

    const datos = _extraerDatos(req.body);
    await Estudiante.create(datos);
    res.redirect('/estudiantes?mensaje=Estudiante registrado correctamente');

  } catch (error) {
    const grados = await Grado.findAll({
      where: { activo: true }, order: [['orden', 'ASC']]
    });

    let errores = ['Error al crear el estudiante'];
    if (error.name === 'SequelizeValidationError') {
      errores = error.errors.map(e => e.message);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errores = [`Ya existe un estudiante con el código "${req.body.codigo_estudiante}"`];
    }

    res.render('estudiantes/form', {
      titulo:     'Nuevo Estudiante',
      estudiante: req.body,
      grados,
      errores,
      paso:       parseInt(req.body.paso_actual) || 1,
    });
  }
};

// ── GET /estudiantes/:id/editar ──────────────────────────────
const mostrarFormEditar = async (req, res) => {
  try {
    const [estudiante, grados] = await Promise.all([
      Estudiante.findByPk(req.params.id),
      Grado.findAll({ where: { activo: true }, order: [['orden', 'ASC']] }),
    ]);

    if (!estudiante) return res.redirect('/estudiantes?error=Estudiante no encontrado');

    res.render('estudiantes/form', {
      titulo:     `Editar — ${estudiante.nombre1} ${estudiante.apellido1}`,
      estudiante,
      grados,
      errores:    [],
      paso:       parseInt(req.query.paso) || 1,
    });
  } catch (error) {
    res.redirect('/estudiantes?error=Error al cargar el estudiante');
  }
};

// ── POST /estudiantes/:id/editar ─────────────────────────────
const actualizarEstudiante = async (req, res) => {
  try {
    const estudiante = await Estudiante.findByPk(req.params.id);
    if (!estudiante) return res.redirect('/estudiantes?error=Estudiante no encontrado');

    const datos = _extraerDatos(req.body);
    await estudiante.update(datos);
    res.redirect('/estudiantes?mensaje=Estudiante actualizado correctamente');

  } catch (error) {
    const grados = await Grado.findAll({
      where: { activo: true }, order: [['orden', 'ASC']]
    });

    let errores = ['Error al actualizar el estudiante'];
    if (error.name === 'SequelizeValidationError') {
      errores = error.errors.map(e => e.message);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errores = [`Ya existe un estudiante con ese código`];
    }

    res.render('estudiantes/form', {
      titulo:     'Editar Estudiante',
      estudiante: { ...req.body, id: req.params.id },
      grados,
      errores,
      paso:       parseInt(req.body.paso_actual) || 1,
    });
  }
};

// ── POST /estudiantes/:id/toggle ─────────────────────────────
const toggleEstudiante = async (req, res) => {
  try {
    const estudiante = await Estudiante.findByPk(req.params.id);
    if (!estudiante) return res.redirect('/estudiantes?error=Estudiante no encontrado');

    const nuevoEstado = estudiante.estado_matricula === 'activo' ? 'retirado' : 'activo';
    await estudiante.update({ estado_matricula: nuevoEstado });
    const msg = nuevoEstado === 'activo' ? 'Estudiante reactivado' : 'Estudiante marcado como retirado';
    res.redirect(`/estudiantes?mensaje=${msg}`);
  } catch (error) {
    res.redirect('/estudiantes?error=Error al cambiar el estado');
  }
};

// ── GET /estudiantes/:id ─────────────────────────────────────
const verPerfil = async (req, res) => {
  try {
    const estudiante = await Estudiante.findByPk(req.params.id, {
      include: [{ model: Grado, as: 'grado' }],
    });
    if (!estudiante) return res.redirect('/estudiantes?error=Estudiante no encontrado');

    res.render('estudiantes/perfil', {
      titulo:     `${estudiante.nombre1} ${estudiante.apellido1}`,
      estudiante,
    });
  } catch (error) {
    console.error('Error en verPerfil:', error);
    res.redirect('/estudiantes?error=Error al cargar el perfil');
  }
};

// ── GET /estudiantes/:id/notas ───────────────────────────────
const verNotas = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = req.session.usuario;

    const estudiante = await Estudiante.findByPk(id, {
      include: [{ model: Grado, as: 'grado' }],
    });

    if (!estudiante) return res.status(404).render('404', { titulo: 'Estudiante no encontrado' });

    // Si es docente verificar que tenga clase en el mismo grado
    if (usuario.rol === 'docente') {
      const tieneAcceso = await Asignacion.findOne({
        where: { docente_id: usuario.docente_id, grado_id: estudiante.grado_id, activo: true },
      });
      if (!tieneAcceso) return res.status(403).render('403', { titulo: 'Acceso denegado' });
    }

    const anioActual = new Date().getFullYear();
    const periodos   = await Periodo.findAll({
      where: { anio: anioActual }, order: [['corte', 'ASC']],
    });

    const notas = await Nota.findAll({
      where:   { estudiante_id: id },
      include: [
        { model: Materia, as: 'materia' },
        { model: Periodo, as: 'periodo' },
      ],
      order: [['periodo', 'corte', 'ASC'], ['materia', 'nombre', 'ASC']],
    });

    // Agrupar por corte
    const notasPorCorte = {};
    periodos.forEach(p => { notasPorCorte[p.corte] = []; });
    notas.forEach(n => {
      if (notasPorCorte[n.periodo.corte] !== undefined) {
        notasPorCorte[n.periodo.corte].push(n);
      }
    });

    // Promedios
    let promedioGeneral = null;
    if (notas.length > 0) {
      const suma = notas.reduce((acc, n) => acc + parseFloat(n.nota_numerica), 0);
      promedioGeneral = (suma / notas.length).toFixed(2);
    }

    const promediosPorCorte = {};
    periodos.forEach(p => {
      const ns = notasPorCorte[p.corte];
      if (ns.length > 0) {
        const suma = ns.reduce((acc, n) => acc + parseFloat(n.nota_numerica), 0);
        promediosPorCorte[p.corte] = (suma / ns.length).toFixed(2);
      } else {
        promediosPorCorte[p.corte] = null;
      }
    });

    res.render('estudiantes/notas', {
      titulo: `Notas — ${estudiante.nombre1} ${estudiante.apellido1}`,
      estudiante, periodos, notasPorCorte, promediosPorCorte, promedioGeneral,
      totalNotas: notas.length,
    });

  } catch (error) {
    console.error('Error en verNotas:', error);
    res.status(500).render('404', { titulo: 'Error del servidor' });
  }
};

// ── Helper: extraer y limpiar datos del body ─────────────────
function _extraerDatos(body) {
  return {
    grado_id:           body.grado_id           || null,
    codigo_estudiante:  body.codigo_estudiante?.trim(),
    codigo_unico:       body.codigo_unico?.trim()       || null,
    id_externo:         body.id_externo?.trim()         || null,
    nombre1:            body.nombre1?.trim(),
    nombre2:            body.nombre2?.trim()            || null,
    apellido1:          body.apellido1?.trim(),
    apellido2:          body.apellido2?.trim()          || null,
    fecha_nacimiento:   body.fecha_nacimiento           || null,
    genero:             body.genero,
    nivel:              body.nivel,
    direccion:          body.direccion?.trim()          || null,
    estado_matricula:   body.estado_matricula           || 'activo',
    tipo_beca:          body.tipo_beca                  || 'ninguna',
    estado_pago:        body.estado_pago                || 'al_dia',
    en_proyecto:        body.en_proyecto === 'true' || body.en_proyecto === 'on',
    nombre_madre:       body.nombre_madre?.trim()       || null,
    cedula_madre:       body.cedula_madre?.trim()       || null,
    nombre_padre:       body.nombre_padre?.trim()       || null,
    cedula_padre:       body.cedula_padre?.trim()       || null,
    departamento:       body.departamento?.trim()       || null,
    programa:           body.programa?.trim()           || null,
    modalidad:          body.modalidad                  || null,
    motivo_registro:    body.motivo_registro?.trim()    || null,
    descripcion_retiro: body.descripcion_retiro?.trim() || null,
  };
}

module.exports = {
  listarEstudiantes, mostrarFormNuevo, crearEstudiante,
  mostrarFormEditar, actualizarEstudiante, toggleEstudiante,
  verPerfil, verNotas,
};
