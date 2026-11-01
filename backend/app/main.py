from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import load_settings
from .api import admin, auth, ciclo, dispositivos, evidencias, flujo, lotes, movimientos, recepciones, seguimiento
from .domain.errors import ConflictoError, NoEncontradoError, PermisoDenegadoError, ReglaNegocioError

app = FastAPI(title="EcoRAEE Cloud API", version="0.1.0")
_s = load_settings()
if _s.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=list(_s.cors_origins),
                       allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(ReglaNegocioError)
async def regla_handler(_: Request, exc: ReglaNegocioError):
    if isinstance(exc, PermisoDenegadoError):
        status = 403
    elif isinstance(exc, NoEncontradoError):
        status = 404
    elif isinstance(exc, ConflictoError):
        status = 409
    else:
        status = 422
    return JSONResponse(status_code=status, content={"error": exc.codigo, "mensaje": exc.mensaje})


@app.get("/health")
def health():
    return {"estado": "ok"}


app.include_router(auth.router)
app.include_router(dispositivos.router)
app.include_router(lotes.router)
app.include_router(recepciones.router)
app.include_router(movimientos.router)
app.include_router(ciclo.router)
app.include_router(evidencias.router)
app.include_router(flujo.router)
app.include_router(seguimiento.router)
app.include_router(admin.router)
