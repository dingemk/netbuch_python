# Eine vielseitige Funktion zum Anzeigen von Texten
import calliope_mini as CM

def anzeigen(text):
    while not CM.button_b.was_pressed():
        CM.display.show(text, clear=True)
        CM.sleep(1000)

# hier folgen drei Anwendungsbeispiele
anzeigen("HALLO")
anzeigen("Es ist {:} Grad warm.".format(CM.temperature()))
anzeigen("{:3.1f}".format(17.1223))
for i in range(5):
    anzeigen("VON {:} BIS {:}".format(i*10, (i+1)*10))
