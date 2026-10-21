FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached between deploys.
COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./

# The host tells us which port to bind; server.js already reads process.env.PORT.
ENV PORT=5050
EXPOSE 5050

CMD ["node", "server.js"]
