from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, Query

from ..security import Actor, get_current_actor
from ..services import admin_service as svc
from .schemas import (ActivoIn, AuditoriaPagina, CapacidadConexionIn, CentroIn, CentroOut, ConexionIn, ConexionOut, OrganizacionesPagina,
                      OrganizacionIn, OrganizacionOut, RolesIn, UsuarioIn, UsuarioOut, UsuariosPagina)

router = APIRouter(tags=["administracion"])


@router.get('/consultas/{recurso}')
def consulta_global(recurso: Literal['recepciones', 'tratamientos', 'cierres'], pagina: int = Query(1, ge=1),
                    tamano: int = Query(20, ge=1, le=100), actor: Actor = Depends(get_current_actor)):
    return svc.consulta_global(actor, recurso, pagina, tamano)


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
def crear_usuario(d: UsuarioIn, actor: Actor = Depends(get_current_actor)):
    return svc.crear_usuario(actor, d.correo, d.nombre_usuario, d.nombre_visible, d.contrasena, d.roles, d.id_organizacion)


@router.get("/usuarios", response_model=UsuariosPagina)
def listar_usuarios(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100), actor: Actor = Depends(get_current_actor)):
    return svc.listar_usuarios(actor, pagina, tamano)


@router.put("/usuarios/{id_usuario}/roles", response_model=UsuarioOut)
def cambiar_roles(id_usuario: int, d: RolesIn, actor: Actor = Depends(get_current_actor)):
    return svc.cambiar_roles(actor, id_usuario, d.roles)


@router.put("/usuarios/{id_usuario}/activo", response_model=UsuarioOut)
def cambiar_activo(id_usuario: int, d: ActivoIn, actor: Actor = Depends(get_current_actor)):
    return svc.cambiar_activo(actor, id_usuario, d.activo)


@router.post("/organizaciones", response_model=OrganizacionOut, status_code=201)
def crear_organizacion(d: OrganizacionIn, actor: Actor = Depends(get_current_actor)):
    return svc.crear_organizacion(actor, d.ruc, d.nombre, d.tipo_persona, d.ciudad, d.tipos_actor)


@router.get("/organizaciones", response_model=OrganizacionesPagina)
def listar_organizaciones(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100), tipo_actor: Optional[str] = None,
                          actor: Actor = Depends(get_current_actor)):
    return svc.listar_organizaciones(actor, pagina, tamano, tipo_actor)


@router.post("/centros", response_model=CentroOut, status_code=201)
def crear_centro(d: CentroIn, actor: Actor = Depends(get_current_actor)):
    return svc.crear_centro(actor, d.codigo_centro, d.nombre, d.tipo_centro, d.ciudad, d.capacidad_almacenamiento, d.id_organizacion)


@router.get("/centros", response_model=List[CentroOut])
def listar_centros(actor: Actor = Depends(get_current_actor)):
    return svc.listar_centros(actor)


@router.post("/conexiones", response_model=ConexionOut, status_code=201)
def crear_conexion(d: ConexionIn, actor: Actor = Depends(get_current_actor)):
    return svc.crear_conexion(actor, d.id_centro_origen, d.id_centro_destino, d.capacidad_por_periodo, d.unidad_capacidad)


@router.get("/conexiones", response_model=List[ConexionOut])
def listar_conexiones(actor: Actor = Depends(get_current_actor)):
    return svc.listar_conexiones(actor)


@router.put("/conexiones/{id_conexion}/capacidad", response_model=ConexionOut)
def actualizar_capacidad_conexion(id_conexion: int, d: CapacidadConexionIn, actor: Actor = Depends(get_current_actor)):
    return svc.actualizar_capacidad_conexion(actor, id_conexion, d.capacidad_por_periodo)


@router.get("/catalogos")
def catalogos(actor: Actor = Depends(get_current_actor)):
    return svc.catalogos(actor)


@router.get("/auditoria", response_model=AuditoriaPagina)
def auditoria(pagina: int = Query(1, ge=1), tamano: int = Query(20, ge=1, le=100), tabla: Optional[str] = None,
              clave: Optional[str] = None, actor: Actor = Depends(get_current_actor)):
    return svc.listar_auditoria(actor, pagina, tamano, tabla, clave)
