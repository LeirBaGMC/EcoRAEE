# Cuenta temporal para auditorías

Cuenta: auditor1. ID de usuario: 167. Organización: 1, la misma que adm1 y los datos PRUEBA FRONT.

Se asignaron los siete roles existentes: administrador, generador, operador, técnico, coordinador, reacondicionador/reciclador y beneficiaria. No se añadió un rol nuevo ni se desactivaron validaciones. La combinación habilita todas las acciones de la matriz y las pantallas operativas; conserva el acceso de consulta global de administrador.

Las acciones operativas siguen comprobando estado, organización, capacidad, evidencias y destino. Por ejemplo, el rol beneficiaria solo confirma entregas dirigidas a su organización; tener todos los roles no permite confirmar una entrega ajena. Los datos que se modifiquen desde esta cuenta son cambios reales en la base local de desarrollo.

adm1 permanece con ADMINISTRADOR y sus permisos base: usuarios, organizaciones, centros/conexiones, auditoría, evidencias e indicadores/alertas. Conserva la consulta de evidencias de toda la red aprobada anteriormente. Se retiró su ampliación de menú/permisos operativos de lectura.

Para la cuenta multirrol se muestran los formularios de Recepciones, Tratamientos y Cierres junto a sus listados globales; ya no se sustituyen los formularios por una vista de consulta.

135 pruebas backend y 14 frontend aprobadas; compilación correcta. La eliminación de auditor1 queda pendiente hasta que el usuario indique que terminó las auditorías. Si genera registros con referencias al usuario, habrá que conservar la trazabilidad al retirarle acceso, sin borrar el historial.
