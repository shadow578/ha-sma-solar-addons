FROM node:16

# create app directory
WORKDIR /usr/app

# copy files over
COPY package*.json ./
COPY . .
RUN npm install

# build the app
RUN npm run build

# expose port 8080
EXPOSE 8080

# copy launch script
RUN chmod a+x /run.sh
CMD [ "./run.sh" ]
