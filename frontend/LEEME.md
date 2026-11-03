# EcoRAEE Cloud - Frontend (React + Vite)

## Estado local verificado (2026-11-01)

- `GET /auth/me` ya esta implementado en el backend y devuelve perfil y roles actuales de SQL Server.
- `npm install` y `npm run build` terminaron correctamente; se genero `package-lock.json`.
- `.env` del frontend creado con `VITE_API_URL=http://localhost:8000`.
- Vite responde en http://localhost:5173 y CORS permite ese origen.
- Verificados por HTTP: clave incorrecta (401), perfil de coo1, tec1 y adm1 (200). La prueba de integracion de /auth/me verifica token ausente y vencido (401).
- El cliente ahora muestra `mensaje` de los errores de negocio. Se quito Dispositivos del menu ADMINISTRADOR porque ese rol no tiene permiso de consulta en el backend.
- Pendiente: recorrido visual real, menus, celular, grafo y evidencias desde el navegador. La automatizacion del navegador local esta deshabilitada en los ajustes de Work.
- `npm audit` reporta 2 vulnerabilidades en dependencias de desarrollo (1 moderada y 1 alta): ver `npm-audit.json`. No se aplico una actualizacion mayor automatica de Vite.

## 0. Referencia del endpoint ya incorporado al backend
El frontend necesita saber quien eres y que roles tienes para armar el menu. El contrato no tenia ese endpoint, asi que se propone `GET /auth/me`.
Agregalo al backend asi:

1) `app/api/schemas.py` - agrega (antes de `class DispositivoIn`) y asegurate de importar `List` de typing:
```python
class PerfilOut(BaseModel):
    id_usuario: int
    nombre_usuario: str
    nombre_visible: str
    roles: List[str]
    id_organizacion: Optional[int] = None
```
2) `app/services/auth_service.py` - agrega arriba `from ..persistence.models import Usuario` y al final:
```python
def perfil(actor) -> dict:
    with transaccion() as s:
        u = s.get(Usuario, actor.id_usuario)
        return {"id_usuario": u.id_usuario, "nombre_usuario": u.nombre_usuario, "nombre_visible": u.nombre_visible,
                "roles": sorted(actor.roles), "id_organizacion": actor.id_organizacion}
```
3) `app/api/auth.py` - cambia los imports a `from fastapi import APIRouter, Depends, HTTPException`, `from ..security import Actor, get_current_actor`, `from .schemas import LoginIn, PerfilOut, TokenOut` y agrega al final:
```python
@router.get("/me", response_model=PerfilOut)
def perfil(actor: Actor = Depends(get_current_actor)):
    return auth_service.perfil(actor)
```
Los roles salen siempre de la base de datos, no del token.

## 1. Requisitos
Node.js 20 o mayor (https://nodejs.org). Backend corriendo en http://localhost:8000.

## 2. Instalar y correr
```
cd frontend
npm install
copy .env.example .env
npm run dev
```
Abre http://localhost:5173 . Usuarios: los que creaste con `scripts.crear_usuario` (gen1, op1, tec1, coo1, rea1, adm1) y la entidad beneficiaria creada desde Administracion.
El backend debe permitir ese origen: en su `.env`, `ECORAEE_CORS_ORIGINS=http://localhost:5173`.

## 3. Que pantalla ve cada rol
| Rol | Pantallas |
|---|---|
| Generador | Dispositivos (registrar), Lotes y solicitudes (crear) |
| Operador de centro | Dispositivos, Lotes y solicitudes (ver), Recepcion, Movimientos (despachar), Evidencias, Centros |
| Tecnico evaluador | Dispositivos (evaluar), Evidencias |
| Coordinador logistico | Dispositivos, Solicitudes (programar recoleccion), Movimientos, Asignaciones, Cierres, Evidencias, Analisis de red, Indicadores y alertas, Centros |
| Reacondicionador o reciclador | Dispositivos, Tratamientos, Evidencias |
| Entidad beneficiaria | Asignaciones (confirmar entrega) |
| Administrador | Usuarios, Organizaciones, Centros y conexiones, Auditoria, Evidencias, Indicadores y alertas |
Ocultar una pantalla es comodidad: la seguridad real la aplica el backend en cada peticion (403 o 404).

## 4. Estructura
- `src/api/client.js`: unico lugar que hace peticiones (token, errores, 401, subida con progreso, descarga protegida).
- `src/api/endpoints.js`: un metodo por endpoint del contrato.
- `src/auth/`: sesion. El token vive en `sessionStorage` (se borra al cerrar la pestana).
- `src/lib/permisos.js`: menu por rol. `src/lib/router.jsx`: rutas por hash (#/ruta), funcionan en S3 sin configuracion extra.
- `src/components/ui.jsx`: componentes comunes (formularios con errores asociados al campo, tablas, estados).
- `src/pages/`: una pantalla por proceso.

## 5. Estado de esta entrega (propuesto / implementado / verificado)
- IMPLEMENTADO: todas las pantallas y todos los endpoints del contrato.
- VERIFICADO (con un servidor SIMULADO, no el backend real): compilacion con esbuild, login correcto e incorrecto, menu por rol, programar movimiento con error 422 y exito, rechazo 409 al evaluar, sesion vencida (401), ruta sin permiso, calculo y grafo del flujo maximo, tabla de corte minimo, vista de celular sin desborde.
- NO VERIFICADO: integracion real con tu backend y SQL Server, `npm install` y `npm run build` con Vite (no habia internet donde se escribio), subida y descarga reales de archivos, lectores de pantalla.
- IMPLEMENTADO Y VERIFICADO LOCALMENTE: `GET /auth/me` (ver estado actualizado al inicio).

## 6. Pendientes del backend para mejorar la interfaz
1. `GET /auth/me`: resuelto.
2. Resuelto: `GET /tratamientos?pagina=&tamano=` lista tratamientos según alcance. El detalle de dispositivo incluye el último tratamiento; las respuestas de inicio y finalización incluyen fechas.
3. Resuelto: los dispositivos incluyen clasificación, permite_asignacion y diagnóstico. Asignaciones descarta clasificaciones no asignables y muestra la identificación de la beneficiaria con RUC.
4. Movimientos y los demás selectores completan la paginación antes de filtrar. `GET /dispositivos` aún no filtra por centro en servidor; eso queda como optimización, sin el recorte anterior de 100 registros.
5. Las ejecuciones guardadas no devuelven la huella de datos ni la interpretacion (solo la ejecucion recien calculada).
6. Cierres muestra requisitos y revisa el dispositivo, el soporte y la fecha antes de habilitar el envío. Conserva entrada por número y los listados de tratamientos/asignaciones para identificar los soportes.
