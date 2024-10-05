FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
     python3 \
     make \
     g++ \
     && rm -rf /var/lib/apt/lists/*

# npm canvas dependencies
RUN apt-get update -y && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

WORKDIR /app

COPY package*.json /app

RUN npm i

COPY . /app

EXPOSE 3000 8443 53462

RUN npm install pm2 -g

ENTRYPOINT ["pm2-runtime", "start", "ecosystem2.config.js"] 
 
