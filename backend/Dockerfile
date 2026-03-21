# ─── Stage 1: Builder ────────────────────────────────────────────────────────
# Compiles TypeScript → dist/ using the full devDependencies toolchain.
# The output of this stage is the only thing copied to the production image.
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so Docker can cache the install layer independently
# of source changes
COPY package.json package-lock.json ./

# Install ALL deps (including TypeScript / tsx needed for tsc)
RUN npm ci

# Prisma schema must be present before `prisma generate` runs
COPY prisma ./prisma/

# Generate the Prisma client types (needed for tsc to resolve @prisma/client)
RUN npx prisma generate

# Copy source and compiler config
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript → dist/
RUN npm run build


# ─── Stage 2: Production ─────────────────────────────────────────────────────
# Lean runtime image — no TypeScript toolchain, no devDependencies.
FROM node:20-alpine AS production

# Runtime dependencies for native modules (bcrypt uses no native code but
# keep openssl for Prisma's query engine)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifests and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema + migrations (needed for `prisma migrate deploy` and
# `prisma generate` at runtime)
COPY prisma ./prisma/

# Generate the Prisma client for the production image
# (the generated JS lands in node_modules/@prisma/client)
RUN npx prisma generate

# Copy compiled output from the builder stage
COPY --from=builder /app/dist ./dist/

# Copy the Docker entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The API listens on PORT (default 4000 — see plugins/env.ts).
# Expose it so docker-compose / reverse proxies can map it.
EXPOSE 4000

# Default command: run the API server.
# Override with "node dist/worker.js" in docker-compose for the worker service.
CMD ["node", "dist/index.js"]

ENTRYPOINT ["docker-entrypoint.sh"]
