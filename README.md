# Las cruces que cargamos (V6, revisión final local)

Sitio estático (HTML, CSS y JavaScript, sin build ni backend). Todas las rutas son relativas y la navegación usa rutas con hash (`#/archivo`, `#/objeto/ebook`...), así que funciona bajo `/nombre-repo/` en GitHub Pages.

## Ejecutar en local
Los embeds de YouTube y Spotify exigen `http://`, no `file://`. Se recomienda el servidor de `TOOLS/serve.js` (soporta rangos y conexiones simultáneas):
```bash
node TOOLS/serve.js WEB_LAS_CRUCES 8765
```
y abrir http://localhost:8765/. Para simular la subruta de GitHub Pages: `node TOOLS/serve.js WEB_LAS_CRUCES 8765 /las-cruces` (en Git Bash anteponer `MSYS_NO_PATHCONV=1`).
No uses `python -m http.server`: corta peticiones simultáneas y deja imágenes del e-book sin cargar (ERR_CONNECTION_RESET). Es un fallo del servidor de pruebas, no de la web ni de GitHub Pages.

## Descargas autorizadas (carpeta `descargas/`)
Se regeneran con `TOOLS/ebook_pdf.js` y `TOOLS/build_downloads.py`, y se verifican con `TOOLS/verify_downloads.py`. Todos los paquetes incluyen `CREDITOS_Y_DERECHOS.txt`. No se publican los WAV maestros ni el cortometraje.

## Publicar en GitHub Pages (solo tras aprobación)
Subir el contenido de `WEB_LAS_CRUCES/` (conservar `.nojekyll`), activar Pages desde la rama `main` y carpeta raíz. No subir `TOOLS/`, `BACKUPS/` ni `CONTENIDOS/`.

## Pendiente
- Canal de contacto para consultar disponibilidad del merchandising (`contact` en `js/contenidos.js`). Mientras esté vacío, el botón solo informa.
- Sonido ambiente: no existe archivo original autorizado.
- Títulos finales de los pósters y nombres de las familias de stickers, que hoy son descripciones editoriales.

## Notas de la V6
- `assets/portadas/playlist.webp` es la portada de la Suite con el título «Playlist del Buziraco» y la autoría David Hernández Herrera (texto compuesto sobre la imagen original, que no se modificó).
- En `ebook/app.js` las ilustraciones de otra proporción (desaparicion, regreso, cada_dia) ahora van a página completa. Es el único cambio al código del libro.
- Respaldos anteriores en `../BACKUPS/` (no publicar).
