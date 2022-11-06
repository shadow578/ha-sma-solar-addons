FROM node:16

# create app directory
WORKDIR /usr/app

# copy files over
COPY package*.json ./
COPY . .
RUN npm install

# build the app
RUN npm run build

# define app entry & ports
EXPOSE 8080
CMD [ "node", "." ]
