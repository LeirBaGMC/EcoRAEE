"""Errores de negocio. Las rutas los traducen a codigos HTTP estables."""


class ReglaNegocioError(Exception):
    codigo = "REGLA_NEGOCIO"

    def __init__(self, mensaje: str):
        super().__init__(mensaje)
        self.mensaje = mensaje


class PermisoDenegadoError(ReglaNegocioError):
    codigo = "PERMISO_DENEGADO"


class TransicionInvalidaError(ReglaNegocioError):
    codigo = "TRANSICION_INVALIDA"


class CapacidadExcedidaError(ReglaNegocioError):
    codigo = "CAPACIDAD_EXCEDIDA"


class EvidenciaFaltanteError(ReglaNegocioError):
    codigo = "EVIDENCIA_FALTANTE"


class CierreIncompletoError(ReglaNegocioError):
    codigo = "CIERRE_INCOMPLETO"


class NoEncontradoError(ReglaNegocioError):
    """Tambien se usa cuando el recurso existe pero esta fuera del alcance del usuario (no se revela su existencia)."""
    codigo = "NO_ENCONTRADO"


class ConflictoError(ReglaNegocioError):
    codigo = "CONFLICTO"
