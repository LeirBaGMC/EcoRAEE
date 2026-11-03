"""Administracion: usuarios y roles (M-02), red logistica (organizaciones, centros, conexiones), catalogos y auditoria."""
import json
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.exc import IntegrityError

from ..db import transaccion
from ..domain import usuarios as du
from ..domain.errors import ConflictoError, NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..persistence import admin as repo
from ..persistence import auditoria
from ..persistence import red
from ..persistence import movimientos
from ..security import Actor, hash_password

TIPOS_ACTOR = ("GENERADOR", "OPERADOR", "REACONDICIONADOR", "RECICLADOR", "BENEFICIARIO", "COORDINADOR")
TIPOS_CENTRO = ("RECOLECCION", "REACONDICIONAMIENTO", "RECICLAJE", "DISPOSICION", "SEDE_BENEFICIARIA")


def consulta_global(actor: Actor, recurso: str, pagina: int, tamano: int) -> dict:
    exigir_permiso(actor.roles, 'auditoria:ver')
    from sqlalchemy import text
    consultas = {
        'recepciones': ('recepcion', 'id_recepcion', 'id_recepcion,fecha_hora,peso_recibido_kg,unidades_recibidas,conforme,id_solicitud,id_centro'),
        'tratamientos': ('tratamiento', 'id_tratamiento', 'id_tratamiento,tipo_tratamiento,fecha_inicio,fecha_fin,resultado,id_dispositivo'),
        'cierres': ('cierre_trazabilidad', 'id_cierre', 'id_cierre,fecha_confirmacion,id_dispositivo,id_tratamiento,id_asignacion,destino_final'),
    }
    tabla, clave, columnas = consultas[recurso]
    offset = _paginar(pagina, tamano)
    with transaccion() as s:
        total = s.execute(text(f'SELECT COUNT(*) FROM {tabla}')).scalar()
        filas = s.execute(text(f'SELECT {columnas} FROM {tabla} ORDER BY {clave} DESC OFFSET :off ROWS FETCH NEXT :n ROWS ONLY'), {'off': offset, 'n': tamano}).mappings().all()
    return {'items': [dict(f) for f in filas], 'total': total, 'pagina': pagina, 'tamano': tamano}


def _paginar(pagina: int, tamano: int) -> int:
    if pagina < 1 or tamano < 1 or tamano > 100:
        raise ReglaNegocioError("pagina >= 1 y tamano entre 1 y 100")
    return (pagina - 1) * tamano


def _publico(u: dict, roles: List[str]) -> dict:
    return {"id_usuario": u["id_usuario"], "correo": u["correo"], "nombre_usuario": u["nombre_usuario"],
            "nombre_visible": u["nombre_visible"], "activo": bool(u["activo"]), "id_organizacion": u["id_organizacion"], "roles": roles}


# ---------------- usuarios ----------------
def crear_usuario(actor: Actor, correo, nombre_usuario, nombre_visible, contrasena, roles, id_organizacion) -> dict:
    exigir_permiso(actor.roles, "usuario:gestionar")
    du.validar_datos_usuario(correo, nombre_usuario, nombre_visible)
    du.validar_clave(contrasena)
    du.validar_roles(roles)
    hash_ = hash_password(contrasena)                              # nunca se guarda ni se devuelve la contrasena
    try:
        with transaccion() as s:
            if not red.organizacion_existe(s, id_organizacion):
                raise NoEncontradoError("Organizacion no encontrada")
            uid = repo.crear_usuario(s, correo.strip().lower(), nombre_usuario, nombre_visible.strip(), hash_, id_organizacion)
            repo.reemplazar_roles(s, uid, roles)
            auditoria.registrar(s, "usuario", "INSERT", uid, None,
                                {"nombre_usuario": nombre_usuario, "roles": roles, "organizacion": id_organizacion}, actor.id_usuario)
            return _publico(repo.obtener_usuario(s, uid), sorted(roles))
    except IntegrityError:
        raise ConflictoError("Ya existe un usuario con ese correo o nombre de usuario")


def listar_usuarios(actor: Actor, pagina: int, tamano: int) -> dict:
    exigir_permiso(actor.roles, "usuario:gestionar")
    off = _paginar(pagina, tamano)
    with transaccion() as s:
        total, filas = repo.listar_usuarios(s, off, tamano)
    return {"items": [_publico(f, f["roles"]) for f in filas], "total": total, "pagina": pagina, "tamano": tamano}


def cambiar_roles(actor: Actor, id_usuario: int, roles: List[str]) -> dict:
    exigir_permiso(actor.roles, "rol:gestionar")
    du.validar_roles(roles)
    du.validar_no_autobloqueo(actor.id_usuario, id_usuario, roles_nuevos=roles)
    with transaccion() as s:
        u = repo.obtener_usuario(s, id_usuario, bloquear=True)
        if u is None:
            raise NoEncontradoError("Usuario no encontrado")
        antes = repo.roles_de_usuarios(s, [id_usuario])[id_usuario]
        repo.reemplazar_roles(s, id_usuario, roles)
        auditoria.registrar(s, "usuario_rol", "UPDATE", id_usuario, {"roles": antes}, {"roles": sorted(roles)}, actor.id_usuario)
        return _publico(u, sorted(roles))


def cambiar_activo(actor: Actor, id_usuario: int, activo: bool) -> dict:
    exigir_permiso(actor.roles, "usuario:gestionar")
    du.validar_no_autobloqueo(actor.id_usuario, id_usuario, activo_nuevo=activo)
    with transaccion() as s:
        u = repo.obtener_usuario(s, id_usuario, bloquear=True)
        if u is None:
            raise NoEncontradoError("Usuario no encontrado")
        repo.cambiar_activo(s, id_usuario, activo)
        auditoria.registrar(s, "usuario", "UPDATE", id_usuario, {"activo": bool(u["activo"])}, {"activo": activo}, actor.id_usuario)
        u["activo"] = activo
        return _publico(u, repo.roles_de_usuarios(s, [id_usuario])[id_usuario])


# ---------------- red logistica ----------------
def crear_organizacion(actor: Actor, ruc, nombre, tipo_persona, ciudad, tipos_actor) -> dict:
    exigir_permiso(actor.roles, "red:gestionar")
    du.validar_ruc(ruc)
    if tipo_persona not in ("JURIDICA", "NATURAL"):
        raise ReglaNegocioError("tipo_persona debe ser JURIDICA o NATURAL")
    if not tipos_actor or any(t not in TIPOS_ACTOR for t in tipos_actor) or len(set(tipos_actor)) != len(tipos_actor):
        raise ReglaNegocioError("tipos_actor invalidos o repetidos")
    try:
        with transaccion() as s:
            i = red.crear_organizacion(s, ruc, nombre, tipo_persona, ciudad, tipos_actor)
            auditoria.registrar(s, "organizacion", "INSERT", i, None, {"ruc": ruc, "tipos_actor": tipos_actor}, actor.id_usuario)
    except IntegrityError:
        raise ConflictoError("Ya existe una organizacion con ese RUC")
    return {"id_organizacion": i, "ruc": ruc, "nombre": nombre, "tipo_persona": tipo_persona, "ciudad": ciudad}


def listar_organizaciones(actor: Actor, pagina: int, tamano: int, tipo_actor: Optional[str]) -> dict:
    exigir_permiso(actor.roles, "red:ver")
    off = _paginar(pagina, tamano)
    with transaccion() as s:
        total, filas = red.listar_organizaciones(s, off, tamano, tipo_actor)
    return {"items": filas, "total": total, "pagina": pagina, "tamano": tamano}


def crear_centro(actor: Actor, codigo, nombre, tipo, ciudad, capacidad, id_org) -> dict:
    exigir_permiso(actor.roles, "red:gestionar")
    if tipo not in TIPOS_CENTRO:
        raise ReglaNegocioError("tipo_centro no valido")
    try:
        with transaccion() as s:
            if not red.organizacion_existe(s, id_org):
                raise NoEncontradoError("Organizacion no encontrada")
            i = red.crear_centro(s, codigo, nombre, tipo, ciudad, capacidad, id_org)
            auditoria.registrar(s, "centro", "INSERT", i, None, {"codigo": codigo, "organizacion": id_org}, actor.id_usuario)
    except IntegrityError:
        raise ConflictoError("Ya existe un centro con ese codigo")
    return {"id_centro": i, "codigo_centro": codigo, "nombre": nombre, "tipo_centro": tipo, "ciudad": ciudad,
            "capacidad_almacenamiento": capacidad, "id_organizacion": id_org}


def listar_centros(actor: Actor) -> list:
    exigir_permiso(actor.roles, "red:ver")
    with transaccion() as s:
        return red.listar_centros(s, actor.id_organizacion, "ADMINISTRADOR" in actor.roles)


def crear_conexion(actor: Actor, origen: int, destino: int, capacidad, unidad: str) -> dict:
    exigir_permiso(actor.roles, "red:gestionar")
    if origen == destino:
        raise ReglaNegocioError("Origen y destino no pueden ser el mismo centro")
    if unidad not in ("UND", "KG"):
        raise ReglaNegocioError("unidad_capacidad debe ser UND o KG")
    if capacidad < 0:
        raise ReglaNegocioError("La capacidad no puede ser negativa")
    try:
        with transaccion() as s:
            if red.centros_existen(s, [origen, destino]) != {origen, destino}:
                raise NoEncontradoError("Centro no encontrado")
            i = red.crear_conexion(s, origen, destino, capacidad, unidad)
            auditoria.registrar(s, "conexion_logistica", "INSERT", i, None, {"origen": origen, "destino": destino}, actor.id_usuario)
    except IntegrityError:
        raise ConflictoError("Ya existe una conexion entre esos dos centros")
    return {"id_conexion": i, "id_centro_origen": origen, "id_centro_destino": destino,
            "capacidad_por_periodo": capacidad, "unidad_capacidad": unidad, "activa": True}


def listar_conexiones(actor: Actor) -> list:
    exigir_permiso(actor.roles, "red:ver")
    with transaccion() as s:
        return red.listar_conexiones(s, actor.id_organizacion, "ADMINISTRADOR" in actor.roles)


def actualizar_capacidad_conexion(actor: Actor, id_conexion: int, capacidad) -> dict:
    """Solo capacidad. Serializa con programar y conserva todo compromiso mensual, incluso historico."""
    exigir_permiso(actor.roles, "red:gestionar")
    capacidad = Decimal(str(capacidad))
    if not capacidad.is_finite() or capacidad < 0 or capacidad > Decimal("999999999999.99") or capacidad != capacidad.quantize(Decimal("0.01")):
        raise ReglaNegocioError("La capacidad debe ser no negativa, con hasta dos decimales y catorce digitos")
    with transaccion() as s:
        # Es el mismo bloqueo UPDLOCK, HOLDLOCK de la programacion RN-05.
        con = movimientos.conexion_para_programar(s, id_conexion)
        if con is None:
            raise NoEncontradoError("Conexion no encontrada")
        # Administrador gestiona la red global; cualquier futuro rol gestor conserva su alcance.
        if "ADMINISTRADOR" not in actor.roles and actor.id_organizacion not in (con["org_origen"], con["org_destino"]):
            raise NoEncontradoError("Conexion no encontrada")
        comprometido = Decimal(movimientos.maximo_comprometido_por_periodo(s, id_conexion, con["unidad_capacidad"]))
        if capacidad < comprometido:
            raise ReglaNegocioError(
                f"La capacidad no puede ser menor que {comprometido} {con['unidad_capacidad']} ya comprometidos en un periodo mensual")
        anterior = Decimal(con["capacidad_por_periodo"])
        if capacidad != anterior:
            red.actualizar_capacidad_conexion(s, id_conexion, capacidad)
            auditoria.registrar(s, "conexion_logistica", "UPDATE", id_conexion,
                                {"capacidad_por_periodo": anterior}, {"capacidad_por_periodo": capacidad}, actor.id_usuario)
        return {**con, "capacidad_por_periodo": capacidad}


# ---------------- catalogos y auditoria ----------------
def catalogos(actor: Actor) -> dict:
    """Cualquier usuario autenticado. Los roles solo se listan al administrador."""
    with transaccion() as s:
        c = repo.catalogos(s)
    c["tipos_actor"] = list(TIPOS_ACTOR)
    c["tipos_centro"] = list(TIPOS_CENTRO)
    if "ADMINISTRADOR" in actor.roles:
        c["roles"] = list(du.ROLES_VALIDOS)
    return c


def listar_auditoria(actor: Actor, pagina: int, tamano: int, tabla: Optional[str], clave: Optional[str]) -> dict:
    exigir_permiso(actor.roles, "auditoria:ver")
    off = _paginar(pagina, tamano)
    with transaccion() as s:
        total, filas = auditoria.listar(s, tabla, clave, off, tamano)
    for f in filas:
        for k in ("valor_anterior", "valor_nuevo"):
            f[k] = json.loads(f[k]) if f[k] else None
    return {"items": filas, "total": total, "pagina": pagina, "tamano": tamano}
