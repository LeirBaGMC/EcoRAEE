# Guía de adm1

El administrador configura la red, gestiona cuentas y supervisa información. El rol no concede automáticamente las acciones operativas de los otros roles.

## Evidencias

Son archivos que respaldan un hecho: acta de recepción, informe de evaluación, guía de traslado o documento del cierre. No es un explorador general de archivos.

1. Entra en Evidencias y elige Recepción, Movimiento, Cierre de trazabilidad o Evaluación técnica.
2. Introduce el número interno de ese registro (no el código de trazabilidad ni el número del archivo). Una evaluación requiere número de dispositivo y número de evaluación.
3. Elige el propósito Auditoría y pulsa Consultar evidencias.
4. Si hay documentos, pulsa Abrir. Si no hay, la tabla lo indica. Un registro inexistente o fuera de alcance puede producir un error.

adm1 puede consultar y abrir archivos de cualquier organización; el rol Administrador por sí solo no puede subirlos. Los demás roles conservan el alcance de su organización. La pantalla requiere conocer el número: aún no dispone de un buscador de registros. Puedes obtenerlo del detalle del proceso o del campo Registro en Auditoría para la tabla correspondiente.

Las lecturas de archivos no equivalen a los cambios mostrados en la pantalla Auditoría. El backend emite un mensaje de log técnico al descargar; no debe prometerse que toda consulta aparece en la tabla de auditoría.

## Indicadores y alertas (Seguimiento)

Calcular ahora consulta SQL Server y guarda seis mediciones de toda la red con la fecha de hoy. Si ya existen hoy, actualiza esas mediciones. No programa movimientos ni ejecuta flujo máximo. Historia → Ver muestra mediciones anteriores, hasta 60, por indicador.

| Código | Qué mide |
| --- | --- |
| IND-01 | Total de dispositivos registrados |
| IND-02 | Dispositivos con evaluación / total de dispositivos × 100 |
| IND-03 | Dispositivos cuya última clasificación es REUTILIZABLE / dispositivos evaluados × 100 |
| IND-04 | Total de movimientos cerrados |
| IND-05 | Total de cierres de trazabilidad |
| IND-06 | Total de evidencias registradas |

Los conteos son acumulados; la fecha de corte indica cuándo se calculó la medición. Los datos locales incluyen registros de las pruebas.

Buscar alertas nuevas revisa capacidad comprometida del mes (media desde 90 %, alta desde 100 %), movimientos en tránsito sin guía y retrasos de más de 7 días en tránsito o sin evaluación tras recepción. Los umbrales son propuestas del proyecto. Marcar atendida registra la fecha de atención; no soluciona el problema ni elimina el registro. Si la causa persiste, una nueva evaluación puede generar otra alerta.

## Centros y conexiones

Un centro es un lugar de la red, asociado a una organización. Una conexión es una ruta dirigida entre dos centros, con capacidad por periodo en UND o KG.

1. Revisa Listado de centros antes de crear uno. Completa código, nombre, tipo, ciudad, almacenamiento y organización.
2. Para crear una conexión, selecciona origen y destino distintos, capacidad y unidad.
3. Ejemplo: A → B, 100 UND por mes. En la implementación actual los movimientos reservan capacidad del mes calendario de su fecha de despacho. B → A sería otra conexión.

Crear una conexión no transporta equipos ni crea movimientos. Capacidad de almacenamiento del centro y capacidad de transporte de la conexión son conceptos distintos.

## Auditoría

Permite revisar quién cambió qué y cuándo. Es una consulta; no permite editar ni deshacer los hechos.

- Sin filtros muestra todos los registros disponibles para el administrador.
- Tabla: nombre técnico, por ejemplo movimiento, usuario o usuario_rol.
- Clave del registro: identificador del registro afectado, no el del usuario que realizó la acción.
- INSERT significa creación y UPDATE modificación.
- Usuario es la persona que ejecutó la acción, presentada por su ID.
- Ver cambio muestra valores antes y después.

Ejemplo observado durante la revisión: tabla movimiento, registro 47. Escribe movimiento y 47 en los filtros y pulsa Filtrar para consultar sus cambios. No implica que ese movimiento tenga archivos adjuntos.

## Corrección y verificación

Se reprodujo y corrigió la pantalla en blanco al dejar Tipo de registro en Selecciona: se leían campos de un tipo inexistente. También se protegen destinos desconocidos e IDs inválidos y se limpia el resultado al cambiar de registro.

Se añadió ayuda para Evidencias y Seguimiento, confirmación del cálculo y actualización de la historia abierta tras recalcular. Se retiró la afirmación incorrecta de que toda consulta de evidencia queda auditada.

13 pruebas de frontend aprobadas y compilación correcta. En navegador con adm1 se verificó que el tipo vacío ya no rompe Evidencias y que Calcular ahora guarda los seis indicadores. No se realizó una nueva subida/descarga de archivos en esta revisión. La advertencia de tamaño de Three.js persiste. Los servidores permanecen activos.
