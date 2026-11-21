# Extra Pass · Instagram automático

Este repositorio publica solo en @extrapass.hoop 5 veces por semana y fabrica el contenido nuevo sin que tengas que tocar nada.

| Día | Qué se publica (20:00) |
|---|---|
| Lunes | Carrusel: una jugada con sus pasos, claves y lectura |
| Martes | Reel: respuesta a una defensa del bloqueo directo o «misma jugada, dos finales» |
| Miércoles | Carrusel: cómo atacar una defensa del bloqueo directo (show, drop, cambio, ice o 2x1) |
| Jueves | Reel |
| Viernes | Carrusel: una jugada con varios finales según la defensa |

Todo sale de las jugadas reales de `app/pizarra.html`, con los dibujos de la propia app y los textos y fuentes de cada ficha.

## Cómo funciona

- `.github/workflows/publicar.yml`: cada día a las 20:00 (21:00 en verano) mira `contenido/calendario.json` y publica lo que toca. Apunta lo publicado en `contenido/publicados.json`.
- `.github/workflows/generar.yml`: cada domingo comprueba si queda contenido para menos de 2 semanas y, si es así, genera 4 semanas más.
- `.github/workflows/token.yml`: cada lunes renueva el permiso de Instagram para que no caduque.
- Las imágenes y vídeos se sirven desde GitHub Pages, que es de donde Instagram los descarga.

Si algo falla, GitHub te manda un email con el error.

## Puesta en marcha (una sola vez, unos 30 minutos)

### 1. Subir esta carpeta a GitHub
1. Crea una cuenta en github.com si no tienes.
2. **New repository** → nombre `extrapass-auto` → **Public** (GitHub Pages gratis solo funciona con repositorios públicos) → Create.
3. **uploading an existing file** → arrastra todo el contenido de esta carpeta (incluida la carpeta oculta `.github`) → Commit.
   Si el navegador no deja subir `.github`, usa GitHub Desktop: File → Add local repository → Publish.

### 2. Activar GitHub Pages
**Settings → Pages → Source: Deploy from a branch → main / (root) → Save.**
Al cabo de un minuto te da una dirección como `https://TU-USUARIO.github.io/extrapass-auto`.

**Settings → Secrets and variables → Actions → pestaña Variables → New repository variable:**
- Nombre `BASE_URL`, valor la dirección de arriba (sin barra al final).

### 3. Permiso de Instagram (token)
1. Tu Instagram tiene que ser profesional (ya lo es).
2. Entra en developers.facebook.com → **My Apps → Create app** → tipo **Business** (o «Otro → Empresa»).
3. Añade el producto **Instagram** → **API setup with Instagram business login**.
4. En «Generate access tokens», **Add account** con @extrapass.hoop y pulsa **Generate token**. Inicia sesión tú en Instagram y copia el token.
5. En GitHub: **Settings → Secrets and variables → Actions → Secrets → New repository secret:** nombre `IG_TOKEN`, valor el token.

El token dura 60 días. El proceso de los lunes lo renueva; para que además guarde el nuevo, crea un segundo secreto `GH_PAT`: en GitHub, **Settings (tu perfil) → Developer settings → Fine-grained tokens → Generate**, solo para este repositorio, con permiso **Secrets: Read and write**.

### 4. Prueba
**Actions → Publicar en Instagram → Run workflow**, con «Solo comprobar» marcado y una fecha del calendario. Tiene que decir el nombre de la cuenta y cuántos archivos encuentra, sin publicar nada.
Si sale bien, ya está: desde ese momento publica solo.

## Cosas útiles

- **Ver qué sale y cuándo:** `contenido/calendario.json`. Cada post está en su carpeta, con `texto.txt` (el pie de foto).
- **Quitar o cambiar un post:** edita su `texto.txt`, cambia sus imágenes, o borra su entrada de `calendario.json`.
- **Generar ya más semanas:** Actions → Generar contenido → Run workflow.
- **Pausar todo:** Actions → Publicar en Instagram → ⋯ → Disable workflow.
- **Nueva versión de la app:** sustituye `app/pizarra.html` y el contenido nuevo usará las jugadas nuevas.
- **Música:** la API de Instagram no deja poner canciones de su biblioteca, así que los reels se publican sin música. Si un reel concreto lo quieres con música, borra su entrada del calendario y súbelo tú desde la app.
- Instagram permite hasta 100 publicaciones al día por API: con 5 a la semana sobra.
