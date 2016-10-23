var messageKeys = require('message_keys');
var omggif      = require('omggif');
var JpegImage   = require('./jpg');
var PNG         = require('./png');
var dithering   = require('./dithering');
var image_tools = require('./image_tools');
var Png4Pebble  = require('./generatepng4pebble.js');

var MessageQueue= require('./js-message-queue.min.js');

var ImageGrabber = function() {

	var DOWNLOAD_TIMEOUT = 20000;

	var ImageGrabberStatusBluetoothDisconnected = 0;
	var ImageGrabberStatusPending = 1;
	var ImageGrabberStatusFailed = 2;
	var ImageGrabberDone = 3;
	var ImageGrabberInternetTimeout = 4;
	var ImageGrabberNotAnImage = 5;

	function _sendBitmap(bitmap, chunk_size){
	  var i = 0;
	  var nextSize = bitmap.length > chunk_size ? chunk_size : bitmap.length;
	  var sliced = bitmap.slice(0, nextSize);
	  i += nextSize;
	  console.log(i + "/" + bitmap.length);

	  var success = function(){
	  	if(i==bitmap.length)
	      return;
	  	
	    nextSize = bitmap.length-i > chunk_size ? chunk_size : bitmap.length-i;
	    sliced = bitmap.slice(i, i + nextSize);
	    i += nextSize;
	    console.log(i + "/" + bitmap.length);
	    MessageQueue.sendAppMessage(
	      {
	      "PIG_CHUNK_INDEX":i-nextSize,
	      "PIG_CHUNK_DATA":sliced,
	      "PIG_STATUS": i==bitmap.length ? ImageGrabberDone : ImageGrabberStatusPending 
	      },
	      success,
	      null
	      );
	  };
	
	  MessageQueue.sendAppMessage(
	      {
	      	"PIG_IMAGE_SIZE": bitmap.length,
	      	"PIG_CHUNK_INDEX": i-nextSize,
	      	"PIG_CHUNK_DATA": sliced,
	      	"PIG_STATUS": i==bitmap.length ? ImageGrabberDone : ImageGrabberStatusPending
	      },
	      success,
	      null
	      );
	}

	function _convertImage(rgbaPixels, numComponents, width, height, final_width, final_height){

	  var watch_info;
	  if(Pebble.getActiveWatchInfo) {
	    watch_info = Pebble.getActiveWatchInfo() || { 'platform' : 'aplite'};
	  } else {
	    watch_info = { 'platform' : 'aplite'};
	  }
	
	  var ratio = Math.min(final_width/width, final_height/height);
	  var ratio = Math.min(ratio,1);
	
	  final_width 	= Math.floor(final_width * ratio);
	  final_height 	= Math.floor(final_height * ratio);
	  var final_pixels = [];
	  var bitmap = [];
	
	  if(watch_info.platform === 'aplite' || watch_info.platform === 'diorite') {
	    var grey_pixels = image_tools.greyScale(rgbaPixels, width, height, numComponents);
	    image_tools.ScaleRect(final_pixels, grey_pixels, width, height, final_width, final_height, 1);
	    dithering.floydSteinberg(final_pixels, final_width, final_height, dithering.pebble_nearest_color_to_black_white);
	    bitmap = image_tools.toPBI(final_pixels, final_width, final_height);
	  }
	  else {
	    image_tools.ScaleRect(final_pixels, rgbaPixels, width, height, final_width, final_height, numComponents);
	    dithering.floydSteinberg(final_pixels, final_width, final_height, dithering.pebble_nearest_color_to_pebble_palette);
	    var png = Png4Pebble.png(final_width, final_height, final_pixels);
	    for(var i=0; i<png.length; i++){
	      bitmap.push(png.charCodeAt(i));
	    }
	  }
	
	  return bitmap;
	}

	// function _convertPbi(data){
	// 	var bitmap = [];
	// 	for(var i=0; i<data.byteLength; i++) {
	// 	  bitmap.push(data[i]);
	// 	}
	// 	return bitmap;
	// }

	function _convertJpeg(data, final_width, final_height){
		console.log("convert JPEG");
		var j = new JpegImage();
		j.parse(data);
		var pixels = j.getData(j.width, j.height);
		return _convertImage(pixels, 3, j.width, j.height, final_width, final_height);
	}

	function _isJpeg(data, final_width, final_height){
		var jpeg_sig = [0xFF,0xD8,0xFF];
		var isjpeg = true;
		for(var i=0; i<jpeg_sig.length && isjpeg; i++){
			isjpeg = data[i]==jpeg_sig[i];
		}
		return isjpeg;
	}

	function _convertGif(data, final_width, final_height){
		console.log("convert GIF");
		var gr = new omggif.GifReader(data);
		console.log("Gif size : "+ gr.width  +" " + gr.height);
		
		var pixels = [];
		gr.decodeAndBlitFrameRGBA(0, pixels);
		
		return _convertImage(pixels, 4, gr.width, gr.height, final_width, final_height);
	}

	function _isGif87a(data){
		var gif87a_sig = [0x47,0x49,0x46,0x38,0x37,0x61];
		var isgif = true;
		for(var i=0; i<gif87a_sig.length && isgif; i++){
			isgif = data[i]==gif87a_sig[i];
		}
		return isgif;
	}

	function _isGif89a(data){
		var gif89a_sig = [0x47,0x49,0x46,0x38,0x39,0x61];
		var isgif = true;
		for(var i=0; i<gif89a_sig.length && isgif; i++){
			isgif = data[i]==gif89a_sig[i];
		}
		return isgif;
	}

	function _isGif(data){
		return _isGif87a(data) || _isGif89a(data);
	}

	function _convertPng(data, final_width, final_height){
		console.log("convert PNG");
		var png     = new PNG(data);
		var width   = png.width;
		var height  = png.height;
		var palette = png.palette;
		var pixels  = png.decodePixels();
		var bitmap  = [];

		if(palette.length > 0){
		  var png_arr = [];
		  for(var i=0; i<pixels.length; i++) {
		    png_arr.push(palette[3*pixels[i]+0] & 0xFF);
		    png_arr.push(palette[3*pixels[i]+1] & 0xFF);
		    png_arr.push(palette[3*pixels[i]+2] & 0xFF);
		  }
		  return _convertImage(png_arr, 3, width, height, final_width, final_height);
		}
		else {
		  var components = pixels.length /( width*height);
		  return _convertImage(pixels, components, width, height, final_width, final_height);
		}
	}

	function _isPng(data){
		var png_sig = [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A];
		var ispng = true;
		for(var i=0; i<8 && ispng; i++){
			ispng = data[i]==png_sig[i];
		}
		return ispng;
	}

	function _convert(data, final_width, final_height){
		console.log("convert");

		if(_isPng(data))
			return _convertPng(data, final_width, final_height);

		if(_isGif(data))
			return _convertGif(data, final_width, final_height);

		if(_isJpeg(data))
			return _convertJpeg(data, final_width, final_height);

		console.log("unknown format");

		MessageQueue.sendAppMessage(
	      {
	      	"PIG_STATUS": ImageGrabberNotAnImage
	      });

		return null;
	}

	function _getImage(url, chunk_size, final_width, final_height){

		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		xhr.responseType = "arraybuffer";
		xhr.onload = function() {
		  clearTimeout(xhrTimeout); // got response, no more need in timeout

		  var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
		  console.log("Image size = "+ data.length + " bytes");

		  var bitmap = _convert(data, final_width, final_height);
		  if(bitmap != null)
		  	_sendBitmap(bitmap, chunk_size);
		};

		var xhrTimeout = setTimeout(function() {
			console.log("Timeout");
			MessageQueue.sendAppMessage(
			{
				"PIG_STATUS": ImageGrabberInternetTimeout
			});
		}, DOWNLOAD_TIMEOUT);

		xhr.send(null);
	}

	Pebble.addEventListener('appmessage', function(e) {
		if (e.payload.hasOwnProperty('PIG_URL') && e.payload.hasOwnProperty('PIG_CHUNK_SIZE')){
			var url = e.payload['PIG_URL'];
			var chunk_size = e.payload['PIG_CHUNK_SIZE'];
			var width = e.payload['PIG_FINAL_WIDTH'];
			var height = e.payload['PIG_FINAL_HEIGHT'];
			_getImage(url, chunk_size, width, height);
		}
	});

};

module.exports = ImageGrabber;