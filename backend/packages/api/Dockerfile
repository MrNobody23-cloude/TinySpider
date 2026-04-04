FROM node:20-alpine3.20 AS deps

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev; npm cache clean --force

FROM gcr.io/distroless/nodejs20-debian12:nonroot

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY src ./src

EXPOSE 3000
CMD ["src/index.js"]
