-- EcoRAEE Cloud, Parte II. Consultas de SOLO LECTURA para la laptop de Katalina.
-- Abrir en SSMS contra la misma instancia local utilizada por SU backend.
-- Ejecutar todo el archivo con F5: las variables se usan en las consultas siguientes.
USE ecoraee_cloud;
GO

-- 1. Usar la serie creada desde el frontend de esta misma laptop.
-- Si se cambió el sufijo durante el ensayo, cambiarlo aquí también.
DECLARE @Serie nvarchar(60) = N'VIDEO-KATALINA-001';
-- Reemplazar NULL por el ID REAL de la conexión editada en esta laptop.
-- No asumir que la conexión #42 de otra instalación existe aquí.
DECLARE @Conexion int = NULL;

-- 2. Persistencia y relaciones: el equipo creado desde la interfaz y su categoría.
SELECT d.id_dispositivo, d.codigo_trazabilidad, i.numero_serie,
       cat.nombre_categoria, d.marca, d.modelo, d.fecha_registro
FROM dbo.dispositivo AS d
JOIN dbo.dispositivo_individual AS i ON i.id_dispositivo = d.id_dispositivo
JOIN dbo.categoria_dispositivo AS cat ON cat.id_categoria = d.id_categoria
WHERE i.numero_serie = @Serie;

-- 3. Actualización: debe coincidir con la capacidad guardada desde SU frontend.
-- Si no se completó @Conexion, esta cuadrícula estará vacía.
SELECT c.id_conexion, origen.nombre AS centro_origen, destino.nombre AS centro_destino,
       c.capacidad_por_periodo, c.unidad_capacidad
FROM dbo.conexion_logistica AS c
JOIN dbo.centro AS origen ON origen.id_centro = c.id_centro_origen
JOIN dbo.centro AS destino ON destino.id_centro = c.id_centro_destino
WHERE c.id_conexion = @Conexion;

-- 4. Diseño real de la base: PK, FK, UNIQUE y CHECK de ejemplo.
-- La FK de categoría relaciona dispositivo con categoria_dispositivo.
-- UNIQUE impide series duplicadas; CHECK limita las condiciones declaradas.
SELECT OBJECT_NAME(o.parent_object_id) AS tabla,
       o.name AS restriccion, o.type_desc AS tipo
FROM sys.objects AS o
WHERE o.name IN (N'pk_dispositivo', N'fk_dispositivo_cat',
                 N'uq_individual_serie', N'ck_dispositivo_condicion_declarada')
  AND OBJECT_SCHEMA_NAME(o.parent_object_id) = N'dbo'
ORDER BY CASE o.type WHEN 'PK' THEN 1 WHEN 'F' THEN 2 WHEN 'UQ' THEN 3 ELSE 4 END;

-- 5. Conteo del equipo de esta demostración: debe dar 1 después del registro.
SELECT COUNT(*) AS registros_con_esta_serie
FROM dbo.dispositivo_individual
WHERE numero_serie = @Serie;
