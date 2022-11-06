/**
 * sma auth token info
 */
export interface AuthTokenInfo {
    access_token: string,
    refresh_token: string,
    token_type: string;
}

/**
 * a value of a single channel of a single component
 */
export interface ChannelValues {
    channelId: string,
    componentId: string,
    values: TimeValuePair[];
}

/**
 * a single value paired with the time the value was taken
 */
export interface TimeValuePair {
    value?: (string | number),
    time: string;
}
