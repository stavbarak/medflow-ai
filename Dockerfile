# NestJS + Prisma — production image (Railway, Fly.io, etc.)
FROM node:20-bookworm-slim AS base

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src/

RUN npm ci \
  && npx prisma generate \
  && npm run build

ENV NODE_ENV=production

EXPOSE 3000

# Railway sets PORT; migrate then start API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
