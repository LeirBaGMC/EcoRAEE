import { useState } from 'react';
import { Admin, Lotes, Recepciones as Api } from '../api/endpoints.js';
import { useAccion, useAsync, useForm } from '../lib/hooks.js';
import { texto } from '../lib/format.js';
import { Alerta, Boton, Carga, Casilla, ErrorApi, Input, Pagina, Select, Seccion } from '../components/ui.jsx';

export default function Recepciones() {
  const sol = useAsync(async () => {
    const [a, b] = await Promise.all([Lotes.listarSolicitudes(1, 100, 'PENDIENTE'), Lotes.listarSolicitudes(1, 100, 'PROGRAMADA')]);
    return [...a.items, ...b.items];
  }, []);
  const centros = useAsync(Admin.centros, []);
  const f = useForm({ id_solicitud: '', id_centro: '', peso_recibido_kg: '', unidades_recibidas: '', conforme: true });
  const [hecho, setHecho] = useState(null);
  const acc = useAccion(Api.registrar);
  const enviar = async (e) => {
    e.preventDefault();
    const r = await acc.ejecutar({ id_solicitud: Number(f.v.id_solicitud), id_centro: Number(f.v.id_centro), peso_recibido_kg: f.v.peso_recibido_kg, unidades_recibidas: Number(f.v.unidades_recibidas), conforme: f.v.conforme });
    if (r) { setHecho(r); f.reiniciar(); sol.recargar(); }
  };
  return (
    <Pagina titulo="Recepción en centro" ayuda="Registra lo que llego a tu centro. Cada solicitud se recibe una sola vez.">
      {hecho && <Alerta tipo="exito" titulo="Recepción registrada">Recepcion #{hecho.id_recepcion}: {hecho.dispositivos_recibidos} dispositivo(s) recibido(s), {hecho.conforme ? 'conforme' : 'no conforme (se genero una alerta)'}.</Alerta>}
      <Seccion titulo="Datos de la recepción">
        <Carga estado={sol}>{(lista) => (
          <Carga estado={centros}>{(cs) => (
            <form onSubmit={enviar} noValidate>
              <div className="form-rejilla">
                <Select label="Solicitud" requerido opciones={lista.map((s) => ({ valor: s.id_solicitud, texto: `${s.codigo_solicitud} - ${texto(s.modalidad)} - ${s.zona_referencial}` }))} {...f.enlazar('id_solicitud')} errorApi={acc.error} ayuda={lista.length ? undefined : 'No hay solicitudes pendientes o programadas.'} />
                <Select label="Centro que recibe" requerido opciones={cs.map((c) => ({ valor: c.id_centro, texto: `${c.codigo_centro} - ${c.nombre}` }))} {...f.enlazar('id_centro')} errorApi={acc.error} />
                <Input label="Peso recibido (kg)" type="number" min="0" step="0.001" requerido {...f.enlazar('peso_recibido_kg')} errorApi={acc.error} />
                <Input label="Unidades recibidas" type="number" min="0" step="1" requerido {...f.enlazar('unidades_recibidas')} errorApi={acc.error} />
              </div>
              <Casilla label="Todo llego conforme" checked={f.v.conforme} onChange={(e) => f.set('conforme', e.target.checked)} />
              <ErrorApi error={acc.error} ayuda={{ 409: 'Esta solicitud ya fue recibida o cambio de estado.' }} />
              <Boton type="submit" enviando={acc.enviando} disabled={!f.v.id_solicitud || !f.v.id_centro || f.v.peso_recibido_kg === '' || f.v.unidades_recibidas === ''}>Registrar recepción</Boton>
            </form>
          )}</Carga>
        )}</Carga>
      </Seccion>
    </Pagina>
  );
}
