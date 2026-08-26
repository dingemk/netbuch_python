# Die Bedeutung der Lagewerte erkunden.
import calliopemini as CM

while not CM.button_b.was_pressed():
    a0, a1, a2 = CM.accelerometer.get_values()
    print("{:6d}  {:6d}  {:6d}".format(a0, a1, a2))
    CM.sleep(1000)