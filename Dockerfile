FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["npm", "run", "start"]
