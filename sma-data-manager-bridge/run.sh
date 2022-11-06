#!/usr/bin/with-contenv bashio
set +u

# load config and write to env 
export SMA_HOST=$(bashio::config 'sma_host')
export SMA_USERNAME=$(bashio::config 'sma_username')
export SMA_PASSWORD=$(bashio::config 'sma_password')

# start application
bashio::log.info "starting connector"
node /usr/app/
bashio::log.info "connector shut down"
