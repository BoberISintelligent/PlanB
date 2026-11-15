FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PORT=3000 HOST=0.0.0.0 WRANGLER_SEND_METRICS=false \
    SITES_RUNTIME_ROOT=/tmp/planb-runtime \
    XDG_CONFIG_HOME=/tmp/planb-config
COPY --from=build --chown=node:node /app /app
# WORKDIR creates /app as root. COPY --chown covers copied entries, so set
# ownership of the existing parent directory explicitly before dropping root.
RUN chown node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start"]
