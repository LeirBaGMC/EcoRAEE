const trazos = {
  '/': 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  '/usuarios': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.8',
  '/red': 'M9 5h6M5 9v6M19 9v6M9 19h6M2 2h6v6H2zM16 2h6v6h-6zM2 16h6v6H2zM16 16h6v6h-6z',
  '/organizaciones': 'M4 21V5l8-3v19M12 9h8v12M8 7v1M8 11v1M8 15v1M16 13v1M16 17v1M2 21h20',
  '/seguimiento': 'M4 3v18h17M8 16v-5M13 16V7M18 16v-9',
  '/auditoria': 'M9 5h10v16H5V5h4M9 3h6v4H9zM9 12h6M9 16h6',
  '/evidencias': 'M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h5',
  '/dispositivos': 'M3 3h18v13H3zM8 21h8M12 16v5',
  '/movimientos': 'M3 7h15l-4-4M21 17H6l4 4M18 7l-4 4M6 17l4-4',
};
export default function Icono({ ruta = '/', className = '' }) {
  return <svg className={`icono ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={trazos[ruta] || 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4'} /></svg>;
}
