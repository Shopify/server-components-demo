FROM node:14.15.3

WORKDIR /opt/notes-app

#COPY package.json package-lock.json ./
COPY package.json yarn.lock ./

RUN yarn

COPY . .

ENTRYPOINT [ "npm", "run" ]
CMD [ "start" ]
