# 1. Build Client (React + Vite)
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# 2. Build Server (Express + TypeScript + Prisma)
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
COPY server/prisma ./prisma/
RUN npm install
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# 3. Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=server-builder /app/server/package*.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/prisma ./prisma

# Built frontend static files
COPY --from=client-builder /app/client/dist ./public

ENV PORT=5000
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/dev.db"
ENV JWT_SECRET="super-secret-chat-token-key-2026"

EXPOSE 5000

# Ensure data directory, push Prisma schema to SQLite, and run
CMD ["sh", "-c", "mkdir -p /data && npx prisma db push --skip-generate && node dist/index.js"]