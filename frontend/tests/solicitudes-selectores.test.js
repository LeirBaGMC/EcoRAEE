import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const carpeta = await mkdtemp(`${raiz}node_modules/.auditoria-`);
await build({stdin:{contents:`export {Select,ErrorApi,Boton} from './src/components/ui.jsx';
 export {AuthProvider,useAuth} from './src/auth/AuthContext.jsx'; export {sesion} from './src/api/client.js';
 export {default as Solicitudes} from './src/pages/Solicitudes.jsx'; export {default as Recepciones} from './src/pages/Recepciones.jsx';`,resolveDir:raiz},
 bundle:true,format:'esm',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],
 define:{'import.meta.env.VITE_API_URL':'"http://localhost:8000"'},outfile:`${carpeta}/app.mjs`});
const app = await import(pathToFileURL(`${carpeta}/app.mjs`));
test.after(async()=>rm(carpeta,{recursive:true,force:true}));
const respuesta=(data)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});

test('un error y su ayuda idéntica se muestran una sola vez',()=>{
 let vista;
 act(()=>{vista=create(React.createElement(app.ErrorApi,{error:{status:409,message:'Ya existe una organización con ese RUC'},ayuda:{409:'Ya existe una organización con ese RUC.'}}));});
 assert.equal((JSON.stringify(vista.toJSON()).match(/Ya existe una organización/g)||[]).length,1);
 act(()=>vista.unmount());
});

test('selectores de entidades ordenan, buscan sin tildes y conservan la selección oculta por filtro',async()=>{
 let vista;
 const opciones=Array.from({length:10},(_,i)=>({valor:i+1,texto:i===0?'Árbol Quito':`Centro ${11-i}`}));
 await act(async()=>{vista=create(React.createElement(app.Select,{label:'Centros',opciones,value:'2',onChange(){}}));});
 assert.equal(vista.root.findAllByType('option')[1].props.children,'Árbol Quito');
 await act(async()=>vista.root.findByType('input').props.onChange({target:{value:'arbol'}}));
 assert.deepEqual(vista.root.findAllByType('option').map(o=>String(o.props.value)).sort(),['','1','2']);
 assert.equal(vista.root.findByType('select').props.value,'2');
 assert.match(JSON.stringify(vista.toJSON()),/Se conserva la selección actual/);
 act(()=>vista.unmount());
});

test('un botón ocupado permanece deshabilitado aunque disabled sea false',()=>{
 let vista; act(()=>{vista=create(React.createElement(app.Boton,{enviando:true,disabled:false},'Guardar'));});
 assert.equal(vista.root.findByType('button').props.disabled,true); act(()=>vista.unmount());
});

test('una recolección ejecutada no ofrece repetir y una futura informa cuándo estará disponible',async(t)=>{
 t.mock.method(globalThis,'fetch',async(url)=>respuesta(new URL(url).pathname==='/auth/me'?{roles:['COORDINADOR_LOGISTICO']}:{items:[
  {id_solicitud:88,codigo_solicitud:'SOL-EJECUTADA',id_lote:89,modalidad:'RECOLECCION',estado_solicitud:'PROGRAMADA',fecha_ejecucion:'2026-11-02',fecha_programada:'2026-11-02'},
  {id_solicitud:87,codigo_solicitud:'SOL-FUTURA',id_lote:88,modalidad:'RECOLECCION',estado_solicitud:'PROGRAMADA',fecha_programada:'2099-01-01'}],total:2,pagina:1,tamano:20}));
 let vista; app.sesion.guardar('prueba');
 function Pantalla(){const{usuario}=app.useAuth();return usuario?React.createElement(app.Solicitudes):null;}
 try{
  await act(async()=>{vista=create(React.createElement(app.AuthProvider,null,React.createElement(Pantalla)));});
  const botones=vista.root.findAllByType('button').filter(b=>b.props.children==='Marcar recolectado');
  assert.equal(botones.length,1); assert.equal(botones[0].props.disabled,true);
  assert.match(JSON.stringify(vista.toJSON()),/Recolectado el/);
  assert.ok(vista.root.findAllByType('option').some(o=>o.props.value==='ATENDIDA'));
 }finally{act(()=>vista?.unmount());app.sesion.borrar();}
});

test('recepción incluye páginas posteriores y excluye recolecciones sin ejecutar',async(t)=>{
 const paginas=[];
 t.mock.method(globalThis,'fetch',async(url)=>{
  const u=new URL(url);
  if(u.pathname==='/centros')return respuesta([{id_centro:1,codigo_centro:'CEN1',nombre:'Centro'}]);
  const p=Number(u.searchParams.get('pagina')); const estado=u.searchParams.get('estado'); paginas.push([estado,p]);
  const items=estado==='PROGRAMADA'?Array.from({length:101},(_,i)=>({id_solicitud:i+1,codigo_solicitud:i===100?'RECOLECTADA-PAGINA-2':'FUTURA',modalidad:'RECOLECCION',fecha_solicitud:'2026-11-02',fecha_ejecucion:i===100?'2026-11-02':null})):[];
  return respuesta({items:items.slice((p-1)*100,p*100),total:items.length});
 });
 let vista;try{
  await act(async()=>{vista=create(React.createElement(app.Recepciones));});
  const pantalla=JSON.stringify(vista.toJSON());
  assert.match(pantalla,/RECOLECTADA-PAGINA-2/);assert.doesNotMatch(pantalla,/FUTURA/);
  assert.ok(paginas.some(([estado,p])=>estado==='PROGRAMADA'&&p===2));
 }finally{act(()=>vista?.unmount());}
});
