# Guido's · Panel de pedidos — sitio estático servido por nginx.
# Sin build step: solo se copian los archivos al servidor web.
FROM nginx:1.27-alpine

# Config de nginx (seguridad, gzip, caché, fallback).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Archivos del frontend. Un mismo contenedor sirve las dos apps:
#   /             → panel del staff (index.html)
#   /reparto.html → app de los motorizados
# css/ y js/ se copian enteras (incluyen styles.css/reparto.css y
# los módulos del panel + reparto-*.js). img/ trae el logo de la marca.
COPY index.html   /usr/share/nginx/html/index.html
COPY reparto.html /usr/share/nginx/html/reparto.html
COPY css          /usr/share/nginx/html/css
COPY js           /usr/share/nginx/html/js
COPY img          /usr/share/nginx/html/img

EXPOSE 80

# Verificación de salud del contenedor (útil en Coolify).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
