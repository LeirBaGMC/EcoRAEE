# Correcciones y pruebas — 2 de noviembre de 2026

## Estado actualizado tras las correcciones

Los fallos confirmados de esta auditoría ya tienen correcciones y regresiones. El detalle actual, las pruebas y las decisiones que siguen pendientes están en [CORRECCIONES_IMPLEMENTADAS.md](C:/Users/Pandora/Desktop/ECORAEE/mds/CORRECCIONES_IMPLEMENTADAS.md). Las anotaciones siguientes conservan la secuencia original de hallazgos; «pendiente» describe el momento en que se registró cada observación, salvo las decisiones indicadas en el informe actual.

## Revisión móvil realizada por el asistente

- Se revisó la aplicación en navegador a 360 y 390 píxeles, con comparación del grafo en escritorio. Informe: [AUDITORIA_MOVIL.md](C:/Users/Pandora/Desktop/ECORAEE/mds/AUDITORIA_MOVIL.md).
- No se observó desbordamiento horizontal general en las pantallas del recorrido. Se confirmaron tres mejoras pendientes: grafo demasiado reducido en móvil, controles pequeños de escenario/fecha de recolección y falta de aislamiento de foco/desplazamiento del fondo al abrir el menú.
- Fue una revisión con medidas y capturas de navegador; no una prueba en teléfono físico. No se modificó código de aplicación ni se enviaron operaciones de negocio.

## Auditoría manual de Dispositivos

Resultados comunicados por el usuario durante el recorrido, sin una nueva inspección automatizada del navegador:

- El filtro «En tránsito» muestra los dos dispositivos de prueba esperados.
- Una evaluación del dispositivo `DSP-40B59AD64203` se guardó como Reutilizable y actualizó su estado a Evaluado y su historial.
- Un registro a granel con peso/cantidad inválidos se rechazó con 422; se creó correctamente `DSP-455787265336` al completar los datos válidos.
- Un individual sin número de serie se rechazó con 422; se creó `DSP-EF6DEBB2EBDE` con una serie válida.
- Después de la corrección, el usuario confirmó en pantalla el 409 «Ya existe un dispositivo registrado con ese número de serie» al repetir el registro. Caso de duplicado verificado también manualmente.

### Mejoras pendientes identificadas en el recorrido

- Mostrar categoría, peso y cantidad en el detalle de registros a granel.
- Mostrar la clasificación y el diagnóstico de la evaluación guardada en el detalle.
- Explicar qué significa «Centro actual» cuando el dispositivo está en tránsito.
- Explicar los requisitos de «Cerrar trazabilidad» antes de ofrecer esa acción como siguiente paso.
- Mejorar la validación junto a los campos de peso y cantidad para evitar enviar valores inválidos. El backend ya los rechaza.

Estos puntos son pendientes de mejora; no se consideran corregidos por la solución de series duplicadas.

## Auditoría manual de Lotes y solicitudes

### Asignaciones: identificación de beneficiarias (pendiente)

- Cierre posterior verificado: con coo1, cerrar el dispositivo #134 mediante asignación #10 ya entregada creó el cierre #18, destino ASIGNACION_BENEFICIARIO, fecha 2026-11-02, y la respuesta informó cierre del lote #87. El detalle del dispositivo confirmó estado CERRADO y muestra cierre #18 con el mismo destino y fecha. Se probó tanto el rechazo anterior a confirmar entrega como la aceptación posterior. La confirmación del lote se observó en la respuesta, sin una consulta independiente de su detalle.

- Resultado posterior: con la cuenta destinataria ben_15ef7b, el listado mostró únicamente las asignaciones #10 y #1. Confirmar la entrega de #10 pasó de Pendiente a Entregada (02/nov/2026) y retiró el botón. Se verifica manualmente la confirmación con la organización correcta; el intento previo con auditor1 de organización #1 había sido rechazado. No se registró aún el cierre de trazabilidad de #134 en este punto.

- Con ben_15ef7b, el menú muestra Inicio y Asignaciones. Al abrir el enlace del dispositivo #134 desde el recorrido de asignaciones, la ruta /#/dispositivos/134 presenta «Sin acceso»: la beneficiaria no está habilitada para esa pantalla. Mejora pendiente: evitar enlaces hacia pantallas inaccesibles y mostrar datos identificativos del equipo en la asignación, o definir una consulta limitada a equipos asignados a la propia entidad. No ampliar el acceso general a dispositivos para sortear esta restricción. La confirmación de entrega con la cuenta destinataria sigue pendiente en este punto.

- Preparación del recorrido con beneficiaria: consulta de solo lectura confirmó que la asignación #10 sigue pendiente y pertenece a la organización #3. Se localizó la cuenta existente y activa ben_15ef7b con rol ENTIDAD_BENEFICIARIA de esa organización y se comprobó la clave de pruebas. No se creó ni modificó ninguna cuenta.

- Confirmación #10 rechazada con 404: consulta SQL verificó organización destinataria #3, auditor1 pertenece a #1 y fecha_entrega sigue NULL. El backend exige pertenecer a la destinataria incluso con todos los roles. El frontend solo comprueba el rol beneficiario y muestra indebidamente Confirmar en filas ajenas del listado global. Pendiente condicionar la acción por organización y corregir el encabezado «Equipos asignados a tu organización» cuando la consulta sea global. No se modificaron permisos ni datos para eludir la restricción.

- El selector muestra once opciones con el mismo texto «Escuela de prueba», sin RUC, ciudad ni ID. No permite identificar con seguridad la organización destinataria. Mostrar nombre y un identificador distintivo, con búsqueda y orden estable. No se ha creado la asignación del dispositivo #127 en este recorrido.
- Recorrido previo confirmado por el usuario: movimiento #53 cerrado, evidencia #20 consultada y PDF abierto; dispositivo #127 trasladado a Prueba frontend - Reacondicionamiento. Tratamiento #12 finalizado Exitoso y dispositivo Reacondicionado con historial. La fecha de inicio se mostró vacía inicialmente y apareció después de finalizar: revisar la actualización de datos tras iniciar.

### Movimientos y capacidad: hallazgos pendientes

- Al intentar autorizar el movimiento #53, el usuario recibió un error de conexión. Comprobación local: puerto 8000 rechazaba conexiones y no había proceso Uvicorn; SQL Server conservaba PROGRAMADO. Se levantó el backend y se verificaron health 200 y preflight CORS 200 para la autorización desde localhost:5173. No se ejecutó la autorización en nombre del usuario; queda pendiente repetirla manualmente. Los logs revisados no permiten determinar por qué se detuvo el proceso anterior.

- Granel DSP-455787265336: recepción #85 y evaluación Reciclable confirmadas por el usuario; el detalle muestra Recibido y luego Evaluado con su historial.
- La conexión #42 tiene 3 UND por periodo. Programar el granel de 10 unidades devuelve 422 «Solicitado 10 supera el disponible 3.00»: rechazo correcto. El texto del frontend «1 por dispositivo» es incorrecto para granel y debe explicar el conteo de unidades físicas.
- El detalle sigue ofreciendo «Asignar a beneficiario» para el granel Reciclable: revisar disponibilidad y explicación de acciones según clasificación. En este recorrido no se probó enviar esa asignación.
- Revisión del código: conexiones solo tiene GET y POST; no hay endpoint para editar capacidad ni acción de edición en la tabla presentada. Incorporar gestión de capacidad con validación de reservas existentes y auditoría es una mejora pendiente. No se modificó la conexión #42 ni se crearon rutas alternativas para sortear el rechazo.

### Criterio general de UX: orden de listas (pendiente)

- Alcance confirmado por el usuario: todas las listas de la aplicación, incluidos selectores, listas de casillas y tablas. En Programar movimiento, ordenar conexiones por origen/destino y los dispositivos por un identificador visible estable; acompañar las listas largas con búsqueda. Este requisito sigue pendiente de implementación.

- Ordenar todas las listas con un criterio visible y apropiado: catálogos y centros por nombre; solicitudes y registros por fecha, más recientes primero, con desempate estable. Evitar depender del orden incidental de la base de datos.
- Incorporar búsqueda en selectores largos, especialmente Solicitud y Centro que recibe en Recepción en centro. Permitir localizar por código o nombre/zona.
- La observación proviene del recorrido manual: el usuario tuvo dificultad para encontrar la solicitud #88 y el centro PRUEBA-UI-1 entre numerosos registros de prueba. No se ha implementado todavía esta mejora.

- Creación y programación confirmadas por el usuario: solicitud #87 / lote #88, dispositivo individual, programada para el 3 de noviembre. Intentar recolectarla el día 2 devuelve 422 por fecha futura, como corresponde.
- Solicitud #88 / lote #89, granel, programada para el día 2: el usuario recibió 409 «La recolección ya se ejecutó» mientras seguía visible «Marcar recolectado». Revisión de código: ejecutar guarda fecha_ejecucion y mantiene PROGRAMADA; el listado no devuelve esa fecha y el frontend ofrece el botón para toda solicitud PROGRAMADA. Pendiente mostrar la recolección realizada y retirar el botón cuando ya se ejecutó; el 409 protege contra repetirla.
- Pendiente mostrar fecha programada y distinguirla de fecha de solicitud.
- El filtro ofrece RECIBIDA aunque la recepción guarda ATENDIDA. Corregir las opciones para que correspondan a los estados reales. No asumir que un listado vacío significa que faltan registros.

- Mejora UX acordada, pendiente de implementar: en «Nueva solicitud», reemplazar la distribución horizontal de dispositivos por una lista vertical con un equipo por fila. Mostrar el nombre o tipo del equipo y debajo su código; permitir seleccionar desde toda la fila y resaltar la selección. Mantener Modalidad y Zona referencial debajo como están. Alcance limitado a este selector.
- La creación de la solicitud #87 fue confirmada posteriormente por el usuario, como consta en los resultados anteriores.

## Auditoría manual de Usuarios y Organizaciones

### Acceso con adm1: entrada directa a ruta operativa

- La captura del usuario confirma el menú administrativo base de adm1, sin herramientas operativas.
- Al entrar directamente a /#/movimientos/nuevo, la consulta de dispositivos devuelve 403 «No tienes permiso para: dispositivo:ver». La pantalla muestra el título Programar movimiento, la alerta y Reintentar; el formulario no se muestra. Esto verifica el rechazo de esa consulta, no una prueba de envío de movimiento.
- Mejora pendiente: comprobar el permiso de la ruta antes de solicitar datos y presentar «Sin acceso» con una salida a Inicio. Evitar Reintentar ante una denegación persistente de permisos y mensajes que sugieren al propio administrador consultar a un administrador.

Resultados reportados por el usuario en el navegador; no constituyen una nueva ejecución de pruebas automatizadas:

- Usuarios: buscar auditor1 devuelve una cuenta; filtrar Inactivos la excluye y combinar Activos con Técnico evaluador la incluye. Editar roles precarga los siete roles; Cancelar conserva la selección original. El formulario vacío mantiene deshabilitada la creación. No se crearon cuentas ni se cambiaron roles durante estas comprobaciones.
- Organizaciones: buscar el RUC 0931356566376 identifica una escuela; buscar Escuela de prueba devuelve once y buscar un texto inexistente muestra «Ninguna organización coincide con la búsqueda».
- Los campos del formulario de organización permiten escribir: la captura posterior confirmó texto en Nombre. No se confirmó un bloqueo general de campos. El envío vacío está deshabilitado y el RUC de tres dígitos muestra el aviso de que requiere trece.
- Enviar una organización con el RUC existente 0999999999001 devolvió 409 «Ya existe una organización con ese RUC». Protección frente a duplicado confirmada por el usuario.
- Mejora pendiente: evitar repetir el mensaje de RUC duplicado en la misma alerta. Revisar el uso de ayudas genéricas junto con mensajes del backend para que aporten información diferente.
- Mejora pendiente: explicar los requisitos que faltan cuando un botón de creación permanece deshabilitado.

## Resultados posteriores de la auditoría manual

### Evidencia del cierre #18

- Con coo1, el enlace /#/evidencias?destino=id_cierre&id=18 preseleccionó Cierre de trazabilidad y número 18; la captura del usuario confirmó ambos valores.
- Consultar con propósito Auditoría antes de adjuntar archivos mostró «No hay evidencias para este registro».
- Subir un PDF de prueba como ACTA_ENTREGA creó la evidencia #21. El usuario confirmó su consulta y apertura del mismo PDF. Esta comprobación corresponde al almacenamiento local de desarrollo; no verifica S3.
- Las comprobaciones de vista móvil siguen pendientes en este punto.

### Tratamiento fallido #13: resultado confirmado y claridad pendiente

- Actualización posterior: el usuario inició el nuevo intento #14 para el mismo dispositivo #128 y lo finalizó EXITOSO con rea1. El detalle confirma REACONDICIONADO y el historial «Tratamiento 14 EXITOSO», usuario #6. La recuperación por un nuevo tratamiento quedó verificada manualmente.
- Al volver a Tratamientos, el usuario confirmó que #128 ya no aparece en el selector. El problema observado es la falta de actualización inmediata tras finalizar, no la persistencia del estado del dispositivo.
- Mejora pendiente: refrescar el selector de dispositivos al finalizar un tratamiento. Tras finalizar #14, el detalle del tratamiento mostró Exitoso pero el selector conservó «DSP-7FFE374A720F - En tratamiento»; el detalle del dispositivo ya devolvía Reacondicionado. En Destino.jsx, la finalización vuelve a consultar el tratamiento pero no recarga la lista disp.

- Con rea1, consultar el tratamiento #12 devolvió Exitoso con sus fechas y sin botones de finalización. Iniciar REACONDICIONAMIENTO para el granel Reciclable #135 devolvió 422 por incompatibilidad. Iniciar un reacondicionamiento válido para #128 creó el tratamiento #13, posteriormente finalizado FALLIDO con fecha de inicio y fin.
- Tras el fallo, el dispositivo #128 conserva EN_TRATAMIENTO y su historial de estados termina en el inicio del tratamiento #13. No confundir este historial de estados con la auditoría técnica del tratamiento.
- Revisión de código: domain/ciclo.estado_tras_tratamiento solo cambia el estado del dispositivo ante REACONDICIONAMIENTO EXITOSO. Con FALLIDO no hay transición; services/ciclo_service sí guarda el resultado y la auditoría UPDATE. La regla de inicio acepta EN_TRATAMIENTO y solo bloquea si existe otro tratamiento EN_CURSO: existe una vía para un nuevo intento, por lo que no se demuestra bloqueo permanente. No se creó un tratamiento adicional para probarla.
- Mejora pendiente: hacer visible en el detalle el último tratamiento y su resultado FALLIDO, explicar el siguiente paso y acordar con el grupo el estado adecuado tras un fallo, antes de modificar las transiciones. No considerar EN_TRATAMIENTO una prueba de que aún existe un tratamiento EN_CURSO.
- La fecha de inicio volvió a mostrarse vacía inmediatamente después de iniciar #13 y apareció al finalizarlo. El POST de inicio devuelve ID, tipo y resultado sin fechas; revisar cómo se carga el detalle tras la creación.

### Separación de despacho y cierre del movimiento #54

- Con op1 se despachó #54; con coo1 se consultó y abrió la guía #16 y se cerró el movimiento. El usuario confirmó Cerrado y fecha de recepción 02/nov/2026 21:40. El dispositivo #128 llegó a Prueba frontend - Reacondicionamiento y su historial registra usuario #3 en despacho y #5 en cierre. La autorización previa pertenecía a los datos de prueba; este recorrido no la repitió.

Estos resultados proceden de las pantallas y mensajes compartidos por el usuario; no sustituyen pruebas de todas las rutas o permisos de la API.

- Con adm1, Evidencias permite consultar la guía #20 del movimiento #53 y abrir el mismo PDF; no ofrece el formulario de subida.
- Con tec1, el menú muestra Dispositivos y Evidencias; el dispositivo #135 ofrece evaluación técnica y el #130, En tránsito, oculta el formulario. Comprobación visual, sin guardar una nueva evaluación con esta cuenta.
- Con op1, el movimiento #54 Autorizado ofreció Despachar y pasó a En tránsito al ejecutarlo. La captura posterior no muestra consulta de evidencias ni cierre: coincide con la matriz actual, donde Operador puede subir evidencias y despachar, pero no tiene evidencia:ver ni movimiento:cerrar. La indicación del asistente de consultar y cerrar con op1 fue incorrecta; continuar esas pruebas con Coordinador. Pendiente adaptar el aviso de cierre al rol, porque actualmente menciona una acción que op1 no puede realizar.
- Con gen1, el menú muestra Inicio, Dispositivos y Lotes y solicitudes. Entrar directamente a /#/usuarios muestra «Sin acceso». El detalle del dispositivo #135 permite consultar datos e historial sin ofrecer evaluación técnica. Lotes y solicitudes permite crear y consultar, sin Programar ni Marcar recolectado, incluso con solicitudes pendientes y programadas visibles.
- Cierres: el intento sobre dispositivo #134/asignación #10 devolvió 422 porque falta confirmar la entrega. El intento sobre dispositivo #133/tratamiento #11 devolvió 409 porque ya existe el cierre #17. No se registró un cierre nuevo en estas comprobaciones.
- Evidencias: consulta y apertura del PDF #20 confirmadas tanto en el movimiento como en el módulo general.
- Análisis de red, escenario #9: Edmonds-Karp y Ford-Fulkerson dieron flujo máximo 8 UND y corte mínimo 8 UND, con la misma huella de datos. Los clics repetidos crearon las ejecuciones #20 a #27 al esperar el usuario un resultado numérico diferente. Mejorar el aviso de ejecución completada y explicar que ambos algoritmos deben coincidir en el valor máximo. No inferir duplicación automática a partir de esas filas.
- Indicadores: recalcular actualizó seis mediciones; IND-01 pasó de 119 a 121, IND-04 de 8 a 9 e IND-06 de 13 a 14. IND-05 permaneció en 15. El historial de IND-01 conserva 121 para el día 2 y 62 para el día 1 de noviembre de 2026.
- Alertas: Buscar alertas nuevas informó cero nuevas. Marcar atendida la alerta de capacidad de conexión #41 mostró Atendida con fecha y retiró la acción. Esto no verifica que la causa esté resuelta.
- Auditoría: filtrar movimiento/53 devolvió cuatro registros; el detalle de cierre muestra EN_TRANSITO a CERRADO, usuario #167 y fecha. El INSERT de usuario/167 muestra nombre, roles y organización sin contraseña ni hash; la comprobación se limita a ese registro.

## Actualización: registro repetido de un dispositivo individual

- Problema observado: después de registrar `DSP-EF6DEBB2EBDE`, repetir la serie `AUD-IND-001` provocaba una excepción SQL sin manejar. El frontend mostraba «Sin conexión» y conservaba el mensaje de éxito anterior.
- Backend: la violación de `uq_individual_serie` ahora se convierte, después del rollback, en HTTP 409 con el mensaje «Ya existe un dispositivo registrado con ese número de serie». Otras restricciones no se ocultan como duplicados.
- Frontend: al enviar nuevamente se limpia el éxito anterior y se muestra el conflicto con una indicación para revisar el equipo existente o usar otra serie.
- Verificación real por HTTP con `auditor1`: respuesta 409 y cabecera CORS para `http://localhost:5173`. La serie conserva únicamente el dispositivo 136; el total permaneció en 121 dispositivos y no hay individuales sin su subtipo.
- Pruebas: 136 unitarias del backend y 15 del frontend aprobadas. Incluyen rollback, distinción de otras restricciones y envío exitoso seguido de conflicto sin mensaje de éxito obsoleto. Compilación Vite correcta; permanece el aviso de tamaño del paquete Three.js.
- Backend reiniciado con la corrección. No se hizo una nueva comprobación visual en navegador; queda la repetición manual del usuario. Las secciones siguientes describen comprobaciones anteriores.

## Cambios

- `frontend/src/lib/hooks.js`: la carga paginada tiene un límite de páginas calculado con el total inicial y termina si recibe una página vacía. Esto evita solicitudes indefinidas cuando se eliminan registros durante la consulta. Rechaza tamaños de página inválidos. No garantiza una instantánea consistente si se editan registros durante la carga.
- `frontend/src/landing/organismos/Secciones.jsx`: los indicadores fijos se identifican como datos ficticios de demostración. Los gráficos indican que son ejemplos y se eliminó la afirmación «verificado».
- `frontend/tests/paginacion.test.js`: cinco pruebas para carga normal, página vacía tras cambios del total, crecimiento del total, listado vacío y tamaño inválido.

## Verificación ejecutada

- Frontend: `node --test tests/paginacion.test.js`: 5 aprobadas.
- Frontend: `npm run build`: compilación correcta. Persiste la advertencia de tamaño del paquete de Three.js (753,47 kB sin gzip).
- Backend: `.venv-windows/Scripts/python.exe -m pytest tests tests_integracion -v`: 140 aprobadas, ninguna omitida, en 17,06 segundos.
- Las pruebas de integración usaron SQL Server local y TestClient: autenticación, sesión vencida, recepción/evaluación, movimientos, capacidad y concurrencia, idempotencia, tratamientos/asignaciones, trazabilidad, flujo máximo, indicadores, administración y auditoría.
- Una advertencia de obsolescencia de Starlette sobre el uso de httpx en TestClient; no causó fallos.

## Alcance

Las pruebas de integración crean registros de prueba en la base local y no los eliminan. No se modificó el código del backend. No se probó S3 real ni se realizó una nueva revisión visual en navegador. Los servidores de desarrollo permanecen detenidos; las pruebas no requieren dejar Uvicorn o Vite ejecutándose.
