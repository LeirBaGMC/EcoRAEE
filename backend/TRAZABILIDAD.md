# Trazabilidad de reglas - Backend EcoRAEE Cloud

Leyenda: PROPUESTO = decision de diseno por validar. IMPLEMENTADO = codigo escrito. VERIFICADO = comprobado ejecutando.
Verificacion local actualizada el 2026-11-01: Windows, Python 3.13 y SQL Server real. La integracion usa FastAPI TestClient; no equivale a validar S3, despliegue cloud ni todas las posibles carreras concurrentes.

| Regla | Donde se aplica | Prueba | Implementado | Verificado |
|---|---|---|---|---|
| RN-01 id unico e historial | `domain/dispositivo.py`, `services/estado_service.py`, `persistence/dispositivos.py` | test_rules, test_bloque1; integracion bloque 1 | si | reglas e historial en SQL Server |
| RN-02 solo tecnico evalua | `domain/rules.exigir_tecnico`, `services/evaluacion_service.py` | test_rules; integracion (403 con op1); regresion de reevaluacion | si | permisos y bloqueo de reevaluacion con movimiento activo |
| RN-03 cierre de movimiento completo | `domain/movimiento.py`, `services/movimiento_service.cerrar` | test_movimiento; integracion test_02 | si | cierre y rechazo sin guia |
| RN-04 no recuperable no se asigna | `domain/ciclo.validar_asignacion`, `services/ciclo_service`, `services/movimiento_service` | test_ciclo; integracion test_04; regresion de despacho | si | asignacion y rechazo de despacho incompatible |
| RN-05 capacidad de la conexion | `domain/movimiento`, `persistence/movimientos.py` | test_movimiento; integracion test_03 y regresion KG | si | cuatro solicitudes concurrentes en UND; peso GRANEL persistido y compatibilidad con NULL historicos |
| RN-06 transferencia atomica | `services/movimiento_service.cerrar`, `persistence/inventario.py` | integracion test_02 | si | salida/entrada del flujo normal; pendiente inyectar fallos a mitad del cierre |
| RN-07 evidencia por rol y proposito | `domain/evidencia.py`, `services/evidencia_service.py` | test_evidencia; integracion test_02 | si | almacenamiento local, roles, proposito y alcance; S3 pendiente |
| RN-08 cierre con destino y fecha | `domain/ciclo.validar_cierre_trazabilidad`, indices unicos filtrados en SQL | test_ciclo; integracion test_04 | si | ambos destinos y rechazos del flujo probado; sin auditoria exhaustiva de indices |
| Modulo matematico | `domain/flujo_maximo.py`, `integrations/modulo_matematico.py` | test_flujo_maximo; integracion test_05 | si | CLRS = 23 y escenario persistido = 7 con ambos algoritmos |
| Seguridad (JWT, RBAC, alcance) | `security.py`, `domain/permisos.py` | test_permisos_seguridad, test_usuarios; integracion | si | login, roles, alcance y desactivacion en los casos cubiertos |

Comandos: `python -m unittest discover -s tests -t .` y `python -m pytest tests_integracion -v`.
`tests_integracion/conftest.py` carga el .env antes de recolectar pruebas. La suite crea datos de prueba y no los elimina.
Resultados actuales: consultar `correcciones-unitarias.log` y `correcciones-integracion.log`.
Regresiones nuevas: KG, reevaluacion antes/despues de autorizar, despacho incompatible, cuatro reintentos simultaneos, clave con datos diferentes y reintento al dia siguiente. La huella de solicitud se guarda en auditoria en la misma transaccion, sin cambiar el esquema.

## Decisiones PROPUESTAS (validar con el grupo)
1. Tablas de transicion de estados de dispositivo, lote y movimiento (`domain/rules.py`).
2. Compatibilidad tratamiento <-> clasificacion tecnica.
3. Periodo de capacidad = mes calendario de `fecha_despacho`.
4. `fecha_despacho` se usa como fecha planificada (la tabla no tiene columna de fecha planificada).
5. GUIA_TRASLADO es la evidencia obligatoria para cerrar un movimiento.
6. Visibilidad de escenarios por centros de sus nodos; indicadores globales de la red.
7. La coordinacion programa y ejecuta la recoleccion (la solicitud no tiene centro).
8. Matriz de permisos de lectura agregada al RBAC.
9. La primera evaluacion cambia el estado; las siguientes solo agregan evaluaciones.

## Brechas del esquema de datos (para la fase de BDD)
- No hay columna dedicada para `huella_datos` de cada ejecucion: se devuelve en la respuesta y se guarda como `huella` en la auditoria INSERT; la consulta de ejecucion no la devuelve.
- No hay tabla de auditoria de lectura de evidencias (hoy va al log tecnico).
- `escenario_red` no tiene organizacion ni autor.
- No hay fecha planificada de despacho en `movimiento`.

## Pendientes de otras fases
- Frontend: consumir CONTRATO_API.md.
- Cloud: `AlmacenamientoS3` esta escrito y sin verificar; Cognito reemplazaria el login local; RDS/SQL Server y variables de entorno via secretos.
