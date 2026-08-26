# CALLIBOTs Kompass-Kurs per RADIO versenden
#===========================================================
import calliopemini as CM 
import radio


while not CM.compass.is_calibrated():
    CM.compass.calibrate()
CM.display.show("A")
while not CM.button_a.was_pressed():
     CM.sleep(500)

radio.on()
CM.display.show(CM.Image.SQUARE)
CM.sleep(1000)
no = 0

while not CM.button_b.was_pressed():
     while CM.button_a.is_pressed():
         no += 1
         kurs = CM.compass.heading()
         s = "{:4d}, {:4d}, {:6d}".format(no, kurs, 
                            CM.compass.get_field_strength())
         radio.send(s)
         print(s)
         CM.display.show(str(no % 10))
         CM.sleep(1000)
     CM.display.show(CM.Image.SQUARE)
     CM.sleep(1000)

radio.off()
CM.display.show(CM.Image.TARGET)  
