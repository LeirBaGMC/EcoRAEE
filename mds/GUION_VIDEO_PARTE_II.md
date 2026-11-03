# Guion y pasos del video — EcoRAEE Cloud, Parte II

Equipo: **Katty — frontend; Gabriel — backend; Katalina — base de datos e integración**.

Duración objetivo: **4:40**, con 20 segundos de margen hasta el límite de 5:00. Katty tiene aproximadamente 1:10; Gabriel, 1:50; Katalina, 1:40. Son tres intervenciones continuas: cada persona habla una sola vez mientras realiza sus acciones. Estos tiempos requieren un ensayo con cronómetro.

## Regla para las instalaciones independientes

Cada integrante utiliza su propia instalación local. GitHub comparte el código, no los registros de SQL Server. Los dispositivos, IDs, categorías y conexiones de una laptop no se dan por existentes en otra.

- Katty registra `VIDEO-KATTY-001` en su frontend.
- Gabriel registra `VIDEO-GABRIEL-001` mediante su Swagger.
- Katalina registra `VIDEO-KATALINA-001` en su frontend y consulta esa misma serie en su SQL Server. Ella muestra la integración completa dentro de su propia laptop.

No presentar estos tres equipos como un mismo registro compartido. Si una serie ya existe por un ensayo, cambiar su sufijo a 002 o 003 en todas las acciones de esa persona y, para Katalina, también en el SQL.

## Preparación fuera de la grabación

1. Comprobar frontend, backend y SQL Server de cada instalación que se vaya a utilizar. Direcciones habituales: frontend `http://localhost:5173`, Swagger `http://localhost:8000/docs`, base `ecoraee_cloud`.
2. Usar una cuenta de prueba con los permisos necesarios. Si está creada `auditor1`, las instrucciones están en CUENTA_AUDITORIA_TEMPORAL.md. La cuenta debe existir en cada base; no recrearla si ya existe.
3. Gabriel deja Swagger autorizado: POST /auth/login, copiar access_token, Authorize y pegar solo el token. Mantener fuera de la grabación la preparación de la sesión.
4. Gabriel consulta GET /catalogos y confirma el ID de LAPTOP en su base. El JSON de abajo usa 1 como ejemplo: reemplazarlo si el catálogo local utiliza otro número.
5. Preparar los formularios de Katty y Katalina con Individual, LAPTOP, Enciende, marca PRUEBA VIDEO y modelo Demo local. Cada una usa su propia serie nueva. No pulsar Registrar hasta la grabación.
6. Katalina localiza una conexión **de prueba** en su propia página Centros y conexiones. Anota su ID y su capacidad actual. Prepara una capacidad superior válida; por ejemplo, 10 si actualmente es 3. Si ya vale 10, elegir otro valor superior.
7. En la laptop de Katalina, abrir consultas_video_parte_ii.sql en SSMS, comprobar la instancia y ajustar @Serie y @Conexion al caso local. Dejar también preparada la página de la conexión que va a editar.
8. Si Gabriel va a demostrar la baja lógica, elegir antes un movimiento **de prueba que ya no se necesite**, PROGRAMADO o AUTORIZADO, de su propia instalación. Anotar su ID y preparar POST /movimientos/{id_movimiento}/anular. No anular movimientos reales ni usar un ID de otra laptop. Si no hay un caso preparado, omitir este paso y su frase del diálogo.

## Katty — presentación y frontend, aproximadamente 1:10

### Qué hacer en pantalla

1. Mostrar brevemente Inicio y la dirección localhost.
2. Ir a Dispositivos → Registrar dispositivo y usar la serie VIDEO-KATTY-001. Registrar el equipo una sola vez.
3. Abrir el enlace del dispositivo creado y mostrar código, datos e historial.
4. Recargar el detalle y comprobar que conserva los datos. Señalar brevemente el menú de módulos.

### Diálogo continuo

> Somos Katty, Gabriel y Katalina. Presentamos EcoRAEE Cloud, una aplicación para gestionar la trazabilidad de residuos electrónicos. En esta etapa, todos los componentes se ejecutan localmente y cada demostración utiliza los datos de su propia instalación.
>
> Mi aporte fue el frontend, desarrollado con React y Vite. Organicé las pantallas, los formularios y la navegación según los roles de cada usuario.
>
> Aquí registro un equipo individual con su categoría, condición y número de serie. Al guardar, la aplicación devuelve un código de trazabilidad y permite consultar su detalle e historial.
>
> Al recargar, los datos se mantienen. El menú también permite acceder a los procesos de solicitudes, recepciones, movimientos y destino final, según los permisos de la cuenta.

## Gabriel — backend mediante Swagger, aproximadamente 1:50

### Qué hacer en pantalla

1. Abrir POST /dispositivos → Try it out. Pegar este JSON, con la categoría verificada en su base, y pulsar Execute:

```json
{
  "tipo_registro": "INDIVIDUAL",
  "id_categoria": 1,
  "condicion_declarada": "ENCIENDE",
  "numero_serie": "",
  "marca": "PRUEBA VIDEO",
  "modelo": "Demo local"
}
```

Mostrar **422** y el mensaje de número de serie obligatorio. Este intento no crea el dispositivo.

2. En el mismo JSON, cambiar numero_serie por **VIDEO-GABRIEL-001**, ejecutar y mostrar **201**, id_dispositivo y codigo_trazabilidad. Copiar el ID real.
3. Repetir exactamente esa petición: mostrar **409**, serie ya registrada. No se crea un segundo equipo.
4. Abrir POST /lotes → Try it out. Pegar lo siguiente **reemplazando 150 por el ID real obtenido en el paso 2**:

```json
{
  "ids_dispositivos": [150]
}
```

Ejecutar y mostrar **201**, id_lote y total_dispositivos = 1. Se crea el lote y su vínculo con el equipo existente; no se crea otro dispositivo. Anotar el ID del lote.

5. Abrir GET /lotes/{id_lote}, introducir el ID recién recibido, ejecutar y mostrar **200** y el dispositivo asociado. Si se repite POST /lotes con ese mismo equipo, el error es 422, no 409.
6. Solo con el caso de baja preparado: ejecutar POST /movimientos/{id_movimiento}/anular con su ID de prueba y comprobar **200** y estado_movimiento = ANULADO. No usar el dispositivo recién creado como id_movimiento: son entidades e identificadores distintos.

### Diálogo continuo

> Mi aporte fue el backend, implementado con FastAPI y conectado a SQL Server. Swagger muestra los endpoints con los que la interfaz se comunica con la API. Para esta prueba utilizo los datos de mi instalación local.
>
> Primero envío un equipo individual sin número de serie. El backend lo rechaza con un error 422 y explica qué dato falta. Al completar la serie, devuelve 201, junto con el identificador y el código del equipo creado.
>
> Si repito el registro, recibo 409 porque la serie ya existe. Así mostramos validación de datos y manejo de errores.
>
> Después utilizo el identificador para crear un lote. El backend comprueba el dispositivo y guarda la relación en lote_dispositivo dentro de una transacción. Al consultar el lote, aparece el equipo asociado.

**Solo si se ejecutó el paso 6, continuar sin cambiar de turno:**

> Finalmente anulo este movimiento de prueba. Es una baja lógica: conserva el registro y su historial para mantener la trazabilidad.

## Katalina — base de datos e integración, aproximadamente 1:40

### Qué hacer en pantalla

1. En SSMS, mostrar la instancia local y ecoraee_cloud → Tablas. Dejar visibles dispositivo, dispositivo_individual y categoria_dispositivo.
2. Cambiar a **su propio frontend** y registrar el equipo preparado con serie VIDEO-KATALINA-001. Mostrar el código generado y recargar su detalle para comprobar que persiste.
3. Abrir Centros y conexiones → Listado de conexiones. Localizar la conexión de prueba preparada en **su base**, pulsar Editar capacidad, introducir el nuevo valor y Guardar capacidad. Mostrar el valor actualizado. No es necesario crear un centro o una conexión durante la grabación.
4. Volver a SSMS y ejecutar **todo** consultas_video_parte_ii.sql con F5, sin seleccionar un SELECT aislado. @Serie debe ser VIDEO-KATALINA-001 o el sufijo realmente usado; @Conexion debe ser el ID de la conexión editada en su laptop.
5. Mostrar las cuadrículas en orden: equipo con la misma serie/código y su categoría; capacidad coincidente con la interfaz; cuatro restricciones de ejemplo; conteo de la serie igual a 1. La consulta relaciona tablas de su base, no datos de Katty o Gabriel.
6. En las restricciones, señalar PRIMARY_KEY_CONSTRAINT, FOREIGN_KEY_CONSTRAINT, UNIQUE_CONSTRAINT y CHECK_CONSTRAINT. Explicar una función de cada una; no leer todos los nombres técnicos.

### Diálogo continuo

> Mi aporte fue la base de datos, implementada en SQL Server local. Organicé las tablas, las claves primarias y foráneas, las relaciones y las restricciones de integridad.
>
> Para mostrar la integración, registro un equipo desde el frontend de mi propia laptop y recargo su detalle. Después actualizo la capacidad de una conexión de prueba desde la aplicación.
>
> Ahora consulto SQL Server. Aquí aparece la misma serie y el mismo código del equipo, relacionado con su categoría. Esta otra consulta muestra la capacidad que acabamos de actualizar. Así comprobamos que el frontend se comunica con el backend y que los cambios se guardan en la base de datos.
>
> Las claves identifican los registros y sus relaciones; las restricciones impiden series duplicadas y valores fuera de los permitidos. También utilizamos información ficticia para probar los procesos.
>
> Con esto mostramos EcoRAEE Cloud integrado y funcionando localmente, como base para una futura etapa en AWS.

## Alcance y comprobación antes de entregar

- La creación se demuestra en frontend y Swagger, la consulta en API y SQL, y la actualización desde la interfaz y su consulta SQL posterior.
- La anulación opcional demuestra una baja lógica. No hay un endpoint DELETE para eliminar físicamente dispositivos o lotes; no presentar la anulación como un DELETE físico.
- Los resultados 201/409/422 descritos son los esperados por el código revisado. Solo afirmar en el video los que se obtengan al ejecutar la demostración en cada laptop.
- El SQL adjunto es de solo lectura. No recrear tablas ni volver a ejecutar el esquema completo durante el video.
- Ensayar el recorrido entero hablando mientras se hacen los clics. Si falta tiempo, retirar la baja opcional y su frase, reducir el recorrido del menú y mostrar solo las cuadrículas necesarias. Mantener la integración de Katalina y la intervención de los tres integrantes.
- No anunciar 4:40 como duración garantizada: comprobar que el MP4 final no supere 5:00, incluyendo cambios de integrante y transiciones.
- Cada integrante adapta «mi aporte» al trabajo que realmente realizó. La instalación local y los datos de los otros equipos no se dan por verificados desde esta laptop.
