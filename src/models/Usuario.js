// =============================================================
//  models/Usuario.js
//  Credenciales de acceso al sistema.
//  Admin usa email, docentes usan username.
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const Usuario = sequelize.define('Usuario', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  nombre: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    validate:  { notEmpty: { msg: 'El nombre no puede estar vacío' } },
  },

  // Solo admin — null para docentes
  email: {
    type:      DataTypes.STRING(150),
    allowNull: true,
    unique:    true,
    validate:  {
      isEmail: { msg: 'El email no tiene un formato válido' },
    },
  },

  // Solo docentes — null para admin
  username: {
    type:      DataTypes.STRING(50),
    allowNull: true,
    unique:    true,
    validate:  {
      len: { args: [3, 50], msg: 'El username debe tener entre 3 y 50 caracteres' },
      is:  { args: /^[a-zA-Z0-9_]+$/, msg: 'El username solo puede tener letras, números y guion bajo' },
    },
  },

  password_hash: {
    type:      DataTypes.TEXT,
    allowNull: false,
  },

  login_type: {
    type:      DataTypes.ENUM('email', 'username'),
    allowNull: false,
  },

  rol: {
    type:      DataTypes.ENUM('admin', 'docente'),
    allowNull: false,
  },

  activo: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: true,
  },

}, {
  tableName:  'usuarios',
  timestamps: true,   // createdAt, updatedAt

  // Validación a nivel de instancia:
  // si login_type es 'email'    → email debe existir y username debe ser null
  // si login_type es 'username' → username debe existir y email debe ser null
  validate: {
    campoLoginConsistente() {
      if (this.login_type === 'email') {
        if (!this.email)    throw new Error('Un usuario admin debe tener email');
        if (this.username)  throw new Error('Un usuario admin no debe tener username');
      }
      if (this.login_type === 'username') {
        if (!this.username) throw new Error('Un docente debe tener username');
        if (this.email)     throw new Error('Un docente no debe tener email');
      }
    },
  },
});

// Asociaciones — se definen en index.js
// Usuario.hasOne(Docente, { foreignKey: 'usuario_id' })

module.exports = Usuario;
