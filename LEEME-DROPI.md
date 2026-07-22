# Integración Excel Dropi → Jan Sel Shop

## Qué se hizo

### 1. `catalog.json` (actualizado)
- 286 productos actualizados con `dropiId` y `provider` (proveedor) real, cruzando por nombre contra tu Excel.
- 10 productos eliminados (los que confirmaste que ya no manejas: Aceite Post Afeitador Ácido Hialurónico, Dvd Niaduvan, Peluche Muñeco Para Pintar, Proyector Lentes Intercambiables, Trípode K07, Pop It Iron Man, Cinturón Para Bebés, Luz Led Para Celular O Laptop Recargable, Compresor Portátil Ref 201, Reloj 135 Suit).
- 1 producto nuevo agregado: Carplay Moto Gps Impermeable.
- **357 productos en total** (antes 366).

### 2. `sync-dropi-to-supabase.ts` + `sync_diff.json`
Tu bot en producción NO lee `catalog.json` directamente — lee de Supabase (tabla `products`, columna `data` en JSONB). Por eso `catalog.json` actualizado NO alcanza solo; necesitas correr este script para reflejar los cambios en producción.

**Cómo correrlo (desde la carpeta del proyecto, con tu `.env` real):**
```bash
npx tsx sync-dropi-to-supabase.ts            # DRY RUN — imprime qué haría, no toca nada
npx tsx sync-dropi-to-supabase.ts --apply    # Aplica de verdad
```
Es quirúrgico: solo toca precio/costo/envío/proveedor/dropiId de los 286 productos que cambiaron, inserta el nuevo, y borra los 10 descontinuados. NO toca stock, imágenes, ni nada que hayas editado en producción después.

**Corre primero el dry run y pégame el output si algo se ve raro antes de aplicar.**

### 3. `server.ts` (lógica de vendedor experto)
Agregué la lógica de venta cruzada dentro del flujo principal de conversación (~línea 1350):
- Cuando el bot arma el inventario que ve la IA para responder, ahora también busca hasta 6 "complementos sugeridos": productos del MISMO proveedor real (y preferentemente misma categoría) que los que el cliente ya está viendo.
- Esos productos se marcan internamente con `🔁 COMPLEMENTO SUGERIDO` — es una señal SOLO para la IA, nunca se le muestra al cliente.
- Agregué una instrucción explícita al prompt: actuar como vendedor experto que sugiere combos de forma natural, presentando todo como "nuestro catálogo", con prohibición absoluta de mencionar la palabra "proveedor", "distribuidor", "lote" o cualquier nombre de proveedor real al cliente.
- No interrumpe si el cliente ya está en checkout, salvo un anexo rápido y de bajo esfuerzo.

## Antes de subir a producción
1. Corré el dry run del script de sync y revisá el log.
2. Probá el bot en un número de prueba pidiendo un producto conocido (ej. algo de DTS IMPORTADORES) y verificá que ofrezca un complemento sin decir "proveedor" ni nombrar marcas internas.
3. Si todo bien, `--apply` en Supabase y deploy de `server.ts`.
