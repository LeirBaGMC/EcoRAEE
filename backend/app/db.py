"""Sesion de base de datos. Quien llama al servicio controla la transaccion."""
from contextlib import contextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from .config import load_settings

_engine = None
_Session = None


def init_engine():
    global _engine, _Session
    if _engine is not None:
        return _engine
    s = load_settings()
    if not s.db_url:
        raise RuntimeError("Falta ECORAEE_DB_URL")
    _engine = create_engine(
        s.db_url,
        pool_pre_ping=True,
        pool_size=s.db_pool_size,
        max_overflow=s.db_max_overflow,
        pool_timeout=s.db_pool_timeout,
        pool_recycle=s.db_pool_recycle,
        connect_args={"timeout": s.db_pool_timeout},
    )
    _Session = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def comprobar_conexion() -> None:
    """Falla explicitamente si SQL Server no esta disponible."""
    engine = init_engine()
    with engine.connect() as conexion:
        conexion.execute(text("SELECT 1"))


def cerrar_engine() -> None:
    global _engine, _Session
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _Session = None


@contextmanager
def transaccion():
    """Una operacion de negocio = un commit. Si algo falla, rollback completo."""
    if _Session is None:
        init_engine()
    sesion = _Session()
    try:
        yield sesion
        sesion.commit()
    except Exception:
        sesion.rollback()
        raise
    finally:
        sesion.close()
