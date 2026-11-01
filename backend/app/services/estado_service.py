from ..domain import rules
from ..persistence import dispositivos as repo


def transicionar(sesion, id_dispositivo: int, nuevo: str, id_usuario: int, observacion=None) -> str:
    """Cambia el estado de un dispositivo y deja su historial. Bloquea el dispositivo para que dos
    operaciones simultaneas no lo muevan a la vez. Debe llamarse dentro de la transaccion del caso de uso."""
    anterior = repo.estado_actual(sesion, id_dispositivo, bloquear=True)
    rules.validar_transicion(anterior, nuevo)
    repo.agregar_historial(sesion, id_dispositivo, anterior, nuevo, id_usuario, observacion)
    return anterior
