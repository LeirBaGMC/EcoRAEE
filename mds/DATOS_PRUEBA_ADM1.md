# Datos para probar con adm1

Actualización: usa auditor1 para el recorrido de todas las pantallas. adm1 volvió a su menú administrativo base. Los IDs de datos de prueba listados aquí no cambiaron.

No se crearon usuarios. Inicia sesión con adm1 y su clave habitual.

## Evidencias

| Tipo | Registro | Archivo |
| --- | --- | --- |
| ACTA_RECEPCION | {'id_recepcion': 74} | 14 |
| INFORME_EVALUACION | {'id_dispositivo_evaluacion': 125, 'nro_evaluacion': 1} | 15 |
| GUIA_TRASLADO | {'id_movimiento': 54} | 16 |
| GUIA_TRASLADO | {'id_movimiento': 56} | 17 |
| GUIA_TRASLADO | {'id_movimiento': 57} | 18 |
| CERTIFICADO_TRATAMIENTO | {'id_cierre': 17} | 19 |

En Evidencias selecciona el tipo, introduce el número y usa propósito Auditoría.

## Dispositivos

| Caso | ID | Estado |
| --- | --- | --- |
| registrado_1 | 121 | REGISTRADO |
| registrado_2 | 122 | REGISTRADO |
| solicitud_pendiente | 123 | EN_RECOLECCION |
| recibido | 124 | RECIBIDO |
| evaluado | 125 | EVALUADO |
| reparable | 126 | EVALUADO |
| mov_programado | 127 | EVALUADO |
| mov_autorizado | 128 | EVALUADO |
| mov_transito_sin_guia | 129 | EN_TRANSITO |
| mov_transito_con_guia | 130 | EN_TRANSITO |
| mov_cerrado | 131 | EVALUADO |
| tratamiento_curso | 132 | EN_TRATAMIENTO |
| tratamiento_cerrado | 133 | CERRADO |
| asignacion_pendiente | 134 | ASIGNADO |

## Recorrido

- Análisis de red: escenario 9, dos ejecuciones guardadas.
- Recepciones, Tratamientos y Cierres: nuevos listados globales para el administrador.
- Movimientos: programado, autorizado, en tránsito y cerrado.
- Indicadores y alertas: mediciones actualizadas y alertas de capacidad/guía faltante.
- Auditoría: cambios generados por los usuarios operativos existentes.
- El administrador consulta toda la red; no se le añadieron permisos operativos de escritura.
- Datos ficticios identificados como PRUEBA FRONT; archivos PDF verificados por descarga HTTP.
- La conexión de prueba tiene toda su capacidad reservada; para programar otro movimiento usa otra conexión/periodo o anula una reserva con coo1.
- Para repetir la carga conserva backend/.datos-front.json. No repite pasos ya completados.
