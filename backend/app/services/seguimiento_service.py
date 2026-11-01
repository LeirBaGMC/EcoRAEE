"""Indicadores y alertas (M-07).
PROPUESTA: los indicadores son agregados de TODA la red (medicion_indicador no guarda organizacion).
Las alertas si se filtran por la organizacion del usuario, salvo el administrador que ve todas."""
from datetime import date, datetime
from decimal import Decimal

from ..db import transaccion
from ..domain import movimiento as dm
from ..domain import seguimiento as sg
from ..domain.errors import ConflictoError, NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..persistence import movimientos as repo_m
from ..persistence import seguimiento as repo
from ..security import Actor


def _todos(actor: Actor) -> bool:
    return "ADMINISTRADOR" in actor.roles


# ---------------- indicadores ----------------
def calcular_indicadores(actor: Actor) -> list:
    exigir_permiso(actor.roles, "indicador:calcular")
    with transaccion() as s:
        ids = repo.asegurar_catalogo(s, sg.CATALOGO_INDICADORES)
        c = repo.conteos(s)
        valores = {"IND-01": Decimal(c["total"]), "IND-02": sg.porcentaje(c["evaluados"], c["total"]),
                   "IND-03": sg.porcentaje(c["reutilizables"], c["evaluados"]), "IND-04": Decimal(c["mov_cerrados"]),
                   "IND-05": Decimal(c["cierres"]), "IND-06": Decimal(c["evidencias"])}
        hoy = date.today()
        for codigo, valor in valores.items():
            repo.guardar_medicion(s, ids[codigo], hoy, valor)
        return repo.ultimas_mediciones(s)


def listar_indicadores(actor: Actor) -> list:
    exigir_permiso(actor.roles, "indicador:ver")
    with transaccion() as s:
        return repo.ultimas_mediciones(s)


def historial_indicador(actor: Actor, codigo: str) -> list:
    exigir_permiso(actor.roles, "indicador:ver")
    with transaccion() as s:
        if not repo.indicador_existe(s, codigo):
            raise NoEncontradoError("Indicador no encontrado")
        return repo.historial(s, codigo)


# ---------------- alertas ----------------
def evaluar_alertas(actor: Actor) -> dict:
    """Genera alertas a partir del estado actual. No duplica una alerta igual que siga abierta."""
    exigir_permiso(actor.roles, "alerta:evaluar")
    todos, org, ahora = _todos(actor), actor.id_organizacion, datetime.now()
    creadas = {"CAPACIDAD": 0, "EVIDENCIA_FALTANTE": 0, "TIEMPO_EXCEDIDO": 0}

    def nueva(tipo, sev, msg, **objetivo):
        if sev and not repo.existe_abierta(s, tipo, msg):
            repo.crear(s, tipo, sev, msg, **objetivo)
            creadas[tipo] += 1

    with transaccion() as s:
        desde, hasta = dm.periodo_de(date.today())
        for c in repo.conexiones_activas(s, org, todos):
            usado = Decimal(repo_m.comprometido(s, c["id_conexion"], c["unidad_capacidad"], desde, hasta))
            sev = sg.severidad_capacidad(usado, c["capacidad_por_periodo"])
            nueva("CAPACIDAD", sev, f"Conexion {c['id_conexion']} al {sg.porcentaje(usado, c['capacidad_por_periodo'])}% de su capacidad "
                                    f"({usado} de {c['capacidad_por_periodo']} {c['unidad_capacidad']}) en {desde:%Y-%m}", id_conexion=c["id_conexion"])
        for m in repo.movimientos_en_transito(s, org, todos):
            if m["guias"] == 0:
                nueva("EVIDENCIA_FALTANTE", "MEDIA", f"Movimiento {m['codigo_movimiento']} en transito sin guia de traslado",
                      id_conexion=m["id_conexion"])
            if m["fecha_despacho"]:
                nueva("TIEMPO_EXCEDIDO", sg.severidad_tiempo(m["fecha_despacho"], ahora, sg.DIAS_MAX_EN_TRANSITO),
                      f"Movimiento {m['codigo_movimiento']} lleva mas de {sg.DIAS_MAX_EN_TRANSITO} dias en transito", id_conexion=m["id_conexion"])
        for d in repo.dispositivos_recibidos_sin_evaluar(s, org, todos):
            nueva("TIEMPO_EXCEDIDO", sg.severidad_tiempo(d["fecha_estado"], ahora, sg.DIAS_MAX_SIN_EVALUAR),
                  f"Dispositivo {d['codigo_trazabilidad']} recibido hace mas de {sg.DIAS_MAX_SIN_EVALUAR} dias sin evaluar",
                  id_dispositivo=d["id_dispositivo"])
    return {"creadas": creadas, "total_creadas": sum(creadas.values())}


def listar_alertas(actor: Actor, pagina: int, tamano: int, solo_abiertas: bool = True) -> dict:
    exigir_permiso(actor.roles, "alerta:ver")
    if pagina < 1 or tamano < 1 or tamano > 100:
        raise ReglaNegocioError("pagina >= 1 y tamano entre 1 y 100")
    with transaccion() as s:
        total, filas = repo.listar(s, actor.id_organizacion, _todos(actor), solo_abiertas, (pagina - 1) * tamano, tamano)
    return {"items": filas, "total": total, "pagina": pagina, "tamano": tamano}


def atender_alerta(actor: Actor, id_alerta: int) -> dict:
    exigir_permiso(actor.roles, "alerta:evaluar")
    with transaccion() as s:
        a = repo.obtener_visible(s, id_alerta, actor.id_organizacion, _todos(actor))
        if a is None:
            raise NoEncontradoError("Alerta no encontrada")
        if a["fecha_atencion"] is not None:
            raise ConflictoError("La alerta ya fue atendida")
        repo.atender(s, id_alerta)
    return {"id_alerta": id_alerta, "atendida": True}
