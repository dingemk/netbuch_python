# RADIO: Empfaenger
#==================================================
import calliopemini as CM 
import radio

CM.display.show("A")
while not CM.button_a.was_pressed():
    CM.sleep(500)

radio.on()
CM.display.clear()

while not CM.button_b.was_pressed():
    message = radio.receive()
    if message != None:
       CM.display.show(CM.Image.SQUARE)
       CM.sleep(500)
       CM.display.show(message)
    CM.sleep(100)
radio.off()
CM.display.show(CM.Image.TARGET)
