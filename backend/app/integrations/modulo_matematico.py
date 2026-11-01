"""Adaptador del modulo matematico. Lee el escenario de la BD (nodos, aristas, capacidades), llama a la funcion pura
de flujo maximo y devuelve un resultado reproducible con su referencia a los datos usados.
Calcular un escenario NO crea ni autoriza movimientos."""
import hashlib
import json
from decimal import Decimal

from ..domain import flujo_maximo
from ..persistence import red as repo


def cargar_datos(sesion, id_escenario: int, escenario: dict) -> dict:
    nodos = repo.nodos_de(sesion, id_escenario)
    conexiones = [c for c in repo.conexiones_de(sesion, id_escenario) if c["habilitada"]]
    return {"escenario": escenario, "nodos": nodos, "conexiones": conexiones}


def huella_datos(datos: dict) -> str:
    """SHA-256 de los datos de entrada en forma canonica. Mismos datos = misma huella."""
    e = datos["escenario"]
    canon = {"codigo": e["codigo_escenario"], "unidad": e["unidad_flujo"],
             "periodo": [str(e["fecha_inicio_periodo"]), str(e["fecha_fin_periodo"])],
             "nodos": [[n["id_centro"], n["rol_nodo"], str(n["oferta"]), str(n["demanda"])] for n in datos["nodos"]],
             "conexiones": [[c["id_conexion"], c["id_centro_origen"], c["id_centro_destino"], str(c["capacidad_escenario"])]
                            for c in datos["conexiones"]]}
    return hashlib.sha256(json.dumps(canon, sort_keys=True).encode()).hexdigest()


def calcular(datos: dict, algoritmo: str) -> dict:
    nodos = {n["id_centro"]: {"rol": n["rol_nodo"], "oferta": n["oferta"], "demanda": n["demanda"]} for n in datos["nodos"]}
    aristas = [(c["id_conexion"], c["id_centro_origen"], c["id_centro_destino"], Decimal(c["capacidad_escenario"]))
               for c in datos["conexiones"]]
    r = flujo_maximo.calcular(nodos, aristas, algoritmo)
    e = datos["escenario"]
    r.update({"escenario": e["codigo_escenario"], "unidad": e["unidad_flujo"],
              "periodo": {"inicio": e["fecha_inicio_periodo"], "fin": e["fecha_fin_periodo"]},
              "huella_datos": huella_datos(datos),
              "interpretacion": ("Flujo maximo: la mayor cantidad que la red puede mover en el periodo con las capacidades del escenario. "
                                 "Corte minimo: las conexiones que limitan ese maximo (ampliarlas es lo que mas aumentaria el flujo). "
                                 "Es un analisis: no crea ni autoriza movimientos.")})
    return r
