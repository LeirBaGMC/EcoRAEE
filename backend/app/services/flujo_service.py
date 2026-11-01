"""Escenarios de red y ejecucion del flujo maximo (M-06).
PROPUESTA de alcance: un escenario es visible si alguno de sus centros es de la organizacion del usuario
(la tabla escenario_red no guarda organizacion ni autor)."""
import uuid
from datetime import date
from typing import List, Optional

from ..db import transaccion
from ..domain import flujo_maximo as fm
from ..domain.errors import ConflictoError, NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..integrations import modulo_matematico as mm
from ..persistence import auditoria
from ..persistence import red as repo
from ..security import Actor

ROLES_NODO = ("FUENTE", "SUMIDERO", "INTERMEDIO")
UNIDADES = ("UND", "KG")


def _todos(actor: Actor) -> bool:
    return "ADMINISTRADOR" in actor.roles


def crear_escenario(actor: Actor, nombre: str, inicio: date, fin: date, unidad: str, nodos: List[dict],
                    conexiones: Optional[List[dict]]) -> dict:
    exigir_permiso(actor.roles, "escenario:gestionar")
    if unidad not in UNIDADES:
        raise ReglaNegocioError("unidad_flujo debe ser UND o KG")
    if fin < inicio:
        raise ReglaNegocioError("La fecha fin no puede ser anterior a la de inicio")
    ids = [n["id_centro"] for n in nodos]
    if not nodos or len(set(ids)) != len(ids):
        raise ReglaNegocioError("Indica los nodos sin repetir centros")
    for n in nodos:
        if n["rol_nodo"] not in ROLES_NODO:
            raise ReglaNegocioError("rol_nodo debe ser FUENTE, SUMIDERO o INTERMEDIO")
        for k in ("oferta", "demanda"):
            if n.get(k) is not None and n[k] < 0:
                raise ReglaNegocioError(f"{k} no puede ser negativa")
    if not any(n["rol_nodo"] == "FUENTE" for n in nodos) or not any(n["rol_nodo"] == "SUMIDERO" for n in nodos):
        raise ReglaNegocioError("El escenario necesita al menos una FUENTE y un SUMIDERO")
    with transaccion() as s:
        orgs = repo.organizaciones_de_centros(s, ids)
        if set(orgs) != set(ids):
            raise ReglaNegocioError("Algunos centros no existen")
        if actor.id_organizacion not in orgs.values() and not _todos(actor):
            raise ReglaNegocioError("El escenario debe incluir al menos un centro de tu organizacion")
        if conexiones is None:   # por defecto: las conexiones activas de esa unidad que unen los nodos del escenario
            disponibles = repo.listar_conexiones(s, actor.id_organizacion, _todos(actor), activas_unidad=unidad)
            conexiones = [{"id_conexion": c["id_conexion"], "capacidad_escenario": c["capacidad_por_periodo"], "habilitada": True}
                          for c in disponibles if c["id_centro_origen"] in orgs and c["id_centro_destino"] in orgs]
        else:
            existentes = repo.obtener_conexiones(s, [c["id_conexion"] for c in conexiones]) if conexiones else {}
            for c in conexiones:
                x = existentes.get(c["id_conexion"])
                if x is None:
                    raise ReglaNegocioError(f"La conexion {c['id_conexion']} no existe")
                if x["unidad_capacidad"] != unidad:
                    raise ReglaNegocioError(f"La conexion {c['id_conexion']} esta en {x['unidad_capacidad']}, no en {unidad}")
                if x["id_centro_origen"] not in orgs or x["id_centro_destino"] not in orgs:
                    raise ReglaNegocioError(f"La conexion {c['id_conexion']} usa centros que no estan en el escenario")
                if c.get("capacidad_escenario") is None:
                    c["capacidad_escenario"] = x["capacidad_por_periodo"]
                if c["capacidad_escenario"] < 0:
                    raise ReglaNegocioError("capacidad_escenario no puede ser negativa")
        if not conexiones:
            raise ReglaNegocioError("No hay conexiones para el escenario")
        codigo = "ESC-" + uuid.uuid4().hex[:12].upper()
        id_esc = repo.crear_escenario(s, codigo, nombre, inicio, fin, unidad)
        repo.agregar_nodos(s, id_esc, nodos)
        repo.agregar_conexiones(s, id_esc, conexiones)
        auditoria.registrar(s, "escenario_red", "INSERT", id_esc, None, {"codigo": codigo, "unidad": unidad}, actor.id_usuario)
    return {"id_escenario": id_esc, "codigo_escenario": codigo, "estado_escenario": "BORRADOR",
            "total_nodos": len(nodos), "total_conexiones": len(conexiones)}


def _escenario(s, actor: Actor, id_esc: int, bloquear: bool = False) -> dict:
    e = repo.escenario_visible(s, id_esc, actor.id_organizacion, _todos(actor), bloquear)
    if e is None:
        raise NoEncontradoError("Escenario no encontrado")
    return e


def obtener_escenario(actor: Actor, id_esc: int) -> dict:
    exigir_permiso(actor.roles, "flujo:ver")
    with transaccion() as s:
        e = _escenario(s, actor, id_esc)
        e["nodos"] = repo.nodos_de(s, id_esc)
        e["conexiones"] = repo.conexiones_de(s, id_esc)
        return e


def listar_escenarios(actor: Actor, pagina: int, tamano: int) -> dict:
    exigir_permiso(actor.roles, "flujo:ver")
    if pagina < 1 or tamano < 1 or tamano > 100:
        raise ReglaNegocioError("pagina >= 1 y tamano entre 1 y 100")
    with transaccion() as s:
        total, filas = repo.listar_escenarios(s, actor.id_organizacion, _todos(actor), (pagina - 1) * tamano, tamano)
    return {"items": filas, "total": total, "pagina": pagina, "tamano": tamano}


def cambiar_estado(actor: Actor, id_esc: int, estado: str) -> dict:
    exigir_permiso(actor.roles, "escenario:gestionar")
    if estado not in ("VIGENTE", "ARCHIVADO"):
        raise ReglaNegocioError("estado debe ser VIGENTE o ARCHIVADO")
    with transaccion() as s:
        e = _escenario(s, actor, id_esc, bloquear=True)
        if e["estado_escenario"] == "ARCHIVADO":
            raise ConflictoError("Un escenario archivado no cambia de estado")
        repo.cambiar_estado_escenario(s, id_esc, estado)
        auditoria.registrar(s, "escenario_red", "UPDATE", id_esc, {"estado": e["estado_escenario"]}, {"estado": estado}, actor.id_usuario)
        e["estado_escenario"] = estado
        return e


def ejecutar(actor: Actor, id_esc: int, algoritmo: str) -> dict:
    exigir_permiso(actor.roles, "flujo:ejecutar")
    if algoritmo not in fm.ALGORITMOS:
        raise ReglaNegocioError("algoritmo debe ser EDMONDS_KARP o FORD_FULKERSON")
    with transaccion() as s:
        e = _escenario(s, actor, id_esc)
        if e["estado_escenario"] == "ARCHIVADO":
            raise ConflictoError("El escenario esta archivado")
        datos = mm.cargar_datos(s, id_esc, e)
        r = mm.calcular(datos, algoritmo)
        id_ej = repo.crear_ejecucion(s, id_esc, algoritmo, r["flujo_maximo"])
        repo.guardar_resultados(s, id_ej, [{"id_conexion": i, **f} for i, f in r["flujos"].items()])
        auditoria.registrar(s, "ejecucion_flujo", "INSERT", id_ej, None,
                            {"escenario": id_esc, "algoritmo": algoritmo, "flujo_maximo": r["flujo_maximo"],
                             "huella": r["huella_datos"]}, actor.id_usuario)
    return _salida(id_ej, r)


def _salida(id_ej: int, r: dict) -> dict:
    return {"id_ejecucion": id_ej, "algoritmo": r["algoritmo"], "escenario": r["escenario"], "unidad": r["unidad"],
            "periodo": r["periodo"], "flujo_maximo": r["flujo_maximo"], "capacidad_corte": r["capacidad_corte"],
            "corte_minimo": r["corte_minimo"], "ofertas_limitantes": r["ofertas_limitantes"],
            "demandas_limitantes": r["demandas_limitantes"], "huella_datos": r["huella_datos"],
            "interpretacion": r["interpretacion"],
            "resultados": [{"id_conexion": i, "flujo_asignado": f["flujo"], "capacidad_considerada": f["capacidad"],
                            "en_corte_minimo": f["en_corte_minimo"]} for i, f in sorted(r["flujos"].items())]}


def listar_ejecuciones(actor: Actor, id_esc: int) -> list:
    exigir_permiso(actor.roles, "flujo:ver")
    with transaccion() as s:
        _escenario(s, actor, id_esc)
        return repo.listar_ejecuciones(s, id_esc)


def obtener_ejecucion(actor: Actor, id_esc: int, id_ej: int) -> dict:
    exigir_permiso(actor.roles, "flujo:ver")
    with transaccion() as s:
        _escenario(s, actor, id_esc)
        ej = repo.obtener_ejecucion(s, id_esc, id_ej)
        if ej is None:
            raise NoEncontradoError("Ejecucion no encontrada")
        ej["resultados"] = [{"id_conexion": r["id_conexion"], "flujo_asignado": r["flujo_asignado"],
                             "capacidad_considerada": r["capacidad_considerada"], "en_corte_minimo": bool(r["en_corte_minimo"])}
                            for r in repo.resultados_de(s, id_ej)]
        return ej
