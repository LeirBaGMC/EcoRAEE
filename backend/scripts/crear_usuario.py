"""Crea un usuario de PRUEBA (datos sinteticos) con uno o varios roles.

Uso (desde la carpeta backend, con el entorno virtual activo y el .env listo):
  python -m scripts.crear_usuario tecnica1 Clave-Prueba-123 TECNICO_EVALUADOR
  python -m scripts.crear_usuario gen1 Clave-Prueba-123 GENERADOR OPERADOR_CENTRO
Crea tambien una organizacion de prueba (RUC 0999999999001) si todavia no existe.
"""
import sys

from sqlalchemy import text

from app.db import transaccion
from app.security import hash_password

RUC_PRUEBA = "0999999999001"


def crear_usuario(nombre: str, clave: str, roles: list, ruc: str = RUC_PRUEBA):
    """Devuelve (id_usuario, id_organizacion)."""
    with transaccion() as s:
        org = s.execute(text("SELECT id_organizacion FROM organizacion WHERE ruc=:r"), {"r": ruc}).scalar()
        if org is None:
            org = s.execute(text("INSERT INTO organizacion (ruc,nombre,tipo_persona,ciudad) OUTPUT INSERTED.id_organizacion "
                                 "VALUES (:r,:n,'JURIDICA',N'Quito')"),
                            {"r": ruc, "n": f"Organizacion de Prueba {ruc[-3:]}"}).scalar()
        uid = s.execute(text("INSERT INTO usuario (correo,nombre_usuario,nombre_visible,activo,credencial_hash,id_organizacion) "
                             "OUTPUT INSERTED.id_usuario VALUES (:c,:n,:v,1,:h,:o)"),
                        {"c": f"{nombre}@prueba.local", "n": nombre, "v": nombre,
                         "h": hash_password(clave), "o": org}).scalar()
        for r in roles:
            id_rol = s.execute(text("SELECT id_rol FROM rol WHERE nombre_rol=:r"), {"r": r}).scalar()
            if id_rol is None:
                raise SystemExit(f"El rol {r} no existe. Revisa el nombre.")
            s.execute(text("INSERT INTO usuario_rol (id_usuario,id_rol) VALUES (:u,:r)"), {"u": uid, "r": id_rol})
    return uid, org


def main(argv):
    if len(argv) < 4:
        print(__doc__)
        return 1
    uid, org = crear_usuario(argv[1], argv[2], argv[3:])
    print(f"Listo: usuario {argv[1]} con roles {', '.join(argv[3:])} (organizacion {org})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
