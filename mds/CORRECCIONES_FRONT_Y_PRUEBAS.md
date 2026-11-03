# Correcciones y pruebas — 2 de noviembre de 2026

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
