# Multi-stage production build for unified Standalone Webmail

# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/.npmrc ./
RUN npm install --legacy-peer-deps
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm run build

# Stage 2: Build Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json backend/tsconfig.json ./
RUN npm install
COPY backend/src ./src
RUN npm run build

# Stage 3: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm install --only=production
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 4000
CMD ["node", "dist/index.js"]
