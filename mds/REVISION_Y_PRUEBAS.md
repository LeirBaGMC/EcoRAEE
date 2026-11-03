# Revisión y pruebas — 2 de noviembre de 2026

## Resultado

Las verificaciones ejecutadas pasan, pero la revisión estática detecta tres pendientes funcionales del frontend. No se modificó el código de aplicación durante esta revisión.

## Hallazgos pendientes

**Actualización posterior:** los tres hallazgos de esta revisión quedaron corregidos. `useAsync` descarta respuestas y errores de solicitudes anteriores; las tres pantallas cargan todas las páginas de dispositivos; los cierres con aviso redirigen a `/login` y el cierre manual conserva `/`. Se añadieron pruebas con React y respuestas HTTP simuladas: respuestas fuera de orden, recarga, desmontaje, error síncrono, expiración de sesión y dispositivo 101 visible en Solicitudes, MovimientoNuevo y Tratamientos. `npm test`: 12 pruebas aprobadas. `npm run build`: correcto. Estas pruebas no sustituyen una nueva revisión visual ni usan SQL Server. Los hallazgos originales se conservan abajo como historial.

1. **P2 — Respuestas antiguas pueden sobrescribir consultas nuevas.** `frontend/src/lib/hooks.js:9-15`: `useAsync` solo comprueba si el componente sigue vivo; no distingue la solicitud vigente. Si se cambia un filtro o una página y la consulta anterior termina después, sus datos o su error reemplazan el resultado nuevo. El cleanup tampoco evita esto cuando el siguiente efecto vuelve a poner `vivo.current = true`. Recomendación: identificar cada solicitud e ignorar las anteriores, incluido al recargar. Hallazgo de código, pendiente de prueba automatizada de respuestas fuera de orden.

2. **P2 — Selección incompleta con más de 100 dispositivos por estado.** `frontend/src/pages/Movimientos.jsx:41`, `Solicitudes.jsx:10` y `Destino.jsx:12` solicitan solamente la primera página de 100 elementos. No ofrecen acceso a los siguientes. En movimientos se filtra por centro después de ese recorte, por lo que puede indicarse que no hay equipos aunque sí existan en páginas posteriores. Recomendación: paginar los selectores o completar la consulta con filtros en servidor. Hallazgo de código; no se crearon 101 dispositivos para reproducirlo.

3. **P2 — El aviso de sesión vencida no se muestra al producirse.** `frontend/src/auth/AuthContext.jsx:18` envía a `/` después del 401. `frontend/src/App.jsx:58` muestra la landing en esa ruta, mientras que el aviso solo se renderiza en `frontend/src/pages/Login.jsx:62`. La persona debe volver a abrir Ingresar para ver la explicación. Recomendación: redirigir a `/login` en la expiración o mostrar el aviso en la landing. Hallazgo de código; el rechazo de tokens vencidos en el backend sí está cubierto por integración.

## Pruebas ejecutadas

| Verificación | Resultado |
| --- | --- |
| Backend: `python -m pytest tests tests_integracion -q` con el entorno Windows | 140 aprobadas, ninguna omitida, 17,83 s |
| Frontend: `node --test tests/paginacion.test.js` | 5 aprobadas |
| Frontend: `npm run build` | Correcto |
| HTTP real contra Uvicorn | 27 comprobaciones aprobadas |
| `git diff --check` | Sin errores |

Las 27 comprobaciones HTTP incluyen health, OpenAPI, perfil sin token (401), contraseña incorrecta (401), login/perfil y roles de adm1/coo1/tec1/gen1, listados correspondientes, denegación de Usuarios para los tres perfiles no administradores (403) y preflight CORS desde localhost:5173. No se imprimieron tokens.

## Navegador

- Landing carga y contiene el aviso de cifras ficticias.
- Login con contraseña incorrecta muestra 401; con contraseña correcta muestra el panel de administrador.
- Usuarios carga 152 registros, superando la primera página de 100; confirma que la carga completa de ese listado funciona.
- Panel inspeccionado visualmente en escritorio y a 390 × 844 px.
- Panel y página Usuarios: ancho del documento igual a 390 px, sin desborde horizontal en los estados observados.
- Menú de perfil y cierre de sesión funcionan; vuelve a la landing.
- Sin mensajes de error en la consulta de consola realizada tras cargar Usuarios.
- La prueba de escritura del filtro Buscar no se completó por una interrupción del mecanismo de entrada del navegador automatizado; no se clasifica como defecto de la aplicación.

## Límites y advertencias

La suite de integración crea registros en SQL Server local y no los elimina. Se probaron flujos y concurrencia incluidos en esa suite, no todas las combinaciones posibles. No se validaron S3 real, todos los roles en navegador, todas las pantallas móviles, ni carga sostenida. Los resultados no equivalen a una certificación completa de seguridad o producción.

Persisten una advertencia de obsolescencia de Starlette/httpx y otra de Vite por el paquete Three.js de 753,47 kB sin gzip. No bloquearon las pruebas.

Se detuvieron los servidores temporales al terminar; los puertos 8000 y 5173 quedaron sin escucha. Se conservaron las correcciones anteriores y el trabajo del usuario.
