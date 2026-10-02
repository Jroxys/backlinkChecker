# syntax=docker/dockerfile:1
# One image: builds the web app and the API, serves both from a single Node process.

FROM node:22-slim AS web
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npx vite build

FROM node:22-slim AS server
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_PATH=/data/indexora.db \
    WEB_DIST=/app/web/dist
WORKDIR /app/server
COPY --from=server /build/server/dist ./dist
COPY --from=server /build/server/node_modules ./node_modules
COPY --from=server /build/server/package.json ./
COPY --from=web /build/web/dist /app/web/dist
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/index.js"]
