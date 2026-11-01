# Contrato de API - EcoRAEE Cloud (para el frontend)

Estado: implementado y probado localmente en los casos de integracion contra SQL Server (ver TRAZABILIDAD.md). La fuente exacta es siempre /docs (OpenAPI). S3 y despliegue cloud siguen pendientes.
Todos los datos de ejemplo son sinteticos.

## Convenciones
- Autenticacion: `POST /auth/login {"nombre_usuario","contrasena"}` -> `{"access_token","token_type":"bearer"}`. Enviar `Authorization: Bearer <token>`. Dura 60 min.
- Paginacion: `?pagina=1&tamano=20` (tamano maximo 100). Respuesta `{items,total,pagina,tamano}`.
- Idempotencia: `POST /movimientos` acepta la cabecera `Idempotency-Key`.
- Errores de negocio: `{"error": "codigo", "mensaje": "..."}`. Autenticacion: `{"detail": "..."}`. Validacion de FastAPI: `{"detail": [...]}`.
  | Codigo | Cuando |
  |---|---|
  | 401 | token ausente, vencido o usuario desactivado |
  | 403 | el rol no tiene el permiso, o la accion no corresponde al rol |
  | 404 | no existe, o existe pero esta fuera de tu organizacion/centro (no se revela su existencia) |
  | 409 | duplicado o conflicto (recepcion repetida, recoleccion ya programada, dispositivo ya en otro movimiento) |
  | 422 | formato invalido o regla de negocio incumplida (RN-01..RN-08, transicion invalida, capacidad excedida) |
- El actor (usuario, roles, organizacion) sale del token; nunca se envia en el cuerpo.

## Endpoints por modulo (rol que puede usarlos)
| Modulo | Endpoint | Roles |
|---|---|---|
| Acceso | POST /auth/login | publico |
| Dispositivos | POST /dispositivos; GET /dispositivos; GET /dispositivos/{id}; GET /dispositivos/{id}/historial | GENERADOR, OPERADOR_CENTRO (crear); lectura segun alcance |
| Evaluacion | POST /dispositivos/{id}/evaluaciones | TECNICO_EVALUADOR (RN-02) |
| Lotes y solicitudes | POST /lotes; GET /lotes/{id}; POST /solicitudes; GET /solicitudes | GENERADOR |
| Recoleccion | POST /solicitudes/{id}/recoleccion; POST /solicitudes/{id}/recoleccion/ejecutar | COORDINADOR_LOGISTICO |
| Recepcion | POST /recepciones | OPERADOR_CENTRO |
| Movimientos | POST /movimientos; GET /movimientos; GET /movimientos/{id}; POST .../autorizar; .../anular; .../cerrar | COORDINADOR_LOGISTICO |
| | POST /movimientos/{id}/despachar | OPERADOR_CENTRO |
| Tratamientos | POST /tratamientos; POST /tratamientos/{id}/finalizar; GET /tratamientos/{id} | REACONDICIONADOR_RECICLADOR |
| Asignaciones | POST /asignaciones; GET /asignaciones | COORDINADOR_LOGISTICO (crear); ENTIDAD_BENEFICIARIA (ver propias) |
| | POST /asignaciones/{id}/confirmar | ENTIDAD_BENEFICIARIA |
| Cierre | POST /cierres; GET /dispositivos/{id}/cierre | COORDINADOR_LOGISTICO |
| Evidencias | POST /evidencias (multipart); GET /evidencias?proposito=; GET /evidencias/{id}/archivo?proposito= | subir: OPERADOR, TECNICO, COORDINADOR, REACONDICIONADOR; ver: TECNICO, COORDINADOR, ADMIN |
| Flujo maximo | POST /escenarios; GET /escenarios; GET /escenarios/{id}; POST /escenarios/{id}/estado; POST/GET /escenarios/{id}/ejecuciones | COORDINADOR_LOGISTICO |
| Seguimiento | POST /indicadores/calcular; GET /indicadores; GET /indicadores/{codigo}/mediciones; POST /alertas/evaluar; GET /alertas; POST /alertas/{id}/atender | COORDINADOR, ADMIN |
| Administracion | /usuarios, /usuarios/{id}/roles, /usuarios/{id}/activo, /organizaciones, /centros, /conexiones, /auditoria | ADMINISTRADOR |
| Catalogos | GET /catalogos | cualquier usuario autenticado (los roles solo para ADMIN) |
| Salud | GET /health | publico |

Los permisos finos estan en `app/domain/permisos.py` (PROPUESTO: validar con el grupo).

## Ejemplos sinteticos
Exito - programar movimiento:
```
POST /movimientos   Idempotency-Key: abc-001
{"id_conexion":1,"tipo_movimiento":"TRANSFERENCIA","fecha_despacho":"2026-11-06","dispositivos":[{"id_dispositivo":10}]}
-> 201 {"id_movimiento":5,"codigo_movimiento":"MOV-...","estado_movimiento":"PROGRAMADO",...,"repetido":false}
```
Validacion - capacidad excedida (RN-05):
```
-> 422 {"detail":"La conexion no tiene capacidad suficiente para el periodo: ..."}
```
Acceso denegado - rol incorrecto:
```
POST /movimientos con OPERADOR_CENTRO -> 403 {"detail":"No tienes permiso para: movimiento:programar"}
```
Evidencia (multipart/form-data): campos `tipo_evidencia`, `archivo` (PDF/JPG/PNG, max 10 MB) y EXACTAMENTE un id de destino (`id_movimiento`, `id_recepcion`, `id_cierre` o `id_dispositivo_evaluacion`+`nro_evaluacion`).
Descarga: `GET /evidencias/{id}/archivo?proposito=AUDITORIA|VERIFICACION_CIERRE|EVALUACION`; el proposito es obligatorio.

## Notas para el frontend
- Estados del dispositivo (para mostrar la linea de tiempo): REGISTRADO, EN_RECOLECCION, RECIBIDO, EVALUADO, EN_TRANSITO, EN_TRATAMIENTO, REACONDICIONADO, ASIGNADO, CERRADO (PROPUESTO).
- `GET /dispositivos/{id}/historial` devuelve el historial de negocio ordenado por `nro_cambio`.
- Calcular un escenario de flujo NO crea movimientos; solo muestra capacidades, cuellos de botella (`corte_minimo`) e interpretacion.
- Pregunta abierta para el frontend: el rol REACONDICIONADOR_RECICLADOR y ENTIDAD_BENEFICIARIA tienen pantallas muy reducidas.
## Correcciones de movimientos (2026-11-01)

- `Idempotency-Key`: mismo usuario, clave y datos devuelven el mismo movimiento con `repetido=true`, incluso despues de la fecha planificada. Cambiar conexion, tipo, fecha, dispositivos o pesos con la misma clave devuelve 409. El orden de dispositivos no cambia la solicitud. Reintentos concurrentes se serializan en SQL Server.
- La huella de la solicitud se conserva en la auditoria INSERT del movimiento, dentro de la misma transaccion. Para movimientos anteriores sin huella se comparan los campos y pesos originales persistidos.
- Una evaluacion de un dispositivo con movimiento activo devuelve 409: anular primero el movimiento. Al despachar a una beneficiaria se vuelve a comprobar que la clasificacion permita la entrega.
- En conexiones KG, el peso omitido de un registro GRANEL se toma de su peso registrado y se guarda en el detalle del movimiento. Los detalles historicos NULL usan ese peso como respaldo al calcular capacidad.

