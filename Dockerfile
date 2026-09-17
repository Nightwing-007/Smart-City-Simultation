FROM node:18-alpine

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Bundle app source
COPY index.js simulation.js graphUtils.js ./

EXPOSE 3000

CMD ["node", "index.js"]
