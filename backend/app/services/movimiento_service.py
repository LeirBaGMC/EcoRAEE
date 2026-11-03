"""Casos de uso de movimientos entre centros.
RN-03: no se cierra sin origen, destino, responsable y evidencia.
RN-05: no se supera la capacidad de la conexion (periodo y unidad). La conexion se bloquea mientras se comprueba.
RN-06: al cerrar, se sale del origen y se entra al destino en la MISMA transaccion.
Idempotencia: cabecera Idempotency-Key -> codigo_movimiento determinista (UNIQUE en BD)."""
from datetime import date, datetime, time
import hashlib
import json
from decimal import Decimal
from typing import Optional

from sqlalchemy.exc import IntegrityError

from ..db import transaccion
from ..domain import movimiento as dm
from ..domain import rules
from ..domain.errors import ConflictoError, NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..persistence import auditoria
from ..persistence import inventario as inv
from ..persistence import movimientos as repo
from ..security import Actor
from . import estado_service


def _movimiento_visible(s, id_mov: int, actor: Actor, solo_origen: bool, bloquear: bool = False, consulta: bool = False) -> dict:
    m = repo.obtener(s, id_mov, bloquear=bloquear)
    orgs = {m["org_origen"]} if (m and solo_origen) else ({m["org_origen"], m["org_destino"]} if m else set())
    if m is None or (actor.id_organizacion not in orgs and not (consulta and "ADMINISTRADOR" in actor.roles)):
        raise NoEncontradoError("Movimiento no encontrado")
    return m


def _resumen(m: dict, repetido: bool = False) -> dict:
    res = {"id_movimiento": m["id_movimiento"], "codigo_movimiento": m["codigo_movimiento"],
            "tipo_movimiento": m["tipo_movimiento"], "estado_movimiento": m["estado_movimiento"],
            "id_conexion": m["id_conexion"], "fecha_despacho": m["fecha_despacho"], "repetido": repetido}
    for campo in ("id_centro_origen", "id_centro_destino", "nombre_centro_origen", "nombre_centro_destino",
                  "nombre_responsable", "cantidad_total", "unidad_capacidad"):
        if campo in m:
            res[campo] = m[campo]
    res["id_responsable"] = m.get("id_usuario")
    res["cantidad"] = m.get("cantidad_total")
    res["unidad"] = m.get("unidad_capacidad")
    return res


def _huella(conexion, tipo, fecha, items):
    datos = [conexion, tipo, fecha.isoformat(), sorted(
        (i["id_dispositivo"], format(Decimal(str(i["peso_despachado_kg"])).normalize(), "f")
         if i.get("peso_despachado_kg") is not None else None) for i in items)]
    return hashlib.sha256(json.dumps(datos).encode()).hexdigest()


def _reintento(s, actor, previo, huella):
    m = _movimiento_visible(s, previo, actor, solo_origen=True)
    guardada = repo.huella_solicitud(s, previo)
    if guardada is None:  # Compatibilidad con movimientos anteriores a la huella persistida.
        guardada = _huella(m["id_conexion"], m["tipo_movimiento"], m["fecha_despacho"].date(), repo.items(s, previo))
    if guardada != huella:
        raise ConflictoError("Idempotency-Key ya fue utilizada con otros datos")
    return _resumen(m, repetido=True)


def programar(actor: Actor, id_conexion: int, tipo: str, fecha_despacho: date, items: list,
              clave_idempotencia: Optional[str] = None) -> dict:
    exigir_permiso(actor.roles, "movimiento:programar")
    ids = [i["id_dispositivo"] for i in items]
    dm.validar_items(ids)
    huella = _huella(id_conexion, tipo, fecha_despacho, items)
    codigo = dm.codigo_idempotente(actor.id_usuario, clave_idempotencia) if clave_idempotencia else dm.generar_codigo_movimiento()
    try:
        with transaccion() as s:
            if clave_idempotencia:
                repo.bloquear_clave(s, codigo)
                previo = repo.obtener_por_codigo(s, codigo)
                if previo:
                    return _reintento(s, actor, previo, huella)
            if fecha_despacho < date.today():
                raise ReglaNegocioError("La fecha de despacho no puede estar en el pasado")
            con = repo.conexion_para_programar(s, id_conexion)
            if con is None or con["org_origen"] != actor.id_organizacion:
                raise NoEncontradoError("Conexion no encontrada")
            if not con["activa"]:
                raise ReglaNegocioError("La conexion esta inactiva")
            dm.validar_tipo_vs_destino(tipo, con["tipo_destino"])

            info = repo.info_dispositivos(s, ids)
            if set(info) != set(ids):
                raise ReglaNegocioError("Algunos dispositivos no existen")
            for i in ids:
                d = info[i]
                if d["id_centro"] != con["id_centro_origen"]:
                    raise ReglaNegocioError("Todos los dispositivos deben estar en el centro de origen de la conexion")
                if d["estado"] not in dm.ESTADOS_DISPOSITIVO_MOVIBLES:
                    raise ReglaNegocioError(f"Un dispositivo en estado {d['estado']} no puede moverse (debe estar EVALUADO o REACONDICIONADO)")
            ocupados = repo.en_movimiento_activo(s, ids)
            if ocupados:
                raise ConflictoError("Algunos dispositivos ya estan en otro movimiento activo")
            if tipo == "ENTREGA_BENEFICIARIO":
                for i in ids:  # RN-04 se aplica ya al entregar a un beneficiario
                    c = repo.ultima_clasificacion(s, i)
                    if c is None:
                        raise ReglaNegocioError("Un dispositivo sin evaluacion no puede entregarse a un beneficiario")
                    rules.validar_asignacion(bool(c["permite_asignacion"]), c["nombre_clasificacion"])

            pesos = {i["id_dispositivo"]: i.get("peso_despachado_kg") for i in items}
            unidad = con["unidad_capacidad"]
            cantidades = {i: dm.cantidad_item(unidad, info[i]["tipo_registro"], info[i]["cantidad_unidades"],
                                               info[i]["peso_kg"], pesos[i]) for i in ids}
            solicitado = sum(cantidades.values(), Decimal(0))
            if unidad == "KG":
                pesos = cantidades  # Persistir exactamente el peso que comprometio capacidad.
            desde, hasta = dm.periodo_de(fecha_despacho)
            ya = Decimal(repo.comprometido(s, id_conexion, unidad, desde, hasta))
            rules.validar_capacidad(Decimal(con["capacidad_por_periodo"]), ya, solicitado)   # RN-05

            id_mov = repo.crear(s, codigo, tipo, datetime.combine(fecha_despacho, time.min), id_conexion, actor.id_usuario)
            repo.agregar_items(s, id_mov, [{"id_dispositivo": i, "peso_despachado_kg": pesos[i]} for i in ids])
            auditoria.registrar(s, "movimiento", "INSERT", id_mov, None,
                                {"codigo": codigo, "tipo": tipo, "conexion": id_conexion, "dispositivos": ids,
                                 "huella_solicitud": huella}, actor.id_usuario)
            res = _resumen(repo.obtener(s, id_mov))
            res.update({"cantidad": solicitado, "unidad": unidad,
                        "capacidad_restante_periodo": Decimal(con["capacidad_por_periodo"]) - ya - solicitado})
            return res
    except IntegrityError:
        if clave_idempotencia:  # dos reintentos simultaneos: gana uno, el otro recibe el mismo movimiento
            with transaccion() as s:
                previo = repo.obtener_por_codigo(s, codigo)
                if previo:
                    return _reintento(s, actor, previo, huella)
        raise ConflictoError("No se pudo registrar el movimiento por un conflicto de datos")


def _cambiar(actor: Actor, id_mov: int, permiso: str, nuevo: str, solo_origen: bool = True) -> dict:
    exigir_permiso(actor.roles, permiso)
    with transaccion() as s:
        m = _movimiento_visible(s, id_mov, actor, solo_origen, bloquear=True)
        dm.validar_transicion_mov(m["estado_movimiento"], nuevo)
        repo.cambiar_estado(s, id_mov, nuevo)
        auditoria.registrar(s, "movimiento", "UPDATE", id_mov, {"estado": m["estado_movimiento"]}, {"estado": nuevo}, actor.id_usuario)
        m["estado_movimiento"] = nuevo
        return _resumen(m)


def autorizar(actor: Actor, id_mov: int) -> dict:
    return _cambiar(actor, id_mov, "movimiento:autorizar", "AUTORIZADO")


def anular(actor: Actor, id_mov: int) -> dict:
    return _cambiar(actor, id_mov, "movimiento:anular", "ANULADO")


def despachar(actor: Actor, id_mov: int) -> dict:
    """El operador del centro de origen entrega fisicamente: los dispositivos pasan a EN_TRANSITO."""
    exigir_permiso(actor.roles, "movimiento:despachar")
    with transaccion() as s:
        m = _movimiento_visible(s, id_mov, actor, solo_origen=True, bloquear=True)
        dm.validar_transicion_mov(m["estado_movimiento"], "EN_TRANSITO")
        for it in repo.items(s, id_mov):
            ubic = repo.info_dispositivos(s, [it["id_dispositivo"]])[it["id_dispositivo"]]
            if ubic["id_centro"] != m["id_centro_origen"]:
                raise ConflictoError("Un dispositivo ya no esta en el centro de origen")
            if m["tipo_movimiento"] == "ENTREGA_BENEFICIARIO":
                clasif = repo.ultima_clasificacion(s, it["id_dispositivo"])
                if clasif is None:
                    raise ReglaNegocioError("El dispositivo no tiene evaluacion tecnica")
                rules.validar_asignacion(bool(clasif["permite_asignacion"]), clasif["nombre_clasificacion"])
            estado_service.transicionar(s, it["id_dispositivo"], "EN_TRANSITO", actor.id_usuario, f"Despacho {m['codigo_movimiento']}")
        repo.cambiar_estado(s, id_mov, "EN_TRANSITO")
        auditoria.registrar(s, "movimiento", "UPDATE", id_mov, {"estado": "AUTORIZADO"}, {"estado": "EN_TRANSITO"}, actor.id_usuario)
        m["estado_movimiento"] = "EN_TRANSITO"
        return _resumen(m)


def cerrar(actor: Actor, id_mov: int, conformes: Optional[dict] = None) -> dict:
    exigir_permiso(actor.roles, "movimiento:cerrar")
    conformes = conformes or {}
    with transaccion() as s:
        m = _movimiento_visible(s, id_mov, actor, solo_origen=False, bloquear=True)
        dm.validar_transicion_mov(m["estado_movimiento"], "CERRADO")
        # RN-03: origen, destino, responsable y evidencia (guia de traslado)
        rules.validar_cierre_movimiento(m["id_centro_origen"], m["id_centro_destino"], m["id_usuario"], repo.contar_guias(s, id_mov))
        for it in repo.items(s, id_mov):
            d = it["id_dispositivo"]
            # RN-06: salir del origen + entrar al destino + cambiar estado, todo o nada.
            if repo.cerrar_estancia(s, d, m["id_centro_origen"]) != 1:
                raise ConflictoError("Un dispositivo ya no tiene una estancia abierta en el origen")
            inv.abrir_estancia(s, d, m["id_centro_destino"], "MOVIMIENTO")
            antes = repo.estado_antes_de_transito(s, d)
            estado_service.transicionar(s, d, dm.estado_tras_cierre(m["tipo_movimiento"], antes), actor.id_usuario,
                                        f"Cierre {m['codigo_movimiento']}")
            repo.marcar_conforme(s, id_mov, d, conformes.get(d, True))
        repo.cambiar_estado(s, id_mov, "CERRADO", fecha_recepcion=datetime.now())
        auditoria.registrar(s, "movimiento", "UPDATE", id_mov, {"estado": "EN_TRANSITO"}, {"estado": "CERRADO"}, actor.id_usuario)
        m["estado_movimiento"] = "CERRADO"
        return _resumen(m)


def obtener(actor: Actor, id_mov: int) -> dict:
    exigir_permiso(actor.roles, "movimiento:ver")
    with transaccion() as s:
        m = _movimiento_visible(s, id_mov, actor, solo_origen=False, consulta=True)
        res = _resumen(m)
        res.update({"id_centro_origen": m["id_centro_origen"], "id_centro_destino": m["id_centro_destino"],
                    "fecha_recepcion": m["fecha_recepcion"], "id_responsable": m["id_usuario"],
                    "dispositivos": repo.items(s, id_mov)})
        return res


def listar(actor: Actor, pagina: int, tamano: int, estado: Optional[str]) -> dict:
    exigir_permiso(actor.roles, "movimiento:ver")
    if pagina < 1 or tamano < 1 or tamano > 100:
        raise ReglaNegocioError("pagina >= 1 y tamano entre 1 y 100")
    with transaccion() as s:
        total, filas = repo.listar_visibles(s, actor.id_organizacion, estado, (pagina - 1) * tamano, tamano, todos="ADMINISTRADOR" in actor.roles)
    return {"items": [_resumen(f) for f in filas], "total": total, "pagina": pagina, "tamano": tamano}
