# --- Beispiel: sas_pygame-Demo OOP ---

from sas_pygame import View, Rectangle, Ellipse, Text, SASButton, SASLabel

# Fenster und Szene
view = View(640, 480, "white", "OOP-Demo")

# Objekte erzeugen
rect = Rectangle(100, 100, 120, 80, "red")
ellipse = Ellipse(300, 150, 160, 100, "blue")
label = SASLabel(20, 20, 180, 30, "SAS-Pygame läuft!", "green")
button = SASButton(20, 400, 150, 40, "Bewegen", "orange")

# Ereignissteuerung
dx, dy = 5, 0  # Bewegungsrichtung

def update_scene():
    global dx, dy
    # Button gedrückt?
    if button.clicked():
        rect.move(dx, dy)
        if rect.get_shape_x() > 400 or rect.get_shape_x() < 50:
            dx = -dx  # Richtung umkehren
    # Kollisionsprüfung
    if rect.intersects(ellipse):
        label.set_text("Kollision!")
    else:
        label.set_text("Keine Kollision.")

# Hauptschleife
while view.running:
    view.process_events()
    update_scene()
    view.scene.draw()
    view.clock.tick(60)

print("Programm beendet.")