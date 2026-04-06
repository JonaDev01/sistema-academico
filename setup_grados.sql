-- =============================================================
--  setup_grados.sql
--  Grados con nombres oficiales del MINED — Monte Hermón
--  Usar en instalación nueva O después de borrar los existentes
-- =============================================================

-- 1. Limpiar grados y estudiantes existentes (CUIDADO en producción)
TRUNCATE TABLE estudiantes RESTART IDENTITY CASCADE;
TRUNCATE TABLE grados      RESTART IDENTITY CASCADE;

-- 2. Agregar 'repitente' al ENUM si aún no existe
ALTER TYPE estado_matricula_enum ADD VALUE IF NOT EXISTS 'repitente';

-- 3. Insertar grados con nombres oficiales
INSERT INTO grados (nombre, nivel, orden, nivel_importacion, modalidad_importacion, activo, "createdAt", "updatedAt") VALUES

  -- Preescolar
  ('I Nivel',    'preescolar', 1, 'PRIMERO',  'PREESCOLAR FORMAL', true, NOW(), NOW()),
  ('II Nivel',   'preescolar', 2, 'SEGUNDO',  'PREESCOLAR FORMAL', true, NOW(), NOW()),
  ('III Nivel',  'preescolar', 3, 'TERCERO',  'PREESCOLAR FORMAL', true, NOW(), NOW()),

  -- Primaria
  ('Primer grado',  'primaria', 4,  'PRIMERO', 'PRIMARIA REGULAR', true, NOW(), NOW()),
  ('Segundo grado', 'primaria', 5,  'SEGUNDO', 'PRIMARIA REGULAR', true, NOW(), NOW()),
  ('Tercer grado',  'primaria', 6,  'TERCERO', 'PRIMARIA REGULAR', true, NOW(), NOW()),
  ('Cuarto grado',  'primaria', 7,  'CUARTO',  'PRIMARIA REGULAR', true, NOW(), NOW()),
  ('Quinto grado',  'primaria', 8,  'QUINTO',  'PRIMARIA REGULAR', true, NOW(), NOW()),
  ('Sexto grado',   'primaria', 9,  'SEXTO',   'PRIMARIA REGULAR', true, NOW(), NOW()),

  -- Secundaria
  ('Séptimo',   'secundaria', 10, 'SEPTIMO',  'SECUNDARIA REGULAR', true, NOW(), NOW()),
  ('Octavo',    'secundaria', 11, 'OCTAVO',   'SECUNDARIA REGULAR', true, NOW(), NOW()),
  ('Noveno',    'secundaria', 12, 'NOVENO',   'SECUNDARIA REGULAR', true, NOW(), NOW()),
  ('Décimo',    'secundaria', 13, 'DECIMO',   'SECUNDARIA REGULAR', true, NOW(), NOW()),
  ('Undécimo',  'secundaria', 14, 'UNDECIMO', 'SECUNDARIA REGULAR', true, NOW(), NOW());

-- 4. Verificar resultado
SELECT id, nombre, nivel, orden, nivel_importacion, modalidad_importacion
FROM grados
ORDER BY orden;
