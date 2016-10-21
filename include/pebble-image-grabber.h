#pragma once
typedef enum {
  ImageGrabberStatusNotYetFetched = 0,
  ImageGrabberStatusBluetoothDisconnected,
  ImageGrabberStatusPending,
  ImageGrabberStatusFailed
} ImageGrabberStatus;


typedef void(ImageGrabberCallback)(uint8_t **data, uint16_t size, ImageGrabberStatus status);

bool image_grabber_get(const char* url, ImageGrabberCallback *callback);
