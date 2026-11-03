# Auditoría móvil de EcoRAEE — 2 de noviembre de 2026

Actualización: los tres hallazgos confirmados de esta revisión se corrigieron y se volvieron a comprobar en navegador. Ver [CORRECCIONES_IMPLEMENTADAS.md](C:/Users/Pandora/Desktop/ECORAEE/mds/CORRECCIONES_IMPLEMENTADAS.md). El informe de abajo conserva las medidas anteriores a la corrección.

## Alcance y evidencia

Revisión realizada por el asistente en un navegador real conectado al frontend local, con la cuenta temporal auditor1. Se combinaron capturas visuales, lectura del DOM y medidas de geometría. Se usaron anchos de 360 y 390 píxeles CSS; se comparó el grafo a 1440 píxeles. Es una emulación de tamaño de pantalla, no una prueba en un teléfono físico ni del teclado virtual de iOS/Android.

Se navegaron pantallas y resultados existentes. En Nuevo escenario se seleccionó un centro y su papel únicamente en el formulario, sin enviarlo. No se crearon escenarios, ejecuciones, movimientos, tratamientos ni evidencias durante esta revisión. El tamaño temporal del navegador se restauró y se cerró la pestaña de revisión.

## Hallazgos confirmados, pendientes de corregir

### 1. Grafo poco legible en móvil — P2

- En el escenario #9, se abrió la ejecución existente #27. A 360 px, el SVG se representa con 286,4 px de ancho sobre un viewBox de 560 px. El texto nominal de 13 px se reduce aproximadamente a 6,6 px; las cajas de texto medidas tenían unos 8,8 px de alto.
- En la captura móvil las etiquetas y nombres de centros resultan difíciles de leer; algunos nombres alcanzan los extremos del dibujo. A 1440 px el grafo dispone de unos 1094,1 px de ancho y se lee mucho mejor.
- Recomendación: ofrecer ampliación y desplazamiento del grafo o una presentación específica para móvil, conservando una tabla legible como alternativa. Evitar reducir todo el dibujo hasta volver diminutas las etiquetas.
- Referencias: [Grafo.jsx](C:/Users/Pandora/Desktop/ECORAEE/frontend/src/pages/Grafo.jsx:22), [styles.css](C:/Users/Pandora/Desktop/ECORAEE/frontend/src/styles.css:174).

### 2. Algunos controles son demasiado pequeños para interacción táctil — P2

- En Nuevo escenario, a 360 px, el selector «Papel de Centro de Recoleccion Quito» mide unos 18,4 px de alto. El campo «Oferta» mide unos 21,2 px; ambos usan tipografía de 13,33 px. La captura confirma que son mucho menores que los demás campos del formulario.
- En Solicitudes, a 390 px, el campo de fecha de programación de la solicitud pendiente #75 mide unos 20,5 px de alto.
- Recomendación: aplicar los componentes y estilos de formulario habituales a estos controles, con una zona táctil cómoda y tipografía consistente. La selección de papel/oferta se comprobó sin crear un escenario; no se programó ninguna recolección.
- Referencias: [Escenarios.jsx](C:/Users/Pandora/Desktop/ECORAEE/frontend/src/pages/Escenarios.jsx:67), [Solicitudes.jsx](C:/Users/Pandora/Desktop/ECORAEE/frontend/src/pages/Solicitudes.jsx:62).

### 3. El menú móvil no aísla el contenido del fondo — P2

- A 390 px, el botón Abrir menú mide 44 × 44 px y despliega un panel de 288 px. La apertura y la navegación funcionan.
- Con el panel abierto, Tab desde el botón de menú envía el foco al botón de cuenta del fondo, fuera del menú. El lector de pantalla también sigue exponiendo el contenido de fondo.
- Con el menú abierto, PageDown desplazó la página de scrollY 0 a 700, manteniendo aria-expanded=true. Escape sí cerró el menú y dejó aria-expanded=false.
- Recomendación: mover el foco al abrir, contenerlo mientras esté abierto, desactivar el fondo y su desplazamiento, y devolver el foco al botón al cerrar. Mantener el cierre por Escape.
- Referencias: [App.jsx](C:/Users/Pandora/Desktop/ECORAEE/frontend/src/App.jsx:49), [App.jsx](C:/Users/Pandora/Desktop/ECORAEE/frontend/src/App.jsx:95).

## Resultados favorables y límites

- Inicio y Solicitudes a 390 px: el ancho del documento coincide con el viewport; la navegación dispone del botón móvil. Los dispositivos de Nueva solicitud ya se apilan verticalmente en este ancho. La mejora acordada para su disposición horizontal en escritorio sigue siendo un asunto separado.
- A 360 px, no se detectó desbordamiento horizontal general en Dispositivos, los formularios de registro individual/granel, Recepción, Programar movimiento, Tratamientos, Asignaciones, Cierres, Evidencias, Indicadores y alertas, Usuarios, Organizaciones, Centros y conexiones, Auditoría ni el detalle del movimiento #54.
- Las rejillas de formularios se apilan y las tablas revisadas se presentan como tarjetas. Las medidas de los contenedores de las tablas cargadas no mostraron un scroll horizontal adicional. En Dispositivos se observó un desbordamiento interno menor de una celda de nombre de equipo (267 px frente a 261 px), sin ampliar la página; conviene permitir corte de palabras largas.
- Auditoría mantuvo el documento en 360 px incluso con un detalle JSON abierto. La consola capturada durante el recorrido no registró advertencias ni errores; esto no certifica todas las rutas ni estados posibles.
- Se midió la presentación de formularios; no se enviaron altas ni se probó el selector nativo de archivos de un teléfono. No se verificaron TalkBack/VoiceOver, teclado virtual, rotación de dispositivo o todas las combinaciones de roles y contenido.

## Estado

Revisión visual y de geometría completada para el recorrido descrito. Los hallazgos son pendientes de implementación. No se modificó código de la aplicación ni se ejecutó una nueva compilación o suite de pruebas, porque esta tarea fue una revisión.
