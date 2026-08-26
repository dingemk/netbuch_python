#Neopixel-Kette mit 3 RGB-LEDs
#================================================
import calliopemini as CM
import neopixel

pixel = neopixel.NeoPixel(CM.pin_RGB, 3) 
pixel[0] = (255, 0, 0)
pixel[1] = (0, 128, 0) 
pixel[2] = (0, 0, 64)
pixel.show()

while not CM.button_b.is_pressed():
   pass

pixel.clear()
