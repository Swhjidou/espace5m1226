import hashlib

SEL = "espace-eleve-2027"  # doit être identique à SEL dans index.html

print("Générateur de codes (laissez le nom vide pour quitter)\n")

while True:
    nom = input("Nom de la classe : ").strip().upper()
    if not nom: 
        break

    mdp = input("Mot de passe : ")

    empreinte = hashlib.sha256(f"{SEL}:{nom}:{mdp}".encode("utf-8")).hexdigest()
    print(f'\n"{nom}": "{empreinte}",\n')

# Code: Elmourad

# 5CG2 => 2026-2027=-1
