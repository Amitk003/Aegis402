FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm install

COPY src/ src/

EXPOSE 3000

CMD ["node", "--import", "tsx", "src/index.ts"]
