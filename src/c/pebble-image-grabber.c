#include <pebble.h>
#include <pebble-events/pebble-events.h>

#include "pebble-image-grabber.h"

static EventHandle s_event_handle;

static ImageGrabberStatus s_status;

static uint8_t      *data_image = NULL;
static uint32_t     data_size;

#define CHUNK_SIZE 6000

static void inbox_received_handler(DictionaryIterator *iter, void *context) {
  ImageGrabberCallback *callback = context;

  Tuple *size_tuple = dict_find(iter, MESSAGE_KEY_PIG_IMAGE_SIZE);
  if(size_tuple) {
  	if(data_image)
	  free(data_image);
	data_size = size_tuple->value->uint32;
	data_image = malloc(data_size);
  	callback(&data_image, data_size, s_status);
  }

  Tuple *image_tuple = dict_find(iter, MESSAGE_KEY_PIG_CHUNK_DATA);
  Tuple *index_tuple = dict_find(iter, MESSAGE_KEY_PIG_CHUNK_INDEX);
  if (index_tuple && image_tuple) {
    int32_t index = index_tuple->value->int32;

    APP_LOG(APP_LOG_LEVEL_DEBUG, "image received index=%ld size=%d", index, image_tuple->length);
    memcpy(data_image + index,&image_tuple->value->uint8,image_tuple->length);

    s_status = 1;
    if(image_tuple->length < CHUNK_SIZE){
      s_status = 100;
    }

    callback(&data_image, data_size, s_status);
  }

  // Tuple *message_tuple = dict_find(iter, MESSAGE_KEY_PIG_STATUS);
  // if(message_tuple){
  // 	callback(data_image, data_size, s_status);
  // }
}

static void fail_and_callback(ImageGrabberCallback *callback) {
  APP_LOG(0, "fail_and_callback");
  s_status = ImageGrabberStatusFailed;
  callback(0, 0, s_status);
}

static bool get(const char* url, ImageGrabberCallback *callback) {
  DictionaryIterator *out;
  AppMessageResult result = app_message_outbox_begin(&out);
  if(result != APP_MSG_OK) {
    fail_and_callback(callback);
    return false;
  }

  dict_write_cstring(out, MESSAGE_KEY_PIG_URL, url);

  result = app_message_outbox_send();
  if(result != APP_MSG_OK) {
    fail_and_callback(callback);
    return false;
  }

  s_status = ImageGrabberStatusPending;
  callback(0, 0, s_status);
  return true;
}

bool image_grabber_get(const char* url, ImageGrabberCallback *callback) {
  if(!callback) {
    return false;
  }

  events_app_message_unsubscribe(s_event_handle);
  s_event_handle = events_app_message_register_inbox_received(inbox_received_handler, callback);

  if(!bluetooth_connection_service_peek()) {
    s_status = ImageGrabberStatusBluetoothDisconnected;
    callback(0, 0, s_status);
    return false;
  }

  return get(url, callback);
}