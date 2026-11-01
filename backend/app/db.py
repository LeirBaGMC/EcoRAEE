"""Sesion de base de datos. Quien llama al servicio controla la transaccion."""
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import load_settings

_engine = None
_Session = None


def init_engine():
    global _engine, _Session
    s = load_settings()
    if not s.db_url:
        raise RuntimeError("Falta ECORAEE_DB_URL")
    _engine = create_engine(s.db_url, pool_pre_ping=True)
    _Session = sessionmaker(bind=_engine, expire_on_commit=False)


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
