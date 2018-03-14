FROM node:alpine
RUN apk add --no-cache ca-certificates git
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=80
EXPOSE 80
CMD [ "npm", "start" ]
