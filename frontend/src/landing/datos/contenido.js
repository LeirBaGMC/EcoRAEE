import {
  BatteryCharging, Camera, ClipboardCheck, Cpu, Gamepad2, Globe, Headphones, Laptop, Leaf, Monitor, PackagePlus,
  Printer, Recycle, Router, ScanSearch, ShieldAlert, Smartphone, Sparkles, Tablet, Truck, Tv, Wrench,
} from 'lucide-react';

export const SECCIONES = [
  { id: 'historia', texto: 'Valor oculto' },
  { id: 'panorama', texto: 'Panorama' },
  { id: 'plan', texto: 'Recuperación' },
  { id: 'proceso', texto: 'Proceso' },
  { id: 'impacto', texto: 'Impacto' },
];

export const SATELITES = [Smartphone, Laptop, Monitor, Tablet, Printer, Tv];
export const CINTA = ['Teléfonos', 'Computadoras', 'Monitores', 'Tablets', 'Impresoras', 'Consolas', 'Televisores', 'Baterías'];

// Piezas del teléfono: x/y como fracción de la escena; w/h en % de la escena.
export const PIEZAS = [
  { k: 'carcasa', w: 30, h: 62, x: -0.34, y: -0.22, r: -7, Icono: Leaf, etiqueta: 'Carcasa' },
  { k: 'camara', w: 17, h: 20, x: 0, y: -0.22, r: 0, Icono: Camera, etiqueta: 'Cámara' },
  { k: 'pantalla', w: 30, h: 62, x: 0.34, y: -0.22, r: 7, Icono: Smartphone, etiqueta: 'Pantalla' },
  { k: 'placa', w: 26, h: 48, x: -0.17, y: 0.26, r: 5, Icono: Cpu, etiqueta: 'Placa' },
  { k: 'bateria', w: 20, h: 28, x: 0.17, y: 0.26, r: -5, Icono: BatteryCharging, etiqueta: 'Batería' },
];

// Red de la mina: equipo → componentes → materiales.
const c = (nombre, info, ...hijos) => ({ nombre, info, hijos });
export const RED_MINA = [
  { Icono: Smartphone, nombre: 'Teléfono', info: 'Pantalla, batería y placa', hijos: [c('Placa base', 'Metales preciosos recuperables', 'Oro', 'Plata'), c('Cámara', 'Repuesto para reparaciones', 'Vidrio', 'Aluminio')] },
  { Icono: Laptop, nombre: 'Laptop', info: 'Memoria, disco, pantalla y teclado', hijos: [c('Memoria RAM', 'Reutilizable en otros equipos', 'Oro', 'Silicio'), c('Disco', 'Se borra de forma segura y se reutiliza', 'Aluminio', 'Neodimio')] },
  { Icono: Tablet, nombre: 'Tablet', info: 'Pantalla táctil, batería y placa', hijos: [c('Pantalla táctil', 'Repuesto para reparaciones', 'Indio', 'Vidrio'), c('Batería', 'Tratamiento especializado', 'Litio', 'Cobalto')] },
  { Icono: Monitor, nombre: 'Monitor', info: 'Panel, fuente y estructura', hijos: [c('Panel', 'Reutilizable si está intacto', 'Indio', 'Vidrio'), c('Fuente de poder', 'Cobre y acero recuperables', 'Cobre', 'Acero')] },
  { Icono: Tv, nombre: 'Televisor', info: 'Panel, parlantes y circuitos', hijos: [c('Circuitos', 'Metales de alto valor', 'Oro', 'Estaño'), c('Parlantes', 'Imanes recuperables', 'Neodimio', 'Cobre')] },
  { Icono: Printer, nombre: 'Impresora', info: 'Motores, rodillos y plásticos', hijos: [c('Motores', 'Cobre e imanes', 'Cobre', 'Hierro'), c('Estructura', 'Plásticos reciclables', 'Plástico', 'Acero')] },
  { Icono: Gamepad2, nombre: 'Consola', info: 'Chips, ventilación y disco', hijos: [c('Procesador', 'Contactos con metales preciosos', 'Oro', 'Silicio'), c('Ventilador', 'Repuesto reutilizable', 'Cobre', 'Plástico')] },
  { Icono: Router, nombre: 'Router', info: 'Antenas y placa de circuitos', hijos: [c('Placa', 'Metales recuperables', 'Plata', 'Estaño'), c('Antena', 'Aluminio y cobre', 'Aluminio', 'Cobre')] },
  { Icono: Headphones, nombre: 'Audífonos', info: 'Imanes, cobre y batería', hijos: [c('Imanes', 'Tierras raras recuperables', 'Neodimio', 'Hierro'), c('Cableado', 'Alto contenido de cobre', 'Cobre', 'Plástico')] },
];

// Datos del Global E-waste Monitor 2024 (UNITAR / UIT).
export const RESIDUOS_ANIO = [
  { etiqueta: '2010', valor: 34, texto: '34 millones de toneladas' },
  { etiqueta: '2022', valor: 62, texto: '62 millones de toneladas' },
  { etiqueta: '2030', valor: 82, texto: 'Proyección: 82 millones', proyeccion: true },
];

export const RECICLAJE = [
  { nombre: 'Reciclaje documentado', valor: 22, hex: '#16a06b' },
  { nombre: 'Sin registro', valor: 78, hex: '#c9ecd9' },
];

export const MATERIALES = [
  { s: 'Oro', d: 'Contactos y procesadores' }, { s: 'Plata', d: 'Soldaduras y circuitos' },
  { s: 'Cobre', d: 'Cableado y bobinas' }, { s: 'Cobalto', d: 'Baterías de ion de litio' }, { s: 'Litio', d: 'Almacenamiento de energía' },
];

export const HALLAZGOS = [
  { Icono: Globe, t: 'Valor sin aprovechar', d: 'En 2022 quedaron sin recuperar recursos por unos 62 000 millones de dólares.' },
  { Icono: ShieldAlert, t: 'Riesgo ambiental', d: 'Plomo, mercurio y cadmio contaminan suelo y agua cuando no hay un tratamiento adecuado.' },
  { Icono: Recycle, t: 'Economía circular', d: 'Reparar y reutilizar prolonga la vida útil y reduce la demanda de materias primas.' },
];

export const PLAN_B = [
  [
    { Icono: Smartphone, t: 'Teléfonos', d: 'Se reparan o se aprovechan su pantalla y su cámara como repuestos.', tag: 'Reutilización' },
    { Icono: Monitor, t: 'Monitores', d: 'Un panel en buen estado se reincorpora a oficinas y aulas.', tag: 'Reutilización' },
    { Icono: BatteryCharging, t: 'Baterías', d: 'Se desmontan bajo protocolo seguro para recuperar sus metales.', tag: 'Reciclaje' },
    { Icono: Gamepad2, t: 'Consolas', d: 'Se reparan o se recuperan sus chips y sistemas de ventilación.', tag: 'Reparación' },
    { Icono: Router, t: 'Routers', d: 'Sus placas devuelven metales a la cadena industrial.', tag: 'Reciclaje' },
  ],
  [
    { Icono: Laptop, t: 'Computadoras', d: 'Se reemplazan los componentes dañados y se entregan listas para operar.', tag: 'Reparación' },
    { Icono: Tablet, t: 'Tablets', d: 'Reacondicionadas, se destinan a escuelas y fundaciones.', tag: 'Donación' },
    { Icono: Printer, t: 'Impresoras', d: 'Sus plásticos y motores se separan para un reciclaje correcto.', tag: 'Reciclaje' },
    { Icono: Tv, t: 'Televisores', d: 'Se reparan o se desmontan sin liberar sustancias peligrosas.', tag: 'Reparación' },
    { Icono: Headphones, t: 'Audífonos', d: 'Se recuperan sus imanes y su cobre.', tag: 'Reciclaje' },
  ],
];

export const PARADAS = [
  { Icono: PackagePlus, t: 'Registro', d: 'El equipo se inscribe en la plataforma y recibe un código único.' },
  { Icono: ScanSearch, t: 'Recepción', d: 'Un centro autorizado lo recibe y documenta su estado.' },
  { Icono: ClipboardCheck, t: 'Evaluación técnica', d: 'Un especialista define si se repara, se reutiliza o se recicla.' },
  { Icono: Truck, t: 'Traslado', d: 'Se envía a su destino y cada movimiento queda registrado.' },
  { Icono: Wrench, t: 'Tratamiento', d: 'Se reacondiciona o se procesa para recuperar sus materiales.' },
  { Icono: Sparkles, t: 'Certificación', d: 'Fotografías y documentos respaldan el destino final del equipo.' },
];

export const ETAPAS_RUTA = [
  { t: 'Punto de recolección', d: 'El equipo ingresa y obtiene su código único' },
  { t: 'Centro de evaluación', d: 'Se determina su estado y su destino' },
  { t: 'Taller de reacondicionamiento', d: 'Se repara o se separan sus materiales' },
  { t: 'Entidad beneficiaria', d: 'Inicia su segunda vida con respaldo documental' },
];

export const INDICADORES = [
  { a: 12480, t: 'equipos recuperados' }, { a: 38, t: 'puntos de recolección' },
  { a: 4.2, dec: 1, sufijo: 't', t: 'de metales recuperados' }, { a: 96, sufijo: '%', t: 'de traslados con evidencia' },
];

export const MESES = [
  ['Ene', 760], ['Feb', 690], ['Mar', 820], ['Abr', 880], ['May', 940], ['Jun', 1010],
  ['Jul', 1060], ['Ago', 1120], ['Sep', 1180], ['Oct', 1240], ['Nov', 1340], ['Dic', 1440],
].map(([etiqueta, valor]) => ({ etiqueta, valor, texto: `${valor.toLocaleString('es')} equipos` }));

export const DESTINOS = [
  { nombre: 'Reparados', valor: 46, hex: '#0f5c3f' },
  { nombre: 'Reciclados', valor: 41, hex: '#3ddc97' },
  { nombre: 'Donados', valor: 13, hex: '#d7f56b' },
];
