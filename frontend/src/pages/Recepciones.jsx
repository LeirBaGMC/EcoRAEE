import { useState } from 'react';
import { Admin, Lotes, Recepciones as Api } from '../api/endpoints.js';
import { traerTodo, useAccion, useAsync, useForm } from '../lib/hooks.js';
import { texto } from '../lib/format.js';
import { Alerta, Boton, Carga, Casilla, ErrorApi, Input, Pagina, Select, Seccion } from '../components/ui.jsx';

export default function Recepciones() {
  const sol = useAsync(async () => {
    const [a, b] = await Promise.all(['PENDIENTE', 'PROGRAMADA'].map((estado) => traerTodo((p, t) => Lotes.listarSolicitudes(p, t, estado))));
    return [...a, ...b].filter((s) => s.modalidad === 'ENTREGA_DIRECTA' || s.fecha_ejecucion).sort((x, y) => String(y.fecha_solicitud).localeCompare(String(x.fecha_solicitud)) || y.id_solicitud - x.id_solicitud);
  }, []);
  const centros = useAsync(Admin.centros, []);
  const f = useForm({ id_solicitud: '', id_centro: '', peso_recibido_kg: '', unidades_recibidas: '', conforme: true });
  const [hecho, setHecho] = useState(null);
  const acc = useAccion(Api.registrar);
  const enviar = async (e) => {
    e.preventDefault();
    if (!f.v.id_solicitud || !f.v.id_centro || Number(f.v.peso_recibido_kg) < 0 || !Number.isInteger(Number(f.v.unidades_recibidas)) || Number(f.v.unidades_recibidas) < 0) return;
    setHecho(null);
    const r = await acc.ejecutar({ id_solicitud: Number(f.v.id_solicitud), id_centro: Number(f.v.id_centro), peso_recibido_kg: f.v.peso_recibido_kg, unidades_recibidas: Number(f.v.unidades_recibidas), conforme: f.v.conforme });
    if (r) { setHecho(r); f.reiniciar(); sol.recargar(); }
  };
  return (
    <Pagina titulo="Recepción en centro" ayuda="Registra lo que llego a tu centro. Cada solicitud se recibe una sola vez.">
      {hecho && <Alerta tipo="exito" titulo="Recepción registrada">Recepción #{hecho.id_recepcion}: {hecho.dispositivos_recibidos} registro(s) trazable(s) recibido(s), {hecho.conforme ? 'conforme' : 'no conforme (se generó una alerta)'}. Un registro a granel puede agrupar varias unidades.</Alerta>}
      <Seccion titulo="Datos de la recepción">
        <Carga estado={sol}>{(lista) => (
          <Carga estado={centros}>{(cs) => (
            <form onSubmit={enviar} noValidate>
              <div className="form-rejilla">
                <Select label="Solicitud" requerido buscable ordenar={false} opciones={lista.map((s) => ({ valor: s.id_solicitud, texto: `${s.codigo_solicitud} - ${texto(s.modalidad)} - ${s.zona_referencial}` }))} {...f.enlazar('id_solicitud')} errorApi={acc.error} ayuda={lista.length ? 'Más recientes primero. Solo entregas directas o recolecciones ya realizadas.' : 'No hay solicitudes disponibles: primero debe ejecutarse la recolección, o registrarse una entrega directa.'} />
                <Select label="Centro que recibe" requerido buscable opciones={cs.map((c) => ({ valor: c.id_centro, texto: `${c.nombre} (${c.codigo_centro})` }))} {...f.enlazar('id_centro')} errorApi={acc.error} />
                <Input label="Peso recibido (kg)" type="number" min="0" step="0.001" requerido error={f.v.peso_recibido_kg !== '' && Number(f.v.peso_recibido_kg) < 0 ? 'El peso no puede ser negativo.' : undefined} {...f.enlazar('peso_recibido_kg')} errorApi={acc.error} />
                <Input label="Unidades recibidas" type="number" min="0" step="1" requerido error={f.v.unidades_recibidas !== '' && (!Number.isInteger(Number(f.v.unidades_recibidas)) || Number(f.v.unidades_recibidas) < 0) ? 'Introduce un número entero no negativo.' : undefined} {...f.enlazar('unidades_recibidas')} errorApi={acc.error} />
              </div>
              <Casilla label="Todo llego conforme" checked={f.v.conforme} onChange={(e) => f.set('conforme', e.target.checked)} />
              <ErrorApi error={acc.error} ayuda={{ 409: 'Esta solicitud ya fue recibida o cambio de estado.' }} />
              <Boton type="submit" enviando={acc.enviando} ayudaDeshabilitado="Elige la solicitud y el centro; completa peso y unidades no negativos." disabled={!f.v.id_solicitud || !f.v.id_centro || f.v.peso_recibido_kg === '' || Number(f.v.peso_recibido_kg) < 0 || f.v.unidades_recibidas === '' || !Number.isInteger(Number(f.v.unidades_recibidas)) || Number(f.v.unidades_recibidas) < 0}>Registrar recepción</Boton>
            </form>
          )}</Carga>
        )}</Carga>
      </Seccion>
    </Pagina>
  );
}
