const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const path = require('path');
require('dotenv').config();

// Línea nueva
const { sequelize } = require('./src/config/database');
const authRoutes = require('./src/routes/auth.routes');

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

// Rutas
const dashboardRoutes = require('./src/routes/dashboard.routes');
app.use('/', authRoutes);
app.use('/', dashboardRoutes);

const estudiantesRoutes = require('./src/routes/estudiantes.routes');
app.use('/', estudiantesRoutes);

// Ruta 404
app.use((req, res) => {
  res.status(404).render('404', { titulo: 'Página no encontrada' });
});

// Iniciar servidor y sincronizar BD
const PORT = process.env.PORT || 3000;
sequelize.authenticate()
  .then(() => {
    console.log('✅ Conexión a PostgreSQL exitosa');
    // DESPUÉS
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar la base de datos:', err);
  });