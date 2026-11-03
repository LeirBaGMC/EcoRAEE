"""Puebla el front por API usando SOLO cuentas existentes. Sin borrar datos.

Backend iniciado en localhost:8000. Clave común de las cuentas de desarrollo:
ECORAEE_PRUEBAS_CLAVE. Guarda progreso en .datos-front.json; no borrarlo al repetir.
"""
import calendar
import json
import os
from datetime import date
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parents[1]
ARCHIVO = ROOT / '.datos-front.json'


def pdf(titulo):
    stream = f'BT /F1 16 Tf 50 760 Td (ECORAEE - PRUEBA FRONTEND) Tj /F1 12 Tf 0 -40 Td ({titulo}) Tj 0 -30 Td (Documento ficticio sin validez legal.) Tj ET'.encode('ascii')
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
               b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
               f'<< /Length {len(stream)} >>\nstream\n'.encode() + stream + b'\nendstream']
    out = bytearray(b'%PDF-1.4\n'); offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out)); out.extend(f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n')
    start = len(out); out.extend(b'xref\n0 6\n0000000000 65535 f \n')
    for offset in offsets:
        out.extend(f'{offset:010d} 00000 n \n'.encode())
    out.extend(f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode())
    return bytes(out)


def main():
    clave = os.environ['ECORAEE_PRUEBAS_CLAVE']
    m = json.loads(ARCHIVO.read_text(encoding='utf-8')) if ARCHIVO.exists() else {}
    cab = {}
    with httpx.Client(base_url='http://localhost:8000', timeout=30) as c:
        def req(method, path, rol='adm', **kw):
            r = c.request(method, path, headers=cab.get(rol, {}), **kw)
            if not r.is_success: raise RuntimeError(f'{method} {path}: {r.status_code} {r.text[:500]}')
            return r
        def save():
            temp = ARCHIVO.with_suffix('.tmp')
            temp.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding='utf-8'); temp.replace(ARCHIVO)
        def step(key, path, rol='adm', body=None, **kw):
            if key not in m:
                if body is not None: kw['json'] = body
                m[key] = req('POST', path, rol, **kw).json(); save(); print('Creado:', key, flush=True)
            return m[key]
        perfiles = {}
        for rol, usuario in {'adm':'adm1','gen':'gen1','op':'op1','tec':'tec1','coo':'coo1','rea':'rea1'}.items():
            token = req('POST','/auth/login',json={'nombre_usuario':usuario,'contrasena':clave}).json()['access_token']
            cab[rol] = {'Authorization': 'Bearer '+token}
            perfiles[rol] = req('GET','/auth/me',rol).json()
        org = perfiles['adm']['id_organizacion']
        assert all(p['id_organizacion'] == org for p in perfiles.values()), 'Las cuentas operativas deben pertenecer a la misma organizacion.'
        assert m.get('_org', org) == org
        m['_org'] = org
        hoy = m.setdefault('_fecha', str(date.today())); save()
        cat = req('GET','/catalogos').json()
        categoria = next(x['id_categoria'] for x in cat['categorias'] if x['nombre_categoria']=='LAPTOP')
        clases = {x['nombre_clasificacion']:x['id_clasificacion'] for x in cat['clasificaciones']}
        beneficiarias = req('GET','/organizaciones',params={'tipo_actor':'BENEFICIARIO','tamano':100}).json()['items']
        assert beneficiarias, 'Se necesita una organizacion beneficiaria existente.'
        ben = beneficiarias[0]['id_organizacion']
        centros = []
        for n,tipo in enumerate(['RECOLECCION','REACONDICIONAMIENTO','RECICLAJE'],1):
            centros.append(step(f'centro_{n}','/centros',body={'codigo_centro':f'PRUEBA-UI-{n}','nombre':f'Prueba frontend - {tipo.title()}',
                'tipo_centro':tipo,'ciudad':'Quito','capacidad_almacenamiento':500,'id_organizacion':org})['id_centro'])
        conexiones = []
        for n,(a,b,cap) in enumerate([(0,1,5),(0,2,3),(1,2,5)],1):
            conexiones.append(step(f'conexion_{n}','/conexiones',body={'id_centro_origen':centros[a],'id_centro_destino':centros[b],
                'capacidad_por_periodo':cap,'unidad_capacidad':'UND'})['id_conexion'])
        def evidencia(key,tipo,**destino):
            contenido=pdf(key.replace('_',' '))
            ev=step('evidencia_'+key,'/evidencias','op',data={'tipo_evidencia':tipo,'descripcion':'PRUEBA FRONT - '+key,**{k:str(v) for k,v in destino.items()}},
                files={'archivo':(key+'.pdf',contenido,'application/pdf')})
            assert req('GET',f"/evidencias/{ev['id_evidencia']}/archivo",params={'proposito':'AUDITORIA'}).content==contenido
            assert any(e['id_evidencia']==ev['id_evidencia'] for e in req('GET','/evidencias',params={'proposito':'AUDITORIA',**destino}).json())
        casos=['registrado_1','registrado_2','solicitud_pendiente','recibido','evaluado','reparable','mov_programado','mov_autorizado',
               'mov_transito_sin_guia','mov_transito_con_guia','mov_cerrado','tratamiento_curso','tratamiento_cerrado','asignacion_pendiente']
        for caso in casos:
            did=step('disp_'+caso,'/dispositivos','gen',{'tipo_registro':'INDIVIDUAL','id_categoria':categoria,'condicion_declarada':'ENCIENDE',
                'marca':'PRUEBA FRONT','modelo':caso,'numero_serie':'PRUEBA-UI-'+caso})['id_dispositivo']
            if caso.startswith('registrado'): continue
            lote=step('lote_'+caso,'/lotes','gen',{'ids_dispositivos':[did]})['id_lote']
            sol=step('sol_'+caso,'/solicitudes','gen',{'id_lote':lote,'modalidad':'RECOLECCION' if caso=='solicitud_pendiente' else 'ENTREGA_DIRECTA','zona_referencial':'Prueba frontend - Quito'})['id_solicitud']
            if caso=='solicitud_pendiente': continue
            rec=step('rec_'+caso,'/recepciones','op',{'id_solicitud':sol,'id_centro':centros[0],'peso_recibido_kg':'2.5','unidades_recibidas':1,'conforme':True})['id_recepcion']
            if caso=='recibido':
                evidencia('acta_recepcion','ACTA_RECEPCION',id_recepcion=rec); continue
            clasif='REPARABLE' if caso in ('reparable','tratamiento_curso') else 'RECICLABLE' if caso=='tratamiento_cerrado' else 'REUTILIZABLE'
            ev=step('eval_'+caso,f'/dispositivos/{did}/evaluaciones','tec',{'condicion_constatada':'ENCIENDE','diagnostico':'Prueba frontend - '+caso,'id_clasificacion':clases[clasif]})
            if caso=='evaluado': evidencia('informe_evaluacion','INFORME_EVALUACION',id_dispositivo_evaluacion=did,nro_evaluacion=ev['nro_evaluacion'])
            if caso.startswith('mov_'):
                mid=step(caso,'/movimientos','coo',{'id_conexion':conexiones[0],'tipo_movimiento':'TRANSFERENCIA','fecha_despacho':hoy,'dispositivos':[{'id_dispositivo':did,'peso_despachado_kg':'2.5'}]})['id_movimiento']
                if caso=='mov_programado': continue
                step('autorizar_'+caso,f'/movimientos/{mid}/autorizar','coo')
                if caso=='mov_autorizado':
                    evidencia(caso,'GUIA_TRASLADO',id_movimiento=mid); continue
                step('despachar_'+caso,f'/movimientos/{mid}/despachar','op')
                if caso!='mov_transito_sin_guia': evidencia(caso,'GUIA_TRASLADO',id_movimiento=mid)
                if caso=='mov_cerrado': step('cerrar_'+caso,f'/movimientos/{mid}/cerrar','coo',{'conformes':[]})
            if caso.startswith('tratamiento_'):
                tid=step(caso,'/tratamientos','rea',{'id_dispositivo':did,'tipo_tratamiento':'RECICLAJE' if caso=='tratamiento_cerrado' else 'REACONDICIONAMIENTO'})['id_tratamiento']
                if caso=='tratamiento_cerrado':
                    step('finalizar_'+caso,f'/tratamientos/{tid}/finalizar','rea',{'resultado':'EXITOSO'})
                    cid=step('cierre','/cierres','coo',{'id_dispositivo':did,'id_tratamiento':tid,'fecha_confirmacion':hoy})['id_cierre']
                    evidencia('certificado','CERTIFICADO_TRATAMIENTO',id_cierre=cid)
            if caso=='asignacion_pendiente':
                step(caso,'/asignaciones','coo',{'id_dispositivo':did,'id_organizacion_beneficiaria':ben,'finalidad':'Prueba frontend - aula informatica'})
        fecha=date.fromisoformat(hoy)
        eid=step('escenario','/escenarios','coo',{'nombre':'Prueba frontend - red de tres centros','fecha_inicio_periodo':str(fecha.replace(day=1)),
            'fecha_fin_periodo':str(fecha.replace(day=calendar.monthrange(fecha.year,fecha.month)[1])),'unidad_flujo':'UND',
            'nodos':[{'id_centro':cid,'rol_nodo':rol} for cid,rol in zip(centros,['FUENTE','INTERMEDIO','SUMIDERO'])],
            'conexiones':[{'id_conexion':cid} for cid in conexiones]})['id_escenario']
        for alg in ['EDMONDS_KARP','FORD_FULKERSON']:
            step(alg,f'/escenarios/{eid}/ejecuciones','coo',{'algoritmo':alg})
        if not m.get('_completo'):
            req('POST','/indicadores/calcular'); req('POST','/alertas/evaluar'); m['_completo']=True;save()
        lineas=['# Datos para probar con adm1','','No se crearon usuarios. Inicia sesión con adm1 y su clave habitual.','',
                '## Evidencias','','| Tipo | Registro | Archivo |','| --- | --- | --- |']
        for key,v in m.items():
            if key.startswith('evidencia_'):
                destino={k:v[k] for k in ['id_recepcion','id_dispositivo_evaluacion','nro_evaluacion','id_movimiento','id_cierre'] if v.get(k) is not None}
                lineas.append(f"| {v['tipo_evidencia']} | {destino} | {v['id_evidencia']} |")
        lineas+=['','En Evidencias selecciona el tipo, introduce el número y usa propósito Auditoría.','','## Dispositivos','','| Caso | ID | Estado |','| --- | --- | --- |']
        for caso in casos:
            did=m['disp_'+caso]['id_dispositivo'];r=req('GET',f'/dispositivos/{did}','coo').json()
            lineas.append(f"| {caso} | {did} | {r['estado_actual']} |")
        lineas+=['','## Recorrido','',f'- Análisis de red: escenario {eid}, dos ejecuciones guardadas.',
                 '- Recepciones, Tratamientos y Cierres: nuevos listados globales para el administrador.',
                 '- Movimientos: programado, autorizado, en tránsito y cerrado.',
                 '- Indicadores y alertas: mediciones actualizadas y alertas de capacidad/guía faltante.',
                 '- Auditoría: cambios generados por los usuarios operativos existentes.',
                 '- El administrador consulta toda la red; no se le añadieron permisos operativos de escritura.',
                 '- Datos ficticios identificados como PRUEBA FRONT; archivos PDF verificados por descarga HTTP.',
                 '- La conexión de prueba tiene toda su capacidad reservada; para programar otro movimiento usa otra conexión/periodo o anula una reserva con coo1.',
                 '- Para repetir la carga conserva backend/.datos-front.json. No repite pasos ya completados.']
        (ROOT.parent/'DATOS_PRUEBA_ADM1.md').write_text('\n'.join(lineas)+'\n',encoding='utf-8')
        print('Carga completa: 14 dispositivos y 6 PDF. No se crearon usuarios.')


if __name__=='__main__': main()
