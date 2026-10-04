FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY scripts ./scripts
COPY assets ./assets
RUN mkdir -p /app/uploads && chown -R node:node /app
# build identity shown by GET /api/version (docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) ...)
ARG GIT_COMMIT=
ARG BUILD_TIME=
ARG GIT_REF=
ENV GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME GIT_REF=$GIT_REF
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:8000/api/health || exit 1
CMD ["node", "src/server.js"]
