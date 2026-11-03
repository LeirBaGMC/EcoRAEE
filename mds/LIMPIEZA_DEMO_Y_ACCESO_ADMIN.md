# Eliminación de la demo y acceso del administrador

Se eliminó exclusivamente la demo creada en esta conversación, usando sus IDs exactos y verificando nombres, organizaciones y números de serie antes del borrado. Primero se realizó una simulación con rollback y luego se aplicó en una transacción con las claves foráneas activas.

Eliminados: 7 cuentas demo (incluida demo_adm), 2 organizaciones, 3 centros, 3 conexiones, 15 dispositivos, 13 lotes/solicitudes, 12 recepciones, 11 evaluaciones, 5 movimientos, 2 tratamientos, 2 asignaciones, 2 cierres, 6 evidencias y sus PDF locales, 1 escenario y sus 2 ejecuciones, 2 alertas y los registros auxiliares/auditoría correspondientes. Se conservó adm1 y los datos ajenos a la demo. Se retiró el script que creaba la demo y su guía de IDs ya inexistentes.

El administrador ahora puede listar y descargar evidencias de cualquier organización. Se sigue comprobando que el objetivo exista, que la sesión tenga el rol requerido y que el propósito sea válido. La excepción se aplica solo a lectura: no concede permisos adicionales de subida ni amplía el alcance de otros roles.

Verificación: 132 pruebas unitarias aprobadas. Antes de eliminar los archivos se probaron por HTTP seis consultas y seis descargas con adm1 sobre la organización demo: todas correctas. Para cada archivo, técnico ajeno recibió 404, generador 403 y propósito inválido 422. Un objetivo inexistente devolvió 404 también para adm1.

No se repitió la suite de integración que crea registros permanentes para evitar volver a poblar datos mientras se solicita su limpieza. El backend fue reiniciado para aplicar el cambio; el proyecto permanece activo.
