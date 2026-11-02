import { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Evidencias as Api } from '../api/endpoints.js';
import { useAccion, useForm } from '../lib/hooks.js';
import { fechaHora, texto } from '../lib/format.js';
import { R_, tiene } from '../lib/permisos.js';
import { Alerta, Boton, ErrorApi, Input, Pagina, Select, Seccion, Tabla } from '../components/ui.jsx';

export const TIPOS_EVIDENCIA = ['FOTO_REGISTRO', 'ACTA_RECEPCION', 'INFORME_EVALUACION', 'GUIA_TRASLADO', 'CERTIFICADO_TRATAMIENTO', 'ACTA_ENTREGA'];
const PROPOSITOS = [['AUDITORIA', 'Auditoría'], ['VERIFICACION_CIERRE', 'Verificación de cierre'], ['EVALUACION', 'Evaluación']].map(([valor, t]) => ({ valor, texto: t }));
const MAX_MB = 10;

// destino: objeto con EXACTAMENTE una entidad, p. ej. {id_movimiento: 5}
export function SubirEvidencia({ destino, tipos = TIPOS_EVIDENCIA, tipoInicial, alSubir }) {
  const archivoRef = useRef(null);
  const f = useForm({ tipo_evidencia: tipoInicial || tipos[0], descripcion: '' });
  const [progreso, setProgreso] = useState(null);
  const [errorLocal, setErrorLocal] = useState('');
  const acc = useAccion(async (fd) => { setProgreso(0); try { return await Api.subir(fd, setProgreso); } finally { setProgreso(null); } });

  const enviar = async (e) => {
    e.preventDefault();
    const arch = archivoRef.current?.files?.[0];
    if (!arch) { setErrorLocal('Elige un archivo PDF, JPG o PNG.'); return; }
    if (arch.size > MAX_MB * 1024 * 1024) { setErrorLocal(`El archivo pesa mas de ${MAX_MB} MB.`); return; }
    setErrorLocal('');
    const fd = new FormData();
    fd.append('tipo_evidencia', f.v.tipo_evidencia);
    if (f.v.descripcion.trim()) fd.append('descripcion', f.v.descripcion.trim());
    Object.entries(destino).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append('archivo', arch);
    const r = await acc.ejecutar(fd);
    if (r) { if (archivoRef.current) archivoRef.current.value = ''; f.set('descripcion', ''); if (alSubir) alSubir(r); }
  };
  return (
    <form onSubmit={enviar} noValidate>
      <div className="form-rejilla">
        <Select label="Tipo de evidencia" requerido vacio="Selecciona..." opciones={tipos.map((t) => ({ valor: t, texto: texto(t) }))} {...f.enlazar('tipo_evidencia')} errorApi={acc.error} />
        <div className="campo">
          <label htmlFor="archivo-ev">Archivo (PDF, JPG o PNG, hasta {MAX_MB} MB) *</label>
          <input id="archivo-ev" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" ref={archivoRef} aria-invalid={errorLocal ? true : undefined} aria-describedby={errorLocal ? 'archivo-ev-er' : undefined} />
          {errorLocal && <small id="archivo-ev-er" className="msg-error">{errorLocal}</small>}
        </div>
        <Input label="Descripción (opcional)" {...f.enlazar('descripcion')} errorApi={acc.error} />
      </div>
      {progreso !== null && <p><label htmlFor="prog-ev">Subiendo {progreso}%</label> <progress id="prog-ev" className="progreso" value={progreso} max="100" /></p>}
      <ErrorApi error={acc.error} ayuda={{ 422: 'Revisa que el archivo sea realmente PDF, JPG o PNG y que el tipo corresponda a lo que respalda.', 0: 'La carga no termino: reintenta.' }} />
      {acc.ok && !acc.error && <Alerta tipo="exito">Evidencia #{acc.ok.id_evidencia} guardada ({texto(acc.ok.tipo_evidencia)}).</Alerta>}
      <Boton type="submit" enviando={acc.enviando}>Subir evidencia</Boton>
    </form>
  );
}

export function ListaEvidencias({ destino, propositoInicial = 'AUDITORIA', refresco }) {
  const [proposito, setProposito] = useState(propositoInicial);
  const [filas, setFilas] = useState(null);
  const listar = useAccion(async () => { const r = await Api.listar(proposito, destino); setFilas(r); return r; });
  const abrir = useAccion(async (id) => {
    const blob = await Api.archivo(id, proposito);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000); // el enlace vive en memoria, no se guarda
    return true;
  });
  return (
    <div>
      <div className="acciones">
        <Select label="Propósito de la consulta" value={proposito} onChange={(e) => setProposito(e.target.value)} vacio="Selecciona..." opciones={PROPOSITOS} />
        <Boton tipo="secundario" enviando={listar.enviando} onClick={() => listar.ejecutar()} data-refresco={refresco}>Consultar evidencias</Boton>
      </div>
      <p className="nota">Cada consulta y descarga queda registrada con su propósito.</p>
      <ErrorApi error={listar.error || abrir.error} ayuda={{ 403: 'Tu rol o el propósito elegido no permiten ver evidencias.' }} />
      {filas && <Tabla titulo="Evidencias" clave="id_evidencia" filas={filas} vacio="No hay evidencias para este registro." columnas={[
        { titulo: 'Número', ver: (f) => `#${f.id_evidencia}` },
        { titulo: 'Tipo', ver: (f) => texto(f.tipo_evidencia) },
        { titulo: 'Descripción', ver: (f) => f.descripcion || '-' },
        { titulo: 'Fecha', ver: (f) => fechaHora(f.fecha_carga) },
        { titulo: 'Archivo', ver: (f) => <button type="button" className="btn btn-sec btn-chico" disabled={abrir.enviando} onClick={() => abrir.ejecutar(f.id_evidencia)}>Abrir</button> },
      ]} />}
    </div>
  );
}

const DESTINOS = [
  { valor: 'id_recepcion', texto: 'Recepción', campos: [['id_recepcion', 'Número de recepción']] },
  { valor: 'id_movimiento', texto: 'Movimiento', campos: [['id_movimiento', 'Número de movimiento']] },
  { valor: 'id_cierre', texto: 'Cierre de trazabilidad', campos: [['id_cierre', 'Número de cierre']] },
  { valor: 'evaluacion', texto: 'Evaluación técnica', campos: [['id_dispositivo_evaluacion', 'Número de dispositivo'], ['nro_evaluacion', 'Número de evaluación']] },
];

export default function Evidencias({ query }) {
  const { usuario } = useAuth();
  const f = useForm({ destino: query.destino || 'id_movimiento', a: query.id || '', b: '' });
  const d = DESTINOS.find((x) => x.valor === f.v.destino);
  const destino = {};
  if (f.v.a) destino[d.campos[0][0]] = f.v.a;
  if (d.campos[1] && f.v.b) destino[d.campos[1][0]] = f.v.b;
  const completo = Object.keys(destino).length === d.campos.length;
  const [version, setVersion] = useState(0);
  return (
    <Pagina titulo="Evidencias" ayuda="Cada evidencia respalda exactamente un registro. Primero elige cual.">
      <Seccion titulo="Registro a respaldar o consultar">
        <div className="form-rejilla">
          <Select label="Tipo de registro" requerido vacio="Selecciona..." opciones={DESTINOS.map((x) => ({ valor: x.valor, texto: x.texto }))} value={f.v.destino} onChange={(e) => f.setV({ destino: e.target.value, a: '', b: '' })} />
          <Input label={d.campos[0][1]} type="number" min="1" value={f.v.a} onChange={(e) => f.set('a', e.target.value)} />
          {d.campos[1] && <Input label={d.campos[1][1]} type="number" min="1" value={f.v.b} onChange={(e) => f.set('b', e.target.value)} />}
        </div>
      </Seccion>
      {!completo && <Alerta tipo="info">Completa los numeros para subir o consultar evidencias.</Alerta>}
      {completo && tiene(usuario, R_.O, R_.T, R_.C, R_.R) && (
        <Seccion titulo="Subir evidencia"><SubirEvidencia destino={destino} alSubir={() => setVersion((x) => x + 1)} /></Seccion>
      )}
      {completo && tiene(usuario, R_.T, R_.C, R_.A) && (
        <Seccion titulo="Consultar evidencias"><ListaEvidencias key={version} destino={destino} refresco={version} /></Seccion>
      )}
    </Pagina>
  );
}
