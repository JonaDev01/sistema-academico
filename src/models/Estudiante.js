// =============================================================
//  models/Estudiante.js
//  Tabla central del sistema.
//  Contiene los 26 campos del Excel existente del colegio.
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const Estudiante = sequelize.define('Estudiante', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  grado_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'grados', key: 'id' },
    onDelete:   'RESTRICT',
  },

  // ── IDENTIFICADORES ──────────────────────────────────────
  // Código que ya usa el colegio en documentos externos
  codigo_estudiante: {
    type:      DataTypes.STRING(30),
    allowNull: false,
    unique:    true,
    validate:  { notEmpty: { msg: 'El código del estudiante es obligatorio' } },
  },

  // DPI o código de registro nacional
  codigo_unico: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },

  // ID del sistema Excel anterior — solo para trazabilidad en la migración
  id_externo: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },

  // ── NOMBRES ──────────────────────────────────────────────
  // Separados para facilitar búsquedas y ordenamiento
  nombre1: {
    type:      DataTypes.STRING(80),
    allowNull: false,
    validate:  { notEmpty: { msg: 'El primer nombre es obligatorio' } },
  },

  nombre2: {
    type:      DataTypes.STRING(80),
    allowNull: true,
  },

  apellido1: {
    type:      DataTypes.STRING(80),
    allowNull: false,
    validate:  { notEmpty: { msg: 'El primer apellido es obligatorio' } },
  },

  apellido2: {
    type:      DataTypes.STRING(80),
    allowNull: true,
  },

  // ── DATOS PERSONALES ─────────────────────────────────────
  // La EDAD no se guarda — se calcula dinámicamente desde fecha_nacimiento
  fecha_nacimiento: {
    type:      DataTypes.DATEONLY,   // Solo fecha, sin hora
    allowNull: false,
    validate:  { isDate: { msg: 'La fecha de nacimiento no es válida' } },
  },

  genero: {
    type:      DataTypes.ENUM('masculino', 'femenino', 'otro'),
    allowNull: false,
  },

  nivel: {
    type:      DataTypes.ENUM('primaria', 'secundaria'),
    allowNull: false,
  },

  direccion: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },

  // ── ESTADO ACADÉMICO Y FINANCIERO ────────────────────────
  estado_matricula: {
    type:         DataTypes.ENUM('activo', 'retirado', 'egresado'),
    allowNull:    false,
    defaultValue: 'activo',
  },

  tipo_beca: {
    type:         DataTypes.ENUM('ninguna', 'becado', 'semi_becado'),
    allowNull:    false,
    defaultValue: 'ninguna',
  },

  estado_pago: {
    type:         DataTypes.ENUM('al_dia', 'pendiente'),
    allowNull:    false,
    defaultValue: 'al_dia',
  },

  en_proyecto: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: false,
  },

  // ── DATOS DE FAMILIA ─────────────────────────────────────
  nombre_madre: {
    type:      DataTypes.STRING(150),
    allowNull: true,
  },

  cedula_madre: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },

  nombre_padre: {
    type:      DataTypes.STRING(150),
    allowNull: true,
  },

  cedula_padre: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },

  // ── DATOS INSTITUCIONALES (del Excel) ────────────────────
  departamento: {
    type:      DataTypes.STRING(80),
    allowNull: true,
  },

  programa: {
    type:      DataTypes.STRING(100),
    allowNull: true,
  },

  modalidad: {
    type:      DataTypes.ENUM('presencial', 'virtual', 'semipresencial'),
    allowNull: true,
  },

  motivo_registro: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },

  // Solo se llena si estado_matricula = 'retirado'
  descripcion_retiro: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },

}, {
  tableName:  'estudiantes',
  timestamps: true,
});

// ── MÉTODO DE INSTANCIA: nombre completo ──────────────────
Estudiante.prototype.nombreCompleto = function () {
  return [this.nombre1, this.nombre2, this.apellido1, this.apellido2]
    .filter(Boolean)
    .join(' ');
};

// ── MÉTODO DE INSTANCIA: calcular edad ───────────────────
Estudiante.prototype.calcularEdad = function () {
  const hoy   = new Date();
  const nac   = new Date(this.fecha_nacimiento);
  let edad    = hoy.getFullYear() - nac.getFullYear();
  const mes   = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
};

// Asociaciones — se definen en index.js
// Estudiante.belongsTo(Grado, { foreignKey: 'grado_id' })
// Estudiante.hasMany(Nota,    { foreignKey: 'estudiante_id' })

module.exports = Estudiante;
