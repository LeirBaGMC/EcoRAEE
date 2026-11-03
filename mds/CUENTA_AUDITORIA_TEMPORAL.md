# Cuenta temporal para auditorías

Cuenta: auditor1. ID de usuario: 167. Organización: 1, la misma que adm1 y los datos PRUEBA FRONT.

Se conserva activa por instrucción del usuario para la demostración local. Contraseña de prueba: `Auditoria-Prueba-123`. Esta cuenta y clave son únicamente para datos ficticios de desarrollo.

## Recrear en otra instalación local

Git comparte el código y el esquema; no transporta las filas de la base local. Después de preparar SQL Server, los catálogos y el .env propio, ejecutar lo siguiente desde backend **solo si auditor1 todavía no existe**:

```powershell
.\.venv-windows\Scripts\python.exe -m scripts.crear_usuario auditor1 Auditoria-Prueba-123 ADMINISTRADOR GENERADOR OPERADOR_CENTRO TECNICO_EVALUADOR COORDINADOR_LOGISTICO REACONDICIONADOR_RECICLADOR ENTIDAD_BENEFICIARIA
```

Se usa el script existente, que asocia la cuenta a la organización de prueba con RUC 0999999999001. No repetirlo en la base actual: auditor1 ya existe y está activo. Los identificadores pueden ser distintos en otra instalación.

## Alcance

Se asignaron los siete roles existentes: administrador, generador, operador, técnico, coordinador, reacondicionador/reciclador y beneficiaria. No se añadió un rol nuevo ni se desactivaron validaciones. La combinación habilita todas las acciones de la matriz y las pantallas operativas; conserva el acceso de consulta global de administrador.

Las acciones operativas siguen comprobando estado, organización, capacidad, evidencias y destino. Por ejemplo, el rol beneficiaria solo confirma entregas dirigidas a su organización; tener todos los roles no permite confirmar una entrega ajena. Los datos que se modifiquen desde esta cuenta son cambios reales en la base local de desarrollo.

adm1 permanece con ADMINISTRADOR y sus permisos base: usuarios, organizaciones, centros/conexiones, auditoría, evidencias e indicadores/alertas. Conserva la consulta de evidencias de toda la red aprobada anteriormente. Se retiró su ampliación de menú/permisos operativos de lectura.

Para la cuenta multirrol se muestran los formularios de Recepciones, Tratamientos y Cierres junto a sus listados globales; ya no se sustituyen los formularios por una vista de consulta.

Estado reciente: 155 pruebas backend y 40 frontend aprobadas; compilación correcta. Ver CORRECCIONES_IMPLEMENTADAS.md. La retirada de auditor1 queda pendiente de terminar la demostración y de la indicación del usuario. Debe conservarse la trazabilidad de los registros que ya referencian esta cuenta.
