FROM node:18-alpine

RUN apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

RUN curl -o common-passwords.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt

EXPOSE 3000

CMD ["node", "server.js"]
