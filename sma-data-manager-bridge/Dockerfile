ARG BUILD_FROM="alpine:latest"
FROM $BUILD_FROM

# install nodejs and npm
RUN apk add --no-cache --update nodejs npm

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
RUN chmod a+x /usr/app/run.sh
CMD [ "/usr/app/run.sh" ]
