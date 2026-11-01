# Cambios y correcciones del backend EcoRAEE

Fecha: 1 de noviembre de 2026.

Este documento resume las correcciones realizadas después de la revisión de flujos del backend. No incluye cambios de frontend ni despliegues en AWS.

## 1. Capacidad de las conexiones medidas en kilogramos

**Problema:** cuando un dispositivo a granel no enviaba `peso_despachado_kg`, el backend validaba la capacidad usando su peso registrado, pero guardaba `NULL` en el detalle del movimiento. Las siguientes solicitudes podían ignorar ese peso y superar la capacidad disponible.

**Corrección:** ahora se guarda el peso efectivo usado para calcular la reserva. Para los registros antiguos que tienen `NULL`, la consulta de capacidad utiliza como respaldo el peso del granel.

**Archivos:**

- `app/services/movimiento_service.py`
- `app/persistence/movimientos.py`

**Verificación:** en una conexión de 10 KG, el primer granel de 6 KG se registra y otro de 6 KG se rechaza con 422. También se comprobó el comportamiento con un detalle histórico cuyo peso es `NULL`.

## 2. Reevaluación de dispositivos con movimientos activos

**Problema:** un técnico podía cambiar la clasificación de un dispositivo después de programar su entrega a una beneficiaria. El despacho no comprobaba nuevamente si la clasificación permitía esa entrega.

**Corrección:**

- La evaluación toma el bloqueo del dispositivo usado también al programar movimientos.
- Si existe un movimiento activo, la reevaluación devuelve 409. Primero debe anularse el movimiento cuando su estado permita hacerlo.
- Al despachar hacia una beneficiaria, se comprueba otra vez que el dispositivo tenga una clasificación que permita la entrega.

**Archivos:**

- `app/services/evaluacion_service.py`
- `app/services/movimiento_service.py`

**Verificación:** se rechazó la reevaluación con movimientos programados y autorizados, y se permitió después de anularlos. También se simuló una clasificación incompatible guardada por una versión anterior: el despacho devolvió 422 y conservó el movimiento autorizado y el dispositivo evaluado.

## 3. Reintentos con `Idempotency-Key`

**Problemas:** reutilizar una clave con datos diferentes devolvía el movimiento anterior sin advertir el conflicto. Además, un reintento al día siguiente podía rechazarse por fecha pasada antes de buscar el movimiento ya creado.

**Corrección:**

- Se calcula una huella SHA-256 con la conexión, tipo, fecha, dispositivos y pesos de la solicitud.
- La huella se guarda en la auditoría INSERT del movimiento, dentro de su misma transacción.
- La misma clave con datos diferentes devuelve 409.
- La misma clave con los mismos datos devuelve el movimiento existente y `repetido=true`, aunque su fecha planificada ya haya pasado.
- Cambiar el orden de los dispositivos no cambia la identidad de la solicitud.
- Los reintentos simultáneos se serializan con `sys.sp_getapplock`, asociado a la transacción.
- Para movimientos anteriores que no tienen huella, se comparan los campos y pesos persistidos.

**Archivos:**

- `app/services/movimiento_service.py`
- `app/persistence/movimientos.py`

**Verificación:** cuatro solicitudes concurrentes con la misma clave devolvieron un único movimiento. Se comprobaron conflictos al modificar conexión, tipo, fecha, dispositivos o pesos, así como el reintento al día siguiente. Una solicitud nueva con fecha pasada sigue rechazándose.

## 4. Carga del `.env` en las pruebas de integración

**Problema:** las pruebas revisaban `ECORAEE_DB_URL` antes de cargar el `.env`, por lo que podían omitirse aunque el archivo estuviera configurado.

**Corrección:** se creó `tests_integracion/conftest.py`, que carga el `.env` desde la carpeta del backend antes de recolectar las pruebas. Las variables ya definidas en el entorno conservan su prioridad.

Ahora se puede ejecutar desde `backend`:

```powershell
.\.venv-windows\Scripts\python.exe -m pytest tests_integracion -v
```

Si no existe una conexión configurada ni en el archivo ni en el entorno, las pruebas siguen omitiéndose explícitamente.

## 5. Pruebas de regresión añadidas

Se creó `tests_integracion/test_regresiones_movimientos.py` con cinco casos ejecutados:

1. Persistencia del peso del granel, límite de capacidad y compatibilidad con pesos históricos omitidos.
2. Bloqueo de reevaluación con movimiento programado.
3. Bloqueo de reevaluación con movimiento autorizado.
4. Idempotencia concurrente, conflictos de contenido y reintento al día siguiente.
5. Rechazo del despacho con una clasificación incompatible preexistente.

Las pruebas generan datos de prueba en SQL Server y no los eliminan. Las modificaciones directas usadas para simular datos antiguos afectan los registros creados por esas pruebas.

## 6. Documentación actualizada

- `TRAZABILIDAD.md`: se sustituyeron las afirmaciones de integración nunca ejecutada por el alcance real de las verificaciones. Se mantuvieron explícitas las limitaciones.
- `CONTRATO_API.md`: se documentaron los nuevos comportamientos de movimientos, errores de idempotencia y reevaluación. También se aclararon los formatos de error de negocio, autenticación y validación.
- `tests_integracion/test_flujo_completo.py`: se actualizó el comentario inicial que decía que nunca se había ejecutado contra SQL Server.

## 7. Resultados comprobados

| Comprobación | Resultado |
|---|---|
| Pruebas unitarias | 126 aprobadas |
| Pruebas de integración | 13 aprobadas en 12,70 segundos |
| Base utilizada por la integración | SQL Server real, con FastAPI TestClient |
| `GET /health` del servidor en ejecución | `{"estado":"ok"}` |
| Swagger `/docs` | HTTP 200 |

Salidas completas:

- `correcciones-unitarias.log`
- `correcciones-integracion.log`

Queda una advertencia de deprecación de Starlette sobre el uso de `httpx` con TestClient. No produjo fallos en esta ejecución.

## 8. Límites y pendientes

- No se cambió el esquema SQL ni se ejecutaron migraciones. La huella de solicitud utiliza la tabla de auditoría existente.
- No se modificó el `.env` ni se reemplazaron las credenciales de los usuarios existentes.
- S3 y el despliegue cloud siguen sin verificarse.
- Siguen pendientes las decisiones del grupo sobre estados, permisos, periodo de capacidad y evidencias obligatorias.
- Las brechas de esquema documentadas continúan: auditoría persistente de lectura de evidencias, organización/autor de escenarios y separación entre fecha planificada y fecha real de despacho.
- La huella de una ejecución matemática se guarda en auditoría, pero no tiene columna dedicada ni se devuelve al consultar esa ejecución.
- Las pruebas aprobadas cubren los casos descritos; no demuestran ausencia de todos los errores ni de todas las posibles carreras concurrentes. Sigue pendiente, entre otras comprobaciones, inyectar fallos a mitad del cierre de un movimiento para verificar su reversión completa.
