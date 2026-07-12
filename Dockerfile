# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/data ./src/data
COPY src/types.ts ./src/types.ts
RUN mkdir -p data/uploads
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
VOLUME ["/app/data/uploads"]
CMD ["npx", "tsx", "server/index.ts"]
