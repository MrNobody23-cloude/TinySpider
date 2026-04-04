FROM node:20-alpine3.20 AS build

WORKDIR /app

COPY package.json ./
RUN npm install; npm cache clean --force

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
