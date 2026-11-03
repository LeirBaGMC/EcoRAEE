"""Borra únicamente la demo identificada por .demo-front.json.

Sin --aplicar realiza toda la eliminación dentro de una transacción que revierte.
Las restricciones FK permanecen activas. No usa cascadas inferidas por nombre.
"""
import argparse
import json
from pathlib import Path

from sqlalchemy import text
from app.db import transaccion
from app.integrations.almacenamiento import AlmacenamientoLocal, obtener_almacenamiento

ROOT = Path(__file__).resolve().parents[1]


class Simulacion(Exception):
    pass


def main(aplicar=False):
    archivo = ROOT / '.demo-front.json'
    m = json.loads(archivo.read_text(encoding='utf-8'))
    def ids(prefijo, campo):
        return sorted({v[campo] for k, v in m.items() if k.startswith(prefijo) and isinstance(v, dict) and campo in v})
    grupos = {
        'usuario': ('id_usuario', ids('usuario_', 'id_usuario')),
        'organizacion': ('id_organizacion', [m['org']['id_organizacion'], m['org_ben']['id_organizacion']]),
        'centro': ('id_centro', ids('centro_', 'id_centro')),
        'conexion_logistica': ('id_conexion', ids('conexion_', 'id_conexion')),
        'dispositivo': ('id_dispositivo', ids('disp_', 'id_dispositivo')),
        'lote': ('id_lote', ids('lote_', 'id_lote')),
        'solicitud_recoleccion': ('id_solicitud', ids('sol_', 'id_solicitud')),
        'recepcion': ('id_recepcion', ids('rec_', 'id_recepcion')),
        'movimiento': ('id_movimiento', ids('mov_', 'id_movimiento')),
        'tratamiento': ('id_tratamiento', ids('tratamiento_', 'id_tratamiento')),
        'asignacion_beneficiario': ('id_asignacion', ids('asignacion_', 'id_asignacion')),
        'cierre_trazabilidad': ('id_cierre', ids('cierre_', 'id_cierre')),
        'evidencia': ('id_evidencia', ids('ev_', 'id_evidencia')),
        'escenario_red': ('id_escenario', [m['escenario']['id_escenario']]),
        'ejecucion_flujo': ('id_ejecucion', [m[a]['id_ejecucion'] for a in ('EDMONDS_KARP', 'FORD_FULKERSON')]),
    }
    def numeros(valores):
        assert valores and all(type(v) is int and v > 0 for v in valores)
        return ','.join(map(str, valores))
    def filtro(tabla, columna=None):
        campo, valores = grupos[tabla]
        return f'{columna or campo} IN ({numeros(valores)})'
    conteos = {}
    claves = []
    try:
        with transaccion() as s:
            # Identidad exacta: no borrar una cuenta renombrada/reutilizada ni una BD distinta.
            for k, v in m.items():
                if k.startswith('usuario_'):
                    nombre = s.execute(text('SELECT nombre_usuario FROM usuario WHERE id_usuario=:id'), {'id': v['id_usuario']}).scalar()
                    assert nombre == v['nombre_usuario'] and nombre.startswith('demo_'), (k, nombre)
            for key in ('org', 'org_ben'):
                org = m[key]
                nombre = s.execute(text('SELECT nombre FROM organizacion WHERE id_organizacion=:id AND ruc=:r'), {'id': org['id_organizacion'], 'r': org['ruc']}).scalar()
                assert nombre == org['nombre'] and nombre.startswith('DEMO FRONT')
            assert m['_admin'] not in grupos['usuario'][1]
            for tabla, (campo, valores) in grupos.items():
                count = s.execute(text(f'SELECT COUNT(*) FROM {tabla} WHERE {filtro(tabla)}')).scalar()
                assert count == len(valores), (tabla, count, len(valores))
            for did in grupos['dispositivo'][1]:
                serie = s.execute(text('SELECT numero_serie FROM dispositivo_individual WHERE id_dispositivo=:id'), {'id': did}).scalar()
                assert serie.startswith('DEMO-FRONT-'), serie
            claves = list(s.execute(text(f"SELECT uri_archivo FROM evidencia WHERE {filtro('evidencia')}")).scalars())
            almacen = obtener_almacenamiento()
            assert isinstance(almacen, AlmacenamientoLocal), 'Esta limpieza solo admite almacenamiento local.'
            for clave in claves:
                ruta = almacen._ruta(clave)
                assert ROOT in ruta.parents, 'Archivo fuera del backend: detener y revisar.'

            def borrar(tabla, where):
                n = s.execute(text(f'SELECT COUNT(*) FROM {tabla} WHERE {where}')).scalar()
                s.execute(text(f'DELETE FROM {tabla} WHERE {where}'))
                conteos[tabla] = conteos.get(tabla, 0) + n

            # Auditoría asociada a los objetos demo, incluidas creaciones hechas por adm1.
            condiciones = [filtro('usuario')]
            for tabla, (_, valores) in grupos.items():
                condiciones.append(f"(tabla_afectada='{tabla}' AND clave_registro IN ({','.join(repr(str(x)) for x in valores)}))")
            condiciones.append(f"(tabla_afectada='usuario_rol' AND clave_registro IN ({','.join(repr(str(x)) for x in grupos['usuario'][1])}))")
            borrar('auditoria_cambio', ' OR '.join(condiciones))
            borrar('alerta', ' OR '.join(filtro(t) for t in ('centro', 'conexion_logistica', 'dispositivo')))
            borrar('resultado_flujo', filtro('ejecucion_flujo'))
            for tabla in ('ejecucion_flujo',):
                borrar(tabla, filtro(tabla))
            for tabla in ('escenario_conexion', 'escenario_nodo'):
                borrar(tabla, filtro('escenario_red'))
            borrar('escenario_red', filtro('escenario_red'))
            for tabla in ('evidencia', 'cierre_trazabilidad', 'asignacion_beneficiario', 'tratamiento'):
                borrar(tabla, filtro(tabla))
            borrar('movimiento_dispositivo', filtro('movimiento'))
            borrar('movimiento', filtro('movimiento'))
            for tabla in ('inventario', 'historial_estado', 'evaluacion_tecnica'):
                borrar(tabla, filtro('dispositivo'))
            borrar('recepcion', filtro('recepcion'))
            borrar('recoleccion', filtro('solicitud_recoleccion'))
            borrar('solicitud_recoleccion', filtro('solicitud_recoleccion'))
            borrar('lote_dispositivo', filtro('lote'))
            borrar('lote', filtro('lote'))
            for tabla in ('dispositivo_individual', 'dispositivo_granel', 'dispositivo'):
                borrar(tabla, filtro('dispositivo'))
            for tabla in ('conexion_logistica', 'centro'):
                borrar(tabla, filtro(tabla))
            borrar('usuario_rol', filtro('usuario'))
            borrar('usuario', filtro('usuario'))
            borrar('organizacion_tipo_actor', filtro('organizacion'))
            borrar('organizacion', filtro('organizacion'))
            assert s.execute(text("SELECT COUNT(*) FROM usuario WHERE id_usuario=:id AND nombre_usuario='adm1'"), {'id': m['_admin']}).scalar() == 1
            print(json.dumps(conteos, indent=2))
            if not aplicar:
                raise Simulacion()
    except Simulacion:
        print('SIMULACION: transaccion revertida; no se eliminaron archivos.')
        return
    # Las filas ya se eliminaron. Las claves validadas permiten reintentar el borrado de archivos si falla.
    informe = ROOT / '.demo-front-eliminada.json'
    informe.write_text(json.dumps({'conteos': conteos, 'claves_archivo': claves}, indent=2), encoding='utf-8')
    for clave in claves:
        almacen.eliminar(clave)
    archivo.unlink()
    print(f'ELIMINADO: datos demo y {len(claves)} archivos. adm1 conservado.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--aplicar', action='store_true')
    main(parser.parse_args().aplicar)
