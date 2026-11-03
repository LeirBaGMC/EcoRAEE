# Correcciones implementadas después de la auditoría

Fecha: 2 de noviembre de 2026. Este documento describe el estado actual; los otros informes conservan el recorrido y los hallazgos originales.

## Qué cambió

| Área | Corrección |
| --- | --- |
| Nueva solicitud | Dispositivos en lista vertical también en escritorio, con nombre y código separados, fila seleccionable, resaltado, búsqueda y orden por código. Se conserva la selección al filtrar. |
| Selectores y listados | Las opciones de entidades se ordenan por nombre y tienen búsqueda cuando son numerosas. La selección actual se conserva aunque no coincida con el filtro. Centros/conexiones y escenarios tienen búsqueda propia; usuarios y organizaciones se ordenan de forma estable. Estados y tipos mantienen su orden de proceso. |
| Recolecciones | El listado devuelve fecha programada y ejecutada. Las ejecutadas muestran «Recolectado» sin botón para repetir. Las futuras explican cuándo estará disponible la acción. La tabla distingue la fecha de solicitud de la de recolección. |
| Filtros de solicitudes | Se usa ATENDIDA, que es el estado real del backend, en lugar de RECIBIDA. Las solicitudes se ordenan por fecha e ID descendentes. |
| Recepción | Carga todas las páginas y ofrece entregas directas o recolecciones ya ejecutadas. Solicitudes y centros se pueden buscar; los centros incluyen su código. El mensaje distingue registros trazables de unidades físicas de un granel. Se conservan las reglas existentes de medidas no negativas. |
| Detalle del dispositivo | Muestra categoría, serie o peso/cantidad, última evaluación con clasificación/diagnóstico/fecha y último tratamiento con resultado/fechas. En tránsito explica que la ubicación conserva el origen hasta la recepción. |
| Acciones de dispositivo | La clasificación controla si se ofrece asignar a una beneficiaria. El cierre tiene una explicación de requisitos y un enlace para revisarlos. |
| Formularios | Validación de serie y peso/cantidad del granel; ayuda cuando faltan requisitos para habilitar botones. Los botones ocupados permanecen deshabilitados aunque el componente reciba disabled=false. |
| Series | El límite de API e interfaz coincide con los 60 caracteres de SQL Server. Una serie de 61 caracteres devuelve 422 antes de insertar. |
| Movimientos | Nombres de centros y responsable, identificación de equipos y cantidad con unidad. En UND, un individual cuenta como 1 y un granel por sus unidades físicas. La ayuda para cierre se adapta al rol: el operador despacha/adjunta y el coordinador cierra. |
| Tratamientos | Nuevo listado paginado con botón para abrir. Inicio/finalización devuelven fechas completas; finalizar recarga el listado y el selector. Se explica el resultado fallido y la posibilidad de otro intento compatible. |
| Asignaciones | Las beneficiarias se distinguen por nombre, RUC e ID. Se cargan todas sus páginas. Los equipos no asignables se excluyen del selector. Confirmar se ofrece solo al rol beneficiaria y para su propia organización. El administrador ve el alcance global correctamente identificado. |
| Enlaces de beneficiaria | El listado muestra la identificación del equipo sin llevar a una pantalla de dispositivos para la que no tiene permiso. No se amplió su acceso global. |
| Cierre de trazabilidad | Revisión previa del dispositivo, cierre existente, tratamiento/asignación y fecha. El botón se habilita solo después de revisar. Cambiar datos invalida la revisión; un cierre exitoso no se puede repetir desde el mismo formulario. El servidor conserva la decisión final. |
| Capacidad de conexiones | Administrador puede editar solo la capacidad, conservando ruta y unidad. Se valida con el mismo bloqueo que programar; no baja bajo el máximo comprometido mensual registrado y se audita. La interfaz permite cancelar sin guardar. |
| Errores y acceso | No se repite la misma ayuda que el mensaje del servidor. Las rutas operativas de alta comprueban el rol antes de cargar datos y muestran «Sin acceso» con salida a Inicio. Un 403 de lectura no ofrece un reintento inútil. |
| Panel de inicio | Textos según rol: la beneficiaria recibe, el operador despacha y el coordinador programa/autoriza/cierra. No aparece un bloque vacío de herramientas si solo hay un acceso. |
| Grafo | Tamaño legible, etiquetas a 14 px, nombres en varias líneas, desplazamiento interno y zoom 100–200 %. Se corrigió el color de la fuente que referenciaba variables inexistentes. |
| Escenarios | Centros ordenados y buscables; papel/oferta/demanda con campos táctiles. Confirmación visible de ejecución, algoritmo y valor. Se explica que ambos algoritmos deben coincidir en el máximo y que cada cálculo guarda una ejecución. |
| Menú móvil | Fondo inactivo, foco contenido y desplazamiento de la página bloqueado mientras está abierto; cierre por Escape/botón/velo, devolución del foco y restauración de scroll. |
| Presentación móvil | Controles de escenario de 44 px y fecha de recolección de unos 44,4 px. Barras de desplazamiento visibles, ajuste de palabras largas y acciones/detalles de tarjetas con espacio completo. |
| Documentación | Se respetó la carpeta mds elegida por el usuario y se actualizaron referencias y el contrato de los endpoints nuevos. |

## Pruebas finales

| Comprobación | Resultado |
| --- | --- |
| Frontend: npm test | 40 aprobadas |
| Frontend: npm run build | Correcto; persiste el aviso de tamaño de Three.js |
| Backend: pytest tests más consultas de administrador y capacidad con rollback | 155 aprobadas y 5 subpruebas aprobadas |
| API real con SQL Server | Campos de dispositivo/movimiento, fechas de recolección, listado de tratamientos y alcance de asignaciones comprobados |
| Capacidad por HTTP | Mismo valor aceptado; reducción bajo reservas rechazada con 422; coordinador sin gestión de red rechazado con 403 |
| Edición y auditoría reales | Cambio comprobado en una transacción externa, revertido; capacidad y cantidad de auditorías originales verificadas después |
| Serie larga por HTTP | 422 con CORS; el intento anterior de truncamiento se revirtió y no dejó un padre ni individuales huérfanos |
| Navegador | Revisión móvil a 360/390 px y escritorio a 1440 px; lista vertical, menú, grafo, controles, cierre y asignaciones verificados |

Comandos reproducibles:

```powershell
# Desde frontend
npm test
npm run build

# Desde backend
.\.venv-windows\Scripts\python.exe -m pytest tests tests_integracion/test_admin_consultas.py tests_integracion/test_capacidad_rollback.py -q
```

Se ejecutaron integraciones dirigidas: no se repitió la suite completa que crea usuarios y datos permanentes. El caso de edición real de capacidad está en tests_integracion/test_capacidad_rollback.py. No se probaron carreras simultáneas nuevas de edición/programación; se conserva el bloqueo compartido y hay regresiones del orden de bloqueo/validación/escritura.

## Verificación en navegador

- Escritorio: las tres opciones de Nueva solicitud ocupan filas separadas de unos 1038 px. El documento y su área visible miden 1425 px, sin desbordamiento horizontal.
- Móvil: el grafo conserva 720 px dentro de una ventana desplazable y pasa a 900 px al ampliar al 125 %. El documento mantiene el mismo ancho que el área visible; las etiquetas ya no se reducen a unos 6,6 px.
- Los controles papel/oferta de escenario miden 44 px, con letra de 16 px. La fecha de recolección mide unos 44,4 px.
- Menú: Tab permanece dentro, PageDown desplaza el panel sin mover el fondo, Escape devuelve el foco al botón Abrir menú y restituye el desplazamiento.
- Cierres: la revisión de #128 con tratamiento #13 FALLIDO mantiene deshabilitado el cierre; cambiar a #14 obliga a revisar de nuevo y la revisión válida habilita el botón. No se envió otro cierre.
- Capacidad: se buscó la conexión #42, se abrió su editor con 3.00 UND y se canceló; conserva la capacidad original.
- adm1 al abrir /#/movimientos/nuevo ve «Sin acceso», con Volver a Inicio y sin formulario.
- La beneficiaria ve código/nombre del equipo y RUC de la entidad en Asignaciones, sin enlaces restringidos a Dispositivos.

La emulación de tamaño no sustituye un teléfono físico, teclado virtual o pruebas con TalkBack/VoiceOver. Las acciones de escritura de los flujos corregidos se cubren con regresiones simuladas; la revisión de navegador usó consultas y operaciones locales de formulario, sin enviar nuevas operaciones de negocio.

## Decisiones y fases que continúan pendientes

- Validar con el grupo transiciones, matriz de permisos, compatibilidad de tratamientos y periodo de capacidad. Se conserva la conducta actual tras FALLIDO; se mejoró su explicación y consulta.
- La edición de capacidad usa una validación conservadora que incluye compromisos históricos y movimientos cerrados. Versionar capacidades por periodo requeriría una decisión y cambios de esquema.
- Las brechas de esquema documentadas siguen: autor/organización del escenario, fecha planificada separada, columna de huella y auditoría persistente de lectura de evidencias. Los metadatos completos de una ejecución guardada siguen dependiendo de lo persistido en su versión.
- S3, Cognito, nube, carga sostenida y revisión de dependencias son fases separadas; no se declaran verificadas aquí.
- La cuenta temporal auditor1 sigue disponible para comprobar las correcciones. Su retirada queda pendiente de dar por terminadas las auditorías; debe preservarse la trazabilidad de las acciones ya realizadas.

Los servidores se verificaron accesibles al finalizar. La publicación del código conserva la cuenta temporal y sus instrucciones de preparación; excluye los registros de la base local, los documentos cargados y la configuración privada.
