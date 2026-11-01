"""Crea (si no existen) dos centros y una conexion de PRUEBA en la organizacion de prueba.

Uso:  python -m scripts.datos_prueba
Imprime los id_centro que necesitas en Swagger para POST /recepciones.
"""
from sqlalchemy import text

from app.db import transaccion
from scripts.crear_usuario import RUC_PRUEBA


def asegurar_centros(ruc: str = RUC_PRUEBA):
    """Devuelve (id_centro_recoleccion, id_centro_reacondicionamiento). Crea la organizacion si falta."""
    with transaccion() as s:
        org = s.execute(text("SELECT id_organizacion FROM organizacion WHERE ruc=:r"), {"r": ruc}).scalar()
        if org is None:
            org = s.execute(text("INSERT INTO organizacion (ruc,nombre,tipo_persona,ciudad) OUTPUT INSERTED.id_organizacion "
                                 "VALUES (:r,:n,'JURIDICA',N'Quito')"),
                            {"r": ruc, "n": f"Organizacion de Prueba {ruc[-3:]}"}).scalar()
        ids = []
        for codigo, nombre, tipo in (("CEN-REC-01", "Centro de Recoleccion Quito", "RECOLECCION"),
                                     ("CEN-REA-01", "Centro de Reacondicionamiento Quito", "REACONDICIONAMIENTO")):
            cid = s.execute(text("SELECT id_centro FROM centro WHERE codigo_centro=:c"), {"c": codigo}).scalar()
            if cid is None:
                cid = s.execute(text("INSERT INTO centro (codigo_centro,nombre,tipo_centro,ciudad,capacidad_almacenamiento,id_organizacion) "
                                     "OUTPUT INSERTED.id_centro VALUES (:c,:n,:t,N'Quito',1000,:o)"),
                                {"c": codigo, "n": nombre, "t": tipo, "o": org}).scalar()
            ids.append(cid)
        existe = s.execute(text("SELECT 1 FROM conexion_logistica WHERE id_centro_origen=:a AND id_centro_destino=:b"),
                           {"a": ids[0], "b": ids[1]}).first()
        if not existe:
            s.execute(text("INSERT INTO conexion_logistica (id_centro_origen,id_centro_destino,capacidad_por_periodo,unidad_capacidad) "
                           "VALUES (:a,:b,100,'UND')"), {"a": ids[0], "b": ids[1]})
    return ids[0], ids[1]


if __name__ == "__main__":
    a, b = asegurar_centros()
    print(f"Centro de recoleccion: id_centro = {a}")
    print(f"Centro de reacondicionamiento: id_centro = {b}")
