from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    nombre_usuario: str = Field(min_length=1, max_length=60)
    contrasena: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PerfilOut(BaseModel):
    id_usuario: int
    nombre_usuario: str
    nombre_visible: str
    roles: list[str]
    id_organizacion: Optional[int] = None


class DispositivoIn(BaseModel):
    tipo_registro: Literal["INDIVIDUAL", "GRANEL"]
    id_categoria: int
    condicion_declarada: Literal["ENCIENDE", "NO_ENCIENDE", "DANO_FISICO", "INCOMPLETO"]
    marca: Optional[str] = Field(default=None, max_length=60)
    modelo: Optional[str] = Field(default=None, max_length=60)
    numero_serie: Optional[str] = Field(default=None, max_length=60)
    peso_kg: Optional[Decimal] = None
    cantidad_unidades: Optional[int] = None


class DispositivoOut(BaseModel):
    id_dispositivo: int
    codigo_trazabilidad: str
    estado: str


# ---- Bloque 1 ----
from datetime import date, datetime  # noqa: E402
from typing import List  # noqa: E402


class LoteIn(BaseModel):
    ids_dispositivos: List[int] = Field(min_length=1, max_length=500)


class LoteOut(BaseModel):
    id_lote: int
    codigo_lote: str
    estado_lote: str
    total_dispositivos: int


class LoteEliminadoOut(BaseModel):
    id_lote: int
    eliminado: bool
    dispositivos_liberados: int


class SolicitudIn(BaseModel):
    id_lote: int
    modalidad: Literal["RECOLECCION", "ENTREGA_DIRECTA"]
    zona_referencial: str = Field(min_length=1, max_length=120)


class SolicitudOut(BaseModel):
    id_solicitud: int
    codigo_solicitud: str
    estado_solicitud: str
    id_lote: int


class RecepcionIn(BaseModel):
    id_solicitud: int
    id_centro: int
    peso_recibido_kg: Decimal = Field(ge=0)
    unidades_recibidas: int = Field(ge=0)
    conforme: bool


class RecepcionOut(BaseModel):
    id_recepcion: int
    id_solicitud: int
    id_centro: int
    conforme: bool
    dispositivos_recibidos: int


class EvaluacionIn(BaseModel):
    condicion_constatada: Literal["ENCIENDE", "NO_ENCIENDE", "DANO_FISICO", "INCOMPLETO"]
    diagnostico: str = Field(min_length=1, max_length=2000)
    id_clasificacion: int


class EvaluacionOut(BaseModel):
    id_dispositivo: int
    nro_evaluacion: int
    clasificacion: str
    permite_asignacion: bool
    estado_actual: str


class UltimoTratamiento(BaseModel):
    id_tratamiento: int
    tipo_tratamiento: str
    resultado: str
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None


class DispositivoDetalle(BaseModel):
    id_dispositivo: int
    codigo_trazabilidad: str
    tipo_registro: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    condicion_declarada: str
    fecha_registro: datetime
    estado_actual: Optional[str] = None
    id_centro: Optional[int] = None
    nombre_centro: Optional[str] = None
    id_categoria: Optional[int] = None
    nombre_categoria: Optional[str] = None
    numero_serie: Optional[str] = None
    peso_kg: Optional[Decimal] = None
    cantidad_unidades: Optional[int] = None
    nombre_clasificacion: Optional[str] = None
    permite_asignacion: Optional[bool] = None
    diagnostico: Optional[str] = None
    ultima_evaluacion_fecha: Optional[datetime] = None
    ultimo_tratamiento: Optional[UltimoTratamiento] = None


class DispositivosPagina(BaseModel):
    items: List[DispositivoDetalle]
    total: int
    pagina: int
    tamano: int


class HistorialItem(BaseModel):
    nro_cambio: int
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    fecha_hora: datetime
    observacion: Optional[str] = None
    id_usuario: int


# ---- Bloque 2: movimientos ----
class ItemMovimientoIn(BaseModel):
    id_dispositivo: int
    peso_despachado_kg: Optional[Decimal] = Field(default=None, gt=0)


class MovimientoIn(BaseModel):
    id_conexion: int
    tipo_movimiento: Literal["TRANSFERENCIA", "ENVIO_TRATAMIENTO", "ENTREGA_BENEFICIARIO"]
    fecha_despacho: date
    dispositivos: List[ItemMovimientoIn] = Field(min_length=1, max_length=500)


class MovimientoOut(BaseModel):
    id_movimiento: int
    codigo_movimiento: str
    tipo_movimiento: str
    estado_movimiento: str
    id_conexion: int
    fecha_despacho: Optional[datetime] = None
    repetido: bool = False
    cantidad: Optional[Decimal] = None
    unidad: Optional[str] = None
    capacidad_restante_periodo: Optional[Decimal] = None
    id_centro_origen: Optional[int] = None
    id_centro_destino: Optional[int] = None
    nombre_centro_origen: Optional[str] = None
    nombre_centro_destino: Optional[str] = None
    id_responsable: Optional[int] = None
    nombre_responsable: Optional[str] = None
    cantidad_total: Optional[Decimal] = None
    unidad_capacidad: Optional[str] = None


class ItemMovimientoOut(BaseModel):
    id_dispositivo: int
    peso_despachado_kg: Optional[Decimal] = None
    conforme: Optional[bool] = None
    codigo_trazabilidad: Optional[str] = None
    tipo_registro: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    cantidad_unidades: Optional[int] = None
    peso_kg: Optional[Decimal] = None
    cantidad_capacidad: Optional[Decimal] = None


class MovimientoDetalle(MovimientoOut):
    id_centro_origen: int
    id_centro_destino: int
    fecha_recepcion: Optional[datetime] = None
    id_responsable: int
    dispositivos: List[ItemMovimientoOut]


class MovimientosPagina(BaseModel):
    items: List[MovimientoOut]
    total: int
    pagina: int
    tamano: int


class ConformeIn(BaseModel):
    id_dispositivo: int
    conforme: bool


class CierreMovimientoIn(BaseModel):
    conformes: List[ConformeIn] = []


# ---- Bloque 1 (cierre): recoleccion y lecturas ----
class RecoleccionIn(BaseModel):
    fecha_programada: date


class RecoleccionOut(BaseModel):
    id_recoleccion: int
    id_solicitud: int
    estado_solicitud: str
    fecha_programada: date
    fecha_ejecucion: Optional[date] = None


class LoteDetalle(BaseModel):
    id_lote: int
    codigo_lote: str
    estado_lote: str
    id_organizacion: int
    dispositivos: List[int]


class SolicitudItem(BaseModel):
    id_solicitud: int
    codigo_solicitud: str
    modalidad: str
    estado_solicitud: str
    zona_referencial: str
    fecha_solicitud: datetime
    fecha_programada: Optional[datetime] = None
    fecha_ejecucion: Optional[datetime] = None
    id_lote: int


class SolicitudesPagina(BaseModel):
    items: List[SolicitudItem]
    total: int
    pagina: int
    tamano: int


# ---- Bloque 3: tratamiento, asignacion, cierre ----
class TratamientoIn(BaseModel):
    id_dispositivo: int
    tipo_tratamiento: Literal["REACONDICIONAMIENTO", "RECICLAJE", "DISPOSICION_CONTROLADA"]


class TratamientoFinIn(BaseModel):
    resultado: Literal["EXITOSO", "FALLIDO"]


class TratamientoOut(BaseModel):
    id_tratamiento: int
    id_dispositivo: int
    tipo_tratamiento: str
    resultado: str
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    codigo_trazabilidad: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None


class TratamientosPagina(BaseModel):
    items: List[TratamientoOut]
    total: int
    pagina: int
    tamano: int


class AsignacionIn(BaseModel):
    id_dispositivo: int
    id_organizacion_beneficiaria: int
    finalidad: str = Field(min_length=1, max_length=255)


class AsignacionOut(BaseModel):
    id_asignacion: int
    id_dispositivo: int
    id_organizacion: int
    entregada: bool
    finalidad: Optional[str] = None
    fecha_asignacion: Optional[datetime] = None
    fecha_entrega: Optional[datetime] = None
    codigo_trazabilidad: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    nombre_organizacion: Optional[str] = None
    ruc_organizacion: Optional[str] = None


class AsignacionesPagina(BaseModel):
    items: List[AsignacionOut]
    total: int
    pagina: int
    tamano: int


class CierreIn(BaseModel):
    id_dispositivo: int
    id_tratamiento: Optional[int] = None
    id_asignacion: Optional[int] = None
    fecha_confirmacion: date


class CierreOut(BaseModel):
    id_cierre: int
    id_dispositivo: int
    destino_final: str
    fecha_confirmacion: date
    lotes_cerrados: List[int] = []


class CierreDetalle(BaseModel):
    id_cierre: int
    id_dispositivo: int
    fecha_confirmacion: date
    id_tratamiento: Optional[int] = None
    id_asignacion: Optional[int] = None
    destino_final: str


# ---- Bloque 4: evidencias ----
class EvidenciaOut(BaseModel):
    id_evidencia: int
    tipo_evidencia: str
    descripcion: Optional[str] = None
    fecha_carga: datetime
    id_recepcion: Optional[int] = None
    id_dispositivo_evaluacion: Optional[int] = None
    nro_evaluacion: Optional[int] = None
    id_movimiento: Optional[int] = None
    id_cierre: Optional[int] = None


# ---- Bloque 4: escenarios y flujo maximo ----
class NodoIn(BaseModel):
    id_centro: int
    rol_nodo: Literal["FUENTE", "SUMIDERO", "INTERMEDIO"]
    oferta: Optional[Decimal] = Field(default=None, ge=0)
    demanda: Optional[Decimal] = Field(default=None, ge=0)


class ConexionEscenarioIn(BaseModel):
    id_conexion: int
    capacidad_escenario: Optional[Decimal] = Field(default=None, ge=0)
    habilitada: bool = True


class EscenarioIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    fecha_inicio_periodo: date
    fecha_fin_periodo: date
    unidad_flujo: Literal["UND", "KG"]
    nodos: List[NodoIn] = Field(min_length=2)
    conexiones: Optional[List[ConexionEscenarioIn]] = None   # si se omite: conexiones activas de esa unidad entre los nodos


class EscenarioOut(BaseModel):
    id_escenario: int
    codigo_escenario: str
    estado_escenario: str
    total_nodos: int
    total_conexiones: int


class EscenarioResumen(BaseModel):
    id_escenario: int
    codigo_escenario: str
    nombre: str
    fecha_inicio_periodo: date
    fecha_fin_periodo: date
    unidad_flujo: str
    estado_escenario: str


class EscenarioDetalle(EscenarioResumen):
    nodos: List[dict]
    conexiones: List[dict]


class EscenariosPagina(BaseModel):
    items: List[EscenarioResumen]
    total: int
    pagina: int
    tamano: int


class EstadoEscenarioIn(BaseModel):
    estado: Literal["VIGENTE", "ARCHIVADO"]


class EjecutarFlujoIn(BaseModel):
    algoritmo: Literal["EDMONDS_KARP", "FORD_FULKERSON"] = "EDMONDS_KARP"


class ResultadoConexion(BaseModel):
    id_conexion: int
    flujo_asignado: Decimal
    capacidad_considerada: Decimal
    en_corte_minimo: bool


class EjecucionOut(BaseModel):
    id_ejecucion: int
    algoritmo: str
    escenario: str
    unidad: str
    periodo: dict
    flujo_maximo: Decimal
    capacidad_corte: Decimal
    corte_minimo: List[int]
    ofertas_limitantes: List[int]
    demandas_limitantes: List[int]
    huella_datos: str
    interpretacion: str
    resultados: List[ResultadoConexion]


class EjecucionResumen(BaseModel):
    id_ejecucion: int
    fecha_hora_ejecucion: datetime
    algoritmo: str
    flujo_maximo: Optional[Decimal] = None
    estado_ejecucion: str
    id_escenario: int


class EjecucionDetalle(EjecucionResumen):
    resultados: List[ResultadoConexion]


# ---- Bloque 4: indicadores y alertas ----
class IndicadorOut(BaseModel):
    codigo_indicador: str
    nombre: str
    descripcion: Optional[str] = None
    unidad_medida: str
    fecha_corte: Optional[date] = None
    valor: Optional[Decimal] = None


class MedicionOut(BaseModel):
    fecha_corte: date
    valor: Decimal


class AlertaOut(BaseModel):
    id_alerta: int
    tipo_alerta: str
    severidad: str
    mensaje: str
    fecha_generacion: datetime
    fecha_atencion: Optional[datetime] = None
    id_centro: Optional[int] = None
    id_conexion: Optional[int] = None
    id_dispositivo: Optional[int] = None


class AlertasPagina(BaseModel):
    items: List[AlertaOut]
    total: int
    pagina: int
    tamano: int


class EvaluarAlertasOut(BaseModel):
    creadas: dict
    total_creadas: int


# ---- Cierre: administracion ----
class UsuarioIn(BaseModel):
    correo: str = Field(max_length=150)
    nombre_usuario: str = Field(min_length=3, max_length=50)
    nombre_visible: str = Field(min_length=1, max_length=120)
    contrasena: str = Field(min_length=10, max_length=128)
    roles: List[str] = Field(min_length=1)
    id_organizacion: int


class UsuarioOut(BaseModel):
    id_usuario: int
    correo: str
    nombre_usuario: str
    nombre_visible: str
    activo: bool
    id_organizacion: int
    roles: List[str]


class UsuariosPagina(BaseModel):
    items: List[UsuarioOut]
    total: int
    pagina: int
    tamano: int


class RolesIn(BaseModel):
    roles: List[str] = Field(min_length=1)


class ActivoIn(BaseModel):
    activo: bool


class OrganizacionIn(BaseModel):
    ruc: str = Field(min_length=13, max_length=13)
    nombre: str = Field(min_length=1, max_length=150)
    tipo_persona: Literal["JURIDICA", "NATURAL"]
    ciudad: str = Field(min_length=1, max_length=80)
    tipos_actor: List[Literal["GENERADOR", "OPERADOR", "REACONDICIONADOR", "RECICLADOR", "BENEFICIARIO", "COORDINADOR"]] = Field(min_length=1)


class OrganizacionOut(BaseModel):
    id_organizacion: int
    ruc: str
    nombre: str
    tipo_persona: str
    ciudad: str


class OrganizacionesPagina(BaseModel):
    items: List[OrganizacionOut]
    total: int
    pagina: int
    tamano: int


class CentroIn(BaseModel):
    codigo_centro: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=120)
    tipo_centro: Literal["RECOLECCION", "REACONDICIONAMIENTO", "RECICLAJE", "DISPOSICION", "SEDE_BENEFICIARIA"]
    ciudad: str = Field(min_length=1, max_length=80)
    capacidad_almacenamiento: Decimal = Field(default=Decimal(0), ge=0)
    id_organizacion: int


class CentroOut(BaseModel):
    id_centro: int
    codigo_centro: str
    nombre: str
    tipo_centro: str
    ciudad: str
    capacidad_almacenamiento: Decimal
    id_organizacion: int


class ConexionIn(BaseModel):
    id_centro_origen: int
    id_centro_destino: int
    capacidad_por_periodo: Decimal = Field(ge=0)
    unidad_capacidad: Literal["UND", "KG"]


class ConexionOut(BaseModel):
    id_conexion: int
    id_centro_origen: int
    id_centro_destino: int
    capacidad_por_periodo: Decimal
    unidad_capacidad: str
    activa: bool


class CapacidadConexionIn(BaseModel):
    model_config = {"extra": "forbid"}
    capacidad_por_periodo: Decimal = Field(ge=0, max_digits=14, decimal_places=2)


class AuditoriaItem(BaseModel):
    id_auditoria: int
    tabla_afectada: str
    operacion: str
    clave_registro: str
    valor_anterior: Optional[dict] = None
    valor_nuevo: Optional[dict] = None
    fecha_hora: datetime
    id_usuario: int


class AuditoriaPagina(BaseModel):
    items: List[AuditoriaItem]
    total: int
    pagina: int
    tamano: int
