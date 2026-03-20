// =============================================================
//  src/seeders/adminSeed.js
//  Crea el usuario administrador inicial en la BD.
//
//  Ejecutar UNA sola vez:
//    node src/seeders/adminSeed.js
//
//  Si el admin ya existe, el script lo detecta y no duplica.
//  Para cambiar la contraseña, ejecutar con --reset:
//    node src/seeders/adminSeed.js --reset
// =============================================================

require('dotenv').config();
const bcrypt        = require('bcryptjs');
const { sequelize } = require('../config/database');
const { Usuario }   = require('../models');

// ── CONFIGURACIÓN DEL ADMIN INICIAL ─────────────────────
// Cambiar estos valores antes de ejecutar en producción
const ADMIN = {
  nombre:    'Administrador',
  email:     'admin@colegio.edu',   // ← cambiar al email real
  password:  'Admin1234!',          // ← cambiar a contraseña segura
};
// ─────────────────────────────────────────────────────────

async function crearAdmin() {
  const reset = process.argv.includes('--reset');

  try {
    // Conectar a la BD
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos exitosa\n');

    // Sincronizar modelos (crea tablas si no existen)
    await sequelize.sync({ alter: false });
    console.log('✅ Tablas sincronizadas\n');

    // Verificar si ya existe un admin
    const adminExistente = await Usuario.findOne({
      where: { login_type: 'email', rol: 'admin' }
    });

    if (adminExistente && !reset) {
      console.log('⚠️  Ya existe un administrador en la base de datos:');
      console.log(`   Nombre: ${adminExistente.nombre}`);
      console.log(`   Email:  ${adminExistente.email}`);
      console.log('\n   Para resetear la contraseña ejecuta:');
      console.log('   node src/seeders/adminSeed.js --reset\n');
      process.exit(0);
    }

    // Hashear contraseña (10 rondas — balance seguridad/velocidad)
    const password_hash = await bcrypt.hash(ADMIN.password, 10);

    if (adminExistente && reset) {
      // Actualizar contraseña del admin existente
      await adminExistente.update({ password_hash });
      console.log('✅ Contraseña del administrador actualizada\n');
      console.log(`   Email:       ${adminExistente.email}`);
      console.log(`   Contraseña:  ${ADMIN.password}`);
    } else {
      // Crear el admin nuevo
      const admin = await Usuario.create({
        nombre:        ADMIN.nombre,
        email:         ADMIN.email,
        username:      null,
        password_hash,
        login_type:    'email',
        rol:           'admin',
        activo:        true,
      });

      console.log('✅ Administrador creado exitosamente\n');
      console.log('   ┌─────────────────────────────────────┐');
      console.log(`   │  Nombre:      ${admin.nombre.padEnd(22)}│`);
      console.log(`   │  Email:       ${admin.email.padEnd(22)}│`);
      console.log(`   │  Contraseña:  ${ADMIN.password.padEnd(22)}│`);
      console.log(`   │  Rol:         ${admin.rol.padEnd(22)}│`);
      console.log('   └─────────────────────────────────────┘');
    }

    console.log('\n🚀 Listo. Puedes iniciar sesión en:');
    console.log(`   http://localhost:${process.env.PORT || 3000}/login\n`);

  } catch (error) {
    console.error('❌ Error al crear el administrador:\n');

    // Errores comunes con mensaje claro
    if (error.name === 'SequelizeConnectionError') {
      console.error('   No se pudo conectar a PostgreSQL.');
      console.error('   Verifica que PostgreSQL esté corriendo y que el .env sea correcto.');
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('   Ya existe un usuario con ese email.');
      console.error('   Usa --reset para cambiar la contraseña.');
    } else {
      console.error('  ', error.message);
    }

    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

crearAdmin();
