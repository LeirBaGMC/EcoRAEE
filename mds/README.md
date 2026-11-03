# EcoRAEE Cloud

Proyecto de trazabilidad de residuos electrónicos: registro, recepción, evaluación, movimientos entre centros, tratamientos, asignaciones, evidencias y análisis de flujo máximo.

## Estructura

- `backend/`: API FastAPI, reglas de negocio, acceso a SQL Server y pruebas.
- `frontend/`: aplicación React con Vite.
- `backend/ecoraee_cloud_sqlserver.sql`: esquema y catálogos iniciales de SQL Server.
- `backend/CONTRATO_API.md`: endpoints, permisos y errores para desarrollar el frontend.
- `backend/TRAZABILIDAD.md`: reglas y límites de verificación.
- `backend/CAMBIOS_Y_CORRECCIONES.md`: correcciones documentadas del backend.

## Preparar el backend en Windows

Requisitos: Python 3.11 o superior, SQL Server y ODBC Driver 18 for SQL Server.

1. Revisar y ejecutar `backend/ecoraee_cloud_sqlserver.sql` en la instancia local de SQL Server destinada al desarrollo.
2. Desde PowerShell, en la raíz del proyecto:

```powershell
cd backend
python -m venv .venv-windows
.\.venv-windows\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

3. Editar `.env`: ajustar `ECORAEE_DB_URL` al servidor propio y generar una clave `ECORAEE_JWT_SECRET` aleatoria de al menos 32 caracteres. El ejemplo usa una instancia SQLEXPRESS; para una instancia predeterminada puede ser `localhost`. No compartir el `.env`.
4. Mantener `ECORAEE_CORS_ORIGINS=http://localhost:5173` para el frontend local.
5. Crear datos y usuarios de desarrollo siguiendo `backend/LEEME.md`:

```powershell
.\.venv-windows\Scripts\python.exe -m scripts.datos_prueba
.\.venv-windows\Scripts\python.exe -m scripts.crear_usuario adm1 Clave-Prueba-123 ADMINISTRADOR
.\.venv-windows\Scripts\python.exe -m uvicorn app.main:app --reload
```

El script de usuarios crea cuentas nuevas; no repetirlo con nombres existentes. La contraseña mostrada es exclusivamente para datos de prueba locales.

API y documentación: http://localhost:8000/docs. `GET /auth/me` devuelve el perfil y los roles actuales del usuario autenticado.

## Preparar el frontend

Requisitos: Node.js 20 o superior y npm. Desde otra terminal, en la raíz:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Abrir http://localhost:5173. `VITE_API_URL` debe apuntar al backend accesible desde el navegador. `localhost` siempre se refiere al equipo de quien abre la aplicación: la compañera debe ejecutar su backend local o configurar una API compartida.

Para compilar:

```powershell
npm run build
```

## Trabajo del frontend

- Cliente HTTP: `frontend/src/api/client.js`.
- Endpoints: `frontend/src/api/endpoints.js`.
- Sesión y perfil: `frontend/src/auth/AuthContext.jsx`.
- Menú por rol: `frontend/src/lib/permisos.js`.
- Pantallas: `frontend/src/pages/`.
- Estilos: `frontend/src/styles.css`.

El backend decide los permisos reales; ocultar botones no sustituye la autorización. Los errores de negocio usan `{error, mensaje}`, los de autenticación `{detail}` y los de validación `{detail: [...]}`.

Crear una rama por tarea, subir cambios y abrir un pull request. Coordinar los cambios de contrato antes de modificar respuestas o rutas del backend.

## Pruebas y estado

Desde `backend`:

```powershell
.\.venv-windows\Scripts\python.exe -m unittest discover -s tests -t .
.\.venv-windows\Scripts\python.exe -m pytest tests_integracion -v
```

La integración carga `.env`, utiliza SQL Server real y agrega datos de prueba. Ejecutarla sobre una base de desarrollo.

Verificaciones anteriores: 126 pruebas unitarias y 13 de integración aprobadas tras las correcciones de movimientos; posteriormente pasó una prueba adicional de `/auth/me`. La compilación del frontend también pasó. Esto no implica una revisión visual completa ni una validación de S3.

Pendientes: recorrido visual y móvil, S3 y nube, mejoras de listados documentadas en `frontend/LEEME.md` y actualización de dependencias de desarrollo: npm reportó vulnerabilidades en Vite/esbuild. No aplicar actualizaciones mayores sin comprobar la compilación.

## Qué no se comparte

Git excluye `.env`, entornos virtuales, `node_modules`, compilados, logs y `almacen_evidencias`. Se incluyen código, plantillas `.env.example`, esquema SQL, pruebas, documentación y `package-lock.json`. Los registros de la base local no se suben al repositorio.
