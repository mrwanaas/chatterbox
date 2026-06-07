FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create uploads dir
RUN mkdir -p uploads/avatars uploads/attachments uploads/server-icons

EXPOSE 5000

CMD ["node", "src/server.js"]
