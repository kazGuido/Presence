FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install 2>/dev/null || npm install

COPY server.mjs ./

ENV PORT=3005
ENV WHATSAPP_DATA_DIR=/data

EXPOSE 3005

CMD ["node", "server.mjs"]
