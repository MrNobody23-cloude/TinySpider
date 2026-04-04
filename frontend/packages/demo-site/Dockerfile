FROM node:18-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY pages/ ./pages/
COPY public/ ./public/

# The tracker script is mounted or copied at runtime
RUN mkdir -p /app/packages/tracker/dist /app/packages/tracker/src

EXPOSE 8080
CMD ["node", "server.js"]
