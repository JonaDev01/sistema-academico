// =============================================================
//  src/seeders/periodosSeed.js
//  Crea los 4 cortes del año escolar actual.
//
//  Ejecutar:
//    node src/seeders/periodosSeed.js
//
//  Para un año específico:
//    node src/seeders/periodosSeed.js 2026
//
//  Para marcar un corte como activo:
//    node src/seeders/periodosSeed.js --activo=2
// =============================================================

require('dotenv').config();
const { sequelize } = require('../config/database');
const { Periodo }   = require('../models');

async function crearPeriodos() {
  // Año: del argumento o el actual
  const anioArg = process.argv.find(a => /^\d{4}$/.test(a));
  const anio    = anioArg ? parseInt(anioArg) : new Date().getFullYear();

  // Corte activo: del argumento --activo=N o 1 por defecto
  const activoArg = process.argv.find(a => a.startsWith('--activo='));
  const corteActivo = activoArg ? parseInt(activoArg.split('=')[1]) : 1;

  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: false });

    console.log(`\n📅 Creando cortes para el año ${anio}...\n`);

    let creados = 0;
    let existentes = 0;

    for (let corte = 1; corte <= 4; corte++) {
      const [periodo, creado] = await Periodo.findOrCreate({
        where: { corte, anio },
        defaults: {
          corte,
          anio,
          activo: corte === corteActivo,
        },
      });

      if (creado) {
        creados++;
        console.log(`   ✅ Corte ${corte} — ${anio}${corte === corteActivo ? '  ← ACTIVO' : ''}`);
      } else {
        existentes++;
        console.log(`   ⚠️  Corte ${corte} — ${anio} ya existe (sin cambios)`);
      }
    }

    console.log(`\n   Creados: ${creados} | Ya existían: ${existentes}`);

    if (creados === 0) {
      console.log('\n   ℹ️  Para cambiar el corte activo, actualízalo desde pgAdmin');
      console.log('   o ejecuta el script con --activo=N (ej: --activo=2)');
    }

    console.log('\n✅ Listo.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

crearPeriodos();
