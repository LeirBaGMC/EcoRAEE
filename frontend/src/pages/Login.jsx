import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAccion, useForm } from '../lib/hooks.js';
import { Alerta, Boton, ErrorApi, Input } from '../components/ui.jsx';

export default function Login() {
  const { entrar, aviso } = useAuth();
  const f = useForm({ nombre: '', clave: '' });
  const [verClave, setVerClave] = useState(false);
  const acc = useAccion(entrar);
  const enviar = (e) => { e.preventDefault(); acc.ejecutar(f.v.nombre.trim(), f.v.clave); };
  return (
    <main className="login">
      <h1>EcoRAEE Cloud</h1>
      <p className="ayuda">Trazabilidad de residuos electronicos. Ingresa con tu usuario.</p>
      {aviso && <Alerta tipo="aviso">{aviso}</Alerta>}
      <form onSubmit={enviar} noValidate>
        <Input label="Usuario" autoComplete="username" requerido {...f.enlazar('nombre')} />
        <Input label="Contrasena" type={verClave ? 'text' : 'password'} autoComplete="current-password" requerido {...f.enlazar('clave')} />
        <label className="campo campo-check"><input type="checkbox" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} /> Mostrar contrasena</label>
        <ErrorApi error={acc.error} ayuda={{ 401: 'Revisa usuario y contrasena. Si sigues sin entrar, pide ayuda al administrador.' }} />
        <Boton type="submit" enviando={acc.enviando} disabled={!f.v.nombre || !f.v.clave}>Ingresar</Boton>
      </form>
    </main>
  );
}
