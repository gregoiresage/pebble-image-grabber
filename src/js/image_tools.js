// Scaline & ScaleRect algorithms from : http://www.compuphase.com/graphic/scale.htm 

var ScaleLine = function(Target, Source, SrcWidth, TgtWidth, offset_target, offset_source, numComponents)
{
  var NumPixels = TgtWidth;
  var IntPart = Math.floor(SrcWidth / TgtWidth);
  var FractPart = SrcWidth % TgtWidth;
  var E = 0;

  var i_target = offset_target;
  var i_source = offset_source;

  while (NumPixels-- > 0) {
    for(var i=0; i<numComponents; i++)
      Target[numComponents*i_target + i] = Source[numComponents*i_source + i];
    i_target ++;
    i_source += IntPart;
    E += FractPart;
    if (E >= TgtWidth) {
      E -= TgtWidth;
      i_source ++;
    } /* if */
  } /* while */
}

var ScaleRect = function(Target, Source, SrcWidth, SrcHeight, TgtWidth, TgtHeight, numComponents)
{
  var NumPixels = TgtHeight;
  var IntPart = Math.floor(SrcHeight / TgtHeight) * SrcWidth;
  var FractPart = SrcHeight % TgtHeight;
  var E = 0;

  var i_target = 0;
  var i_source = 0;

  while (NumPixels-- > 0) {
    ScaleLine(Target, Source, SrcWidth, TgtWidth, i_target, i_source, numComponents);
    PrevSource = Source;

    i_target += TgtWidth;
    i_source += IntPart;
    E += FractPart;
    if (E >= TgtHeight) {
      E -= TgtHeight;
      i_source += SrcWidth;
    } /* if */
  } /* while */
}

var greyScale = function(rgba_input, w, h, nb_components){
   var result = [];  // Array of bytes that we produce
   for(var y = 0; y < h; y++){
      for(var x = 0; x < w; x++){
         var i = (y * nb_components) * w + x * nb_components;
         result[y * w + x] = Math.floor(0.299*rgba_input[i] + 0.587*rgba_input[i + 1] + 0.114*rgba_input[i + 2]);        
      }
   }  
   return result;
}

function pushUInt16(array, value){
   array.push(value >> 0 & 0xFF);
   array.push(value >> 8 & 0xFF);
}

function pushUInt32(array, value){
   array.push(value >> 0 & 0xFF);
   array.push(value >> 8 & 0xFF);
   array.push(value >> 16 & 0xFF);
   array.push(value >> 24 & 0xFF);
}

/**
 * Credits : Damian Mehers : http://blog.evernote.com/tech/2014/04/23/evernote-pebble-update/#bitmaps
 */

var toPBI = function(bw_input, width, height){
   // Calculate the number of bytes per row, one bit per pixel, padded to 4 bytes
   var rowSizePaddedWords = Math.floor((width + 31) / 32);
   var widthBytes = rowSizePaddedWords * 4;

   var flags = 1 << 12;             // The version number is at bit 12.  Version is 1
   var result = [];                 // Array of bytes that we produce
   pushUInt16(result, widthBytes);  // row_size_bytes
   pushUInt16(result, flags);       // info_flags
   pushUInt16(result, 0);           // bounds.origin.x
   pushUInt16(result, 0);           // bounds.origin.y
   pushUInt16(result, width);       // bounds.size.w
   pushUInt16(result, height);      // bounds.size.h

   var currentInt = 0;
   for(var y = 0; y < height; y++){
      var bit = 0;
      currentInt = 0;
      for(var x = 0; x < width; x++){
         var color = bw_input[y * width + x];
         if (color == 255) { // black pixel
            currentInt |= (1 << bit);
         }
         bit += 1;
         if (bit == 32) {
            bit = 0;
            pushUInt32(result, currentInt);
            currentInt = 0;
         }
      }
      if (bit > 0) {
        pushUInt32(result, currentInt);
      }
   }

   return result;
}

module.exports = {
  ScaleLine: ScaleLine,
  ScaleRect: ScaleRect,
  greyScale: greyScale,
  toPBI: toPBI 
}
