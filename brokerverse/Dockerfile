# BrokerVerse web: build the React app once, serve it with nginx. The image is the same for every environment:
# /env-config.js (API address, environment name) and the /api proxy are written from the container's variables
# when it starts (nginx/40-brokerverse-runtime.sh). Used by docker-compose.yml; Dockerfile.railway differs only
# in the default port.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# Leave REACT_APP_BASE_URL empty: the app then uses /env-config.js, else the same-origin /api.
ARG REACT_APP_BASE_URL=
ENV REACT_APP_BASE_URL=$REACT_APP_BASE_URL CI=false GENERATE_SOURCEMAP=false INLINE_RUNTIME_CHUNK=false
RUN npm run build \
 && ! grep -q "%PUBLIC_URL%" build/index.html \
 && grep -q "/static/js/" build/index.html \
 && grep -q "env-config.js" build/index.html

FROM nginx:1.27-alpine
ENV PORT=80 \
    API_UPSTREAM=http://api:8000 \
    API_BASE_URL= \
    ENVIRONMENT_NAME= \
    ENVIRONMENT_COLOR= \
    ANALYTICS_ENABLED=false
COPY scripts/env-config.sh scripts/nginx-snippets.sh /opt/brokerverse/
COPY nginx/40-brokerverse-runtime.sh /docker-entrypoint.d/40-brokerverse-runtime.sh
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
RUN chmod 755 /opt/brokerverse/*.sh /docker-entrypoint.d/40-brokerverse-runtime.sh \
 && rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/brokerverse
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
