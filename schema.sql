-- =============================================================
--  SISTEMA DE GESTIÓN ACADÉMICA — Schema PostgreSQL v2.0
--  Colegio Monte Hermón
--  Desarrollador: David Aragón | Carné: 21053
--  Base de datos: gestion_academica
--  Versión: 2.0 | Actualizado Sprint 3
-- =============================================================
-- Ejecutar en pgAdmin sobre la BD gestion_academica:
--   Query Tool → pegar y ejecutar todo
-- =============================================================


-- -------------------------------------------------------------
-- 0. LIMPIAR SI EXISTE (para reinstalación)
--    Descomentar solo si necesitas empezar desde cero
-- -------------------------------------------------------------
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;


-- -------------------------------------------------------------
-- 1. TIPOS ENUM
-- -------------------------------------------------------------

-- Login y roles
CREATE TYPE login_type_enum        AS ENUM ('email', 'username');
CREATE TYPE rol_enum                AS ENUM ('admin', 'docente');

-- Nivel educativo — STRING en modelos para compatibilidad entre instalaciones
-- Se mantiene como referencia pero las columnas usan VARCHAR

-- Género
CREATE TYPE genero_enum             AS ENUM ('masculino', 'femenino');

-- Estado de matrícula — incluye 'repitente' desde Sprint 3
CREATE TYPE estado_matricula_enum   AS ENUM ('activo', 'retirado', 'egresado', 'repitente');

-- Beca y pago
CREATE TYPE tipo_beca_enum          AS ENUM ('ninguna', 'becado', 'semi_becado');
CREATE TYPE estado_pago_enum        AS ENUM ('al_dia', 'pendiente');

-- Coeficiente de notas
CREATE TYPE coeficiente_enum        AS ENUM ('AA', 'AS', 'AF', 'AI');


-- =============================================================
-- 2. USUARIOS
--    Credenciales de acceso. Admin usa email, docente usa username.
-- =============================================================

CREATE TABLE usuarios (
    id              SERIAL          PRIMARY KEY,
    nombre          VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    UNIQUE,
    username        VARCHAR(50)     UNIQUE,
    password_hash   TEXT            NOT NULL,
    login_type      login_type_enum NOT NULL,
    rol             rol_enum        NOT NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_login_email    CHECK (login_type <> 'email'    OR email    IS NOT NULL),
    CONSTRAINT chk_login_username CHECK (login_type <> 'username' OR username IS NOT NULL)
);

CREATE INDEX idx_usuarios_email    ON usuarios (email)    WHERE email    IS NOT NULL;
CREATE INDEX idx_usuarios_username ON usuarios (username) WHERE username IS NOT NULL;


-- =============================================================
-- 3. DOCENTES
--    Perfil extendido del docente — siempre ligado a un usuario.
-- =============================================================

CREATE TABLE docentes (
    id              SERIAL          PRIMARY KEY,
    usuario_id      INTEGER         NOT NULL UNIQUE
                                    REFERENCES usuarios(id) ON DELETE RESTRICT,
    nombre          VARCHAR(80)     NOT NULL,
    apellido        VARCHAR(80)     NOT NULL,
    telefono        VARCHAR(20),
    especialidad    VARCHAR(100),
    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 4. GRADOS
--    Niveles educativos del colegio.
--    nivel usa VARCHAR para compatibilidad entre instalaciones.
--    nivel_importacion + modalidad_importacion identifican el
--    grado en el Excel del MINED de forma única.
-- =============================================================

CREATE TABLE grados (
    id                      SERIAL          PRIMARY KEY,
    nombre                  VARCHAR(80)     NOT NULL UNIQUE,
    nivel                   VARCHAR(20)     NOT NULL,   -- preescolar | primaria | secundaria
    orden                   INTEGER         NOT NULL,
    nivel_importacion       VARCHAR(30),    -- PRIMERO...UNDECIMO
    modalidad_importacion   VARCHAR(30),    -- PREESCOLAR FORMAL | PRIMARIA REGULAR | SECUNDARIA REGULAR
    activo                  BOOLEAN         NOT NULL DEFAULT TRUE,
    "createdAt"             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_nivel CHECK (nivel IN ('preescolar', 'primaria', 'secundaria'))
);

CREATE INDEX idx_grados_nivel  ON grados (nivel);
CREATE INDEX idx_grados_activo ON grados (activo);


-- =============================================================
-- 5. MATERIAS
--    Asignaturas por grado.
-- =============================================================

CREATE TABLE materias (
    id          SERIAL          PRIMARY KEY,
    grado_id    INTEGER         NOT NULL
                                REFERENCES grados(id) ON DELETE RESTRICT,
    nombre      VARCHAR(100)    NOT NULL,
    activo      BOOLEAN         NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_materia_grado UNIQUE (grado_id, nombre)
);

CREATE INDEX idx_materias_grado  ON materias (grado_id);
CREATE INDEX idx_materias_activo ON materias (activo);


-- =============================================================
-- 6. ESTUDIANTES
--    26 campos del Excel real del colegio.
--    nivel y estado_matricula usan VARCHAR para flexibilidad.
--    fecha_nacimiento permite NULL (fórmulas en el Excel).
--    grado_id permite NULL (estudiantes sin grado asignado).
-- =============================================================

CREATE TABLE estudiantes (
    id                  SERIAL          PRIMARY KEY,
    grado_id            INTEGER         REFERENCES grados(id) ON DELETE RESTRICT,
    codigo_estudiante   VARCHAR(50)     UNIQUE,
    codigo_unico        VARCHAR(50),
    id_externo          VARCHAR(50),
    nombre1             VARCHAR(80)     NOT NULL,
    nombre2             VARCHAR(80),
    apellido1           VARCHAR(80)     NOT NULL,
    apellido2           VARCHAR(80),
    fecha_nacimiento    DATE,           -- NULL permitido: fórmulas en Excel
    genero              VARCHAR(20)     NOT NULL,
    nivel               VARCHAR(20)     NOT NULL,
    direccion           VARCHAR(200),
    estado_matricula    VARCHAR(20)     NOT NULL DEFAULT 'activo',
    tipo_beca           VARCHAR(20)     NOT NULL DEFAULT 'ninguna',
    estado_pago         VARCHAR(20)     NOT NULL DEFAULT 'al_dia',
    en_proyecto         BOOLEAN         NOT NULL DEFAULT FALSE,
    nombre_madre        VARCHAR(150),
    cedula_madre        VARCHAR(50),
    nombre_padre        VARCHAR(150),
    cedula_padre        VARCHAR(50),
    departamento        VARCHAR(80),
    programa            VARCHAR(100),
    modalidad           VARCHAR(30)     DEFAULT 'presencial',
    motivo_registro     VARCHAR(200),
    descripcion_retiro  TEXT,
    "createdAt"         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_estado_matricula CHECK (estado_matricula IN ('activo','retirado','egresado','repitente')),
    CONSTRAINT chk_tipo_beca        CHECK (tipo_beca        IN ('ninguna','becado','semi_becado')),
    CONSTRAINT chk_estado_pago      CHECK (estado_pago      IN ('al_dia','pendiente')),
    CONSTRAINT chk_nivel_est        CHECK (nivel            IN ('preescolar','primaria','secundaria'))
);

CREATE INDEX idx_estudiantes_grado       ON estudiantes (grado_id);
CREATE INDEX idx_estudiantes_estado      ON estudiantes (estado_matricula);
CREATE INDEX idx_estudiantes_tipo_beca   ON estudiantes (tipo_beca);
CREATE INDEX idx_estudiantes_estado_pago ON estudiantes (estado_pago);
CREATE INDEX idx_estudiantes_en_proyecto ON estudiantes (en_proyecto);


-- =============================================================
-- 7. PERIODOS
--    Cortes evaluativos — 4 por año.
--    Solo uno puede estar activo a la vez.
-- =============================================================

CREATE TABLE periodos (
    id          SERIAL      PRIMARY KEY,
    corte       INTEGER     NOT NULL CHECK (corte BETWEEN 1 AND 4),
    anio        INTEGER     NOT NULL,
    activo      BOOLEAN     NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_periodo UNIQUE (corte, anio)
);


-- =============================================================
-- 8. ASIGNACIONES
--    Docente ↔ Materia por año — tabla puente N:M.
--    También controla los permisos de acceso del docente.
-- =============================================================

CREATE TABLE asignaciones (
    id          SERIAL      PRIMARY KEY,
    docente_id  INTEGER     NOT NULL REFERENCES docentes(id)  ON DELETE RESTRICT,
    grado_id    INTEGER     NOT NULL REFERENCES grados(id)    ON DELETE RESTRICT,
    materia_id  INTEGER     NOT NULL REFERENCES materias(id)  ON DELETE RESTRICT,
    anio        INTEGER     NOT NULL,
    activo      BOOLEAN     NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_asignacion UNIQUE (docente_id, grado_id, materia_id, anio)
);

CREATE INDEX idx_asignaciones_docente ON asignaciones (docente_id);
CREATE INDEX idx_asignaciones_materia ON asignaciones (materia_id);
CREATE INDEX idx_asignaciones_grado   ON asignaciones (grado_id);


-- =============================================================
-- 9. NOTAS
--    1 nota por estudiante por materia por corte.
--    coeficiente se calcula automáticamente por hook de Sequelize.
-- =============================================================

CREATE TABLE notas (
    id              SERIAL          PRIMARY KEY,
    estudiante_id   INTEGER         NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
    materia_id      INTEGER         NOT NULL REFERENCES materias(id)    ON DELETE RESTRICT,
    periodo_id      INTEGER         NOT NULL REFERENCES periodos(id)    ON DELETE RESTRICT,
    nota_numerica   DECIMAL(5,2)    NOT NULL CHECK (nota_numerica BETWEEN 0 AND 100),
    coeficiente     VARCHAR(2),     -- NULL permitido: hook lo calcula antes de guardar
    observacion     TEXT,
    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_nota UNIQUE (estudiante_id, materia_id, periodo_id)
);

CREATE INDEX idx_notas_estudiante ON notas (estudiante_id);
CREATE INDEX idx_notas_materia    ON notas (materia_id);
CREATE INDEX idx_notas_periodo    ON notas (periodo_id);


-- =============================================================
-- 10. SESIONES
--     Manejadas por connect-session-sequelize.
--     Se crea automáticamente al iniciar el servidor.
--     Si da error al iniciar, ejecutar: DROP TABLE IF EXISTS "Sessions";
-- =============================================================

-- La tabla Sessions la crea Sequelize automáticamente.
-- No es necesario crearla aquí.


-- =============================================================
-- VERIFICACIÓN FINAL
-- =============================================================

SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c
     WHERE c.table_name = t.table_name
     AND c.table_schema = 'public') AS columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
