"""Caso de uso: evaluacion tecnica y clasificacion (RN-02)."""
from ..db import transaccion
from ..domain import evaluacion as de
from ..domain import rules
from ..domain.errors import ConflictoError, NoEncontradoError, ReglaNegocioError
from ..domain.permisos import exigir_permiso
from ..persistence import dispositivos as repo_d
from ..persistence import evaluaciones as repo_e
from ..persistence import movimientos as repo_m
from ..security import Actor
from . import estado_service

CONDICIONES = ("ENCIENDE", "NO_ENCIENDE", "DANO_FISICO", "INCOMPLETO")


def registrar_evaluacion(actor: Actor, id_dispositivo: int, condicion_constatada: str,
                         diagnostico: str, id_clasificacion: int) -> dict:
    exigir_permiso(actor.roles, "evaluacion:registrar")
    rules.exigir_tecnico(actor.roles)                      # RN-02
    if condicion_constatada not in CONDICIONES:
        raise ReglaNegocioError("condicion_constatada no valida")
    diagnostico = de.validar_diagnostico(diagnostico)
    with transaccion() as s:
        # Mismo bloqueo de dispositivo que usa programar: evita carreras con una reevaluacion.
        repo_m.info_dispositivos(s, [id_dispositivo])
        # Alcance: el dispositivo debe estar en un centro de la organizacion del tecnico.
        ubic = repo_d.ubicacion_actual(s, id_dispositivo)
        if ubic is None or ubic["id_organizacion"] != actor.id_organizacion:
            raise NoEncontradoError("Dispositivo no encontrado")
        clasif = repo_e.obtener_clasificacion(s, id_clasificacion)
        if clasif is None:
            raise ReglaNegocioError("Clasificacion inexistente")
        estado = repo_d.estado_actual(s, id_dispositivo, bloquear=True)
        de.validar_evaluable(estado)
        if repo_m.en_movimiento_activo(s, [id_dispositivo]):
            raise ConflictoError("Anula el movimiento pendiente antes de reevaluar el dispositivo")
        nro = repo_e.insertar(s, id_dispositivo, condicion_constatada, diagnostico, actor.id_usuario, id_clasificacion)
        if de.requiere_cambio_estado(estado):
            estado_service.transicionar(s, id_dispositivo, "EVALUADO", actor.id_usuario, f"Evaluacion {nro}")
    return {"id_dispositivo": id_dispositivo, "nro_evaluacion": nro,
            "clasificacion": clasif["nombre_clasificacion"], "permite_asignacion": bool(clasif["permite_asignacion"]),
            "estado_actual": "EVALUADO"}
