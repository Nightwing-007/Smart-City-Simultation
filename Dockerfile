FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.js .
COPY simulation.js .
COPY graphUtils.js .
EXPOSE 3000
CMD ["node", "index.js"]
