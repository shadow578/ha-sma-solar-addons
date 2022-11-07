#!/usr/bin/with-contenv bashio
set +u

# load config and write to env 
export SMA_DEBUG_REQUESTS=$(bashio::config 'debug_requests')

# start application
bashio::log.info "starting connector"
node /usr/app/
bashio::log.info "connector shut down"
