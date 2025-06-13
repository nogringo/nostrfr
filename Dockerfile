FROM node:22-alpine

WORKDIR /app

RUN npm install -g pino-pretty

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "index.js", "|", "pino-pretty"]
