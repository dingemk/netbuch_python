#Neopixel-Funktionen fill() und clear()
#================================================
import calliopemini as CM
import neopixel

pixel = neopixel.NeoPixel(CM.pin_RGB, 3)
while not CM.button_b.was_pressed():
    pixel.fill((150, 150, 0))
    pixel.show()
    CM.sleep(500)
    pixel.clear()
    CM.sleep(500)
pixel.clear()
