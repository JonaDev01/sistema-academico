-- =============================================================
--  SISTEMA DE GESTIÓN ACADÉMICA — Schema PostgreSQL
--  Desarrollador: David Aragón | Carné: 21053
--  Base de datos: gestion_academica
--  Versión: 1.0 | 8 tablas (sin asistencia)
-- =============================================================
-- Ejecutar en psql o pgAdmin sobre la BD gestion_academica:
--   \c gestion_academica
--   \i schema.sql
-- =============================================================


-- -------------------------------------------------------------
-- 0. TIPOS ENUM
--    Se declaran primero porque las tablas los referencian.
--    Si necesitas re-ejecutar el script: DROP TYPE ... CASCADE
-- -------------------------------------------------------------

CREATE TYPE login_type_enum   AS ENUM ('email', 'username');
CREATE TYPE rol_enum           AS ENUM ('admin', 'docente');
CREATE TYPE nivel_enum         AS ENUM ('primaria', 'secundaria');
CREATE TYPE genero_enum        AS ENUM ('masculino', 'femenino', 'otro');
CREATE TYPE estado_matricula_enum AS ENUM ('activo', 'retirado', 'egresado');
CREATE TYPE tipo_beca_enum     AS ENUM ('ninguna', 'becado', 'semi_becado');
CREATE TYPE estado_pago_enum   AS ENUM ('al_dia', 'pendiente');
CREATE TYPE modalidad_enum     AS ENUM ('presencial', 'virtual', 'semipresencial');
CREATE TYPE coeficiente_enum   AS ENUM ('AA', 'AS', 'AF', 'AI');


-- =============================================================
-- 1. USUARIOS
--    Credenciales de acceso al sistema.
--    Admin usa email, docentes usan username.
-- =============================================================

CREATE TABLE usuarios (
    id              SERIAL          PRIMARY KEY,
    nombre          VARCHAR(100)    NOT NULL,

    -- Solo uno de los dos tendrá valor según el rol
    email           VARCHAR(150)    UNIQUE,         -- Solo admin
    username        VARCHAR(50)     UNIQUE,         -- Solo docentes

    password_hash   TEXT            NOT NULL,
    login_type      login_type_enum NOT NULL,
    rol             rol_enum        NOT NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,

    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Al menos uno de los dos campos de login debe tener valor
    CONSTRAINT chk_login_field CHECK (
        (login_type = 'email'    AND email    IS NOT NULL AND username IS NULL) OR
        (login_type = 'username' AND username IS NOT NULL AND email    IS NULL)
    )
);

COMMENT ON TABLE  usuarios               IS 'Credenciales de acceso. Admin usa email, docentes usan username.';
COMMENT ON COLUMN usuarios.login_type    IS 'Determina qué campo usar para autenticar: email o username.';
COMMENT ON COLUMN usuarios.activo        IS 'FALSE = cuenta desactivada, no puede iniciar sesión.';


-- =============================================================
-- 2. DOCENTES
--    Perfil profesional del docente.
--    Siempre ligado a un usuario con rol = docente.
-- =============================================================

CREATE TABLE docentes (
    id              SERIAL          PRIMARY KEY,
    usuario_id      INT             NOT NULL UNIQUE
                                    REFERENCES usuarios(id)
                                    ON DELETE RESTRICT,   -- No borrar usuario si tiene docente

    nombre          VARCHAR(80)     NOT NULL,
    apellido        VARCHAR(80)     NOT NULL,
    telefono        VARCHAR(20),
    especialidad    VARCHAR(100),

    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  docentes            IS 'Perfil extendido del docente. 1:1 con usuarios.';
COMMENT ON COLUMN docentes.usuario_id IS 'FK única — cada docente tiene exactamente una cuenta de acceso.';


-- =============================================================
-- 3. GRADOS
--    Niveles educativos del colegio (sin secciones).
--    El admin los gestiona dinámicamente.
-- =============================================================

CREATE TABLE grados (
    id              SERIAL          PRIMARY KEY,
    nombre          VARCHAR(80)     NOT NULL,       -- Ej: "1° Primaria", "3° Secundaria"
    nivel           nivel_enum      NOT NULL,
    orden           INT             NOT NULL,       -- Para ordenar la lista correctamente
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,

    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_grado_nombre UNIQUE (nombre)
);

COMMENT ON TABLE  grados        IS 'Grados del colegio. Sin secciones. Gestionados dinámicamente por el admin.';
COMMENT ON COLUMN grados.orden  IS 'Número para ordenar la lista: 1 = primero. Independiente del id.';
COMMENT ON COLUMN grados.activo IS 'FALSE = grado oculto en el sistema, pero no se borran sus datos.';


-- =============================================================
-- 4. MATERIAS
--    Cada materia pertenece a UN grado específico.
--    "Matemática de 1° Primaria" ≠ "Matemática de 3° Secundaria"
-- =============================================================

CREATE TABLE materias (
    id              SERIAL          PRIMARY KEY,
    grado_id        INT             NOT NULL
                                    REFERENCES grados(id)
                                    ON DELETE RESTRICT,

    nombre          VARCHAR(100)    NOT NULL,
    horas_semanales INT,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,

    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- No puede haber dos materias con el mismo nombre en el mismo grado
    CONSTRAINT uq_materia_grado UNIQUE (grado_id, nombre)
);

COMMENT ON TABLE  materias          IS 'Materias por grado. Cada materia pertenece a un único grado.';
COMMENT ON COLUMN materias.grado_id IS 'Una materia siempre pertenece a un grado específico, no es global.';


-- =============================================================
-- 5. ASIGNACIONES
--    Tabla puente: docente ↔ materia ↔ grado por año.
--    DOBLE FUNCIÓN: relación académica + fuente de permisos.
--    verificarClaseDocente() consulta esta tabla.
-- =============================================================

CREATE TABLE asignaciones (
    id              SERIAL          PRIMARY KEY,
    docente_id      INT             NOT NULL
                                    REFERENCES docentes(id)
                                    ON DELETE RESTRICT,
    materia_id      INT             NOT NULL
                                    REFERENCES materias(id)
                                    ON DELETE RESTRICT,
    grado_id        INT             NOT NULL
                                    REFERENCES grados(id)
                                    ON DELETE RESTRICT,
    anio            INT             NOT NULL,       -- Ej: 2025
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,

    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Un docente no puede tener la misma materia/grado dos veces en el mismo año
    CONSTRAINT uq_asignacion UNIQUE (docente_id, materia_id, grado_id, anio)
);

COMMENT ON TABLE  asignaciones IS 'Tabla puente docente-materia-grado. También define permisos de acceso del docente.';
COMMENT ON COLUMN asignaciones.anio IS 'Año escolar. Permite reasignar docentes cada año sin perder el historial.';


-- =============================================================
-- 6. ESTUDIANTES
--    Tabla central del sistema.
--    Replica los 26 campos del Excel existente del colegio.
-- =============================================================

CREATE TABLE estudiantes (
    id                  SERIAL              PRIMARY KEY,
    grado_id            INT                 NOT NULL
                                            REFERENCES grados(id)
                                            ON DELETE RESTRICT,

    -- Identificadores
    codigo_estudiante   VARCHAR(30)         NOT NULL UNIQUE,  -- Código interno del colegio
    codigo_unico        VARCHAR(30),                          -- DPI o registro nacional
    id_externo          VARCHAR(30),                          -- ID del Excel anterior (trazabilidad)

    -- Nombres (separados para facilitar ordenamiento y búsqueda)
    nombre1             VARCHAR(80)         NOT NULL,
    nombre2             VARCHAR(80),
    apellido1           VARCHAR(80)         NOT NULL,
    apellido2           VARCHAR(80),

    -- Datos personales
    fecha_nacimiento    DATE                NOT NULL,         -- Edad se calcula dinámicamente
    genero              genero_enum         NOT NULL,
    nivel               nivel_enum          NOT NULL,
    direccion           TEXT,

    -- Estado académico y financiero
    estado_matricula    estado_matricula_enum NOT NULL DEFAULT 'activo',
    tipo_beca           tipo_beca_enum      NOT NULL DEFAULT 'ninguna',
    estado_pago         estado_pago_enum    NOT NULL DEFAULT 'al_dia',
    en_proyecto         BOOLEAN             NOT NULL DEFAULT FALSE,

    -- Datos de familia
    nombre_madre        VARCHAR(150),
    cedula_madre        VARCHAR(30),
    nombre_padre        VARCHAR(150),
    cedula_padre        VARCHAR(30),

    -- Datos institucionales (del Excel)
    departamento        VARCHAR(80),
    programa            VARCHAR(100),
    modalidad           modalidad_enum,
    motivo_registro     TEXT,
    descripcion_retiro  TEXT,                                 -- NULL si está activo

    "createdAt"         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  estudiantes                   IS 'Tabla central. 26 campos del Excel real del colegio. Sin secciones.';
COMMENT ON COLUMN estudiantes.codigo_estudiante IS 'Código que ya usa el colegio en documentos externos. Se mantiene igual.';
COMMENT ON COLUMN estudiantes.id_externo        IS 'ID del sistema Excel anterior. Solo para trazabilidad durante la migración.';
COMMENT ON COLUMN estudiantes.fecha_nacimiento  IS 'La edad NO se guarda — se calcula con DATE_PART(year, NOW()) - DATE_PART(year, fecha_nacimiento).';
COMMENT ON COLUMN estudiantes.descripcion_retiro IS 'Solo se llena si estado_matricula = retirado.';


-- =============================================================
-- 7. PERIODOS
--    Los 4 cortes del año escolar.
--    Nomenclatura del colegio: "Corte 1", "Corte 2", etc.
-- =============================================================

CREATE TABLE periodos (
    id              SERIAL          PRIMARY KEY,
    corte           INT             NOT NULL
                                    CHECK (corte BETWEEN 1 AND 4),
    anio            INT             NOT NULL,
    activo          BOOLEAN         NOT NULL DEFAULT FALSE,  -- Solo 1 activo a la vez

    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- No puede haber dos "Corte 2 del 2025"
    CONSTRAINT uq_periodo UNIQUE (corte, anio)
);

COMMENT ON TABLE  periodos        IS 'Los 4 cortes del año escolar. El colegio usa "Corte 1 a Corte 4", no bimestres.';
COMMENT ON COLUMN periodos.corte  IS 'Número del corte: 1, 2, 3 o 4.';
COMMENT ON COLUMN periodos.activo IS 'Solo un periodo puede estar activo a la vez. El sistema lo usa como periodo por defecto.';


-- =============================================================
-- 8. NOTAS
--    Registro académico central.
--    1 nota por estudiante por materia por corte.
-- =============================================================

CREATE TABLE notas (
    id              SERIAL              PRIMARY KEY,
    estudiante_id   INT                 NOT NULL
                                        REFERENCES estudiantes(id)
                                        ON DELETE RESTRICT,
    materia_id      INT                 NOT NULL
                                        REFERENCES materias(id)
                                        ON DELETE RESTRICT,
    periodo_id      INT                 NOT NULL
                                        REFERENCES periodos(id)
                                        ON DELETE RESTRICT,

    nota_numerica   DECIMAL(5, 2)       NOT NULL
                                        CHECK (nota_numerica BETWEEN 0 AND 100),
    coeficiente     coeficiente_enum    NOT NULL,  -- Calculado y persistido al guardar
    observacion     TEXT,

    "createdAt"     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    -- Un estudiante solo puede tener UNA nota por materia por corte
    CONSTRAINT uq_nota UNIQUE (estudiante_id, materia_id, periodo_id)
);

COMMENT ON TABLE  notas               IS '1 nota por estudiante/materia/corte. Coeficiente AA/AS/AF/AI se calcula y guarda.';
COMMENT ON COLUMN notas.coeficiente   IS 'AA=90-100, AS=76-89, AF=60-75, AI=<60. Se calcula en backend y se persiste aquí.';
COMMENT ON COLUMN notas.nota_numerica IS 'Rango 0.00 a 100.00. El CHECK constraint lo valida a nivel de BD.';


-- =============================================================
-- ÍNDICES
-- Mejoran el rendimiento de las consultas más frecuentes.
-- =============================================================

-- Búsquedas de login
CREATE INDEX idx_usuarios_email    ON usuarios (email)    WHERE email    IS NOT NULL;
CREATE INDEX idx_usuarios_username ON usuarios (username) WHERE username IS NOT NULL;

-- Filtros de estudiantes (los más usados en la UI)
CREATE INDEX idx_estudiantes_grado          ON estudiantes (grado_id);
CREATE INDEX idx_estudiantes_estado_matricula ON estudiantes (estado_matricula);
CREATE INDEX idx_estudiantes_tipo_beca      ON estudiantes (tipo_beca);
CREATE INDEX idx_estudiantes_estado_pago    ON estudiantes (estado_pago);
CREATE INDEX idx_estudiantes_en_proyecto    ON estudiantes (en_proyecto);
CREATE INDEX idx_estudiantes_genero         ON estudiantes (genero);

-- Consultas académicas frecuentes
CREATE INDEX idx_notas_estudiante  ON notas (estudiante_id);
CREATE INDEX idx_notas_materia     ON notas (materia_id);
CREATE INDEX idx_notas_periodo     ON notas (periodo_id);
CREATE INDEX idx_materias_grado    ON materias (grado_id);
CREATE INDEX idx_asignaciones_docente ON asignaciones (docente_id);

-- Búsqueda de periodos activos
CREATE INDEX idx_periodos_activo   ON periodos (activo) WHERE activo = TRUE;


-- =============================================================
-- FUNCIÓN: calcular coeficiente
-- Útil para verificar o recalcular desde SQL directamente.
-- El backend (Node.js) tiene la misma lógica en JavaScript.
-- =============================================================

CREATE OR REPLACE FUNCTION calcular_coeficiente(nota DECIMAL)
RETURNS coeficiente_enum AS $$
BEGIN
    IF    nota >= 90 THEN RETURN 'AA';
    ELSIF nota >= 76 THEN RETURN 'AS';
    ELSIF nota >= 60 THEN RETURN 'AF';
    ELSE                   RETURN 'AI';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calcular_coeficiente IS 'AA=90-100 | AS=76-89 | AF=60-75 | AI=<60. Misma lógica que el backend JS.';


-- =============================================================
-- SEED INICIAL — Datos mínimos para arrancar el sistema
-- =============================================================

-- Cortes del año 2025 (ajustar el año según corresponda)
INSERT INTO periodos (corte, anio, activo) VALUES
    (1, 2025, FALSE),
    (2, 2025, FALSE),
    (3, 2025, TRUE),   -- <-- Cambiar el activo al corte en curso
    (4, 2025, FALSE);

-- NOTA: El usuario admin se crea con el script:
--   node src/seeders/adminSeed.js
-- (la contraseña debe hashearse con bcryptjs, no puede ir en texto plano aquí)


-- =============================================================
-- RESUMEN DE TABLAS
-- =============================================================
-- 1. usuarios      — Credenciales de acceso (admin con email, docente con username)
-- 2. docentes      — Perfil extendido del docente
-- 3. grados        — Niveles educativos (sin secciones)
-- 4. materias      — Materias por grado
-- 5. asignaciones  — Docente ↔ Materia ↔ Grado (también define permisos)
-- 6. estudiantes   — Datos completos del alumno (26 campos del Excel)
-- 7. periodos      — Corte 1 a Corte 4 por año escolar
-- 8. notas         — Nota numérica + coeficiente AA/AS/AF/AI por corte
-- =============================================================