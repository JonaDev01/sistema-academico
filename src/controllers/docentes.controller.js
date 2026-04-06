// =============================================================
//  src/controllers/docentes.controller.js
//  CRUD de docentes — solo admin
//  Cada docente tiene un Usuario (credenciales) + un Docente (perfil)
// =============================================================

const bcrypt  = require('bcryptjs');
const { Usuario, Docente, Asignacion, Grado, Materia } = require('../models');
const { Op }  = require('sequelize');

// ── GET /docentes ─────────────────────────────────────────────
const listarDocentes = async (req, res) => {
  try {
    const docentes = await Docente.findAll({
      include: [
        { model: Usuario, as: 'usuario', attributes: ['username', 'activo'] },
        {
          model:    Asignacion,
          as:       'asignaciones',
          where:    { activo: true },
          required: false,
        },
      ],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']],
    });

    res.render('docentes/lista', {
      titulo:   'Docentes',
      docentes,
      mensaje:  req.query.mensaje || null,
      error:    req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en listarDocentes:', error);
    res.redirect('/dashboard');
  }
};

// ── GET /docentes/nuevo ───────────────────────────────────────
const mostrarFormNuevo = (req, res) => {
  res.render('docentes/form', {
    titulo:  'Nuevo Docente',
    docente: null,
    usuario: null,
    errores: [],
  });
};

// ── POST /docentes/nuevo ──────────────────────────────────────
const crearDocente = async (req, res) => {
  const { nombre, apellido, telefono, especialidad, username, password } = req.body;

  try {
    // Verificar que el username no exista
    const existe = await Usuario.findOne({ where: { username } });
    if (existe) {
      return res.render('docentes/form', {
        titulo:  'Nuevo Docente',
        docente: req.body,
        usuario: req.body,
        errores: [`El nombre de usuario "${username}" ya está en uso`],
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Crear usuario primero
    const nuevoUsuario = await Usuario.create({
      nombre:        `${nombre} ${apellido}`,
      username,
      password_hash,
      login_type: 'username',
      rol:        'docente',
      activo:     true,
    });

    // Luego crear el perfil del docente
    await Docente.create({
      usuario_id:   nuevoUsuario.id,
      nombre,
      apellido,
      telefono:     telefono    || null,
      especialidad: especialidad || null,
    });

    res.redirect('/docentes?mensaje=Docente creado correctamente');

  } catch (error) {
    let errores = ['Error al crear el docente'];
    if (error.name === 'SequelizeValidationError') {
      errores = error.errors.map(e => e.message);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errores = [`El nombre de usuario "${username}" ya está en uso`];
    }
    res.render('docentes/form', {
      titulo:  'Nuevo Docente',
      docente: req.body,
      usuario: req.body,
      errores,
    });
  }
};

// ── GET /docentes/:id ─────────────────────────────────────────
const verPerfil = async (req, res) => {
  try {
    const docente = await Docente.findByPk(req.params.id, {
      include: [
        { model: Usuario, as: 'usuario', attributes: ['username', 'activo', 'id'] },
        {
          model:    Asignacion,
          as:       'asignaciones',
          where:    { activo: true },
          required: false,
          include: [
            { model: Grado,   as: 'gradoAsignacion', attributes: ['id', 'nombre'] },
            { model: Materia, as: 'materia',  attributes: ['id', 'nombre'] },
          ],
        },
      ],
    });

    if (!docente) return res.redirect('/docentes?error=Docente no encontrado');

    res.render('docentes/perfil', {
      titulo:  `${docente.nombre} ${docente.apellido}`,
      docente,
    });
  } catch (error) {
    console.error('Error en verPerfil docente:', error);
    res.redirect('/docentes?error=Error al cargar el perfil');
  }
};

// ── GET /docentes/:id/editar ──────────────────────────────────
const mostrarFormEditar = async (req, res) => {
  try {
    const docente = await Docente.findByPk(req.params.id, {
      include: [{ model: Usuario, as: 'usuario', attributes: ['username', 'activo'] }],
    });
    if (!docente) return res.redirect('/docentes?error=Docente no encontrado');

    res.render('docentes/form', {
      titulo:  `Editar — ${docente.nombre} ${docente.apellido}`,
      docente,
      usuario: docente.usuario,
      errores: [],
    });
  } catch (error) {
    res.redirect('/docentes?error=Error al cargar el docente');
  }
};

// ── POST /docentes/:id/editar ─────────────────────────────────
const actualizarDocente = async (req, res) => {
  const { nombre, apellido, telefono, especialidad, password_nuevo } = req.body;

  try {
    const docente = await Docente.findByPk(req.params.id, {
      include: [{ model: Usuario, as: 'usuario' }],
    });
    if (!docente) return res.redirect('/docentes?error=Docente no encontrado');

    // Actualizar perfil
    await docente.update({ nombre, apellido, telefono: telefono || null, especialidad: especialidad || null });

    // Actualizar nombre en usuario
    await docente.usuario.update({ nombre: `${nombre} ${apellido}` });

    // Cambiar contraseña solo si se proporcionó una nueva
    if (password_nuevo && password_nuevo.trim() !== '') {
      const hash = await bcrypt.hash(password_nuevo, 10);
      await docente.usuario.update({ password_hash: hash });
    }

    res.redirect(`/docentes/${req.params.id}?mensaje=Docente actualizado correctamente`);

  } catch (error) {
    let errores = ['Error al actualizar el docente'];
    if (error.name === 'SequelizeValidationError') {
      errores = error.errors.map(e => e.message);
    }
    const docente = await Docente.findByPk(req.params.id, {
      include: [{ model: Usuario, as: 'usuario' }],
    });
    res.render('docentes/form', {
      titulo: 'Editar Docente',
      docente: { ...docente?.dataValues, nombre, apellido, telefono, especialidad },
      usuario: docente?.usuario,
      errores,
    });
  }
};

// ── POST /docentes/:id/toggle ─────────────────────────────────
const toggleDocente = async (req, res) => {
  try {
    const docente = await Docente.findByPk(req.params.id, {
      include: [{ model: Usuario, as: 'usuario' }],
    });
    if (!docente) return res.redirect('/docentes?error=Docente no encontrado');

    const nuevoEstado = !docente.usuario.activo;
    await docente.usuario.update({ activo: nuevoEstado });
    const msg = nuevoEstado ? 'Docente activado' : 'Docente desactivado';
    res.redirect(`/docentes?mensaje=${msg}`);

  } catch (error) {
    res.redirect('/docentes?error=Error al cambiar el estado');
  }
};

// ── GET /docentes/:id/asignaciones ────────────────────────────
const verAsignaciones = async (req, res) => {
  try {
    const [docente, grados] = await Promise.all([
      Docente.findByPk(req.params.id, {
        include: [
          { model: Usuario, as: 'usuario', attributes: ['username'] },
          {
            model:    Asignacion,
            as:       'asignaciones',
            required: false,
            include: [
              { model: Grado,   as: 'gradoAsignacion', attributes: ['id', 'nombre'] },
              { model: Materia, as: 'materia', attributes: ['id', 'nombre'] },
            ],
          },
        ],
      }),
      Grado.findAll({
        where: { activo: true },
        order: [['orden', 'ASC']],
        include: [{
          model:    Materia,
          as:       'materias',
          where:    { activo: true },
          required: false,
        }],
      }),
    ]);

    if (!docente) return res.redirect('/docentes?error=Docente no encontrado');

    res.render('docentes/asignaciones', {
      titulo:  `Asignaciones — ${docente.nombre} ${docente.apellido}`,
      docente,
      grados,
      mensaje: req.query.mensaje || null,
      error:   req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en verAsignaciones:', error);
    res.redirect('/docentes?error=Error al cargar las asignaciones');
  }
};

// ── POST /docentes/:id/asignaciones ───────────────────────────
const agregarAsignacion = async (req, res) => {
  const { grado_id, materia_id, anio } = req.body;
  const docente_id = req.params.id;

  try {
    // Verificar que no exista ya esa asignación activa
    const existe = await Asignacion.findOne({
      where: { docente_id, grado_id, materia_id, anio: parseInt(anio), activo: true },
    });

    if (existe) {
      return res.redirect(`/docentes/${docente_id}/asignaciones?error=Esa asignación ya existe`);
    }

    await Asignacion.create({
      docente_id,
      grado_id,
      materia_id,
      anio:   parseInt(anio),
      activo: true,
    });

    res.redirect(`/docentes/${docente_id}/asignaciones?mensaje=Clase asignada correctamente`);

  } catch (error) {
    console.error('Error en agregarAsignacion:', error);
    res.redirect(`/docentes/${docente_id}/asignaciones?error=Error al asignar la clase`);
  }
};

// ── POST /docentes/:id/asignaciones/:asigId/eliminar ──────────
const eliminarAsignacion = async (req, res) => {
  const { id, asigId } = req.params;

  try {
    await Asignacion.update(
      { activo: false },
      { where: { id: asigId, docente_id: id } }
    );
    res.redirect(`/docentes/${id}/asignaciones?mensaje=Asignación eliminada`);
  } catch (error) {
    res.redirect(`/docentes/${id}/asignaciones?error=Error al eliminar la asignación`);
  }
};

module.exports = {
  listarDocentes, mostrarFormNuevo, crearDocente,
  verPerfil, mostrarFormEditar, actualizarDocente,
  toggleDocente, verAsignaciones, agregarAsignacion, eliminarAsignacion,
};
