# Guion del video — Integrador EcoRAEE Cloud, Parte II

Equipo: **Katty — frontend; Gabriel — backend; Katalina — base de datos**.

Duración objetivo: **4 minutos y 40 segundos**. El límite de entrega es 5 minutos incluyendo todas las intervenciones. Las acciones en pantalla se realizan mientras habla cada integrante.

## Preparación antes de grabar

- Ejecutar frontend en http://localhost:5173, API en http://localhost:8000 y SQL Server local con la base ecoraee_cloud. La aplicación y los archivos de evidencia de esta demostración son locales; no se presenta un despliegue AWS.
- Usar la cuenta temporal auditor1; sus instrucciones están en CUENTA_AUDITORIA_TEMPORAL.md. Reúne los siete roles para recorrer módulos, pero mantiene las restricciones de organización. No es un permiso para confirmar entregas de otras entidades.
- Dejar abierto el navegador y SSMS en el mismo equipo. Abrir consultas_video_parte_ii.sql en SSMS y ejecutarlo sobre la instancia local correcta.
- Preparar el formulario de registro: Individual, LAPTOP, Enciende, serie **VIDEO-RAEE-001**, marca **PRUEBA VIDEO**, modelo **Demo local**. No registrarlo antes de comenzar si se quiere mostrar la creación. Si la serie ya existe por un ensayo, cambiarla también en la consulta SQL, por ejemplo a VIDEO-RAEE-002.
- En las herramientas de desarrollo del navegador, preparar Network/Red filtrada por dispositivos. Mostrar URL, estado y respuesta; no mostrar el .env ni las cabeceras Authorization. No dedicar tiempo del video a instalar dependencias o buscar ventanas.
- Para actualizar capacidad, localizar la conexión **#42: Prueba frontend - Recoleccion → Prueba frontend - Reciclaje**. En esta instalación estaba en 3 UND al preparar el guion; comprobar su valor antes de grabar. Proponer una capacidad superior, por ejemplo 10 UND si sigue en 3.
- Para demostrar una baja lógica, identificar antes un movimiento **de prueba** Programado o Autorizado que no se vaya a utilizar. Anularlo conserva el historial y libera su reserva; no se puede repetir sobre un movimiento cerrado. Anotar su número en la variable opcional del SQL. No anular un proceso real.
- Cada integrante debe adaptar «mi aporte» al trabajo que realmente realizó. No afirmar que hay eliminación física de dispositivos: la aplicación usa anulación de movimientos y desactivación de cuentas para las bajas que corresponden.

## 0:00–0:15 — Gabriel: presentación

**Pantalla:** inicio de EcoRAEE y dirección localhost visible.

> Somos Katty, Katalina y Gabriel. Presentamos la segunda parte de EcoRAEE Cloud: una aplicación para la trazabilidad de residuos electrónicos. En esta etapa, el frontend, el backend y la base de datos funcionan en nuestro equipo local.

## 0:15–1:30 — Katty: frontend y creación

**Pantalla:** abrir Dispositivos → Registrar dispositivo; completar los datos preparados y registrar una sola vez. Mostrar el código generado y abrir el detalle. Volver al formulario con la misma serie e intentar registrar otra vez para mostrar el 409.

> Mi aporte fue el frontend, desarrollado con React y Vite. Organicé las pantallas, los formularios y la navegación según los roles de cada usuario.
>
> Para la demostración utilizamos una cuenta temporal con varios roles. Las cuentas habituales muestran solamente las herramientas que les corresponden.
>
> Aquí registro un equipo individual. Selecciono su categoría, condición y número de serie. El formulario valida los datos y envía la solicitud al backend. Al guardar, recibimos un código de trazabilidad y podemos consultar el estado y el historial del equipo.
>
> Si intento registrar nuevamente la misma serie, aparece un conflicto y no se crea otro equipo. La interfaz también permite gestionar solicitudes, recepciones, movimientos, tratamientos, asignaciones y evidencias, manteniendo la relación entre las etapas.

## 1:30–2:50 — Gabriel: API, actualización y baja lógica

**Pantalla:** en Red/Network, mostrar la petición POST a localhost:8000/dispositivos con 201 y su respuesta. Mostrar también el 409 del intento repetido. Después ir a Centros y conexiones, buscar #42, editar una capacidad superior válida y guardar. Finalmente mostrar y confirmar la anulación del movimiento de prueba previamente elegido.

> Mi aporte fue el backend, implementado con FastAPI y conectado a SQL Server. La interfaz se comunica con él mediante una API.
>
> Esta petición muestra la integración: el frontend envía los datos, la API responde con el registro creado y su código. En el intento duplicado responde con 409 y un mensaje que la interfaz puede mostrar.
>
> El backend valida los datos, los permisos, las relaciones y las reglas del proceso. Por ejemplo, controla la capacidad disponible antes de programar un traslado y exige una guía para cerrarlo.
>
> También podemos actualizar información: aquí modifico la capacidad de una conexión. El sistema comprueba las reservas y registra el cambio en auditoría. Para las bajas, este movimiento de prueba se anula conservando su historial. Así protegemos la trazabilidad.

## 2:50–4:15 — Katalina: base de datos y persistencia

**Pantalla:** SSMS, instancia local y base ecoraee_cloud. Ejecutar las consultas preparadas: equipo por la misma serie, conteo de esa serie, capacidad actualizada y movimiento anulado. Mostrar brevemente las claves/restricciones si queda tiempo.

> Mi aporte fue la base de datos, implementada en SQL Server local. Definí las tablas, las claves primarias y foráneas, las relaciones y las restricciones para conservar la integridad de la información.
>
> Por ejemplo, un dispositivo se relaciona con su categoría, sus evaluaciones y su historial. El número de serie es único, por eso no se permite guardar el mismo equipo dos veces.
>
> Ahora consulto la serie que acabamos de registrar desde la interfaz. Aquí aparece el equipo con su código y fecha. El conteo muestra un solo registro, aunque intentamos repetirlo.
>
> Esta otra consulta muestra la capacidad que actualizamos, y la siguiente conserva el movimiento con estado Anulado. Esto demuestra que las operaciones de la aplicación se reflejan en la base de datos. También incorporamos datos ficticios para probar los procesos sin depender de servicios en la nube.

## 4:15–4:35 — Katty: consulta después de recargar

**Pantalla:** volver al detalle del dispositivo recién creado y recargar. Debe conservar el mismo código y los datos. Si no se guardó el enlace, buscarlo en Dispositivos.

> Al recargar la aplicación, el equipo conserva los mismos datos y el mismo código. La información se recupera mediante la API desde SQL Server; no depende solamente de lo que estaba visible en el formulario.

## 4:35–4:40 — Gabriel: cierre

> EcoRAEE integra los tres componentes localmente y conserva la trazabilidad.

## Control del tiempo y de lo que se afirma

- Reservar los últimos 20 segundos hasta el límite de cinco minutos para demoras o transiciones. Ensayar con cronómetro; los tiempos son una pauta, no una duración garantizada de lectura.
- Hablar mientras se ejecutan las acciones. Evitar explicar cada campo o leer código en voz alta.
- Si el recorrido excede el tiempo, reducir la explicación de módulos y dejar solo la petición 201 en Network. Mantener la creación, la actualización, la consulta SQL y la intervención de cada integrante.
- Si no se llega a ejecutar la anulación, cambiar la frase por «Las bajas se manejan mediante anulación y desactivación»; no decir que se anuló algo que no se mostró.
- Mostrar una base local; GitHub sirve para compartir el código del equipo y no equivale a desplegar la aplicación o alojar su base de datos.
- Las pruebas recientes del repositorio pasaron: 40 del frontend y 155 del backend incluyendo dos integraciones dirigidas. No afirmar que se verificó AWS, S3, un teléfono físico o todas las combinaciones posibles.
- Exportar un único archivo MP4 cuya duración final sea menor o igual a 5:00. No incluir estos preparativos dentro de la grabación.
