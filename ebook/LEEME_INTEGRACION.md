# El primer pacto · integración en la web (GitHub Pages)

Esta carpeta `ebook/` es autónoma: HTML, CSS, JS e ilustraciones con rutas relativas, sin compilación. Funciona desde cualquier subcarpeta del sitio.

## 1. Publicar

1. Copia la carpeta `ebook/` completa dentro del repositorio del sitio, por ejemplo en la raíz: `tu-repositorio/ebook/`.
2. No cambies nombres de archivos ni mayúsculas: GitHub Pages distingue `Portada.webp` de `portada.webp`.
3. Conserva el archivo oculto `.nojekyll`.
4. Tras publicar, el libro queda en `https://<usuario>.github.io/<repositorio>/ebook/`.

## 2. Enlazar desde la web (recomendado)

```html
<a href="ebook/">Leer «El primer pacto»</a>
```

Es la mejor opción en celulares y para «Guardar PDF», porque el lector usa toda la pantalla. Ajusta la ruta si la página que enlaza está en otra carpeta, por ejemplo `../ebook/`.

## 3. Insertar con iframe

```html
<iframe src="ebook/" title="El primer pacto — cuento ilustrado"
        style="width:100%; height:90vh; border:0;" loading="lazy" allow="fullscreen"></iframe>
```

- No uses el atributo `sandbox`. Si tu plantilla lo exige, incluye `allow-scripts allow-same-origin allow-modals`; sin `allow-modals`, «Guardar PDF» no puede abrir el diálogo de impresión.
- Dale al iframe una altura de al menos 600 px en escritorio. El libro se adapta al espacio disponible.
- Para que funcionen las flechas del teclado, el lector necesita tener el foco: basta un clic sobre el libro.

## 4. Dependencias externas

- Efecto de pasar la hoja: StPageFlip desde `cdn.jsdelivr.net`. Si no carga, el libro funciona igual en su modo alternativo (misma paginación y navegación, sin la curva de la hoja).
- Tipografía EB Garamond desde Google Fonts. Sin ella se usa Georgia y la paginación se recalcula sola.

## 5. Modificar contenidos

- El texto y la dedicatoria aprobados están en `contenido/contenido.js` (`chapters` y `dedication`). No los edites aquí sin aprobación de los autores.
- La posición de cada ilustración se controla con `anchor` (número del párrafo dentro del capítulo) en `plates`.
- Los originales en alta resolución están en la carpeta `Ilustraciones` del proyecto, no en esta carpeta.
