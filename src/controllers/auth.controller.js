// =============================================================
//  src/controllers/auth.controller.js
//  Login diferenciado: admin con email, docente con username
// =============================================================

const bcrypt   = require('bcryptjs');
const { Op }   = require('sequelize');
const { Usuario, Docente } = require('../models');

// ── GET /login ───────────────────────────────────────────────
const mostrarLogin = (req, res) => {
  if (req.session.usuario) return res.redirect('/dashboard');
  res.render('auth/login', {
    titulo: 'Iniciar Sesión',
    error:  null,
  });
};

// ── POST /login ──────────────────────────────────────────────
const procesarLogin = async (req, res) => {
  const { credencial, password } = req.body;

  const renderError = (msg) => res.render('auth/login', {
    titulo: 'Iniciar Sesión',
    error:  msg,
  });

  if (!credencial || !password) {
    return renderError('Ingresa tu correo o usuario y contraseña');
  }

  try {
    // Detectar si es email (contiene @) o username
    const esEmail = credencial.includes('@');
    const where   = esEmail
      ? { email:    credencial, login_type: 'email',    activo: true }
      : { username: credencial, login_type: 'username', activo: true };

    const usuario = await Usuario.findOne({ where });

    if (!usuario) {
      return renderError('Credenciales incorrectas');
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValido) {
      return renderError('Credenciales incorrectas');
    }

    // Datos base de sesión
    const sesionData = {
      id:     usuario.id,
      nombre: usuario.nombre,
      rol:    usuario.rol,
    };

    // Si es docente, agregar docente_id a la sesión
    // (lo necesita verificarClaseDocente)
    if (usuario.rol === 'docente') {
      const docente = await Docente.findOne({
        where: { usuario_id: usuario.id }
      });
      if (docente) sesionData.docente_id = docente.id;
      sesionData.username = usuario.username;
    } else {
      sesionData.email = usuario.email;
    }

    req.session.usuario = sesionData;
    res.redirect('/dashboard');

  } catch (error) {
    console.error('Error en login:', error);
    renderError('Error interno del servidor');
  }
};

// ── GET /logout ──────────────────────────────────────────────
const logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};

module.exports = { mostrarLogin, procesarLogin, logout };
