# LL-238 ? dise?o y plan de implementaci?n

Objetivo: Django valida JWT asim?trico contra JWKS del issuer Supabase configurado y mantiene permisos internos por comercio. Se conserva Supabase Auth y el flujo funcional LL-11..LL-38.

Decisi?n de implementaci?n: ES256/RS256 con PyJWT y cryptography; issuer fijo derivado de SUPABASE_AUTH_URL, audience authenticated, exp/iat/sub/session_id/role obligatorios. No se conf?a en jku/jwk/x5u de cabeceras. HS256/none y tokens service_role se rechazan sin fallback. El proyecto actual publica ES256; no se rotan claves ni se cambia Auth remotamente.

Revocaci?n: pol?tica de access-token hasta expiraci?n. Logout revoca refresh seg?n Supabase; un access-token v?lido puede seguir hasta exp. La consulta /user se conserva para cuenta confirmada/activa y UUID consistente, sin prometer revocaci?n inmediata de sesi?n por ese endpoint. Un fallo JWKS/Auth da 503, token inv?lido 401 y permiso denegado 403. Roles/membres?a se consultan en PostgreSQL, nunca user_metadata.

Plan:
- [x] Inspeccionar autenticaci?n, permisos y JWKS p?blico real.
- [x] Escribir pruebas de firma/claims negativas y observar ausencia de implementaci?n.
- [x] Implementar verificador y conectar antes del control remoto de cuenta.
- [x] A?adir pruebas de rotaci?n, cach?, ca?da de JWKS y cabeceras de confianza.
- [x] Verificar suite completa y contratos PostgreSQL con rol m?nimo.
- [x] Comprobar JWT real localmente sin publicar tokens y el flujo cliente existente.
- [ ] Verificar escaneo de claves, CI y evidencia final.

Riesgos que requieren regresi?n: claves retiradas a?n en cach? (TTL local 60 s m?s cach? del proveedor); kid aleatorio sin tormenta de refresco; indisponibilidad no concede acceso; UUID remoto distinto del sub no concede acceso; roles por correo no deben convertirse en privilegios del cliente.
