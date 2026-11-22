FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV PORT=5000
ENV DATABASE_URL="file:./dev.db"
ENV JWT_SECRET="super-secret-chat-token-key-2026"
ENV CLIENT_ORIGIN="http://localhost:5173"
ENV NODE_ENV="production"

EXPOSE 5000
CMD ["npm", "start"]
