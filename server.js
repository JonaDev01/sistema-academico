const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./src/config/database');

const app = express();

// Motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sesiones
const sessionStore = new SequelizeStore({ db: sequelize });
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));
sessionStore.sync();

// Hacer usuario disponible en todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  next();
});

// ── Rutas ─────────────────────────────────────────────────────
// REGLA: rutas con segmentos fijos (/nuevo, /importar) ANTES
//        que rutas con parámetros dinámicos (/:id)

const authRoutes       = require('./src/routes/auth.routes');
const dashboardRoutes  = require('./src/routes/dashboard.routes');
const gradosRoutes     = require('./src/routes/grados.routes');
const materiasRoutes   = require('./src/routes/materias.routes');
const docentesRoutes   = require('./src/routes/docentes.routes');
const notasRoutes          = require('./src/routes/notas.routes');
const exportarNotasRoutes  = require('./src/routes/exportarNotas.routes');
const boletinRoutes        = require('./src/routes/boletin.routes');
const importarRoutes       = require('./src/routes/importar.routes');   // ← antes de estudiantes
const exportarRoutes   = require('./src/routes/exportar.routes');   // ← antes de estudiantes
const estudiantesRoutes = require('./src/routes/estudiantes.routes'); // ← al final

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', gradosRoutes);
app.use('/', materiasRoutes);
app.use('/', docentesRoutes);
app.use('/', notasRoutes);
app.use('/', exportarNotasRoutes);
app.use('/', boletinRoutes);
app.use('/', importarRoutes);    // ← /estudiantes/importar
app.use('/', exportarRoutes);    // ← /estudiantes/exportar
app.use('/', estudiantesRoutes); // ← /estudiantes/:id

// Ruta 404
app.use((req, res) => {
  res.status(404).render('404', { titulo: 'Página no encontrada' });
});

// Iniciar servidor y sincronizar BD
const PORT = process.env.PORT || 3000;
sequelize.authenticate()
  .then(() => {
    console.log('✅ Conexión a PostgreSQL exitosa');
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar la base de datos:', err);
  });