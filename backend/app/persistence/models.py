"""Modelos SQLAlchemy 2 alineados con ecoraee_cloud_sqlserver.sql (35 tablas, SQL Server).

PROPUESTO/ESCRITO, NO VERIFICADO contra SQL Server real. Aqui solo estan las tablas del
primer corte (identidad, centros, dispositivos, historial, evaluacion, inventario,
movimientos, evidencia). El resto se agrega por fases. La BD sigue siendo la fuente
de verdad: no se usa create_all().
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Organizacion(Base):
    __tablename__ = "organizacion"
    id_organizacion: Mapped[int] = mapped_column(primary_key=True)
    ruc: Mapped[str] = mapped_column(String(13), unique=True)
    nombre: Mapped[str] = mapped_column(String(150))


class Usuario(Base):
    __tablename__ = "usuario"
    id_usuario: Mapped[int] = mapped_column(primary_key=True)
    correo: Mapped[str] = mapped_column(String(150), unique=True)
    nombre_usuario: Mapped[str] = mapped_column(String(50), unique=True)
    nombre_visible: Mapped[str] = mapped_column(String(120))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    credencial_hash: Mapped[str] = mapped_column(String(255))
    id_organizacion: Mapped[int] = mapped_column(ForeignKey("organizacion.id_organizacion"))


class Rol(Base):
    __tablename__ = "rol"
    id_rol: Mapped[int] = mapped_column(primary_key=True)
    nombre_rol: Mapped[str] = mapped_column(String(60), unique=True)


class UsuarioRol(Base):
    __tablename__ = "usuario_rol"
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuario.id_usuario"), primary_key=True, autoincrement=False)
    id_rol: Mapped[int] = mapped_column(ForeignKey("rol.id_rol"), primary_key=True, autoincrement=False)


class Centro(Base):
    __tablename__ = "centro"
    id_centro: Mapped[int] = mapped_column(primary_key=True)
    codigo_centro: Mapped[str] = mapped_column(String(30), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    tipo_centro: Mapped[str] = mapped_column(String(30))
    id_organizacion: Mapped[int] = mapped_column(ForeignKey("organizacion.id_organizacion"))


class ConexionLogistica(Base):
    __tablename__ = "conexion_logistica"
    id_conexion: Mapped[int] = mapped_column(primary_key=True)
    id_centro_origen: Mapped[int] = mapped_column(ForeignKey("centro.id_centro"))
    id_centro_destino: Mapped[int] = mapped_column(ForeignKey("centro.id_centro"))
    capacidad_por_periodo: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    unidad_capacidad: Mapped[str] = mapped_column(String(3))
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class Dispositivo(Base):
    __tablename__ = "dispositivo"
    id_dispositivo: Mapped[int] = mapped_column(primary_key=True)
    codigo_trazabilidad: Mapped[str] = mapped_column(String(30), unique=True)
    tipo_registro: Mapped[str] = mapped_column(String(10))
    marca: Mapped[Optional[str]] = mapped_column(String(60))
    modelo: Mapped[Optional[str]] = mapped_column(String(60))
    condicion_declarada: Mapped[str] = mapped_column(String(20))
    fecha_registro: Mapped[datetime] = mapped_column(DateTime)
    id_organizacion: Mapped[int] = mapped_column(ForeignKey("organizacion.id_organizacion"))
    id_categoria: Mapped[int] = mapped_column(Integer)


class DispositivoIndividual(Base):
    __tablename__ = "dispositivo_individual"
    id_dispositivo: Mapped[int] = mapped_column(ForeignKey("dispositivo.id_dispositivo"), primary_key=True, autoincrement=False)
    tipo_registro: Mapped[str] = mapped_column(String(10))
    numero_serie: Mapped[str] = mapped_column(String(60), unique=True)


class DispositivoGranel(Base):
    __tablename__ = "dispositivo_granel"
    id_dispositivo: Mapped[int] = mapped_column(ForeignKey("dispositivo.id_dispositivo"), primary_key=True, autoincrement=False)
    tipo_registro: Mapped[str] = mapped_column(String(10))
    peso_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    cantidad_unidades: Mapped[int] = mapped_column(Integer)


class HistorialEstado(Base):
    """Solo INSERT. Nunca UPDATE ni DELETE (RN-01). nro_cambio lo numera el trigger INSTEAD OF (se envia 0).
    Se inserta con Core (sin OUTPUT), porque SQL Server no permite OUTPUT en tablas con triggers."""
    __tablename__ = "historial_estado"
    id_dispositivo: Mapped[int] = mapped_column(ForeignKey("dispositivo.id_dispositivo"), primary_key=True, autoincrement=False)
    nro_cambio: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=0)
    estado_anterior: Mapped[Optional[str]] = mapped_column(String(20))
    estado_nuevo: Mapped[str] = mapped_column(String(20))
    fecha_hora: Mapped[datetime] = mapped_column(DateTime)
    observacion: Mapped[Optional[str]] = mapped_column(Text)
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuario.id_usuario"))


class Clasificacion(Base):
    __tablename__ = "clasificacion"
    id_clasificacion: Mapped[int] = mapped_column(primary_key=True)
    nombre_clasificacion: Mapped[str] = mapped_column(String(30), unique=True)
    permite_asignacion: Mapped[bool] = mapped_column(Boolean)


class Inventario(Base):
    __tablename__ = "inventario"
    id_dispositivo: Mapped[int] = mapped_column(ForeignKey("dispositivo.id_dispositivo"), primary_key=True, autoincrement=False)
    nro_estancia: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=0)
    fecha_ingreso: Mapped[datetime] = mapped_column(DateTime)
    fecha_salida: Mapped[Optional[datetime]] = mapped_column(DateTime)
    motivo_ingreso: Mapped[str] = mapped_column(String(12))
    id_centro: Mapped[int] = mapped_column(ForeignKey("centro.id_centro"))


class Evidencia(Base):
    __tablename__ = "evidencia"
    id_evidencia: Mapped[int] = mapped_column(primary_key=True)
    tipo_evidencia: Mapped[str] = mapped_column(String(30))
    descripcion: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_carga: Mapped[datetime] = mapped_column(DateTime)
    uri_archivo: Mapped[str] = mapped_column(String(500))
    id_movimiento: Mapped[Optional[int]] = mapped_column(Integer)
    id_recepcion: Mapped[Optional[int]] = mapped_column(Integer)
    id_cierre: Mapped[Optional[int]] = mapped_column(Integer)
