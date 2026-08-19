ARG NODE_IMAGE=node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Runtime web minimal : le standalone contient uniquement les dépendances tracées par Next.js.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# Image opérationnelle distincte pour le Job de migration et le worker de recherche.
# Elle n'est jamais utilisée comme service web permanent.
FROM ${NODE_IMAGE} AS operations
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 operations \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=builder --chown=operations:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=operations:nodejs /app/package.json ./package.json
COPY --from=builder --chown=operations:nodejs /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=operations:nodejs /app/prisma ./prisma
COPY --from=builder --chown=operations:nodejs /app/scripts ./scripts
COPY --from=builder --chown=operations:nodejs /app/lib ./lib
COPY --from=builder --chown=operations:nodejs /app/tsconfig.json ./tsconfig.json
USER operations
CMD ["node_modules/.bin/tsx", "scripts/search-worker.ts"]
