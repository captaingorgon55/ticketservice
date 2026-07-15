# ── Build stage ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies first (layer caching)
COPY package*.json ./
RUN npm install

# Source code
COPY . .

# Build the Next.js standalone output
RUN npm run build

# ── Production stage ─────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/models ./src/models

# Copy node_modules for seed script (bcrypt/mongoose)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Run seed on first start, then launch the server
CMD npx tsx scripts/seed.ts && node server.js
