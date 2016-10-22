#pragma once
typedef enum {
  ImageGrabberStatusBluetoothDisconnected = 0,
  ImageGrabberStatusPending = 1,
  ImageGrabberStatusFailed = 2,
  ImageGrabberDone = 3,
  ImageGrabberInternetTimeout = 4,
  ImageGrabberNotAnImage = 5,
} ImageGrabberStatus;

typedef void(ImageGrabberCallback)(uint8_t *data, uint16_t size, ImageGrabberStatus status);

typedef struct {
  uint8_t* buffer;
  uint16_t chunk_size;
  ImageGrabberCallback* callback;
} ImageGrabberSettings;

bool image_grabber_get(const char* url);

void image_grabber_init(ImageGrabberSettings settings);

void image_grabber_deinit();
