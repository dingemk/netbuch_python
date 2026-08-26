# ?????
import calliopemini as CM
import random

while not CM.button_b.was_pressed():
    if CM.pin_logo.is_touched():
        x = random.randint(0, 4)
        y = random.randint(0, 4)
        leuchten = random.randint(1, 9)
        CM.display.set_pixel(x, y, leuchten)
        if CM.button_a.is_pressed():
            print(x, y, leuchten)
    else:
        CM.display.clear()
        if CM.button_a.is_pressed():
            print("clear")
    CM.sleep(300)
CM.display.clear()
print("ENDE")