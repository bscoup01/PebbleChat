#include "relay.h"
#include <pebble.h>
#include <message_keys.auto.h>

// Sample health data and send AppMessage payloads to Alloy JS
static AppTimer *s_retry_timer = NULL;
static AppTimer *s_startup_timer = NULL;
static void schedule_retry(uint32_t ms);

static int32_t s_last_steps = -1;
static int32_t s_last_heartrate = -1;
static int32_t s_last_walk_meters = -1;
// Send step count, distance walked, and heartrate to phone
static void send_health_data(void) {
    int32_t steps = 0;
    if(health_service_sum_today(HealthMetricStepCount) > 0) {
        steps = (int32_t)health_service_sum_today(HealthMetricStepCount);
    }

    int32_t heartrate = 0;
    if (health_service_peek_current_value(HealthMetricHeartRateBPM) > 0) {
        heartrate = (int32_t)health_service_peek_current_value(HealthMetricHeartRateBPM);
    }

    int32_t walk_meters = 0;
    if (health_service_sum_today(HealthMetricWalkedDistanceMeters) > 0) {
        walk_meters = (int32_t)health_service_sum_today(HealthMetricWalkedDistanceMeters);
    }

    // Skip sending health data if nothing has changed
    if (steps == s_last_steps && heartrate == s_last_heartrate && walk_meters == s_last_walk_meters) {
        return;
    }
    DictionaryIterator *iter = NULL;
    AppMessageResult result = app_message_outbox_begin(&iter);
    if (result != APP_MSG_OK) {
        APP_LOG(APP_LOG_LEVEL_WARNING, "Outbox_begin failed: %d (retry)", (int)result);
        schedule_retry(2000);
        return;
    }

    dict_write_int32(iter, MESSAGE_KEY_HEALTH_STEPS, steps);
    dict_write_int32(iter, MESSAGE_KEY_HEART_RATE_BPM, heartrate);
    dict_write_int32(iter, MESSAGE_KEY_WALKED_DISTANCE_METERS, walk_meters);

    result = app_message_outbox_send();
    if(result != APP_MSG_OK) {
        APP_LOG(APP_LOG_LEVEL_WARNING, "Outbox_send failed: %d (retry)", (int)result);
        schedule_retry(2000);
        return;
    }

    s_last_steps = steps;
    s_last_heartrate = heartrate;
    s_last_walk_meters = walk_meters;
    
    APP_LOG(APP_LOG_LEVEL_INFO, "Sent steps: %ld, heartrate: %ld, and distance walked: %ld", (long)steps, (long)heartrate, (long)walk_meters);
}

static void retry_timer_handler(void *context) {
    (void)context;
    s_retry_timer = NULL;
    send_health_data();
}
static void schedule_retry(uint32_t ms) {
    // Prevent multiple simultaeous retries
    if (s_retry_timer)
        return;
    s_retry_timer = app_timer_register(ms, retry_timer_handler, NULL);
}

static void startup_timer_handler(void *context) {
    (void)context;
    s_startup_timer = NULL;
    send_health_data();
}

static void health_event_handler(HealthEventType type, void *context) {
    (void)context;
    // Only relay the desired data
    if (type == HealthEventHeartRateUpdate || type == HealthEventMovementUpdate) {
        send_health_data();
    }
}

void health_relay_init(void) {
    health_service_events_subscribe(health_event_handler, NULL);
    // Wait a bit for Alloy's AppMessage channel to be ready
    s_startup_timer = app_timer_register(1000, startup_timer_handler, NULL);
}

void health_relay_deinit(void) {
    health_service_events_unsubscribe();
    if (s_startup_timer) {
        app_timer_cancel(s_startup_timer);
        s_startup_timer = NULL;
    }
    if (s_retry_timer) {
        app_timer_cancel(s_retry_timer);
        s_retry_timer = NULL;
    }
}