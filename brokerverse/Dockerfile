# Build the React app, then serve the static files with nginx (SPA fallback, API proxied to the backend).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ARG REACT_APP_BASE_URL=/api
ENV REACT_APP_BASE_URL=$REACT_APP_BASE_URL CI=false GENERATE_SOURCEMAP=false
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
