#!/usr/bin/with-contenv bashio
set +u

# load config and write to env 
export SMA_COOLDOWN=$(bashio::config 'cooldown')
export SMA_DEBUG_REQUESTS=$(bashio::config 'debug_requests')
export SMA_NO_HTTP_ERROR_CODES=$(bashio::config 'no_http_error_codes')

# start application
bashio::log.info "starting connector"
node /usr/app/
bashio::log.info "connector shut down"
