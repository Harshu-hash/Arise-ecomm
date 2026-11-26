FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Fixed uid so the host uploads dir can be chowned to it: chown 1001:1001 /var/www/uploads
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts
USER app
EXPOSE 4000
CMD ["node", "src/app/server.js"]

