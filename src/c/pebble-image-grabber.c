#include <pebble.h>
#include <pebble-events/pebble-events.h>

#include "pebble-image-grabber.h"

static EventHandle s_event_handle;

static ImageGrabberCallback *s_callback;
static uint16_t     chunk_size 		= 0;
static uint8_t      *s_data_image 	= NULL;

static void inbox_received_handler(DictionaryIterator *iter, void *context) {

  Tuple *size_tuple = dict_find(iter, MESSAGE_KEY_PIG_IMAGE_SIZE);
  if(size_tuple) {
	int32_t data_size = size_tuple->value->uint32;
	
	if(s_data_image == NULL)
		s_data_image = malloc(data_size);
  }

  Tuple *image_tuple 	= dict_find(iter, MESSAGE_KEY_PIG_CHUNK_DATA);
  Tuple *index_tuple 	= dict_find(iter, MESSAGE_KEY_PIG_CHUNK_INDEX);
  Tuple *message_tuple 	= dict_find(iter, MESSAGE_KEY_PIG_STATUS);
  if (index_tuple && image_tuple && message_tuple) {
    int32_t index = index_tuple->value->int32;
    ImageGrabberStatus status = message_tuple->value->int32;

    memcpy(s_data_image + index,&image_tuple->value->uint8,image_tuple->length);

    if(s_callback)
      s_callback(s_data_image, index + image_tuple->length, status);

    if(status == ImageGrabberDone){
       s_data_image = NULL;
    }
  }
  else if(message_tuple){
  	if(s_callback)
      s_callback(s_data_image, 0, message_tuple->value->int32);
  }
}

static void fail_and_callback() {
  if(s_callback)
  	s_callback(s_data_image, 0, ImageGrabberStatusFailed);
}

static bool get(const char* url) {
  DictionaryIterator *out;
  AppMessageResult result = app_message_outbox_begin(&out);
  if(result != APP_MSG_OK) {
    fail_and_callback();
    return false;
  }

  dict_write_cstring(out, MESSAGE_KEY_PIG_URL, url);
  dict_write_uint16(out, MESSAGE_KEY_PIG_CHUNK_SIZE, chunk_size);

  result = app_message_outbox_send();
  if(result != APP_MSG_OK) {
    fail_and_callback();
    return false;
  }

  if(s_callback)
  	s_callback(s_data_image, 0, ImageGrabberStatusPending);
  return true;
}

bool image_grabber_get(const char* url) {
  if(!bluetooth_connection_service_peek()) {
    if(s_callback)
    	s_callback(s_data_image, 0, ImageGrabberStatusBluetoothDisconnected);
    return false;
  }
  return get(url);
}

void image_grabber_init(ImageGrabberSettings settings){
  s_data_image = settings.buffer;
  s_callback = settings.callback;
  chunk_size = settings.chunk_size == 0 ? 1000 : settings.chunk_size;

  events_app_message_request_inbox_size(chunk_size + 30);
  events_app_message_request_outbox_size(150);

  s_event_handle = events_app_message_register_inbox_received(inbox_received_handler, NULL);
}

void image_grabber_deinit(){
  events_app_message_unsubscribe(s_event_handle);
}