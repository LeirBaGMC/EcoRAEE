"""Modulo matematico: flujo maximo y corte minimo (Edmonds-Karp y Ford-Fulkerson).

Funcion pura: recibe datos y devuelve resultados. No toca la BD ni ejecuta transferencias.
Con varias fuentes y sumideros se usa una super-fuente y un super-sumidero. Una oferta o demanda NULL
significa sin limite (se modela con una cota M = suma de capacidades + 1, nunca con infinito).
Aritmetica con Decimal (exacta). El orden de recorrido es determinista, asi que el mismo dato da el mismo resultado.
"""
from collections import deque
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Tuple

from .errors import ReglaNegocioError

ALGORITMOS = ("EDMONDS_KARP", "FORD_FULKERSON")
SUPER_FUENTE = "__S__"
SUPER_SUMIDERO = "__T__"


class _Grafo:
    def __init__(self):
        self.a: List[list] = []            # aristas: [destino, capacidad_residual, id_conexion, capacidad_original, tipo]
        self.ady: Dict[object, List[int]] = {}

    def agregar(self, u, v, cap: Decimal, id_conexion=None, tipo="real"):
        self.ady.setdefault(u, []).append(len(self.a)); self.a.append([v, cap, id_conexion, cap, tipo, u])
        self.ady.setdefault(v, []).append(len(self.a)); self.a.append([u, Decimal(0), id_conexion, Decimal(0), "inversa", v])


def _camino_bfs(g: _Grafo, s, t):
    previa = {s: None}
    cola = deque([s])
    while cola:
        u = cola.popleft()
        for e in g.ady.get(u, []):
            v, cap = g.a[e][0], g.a[e][1]
            if cap > 0 and v not in previa:
                previa[v] = e
                if v == t:
                    return previa
                cola.append(v)
    return None


def _camino_dfs(g: _Grafo, s, t):
    previa = {s: None}
    pila = [s]
    while pila:
        u = pila.pop()
        if u == t:
            return previa
        for e in reversed(g.ady.get(u, [])):     # reversed: el primer vecino se explora primero
            v, cap = g.a[e][0], g.a[e][1]
            if cap > 0 and v not in previa:
                previa[v] = e
                pila.append(v)
    return previa if t in previa else None


def calcular(nodos: Dict[int, dict], aristas: Iterable[Tuple[int, int, int, Decimal]], algoritmo: str = "EDMONDS_KARP") -> dict:
    """nodos: {id_centro: {"rol": FUENTE|SUMIDERO|INTERMEDIO, "oferta": Decimal|None, "demanda": Decimal|None}}
    aristas: (id_conexion, id_origen, id_destino, capacidad). Devuelve flujo maximo, flujo por conexion y corte minimo."""
    if algoritmo not in ALGORITMOS:
        raise ReglaNegocioError("algoritmo debe ser EDMONDS_KARP o FORD_FULKERSON")
    aristas = sorted(((int(i), int(u), int(v), Decimal(c)) for i, u, v, c in aristas), key=lambda x: x[0])
    fuentes = sorted(n for n, d in nodos.items() if d["rol"] == "FUENTE")
    sumideros = sorted(n for n, d in nodos.items() if d["rol"] == "SUMIDERO")
    if not fuentes or not sumideros:
        raise ReglaNegocioError("El escenario necesita al menos una fuente y un sumidero")
    for i, u, v, c in aristas:
        if u not in nodos or v not in nodos:
            raise ReglaNegocioError(f"La conexion {i} usa un centro que no esta en el escenario")
        if c < 0:
            raise ReglaNegocioError(f"La conexion {i} tiene capacidad negativa")
    cota = sum((c for _, _, _, c in aristas), Decimal(0)) + 1

    g = _Grafo()
    for i, u, v, c in aristas:
        g.agregar(u, v, c, i, "real")
    for n in fuentes:
        o = nodos[n].get("oferta")
        g.agregar(SUPER_FUENTE, n, Decimal(o) if o is not None else cota, None, "oferta")
    for n in sumideros:
        d = nodos[n].get("demanda")
        g.agregar(n, SUPER_SUMIDERO, Decimal(d) if d is not None else cota, None, "demanda")

    buscar = _camino_bfs if algoritmo == "EDMONDS_KARP" else _camino_dfs
    total = Decimal(0)
    while True:
        previa = buscar(g, SUPER_FUENTE, SUPER_SUMIDERO)
        if previa is None or SUPER_SUMIDERO not in previa:
            break
        cuello, v = None, SUPER_SUMIDERO
        while previa[v] is not None:
            e = previa[v]
            cuello = g.a[e][1] if cuello is None else min(cuello, g.a[e][1])
            v = g.a[e ^ 1][0]
        v = SUPER_SUMIDERO
        while previa[v] is not None:
            e = previa[v]
            g.a[e][1] -= cuello
            g.a[e ^ 1][1] += cuello
            v = g.a[e ^ 1][0]
        total += cuello

    # Corte minimo: nodos alcanzables desde la super-fuente en el grafo residual final.
    alcanzables = {SUPER_FUENTE}
    cola = deque([SUPER_FUENTE])
    while cola:
        u = cola.popleft()
        for e in g.ady.get(u, []):
            if g.a[e][1] > 0 and g.a[e][0] not in alcanzables:
                alcanzables.add(g.a[e][0]); cola.append(g.a[e][0])

    flujos, corte, cap_corte = {}, [], Decimal(0)
    limites_oferta, limites_demanda = [], []
    for e in range(0, len(g.a), 2):
        v, residual, idc, original, tipo, u = g.a[e]
        usado = original - residual
        en_corte = (u in alcanzables) and (v not in alcanzables)
        if tipo == "real":
            flujos[idc] = {"flujo": usado, "capacidad": original, "en_corte_minimo": en_corte}
            if en_corte:
                corte.append(idc); cap_corte += original
        elif en_corte:
            cap_corte += original
            (limites_oferta if tipo == "oferta" else limites_demanda).append(v if tipo == "oferta" else u)
    return {"algoritmo": algoritmo, "flujo_maximo": total, "flujos": flujos, "corte_minimo": sorted(corte),
            "capacidad_corte": cap_corte, "ofertas_limitantes": sorted(limites_oferta),
            "demandas_limitantes": sorted(limites_demanda)}
