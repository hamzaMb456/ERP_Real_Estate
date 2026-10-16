# syntax=docker/dockerfile:1
# Dev image for the Next.js app. Source is bind-mounted by docker-compose.yml,
# so the image only carries Linux node_modules + an entrypoint that re-installs
# them when package-lock.json changes. Env vars are injected at runtime (env_file).
ARG BASE_IMAGE=node:24-bookworm-slim
FROM ${BASE_IMAGE}

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true

COPY package.json package-lock.json ./
RUN npm ci && md5sum package-lock.json > node_modules/.lock.md5

COPY --chmod=755 <<'EOF' /usr/local/bin/docker-entrypoint.sh
#!/bin/sh
set -e
if ! md5sum -c node_modules/.lock.md5 --status 2>/dev/null; then
  npm ci
  md5sum package-lock.json > node_modules/.lock.md5
fi
exec "$@"
EOF

COPY . .

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
