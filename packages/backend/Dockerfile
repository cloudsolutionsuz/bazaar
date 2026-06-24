# Reference image, not yet build-tested (no Docker available in the current
# dev environment - see project notes). Build from the monorepo ROOT, not
# this directory, since npm workspaces hoist shared deps into the root
# node_modules:
#   docker build -f packages/backend/Dockerfile -t bazaar-backend .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/package.json
RUN npm ci

# Separate prod-only install so devDependencies (typescript, vitest, prisma
# CLI) don't end up in the runtime image.
FROM node:20-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/package.json
RUN npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/backend packages/backend
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma
RUN npm run build --workspace=@bazaar/backend

FROM node:20-alpine AS runtime
WORKDIR /app/packages/backend
ENV NODE_ENV=production
COPY --from=deps-prod /app/node_modules /app/node_modules
# The Prisma client (query engine + generated JS) is only produced by
# `prisma generate` in the build stage above - overlay just that piece onto
# the prod-only node_modules from deps-prod.
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client /app/node_modules/@prisma/client
COPY --from=build /app/packages/backend/dist ./dist
COPY --from=build /app/packages/backend/prisma ./prisma
COPY packages/backend/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/server.js"]
