-- EcoRAEE Cloud, Parte II. Consultas de SOLO LECTURA para la demostración local.
-- Abrir en SSMS contra la instancia local utilizada por el backend.
USE ecoraee_cloud;
GO

-- 1. Cambiar la serie si se utilizó otra durante la grabación.
DECLARE @Serie nvarchar(60) = N'VIDEO-RAEE-001';
DECLARE @Conexion int = 42;
-- Escribir el número del movimiento de prueba si se mostró su anulación.
DECLARE @MovimientoAnulado int = NULL;

-- 2. Verificar que el dispositivo creado desde el frontend quedó persistido.
SELECT d.id_dispositivo, d.codigo_trazabilidad, i.numero_serie,
       cat.nombre_categoria, d.marca, d.modelo, d.condicion_declarada,
       d.fecha_registro, e.estado_actual
FROM dbo.dispositivo AS d
JOIN dbo.dispositivo_individual AS i ON i.id_dispositivo = d.id_dispositivo
JOIN dbo.categoria_dispositivo AS cat ON cat.id_categoria = d.id_categoria
LEFT JOIN dbo.v_dispositivo_estado_actual AS e ON e.id_dispositivo = d.id_dispositivo
WHERE i.numero_serie = @Serie;

-- 3. Comprobar que el intento duplicado no añadió otra fila.
SELECT COUNT(*) AS registros_con_esta_serie
FROM dbo.dispositivo_individual
WHERE numero_serie = @Serie;

-- 4. Verificar el valor actualizado desde Centros y conexiones.
SELECT c.id_conexion, origen.nombre AS centro_origen, destino.nombre AS centro_destino,
       c.capacidad_por_periodo, c.unidad_capacidad, c.activa
FROM dbo.conexion_logistica AS c
JOIN dbo.centro AS origen ON origen.id_centro = c.id_centro_origen
JOIN dbo.centro AS destino ON destino.id_centro = c.id_centro_destino
WHERE c.id_conexion = @Conexion;

-- 5. La baja lógica conserva el registro y su estado ANULADO.
SELECT id_movimiento, codigo_movimiento, estado_movimiento, fecha_despacho
FROM dbo.movimiento
WHERE id_movimiento = @MovimientoAnulado;

-- 6. Evidencia opcional de claves primarias y restricciones de unicidad.
SELECT OBJECT_NAME(parent_object_id) AS tabla, name AS restriccion, type_desc
FROM sys.key_constraints
WHERE parent_object_id IN (OBJECT_ID(N'dbo.dispositivo'), OBJECT_ID(N'dbo.dispositivo_individual'))
ORDER BY tabla, type_desc;

-- 7. Evidencia opcional de las relaciones del dispositivo.
SELECT fk.name AS relacion, OBJECT_NAME(fk.parent_object_id) AS tabla_origen,
       OBJECT_NAME(fk.referenced_object_id) AS tabla_referenciada
FROM sys.foreign_keys AS fk
WHERE fk.parent_object_id IN (OBJECT_ID(N'dbo.dispositivo'), OBJECT_ID(N'dbo.dispositivo_individual'),
                              OBJECT_ID(N'dbo.evaluacion_tecnica'), OBJECT_ID(N'dbo.historial_estado'))
ORDER BY tabla_origen, relacion;
