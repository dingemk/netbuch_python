# Eigene Bilder erstellen

import calliopemini as CM

meinBild = CM.Image("12345:06660:05950:06660:54321")
CM.display.show(meinBild)
CM.sleep(5000)
leeresBild = CM.Image()
CM.display.show(leeresBild)
CM.sleep(1000)
neuesBild = CM.Image()
neuesBild.set_pixel(2, 2, 9)
CM.display.show(neuesBild)