FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run typecheck && npm run build
ENV NODE_ENV=production
ENV API_PORT=3001
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && npm run start:api"]
