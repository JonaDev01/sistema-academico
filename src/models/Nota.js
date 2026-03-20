// =============================================================
//  models/Nota.js
//  Registro académico central.
//  1 nota por estudiante por materia por corte.
//  El coeficiente AA/AS/AF/AI se calcula automáticamente.
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

// ── FUNCIÓN AUXILIAR: calcular coeficiente ───────────────
// Misma lógica que la función SQL en el schema.
// Se usa antes de guardar y en el frontend (public/js/notas.js)
function calcularCoeficiente(nota) {
  if (nota >= 90) return 'AA';  // Aprendizaje Avanzado      90–100
  if (nota >= 76) return 'AS';  // Aprendizaje Satisfactorio 76–89
  if (nota >= 60) return 'AF';  // Aprendizaje Fundamental   60–75
  return 'AI';                  // Aprendizaje Inicial       < 60
}

// ── FUNCIÓN AUXILIAR: nombre completo del coeficiente ────
// Para mostrar en el boletín PDF
function nombreCoeficiente(coeficiente) {
  const nombres = {
    AA: 'Aprendizaje Avanzado',
    AS: 'Aprendizaje Satisfactorio',
    AF: 'Aprendizaje Fundamental',
    AI: 'Aprendizaje Inicial',
  };
  return nombres[coeficiente] || coeficiente;
}

const Nota = sequelize.define('Nota', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  estudiante_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'estudiantes', key: 'id' },
    onDelete:   'RESTRICT',
  },

  materia_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'materias', key: 'id' },
    onDelete:   'RESTRICT',
  },

  periodo_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'periodos', key: 'id' },
    onDelete:   'RESTRICT',
  },

  nota_numerica: {
    type:      DataTypes.DECIMAL(5, 2),
    allowNull: false,
    validate:  {
      min: { args: 0,   msg: 'La nota mínima es 0'   },
      max: { args: 100, msg: 'La nota máxima es 100' },
    },
  },

  // Se calcula automáticamente — NO lo envía el cliente
  coeficiente: {
    type:      DataTypes.ENUM('AA', 'AS', 'AF', 'AI'),
    allowNull: false,
  },

  observacion: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },

}, {
  tableName:  'notas',
  timestamps: true,

  // Un estudiante solo puede tener UNA nota por materia por corte
  indexes: [
    { unique: true, fields: ['estudiante_id', 'materia_id', 'periodo_id'] },
  ],

  // Hook: calcula y asigna el coeficiente automáticamente
  // antes de crear o actualizar. El frontend nunca envía este campo.
  hooks: {
    beforeCreate(nota) {
      nota.coeficiente = calcularCoeficiente(parseFloat(nota.nota_numerica));
    },
    beforeUpdate(nota) {
      if (nota.changed('nota_numerica')) {
        nota.coeficiente = calcularCoeficiente(parseFloat(nota.nota_numerica));
      }
    },
  },
});

// ── MÉTODO DE INSTANCIA: aprobado ────────────────────────
Nota.prototype.estaAprobado = function () {
  return parseFloat(this.nota_numerica) >= 60;
};

// ── MÉTODO DE INSTANCIA: nombre del coeficiente ──────────
// "AA" → "Aprendizaje Avanzado" (para el boletín PDF)
Nota.prototype.nombreCoeficiente = function () {
  return nombreCoeficiente(this.coeficiente);
};

// Exportar la función para usarla también en el frontend (notas.js)
Nota.calcularCoeficiente  = calcularCoeficiente;
Nota.nombreCoeficiente    = nombreCoeficiente;

// Asociaciones — se definen en index.js
// Nota.belongsTo(Estudiante, { foreignKey: 'estudiante_id' })
// Nota.belongsTo(Materia,    { foreignKey: 'materia_id'    })
// Nota.belongsTo(Periodo,    { foreignKey: 'periodo_id'    })

module.exports = Nota;
