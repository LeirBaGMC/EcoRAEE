# Consultas globales y datos de prueba

Actualización: para las auditorías se creó auditor1 con todos los roles. adm1 volvió a sus permisos y menú base. Ver CUENTA_AUDITORIA_TEMPORAL.md. El resto de este documento conserva el historial de la ampliación anterior.

Se usa el usuario existente adm1 con rol ADMINISTRADOR. No se crearon cuentas ni se cambiaron las credenciales. El alcance global se asigna por el rol autenticado, no por un nombre de usuario enviado por el cliente.

## Cambios

- ADMINISTRADOR puede consultar dispositivos e historial, lotes, solicitudes, movimientos y detalle, tratamientos, asignaciones, cierres, escenarios y ejecuciones, además de las consultas administrativas y evidencias existentes.
- Las consultas de dispositivos, movimientos, tratamientos, asignaciones y cierres permiten al administrador leer todas las organizaciones. No se amplía el alcance de escritura.
- El menú del administrador muestra todas las áreas. Recepciones, Tratamientos y Cierres tienen listados globales de lectura con paginación y enlaces a evidencias o dispositivos. Los controles operativos de escenarios se reservan al coordinador.
- Se conserva la matriz de acciones operativas: el permiso de consultar no equivale a evaluar equipos, despachar, confirmar entregas ni crear tratamientos.
- Nuevos endpoints GET /consultas/recepciones, /consultas/tratamientos y /consultas/cierres, exclusivos de ADMINISTRADOR. Las tablas y columnas se seleccionan desde una lista fija.

## Datos cargados

14 dispositivos, 12 lotes/solicitudes, 11 recepciones, 10 evaluaciones, 5 movimientos, 2 tratamientos, 1 asignación pendiente, 1 cierre, 3 centros, 3 conexiones, 6 PDF válidos y 1 escenario con dos ejecuciones. Se calcularon indicadores y se evaluaron alertas. Los datos se identifican como PRUEBA FRONT o Prueba frontend y pertenecen a la organización de adm1. Se emplearon gen1, op1, tec1, coo1 y rea1 para ejecutar las acciones con sus permisos existentes.

Consulta DATOS_PRUEBA_ADM1.md para los IDs de evidencias y equipos. La carga se conserva en backend/.datos-front.json, excluido de Git, y no repite pasos ya completados. No borrar ese manifiesto para volver a ejecutar sobre la misma base.

## Verificación

- 132 pruebas unitarias y 1 prueba de integración de consultas globales aprobadas (133 en total). La prueba de alcance usa una organización ajena para comprobar el acceso de administrador y el rechazo del coordinador; no crea registros.
- 14 pruebas del frontend aprobadas; compilación Vite correcta.
- 20 consultas HTTP reales con adm1 respondieron 200; cinco consultas administrativas con gen1 respondieron 403.
- Los seis PDF se consultaron y descargaron con adm1, comparando el contenido con el original.
- Segunda ejecución de la carga completada sin repetir creaciones.
- No se repitió la suite de integración general que crea registros ajenos a esta carga controlada.
- Navegador deshabilitado en la configuración del entorno: pendiente la inspección visual final de los nuevos listados. Frontend y backend permanecen activos. Persiste la advertencia de tamaño del paquete Three.js.
