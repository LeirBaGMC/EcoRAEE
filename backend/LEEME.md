# EcoRAEE Cloud - Backend (SQL Server) - guia para correrlo en tu computadora

## 1. Requisitos
- Python 3.11 o mayor
- SQL Server (Express esta bien) y SQL Server Management Studio (SSMS)
- ODBC Driver 18 for SQL Server (descarga gratis de Microsoft: "Download ODBC Driver for SQL Server")

## 2. Base de datos (una sola vez)
En SSMS abre ecoraee_cloud_sqlserver.sql y presiona Ejecutar (F5) con todo el script.
Crea la base `ecoraee_cloud`, 35 tablas, 2 vistas, 4 triggers y los datos iniciales (roles, clasificaciones, categorias).
Si lo ejecutas dos veces no pasa nada: detecta que ya existe y no repite.

## 3. Instalar el backend
  cd backend
  python -m venv .venv
  .venv\Scripts\activate
  pip install -r requirements.txt

## 4. Configuracion
Copia .env.example como .env y ajusta ECORAEE_DB_URL (el nombre de tu servidor aparece en SSMS al conectarte,
por ejemplo localhost\SQLEXPRESS o DESKTOP-XXXX\SQLEXPRESS). Cambia ECORAEE_JWT_SECRET por un texto largo.

## 5. Crear datos de prueba
  python -m scripts.datos_prueba            (crea 2 centros con una conexion de 100 UND y te muestra sus id_centro)
  python -m scripts.crear_usuario gen1 Clave-Prueba-123 GENERADOR
  python -m scripts.crear_usuario op1 Clave-Prueba-123 OPERADOR_CENTRO
  python -m scripts.crear_usuario tec1 Clave-Prueba-123 TECNICO_EVALUADOR
  python -m scripts.crear_usuario coo1 Clave-Prueba-123 COORDINADOR_LOGISTICO
  python -m scripts.crear_usuario rea1 Clave-Prueba-123 REACONDICIONADOR_RECICLADOR
  python -m scripts.crear_usuario adm1 Clave-Prueba-123 ADMINISTRADOR
(La entidad beneficiaria se crea desde adm1 con POST /organizaciones y POST /usuarios.)

## 6. Levantar y probar en Swagger
  uvicorn app.main:app --reload
Abre http://localhost:8000/docs . Para cambiar de usuario: POST /auth/login con otro usuario, copia su token,
boton "Authorize" (candado), pega el nuevo token.

Recorrido completo (cada paso con el usuario indicado):
  A. Ingreso
   1. gen1  POST /dispositivos          (dos veces, numero_serie distinto) -> id_dispositivo
   2. gen1  POST /lotes                 {"ids_dispositivos":[id1,id2]} -> id_lote
   3. gen1  POST /solicitudes           {"id_lote":N,"modalidad":"RECOLECCION","zona_referencial":"Norte"} -> id_solicitud
   4. coo1  POST /solicitudes/{id}/recoleccion          {"fecha_programada":"2026-11-05"}
   5. coo1  POST /solicitudes/{id}/recoleccion/ejecutar
   6. op1   POST /recepciones           {"id_solicitud":N,"id_centro":(recoleccion),"peso_recibido_kg":12.5,"unidades_recibidas":2,"conforme":true}
   7. tec1  POST /dispositivos/{id}/evaluaciones  {"condicion_constatada":"ENCIENDE","diagnostico":"ok","id_clasificacion":1}
  B. Movimiento entre centros
   8. coo1  POST /movimientos           {"id_conexion":C,"tipo_movimiento":"TRANSFERENCIA","fecha_despacho":"2026-11-06","dispositivos":[{"id_dispositivo":id1}]}
            (cabecera opcional Idempotency-Key: repetir la misma peticion devuelve el mismo movimiento)
   9. coo1  POST /movimientos/{id}/autorizar
  10. op1   POST /movimientos/{id}/despachar
  11. op1   POST /evidencias            (formulario: tipo_evidencia=GUIA_TRASLADO, id_movimiento=N, archivo=un PDF)
  12. coo1  POST /movimientos/{id}/cerrar
  C. Destino final
  13. rea1  POST /tratamientos          {"id_dispositivo":id,"tipo_tratamiento":"RECICLAJE"}  (solo si es RECICLABLE o NO_RECUPERABLE segun la regla)
  14. rea1  POST /tratamientos/{id}/finalizar   {"resultado":"EXITOSO"}
  15. coo1  POST /cierres               {"id_dispositivo":id,"id_tratamiento":T,"fecha_confirmacion":"2026-11-10"}
      o bien asignacion: coo1 POST /asignaciones -> beneficiaria POST /asignaciones/{id}/confirmar -> coo1 POST /cierres con id_asignacion
  D. Analisis
  16. coo1  POST /escenarios -> POST /escenarios/{id}/ejecuciones {"algoritmo":"EDMONDS_KARP"}
  17. coo1  POST /indicadores/calcular ; POST /alertas/evaluar ; GET /alertas
  18. adm1  GET /auditoria?tabla=usuario
Errores que debes ver a proposito: repetir la recepcion (409), evaluar con op1 (403), cerrar un movimiento sin guia (422),
asignar un NO_RECUPERABLE (422), pedir mas unidades que la capacidad de la conexion (422), token falso (401).
id_clasificacion: 1 REUTILIZABLE, 2 REPARABLE, 3 RECICLABLE, 4 NO_RECUPERABLE.

Otros archivos: ../mds/CONTRATO_API.md (guía de endpoints para el frontend) y ../mds/TRAZABILIDAD.md (reglas -> código -> prueba, y qué está verificado).

## 7. Pruebas
  Sin base de datos:      python -m unittest discover -s tests -t .
  Contra tu SQL Server:   python -m pytest tests_integracion -v     (recorre todo el flujo y los errores)

## 8. Preparacion para AWS

En EC2 ejecuta Uvicorn sin `--reload` y configura las variables mediante el servicio del sistema,
Secrets Manager o un archivo de entorno protegido. No subas `.env` al repositorio.

- `ECORAEE_STORAGE=local` conserva el comportamiento de desarrollo.
- `ECORAEE_STORAGE=s3` activa S3 y requiere `ECORAEE_S3_BUCKET`; la instancia debe tener un rol IAM
  con permisos sobre ese bucket. No se configuran claves AWS en el codigo.
- `AWS_REGION` indica la region del bucket.
- `ECORAEE_S3_KMS_KEY_ID` es opcional; si se define, las evidencias se cifran con esa clave KMS.
- `ECORAEE_DB_POOL_SIZE`, `ECORAEE_DB_MAX_OVERFLOW`, `ECORAEE_DB_POOL_TIMEOUT` y
  `ECORAEE_DB_POOL_RECYCLE` ajustan el pool para RDS.

El balanceador debe usar `GET /health/live` para comprobar que el proceso esta levantado.
`GET /health/ready` comprueba que la aplicacion puede conectarse a SQL Server y devuelve 503
si la base no esta disponible.
