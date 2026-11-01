/* =====================================================================
   EcoRAEE Cloud - Base de datos en SQL Server (modelo fisico, T-SQL)
   Convertido desde la version MySQL 8 (misma estructura: 35 tablas, 52 FK).
   Como ejecutarlo: abrir en SQL Server Management Studio (SSMS), conectarte
   a tu servidor y presionar Ejecutar (F5) con TODO el script.
   Requiere SQL Server 2016 SP1 o superior (CREATE OR ALTER, indices filtrados).
   NOTA: este script se escribio sin poder ejecutarlo contra un SQL Server real.
   Si algo falla, copia el mensaje de error completo y se corrige.
   ===================================================================== */

-- Para borrar y rehacer todo, quita los guiones de las dos lineas siguientes y ejecuta SOLO ellas:
-- ALTER DATABASE ecoraee_cloud SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
-- DROP DATABASE ecoraee_cloud;

IF DB_ID(N'ecoraee_cloud') IS NULL
  CREATE DATABASE ecoraee_cloud COLLATE Latin1_General_100_CI_AI;
GO
USE ecoraee_cloud;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Proteccion: si las tablas ya existen no se vuelve a ejecutar nada (evita errores de "ya existe").
IF OBJECT_ID(N'dbo.organizacion', N'U') IS NOT NULL
BEGIN
  PRINT 'Las tablas ya existen. No se ejecuto nada. Para rehacer todo, usa el DROP DATABASE de arriba.';
  SET NOEXEC ON;
END
GO

CREATE TABLE organizacion (
  id_organizacion INT IDENTITY(1,1) NOT NULL,
  ruc             NVARCHAR(13)  NOT NULL,
  nombre          NVARCHAR(150) NOT NULL,
  tipo_persona VARCHAR(8) NOT NULL,
  ciudad          NVARCHAR(80)  NOT NULL,
  CONSTRAINT pk_organizacion PRIMARY KEY (id_organizacion),
  CONSTRAINT uq_organizacion_ruc UNIQUE (ruc),
  CONSTRAINT ck_organizacion_tipo_persona CHECK (tipo_persona IN ('JURIDICA', 'NATURAL'))
);

-- Atributo multivaluado {tipo_actor} de ORGANIZACION
-- Papeles que desempena cada organizacion (atributo multivaluado)
CREATE TABLE organizacion_tipo_actor (
  id_organizacion INT NOT NULL,
  tipo_actor VARCHAR(16) NOT NULL,
  CONSTRAINT pk_organizacion_tipo_actor PRIMARY KEY (id_organizacion, tipo_actor),
  CONSTRAINT fk_orgtipo_org FOREIGN KEY (id_organizacion)
    REFERENCES organizacion (id_organizacion) ON DELETE CASCADE,
  CONSTRAINT ck_organizacion_tipo_actor_tipo_actor CHECK (tipo_actor IN ('GENERADOR', 'OPERADOR', 'REACONDICIONADOR', 'RECICLADOR', 'BENEFICIARIO', 'COORDINADOR'))
);

-- Cuenta de una persona que opera la plataforma. Solo datos sinteticos y minimos
CREATE TABLE usuario (
  id_usuario      INT IDENTITY(1,1) NOT NULL,
  correo          NVARCHAR(150) NOT NULL,
  nombre_usuario  NVARCHAR(50)  NOT NULL,
  nombre_visible  NVARCHAR(120) NOT NULL,
  activo          BIT      NOT NULL DEFAULT 1,
  credencial_hash NVARCHAR(255) NOT NULL,
  id_organizacion INT NOT NULL,
  CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
  CONSTRAINT uq_usuario_correo UNIQUE (correo),
  CONSTRAINT uq_usuario_nombre UNIQUE (nombre_usuario),
  CONSTRAINT fk_usuario_org FOREIGN KEY (id_organizacion) REFERENCES organizacion (id_organizacion)
);

CREATE TABLE rol (
  id_rol      INT IDENTITY(1,1) NOT NULL,
  nombre_rol  NVARCHAR(40)  NOT NULL,
  descripcion NVARCHAR(255) NULL,
  CONSTRAINT pk_rol PRIMARY KEY (id_rol),
  CONSTRAINT uq_rol_nombre UNIQUE (nombre_rol)
);

-- Relacion muchos a muchos USUARIO - ROL (desempena)
CREATE TABLE usuario_rol (
  id_usuario INT NOT NULL,
  id_rol     INT NOT NULL,
  CONSTRAINT pk_usuario_rol PRIMARY KEY (id_usuario, id_rol),
  CONSTRAINT fk_usuariorol_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_usuariorol_rol     FOREIGN KEY (id_rol)     REFERENCES rol (id_rol)
);

/* =====================================================================
   2. CENTRO Y RED LOGISTICA
   ===================================================================== */

-- Nodo de la red logistica (grafo)
CREATE TABLE centro (
  id_centro     INT IDENTITY(1,1) NOT NULL,
  codigo_centro NVARCHAR(20)  NOT NULL,
  nombre        NVARCHAR(120) NOT NULL,
  tipo_centro VARCHAR(19) NOT NULL,
  ciudad        NVARCHAR(80)  NOT NULL,
  capacidad_almacenamiento DECIMAL(14,2) NOT NULL DEFAULT 0,
  id_organizacion INT NOT NULL,
  CONSTRAINT pk_centro PRIMARY KEY (id_centro),
  CONSTRAINT uq_centro_codigo UNIQUE (codigo_centro),
  CONSTRAINT ck_centro_capacidad CHECK (capacidad_almacenamiento >= 0),
  CONSTRAINT fk_centro_org FOREIGN KEY (id_organizacion) REFERENCES organizacion (id_organizacion),
  CONSTRAINT ck_centro_tipo_centro CHECK (tipo_centro IN ('RECOLECCION', 'REACONDICIONAMIENTO', 'RECICLAJE', 'DISPOSICION', 'SEDE_BENEFICIARIA'))
);

-- Arista dirigida del grafo con su capacidad por periodo
CREATE TABLE conexion_logistica (
  id_conexion        INT IDENTITY(1,1) NOT NULL,
  id_centro_origen   INT NOT NULL,
  id_centro_destino  INT NOT NULL,
  capacidad_por_periodo DECIMAL(14,2) NOT NULL,
  unidad_capacidad VARCHAR(3) NOT NULL,
  activa             BIT NOT NULL DEFAULT 1,
  CONSTRAINT pk_conexion_logistica PRIMARY KEY (id_conexion),
  CONSTRAINT uq_conexion_par UNIQUE (id_centro_origen, id_centro_destino),
  CONSTRAINT ck_conexion_distintos CHECK (id_centro_origen <> id_centro_destino),
  CONSTRAINT ck_conexion_capacidad CHECK (capacidad_por_periodo >= 0),
  CONSTRAINT fk_conexion_origen  FOREIGN KEY (id_centro_origen)  REFERENCES centro (id_centro),
  CONSTRAINT fk_conexion_destino FOREIGN KEY (id_centro_destino) REFERENCES centro (id_centro),
  CONSTRAINT ck_conexion_logistica_unidad_capacidad CHECK (unidad_capacidad IN ('UND', 'KG'))
);

/* =====================================================================
   3. DISPOSITIVO, CATEGORIA Y LOTE
   ===================================================================== */

CREATE TABLE categoria_dispositivo (
  id_categoria     INT IDENTITY(1,1) NOT NULL,
  nombre_categoria NVARCHAR(60)  NOT NULL,
  descripcion      NVARCHAR(255) NULL,
  CONSTRAINT pk_categoria_dispositivo PRIMARY KEY (id_categoria),
  CONSTRAINT uq_categoria_nombre UNIQUE (nombre_categoria)
);

-- Unidad trazable. El estado actual es derivado (ver vista v_dispositivo_estado_actual)
CREATE TABLE dispositivo (
  id_dispositivo      INT IDENTITY(1,1) NOT NULL,
  codigo_trazabilidad NVARCHAR(30)  NOT NULL,
  tipo_registro       NVARCHAR(10)  NOT NULL,
  marca               NVARCHAR(60)  NULL,
  modelo              NVARCHAR(80)  NULL,
  condicion_declarada VARCHAR(11) NOT NULL,
  fecha_registro      DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
  id_organizacion     INT NOT NULL,
  id_categoria        INT NOT NULL,
  CONSTRAINT pk_dispositivo PRIMARY KEY (id_dispositivo),
  CONSTRAINT uq_dispositivo_codigo UNIQUE (codigo_trazabilidad),
  CONSTRAINT uq_dispositivo_tipo UNIQUE (id_dispositivo, tipo_registro),
  CONSTRAINT ck_dispositivo_tipo CHECK (tipo_registro IN ('INDIVIDUAL','GRANEL')),
  CONSTRAINT fk_dispositivo_org FOREIGN KEY (id_organizacion) REFERENCES organizacion (id_organizacion),
  CONSTRAINT fk_dispositivo_cat FOREIGN KEY (id_categoria)    REFERENCES categoria_dispositivo (id_categoria),
  CONSTRAINT ck_dispositivo_condicion_declarada CHECK (condicion_declarada IN ('ENCIENDE', 'NO_ENCIENDE', 'DANO_FISICO', 'INCOMPLETO'))
);

-- Subclase DISPOSITIVO_INDIVIDUAL (disjunta con GRANEL gracias al discriminador)
CREATE TABLE dispositivo_individual (
  id_dispositivo INT NOT NULL,
  tipo_registro  NVARCHAR(10)  NOT NULL DEFAULT 'INDIVIDUAL',
  numero_serie   NVARCHAR(60)  NOT NULL,
  CONSTRAINT pk_dispositivo_individual PRIMARY KEY (id_dispositivo),
  CONSTRAINT uq_individual_serie UNIQUE (numero_serie),
  CONSTRAINT ck_individual_tipo CHECK (tipo_registro = 'INDIVIDUAL'),
  CONSTRAINT fk_individual_disp FOREIGN KEY (id_dispositivo, tipo_registro)
    REFERENCES dispositivo (id_dispositivo, tipo_registro)
);

-- Subclase DISPOSITIVO_GRANEL
CREATE TABLE dispositivo_granel (
  id_dispositivo    INT NOT NULL,
  tipo_registro     NVARCHAR(10)  NOT NULL DEFAULT 'GRANEL',
  peso_kg           DECIMAL(10,2) NOT NULL,
  cantidad_unidades INT NOT NULL,
  CONSTRAINT pk_dispositivo_granel PRIMARY KEY (id_dispositivo),
  CONSTRAINT ck_granel_tipo  CHECK (tipo_registro = 'GRANEL'),
  CONSTRAINT ck_granel_peso  CHECK (peso_kg > 0),
  CONSTRAINT ck_granel_cant  CHECK (cantidad_unidades > 0),
  CONSTRAINT fk_granel_disp FOREIGN KEY (id_dispositivo, tipo_registro)
    REFERENCES dispositivo (id_dispositivo, tipo_registro)
);

CREATE TABLE lote (
  id_lote         INT IDENTITY(1,1) NOT NULL,
  codigo_lote     NVARCHAR(30)  NOT NULL,
  fecha_creacion  DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
  estado_lote VARCHAR(11) NOT NULL DEFAULT 'REGISTRADO',
  id_organizacion INT NOT NULL,
  CONSTRAINT pk_lote PRIMARY KEY (id_lote),
  CONSTRAINT uq_lote_codigo UNIQUE (codigo_lote),
  CONSTRAINT fk_lote_org FOREIGN KEY (id_organizacion) REFERENCES organizacion (id_organizacion),
  CONSTRAINT ck_lote_estado_lote CHECK (estado_lote IN ('REGISTRADO', 'SOLICITADO', 'RECOLECTADO', 'RECIBIDO', 'CERRADO'))
);

-- Relacion muchos a muchos LOTE - DISPOSITIVO (agrupa)
CREATE TABLE lote_dispositivo (
  id_lote            INT NOT NULL,
  id_dispositivo     INT NOT NULL,
  fecha_incorporacion DATETIME2(0)    NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT pk_lote_dispositivo PRIMARY KEY (id_lote, id_dispositivo),
  CONSTRAINT fk_lotedisp_lote FOREIGN KEY (id_lote)        REFERENCES lote (id_lote),
  CONSTRAINT fk_lotedisp_disp FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo)
);

/* =====================================================================
   4. SOLICITUD, RECOLECCION, RECEPCION Y EVALUACION TECNICA
   ===================================================================== */

CREATE TABLE solicitud_recoleccion (
  id_solicitud     INT IDENTITY(1,1) NOT NULL,
  codigo_solicitud NVARCHAR(30)  NOT NULL,
  modalidad VARCHAR(15) NOT NULL,
  fecha_solicitud  DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
  zona_referencial NVARCHAR(120) NOT NULL,
  estado_solicitud VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
  id_lote          INT NOT NULL,
  CONSTRAINT pk_solicitud_recoleccion PRIMARY KEY (id_solicitud),
  CONSTRAINT uq_solicitud_codigo UNIQUE (codigo_solicitud),
  CONSTRAINT fk_solicitud_lote FOREIGN KEY (id_lote) REFERENCES lote (id_lote),
  CONSTRAINT ck_solicitud_recoleccion_modalidad CHECK (modalidad IN ('RECOLECCION', 'ENTREGA_DIRECTA')),
  CONSTRAINT ck_solicitud_recoleccion_estado_solicitud CHECK (estado_solicitud IN ('PENDIENTE', 'PROGRAMADA', 'ATENDIDA', 'CANCELADA'))
);

-- (1,1) con (0,1): cada solicitud tiene a lo mas una recoleccion, por eso id_solicitud es UNIQUE
CREATE TABLE recoleccion (
  id_recoleccion   INT IDENTITY(1,1) NOT NULL,
  fecha_programada DATETIME2(0) NOT NULL,
  fecha_ejecucion  DATETIME2(0) NULL,
  id_solicitud     INT NOT NULL,
  CONSTRAINT pk_recoleccion PRIMARY KEY (id_recoleccion),
  CONSTRAINT uq_recoleccion_solicitud UNIQUE (id_solicitud),
  CONSTRAINT ck_recoleccion_fechas CHECK (fecha_ejecucion IS NULL OR fecha_ejecucion >= fecha_programada),
  CONSTRAINT fk_recoleccion_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitud_recoleccion (id_solicitud)
);

CREATE TABLE recepcion (
  id_recepcion       INT IDENTITY(1,1) NOT NULL,
  fecha_hora         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  peso_recibido_kg   DECIMAL(10,2) NOT NULL,
  unidades_recibidas INT  NOT NULL,
  conforme           BIT NOT NULL,
  id_solicitud       INT NOT NULL,
  id_centro          INT NOT NULL,
  CONSTRAINT pk_recepcion PRIMARY KEY (id_recepcion),
  CONSTRAINT uq_recepcion_solicitud UNIQUE (id_solicitud),
  CONSTRAINT ck_recepcion_peso CHECK (peso_recibido_kg >= 0),
  CONSTRAINT fk_recepcion_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitud_recoleccion (id_solicitud),
  CONSTRAINT fk_recepcion_centro    FOREIGN KEY (id_centro)    REFERENCES centro (id_centro)
);

CREATE TABLE clasificacion (
  id_clasificacion     INT IDENTITY(1,1) NOT NULL,
  nombre_clasificacion NVARCHAR(40)  NOT NULL,
  permite_asignacion   BIT NOT NULL,
  CONSTRAINT pk_clasificacion PRIMARY KEY (id_clasificacion),
  CONSTRAINT uq_clasificacion_nombre UNIQUE (nombre_clasificacion)
);

-- Entidad debil de DISPOSITIVO. nro_evaluacion se numera solo (trigger al final del script)
CREATE TABLE evaluacion_tecnica (
  id_dispositivo       INT NOT NULL,
  nro_evaluacion       INT NOT NULL DEFAULT 0,
  fecha_hora           DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  condicion_constatada VARCHAR(11) NOT NULL,
  diagnostico          NVARCHAR(MAX) NOT NULL,
  id_usuario           INT NOT NULL,
  id_clasificacion     INT NOT NULL,
  CONSTRAINT pk_evaluacion_tecnica PRIMARY KEY (id_dispositivo, nro_evaluacion),
  CONSTRAINT fk_eval_disp  FOREIGN KEY (id_dispositivo)   REFERENCES dispositivo (id_dispositivo),
  CONSTRAINT fk_eval_user  FOREIGN KEY (id_usuario)       REFERENCES usuario (id_usuario),
  CONSTRAINT fk_eval_clasi FOREIGN KEY (id_clasificacion) REFERENCES clasificacion (id_clasificacion),
  CONSTRAINT ck_evaluacion_tecnica_condicion_constatada CHECK (condicion_constatada IN ('ENCIENDE', 'NO_ENCIENDE', 'DANO_FISICO', 'INCOMPLETO'))
);

/* =====================================================================
   5. HISTORIAL, INVENTARIO Y MOVIMIENTO
   ===================================================================== */

-- Entidad debil de DISPOSITIVO. nro_cambio se numera solo (trigger)
-- Nunca se actualiza ni se borra: cada cambio es una fila nueva
CREATE TABLE historial_estado (
  id_dispositivo  INT NOT NULL,
  nro_cambio      INT NOT NULL DEFAULT 0,
  estado_anterior VARCHAR(15) NULL,
  estado_nuevo VARCHAR(15) NOT NULL,
  fecha_hora      DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  observacion     NVARCHAR(255) NULL,
  id_usuario      INT NOT NULL,
  CONSTRAINT pk_historial_estado PRIMARY KEY (id_dispositivo, nro_cambio),
  CONSTRAINT fk_hist_disp FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo),
  CONSTRAINT fk_hist_user FOREIGN KEY (id_usuario)     REFERENCES usuario (id_usuario),
  CONSTRAINT ck_historial_estado_estado_anterior CHECK (estado_anterior IN ('REGISTRADO', 'EN_RECOLECCION', 'RECIBIDO', 'EVALUADO', 'EN_TRANSITO', 'EN_TRATAMIENTO', 'REACONDICIONADO', 'ASIGNADO', 'CERRADO')),
  CONSTRAINT ck_historial_estado_estado_nuevo CHECK (estado_nuevo IN ('REGISTRADO', 'EN_RECOLECCION', 'RECIBIDO', 'EVALUADO', 'EN_TRANSITO', 'EN_TRATAMIENTO', 'REACONDICIONADO', 'ASIGNADO', 'CERRADO'))
);

-- Entidad debil de DISPOSITIVO: cada estancia en un centro. nro_estancia se numera solo (trigger)
CREATE TABLE inventario (
  id_dispositivo INT NOT NULL,
  nro_estancia   INT NOT NULL DEFAULT 0,
  fecha_ingreso  DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  fecha_salida   DATETIME2(0) NULL,
  motivo_ingreso VARCHAR(10) NOT NULL,
  id_centro      INT NOT NULL,
  CONSTRAINT pk_inventario PRIMARY KEY (id_dispositivo, nro_estancia),
  CONSTRAINT ck_inventario_fechas CHECK (fecha_salida IS NULL OR fecha_salida >= fecha_ingreso),
  CONSTRAINT fk_inv_disp   FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo),
  CONSTRAINT fk_inv_centro FOREIGN KEY (id_centro)      REFERENCES centro (id_centro),
  CONSTRAINT ck_inventario_motivo_ingreso CHECK (motivo_ingreso IN ('RECEPCION', 'MOVIMIENTO'))
);

CREATE TABLE movimiento (
  id_movimiento     INT IDENTITY(1,1) NOT NULL,
  codigo_movimiento NVARCHAR(30)  NOT NULL,
  tipo_movimiento VARCHAR(20) NOT NULL,
  estado_movimiento VARCHAR(11) NOT NULL DEFAULT 'PROGRAMADO',
  fecha_despacho    DATETIME2(0) NULL,
  fecha_recepcion   DATETIME2(0) NULL,
  id_conexion       INT NOT NULL,
  id_usuario        INT NOT NULL,
  CONSTRAINT pk_movimiento PRIMARY KEY (id_movimiento),
  CONSTRAINT uq_movimiento_codigo UNIQUE (codigo_movimiento),
  CONSTRAINT ck_movimiento_fechas CHECK (fecha_recepcion IS NULL OR fecha_despacho IS NULL OR fecha_recepcion >= fecha_despacho),
  CONSTRAINT fk_mov_conexion FOREIGN KEY (id_conexion) REFERENCES conexion_logistica (id_conexion),
  CONSTRAINT fk_mov_user     FOREIGN KEY (id_usuario)  REFERENCES usuario (id_usuario),
  CONSTRAINT ck_movimiento_tipo_movimiento CHECK (tipo_movimiento IN ('TRANSFERENCIA', 'ENVIO_TRATAMIENTO', 'ENTREGA_BENEFICIARIO')),
  CONSTRAINT ck_movimiento_estado_movimiento CHECK (estado_movimiento IN ('PROGRAMADO', 'AUTORIZADO', 'EN_TRANSITO', 'CERRADO', 'ANULADO'))
);

-- Relacion muchos a muchos MOVIMIENTO - DISPOSITIVO (traslada)
CREATE TABLE movimiento_dispositivo (
  id_movimiento       INT NOT NULL,
  id_dispositivo      INT NOT NULL,
  peso_despachado_kg  DECIMAL(10,2) NULL,
  conforme            BIT NULL,
  CONSTRAINT pk_movimiento_dispositivo PRIMARY KEY (id_movimiento, id_dispositivo),
  CONSTRAINT ck_movdisp_peso CHECK (peso_despachado_kg IS NULL OR peso_despachado_kg >= 0),
  CONSTRAINT fk_movdisp_mov  FOREIGN KEY (id_movimiento)  REFERENCES movimiento (id_movimiento),
  CONSTRAINT fk_movdisp_disp FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo)
);

/* =====================================================================
   6. DESTINO, TRATAMIENTO, CIERRE Y EVIDENCIA
   ===================================================================== */

CREATE TABLE tratamiento (
  id_tratamiento   INT IDENTITY(1,1) NOT NULL,
  tipo_tratamiento VARCHAR(22) NOT NULL,
  fecha_inicio     DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  fecha_fin        DATETIME2(0) NULL,
  resultado VARCHAR(8) NOT NULL DEFAULT 'EN_CURSO',
  id_dispositivo   INT NOT NULL,
  CONSTRAINT pk_tratamiento PRIMARY KEY (id_tratamiento),
  CONSTRAINT ck_tratamiento_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
  CONSTRAINT fk_trat_disp FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo),
  CONSTRAINT ck_tratamiento_tipo_tratamiento CHECK (tipo_tratamiento IN ('REACONDICIONAMIENTO', 'RECICLAJE', 'DISPOSICION_CONTROLADA')),
  CONSTRAINT ck_tratamiento_resultado CHECK (resultado IN ('EN_CURSO', 'EXITOSO', 'FALLIDO'))
);

CREATE TABLE asignacion_beneficiario (
  id_asignacion    INT IDENTITY(1,1) NOT NULL,
  fecha_asignacion DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  fecha_entrega    DATETIME2(0) NULL,
  finalidad        NVARCHAR(255) NOT NULL,
  id_dispositivo   INT NOT NULL,
  id_organizacion  INT NOT NULL,
  CONSTRAINT pk_asignacion_beneficiario PRIMARY KEY (id_asignacion),
  CONSTRAINT ck_asig_fechas CHECK (fecha_entrega IS NULL OR fecha_entrega >= fecha_asignacion),
  CONSTRAINT fk_asig_disp FOREIGN KEY (id_dispositivo)  REFERENCES dispositivo (id_dispositivo),
  CONSTRAINT fk_asig_org  FOREIGN KEY (id_organizacion) REFERENCES organizacion (id_organizacion)
);

-- Relaciones alternativas: el cierre se sustenta en un tratamiento O en una asignacion, nunca en ambos
CREATE TABLE cierre_trazabilidad (
  id_cierre          INT IDENTITY(1,1) NOT NULL,
  fecha_confirmacion DATE NOT NULL,
  id_dispositivo     INT NOT NULL,
  id_tratamiento     INT NULL,
  id_asignacion      INT NULL,
  destino_final AS (CASE WHEN id_tratamiento IS NOT NULL THEN 'TRATAMIENTO' ELSE 'ASIGNACION_BENEFICIARIO' END),
  CONSTRAINT pk_cierre_trazabilidad PRIMARY KEY (id_cierre),
  CONSTRAINT uq_cierre_dispositivo UNIQUE (id_dispositivo),
  CONSTRAINT ck_cierre_alternativa CHECK (CASE WHEN id_tratamiento IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN id_asignacion IS NOT NULL THEN 1 ELSE 0 END = 1),
  CONSTRAINT fk_cierre_disp  FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo),
  CONSTRAINT fk_cierre_trat  FOREIGN KEY (id_tratamiento) REFERENCES tratamiento (id_tratamiento),
  CONSTRAINT fk_cierre_asig  FOREIGN KEY (id_asignacion)  REFERENCES asignacion_beneficiario (id_asignacion)
);

-- Cada evidencia respalda UNA sola entidad: recepcion, evaluacion tecnica, movimiento o cierre
CREATE TABLE evidencia (
  id_evidencia   INT IDENTITY(1,1) NOT NULL,
  tipo_evidencia VARCHAR(23) NOT NULL,
  descripcion    NVARCHAR(255) NULL,
  fecha_carga    DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  uri_archivo    NVARCHAR(500) NOT NULL,
  id_recepcion              INT NULL,
  id_dispositivo_evaluacion INT NULL,
  nro_evaluacion            INT NULL,
  id_movimiento             INT NULL,
  id_cierre                 INT NULL,
  CONSTRAINT pk_evidencia PRIMARY KEY (id_evidencia),
  CONSTRAINT ck_evidencia_eval_completa CHECK ((id_dispositivo_evaluacion IS NULL AND nro_evaluacion IS NULL) OR (id_dispositivo_evaluacion IS NOT NULL AND nro_evaluacion IS NOT NULL)),
  CONSTRAINT ck_evidencia_alternativa CHECK (CASE WHEN id_recepcion IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN id_dispositivo_evaluacion IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN id_movimiento IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN id_cierre IS NOT NULL THEN 1 ELSE 0 END = 1),
  CONSTRAINT fk_evid_recepcion FOREIGN KEY (id_recepcion) REFERENCES recepcion (id_recepcion),
  CONSTRAINT fk_evid_eval FOREIGN KEY (id_dispositivo_evaluacion, nro_evaluacion)
    REFERENCES evaluacion_tecnica (id_dispositivo, nro_evaluacion),
  CONSTRAINT fk_evid_mov    FOREIGN KEY (id_movimiento) REFERENCES movimiento (id_movimiento),
  CONSTRAINT fk_evid_cierre FOREIGN KEY (id_cierre)     REFERENCES cierre_trazabilidad (id_cierre),
  CONSTRAINT ck_evidencia_tipo_evidencia CHECK (tipo_evidencia IN ('FOTO_REGISTRO', 'ACTA_RECEPCION', 'INFORME_EVALUACION', 'GUIA_TRASLADO', 'CERTIFICADO_TRATAMIENTO', 'ACTA_ENTREGA'))
);

/* =====================================================================
   7. ESCENARIO DE RED Y RESULTADO DE FLUJO (flujo maximo)
   ===================================================================== */

CREATE TABLE escenario_red (
  id_escenario        INT IDENTITY(1,1) NOT NULL,
  codigo_escenario    NVARCHAR(30)  NOT NULL,
  nombre              NVARCHAR(120) NOT NULL,
  fecha_inicio_periodo DATE NOT NULL,
  fecha_fin_periodo    DATE NOT NULL,
  unidad_flujo VARCHAR(3) NOT NULL,
  estado_escenario VARCHAR(9) NOT NULL DEFAULT 'BORRADOR',
  CONSTRAINT pk_escenario_red PRIMARY KEY (id_escenario),
  CONSTRAINT uq_escenario_codigo UNIQUE (codigo_escenario),
  CONSTRAINT ck_escenario_periodo CHECK (fecha_fin_periodo >= fecha_inicio_periodo),
  CONSTRAINT ck_escenario_red_unidad_flujo CHECK (unidad_flujo IN ('UND', 'KG')),
  CONSTRAINT ck_escenario_red_estado_escenario CHECK (estado_escenario IN ('BORRADOR', 'VIGENTE', 'ARCHIVADO'))
);

-- Relacion muchos a muchos ESCENARIO_RED - CENTRO (incluye nodo)
CREATE TABLE escenario_nodo (
  id_escenario INT NOT NULL,
  id_centro    INT NOT NULL,
  rol_nodo VARCHAR(10) NOT NULL,
  oferta       DECIMAL(14,2) NULL,
  demanda      DECIMAL(14,2) NULL,
  CONSTRAINT pk_escenario_nodo PRIMARY KEY (id_escenario, id_centro),
  CONSTRAINT ck_esc_nodo_valores CHECK ((oferta IS NULL OR oferta >= 0) AND (demanda IS NULL OR demanda >= 0)),
  CONSTRAINT fk_escnodo_esc    FOREIGN KEY (id_escenario) REFERENCES escenario_red (id_escenario),
  CONSTRAINT fk_escnodo_centro FOREIGN KEY (id_centro)    REFERENCES centro (id_centro),
  CONSTRAINT ck_escenario_nodo_rol_nodo CHECK (rol_nodo IN ('FUENTE', 'SUMIDERO', 'INTERMEDIO'))
);

-- Relacion muchos a muchos ESCENARIO_RED - CONEXION_LOGISTICA (parametriza arista)
CREATE TABLE escenario_conexion (
  id_escenario        INT NOT NULL,
  id_conexion         INT NOT NULL,
  capacidad_escenario DECIMAL(14,2) NOT NULL,
  habilitada          BIT NOT NULL DEFAULT 1,
  CONSTRAINT pk_escenario_conexion PRIMARY KEY (id_escenario, id_conexion),
  CONSTRAINT ck_esc_con_cap CHECK (capacidad_escenario >= 0),
  CONSTRAINT fk_esccon_esc FOREIGN KEY (id_escenario) REFERENCES escenario_red (id_escenario),
  CONSTRAINT fk_esccon_con FOREIGN KEY (id_conexion)  REFERENCES conexion_logistica (id_conexion)
);

CREATE TABLE ejecucion_flujo (
  id_ejecucion         INT IDENTITY(1,1) NOT NULL,
  fecha_hora_ejecucion DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  algoritmo VARCHAR(14) NOT NULL,
  flujo_maximo         DECIMAL(14,2) NULL,
  estado_ejecucion VARCHAR(10) NOT NULL DEFAULT 'EN_PROCESO',
  id_escenario         INT NOT NULL,
  CONSTRAINT pk_ejecucion_flujo PRIMARY KEY (id_ejecucion),
  CONSTRAINT fk_ejec_esc FOREIGN KEY (id_escenario) REFERENCES escenario_red (id_escenario),
  CONSTRAINT ck_ejecucion_flujo_algoritmo CHECK (algoritmo IN ('FORD_FULKERSON', 'EDMONDS_KARP')),
  CONSTRAINT ck_ejecucion_flujo_estado_ejecucion CHECK (estado_ejecucion IN ('EN_PROCESO', 'COMPLETADA', 'FALLIDA'))
);

-- Entidad debil de EJECUCION_FLUJO. nro_resultado se numera solo (trigger)
CREATE TABLE resultado_flujo (
  id_ejecucion         INT NOT NULL,
  nro_resultado        INT NOT NULL DEFAULT 0,
  flujo_asignado       DECIMAL(14,2) NOT NULL,
  capacidad_considerada DECIMAL(14,2) NOT NULL,
  en_corte_minimo      BIT NOT NULL DEFAULT 0,
  id_conexion          INT NOT NULL,
  CONSTRAINT pk_resultado_flujo PRIMARY KEY (id_ejecucion, nro_resultado),
  CONSTRAINT uq_resultado_conexion UNIQUE (id_ejecucion, id_conexion),
  CONSTRAINT ck_resultado_valores CHECK (flujo_asignado >= 0 AND capacidad_considerada >= 0 AND flujo_asignado <= capacidad_considerada),
  CONSTRAINT fk_result_ejec FOREIGN KEY (id_ejecucion) REFERENCES ejecucion_flujo (id_ejecucion),
  CONSTRAINT fk_result_con  FOREIGN KEY (id_conexion)  REFERENCES conexion_logistica (id_conexion)
);

/* =====================================================================
   8. AUDITORIA, ALERTA E INDICADOR
   ===================================================================== */

CREATE TABLE auditoria_cambio (
  id_auditoria   BIGINT IDENTITY(1,1) NOT NULL,
  tabla_afectada NVARCHAR(64) NOT NULL,
  operacion VARCHAR(6) NOT NULL,
  clave_registro NVARCHAR(100) NOT NULL,
  valor_anterior NVARCHAR(MAX) NULL,
  valor_nuevo    NVARCHAR(MAX) NULL,
  fecha_hora     DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  id_usuario     INT NOT NULL,
  CONSTRAINT pk_auditoria_cambio PRIMARY KEY (id_auditoria),
  CONSTRAINT fk_audit_user FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
  CONSTRAINT ck_auditoria_valor_anterior CHECK (valor_anterior IS NULL OR ISJSON(valor_anterior) = 1),
  CONSTRAINT ck_auditoria_valor_nuevo CHECK (valor_nuevo IS NULL OR ISJSON(valor_nuevo) = 1),
  CONSTRAINT ck_auditoria_cambio_operacion CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE TABLE indicador (
  id_indicador     INT IDENTITY(1,1) NOT NULL,
  codigo_indicador NVARCHAR(30)  NOT NULL,
  nombre           NVARCHAR(120) NOT NULL,
  descripcion      NVARCHAR(255) NULL,
  unidad_medida    NVARCHAR(30)  NOT NULL,
  CONSTRAINT pk_indicador PRIMARY KEY (id_indicador),
  CONSTRAINT uq_indicador_codigo UNIQUE (codigo_indicador)
);

-- Entidad debil de INDICADOR: clave parcial = fecha_corte
CREATE TABLE medicion_indicador (
  id_indicador INT NOT NULL,
  fecha_corte  DATE NOT NULL,
  valor        DECIMAL(18,4) NOT NULL,
  CONSTRAINT pk_medicion_indicador PRIMARY KEY (id_indicador, fecha_corte),
  CONSTRAINT fk_medicion_ind FOREIGN KEY (id_indicador) REFERENCES indicador (id_indicador)
);

-- Relaciones alternativas: cada alerta se refiere a un centro, una conexion o un dispositivo
CREATE TABLE alerta (
  id_alerta        INT IDENTITY(1,1) NOT NULL,
  tipo_alerta VARCHAR(18) NOT NULL,
  severidad VARCHAR(5) NOT NULL,
  mensaje          NVARCHAR(255) NOT NULL,
  fecha_generacion DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  fecha_atencion   DATETIME2(0) NULL,
  id_centro        INT NULL,
  id_conexion      INT NULL,
  id_dispositivo   INT NULL,
  id_indicador     INT NULL,
  CONSTRAINT pk_alerta PRIMARY KEY (id_alerta),
  CONSTRAINT ck_alerta_alternativa CHECK (CASE WHEN id_centro IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN id_conexion IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN id_dispositivo IS NOT NULL THEN 1 ELSE 0 END = 1),
  CONSTRAINT ck_alerta_fechas CHECK (fecha_atencion IS NULL OR fecha_atencion >= fecha_generacion),
  CONSTRAINT fk_alerta_centro FOREIGN KEY (id_centro)      REFERENCES centro (id_centro),
  CONSTRAINT fk_alerta_con    FOREIGN KEY (id_conexion)    REFERENCES conexion_logistica (id_conexion),
  CONSTRAINT fk_alerta_disp   FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo),
  CONSTRAINT fk_alerta_ind    FOREIGN KEY (id_indicador)   REFERENCES indicador (id_indicador),
  CONSTRAINT ck_alerta_tipo_alerta CHECK (tipo_alerta IN ('CAPACIDAD', 'EVIDENCIA_FALTANTE', 'TIEMPO_EXCEDIDO', 'OTRA')),
  CONSTRAINT ck_alerta_severidad CHECK (severidad IN ('BAJA', 'MEDIA', 'ALTA'))
);

-- Un dispositivo solo puede tener UNA estancia abierta (una ubicacion actual).
-- En SQL Server esto se logra con un indice unico FILTRADO (la columna calculada de MySQL no sirve aqui).
CREATE UNIQUE INDEX uq_inventario_unica_abierta ON inventario (id_dispositivo) WHERE fecha_salida IS NULL;
-- Unicos que aceptan NULL: en SQL Server se usan indices unicos filtrados (MySQL permitia varios NULL).
CREATE UNIQUE INDEX uq_cierre_tratamiento ON cierre_trazabilidad (id_tratamiento) WHERE id_tratamiento IS NOT NULL;
CREATE UNIQUE INDEX uq_cierre_asignacion  ON cierre_trazabilidad (id_asignacion)  WHERE id_asignacion  IS NOT NULL;
CREATE INDEX idx_auditoria_tabla ON auditoria_cambio (tabla_afectada, clave_registro);

GO

/* =====================================================================
   9. VISTAS (atributos derivados del modelo)
   ===================================================================== */
GO
-- /estado_actual de DISPOSITIVO = ultimo cambio de su historial
CREATE OR ALTER VIEW v_dispositivo_estado_actual AS
SELECT d.id_dispositivo,
       d.codigo_trazabilidad,
       h.estado_nuevo AS estado_actual,
       h.fecha_hora   AS fecha_estado
FROM dispositivo d
LEFT JOIN historial_estado h
  ON h.id_dispositivo = d.id_dispositivo
 AND h.nro_cambio = (SELECT MAX(h2.nro_cambio) FROM historial_estado h2
                     WHERE h2.id_dispositivo = d.id_dispositivo);
GO

-- Ubicacion actual = estancia de inventario sin fecha de salida
CREATE OR ALTER VIEW v_dispositivo_ubicacion_actual AS
SELECT i.id_dispositivo,
       d.codigo_trazabilidad,
       c.id_centro,
       c.codigo_centro,
       c.nombre AS nombre_centro,
       i.fecha_ingreso
FROM inventario i
JOIN dispositivo d ON d.id_dispositivo = i.id_dispositivo
JOIN centro c      ON c.id_centro = i.id_centro
WHERE i.fecha_salida IS NULL;
GO

/* =====================================================================
   10. TRIGGERS: numeracion automatica de las claves parciales
       Las entidades debiles se numeran dentro de su dueno (1, 2, 3...).
       Si el backend envia el numero en 0 (o NULL), la BD calcula el siguiente.
       En SQL Server no existe BEFORE INSERT: se usa INSTEAD OF INSERT.
       UPDLOCK + HOLDLOCK evitan que dos inserciones simultaneas tomen el mismo numero.
   ===================================================================== */
CREATE OR ALTER TRIGGER trg_evaluacion_nro ON evaluacion_tecnica
INSTEAD OF INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO evaluacion_tecnica (id_dispositivo, nro_evaluacion, fecha_hora, condicion_constatada, diagnostico, id_usuario, id_clasificacion)
  SELECT
    i.id_dispositivo,
    CASE WHEN ISNULL(i.nro_evaluacion, 0) = 0 THEN
      ISNULL((SELECT MAX(t.nro_evaluacion) FROM evaluacion_tecnica t WITH (UPDLOCK, HOLDLOCK) WHERE t.id_dispositivo = i.id_dispositivo), 0)
      + ROW_NUMBER() OVER (PARTITION BY i.id_dispositivo, CASE WHEN ISNULL(i.nro_evaluacion, 0) = 0 THEN 0 ELSE 1 END ORDER BY (SELECT NULL))
    ELSE i.nro_evaluacion END,
    ISNULL(i.fecha_hora, SYSDATETIME()),
    i.condicion_constatada,
    i.diagnostico,
    i.id_usuario,
    i.id_clasificacion
  FROM inserted i;
END
GO
CREATE OR ALTER TRIGGER trg_historial_nro ON historial_estado
INSTEAD OF INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO historial_estado (id_dispositivo, nro_cambio, estado_anterior, estado_nuevo, fecha_hora, observacion, id_usuario)
  SELECT
    i.id_dispositivo,
    CASE WHEN ISNULL(i.nro_cambio, 0) = 0 THEN
      ISNULL((SELECT MAX(t.nro_cambio) FROM historial_estado t WITH (UPDLOCK, HOLDLOCK) WHERE t.id_dispositivo = i.id_dispositivo), 0)
      + ROW_NUMBER() OVER (PARTITION BY i.id_dispositivo, CASE WHEN ISNULL(i.nro_cambio, 0) = 0 THEN 0 ELSE 1 END ORDER BY (SELECT NULL))
    ELSE i.nro_cambio END,
    i.estado_anterior,
    i.estado_nuevo,
    ISNULL(i.fecha_hora, SYSDATETIME()),
    i.observacion,
    i.id_usuario
  FROM inserted i;
END
GO
CREATE OR ALTER TRIGGER trg_inventario_nro ON inventario
INSTEAD OF INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO inventario (id_dispositivo, nro_estancia, fecha_ingreso, fecha_salida, motivo_ingreso, id_centro)
  SELECT
    i.id_dispositivo,
    CASE WHEN ISNULL(i.nro_estancia, 0) = 0 THEN
      ISNULL((SELECT MAX(t.nro_estancia) FROM inventario t WITH (UPDLOCK, HOLDLOCK) WHERE t.id_dispositivo = i.id_dispositivo), 0)
      + ROW_NUMBER() OVER (PARTITION BY i.id_dispositivo, CASE WHEN ISNULL(i.nro_estancia, 0) = 0 THEN 0 ELSE 1 END ORDER BY (SELECT NULL))
    ELSE i.nro_estancia END,
    ISNULL(i.fecha_ingreso, SYSDATETIME()),
    i.fecha_salida,
    i.motivo_ingreso,
    i.id_centro
  FROM inserted i;
END
GO
CREATE OR ALTER TRIGGER trg_resultado_nro ON resultado_flujo
INSTEAD OF INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO resultado_flujo (id_ejecucion, nro_resultado, flujo_asignado, capacidad_considerada, en_corte_minimo, id_conexion)
  SELECT
    i.id_ejecucion,
    CASE WHEN ISNULL(i.nro_resultado, 0) = 0 THEN
      ISNULL((SELECT MAX(t.nro_resultado) FROM resultado_flujo t WITH (UPDLOCK, HOLDLOCK) WHERE t.id_ejecucion = i.id_ejecucion), 0)
      + ROW_NUMBER() OVER (PARTITION BY i.id_ejecucion, CASE WHEN ISNULL(i.nro_resultado, 0) = 0 THEN 0 ELSE 1 END ORDER BY (SELECT NULL))
    ELSE i.nro_resultado END,
    i.flujo_asignado,
    i.capacidad_considerada,
    i.en_corte_minimo,
    i.id_conexion
  FROM inserted i;
END
GO

/* =====================================================================
   11. DATOS INICIALES (catalogos que el backend necesita desde el primer dia)
   ===================================================================== */

INSERT INTO rol (nombre_rol, descripcion) VALUES
  ('GENERADOR',                    'Entrega residuos electronicos y registra lotes'),
  ('OPERADOR_CENTRO',              'Recibe e inventaria dispositivos en un centro'),
  ('TECNICO_EVALUADOR',            'Evalua y clasifica dispositivos'),
  ('COORDINADOR_LOGISTICO',        'Programa y autoriza movimientos entre centros'),
  ('REACONDICIONADOR_RECICLADOR',  'Aplica tratamientos de reacondicionamiento o reciclaje'),
  ('ENTIDAD_BENEFICIARIA',         'Recibe dispositivos reacondicionados'),
  ('ADMINISTRADOR',                'Gestiona usuarios, roles y parametros del sistema');

INSERT INTO clasificacion (nombre_clasificacion, permite_asignacion) VALUES
  ('REUTILIZABLE',   1),
  ('REPARABLE',      0),
  ('RECICLABLE',     0),
  ('NO_RECUPERABLE', 0);

INSERT INTO categoria_dispositivo (nombre_categoria, descripcion) VALUES
  ('LAPTOP',       'Computadoras portatiles'),
  ('CELULAR',      'Telefonos moviles y tablets'),
  ('MONITOR',      'Monitores y pantallas'),
  ('PERIFERICOS',  'Teclados, mouse, impresoras y similares'),
  ('CABLES',       'Cables, cargadores y adaptadores'),
  ('OTROS',        'Otros equipos electronicos');
GO

SET NOEXEC OFF;
GO
PRINT 'Base de datos ecoraee_cloud lista.';
GO
