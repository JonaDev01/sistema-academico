-- =============================================================
--  insertar_materias.sql
--  Materias oficiales por grado — Colegio Monte Hermón
--  Ejecutar en pgAdmin sobre la BD gestion_academica
--  NOTA: Usa los IDs de grados según setup_grados.sql
--        I Nivel=1, II Nivel=2, III Nivel=3
--        1ro=4, 2do=5, 3ro=6, 4to=7, 5to=8, 6to=9
--        7mo=10, 8vo=11, 9no=12, 10mo=13, 11mo=14
-- =============================================================

-- Limpiar materias existentes (opcional — comentar si ya hay datos)
-- TRUNCATE TABLE materias RESTART IDENTITY CASCADE;

-- ── 1ro y 2do Primaria (grado_id 4 y 5) ──────────────────────
INSERT INTO materias (grado_id, nombre, activo, "createdAt", "updatedAt") VALUES
  (4, 'Lengua y Literatura',                              true, NOW(), NOW()),
  (4, 'Matemática',                                       true, NOW(), NOW()),
  (4, 'Conociendo mi Mundo',                              true, NOW(), NOW()),
  (4, 'Derechos y Dignidad de las Mujeres',               true, NOW(), NOW()),
  (4, 'Creciendo en Valores',                             true, NOW(), NOW()),
  (4, 'Educación para Aprender, Emprender y Prosperar',   true, NOW(), NOW()),
  (4, 'Educación Física y Práctica Deportiva',            true, NOW(), NOW()),
  (4, 'Talleres de Arte y Cultura',                       true, NOW(), NOW()),
  (4, 'Lengua Extranjera (Inglés)',                       true, NOW(), NOW()),

  (5, 'Lengua y Literatura',                              true, NOW(), NOW()),
  (5, 'Matemática',                                       true, NOW(), NOW()),
  (5, 'Conociendo mi Mundo',                              true, NOW(), NOW()),
  (5, 'Derechos y Dignidad de las Mujeres',               true, NOW(), NOW()),
  (5, 'Creciendo en Valores',                             true, NOW(), NOW()),
  (5, 'Educación para Aprender, Emprender y Prosperar',   true, NOW(), NOW()),
  (5, 'Educación Física y Práctica Deportiva',            true, NOW(), NOW()),
  (5, 'Talleres de Arte y Cultura',                       true, NOW(), NOW()),
  (5, 'Lengua Extranjera (Inglés)',                       true, NOW(), NOW());

-- ── 3ro a 6to Primaria (grado_id 6, 7, 8, 9) ─────────────────
INSERT INTO materias (grado_id, nombre, activo, "createdAt", "updatedAt") VALUES
  (6, 'Lengua y Literatura',                              true, NOW(), NOW()),
  (6, 'Matemática',                                       true, NOW(), NOW()),
  (6, 'Ciencias Naturales',                               true, NOW(), NOW()),
  (6, 'Estudios Sociales',                                true, NOW(), NOW()),
  (6, 'Derechos y Dignidad de las Mujeres',               true, NOW(), NOW()),
  (6, 'Creciendo en Valores',                             true, NOW(), NOW()),
  (6, 'Educación para Aprender, Emprender y Prosperar',   true, NOW(), NOW()),
  (6, 'Educación Física y Práctica Deportiva',            true, NOW(), NOW()),
  (6, 'Talleres de Arte y Cultura',                       true, NOW(), NOW()),
  (6, 'Lengua Extranjera (Inglés)',                       true, NOW(), NOW()),

  (7, 'Lengua y Literatura',                              true, NOW(), NOW()),
  (7, 'Matemática',                                       true, NOW(), NOW()),
  (7, 'Ciencias Naturales',                               true, NOW(), NOW()),
  (7, 'Estudios Sociales',                                true, NOW(), NOW()),
  (7, 'Derechos y Dignidad de las Mujeres',               true, NOW(), NOW()),
  (7, 'Creciendo en Valores',                             true, NOW(), NOW()),
  (7, 'Educación para Aprender, Emprender y Prosperar',   true, NOW(), NOW()),
  (7, 'Educación Física y Práctica Deportiva',            true, NOW(), NOW()),
  (7, 'Talleres de Arte y Cultura',                       true, NOW(), NOW()),
  (7, 'Lengua Extranjera (Inglés)',                       true, NOW(), NOW()),

  (8, 'Lengua y Literatura',                              true, NOW(), NOW()),
  (8, 'Matemática',                                       true, NOW(), NOW()),
  (8, 'Ciencias Naturales',                               true, NOW(), NOW()),
  (8, 'Estudios Sociales',                                true, NOW(), NOW()),
  (8, 'Derechos y Dignidad de las Mujeres',               true, NOW(), NOW()),
  (8, 'Creciendo en Valores',                             true, NOW(), NOW()),
  (8, 'Educación para Aprender, Emprender y Prosperar',   true, NOW(), NOW()),
  (8, 'Educación Física y Práctica Deportiva',            true, NOW(), NOW()),
  (8, 'Talleres de Arte y Cultura',                       true, NOW(), NOW()),
  (8, 'Lengua Extranjera (Inglés)',                       true, NOW(), NOW()),

  (9, 'Lengua y Literatura',                              true, NOW(), NOW()),
  (9, 'Matemática',                                       true, NOW(), NOW()),
  (9, 'Ciencias Naturales',                               true, NOW(), NOW()),
  (9, 'Estudios Sociales',                                true, NOW(), NOW()),
  (9, 'Derechos y Dignidad de las Mujeres',               true, NOW(), NOW()),
  (9, 'Creciendo en Valores',                             true, NOW(), NOW()),
  (9, 'Educación para Aprender, Emprender y Prosperar',   true, NOW(), NOW()),
  (9, 'Educación Física y Práctica Deportiva',            true, NOW(), NOW()),
  (9, 'Talleres de Arte y Cultura',                       true, NOW(), NOW()),
  (9, 'Lengua Extranjera (Inglés)',                       true, NOW(), NOW());

-- ── 7mo a 9no Secundaria (grado_id 10, 11, 12) ───────────────
INSERT INTO materias (grado_id, nombre, activo, "createdAt", "updatedAt") VALUES
  (10, 'Lengua y Literatura',                             true, NOW(), NOW()),
  (10, 'Lengua Extranjera (Inglés)',                      true, NOW(), NOW()),
  (10, 'Talleres de Arte y Cultura',                      true, NOW(), NOW()),
  (10, 'Creciendo en Valores',                            true, NOW(), NOW()),
  (10, 'Derechos y Dignidad de las Mujeres',              true, NOW(), NOW()),
  (10, 'Educación Física y Práctica Deportiva',           true, NOW(), NOW()),
  (10, 'Educación para Aprender, Emprender y Prosperar',  true, NOW(), NOW()),
  (10, 'Ciencias Sociales',                               true, NOW(), NOW()),
  (10, 'Biblia',                                          true, NOW(), NOW()),
  (10, 'Ciencias Naturales',                              true, NOW(), NOW()),
  (10, 'Matemática',                                      true, NOW(), NOW()),

  (11, 'Lengua y Literatura',                             true, NOW(), NOW()),
  (11, 'Lengua Extranjera (Inglés)',                      true, NOW(), NOW()),
  (11, 'Talleres de Arte y Cultura',                      true, NOW(), NOW()),
  (11, 'Creciendo en Valores',                            true, NOW(), NOW()),
  (11, 'Derechos y Dignidad de las Mujeres',              true, NOW(), NOW()),
  (11, 'Educación Física y Práctica Deportiva',           true, NOW(), NOW()),
  (11, 'Educación para Aprender, Emprender y Prosperar',  true, NOW(), NOW()),
  (11, 'Ciencias Sociales',                               true, NOW(), NOW()),
  (11, 'Biblia',                                          true, NOW(), NOW()),
  (11, 'Ciencias Naturales',                              true, NOW(), NOW()),
  (11, 'Matemática',                                      true, NOW(), NOW()),

  (12, 'Lengua y Literatura',                             true, NOW(), NOW()),
  (12, 'Lengua Extranjera (Inglés)',                      true, NOW(), NOW()),
  (12, 'Talleres de Arte y Cultura',                      true, NOW(), NOW()),
  (12, 'Creciendo en Valores',                            true, NOW(), NOW()),
  (12, 'Derechos y Dignidad de las Mujeres',              true, NOW(), NOW()),
  (12, 'Educación Física y Práctica Deportiva',           true, NOW(), NOW()),
  (12, 'Educación para Aprender, Emprender y Prosperar',  true, NOW(), NOW()),
  (12, 'Ciencias Sociales',                               true, NOW(), NOW()),
  (12, 'Biblia',                                          true, NOW(), NOW()),
  (12, 'Ciencias Naturales',                              true, NOW(), NOW()),
  (12, 'Matemática',                                      true, NOW(), NOW());

-- ── 10mo y 11mo Secundaria (grado_id 13, 14) ─────────────────
INSERT INTO materias (grado_id, nombre, activo, "createdAt", "updatedAt") VALUES
  (13, 'Lengua y Literatura',                             true, NOW(), NOW()),
  (13, 'Lengua Extranjera (Inglés)',                      true, NOW(), NOW()),
  (13, 'Creciendo en Valores',                            true, NOW(), NOW()),
  (13, 'Derechos y Dignidad de las Mujeres',              true, NOW(), NOW()),
  (13, 'Educación Física y Práctica Deportiva',           true, NOW(), NOW()),
  (13, 'Educación para Aprender, Emprender y Prosperar',  true, NOW(), NOW()),
  (13, 'Ciencias Sociales',                               true, NOW(), NOW()),
  (13, 'Biblia',                                          true, NOW(), NOW()),
  (13, 'Matemática',                                      true, NOW(), NOW()),
  (13, 'Química',                                         true, NOW(), NOW()),
  (13, 'Física',                                          true, NOW(), NOW()),
  (13, 'Biología',                                        true, NOW(), NOW()),

  (14, 'Lengua y Literatura',                             true, NOW(), NOW()),
  (14, 'Lengua Extranjera (Inglés)',                      true, NOW(), NOW()),
  (14, 'Creciendo en Valores',                            true, NOW(), NOW()),
  (14, 'Derechos y Dignidad de las Mujeres',              true, NOW(), NOW()),
  (14, 'Educación Física y Práctica Deportiva',           true, NOW(), NOW()),
  (14, 'Educación para Aprender, Emprender y Prosperar',  true, NOW(), NOW()),
  (14, 'Ciencias Sociales',                               true, NOW(), NOW()),
  (14, 'Biblia',                                          true, NOW(), NOW()),
  (14, 'Matemática',                                      true, NOW(), NOW()),
  (14, 'Química',                                         true, NOW(), NOW()),
  (14, 'Física',                                          true, NOW(), NOW()),
  (14, 'Biología',                                        true, NOW(), NOW());

-- Verificar resultado
SELECT g.nombre AS grado, COUNT(m.id) AS total_materias
FROM grados g
LEFT JOIN materias m ON m.grado_id = g.id AND m.activo = true
GROUP BY g.id, g.nombre, g.orden
ORDER BY g.orden;
